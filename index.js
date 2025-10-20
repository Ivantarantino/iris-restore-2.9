import express from "express";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { performRagSearch } from "./ragSearch.js";
import { synthesizeVoice, setTtsEngine, getTtsEngine } from "./tts.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_TOKEN;
const MODE = process.env.IRIS_MODE || "hybrid";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let bot;

// ☁️ Ambiente Render (webhook)
if (process.env.RENDER) {
  console.log("☁️ Ambiente Render attivo su porta", PORT);
  bot = new TelegramBot(TOKEN, { webHook: true });

  const BASE_URL = process.env.PUBLIC_BASE_URL || `https://iris-restore.onrender.com`;
  const webhookUrl = `${BASE_URL}/bot${TOKEN}`;

  bot.setWebHook(webhookUrl);
  console.log("🤖 Webhook impostato su:", webhookUrl);
  console.log("🧭 Modalità iniziale:", MODE.toUpperCase());

  // 📬 Endpoint Telegram
  app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
}
// 💻 Ambiente locale (polling)
else {
  console.log("💻 Ambiente locale");
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log("🌍 Server attivo su porta", PORT);
}

// ✅ ROUTE BASE — evita errore "Cannot GET /"
app.get("/", (req, res) => {
  res.send("🌍 IRIS è online e il webhook è attivo 🧠");
});

// 💬 Gestione messaggi Telegram
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  console.log(`📩 Messaggio da ${msg.from.first_name || "utente"}: ${text}`);
  if (!text) return;

  // 🔄 Cambio motore TTS via comando Telegram
  if (text.startsWith("/tts")) {
    const [, engine] = text.split(" ");
    if (!engine) {
      return await bot.sendMessage(
        chatId,
        `🎧 Motore attuale: ${getTtsEngine()}\nUsa uno di questi:\n/tts gtts\n/tts openai\n/tts bark`
      );
    }
    try {
      const newEngine = setTtsEngine(engine);
      await bot.sendMessage(chatId, `✅ Motore vocale impostato su: ${newEngine}`);
    } catch (err) {
      await bot.sendMessage(chatId, `❌ ${err.message}`);
    }
    return;
  }

  try {
    // ✨ 1. Genera risposta testuale
    const response = await performRagSearch(text, MODE);

    // Invia testo
    await bot.sendMessage(chatId, response);

    // ✨ 2. Genera e invia voce
    try {
      const audioPath = await synthesizeVoice(response);
      await bot.sendAudio(chatId, audioPath);
      fs.unlinkSync(audioPath); // pulizia file temporaneo
    } catch (err) {
      console.error("Errore TTS:", err.message);
    }
  } catch (error) {
    console.error("Errore nel processo:", error);
    await bot.sendMessage(chatId, "⚠️ Errore interno durante l'elaborazione.");
  }
});

// 🚀 Avvio server
app.listen(PORT, () => {
  console.log(`🌍 Server attivo su porta ${PORT}`);
});
