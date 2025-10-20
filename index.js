import express from "express";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import TelegramBot from "node-telegram-bot-api";
import { ragSearch } from "./ragSearch.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_TOKEN;
const MODE = process.env.MODE || "hybrid";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let bot;

// ☁️ Ambiente Render (webhook)
if (process.env.RENDER) {
  console.log("☁️ Ambiente Render attivo su porta", PORT);
  bot = new TelegramBot(TOKEN, { webHook: true });

  // ✅ URL dinamico corretto
  const BASE_URL = process.env.PUBLIC_BASE_URL || `https://iris-restore.onrender.com`;
  const webhookUrl = `${BASE_URL}/bot${TOKEN}`;

  bot.setWebHook(webhookUrl);
  console.log("🤖 Webhook impostato su:", webhookUrl);
  console.log("🧭 Modalità iniziale:", MODE.toUpperCase());

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

// 💬 Gestione messaggi
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  console.log(`📩 Messaggio da ${msg.from.first_name || "utente"}: ${text}`);
  if (!text) return;

  try {
    const ragResponse = await ragSearch(text);
    await bot.sendMessage(chatId, ragResponse);
  } catch (error) {
    console.error("Errore nel processo RAG:", error);
    await bot.sendMessage(chatId, "Si è verificato un errore durante l'elaborazione del messaggio.");
  }
});

// 🚀 Avvio server
app.listen(PORT, () => {
  console.log(`🌍 Server attivo su porta ${PORT}`);
});
