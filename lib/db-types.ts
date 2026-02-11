// Database type definitions

export interface SlabContent {
  id: number;
  title: string;
  chunk_text: string;
  embedding_vector: number[] | null;
  slab_url: string | null;
  created_at: Date;
}

export interface QuestionAsked {
  id: number;
  user_id: string;
  question_text: string;
  timestamp: Date;
}

// Input types for creating records
export interface CreateSlabContent {
  title: string;
  chunk_text: string;
  embedding_vector?: number[];
  slab_url?: string;
}

export interface CreateQuestionAsked {
  user_id: string;
  question_text: string;
}

// Vector search result with similarity score
export interface SlabContentWithSimilarity extends SlabContent {
  similarity: number;
}
