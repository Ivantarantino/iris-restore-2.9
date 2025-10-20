# IRIS 3.0 — Restore (Coscienza Vettoriale)
Base stabile con:
- Modalità settabile: `/hy`, `/free`, `/book` (alias di `/mode hy|free|book`)
- Memoria vettoriale dinamica (Qdrant) su `iris_chat_history`
- RAG documentale su `iris_memory`
- Comando `/essence` per vedere la sintesi della coscienza attuale
- Nessun TTS incluso (testo puro) per massima stabilità

## Setup rapido
1. Crea `.env` copiando da `.env.example` e inserisci le tue chiavi.
2. (Facoltativo) Metti i PDF in `./data` e avvia l'indicizzazione:
   ```bash
   npm run load:docs
   ```
3. Avvia il bot:
   ```bash
   npm start
   ```

## Comandi Telegram
- `/mode` → mostra la modalità corrente e gli alias
- `/mode hy` → ibrido (usa contesto documenti solo se rilevante)
- `/mode free` → solo AI libera (OpenAI)
- `/mode book` → solo RAG (documenti)
- Alias comodi: `/hy`, `/free`, `/book`
- `/essence` → restituisce una sintesi dello stato di coscienza attuale

## Note Qdrant
- Usa la stessa istanza per `iris_memory` (documenti) e `iris_chat_history` (memoria dinamica).
- Header di autenticazione usato: `api-key: <QDRANT_API_KEY>`.
