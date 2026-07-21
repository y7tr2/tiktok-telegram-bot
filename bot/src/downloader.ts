import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as os from "os";

const execFileAsync = promisify(execFile);

const TMP_DIR = path.join(os.tmpdir(), "tg-bot-dl");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const SUPPORTED_DOMAINS = [
  "tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
  "instagram.com", "instagr.am",
  "youtube.com", "youtu.be",
  "twitter.com", "x.com", "t.co",
  "facebook.com", "fb.watch", "fb.com", "m.facebook.com",
  "snapchat.com",
  "pinterest.com", "pin.it",
  "reddit.com", "v.redd.it", "redd.it",
  "twitch.tv", "clips.twitch.tv",
  "vimeo.com",
  "dailymotion.com", "dai.ly",
  "linkedin.com",
  "bilibili.com",
  "kwai.com",
];

export function extractUrl(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  if (!matches) return null;
  for (const url of matches) {
    try {
      const { hostname } = new URL(url);
      if (SUPPORTED_DOMAINS.some((d) => hostname.includes(d))) return url;
    } catch { /* skip */ }
  }
  return null;
}

export function getPlatformName(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes("tiktok")) return "TikTok";
    if (hostname.includes("instagram") || hostname.includes("instagr.am")) return "Instagram";
    if (hostname.includes("youtube") || hostname.includes("youtu.be")) return "YouTube";
    if (hostname.includes("twitter") || hostname.includes("x.com")) return "Twitter / X";
    if (hostname.includes("facebook") || hostname.includes("fb.")) return "Facebook";
    if (hostname.includes("snapchat")) return "Snapchat";
    if (hostname.includes("reddit") || hostname.includes("redd.it")) return "Reddit";
    if (hostname.includes("pinterest") || hostname.includes("pin.it")) return "Pinterest";
    if (hostname.includes("twitch")) return "Twitch";
    if (hostname.includes("vimeo")) return "Vimeo";
    if (hostname.includes("dailymotion") || hostname.includes("dai.ly")) return "Dailymotion";
    if (hostname.includes("linkedin")) return "LinkedIn";
    if (hostname.includes("bilibili")) return "Bilibili";
    if (hostname.includes("kwai")) return "Kwai";
  } catch { /* ignore */ }
  return "Video";
}

// ── 1st ATTEMPT: Cobalt API — returns direct url in ~300-500ms ────────────────
// No yt-dlp, no download, just a fast API call then Telegram fetches from CDN.
interface CobaltResponse {
  status: "redirect" | "tunnel" | "picker" | "error";
  url?: string;
  picker?: Array<{ url: string; type: string }>;
}

export async function getCobaltUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "tg-bot/1.0",
      },
      body: JSON.stringify({
        url,
        videoQuality: "720",
        filenameStyle: "basic",
        downloadMode: "auto",
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as CobaltResponse;

    if ((data.status === "redirect" || data.status === "tunnel") && data.url) {
      return data.url;
    }

    // Instagram / multi-media picker → return first video
    if (data.status === "picker" && data.picker) {
      const video = data.picker.find((p) => p.type === "video") ?? data.picker[0];
      return video?.url ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

// ── 2nd ATTEMPT: yt-dlp -g — extract direct url, no download ────────────────
export async function getYtdlpDirectUrl(url: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "yt-dlp",
      [
        "--no-playlist", "-g",
        "-f", "best[ext=mp4][height<=480]/best[ext=mp4]/best",
        "--no-warnings", "--no-check-certificates",
        "--socket-timeout", "8",
        "--extractor-retries", "1",
        "--retries", "1",
        url,
      ],
      { timeout: 15_000 }
    );
    const first = stdout.trim().split("\n")[0] ?? "";
    return first.startsWith("http") ? first : null;
  } catch {
    return null;
  }
}

// ── 3rd ATTEMPT (last resort): download to disk then upload ─────────────────
export async function downloadToFile(
  url: string
): Promise<{ filePath: string } | null> {
  const id = crypto.randomBytes(8).toString("hex");
  const outputTemplate = path.join(TMP_DIR, `${id}.%(ext)s`);

  await execFileAsync(
    "yt-dlp",
    [
      "--no-playlist",
      "--max-filesize", "49m",
      "-f", "best[ext=mp4][height<=480]/best[ext=mp4]/best",
      "--no-warnings", "-q",
      "--no-check-certificates",
      "--concurrent-fragments", "16",
      "--buffer-size", "1M",
      "--no-part",
      "--retries", "2",
      "--socket-timeout", "10",
      "-o", outputTemplate,
      url,
    ],
    { timeout: 60_000 }
  );

  const files = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(id));
  if (files.length === 0) return null;
  return { filePath: path.join(TMP_DIR, files[0]) };
}

export function deleteFile(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}
