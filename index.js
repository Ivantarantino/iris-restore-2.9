import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { config } from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import fs from "fs";
import { loadDocs } from "./loadDocs.js";
import { memoryManager } from "./memoryManager.js";
import { getEssence } from "./essence.js";
import { performRagSearch } from "./ragSearch.js";

config();

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;
const PORT = process.env.PORT || 10000;
const MODE = process.env.IRIS_MODE || "HYBRID";

// 🧠 OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔹 Telegram Bot (in modalità webhook)
const bot = new TelegramBot(TOKEN, { polling: false });

// 🌍 URL dinamico da Render
const BASE_URL = process.env.PUBLIC_BASE_URL || `https://iris-restore.onrender.com`;
const webhookUrl = `${BASE_URL}/bot${TOKEN}`;

(async () => {
  await bot.setWebHook(webhookUrl);
  console.log("🤖 Webhook impostato su:", webhookUrl);
})();

console.log("☁️ Ambiente Render attivo su porta", PORT);
console.log("🧭 Modalità iniziale:", MODE);

// 🎯 Endpoint Telegram
app.post(`/bot${TOKEN}`, async (req, res) => {
  try {
    const message = req.body.message;
    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    console.log(`📩 Messaggio da ${chatId}: ${text}`);

    // Comandi di modalità
    if (text.startsWith("/mode")) {
      const newMode = text.split(" ")[1]?.toUpperCase() || "HYBRID";
      process.env.IRIS_MODE = newMode;
      await bot.sendMessage(chatId, `🧭 Modalità cambiata in: ${newMode}`);
      console.log("🔁 Modalità aggiornata:", newMode);
      return res.sendStatus(200);
    }

    // Risposta generata
    const mode = process.env.IRIS_MODE || "HYBRID";
    const response = await performRagSearch(text, mode);

    await bot.sendMessage(chatId, response);
    console.log("✨ Risposta inviata con successo.");
    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Errore nella gestione del messaggio:", error);
    res.sendStatus(500);
  }
});

// 🔎 Test server
app.get("/", (req, res) => {
  res.send("IRIS 2.9 restore: OK");
});

// 🚀 Avvio server
app.listen(PORT, () => {
  console.log("🌍 Server attivo su porta", PORT);
});
