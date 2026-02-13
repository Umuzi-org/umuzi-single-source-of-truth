import { query } from "../db";
import type {
  SlabContent,
  CreateSlabContent,
  SlabContentWithSimilarity,
} from "../db-types";

// Insert a new slab content record
export async function insertSlabContent(
  data: CreateSlabContent,
): Promise<SlabContent> {
  const { title, chunk_text, embedding_vector, slab_url } = data;

  const result = await query<SlabContent>(
    `INSERT INTO slab_content (title, chunk_text, embedding_vector, slab_url)
     VALUES ($1, $2, $3::vector, $4)
     RETURNING *`,
    [
      title,
      chunk_text,
      embedding_vector ? `[${embedding_vector.join(",")}]` : null,
      slab_url,
    ],
  );

  return result.rows[0];
}

// Find slab content by ID
export async function findSlabContentById(
  id: number,
): Promise<SlabContent | null> {
  const result = await query<SlabContent>(
    "SELECT * FROM slab_content WHERE id = $1",
    [id],
  );

  return result.rows[0] || null;
}

// Search slab content by vector similarity
// Returns the most similar documents based on cosine similarity
export async function searchByEmbedding(
  embedding: number[],
  limit: number = 5,
): Promise<SlabContentWithSimilarity[]> {
  const embeddingStr = `[${embedding.join(",")}]`;

  const result = await query<SlabContentWithSimilarity>(
    `SELECT *, 1 - (embedding_vector <=> $1::vector) as similarity
     FROM slab_content
     WHERE embedding_vector IS NOT NULL
     ORDER BY embedding_vector <=> $1::vector
     LIMIT $2`,
    [embeddingStr, limit],
  );

  return result.rows;
}

// Get all slab content (paginated)
export async function getAllSlabContent(
  limit: number = 50,
  offset: number = 0,
): Promise<SlabContent[]> {
  const result = await query<SlabContent>(
    "SELECT * FROM slab_content ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset],
  );

  return result.rows;
}

// Update slab content embedding
export async function updateSlabContentEmbedding(
  id: number,
  embedding: number[],
): Promise<SlabContent | null> {
  const embeddingStr = `[${embedding.join(",")}]`;

  const result = await query<SlabContent>(
    `UPDATE slab_content 
     SET embedding_vector = $1::vector 
     WHERE id = $2 
     RETURNING *`,
    [embeddingStr, id],
  );

  return result.rows[0] || null;
}

// Delete slab content by ID
export async function deleteSlabContent(id: number): Promise<boolean> {
  const result = await query("DELETE FROM slab_content WHERE id = $1", [id]);

  return (result.rowCount ?? 0) > 0;
}

// Bulk insert many content records in a single transaction
export async function bulkInsertSlabContent(
  records: CreateSlabContent[],
): Promise<number> {
  if (records.length === 0) return 0;

  // Build a parameterised bulk INSERT
  const values: unknown[] = [];
  const placeholders: string[] = [];

  records.forEach((r, idx) => {
    const offset = idx * 4;
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}::vector, $${offset + 4})`,
    );
    values.push(
      r.title,
      r.chunk_text,
      r.embedding_vector ? `[${r.embedding_vector.join(",")}]` : null,
      r.slab_url ?? null,
    );
  });

  const result = await query(
    `INSERT INTO slab_content (title, chunk_text, embedding_vector, slab_url)
     VALUES ${placeholders.join(", ")}`,
    values,
  );

  return result.rowCount ?? 0;
}
