// ==============================
// 🌐 IRIS 3.0 — index.js
// ==============================

import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import fs from "fs";
import dotenv from "dotenv";
import { exec } from "child_process";
import path from "path";

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
// 🤖 Avvio Bot
// ------------------------------
const bot = new TelegramBot(TOKEN, { polling: true });
console.log("☁️ Ambiente Render attivo su porta", PORT);
console.log("🧭 Modalità iniziale: HY");
console.log("🌍 Server attivo su porta", PORT);

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
// 🔊 Generatore vocale (Google TTS)
// ------------------------------
async function textToSpeechGoogle(text, chatId) {
  console.log("🎙️ [IRIS 3.0] TTS attivo — modalità: google");

  const voicePath = "/opt/render/project/src/voice.ogg";
  const finalPath = "/opt/render/project/src/voice_final.ogg";
  const command = `gtts-cli "${text}" --lang it --output "${voicePath}" && ffmpeg -i "${voicePath}" -c:a libopus -b:a 48k "${finalPath}" -y`;

  return new Promise(resolve => {
    exec(command, async (error) => {
      if (error) {
        console.error("Errore TTS:", error);
        await bot.sendMessage(chatId, "Errore nel generare la voce.");
        return resolve(null);
      }
      await bot.sendVoice(chatId, finalPath);
      resolve(true);
    });
  });
}

// ------------------------------
// 📩 Gestione messaggi Telegram
// ------------------------------
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
      await bot.sendMessage(chatId, `ℹ️ Modalità attuale: ${replyMode}\nUsa uno di questi comandi:\n/replymode voice\n/replymode text\n/replymode both`);
    }
    return;
  }

  console.log(`📩 Messaggio da ${msg.from.first_name}: ${text}`);

  // 🧠 Chiamata GPT
  const gptReply = await askGPT(text);

  // 💬 Invio testo e/o voce in base alla modalità
  if (replyMode === "text") {
    await bot.sendMessage(chatId, `💬 IRIS → ${msg.from.first_name}: ${gptReply}`);
  } else if (replyMode === "voice") {
    await textToSpeechGoogle(gptReply, chatId);
  } else {
    await bot.sendMessage(chatId, `💬 IRIS → ${msg.from.first_name}: ${gptReply}`);
    await textToSpeechGoogle(gptReply, chatId);
  }
});

// ------------------------------
// 🚀 Server Express
// ------------------------------
app.get("/", (req, res) => res.send("IRIS 3.0 attiva 🚀"));
app.listen(PORT, () => console.log(`✅ Server online su porta ${PORT}`));
