import fs from "fs";
import pdf from "pdf-parse";
import axios from "axios";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_KEY = process.env.QDRANT_API_KEY;
const DOC_COLLECTION = process.env.QDRANT_COLLECTION || "iris_memory";

async function embed(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

function splitText(text, chunkSize = 900, overlap = 120) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function main() {
  const filePath = "./data/Codice_Krist.pdf";
  if (!fs.existsSync(filePath)) {
    console.error("❌ PDF non trovato:", filePath);
    process.exit(1);
  }
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const text = (pdfData.text || "").replace(/\s+\n/g, "\n").trim();
  const chunks = splitText(text);

  console.log(`📚 Frammenti da indicizzare: ${chunks.length}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vector = await embed(chunk);
    const point = { id: i, vector, payload: { text: chunk, source: "Codice_Krist.pdf", idx: i } };
    const url = `${QDRANT_URL}/collections/${DOC_COLLECTION}/points`;
    await axios.post(url, { points: [point] }, { headers: { "api-key": QDRANT_KEY } });
    if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
      console.log(`✅ Caricati ${i + 1}/${chunks.length}`);
    }
  }

  console.log("🎉 Indicizzazione completata!");
}

main().catch((e) => {
  console.error("❌ Errore indicizzazione:", e?.response?.data || e.message);
  process.exit(1);
});
