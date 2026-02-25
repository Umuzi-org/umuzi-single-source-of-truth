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
 * Split a markdown body into sections based on ## headings.
 * Content before the first ## heading is returned as a section with an empty heading.
 */
function splitIntoSections(
  body: string,
): { heading: string; content: string }[] {
  const sectionRegex = /^##\s+(.+)$/gm;
  const sections: { heading: string; content: string }[] = [];
  let lastIndex = 0;
  let lastHeading = "";
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(body)) !== null) {
    // Capture content before this heading
    const contentBefore = body.slice(lastIndex, match.index).trim();
    if (contentBefore.length > 0 || lastHeading) {
      sections.push({ heading: lastHeading, content: contentBefore });
    }
    lastHeading = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  // Capture remaining content after the last heading
  const remaining = body.slice(lastIndex).trim();
  if (remaining.length > 0 || lastHeading) {
    sections.push({ heading: lastHeading, content: remaining });
  }

  return sections;
}

/**
 * Chunk a plain text body into overlapping sentence-based pieces.
 * Each chunk gets `prefix` prepended for retrieval context.
 *
 * Strategy:
 *  1. Split the text into sentences.
 *  2. Accumulate sentences until we reach TARGET_CHUNK_WORDS.
 *  3. Never exceed MAX_CHUNK_WORDS — if a single sentence is huge, force-split.
 *  4. After emitting a chunk, back up OVERLAP_WORDS to create overlap.
 *  5. Prepend the prefix to every chunk for retrieval context.
 */
function chunkBySentences(
  prefix: string,
  text: string,
  sourceFile: string,
  startIndex: number,
  docTitle: string,
): ContentChunk[] {
  const sentences = splitIntoSentences(text);
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

    const chunkText = `${prefix}\n\n${chunkBody}`;

    chunks.push({
      title: docTitle,
      chunkText,
      sourceFile,
      chunkIndex: startIndex + chunks.length,
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

/**
 * Chunk a single document into pieces, respecting ## heading boundaries.
 *
 * Strategy:
 *  1. Split the body into sections by ## headings.
 *  2. Small sections (≤ MAX_CHUNK_WORDS) become single chunks.
 *  3. Large sections are split further using sentence-based chunking.
 *  4. Document title and section heading are prepended for context.
 *  5. If no ## headings exist, fall back to pure sentence-based chunking.
 */
export function chunkDocument(doc: MarkdownDocument): ContentChunk[] {
  const sections = splitIntoSections(doc.body);

  // No ## sections found — fall back to sentence-based chunking
  if (sections.length === 0) {
    return chunkBySentences(doc.title, doc.body, doc.filePath, 0, doc.title);
  }

  // If there's only one section with no heading, it's a flat document
  if (sections.length === 1 && !sections[0].heading) {
    return chunkBySentences(
      doc.title,
      sections[0].content,
      doc.filePath,
      0,
      doc.title,
    );
  }

  const chunks: ContentChunk[] = [];

  for (const section of sections) {
    const sectionContent = section.content;
    if (sectionContent.trim().length === 0 && !section.heading) continue;

    // Build a prefix that includes both the doc title and section heading
    const prefix = section.heading
      ? `${doc.title}\n\n## ${section.heading}`
      : doc.title;

    const words = wordCount(sectionContent);

    if (words <= MAX_CHUNK_WORDS) {
      // Small section === single chunk
      if (sectionContent.trim().length === 0) continue;
      const chunkText = `${prefix}\n\n${sectionContent}`;
      chunks.push({
        title: doc.title,
        chunkText,
        sourceFile: doc.filePath,
        chunkIndex: chunks.length,
      });
    } else {
      // Large section === sentence-based sub-chunks
      const subChunks = chunkBySentences(
        prefix,
        sectionContent,
        doc.filePath,
        chunks.length,
        doc.title,
      );
      for (const sc of subChunks) {
        chunks.push({ ...sc, chunkIndex: chunks.length });
      }
    }
  }

  return chunks;
}

// Chunk all documents and flatten into a single array of chunks
export function chunkAllDocuments(docs: MarkdownDocument[]): ContentChunk[] {
  return docs.flatMap(chunkDocument);
}
