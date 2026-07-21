import { Telegraf } from "telegraf";
import {
  extractUrl,
  getPlatformName,
  getVideoUrl,
  fetchAsStream,
} from "./downloader";
import { getCached, setCached } from "./cache";

export function createBot(token: string): Telegraf {
  const bot = new Telegraf(token, { handlerTimeout: 90_000 });

  bot.start((ctx) =>
    ctx.reply(
      "👋 أهلاً! أرسل رابط مقطع من أي منصة وأرسله لك بدون علامة مائية ⚡\n\n" +
        "تيك توك · إنستغرام · يوتيوب · تويتر · فيسبوك · سناب · ريدت · وأكثر"
    )
  );

  bot.help((ctx) =>
    ctx.reply(
      "🎬 *المنصات المدعومة:*\n\n" +
        "• TikTok — بدون علامة مائية\n" +
        "• Instagram Reels & Posts\n" +
        "• YouTube Shorts & Videos\n" +
        "• Twitter / X\n" +
        "• Facebook · Snapchat\n" +
        "• Reddit · Pinterest\n" +
        "• Twitch · Vimeo · Dailymotion\n\n" +
        "📌 فقط أرسل الرابط مباشرة!",
      { parse_mode: "Markdown" }
    )
  );

  bot.on("text", async (ctx) => {
    const url = extractUrl(ctx.message.text);
    if (!url) return;

    const platform = getPlatformName(url);

    // ── 1. Cache hit: resend in ~100ms using Telegram's file_id ─────────
    const cachedId = getCached(url);
    if (cachedId) {
      try {
        await ctx.replyWithVideo(cachedId, { caption: `✅ ${platform}` });
        return;
      } catch {
        // file_id expired or invalid — fall through to fresh download
      }
    }

    // ── 2. Get direct CDN url (tikwm race + cobalt, ~200-400ms) ─────────
    let videoUrl: string | null = null;
    try {
      videoUrl = await getVideoUrl(url);
    } catch { /* ignore */ }

    if (!videoUrl) {
      await ctx.reply("❌ تعذّر التحميل، تأكد أن الحساب عام والرابط صحيح.");
      return;
    }

    // ── 3. Send URL directly — Telegram fetches from CDN (no server hop) ──
    try {
      const sent = await ctx.replyWithVideo(videoUrl, {
        caption: `✅ ${platform}`,
      });
      const fileId = sent.video?.file_id;
      if (fileId) setCached(url, fileId);
      return;
    } catch { /* URL not accessible by Telegram — fallback to stream */ }

    // ── 4. Last resort: stream through server ────────────────────────────
    try {
      const stream = await fetchAsStream(videoUrl);
      const sent = await ctx.replyWithVideo(
        { source: stream, filename: "video.mp4" },
        { caption: `✅ ${platform}` }
      );
      const fileId = sent.video?.file_id;
      if (fileId) setCached(url, fileId);
    } catch (err: unknown) {
      console.error("Error:", err instanceof Error ? err.message : err);
      await ctx.reply("❌ خطأ في التحميل، حاول مجددًا.");
    }
  });

  return bot;
}
