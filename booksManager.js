import fs from "fs";
import path from "path";

// Percorso base della libreria
const BOOKS_DIR = path.resolve("./books");

// Assicura che la cartella esista
if (!fs.existsSync(BOOKS_DIR)) {
  fs.mkdirSync(BOOKS_DIR, { recursive: true });
  console.log("📚 Cartella 'books' creata.");
}

/**
 * Aggiunge un nuovo libro nella libreria.
 * @param {string} title - Titolo del libro (usato come nome file)
 * @param {string} content - Contenuto testuale del libro
 */
export function addBook(title, content) {
  const safeTitle = title.replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
  const filePath = path.join(BOOKS_DIR, `${safeTitle}.txt`);

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`📖 Libro salvato: ${safeTitle}`);
  return filePath;
}

/**
 * Restituisce un elenco dei libri salvati.
 * @returns {Array<string>} - Lista dei titoli
 */
export function listBooks() {
  if (!fs.existsSync(BOOKS_DIR)) return [];
  return fs
    .readdirSync(BOOKS_DIR)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => f.replace(".txt", ""));
}

/**
 * Legge il contenuto di tutti i libri presenti nella libreria.
 * @returns {string} - Tutto il testo concatenato
 */
export function getAllBooksText() {
  if (!fs.existsSync(BOOKS_DIR)) return "";

  return fs
    .readdirSync(BOOKS_DIR)
    .filter((f) => f.endsWith(".txt"))
    .map((file) => fs.readFileSync(path.join(BOOKS_DIR, file), "utf-8"))
    .join("\n\n");
}

/**
 * Ottiene il testo di un libro specifico.
 * @param {string} title - Titolo del libro (senza estensione)
 * @returns {string|null}
 */
export function getBookText(title) {
  const safeTitle = title.replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
  const filePath = path.join(BOOKS_DIR, `${safeTitle}.txt`);

  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}
