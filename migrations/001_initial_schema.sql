-- Enable pgvector extension (requires superuser or extension already installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create slab_content table for storing document chunks with embeddings
CREATE TABLE IF NOT EXISTS slab_content (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding_vector vector(768),  -- Gemini embeddings are 768 dimensions
    slab_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create questions_asked table for tracking user questions
CREATE TABLE IF NOT EXISTS questions_asked (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    question_text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Use HNSW index (better for smaller datasets, no data required to build)
-- Will slowly move to IVF index as dataset grows (requires data to build)
CREATE INDEX IF NOT EXISTS slab_content_embedding_hnsw_idx ON slab_content 
USING hnsw (embedding_vector vector_cosine_ops);

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS questions_asked_user_idx ON questions_asked(user_id);

-- Create index for timestamp-based queries
CREATE INDEX IF NOT EXISTS questions_asked_timestamp_idx ON questions_asked(timestamp DESC);
