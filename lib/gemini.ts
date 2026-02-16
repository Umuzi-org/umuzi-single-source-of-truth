import { GoogleGenAI } from "@google/genai";

// Gemini API client setup
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY environment variable is not set. " +
      "Add it to .env.local or your deployment secrets.",
  );
}

export const genai = new GoogleGenAI({ apiKey });

// Centralized model names for easy maintenance and consistency across the codebase.
// Embedding model used for vectorizing text chunks.
export const EMBEDDING_MODEL = "text-embedding-004";

// Chat model used for any LLM interactions
export const CHAT_MODEL = "gemini-2.0-flash";

// Generate a 768-dim embedding vector for a single text input.
export async function embedText(text: string): Promise<number[]> {
  const response = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding) {
    throw new Error("Gemini returned no embedding for the provided text.");
  }
  return embedding;
}

// Generate embedding vectors for an array of texts in batches.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
  });

  const embeddings = response.embeddings;
  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error(
      `Expected ${texts.length} embeddings but received ${embeddings?.length ?? 0}.`,
    );
  }

  return embeddings.map((e) => {
    if (!e.values) throw new Error("Embedding values missing in response.");
    return e.values;
  });
}

// Generate text using the Gemini chat model.
export async function generateText(prompt: string): Promise<string> {
  const response = await genai.models.generateContent({
    model: CHAT_MODEL,
    contents: prompt,
  });

  return response.text ?? "";
}
