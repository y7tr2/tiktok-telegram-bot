# Telegram Video Downloader Bot 🎬

بوت تيليغرام يحمّل مقاطع من جميع منصات التواصل بدون علامة مائية.

## المنصات المدعومة
- TikTok (بدون علامة مائية)
- Instagram (Reels & Posts)
- YouTube (Shorts & Videos)
- Twitter / X
- Facebook
- Snapchat
- Reddit
- Pinterest
- Twitch Clips
- Vimeo
- Dailymotion
- وأكثر...

---

## نشر على Render

### 1. ربط الريبو
- ادخل [render.com](https://render.com) → New → Web Service
- اربطه بريبو `tiktok-telegram-bot`

### 2. إعدادات الـ Service
| الحقل | القيمة |
|---|---|
| **Root Directory** | `bot` |
| **Build Command** | `npm install && npx tsc && pip3 install -U yt-dlp` |
| **Start Command** | `node dist/index.js` |
| **Instance Type** | Free |

### 3. متغيرات البيئة (Environment Variables)
أضف هذين المتغيرين:

| المتغير | القيمة |
|---|---|
| `TELEGRAM_BOT_TOKEN` | توكن البوت من @BotFather |
| `RENDER_URL` | رابط الـ Service بعد ما يتنشر (مثال: `https://tiktok-telegram-bot.onrender.com`) |

> **ملاحظة:** بعد أول نشر، انسخ الرابط من Render وأضفه كـ `RENDER_URL` حتى يبقى البوت شغّال ولا ينام.

---

## تشغيل محلي (اختياري)
```bash
cd bot
npm install
pip3 install yt-dlp
TELEGRAM_BOT_TOKEN=your_token npm run dev
```
