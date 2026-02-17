# Umuzi Single Source of Truth

An AI-powered internal knowledge assistant for the Umuzi organisation. It ingests operational documentation (currently from local Markdown files, with Slab integration planned), chunks it intelligently, generates vector embeddings via Google Gemini, and exposes a RAG (Retrieval-Augmented Generation) pipeline so staff can ask natural-language questions and receive accurate, cited answers through a Slack bot.

## Goals

1. **Centralise institutional knowledge** — surface information from Slab docs, operational processes, and team guidelines in one searchable system.
2. **Instant, accurate answers** — staff ask a question in Slack and get an LLM-generated response grounded in real Umuzi documents, complete with citations and links.
3. **Stay up-to-date automatically** — a daily cron job re-ingests content and refreshes embeddings so answers always reflect the latest docs.
4. **Track usage** — every question is logged for analytics, helping the team understand what information people look for most.

## What "DONE" Looks Like

| Capability                                   | Status                                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| Slab / Markdown content fetch and storage    | ✅ Working (local Markdown; Slab API next)                  |
| Content chunking (500–1 000 tokens, overlap) | ✅ Working & tested                                         |
| PostgreSQL + pgvector schema                 | ✅ Migrated                                                 |
| Ingestion API route (`POST /api/ingest`)     | ✅ Working (secret-key secured, embeds + stores chunks)     |
| Google Gemini embedding generation           | ✅ Working (`embedText`, `embedTexts`, `embedAllChunks`)    |
| Vector similarity search (RAG retrieval)     | ✅ Working (`searchByEmbedding` with cosine similarity)     |
| LLM answer generation with citations         | ✅ Working (RAG pipeline in `lib/rag.ts` + `POST /api/ask`) |
| Question logging (`questions_asked` table)   | ✅ Working (logged on every `/api/ask` request)             |
| Ask API route (`POST /api/ask`)              | ✅ Working (question → embed → search → LLM answer)         |
| Slack App integration (slash command / DM)   | 🔲 Not started                                              |
| Daily cron job (Render)                      | 🔲 Not started                                              |
| Production deployment on Render              | 🔲 Not started                                              |

## How It Will Be Used at Umuzi

Umuzi has a growing body of operational documentation including meeting guidelines, OKR processes, KPA frameworks, deep-work policies, quarterly rituals, and more. Today, finding the right document means searching Slab manually or asking a colleague. This tool replaces that friction:

- **Staff** type a question in a Slack channel or DM the bot (e.g. _"What is the process for setting KPAs?"_).
- The system converts the question into an embedding, searches the vector database for the most relevant document chunks, and feeds them into Google Gemini to produce a concise answer **with citations** (quotes + source links).
- **Ops & Leadership** can review the `questions_asked` table to see what topics people ask about most, identifying documentation gaps.

## Current Project Status

The core RAG pipeline is **fully functional** end-to-end:

- **Next.js 16 + TypeScript** project is bootstrapped and compiling.
- **Database layer** is complete — PostgreSQL with pgvector, connection pooling via `pg`, typed repositories for `slab_content` and `questions_asked`, and a migration script.
- **Content ingestion pipeline** is functional end-to-end: the `content-reader` recursively loads Markdown files from `content/`, the `chunker` splits them into overlapping ~550-word chunks (≈ 730 tokens) with title context prepended, and the `POST /api/ingest` route orchestrates clear → chunk → embed → bulk-insert in batches of 50.
- **Google Gemini integration** is complete — `embedText()`, `embedTexts()`, and `embedAllChunks()` generate 768-dim vectors via `gemini-embedding-001`; `generateText()` produces LLM answers via `gemini-2.0-flash`.
- **RAG query pipeline** is live — `POST /api/ask` accepts a question, embeds it, performs vector similarity search with a relevance threshold, builds an augmented prompt, and returns a Gemini-generated answer with source citations.
- **Question logging** is active — every question submitted to `/api/ask` is recorded in the `questions_asked` table with a user ID and timestamp.
- **25 operational Markdown documents** are already in `content/operational-processes/`.
- **Remaining work**: Slack App integration, daily cron job, and production deployment on Render.

## Tech Stack

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Framework        | Next.js 16 (App Router) |
| Language         | TypeScript 5            |
| Database         | PostgreSQL + pgvector   |
| DB Client        | `pg` (node-postgres)    |
| Embeddings / LLM | Google Gemini           |
| Chat Interface   | Slack App (planned)     |
| Hosting          | Render (planned)        |
| Styling          | Tailwind CSS 4          |

## Database Schema

```
slab_content
├── id              SERIAL PRIMARY KEY
├── title           VARCHAR(500)
├── chunk_text      TEXT
├── embedding_vector vector(768)   — Gemini embedding dimensions
├── slab_url        VARCHAR(1000)
└── created_at      TIMESTAMPTZ

questions_asked
├── id              SERIAL PRIMARY KEY
├── user_id         VARCHAR(255)
├── question_text   TEXT
└── timestamp       TIMESTAMPTZ
```

Indexes: HNSW on `embedding_vector` (cosine), B-tree on `user_id` and `timestamp`.

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 15 with the **pgvector** extension installed
- A Google Gemini API key (for embeddings & LLM — needed once that integration is built)

### 1. Clone & install

```bash
git clone https://github.com/<your-org>/umuzi-single-source-of-truth.git
cd umuzi-single-source-of-truth
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# PostgreSQL connection string (pgvector must be enabled on this database)
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>

# Secret used to authenticate the /api/ingest endpoint
INGEST_SECRET_CODE=your-random-secret

# Base URL of the running app (used by scripts/ingest.ts)
HOST_URL=http://localhost:3000

# Google Gemini API key (required once embedding generation is implemented)
GEMINI_API_KEY=

# Slack Bot OAuth token (required once Slack integration is implemented)
SLACK_BOT_TOKEN=
```

### 3. Run database migrations

```bash
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

### 4. Start the dev server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### 5. Ingest content

With the dev server running, trigger ingestion:

```bash
# Via the helper script (requires HOST_URL and INGEST_SECRET_CODE in env)
npm run ingest

# Or directly via curl
curl -X POST http://localhost:3000/api/ingest \
  -H "x-ingest-secret: your-random-secret"
```

## Project Structure

```
app/
  api/
    ask/route.ts        → POST: RAG pipeline (embed question → search → LLM answer)
    greet/route.ts      → Health-check / hello endpoint
    ingest/route.ts     → POST: clear DB, chunk markdown, embed, bulk-insert
  page.tsx              → Landing page (placeholder)
  layout.tsx            → Root layout
content/
  operational-processes/ → 25 Umuzi Markdown docs
lib/
  chunker.ts            → Sentence-aware chunking with overlap
  content-reader.ts     → Recursive Markdown file loader
  db.ts                 → pg Pool, query helper, graceful shutdown
  db-types.ts           → TypeScript interfaces for DB rows
  embeddings.ts         → Batch embedding of content chunks via Gemini
  gemini.ts             → Gemini client, embedText/embedTexts/generateText
  index.ts              → Barrel re-exports
  rag.ts                → Full RAG pipeline (embed → search → prompt → answer)
  repositories/
    slab-content.ts     → CRUD + vector search for slab_content
    questions-asked.ts  → CRUD + analytics for questions_asked
migrations/
  001_initial_schema.sql → pgvector, tables, indexes
scripts/
  ingest.ts             → CLI trigger for /api/ingest
```

## Available Scripts

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `npm run dev`    | Start Next.js in development mode     |
| `npm run build`  | Production build                      |
| `npm run start`  | Start the production server           |
| `npm run lint`   | Run ESLint                            |
| `npm run ingest` | Trigger content ingestion via the API |

## Next Steps (Roadmap)

- [x] Integrate Google Gemini API for embedding generation and LLM answers
- [x] Build the RAG query pipeline (embed question → vector search → LLM answer with citations)
- [x] Log every question to `questions_asked`
- [ ] Create and connect a Slack App (slash commands and/or bot DMs)
- [ ] Set up a Render cron job for daily re-ingestion
- [ ] Deploy to Render (staging → production)
- [ ] Add Slab API integration to replace / augment local Markdown files
- [ ] Support Google Drive documents as an additional content source
- [ ] Enable conversational threads (multi-turn Q&A)
- [ ] Add thumbs-up / thumbs-down feedback on answers
