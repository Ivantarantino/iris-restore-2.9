import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import axios from "axios";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🔄 motore TTS attivo
let activeEngine = process.env.TTS_DEFAULT?.toLowerCase() || "gtts";

/**
 * Cambia motore TTS in runtime
 */
export function setTtsEngine(engine) {
  const valid = ["gtts", "openai", "bark"];
  if (!valid.includes(engine.toLowerCase())) {
    throw new Error(`Motore TTS non valido. Usa uno tra: ${valid.join(", ")}`);
  }
  activeEngine = engine.toLowerCase();
  console.log(`🎙️ Motore TTS impostato su: ${activeEngine}`);
  return activeEngine;
}

/**
 * Restituisce il motore attualmente attivo
 */
export function getTtsEngine() {
  return activeEngine;
}

/**
 * Sintetizza testo in voce
 */
export async function synthesizeVoice(text) {
  const outputPath = path.join(__dirname, "voice.mp3");
  const engine = activeEngine;

  switch (engine) {
    // 🎙️ GOOGLE TTS
    case "gtts":
      return new Promise((resolve, reject) => {
        const gtts = `gtts-cli "${text.replace(/"/g, '\\"')}" --lang it --output "${outputPath}"`;
        exec(gtts, (err) => {
          if (err) reject(err);
          else resolve(outputPath);
        });
      });

    // 🧠 OPENAI TTS
    case "openai":
      const mp3 = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: text,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      return outputPath;

    // 🐺 BARK (API Suno)
    case "bark":
      const response = await axios.post(
        "https://api.bark.voice.suno.ai/v1/generate",
        { text, voice: "default", language: "it" },
        { responseType: "arraybuffer" }
      );
      fs.writeFileSync(outputPath, response.data);
      return outputPath;

    default:
      throw new Error(`Motore TTS non riconosciuto: ${engine}`);
  }
}
