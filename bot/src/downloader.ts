import { execFile } from "child_process";
import { promisify } from "util";
import { Readable } from "stream";

const execFileAsync = promisify(execFile);

const SUPPORTED_DOMAINS = [
  "tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
  "instagram.com", "instagr.am",
  "youtube.com", "youtu.be",
  "twitter.com", "x.com", "t.co",
  "facebook.com", "fb.watch", "fb.com", "m.facebook.com",
  "snapchat.com", "pinterest.com", "pin.it",
  "reddit.com", "v.redd.it", "redd.it",
  "twitch.tv", "clips.twitch.tv",
  "vimeo.com", "dailymotion.com", "dai.ly",
  "linkedin.com", "bilibili.com", "kwai.com",
];

export function extractUrl(text: string): string | null {
  const matches = text.match(/(https?:\/\/[^\s]+)/g);
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
  } catch { /* ignore */ }
  return "Video";
}

// ── 1. tikwm.com — fastest TikTok API (~200ms) ───────────────────────────────
async function tikwmUrl(url: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({ url, hd: "1" });
    const res = await fetch("https://www.tikwm.com/api/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code: number;
      data?: { hdplay?: string; play?: string };
    };
    if (json.code !== 0 || !json.data) return null;
    return json.data.hdplay || json.data.play || null;
  } catch {
    return null;
  }
}

// ── 2. Cobalt API — supports all other platforms ─────────────────────────────
async function cobaltUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "tg-bot/1.0",
      },
      body: JSON.stringify({ url, videoQuality: "720", filenameStyle: "basic", downloadMode: "auto" }),
      signal: AbortSignal.timeout(7_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string; url?: string;
      picker?: Array<{ url: string; type: string }>;
    };
    if ((data.status === "redirect" || data.status === "tunnel") && data.url) return data.url;
    if (data.status === "picker" && data.picker) {
      const v = data.picker.find((p) => p.type === "video") ?? data.picker[0];
      return v?.url ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// ── 3. yt-dlp -g — direct url extraction, no download ───────────────────────
async function ytdlpDirectUrl(url: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("yt-dlp", [
      "--no-playlist", "-g",
      "-f", "best[ext=mp4][height<=480]/best[ext=mp4]/best",
      "--no-warnings", "--no-check-certificates",
      "--socket-timeout", "8", "--extractor-retries", "1", "--retries", "1",
      url,
    ], { timeout: 15_000 });
    const first = stdout.trim().split("\n")[0] ?? "";
    return first.startsWith("http") ? first : null;
  } catch {
    return null;
  }
}

// ── Main: try all sources, return the first working direct url ───────────────
export async function getVideoUrl(url: string): Promise<string | null> {
  const isTikTok = url.includes("tiktok.com") || url.includes("vm.tiktok") || url.includes("vt.tiktok");

  if (isTikTok) {
    // Race tikwm vs cobalt for TikTok — take whichever is faster
    const [tkUrl, cbUrl] = await Promise.allSettled([tikwmUrl(url), cobaltUrl(url)]);
    const result =
      (tkUrl.status === "fulfilled" && tkUrl.value) ||
      (cbUrl.status === "fulfilled" && cbUrl.value) ||
      null;
    if (result) return result;
  } else {
    const cbUrl = await cobaltUrl(url);
    if (cbUrl) return cbUrl;
  }

  // Last resort: yt-dlp
  return ytdlpDirectUrl(url);
}

// ── Stream video from CDN → Node Readable (pipe directly to Telegram) ────────
export async function fetchAsStream(videoUrl: string): Promise<Readable> {
  const res = await fetch(videoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      Referer: "https://www.tiktok.com/",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok || !res.body) throw new Error(`Fetch failed: ${res.status}`);
  return Readable.fromWeb(res.body as import("stream/web").ReadableStream);
}
