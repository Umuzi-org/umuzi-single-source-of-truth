# Umuzi Single Source of Truth

An AI-powered internal knowledge assistant for the Umuzi organisation. It ingests operational documentation (currently from local Markdown files, with Slab integration planned), chunks it intelligently, generates vector embeddings via Google Gemini, and exposes a RAG (Retrieval-Augmented Generation) pipeline so staff can ask natural-language questions and receive accurate, cited answers through a Slack bot.

## Goals

1. **Centralise institutional knowledge** — surface information from operational processes, team guidelines, pathways, and people & culture docs in one searchable system.
2. **Instant, accurate answers** — staff ask a question in Slack and get an LLM-generated response grounded in real Umuzi documents, complete with citations and links.
3. **Stay up-to-date automatically** — a GitHub Actions workflow re-ingests content on demand so answers always reflect the latest docs.
4. **Track usage** — every question is logged for analytics, with a monthly Gemini-powered report posted to Slack automatically.

## What "DONE" Looks Like

| Capability                                       | Status                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| Markdown content fetch and storage               | ✅ Working (104 docs across 6 categories)                                   |
| Content chunking (section-aware, overlapping)    | ✅ Working (splits on `##` headings, ~550-word target with 75-word overlap) |
| PostgreSQL + pgvector schema                     | ✅ Migrated                                                                 |
| Ingestion API route (`POST /api/ingest-markdown`)| ✅ Working (secret-key secured, embeds + stores chunks)                     |
| Google Gemini embedding generation               | ✅ Working (`gemini-embedding-001`, 768-dim vectors)                        |
| Vector similarity search (RAG retrieval)         | ✅ Working (`searchByEmbedding` with cosine similarity, threshold 0.3)      |
| Document expansion in RAG                        | ✅ Working (fetches all chunks from every matched document)                 |
| LLM answer generation with cited sources         | ✅ Working (structured JSON response with `used_sources` field)             |
| Question logging (`questions_asked` table)       | ✅ Working (logged on every `/api/ask` request)                             |
| Ask API route (`POST /api/ask`)                  | ✅ Working (slash command + JSON; async ACK for Slack 3 s timeout)          |
| Slack Events API (`POST /api/slack`)             | ✅ Working (`app_mention` in channels + direct messages to Zazu)            |
| Slack slash command (`/ask`)                     | ✅ Working (fire-and-forget with `response_url` callback)                   |
| Monthly report (`POST /api/report`)              | ✅ Working (Gemini analysis of last 30 days → posted to Slack channel)      |
| GitHub Actions — manual re-ingest (`ingest.yml`) | ✅ Working (`workflow_dispatch`)                                            |
| GitHub Actions — monthly report (`report.yml`)   | ✅ Working (scheduled 28th of each month + `workflow_dispatch`)             |
| Production deployment on Render                  | 🔲 Not started                                                              |
| Slab API integration                             | 🔲 Not started                                                              |

## How It Is Used at Umuzi

Umuzi has a growing body of operational documentation including meeting guidelines, OKR processes, KPA frameworks, deep-work policies, quarterly rituals, and more. Today, finding the right document means searching manually or asking a colleague. This tool replaces that friction:

- **Staff** type a question in a Slack channel (mentioning `@Zazu`) or DM the bot directly (e.g. _"What is the process for setting KPAs?"_).
- The system converts the question into a 768-dim embedding, searches the vector database for the most relevant document chunks, fetches **all chunks** from every matched document (document expansion), and feeds the full context into Google Gemini to produce a concise answer **with citations** (source title + GitHub link + relevance %).
- A **slash command** (`/ask <question>`) works in any channel without needing to @-mention the bot.
- **Ops & Leadership** can review the `questions_asked` table to see what topics people ask about most, identifying documentation gaps. A formatted Gemini-written report is automatically posted to the configured Slack channel on the **28th of every month**.

## Current Project Status

The full system is **production-ready** end-to-end:

- **Next.js 16 + TypeScript** project is bootstrapped and compiling.
- **Database layer** is complete — PostgreSQL with pgvector, connection pooling via `pg`, typed repositories for `slab_content` and `questions_asked`, and a migration script.
- **Content ingestion pipeline** is functional end-to-end: the `content-reader` recursively loads Markdown files from all six `content/` categories, the `chunker` splits them by `##` section headings into overlapping ~550-word chunks (≈ 730 tokens) with title context prepended, and `POST /api/ingest` orchestrates clear → chunk → embed → bulk-insert in batches of 50. Source URLs point to the canonical GitHub file location.
- **Google Gemini integration** is complete — `embedText()`, `embedTexts()`, and `embedAllChunks()` generate 768-dim vectors via `gemini-embedding-001`; `generateText()` produces LLM answers via `gemini-2.0-flash`.
- **RAG query pipeline** is live — `POST /api/ask` embeds the question, performs cosine similarity search (top-10, threshold 0.3), expands to all chunks of matched documents, builds an augmented prompt asking Gemini for a structured `{ answer, used_sources }` JSON response, then returns the answer with deduplicated source citations.
- **Slack bot "Zazu"** handles Events API (`app_mention`, DM) via `POST /api/slack` and slash commands via `POST /api/ask`. Both routes ACK immediately and process in the background to satisfy Slack's 3-second timeout.
- **Monthly reporting** is live — `POST /api/report` fetches the last 30 days of questions, sends them to Gemini for categorisation and trend analysis, and posts a formatted summary to the configured Slack channel.
- **104 Markdown documents** are in `content/` across six categories: `guidelines/`, `operational-processes/`, `pathways/`, `people-and-culture/`, `projects-and-initiatives/`, and `systems-and-tools/`.

## Tech Stack

| Layer            | Technology                                                  |
| ---------------- | ----------------------------------------------------------- |
| Framework        | Next.js 16 (App Router)                                     |
| Language         | TypeScript 5                                                |
| Database         | PostgreSQL + pgvector                                       |
| DB Client        | `pg` (node-postgres)                                        |
| Embeddings / LLM | Google Gemini (`gemini-embedding-001` / `gemini-2.0-flash`) |
| Chat Interface   | Slack App (Events API + slash command)                      |
| CI / Automation  | GitHub Actions                                              |
| Hosting          | Render (planned)                                            |
| Styling          | Tailwind CSS 4                                              |

## Database Schema

```
slab_content
├── id              SERIAL PRIMARY KEY
├── title           VARCHAR(500)
├── chunk_text      TEXT
├── embedding_vector vector(768)   — Gemini embedding dimensions
├── slab_url        VARCHAR(1000)  — GitHub link to source file
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
- A **Google Gemini API key** (embeddings + LLM)
- A **Slack App** with a bot token (for the Slack integration)

### 1. Clone & install

```bash
git clone https://github.com/Umuzi-org/umuzi-single-source-of-truth.git
cd umuzi-single-source-of-truth
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```env
# PostgreSQL connection string (pgvector must be enabled on this database)
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>

# Base URL of the running app (used by scripts/ingest.ts and GitHub Actions)
HOST_URL=http://localhost:3000

# Secret used to authenticate the POST /api/ingest endpoint (x-ingest-secret header)
INGEST_SECRET_CODE=your-random-secret

# Secret used to authenticate the POST /api/report endpoint (body: { "secretCode": "..." })
REPORT_SECRET_CODE=your-random-secret

# Google Gemini API key
GEMINI_API_KEY=your-gemini-api-key

# Slack Bot OAuth token (xoxb-...)
SLACK_BOT_TOKEN=your-slack-bot-token

# Slack channel ID to post monthly reports to (e.g. C01234567)
SLACK_CHANNEL_ID=your-slack-channel-id
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
# Via the helper script (reads HOST_URL and INGEST_SECRET_CODE from env)
npm run ingest

# Or directly via curl
curl -X POST http://localhost:3000/api/ingest \
  -H "x-ingest-secret: your-random-secret"
```

### 6. Configure the Slack App

In the [Slack API dashboard](https://api.slack.com/apps):

1. **OAuth & Permissions** — add bot scopes: `chat:write`, `app_mentions:read`, `im:history`, `commands`.
2. **Event Subscriptions** — set the request URL to `https://<your-domain>/api/slack` and subscribe to `app_mention` and `message.im` bot events.
3. **Slash Commands** — create a `/ask` command pointing to `https://<your-domain>/api/ask`.
4. Install the app to your workspace and copy the **Bot User OAuth Token** into `SLACK_BOT_TOKEN`.

> **Local development:** Use [ngrok](https://ngrok.com/) to expose `localhost:3000` and set the tunnelled URL in your Slack App settings.

## Project Structure

```
app/
  api/
    ask/route.ts         → POST: slash command + JSON RAG endpoint (async ACK)
    slack/route.ts       → POST: Events API — url_verification, app_mention, DM
    ingest/route.ts      → POST: clear DB → chunk → embed → bulk-insert
    report/route.ts      → POST: generate monthly Gemini report → post to Slack
    greet/route.ts       → GET + POST: health-check / greeting endpoint
  page.tsx               → Landing page (placeholder)
  layout.tsx             → Root layout
content/
  guidelines/            → Meeting, sick-leave, and security guidelines
  operational-processes/ → OKRs, KPAs, deep-work, meeting rituals, etc.
  pathways/              → Learner journey, facilitator training, assessments
  people-and-culture/    → Team profiles, recruitment, wellness
  projects-and-initiatives/ → Active project documentation
  systems-and-tools/     → Slack, Google Classroom, Monday.com, Slab guides
lib/
  chunker.ts             → Section-aware chunking (## headings) with overlap
  content-reader.ts      → Recursive Markdown file loader from content/
  db.ts                  → pg Pool, query helper, graceful shutdown
  db-types.ts            → TypeScript interfaces for DB rows
  embeddings.ts          → Batch embedding of content chunks via Gemini
  gemini.ts              → Gemini client: embedText / embedTexts / generateText
  index.ts               → Barrel re-exports
  rag.ts                 → Full RAG pipeline (embed → search → expand → answer)
  report.ts              → Monthly report generation (Gemini analysis + Slack post)
  report-types.ts        → TypeScript interfaces for report data
  slack-format.ts        → Markdown → Slack mrkdwn converter + source formatter
  repositories/
    slab-content.ts      → CRUD + vector search + bulk ops for slab_content
    questions-asked.ts   → CRUD + analytics for questions_asked
migrations/
  001_initial_schema.sql → pgvector extension, tables, HNSW + B-tree indexes
scripts/
  ingest.ts              → CLI trigger for POST /api/ingest
.github/
  workflows/
    ingest.yml           → Manual re-ingest via workflow_dispatch
    report.yml           → Monthly report on the 28th + workflow_dispatch
```

## API Reference

| Method | Route         | Auth                           | Description                                             |
| ------ | ------------- | ------------------------------ | ------------------------------------------------------- |
| `POST` | `/api/ask`    | None (Slack signs requests)    | Slash command (`form-encoded`) or direct JSON RAG query |
| `POST` | `/api/slack`  | None (Slack signs requests)    | Events API: `url_verification`, `app_mention`, DM       |
| `POST` | `/api/ingest` | `x-ingest-secret` header       | Full re-ingest: load → chunk → embed → store            |
| `POST` | `/api/report` | `{ "secretCode": "..." }` body | Generate monthly usage report and post to Slack         |
| `GET`  | `/api/greet`  | None                           | Health-check — returns a greeting JSON                  |
| `POST` | `/api/greet`  | None                           | Slack slash-command version of the health-check         |

### POST /api/ask — JSON example

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the guidelines for no-meeting Wednesdays?", "userId": "alice"}'
```

Response:

```json
{
  "text": "No-meeting Wednesdays are protected deep-work days...",
  "sources": [
    {
      "title": "No-Meeting Wednesdays",
      "chunk_text": "...",
      "similarity": 0.87,
      "slab_url": "https://github.com/Umuzi-org/umuzi-single-source-of-truth/blob/main/content/operational-processes/no-meeting-wednesdays.md"
    }
  ]
}
```

## GitHub Actions

### `ingest.yml` — Manual Re-ingest

Triggered manually via **Actions → Ingest Content → Run workflow**. Checks out the repo, installs `tsx`, and calls `scripts/ingest.ts` which POSTs to `HOST_URL/api/ingest`.

**Required repository secrets:** `HOST_URL`, `INGEST_SECRET_CODE`

### `report.yml` — Monthly Usage Report

Runs automatically on the **28th of every month at midnight UTC** and can also be triggered manually. POSTs to `HOST_URL/api/report` with the secret code, which generates a Gemini-written analysis of the last 30 days of questions and posts it to the Slack channel configured in `SLACK_CHANNEL_ID`.

**Required repository secrets:** `HOST_URL`, `REPORT_SECRET_CODE`

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
- [x] Document expansion — include all chunks from matched documents for better context
- [x] Log every question to `questions_asked`
- [x] Create and connect a Slack App (slash commands + Events API @mention + DM)
- [x] Monthly usage report generated by Gemini and posted to Slack
- [x] GitHub Actions for on-demand re-ingest and scheduled reporting
- [ ] Deploy to Render (staging → production)
- [ ] Add Slab API integration to replace / augment local Markdown files
- [ ] Support Google Drive documents as an additional content source
- [ ] Enable conversational threads (multi-turn Q&A)
- [ ] Add thumbs-up / thumbs-down feedback on answers
- [ ] Schedule automated daily re-ingestion (currently manual via GitHub Actions)
