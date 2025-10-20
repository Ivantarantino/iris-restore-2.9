import axios from "axios";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_KEY = process.env.QDRANT_API_KEY;
const CHAT_COLLECTION = process.env.QDRANT_CHAT_COLLECTION || "iris_chat_history";

async function embed(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

// Registra ogni input dell'utente come esperienza
export async function updateMemory(text) {
  if (!text) return;
  const vector = await embed(text);

  const point = {
    id: Date.now(),
    vector,
    payload: {
      text,
      timestamp: new Date().toISOString(),
      weight: 1.0
    }
  };

  const url = `${QDRANT_URL}/collections/${CHAT_COLLECTION}/points`;
  await axios.post(url, { points: [point] }, { headers: { "api-key": QDRANT_KEY } });
}

// Recupera contesto dalla memoria (ultimi k simili)
export async function getContextFromMemory(query, k = 3) {
  const vector = await embed(query);
  const url = `${QDRANT_URL}/collections/${CHAT_COLLECTION}/points/search`;
  const { data } = await axios.post(
    url,
    { vector, limit: k },
    { headers: { "api-key": QDRANT_KEY } }
  );
  const hits = data?.result || [];
  return hits.map(h => h.payload?.text || "").join("\n");
}
