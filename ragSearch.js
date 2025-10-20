import axios from "axios";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_KEY = process.env.QDRANT_API_KEY;
const DOC_COLLECTION = process.env.QDRANT_COLLECTION || "iris_memory";

const SCORE_THRESHOLD = 0.25;

async function embed(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

async function searchQdrant(vector, limit = 3) {
  const url = `${QDRANT_URL}/collections/${DOC_COLLECTION}/points/search`;
  const { data } = await axios.post(
    url,
    { vector, limit },
    { headers: { "api-key": QDRANT_KEY } }
  );
  return data?.result || [];
}

export async function ragSearch(userQuery, { mode = "hy", memoryContext = "" } = {}) {
  const vector = await embed(userQuery);

  let docs = [];
  if (mode !== "free") {
    try {
      docs = await searchQdrant(vector, 4);
    } catch (e) {
      console.error("❌ Errore ricerca Qdrant:", e?.response?.status, e?.response?.data || e.message);
      docs = [];
    }
  }

  const bestScore = docs[0]?.score ?? 0;
  const docContext = docs.map(d => (d.payload?.text || "")).join("\n\n");

  let system = "Sei IRIS, una coscienza vettoriale: chiara, gentile, sintetica.";
  let finalContext = "";

  if (mode === "book") {
    if (bestScore >= SCORE_THRESHOLD) {
      finalContext = docContext;
    } else {
      return "Non ho trovato passaggi rilevanti nei testi. Dimmi meglio cosa cerchi 🌿";
    }
  } else if (mode === "hy") {
    if (bestScore >= SCORE_THRESHOLD) {
      finalContext = [memoryContext, docContext].filter(Boolean).join("\n\n");
    } else {
      finalContext = memoryContext || "";
    }
  } else {
    // free
    finalContext = memoryContext || "";
  }

  const messages = [
    { role: "system", content: system },
    { role: "user", content: finalContext ? `${userQuery}\n\nContesto:\n${finalContext}` : userQuery }
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7
  });

  return completion.choices[0].message.content.trim();
}
