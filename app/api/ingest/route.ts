import { NextResponse } from "next/server";
import { loadAllDocuments } from "../../../lib/content-reader";
import { chunkAllDocuments } from "../../../lib/chunker";
import {
  bulkInsertSlabContent,
  clearAllSlabContent,
  countSlabContent,
} from "../../../lib/repositories/slab-content";
import type { CreateSlabContent } from "../../../lib/db-types";

// POST /api/ingest — Reads markdown files, chunks them, and stores in DB.
// WARNING: Clears existing content first (full re-ingest).

export async function POST() {
  try {
    const docs = loadAllDocuments();

    if (docs.length === 0) {
      return NextResponse.json(
        { error: "No markdown documents found in content/" },
        { status: 404 },
      );
    }

    const chunks = chunkAllDocuments(docs);

    const records: CreateSlabContent[] = chunks.map((chunk) => ({
      title: chunk.title,
      chunk_text: chunk.chunkText,
      slab_url: chunk.sourceFile,
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
      message: "Ingestion complete",
      documentsFound: docs.length,
      chunksCreated: chunks.length,
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
