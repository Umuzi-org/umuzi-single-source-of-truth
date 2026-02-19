import { NextResponse } from "next/server";
import { loadAllDocuments } from "../../../lib/content-reader";
import { chunkAllDocuments } from "../../../lib/chunker";
import { embedAllChunks } from "../../../lib/embeddings";
import {
  bulkInsertSlabContent,
  clearAllSlabContent,
  countSlabContent,
} from "../../../lib/repositories/slab-content";
import type { CreateSlabContent } from "../../../lib/db-types";

// Base URL for source file links — points to the canonical GitHub location of each content file.
const GITHUB_CONTENT_BASE =
  "https://github.com/Umuzi-org/umuzi-single-source-of-truth/blob/main/content";

// POST /api/ingest — Reads markdown files, chunks them, embeds them, and stores everything (text + vector) in the database.
// WARNING: Clears existing content first (full re-ingest).

export async function POST(req: Request) {
  if (req.headers.get("x-ingest-secret") !== process.env.INGEST_SECRET_CODE) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid secret code" },
      { status: 401 },
    );
  }

  try {
    // 1. Load markdown documents from content/
    const docs = loadAllDocuments();

    if (docs.length === 0) {
      return NextResponse.json(
        { error: "No markdown documents found in content/" },
        { status: 404 },
      );
    }

    // 2. Split documents into overlapping chunks
    const chunks = chunkAllDocuments(docs);

    // 3. Compute Gemini embeddings for every chunk
    console.log(`Computing embeddings for ${chunks.length} chunks via Gemini…`);
    const embeddedChunks = await embedAllChunks(chunks, (batch, total) => {
      console.log(`  Embedding batch ${batch + 1}/${total}`);
    });

    // 4. Build database records with embeddings attached
    const records: CreateSlabContent[] = embeddedChunks.map((chunk) => ({
      title: chunk.title,
      chunk_text: chunk.chunkText,
      embedding_vector: chunk.embedding,
      slab_url: `${GITHUB_CONTENT_BASE}/${chunk.sourceFile}`,
    }));

    // WARNING: Clears existing content first (full re-ingest).
    const deleted = await clearAllSlabContent();

    const BATCH_SIZE = 50;
    let inserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const count = await bulkInsertSlabContent(batch);
      inserted += count;
    }

    const total = await countSlabContent();

    return NextResponse.json({
      message: "Ingestion complete (with embeddings)",
      documentsFound: docs.length,
      chunksCreated: chunks.length,
      embeddingsComputed: embeddedChunks.length,
      previousRecordsDeleted: deleted,
      recordsInserted: inserted,
      totalRecordsInDb: total,
    });
  } catch (err) {
    console.error("Ingestion error:", err);
    return NextResponse.json(
      { error: "Ingestion failed", details: String(err) },
      { status: 500 },
    );
  }
}
