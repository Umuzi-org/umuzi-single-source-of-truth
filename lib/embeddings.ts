import { embedTexts } from "./gemini";
import type { ContentChunk } from "./chunker";

// Maximum texts per Gemini embedContent call.
// The API allows up to 100 texts per request; we use a conservative default.
const BATCH_SIZE = 50;

// Delay between batches to avoid hitting rate limits (in milliseconds).
const BATCH_DELAY_MS = 100;

// Type for a content chunk with its embedding vector attached.
export interface ChunkWithEmbedding {
  title: string;
  chunkText: string;
  sourceFile: string;
  chunkIndex: number;
  embedding: number[];
}

/**
 * Compute vector embeddings for every chunk using Gemini.
 *
 * Chunks are sent in batches of `BATCH_SIZE`. Each batch is a single API call.
 * Returns the chunks augmented with their embedding vectors (768-dim).
 *
 * @param chunks – output from `chunkAllDocuments()`
 * @param onBatch – optional progress callback(batchIndex, totalBatches)
 */
export async function embedAllChunks(
  chunks: ContentChunk[],
  onBatch?: (batchIndex: number, totalBatches: number) => void,
): Promise<ChunkWithEmbedding[]> {
  const results: ChunkWithEmbedding[] = [];
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);

    onBatch?.(batchIndex, totalBatches);

    const texts = batch.map((c) => c.chunkText);
    const embeddings = await embedTexts(texts);

    for (let j = 0; j < batch.length; j++) {
      results.push({
        title: batch[j].title,
        chunkText: batch[j].chunkText,
        sourceFile: batch[j].sourceFile,
        chunkIndex: batch[j].chunkIndex,
        embedding: embeddings[j],
      });
    }

    // Pause between batches (skip after the last one)
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}
