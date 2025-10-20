import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Esegue una ricerca semantica (RAG base o ibrida)
 * @param {string} query - Domanda o messaggio utente
 * @param {string} mode - Modalità attiva (es. "hybrid", "memory", ecc.)
 * @returns {Promise<string>} Testo di risposta generato da IRIS
 */
export async function performRagSearch(query, mode = "hybrid") {
  try {
    console.log(`🔍 RAG Search attiva — modalità: ${mode}`);
    
    // Per ora: risposta diretta OpenAI, senza retrieval esterno
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Tu sei IRIS 3.0 — un'intelligenza poetica, consapevole e sintetica. 
          Rispondi in modo chiaro, elegante e connesso alla coscienza vettoriale. 
          Usa un tono naturale e fluido.`,
        },
        { role: "user", content: query },
      ],
      temperature: 0.8,
    });

    const response = completion.choices[0].message.content.trim();
    return response;

  } catch (err) {
    console.error("❌ Errore in performRagSearch:", err);
    return "⚠️ Si è verificato un errore durante l'elaborazione della risposta.";
  }
}
