import { Telegraf } from "telegraf";
import * as fs from "fs";
import {
  extractUrl,
  getPlatformName,
  getCobaltUrl,
  getYtdlpDirectUrl,
  downloadToFile,
  deleteFile,
} from "./downloader";

export function createBot(token: string): Telegraf {
  const bot = new Telegraf(token);

  bot.start((ctx) =>
    ctx.reply(
      "👋 أهلاً! أرسل لي رابط مقطع من أي منصة وأحمّله لك بدون علامة مائية ⚡\n\n" +
        "يدعم: تيك توك · إنستغرام · يوتيوب · تويتر · فيسبوك · سناب · ريدت · وأكثر"
    )
  );

  bot.help((ctx) =>
    ctx.reply(
      "🎬 *المنصات المدعومة:*\n\n" +
        "• TikTok — بدون علامة مائية\n" +
        "• Instagram — Reels & Posts\n" +
        "• YouTube — Shorts & Videos\n" +
        "• Twitter / X\n" +
        "• Facebook\n" +
        "• Snapchat\n" +
        "• Reddit\n" +
        "• Pinterest\n" +
        "• Twitch Clips\n" +
        "• Vimeo\n" +
        "• Dailymotion\n" +
        "• وأكثر...\n\n" +
        "📌 فقط أرسل الرابط مباشرة!",
      { parse_mode: "Markdown" }
    )
  );

  bot.on("text", async (ctx) => {
    const url = extractUrl(ctx.message.text);
    if (!url) return;

    const platform = getPlatformName(url);

    // ── 1st: Cobalt API (~300-500ms) — fastest, no download needed ──
    try {
      const cobaltUrl = await getCobaltUrl(url);
      if (cobaltUrl) {
        await ctx.replyWithVideo(cobaltUrl, { caption: `✅ ${platform}` });
        return;
      }
    } catch { /* fall through */ }

    // ── 2nd: yt-dlp -g (direct url, ~2s) — no server download ───────
    const waitMsg = await ctx.reply("⬇️");
    try {
      const directUrl = await getYtdlpDirectUrl(url);
      if (directUrl) {
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
        await ctx.replyWithVideo(directUrl, { caption: `✅ ${platform}` });
        return;
      }
    } catch { /* fall through */ }

    // ── 3rd: download file to server then upload (slowest fallback) ──
    let filePath: string | undefined;
    try {
      const result = await downloadToFile(url);
      if (!result) {
        await ctx.telegram
          .editMessageText(ctx.chat.id, waitMsg.message_id, undefined,
            "❌ تعذّر التحميل، تأكد أن الحساب عام والرابط صحيح.")
          .catch(() => {});
        return;
      }
      filePath = result.filePath;
      await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
      await ctx.replyWithVideo(
        { source: fs.createReadStream(filePath) },
        { caption: `✅ ${platform}` }
      );
    } catch (err: unknown) {
      console.error("Bot error:", err instanceof Error ? err.message : err);
      await ctx.telegram
        .editMessageText(ctx.chat.id, waitMsg.message_id, undefined,
          "❌ خطأ في التحميل، حاول مجددًا.")
        .catch(() => {});
    } finally {
      if (filePath) deleteFile(filePath);
    }
  });

  return bot;
}
