import express from "express";
import * as https from "https";
import * as http from "http";
import { createBot } from "./bot";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const RENDER_URL = (process.env.RENDER_URL ?? "").replace(/\/$/, "");

const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.send("Bot is alive 🤖"));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const bot = createBot(TOKEN);

if (RENDER_URL) {
  // ── Webhook mode: Telegram pushes messages instantly (no polling delay) ──
  const webhookPath = `/webhook/${TOKEN.slice(-20)}`;
  app.use(bot.webhookCallback(webhookPath));

  app.listen(PORT, async () => {
    console.log(`HTTP server on port ${PORT}`);
    await bot.telegram.setWebhook(`${RENDER_URL}${webhookPath}`);
    console.log(`Webhook set → ${RENDER_URL}${webhookPath} ✅`);
  });

  // Self-ping every 3 min to keep Render free tier alive
  const pingUrl = `${RENDER_URL}/health`;
  setInterval(() => {
    const mod = pingUrl.startsWith("https") ? https : http;
    mod.get(pingUrl, (r) => console.log(`Ping → ${r.statusCode}`))
       .on("error", (e) => console.error("Ping err:", e.message));
  }, 3 * 60 * 1000);
  console.log(`Self-ping → ${pingUrl}`);
} else {
  // ── Polling mode for local development ──
  app.listen(PORT, () => console.log(`HTTP server on port ${PORT}`));
  bot.launch().then(() => console.log("Bot launched (polling) ✅"));

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
