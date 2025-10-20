import express from "express";
import TelegramBot from "node-telegram-bot-api";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { uploadBookToQdrant } from "./loadDocs.js";
import { exec } from "child_process";
import { setInterval } from "timers";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 1000;
const TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: false });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// === Directories ===
const BOOKS_DIR = path.join(process.cwd(), "books");
if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR);

// === Ping di mantenimento attivo (uptime) ===
setInterval(() => {
  fetch(`https://iris-restore.onrender.com/`)
    .then(() => console.log("🔄 Ping di mantenimento inviato"))
    .catch(() => console.log("⚠️ Ping fallito"));
}, 14 * 60 * 1000); // ogni 14 minuti

// === Modalità iniziale ===
let mode = "hy"; // free | hy | books
let ttsEngine = "gtts"; // gtts | openai | bark

console.log(`☁️ Ambiente Render attivo su porta ${PORT}`);
console.log(`🧭 Modalità iniziale: ${mode.toUpperCase()}`);

// === TTS helper ===
function speak(text, chatId) {
  if (ttsEngine === "gtts") {
    const outFile = path.join(process.cwd(), "voice.ogg");
    const command = `gtts-cli "${text}" --lang it --output "${outFile}" && ffmpeg -i "${outFile}" -c:a libopus -b:a 48k "${outFile.replace(".ogg", "_final.ogg")}" -y`;
    exec(command, (err) => {
      if (err) {
        console.error("Errore TTS:", err);
        bot.sendMessage(chatId, text);
        return;
      }
      bot.sendVoice(chatId, outFile.replace(".ogg", "_final.ogg"));
    });
  } else {
    bot.sendMessage(chatId, text);
  }
}

// === Gestione comandi ===
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `✨ Benvenuto, ${msg.chat.first_name}!\nModalità attuale: ${mode.toUpperCase()}`);
});

bot.onText(/\/help/, (msg) => {
  const helpMsg = `
📚 *Comandi disponibili*:
/mode — mostra o cambia modalità (free, hy, books)
/books add <titolo> — aggiungi un nuovo libro
/books list — elenca i libri nella libreria
/tts — mostra o cambia motore vocale (gtts, openai, bark)
  `;
  bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: "Markdown" });
});

bot.onText(/\/mode/, (msg) => {
  bot.sendMessage(msg.chat.id, `🔁 Modalità attuale: ${mode.toUpperCase()}\nScrivi /mode free, /mode hy o /mode books per cambiarla.`);
});

bot.onText(/\/mode (.+)/, (msg, match) => {
  const newMode = match[1].toLowerCase();
  if (["free", "hy", "books"].includes(newMode)) {
    mode = newMode;
    bot.sendMessage(msg.chat.id, `✅ Modalità cambiata a: ${mode.toUpperCase()}`);
  } else {
    bot.sendMessage(msg.chat.id, "⚠️ Modalità non valida. Usa free | hy | books.");
  }
});

// === Gestione TTS ===
bot.onText(/\/tts/, (msg) => {
  bot.sendMessage(msg.chat.id, `🎤 Motore TTS attuale: ${ttsEngine}\nUsa /tts gtts, /tts openai o /tts bark per cambiarlo.`);
});

bot.onText(/\/tts (.+)/, (msg, match) => {
  const newTTS = match[1].toLowerCase();
  if (["gtts", "openai", "bark"].includes(newTTS)) {
    ttsEngine = newTTS;
    bot.sendMessage(msg.chat.id, `✅ Motore TTS impostato su: ${ttsEngine}`);
  } else {
    bot.sendMessage(msg.chat.id, "⚠️ Motore non valido. Usa gtts | openai | bark.");
  }
});

// === Gestione Books ===
bot.onText(/\/books add (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const title = match[1].trim();
  const bookPath = path.join(BOOKS_DIR, `${title}.txt`);

  fs.writeFileSync(bookPath, `Titolo: ${title}\n(aggiungi contenuti qui)`);
  bot.sendMessage(chatId, `📘 Libro "${title}" salvato localmente. Indicizzazione in corso...`);

  const success = await uploadBookToQdrant(title);
  if (success) speak(`Libro ${title} aggiunto e indicizzato con successo.`, chatId);
  else speak(`Errore durante l'indicizzazione di ${title}.`, chatId);
});

bot.onText(/\/books list/, (msg) => {
  const books = fs.readdirSync(BOOKS_DIR).filter((f) => f.endsWith(".txt"));
  if (books.length === 0) bot.sendMessage(msg.chat.id, "Nessun libro trovato.");
  else bot.sendMessage(msg.chat.id, `📚 Libreria:\n${books.map((b) => "- " + b.replace(".txt", "")).join("\n")}`);
});

// === Messaggi generali ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  console.log(`📩 Messaggio da ${msg.chat.first_name}: ${text}`);
  speak(`Ciao ${msg.chat.first_name}, ho ricevuto: ${text}`, chatId);
});

// === Webhook server ===
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("IRIS è viva 🌸"));

app.listen(PORT, () => {
  console.log(`🌍 Server attivo su porta ${PORT}`);
  bot.setWebHook(`https://iris-restore.onrender.com/bot${TOKEN}`);
});
