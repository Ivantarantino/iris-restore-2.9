import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import axios from "axios";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Sintetizza testo in voce secondo il motore specificato.
 * @param {string} text - Testo da vocalizzare
 * @returns {Promise<string>} Percorso del file audio generato
 */
export async function synthesizeVoice(text) {
  const engine = (process.env.TTS_ENGINE || "gtts").toLowerCase();
  const outputPath = path.join(__dirname, "voice.mp3");

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

    // 🐺 BARK (API esterna Suno)
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
