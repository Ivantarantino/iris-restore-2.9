// ==============================
// 🌐 IRIS 3.0 — index.js (con gestione 409)
// ==============================

import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import googleTTS from "google-tts-api";

dotenv.config();
const app = express();

const PORT = process.env.PORT || 1000;
const TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ------------------------------
// 🔁 Keep Alive Ping (ogni 11 min)
// ------------------------------
const SELF_URL = "https://iris-restore.onrender.com";
setInterval(() => {
  fetch(SELF_URL)
    .then(() => console.log("🔁 Ping automatico per mantenere attivo Render"))
    .catch(err => console.error("Errore ping:", err));
}, 11 * 60 * 1000);

// ------------------------------
// 🤖 Avvio Bot con gestione errori 409
// ------------------------------
let bot;
function startBot() {
  bot = new TelegramBot(TOKEN, { polling: true });

  bot.on("polling_error", err => {
    if (err.code === "ETELEGRAM" && err.response?.statusCode === 409) {
      console.warn("⚠️ 409 Conflict rilevato — altra istanza attiva. Riprovo tra 30 secondi...");
      bot.stopPolling();
      setTimeout(startBot, 30000);
    } else {
      console.error("Errore polling:", err);
    }
  });

  setupBotListeners();
  console.log("🤖 Bot Telegram avviato con polling attivo");
}

startBot();

// ------------------------------
// 💬 Stato modalità risposta
// ------------------------------
let replyMode = "both"; // Default: testo + voce
const validModes = ["voice", "text", "both"];

// ------------------------------
// 🧠 Generatore risposta GPT
// ------------------------------
async function askGPT(prompt) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8
      })
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "Nessuna risposta ricevuta.";
  } catch (error) {
    console.error("Errore GPT:", error);
    return "Errore durante la generazione della risposta.";
  }
}

// ------------------------------
// 🔊 TTS con google-tts-api
// ------------------------------
async function textToSpeechGoogle(text, chatId) {
  console.log("🎙️ [IRIS 3.0] TTS attivo — modalità: google");

  try {
    const url = googleTTS.getAudioUrl(text, {
      lang: "it",
      slow: false,
      host: "https://translate.google.com"
    });

    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const voicePath = "/opt/render/project/src/voice.ogg";
    fs.writeFileSync(voicePath, Buffer.from(buffer));

    await bot.sendVoice(chatId, voicePath);
    console.log("✅ Audio inviato correttamente");
  } catch (error) {
    console.error("Errore TTS (google-tts-api):", error);
    await bot.sendMessage(chatId, "Errore nel generare la voce.");
  }
}

// ------------------------------
// 📩 Gestione messaggi Telegram
// ------------------------------
function setupBotListeners() {
  bot.on("message", async msg => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    if (!text) return;

    // 🧭 Gestione comando /replymode
    if (text.startsWith("/replymode")) {
      const parts = text.split(" ");
      const mode = parts[1]?.toLowerCase();

      if (validModes.includes(mode)) {
        replyMode = mode;
        await bot.sendMessage(chatId, `✅ Modalità risposta impostata su: ${mode}`);
      } else {
        await bot.sendMessage(
          chatId,
          `ℹ️ Modalità attuale: ${replyMode}\nUsa uno di questi comandi:\n/replymode voice\n/replymode text\n/replymode both`
        );
      }
      return;
    }

    console.log(`📩 Messaggio da ${msg.from.first_name}: ${text}`);

    // 🧠 Risposta GPT
    const gptReply = await askGPT(text);

    // 💬 Invio testo e/o voce
    if (replyMode === "text") {
      await bot.sendMessage(chatId, `💬 IRIS → ${msg.from.first_name}: ${gptReply}`);
    } else if (replyMode === "voice") {
      await textToSpeechGoogle(gptReply, chatId);
    } else {
      await bot.sendMessage(chatId, `💬 IRIS → ${msg.from.first_name}: ${gptReply}`);
      await textToSpeechGoogle(gptReply, chatId);
    }
  });
}

// ------------------------------
// 🚀 Server Express
// ------------------------------
app.get("/", (req, res) => res.send("IRIS 3.0 attiva 🚀"));
app.listen(PORT, () => {
  console.log(`☁️ Ambiente Render attivo su porta ${PORT}`);
  console.log("🧭 Modalità iniziale: HY");
  console.log("🌍 Server attivo su porta", PORT);
  console.log("✅ Server online su porta", PORT);
});
