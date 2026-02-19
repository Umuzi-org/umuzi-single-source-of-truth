import type { MarkdownDocument } from "./content-reader";

export interface ContentChunk {
  title: string;
  chunkText: string;
  sourceFile: string;
  chunkIndex: number;
}

/**
 * Rough token count estimation.
 * GPT / Gemini tokenisers average ~0.75 tokens per word for English.
 * We use word count as a practical proxy (1 word ≈ 1.33 tokens).
 * To stay within 500-1000 *tokens*, we target ~375-750 words per chunk.
 */
const TARGET_CHUNK_WORDS = 550; // ≈ 730 tokens
const MAX_CHUNK_WORDS = 750; // ≈ 1000 tokens
const OVERLAP_WORDS = 75; // ≈ 100 tokens of overlap

// Split text into sentences using a simple regex.
// Handles common abbreviations and decimal numbers gracefully.
function splitIntoSentences(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw.filter((s) => s.trim().length > 0);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Chunk a single document's body into overlapping pieces.
 *
 * Strategy:
 *  1. Split the body into sentences.
 *  2. Accumulate sentences until we reach TARGET_CHUNK_WORDS.
 *  3. Never exceed MAX_CHUNK_WORDS — if a single sentence is huge, force-split.
 *  4. After emitting a chunk, back up OVERLAP_WORDS to create overlap.
 *  5. Prepend the document title to every chunk for retrieval context.
 */
export function chunkDocument(doc: MarkdownDocument): ContentChunk[] {
  const sentences = splitIntoSentences(doc.body);
  if (sentences.length === 0) return [];

  const chunks: ContentChunk[] = [];
  let i = 0;

  while (i < sentences.length) {
    const chunkSentences: string[] = [];
    let currentWords = 0;

    // Accumulate sentences until we hit the target
    while (i < sentences.length && currentWords < TARGET_CHUNK_WORDS) {
      const sentenceWords = wordCount(sentences[i]);

      // If a single sentence exceeds MAX_CHUNK_WORDS, take it alone
      if (sentenceWords > MAX_CHUNK_WORDS && chunkSentences.length === 0) {
        chunkSentences.push(sentences[i]);
        currentWords += sentenceWords;
        i++;
        break;
      }

      // If adding this sentence would exceed MAX_CHUNK_WORDS, stop
      if (
        currentWords + sentenceWords > MAX_CHUNK_WORDS &&
        chunkSentences.length > 0
      ) {
        break;
      }

      chunkSentences.push(sentences[i]);
      currentWords += sentenceWords;
      i++;
    }

    const chunkBody = chunkSentences.join(" ").trim();
    if (chunkBody.length === 0) continue;

    // Prepend the title so every chunk carries context
    const chunkText = `${doc.title}\n\n${chunkBody}`;

    chunks.push({
      title: doc.title,
      chunkText,
      sourceFile: doc.filePath,
      chunkIndex: chunks.length,
    });

    // Overlap: back up so the next chunk shares some trailing context
    if (i < sentences.length) {
      let overlapWords = 0;
      let backtrack = 0;
      for (let j = chunkSentences.length - 1; j >= 0; j--) {
        overlapWords += wordCount(chunkSentences[j]);
        backtrack++;
        if (overlapWords >= OVERLAP_WORDS) break;
      }
      i = i - backtrack;
      // Safety: if we'd back up to the same start position, force-advance by 1
      if (backtrack >= chunkSentences.length) {
        i += 1;
      }
    }
  }

  return chunks;
}

// Chunk all documents and flatten into a single array of chunks
export function chunkAllDocuments(docs: MarkdownDocument[]): ContentChunk[] {
  return docs.flatMap(chunkDocument);
}
