// Re-export all database utilities
export { default as pool, query, getClient, closePool } from "./db";
export * from "./db-types";
export * as slabContentRepo from "./repositories/slab-content";
export * as questionsRepo from "./repositories/questions-asked";

// Content ingestion utilities
export { loadAllDocuments } from "./content-reader";
export type { MarkdownDocument } from "./content-reader";
export { chunkDocument, chunkAllDocuments } from "./chunker";
export type { ContentChunk } from "./chunker";

// Gemini AI (LLM + embeddings)
export { genai, embedText, embedTexts, generateText } from "./gemini";
export { EMBEDDING_MODEL, CHAT_MODEL } from "./gemini";
export { embedAllChunks } from "./embeddings";
export type { ChunkWithEmbedding } from "./embeddings";
