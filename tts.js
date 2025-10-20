import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import axios from "axios";
import OpenAI from "openai";
import gTTS from "gtts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let activeEngine = process.env.TTS_DEFAULT?.toLowerCase() || "gtts";

export function setTtsEngine(engine) {
  const valid = ["gtts", "openai", "bark"];
  if (!valid.includes(engine.toLowerCase())) {
    throw new Error(`Motore TTS non valido. Usa uno tra: ${valid.join(", ")}`);
  }
  activeEngine = engine.toLowerCase();
  console.log(`🎙️ Motore TTS impostato su: ${activeEngine}`);
  return activeEngine;
}

export function getTtsEngine() {
  return activeEngine;
}

export async function synthesizeVoice(text) {
  const outputPath = path.join(__dirname, "voice.mp3");
  const engine = activeEngine;

  switch (engine) {
    case "gtts":
      return new Promise((resolve, reject) => {
        try {
          const speech = new gTTS(text, "it");
          speech.save(outputPath, (err) => {
            if (err) reject(err);
            else resolve(outputPath);
          });
        } catch (err) {
          reject(err);
        }
      });

    case "openai":
      const mp3 = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: text,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      return outputPath;

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
