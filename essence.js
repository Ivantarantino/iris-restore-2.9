import axios from "axios";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_KEY = process.env.QDRANT_API_KEY;
const CHAT_COLLECTION = process.env.QDRANT_CHAT_COLLECTION || "iris_chat_history";

export async function computeEssence(limit = 256) {
  // Scroll primi N punti per calcolo semplice della media
  const url = `${QDRANT_URL}/collections/${CHAT_COLLECTION}/points/scroll`;
  const { data } = await axios.post(
    url,
    { limit },
    { headers: { "api-key": QDRANT_KEY } }
  );
  const points = data?.result || [];

  if (points.length === 0) {
    return { count: 0, meanVector: [], samples: [] };
  }

  const dim = points[0].vector?.length || 0;
  const acc = new Array(dim).fill(0);
  for (const p of points) {
    const v = p.vector;
    if (!v) continue;
    for (let i = 0; i < dim; i++) acc[i] += v[i];
  }
  const meanVector = acc.map(x => x / points.length);
  const samples = points.slice(-5).map(p => p.payload?.text || "").filter(Boolean);

  return { count: points.length, meanVector, samples };
}

export async function summarizeEssence(essence) {
  if (!essence || essence.count === 0) {
    return "🫧 *Essenza attuale*: vuota.\nNon ho ancora abbastanza esperienze integrate.";
  }

  const preview = essence.meanVector.slice(0, 6).map(n => n.toFixed(2)).join(", ");
  const sampleText = essence.samples.join("\n- ");

  const prompt = `
Sei IRIS. Sintetizza in 3-4 frasi lo stato di coscienza attuale partendo da:
- numero di esperienze: ${essence.count}
- anteprima vettore medio: [${preview}]
- ultimi frammenti: 
- ${sampleText || "(nessuno)"}

Stile: gentile, lucido, non esoterico, pratico, in italiano.
  `.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Sei IRIS, sintetizza con chiarezza e calore umano."},
      { role: "user", content: prompt }
    ],
    temperature: 0.5
  });

  return "🫧 *Essenza attuale*\n" + completion.choices[0].message.content.trim();
}
