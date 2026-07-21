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
  "tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
  "instagram.com",
  "instagr.am",
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "t.co",
  "facebook.com",
  "fb.watch",
  "fb.com",
  "m.facebook.com",
  "snapchat.com",
  "pinterest.com",
  "pin.it",
  "reddit.com",
  "v.redd.it",
  "redd.it",
  "twitch.tv",
  "clips.twitch.tv",
  "vimeo.com",
  "dailymotion.com",
  "dai.ly",
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
    } catch {
      // skip invalid URLs
    }
  }
  return null;
}

function getPlatformName(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes("tiktok")) return "TikTok";
    if (hostname.includes("instagram") || hostname.includes("instagr.am"))
      return "Instagram";
    if (hostname.includes("youtube") || hostname.includes("youtu.be"))
      return "YouTube";
    if (hostname.includes("twitter") || hostname.includes("x.com"))
      return "Twitter / X";
    if (hostname.includes("facebook") || hostname.includes("fb."))
      return "Facebook";
    if (hostname.includes("snapchat")) return "Snapchat";
    if (hostname.includes("reddit") || hostname.includes("redd.it"))
      return "Reddit";
    if (hostname.includes("pinterest") || hostname.includes("pin.it"))
      return "Pinterest";
    if (hostname.includes("twitch")) return "Twitch";
    if (hostname.includes("vimeo")) return "Vimeo";
    if (hostname.includes("dailymotion") || hostname.includes("dai.ly"))
      return "Dailymotion";
    if (hostname.includes("linkedin")) return "LinkedIn";
    if (hostname.includes("bilibili")) return "Bilibili";
    if (hostname.includes("kwai")) return "Kwai";
  } catch {
    // ignore
  }
  return "Video";
}

export async function downloadVideo(
  url: string
): Promise<{ filePath: string; platform: string } | null> {
  const id = crypto.randomBytes(8).toString("hex");
  const outputTemplate = path.join(TMP_DIR, `${id}.%(ext)s`);
  const platform = getPlatformName(url);

  await execFileAsync(
    "yt-dlp",
    [
      "--no-playlist",
      "--max-filesize",
      "49m",
      // Prefer a single mp4 stream to avoid ffmpeg merging requirement
      "-f",
      "best[ext=mp4][height<=720]/best[ext=mp4]/bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best",
      "--merge-output-format",
      "mp4",
      "--no-warnings",
      "-q",
      "--no-check-certificates",
      "-o",
      outputTemplate,
      url,
    ],
    { timeout: 90_000 }
  );

  const files = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(id));
  if (files.length === 0) return null;

  return { filePath: path.join(TMP_DIR, files[0]), platform };
}

export function deleteFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}
