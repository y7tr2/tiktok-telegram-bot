import { Telegraf } from "telegraf";
import {
  extractUrl,
  getPlatformName,
  getVideoUrl,
  fetchAsStream,
} from "./downloader";

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
        "• Facebook\n" +
        "• Snapchat\n" +
        "• Reddit\n" +
        "• Pinterest\n" +
        "• Twitch Clips\n" +
        "• Vimeo · Dailymotion\n\n" +
        "📌 فقط أرسل الرابط مباشرة!",
      { parse_mode: "Markdown" }
    )
  );

  bot.on("text", async (ctx) => {
    const url = extractUrl(ctx.message.text);
    if (!url) return;

    const platform = getPlatformName(url);

    let videoUrl: string | null = null;
    try {
      videoUrl = await getVideoUrl(url);
    } catch {
      await ctx.reply("❌ تعذّر التحميل، تأكد أن الحساب عام والرابط صحيح.");
      return;
    }

    if (!videoUrl) {
      await ctx.reply("❌ تعذّر التحميل، تأكد أن الحساب عام والرابط صحيح.");
      return;
    }

    // ── Try sending URL directly (Telegram fetches from CDN — fastest) ──
    try {
      await ctx.replyWithVideo(videoUrl, { caption: `✅ ${platform}` });
      return;
    } catch {
      // URL didn't work → stream the video through our server
    }

    // ── Stream from CDN → Telegram directly (no temp file, no disk I/O) ──
    try {
      const stream = await fetchAsStream(videoUrl);
      await ctx.replyWithVideo(
        { source: stream },
        { caption: `✅ ${platform}` }
      );
    } catch (err: unknown) {
      console.error("Stream error:", err instanceof Error ? err.message : err);
      await ctx.reply("❌ خطأ في التحميل، حاول مجددًا.");
    }
  });

  return bot;
}
