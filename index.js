import express from "express";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import axios from "axios";
import { performRagSearch } from "./ragSearch.js";
import { synthesizeVoice, setTtsEngine, getTtsEngine } from "./tts.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_TOKEN;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://iris-restore.onrender.com";

// 🔁 Modalità corrente
const VALID_MODES = ["hy", "hybrid", "free", "libri", "books"];
let CURRENT_MODE = (process.env.IRIS_MODE || "hy").toLowerCase();

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let bot;

// ☁️ Render: webhook | 💻 Locale: polling
if (process.env.RENDER) {
  console.log("☁️ Ambiente Render attivo su porta", PORT);
  bot = new TelegramBot(TOKEN, { webHook: true });
  const webhookUrl = `${PUBLIC_BASE_URL}/bot${TOKEN}`;
  bot.setWebHook(webhookUrl);
  console.log("🤖 Webhook impostato su:", webhookUrl);
  console.log("🧭 Modalità iniziale:", CURRENT_MODE.toUpperCase());

  app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
} else {
  console.log("💻 Ambiente locale");
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log("🌍 Server attivo su porta", PORT);
}

// ✅ Route base
app.get("/", (_req, res) => {
  res.send("🌍 IRIS è online e il webhook è attivo 🧠");
});

// 💬 Gestione messaggi Telegram
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  console.log(`📩 Messaggio da ${msg.from.first_name || "utente"}: ${text}`);

  // ---------- COMANDI ----------
  if (text.toLowerCase().startsWith("/help")) {
    const help = [
      "✨ *IRIS – Comandi disponibili*",
      "",
      "• /mode → mostra la modalità attuale",
      "• /mode hy → ibrido (prima libri, poi AI)",
      "• /mode free → solo AI (flusso libero)",
      "• /mode libri (o /mode books) → solo libreria",
      "",
      "• /tts → mostra motore vocale",
      "• /tts gtts | openai | bark → cambia voce",
    ].join("\n");
    await bot.sendMessage(chatId, help, { parse_mode: "Markdown" });
    return;
  }

  if (text.toLowerCase().startsWith("/mode")) {
    const parts = text.split(/\s+/);
    const arg = (parts[1] || "").toLowerCase();

    if (!arg) {
      await bot.sendMessage(
        chatId,
        `🧭 Modalità attuale: *${CURRENT_MODE.toUpperCase()}*\nScegli tra: hy | free | libri (books)`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const normalized =
      arg === "hybrid" ? "hy" :
      arg === "books" ? "libri" :
      arg;

    if (!VALID_MODES.includes(normalized)) {
      await bot.sendMessage(chatId, "❌ Modalità non valida. Usa: hy | free | libri (books)");
      return;
    }

    CURRENT_MODE = normalized;
    await bot.sendMessage(chatId, `✅ Modalità impostata su: *${CURRENT_MODE.toUpperCase()}*`, { parse_mode: "Markdown" });
    console.log("🔁 Modalità aggiornata:", CURRENT_MODE);
    return;
  }

  if (text.toLowerCase().startsWith("/tts")) {
    const [, engine] = text.split(/\s+/);
    if (!engine) {
      await bot.sendMessage(
        chatId,
        `🎧 Motore attuale: ${getTtsEngine()}\nUsa: /tts gtts | openai | bark`
      );
      return;
    }
    try {
      const newEngine = setTtsEngine(engine.toLowerCase());
      await bot.sendMessage(chatId, `✅ Motore vocale impostato su: ${newEngine}`);
    } catch (err) {
      await bot.sendMessage(chatId, `❌ ${err.message}`);
    }
    return;
  }

  // ---------- RISPOSTA ----------
  try {
    const response = await performRagSearch(text, CURRENT_MODE);
    await bot.sendMessage(chatId, response);

    try {
      const audioPath = await synthesizeVoice(response);
      await bot.sendAudio(chatId, audioPath);
      fs.unlinkSync(audioPath);
    } catch (err) {
      console.error("Errore TTS:", err.message);
    }
  } catch (error) {
    console.error("Errore nel processo:", error);
    await bot.sendMessage(chatId, "⚠️ Errore interno durante l'elaborazione.");
  }
});

// ⏱️ Keep Alive – Ping automatico ogni 10 minuti
function startKeepAlive() {
  setInterval(async () => {
    try {
      await axios.get(PUBLIC_BASE_URL);
      console.log("⏱️ Ping inviato a", PUBLIC_BASE_URL);
    } catch (err) {
      console.error("⚠️ Errore ping:", err.message);
    }
  }, 10 * 60 * 1000);
}

// 🚀 Avvio server
app.listen(PORT, () => {
  console.log(`🌍 Server attivo su porta ${PORT}`);
  startKeepAlive(); // <--- ping automatico
});
