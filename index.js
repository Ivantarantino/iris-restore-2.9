import express from "express";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import { ragSearch } from "./ragSearch.js";
import { updateMemory, getContextFromMemory } from "./memoryManager.js";
import { computeEssence, summarizeEssence } from "./essence.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_TOKEN;
const DEFAULT_MODE = (process.env.MODE || "hy").toLowerCase(); // hy | free | book

if (!TOKEN) {
  console.error("❌ TELEGRAM_TOKEN mancante nelle variabili d'ambiente.");
  process.exit(1);
}

let bot;

// Ambiente Render: webhook
if (process.env.RENDER) {
  console.log("☁️ Ambiente Render attivo su porta", PORT);
  bot = new TelegramBot(TOKEN, { webHook: true });
  const webhookUrl = `https://telegram-tts.onrender.com/bot${TOKEN}`;
  await bot.setWebHook(webhookUrl);
  console.log("🤖 Webhook impostato su:", webhookUrl);
  app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
} else {
  // Locale: polling
  console.log("💻 Ambiente locale (polling)");
  bot = new TelegramBot(TOKEN, { polling: true });
}

// Stato modalità per chat (in RAM, reset a ogni avvio)
const chatMode = new Map(); // chatId -> "hy" | "free" | "book"

function getMode(chatId) {
  return (chatMode.get(chatId) || DEFAULT_MODE).toLowerCase();
}

function setMode(chatId, m) {
  const normalized = (m || "").toLowerCase();
  if (!["hy", "free", "book"].includes(normalized)) return false;
  chatMode.set(chatId, normalized);
  return true;
}

// Helpers
const helpModeText = (current) => `
🧭 Modalità attuale: *${current.toUpperCase()}*

• /mode hy   → ibrido (contesto documenti SOLO se rilevante)
• /mode free → libero (solo AI)
• /mode book → documentale puro (solo RAG)

Alias rapidi:
• /hy, /free, /book
`.trim();

// Gestione messaggi
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  if (!text) return;

  // Comandi /mode & alias
  if (text === "/mode") {
    const m = getMode(chatId);
    await bot.sendMessage(chatId, helpModeText(m), { parse_mode: "Markdown" });
    return;
  }
  if (text.startsWith("/mode ")) {
    const sel = text.split(/\s+/)[1];
    if (setMode(chatId, sel)) {
      await bot.sendMessage(chatId, `🪄 Modalità cambiata in: *${sel.toUpperCase()}*`, { parse_mode: "Markdown" });
    } else {
      await bot.sendMessage(chatId, "Modalità non valida. Usa: /mode hy | /mode free | /mode book");
    }
    return;
  }
  if (["/hy", "/free", "/book"].includes(text)) {
    const sel = text.replace("/", "");
    setMode(chatId, sel);
    await bot.sendMessage(chatId, `🪄 Modalità cambiata in: *${sel.toUpperCase()}*`, { parse_mode: "Markdown" });
    return;
  }

  // Comando /essence
  if (text === "/essence") {
    try {
      const ess = await computeEssence();
      const summary = await summarizeEssence(ess);
      await bot.sendMessage(chatId, summary, { parse_mode: "Markdown" });
    } catch (e) {
      console.error("❌ /essence error:", e);
      await bot.sendMessage(chatId, "Non sono riuscita a percepire l'Essenza in questo momento.");
    }
    return;
  }

  const mode = getMode(chatId);
  console.log(`📩 [${mode.toUpperCase()}] ${msg.from?.first_name || "utente"}: ${text}`);

  try {
    // Registra memoria dinamica (chat history)
    await updateMemory(text);

    // Se HY, proviamo a estrarre un minimo di contesto dalla memoria chat
    let memoryContext = "";
    if (mode === "hy") {
      memoryContext = await getContextFromMemory(text, 3);
    }

    // RAG + risposta coerente
    const reply = await ragSearch(text, { mode, memoryContext });

    await bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error("❌ Errore generale:", err);
    await bot.sendMessage(chatId, "Si è verificato un problema temporaneo. Ci sono, riprova tra poco 🌸");
  }
});

// Avvio server
app.get("/", (_req, res) => res.send("IRIS 3.0 – Restore is running."));
app.listen(PORT, () => {
  console.log(`🌍 Server attivo su porta ${PORT}`);
  console.log(`🧭 Modalità iniziale: ${DEFAULT_MODE.toUpperCase()}`);
});
