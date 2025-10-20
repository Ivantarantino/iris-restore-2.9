import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const BOOKS_DIR = path.join(process.cwd(), "books");
const COLLECTION_NAME = "iris_books";

// 🔹 Assicura che la collection esista su Qdrant
async function ensureCollection() {
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

    if (!exists) {
      console.log(`📚 Creazione nuova collection Qdrant: ${COLLECTION_NAME}`);
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1536, // dimensione tipica embedding OpenAI
          distance: "Cosine",
        },
      });
    }
  } catch (err) {
    console.error("❌ Errore durante il controllo/creazione della collection:", err);
  }
}

// 🔹 Pulisce il testo da caratteri inutili
function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/(\n|\r)+/g, "\n")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

// 🔹 Divide il testo in chunk (circa 1000 caratteri)
function chunkText(text, chunkSize = 1000, overlap = 100) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk.trim());
    start += chunkSize - overlap;
  }

  return chunks.filter((c) => c.length > 0);
}

// 🔹 Genera embedding e carica su Qdrant
async function uploadBookToQdrant(title) {
  try {
    await ensureCollection();

    const bookPath = path.join(BOOKS_DIR, `${title}.txt`);
    if (!fs.existsSync(bookPath)) {
      throw new Error(`Libro "${title}" non trovato.`);
    }

    const text = cleanText(fs.readFileSync(bookPath, "utf8"));
    const chunks = chunkText(text);

    console.log(`📖 Caricamento del libro "${title}" — ${chunks.length} paragrafi trovati`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });

      await qdrant.upsert(COLLECTION_NAME, {
        points: [
          {
            id: `${title}_${i}`,
            vector: embedding.data[0].embedding,
            payload: {
              title,
              chunk,
              index: i,
            },
          },
        ],
      });

      console.log(`✅ Chunk ${i + 1}/${chunks.length} inviato`);
    }

    console.log(`✨ Libro "${title}" indicizzato con successo su Qdrant`);
    return true;
  } catch (err) {
    console.error("❌ Errore durante il caricamento su Qdrant:", err);
    return false;
  }
}

export { uploadBookToQdrant };
