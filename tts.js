import fs from "fs";
import fetch from "node-fetch";
import googleTTS from "google-tts-api";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Metodo selezionabile: "google", "openai", "bark"
const TTS_MODE = process.env.TTS_MODE || "google";

export async function generateTTS(text, outputPath = "./voice.ogg") {
  try {
    if (!text || text.trim() === "") throw new Error("Testo TTS vuoto.");

    console.log(`🎙️ Generazione voce con modalità: ${TTS_MODE}`);

    // GOOGLE TTS (gratuito e rapido)
    if (TTS_MODE === "google") {
      const url = googleTTS.getAudioUrl(text, {
        lang: "it",
        slow: false,
        host: "https://translate.google.com",
      });

      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(buffer));
      return outputPath;
    }

    // OPENAI TTS (voce premium, richiede API key)
    if (TTS_MODE === "openai") {
      const mp3 = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: text,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      return outputPath;
    }

    // BARK TTS (simulazione per ora)
    if (TTS_MODE === "bark") {
      const mockPath = "./bark_voice.ogg";
      fs.writeFileSync(mockPath, Buffer.from([]));
      console.log("🐺 Bark TTS placeholder generato.");
      return mockPath;
    }

    throw new Error(`Modalità TTS sconosciuta: ${TTS_MODE}`);
  } catch (err) {
    console.error("Errore TTS:", err);
    return null;
  }
}
