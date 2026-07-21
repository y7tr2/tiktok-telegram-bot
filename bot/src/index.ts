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

// ── Express health-check server ──────────────────────────────
const app = express();
app.get("/", (_req, res) => res.send("Bot is alive 🤖"));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.listen(PORT, () => console.log(`HTTP server on port ${PORT}`));

// ── Telegram bot ─────────────────────────────────────────────
const bot = createBot(TOKEN);
bot.launch().then(() => console.log("Bot launched ✅"));

// ── Self-ping every 3 minutes (keeps Render free tier alive) ─
if (RENDER_URL) {
  const pingUrl = `${RENDER_URL}/health`;
  setInterval(() => {
    const mod = pingUrl.startsWith("https") ? https : http;
    mod
      .get(pingUrl, (res) => {
        console.log(`Self-ping → ${res.statusCode}`);
      })
      .on("error", (e) => console.error("Ping error:", e.message));
  }, 3 * 60 * 1000);
  console.log(`Self-ping enabled → ${pingUrl}`);
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
