# Product spec — YouTube summarizer/analyzer MVP

## One-line description
User pastes a YouTube link, gets an AI-generated analysis (summary, transcript-grounded Q&A, engagement/comment insight, similar videos), with per-video conversational memory.

## MVP scope (in)
- Paste a YouTube URL → fetch transcript + video metadata (title, channel, views, likes, comment count, upload date)
- Auto-generated summary on load (single LLM call)
- Chat/Q&A interface scoped to that video, grounded in the transcript, with timestamp citations
- Conversation persists per video (user can leave and come back)
- "Similar videos" suggestion based on transcript-embedding similarity (not just title keyword match)
- Provider-agnostic LLM layer with Gemini as the default provider

## MVP scope (out — explicitly deferred)
- Cross-video memory / synthesis across multiple videos
- Comment sentiment clustering (needs comment-heavy analysis pass — phase 2)
- Visual/keyframe analysis
- Whisper fallback for caption-less videos (phase 2 — MVP only supports videos with existing captions)
- Anthropic provider (interface built for it, not wired up at launch)
- Multi-user auth beyond basic email/password or magic link

## Core user flow
1. User pastes a YouTube URL
2. App fetches transcript + stats (cache-first)
3. App generates initial summary, shown immediately
4. User asks follow-up questions in a chat panel; each answer cites transcript timestamps
5. Sidebar shows 3-5 similar videos (embedding similarity search)

## Success criteria for MVP
- End-to-end flow works for a video with existing YouTube captions, under ~10s for initial summary
- Q&A answers are grounded (citation to a timestamp), not free-floating hallucination
- Runs entirely within the lean AWS stack (single EB instance + RDS) without ElastiCache/SQS
- LLM provider is swappable via config, not hardcoded through the codebase

## Out-of-scope failure modes (acceptable for MVP, revisit later)
- Videos with no captions: show a clear "captions unavailable" message, no summary generated
- Very long videos (2hr+): summary may be based on chunked/sampled transcript rather than full context

# Technical architecture — MVP

This is the lean version of the full architecture, scoped to run inside AWS free tier/credits.
See `skills/eb-deployment/SKILL.md` and `skills/cost-guardrails/SKILL.md` for the reasoning behind these cuts.

## Components (MVP)

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React, hosted on S3 + CloudFront | Static build, no server-side rendering needed |
| API server | Node.js/Express on Elastic Beanstalk, **single-instance environment** | No load balancer — avoids ALB cost |
| Database | RDS Postgres + `pgvector` | Single-AZ, db.t3.micro. Holds relational data AND embeddings |
| Background work | In-process async (no SQS/worker tier yet) | Transcript fetch + embedding generation run inline in the request lifecycle or a simple in-process queue |
| Cache | Postgres column (`cached_at`) or in-memory | No ElastiCache at MVP scale |
| LLM | Gemini (default), Anthropic (interface ready, not wired) | See `skills/llm-provider-abstraction/SKILL.md` |
| Secrets | `eb setenv` / EB environment properties | Not in source control |

## Recommended Folder Structure
```
yt-summarizer-n-analyser/          # root folder
│
├── .agent/skills/                        # domain guidance, e.g. for .claude/skills/
│   ├── youtube-data-fetching/SKILL.md
│   ├── llm-provider-abstraction/SKILL.md
│   ├── vector-search-pgvector/SKILL.md
│   ├── elastic-beanstalk-deployment/SKILL.md
│   └── aws-cost-guardrails/SKILL.md
│
├── client/                        # React app
│   ├── public/
│   ├── src/
│   │   ├── api/                   # thin fetch wrappers per API spec endpoint
│   │   │   ├── videos.ts
│   │   │   └── messages.ts
│   │   ├── components/
│   │   │   ├── VideoInput/
│   │   │   ├── SummaryPanel/
│   │   │   ├── ChatPanel/         # Q&A UI, streams responses
│   │   │   ├── CitationBadge/     # timestamp citation, jumps embedded player
│   │   │   └── SimilarVideos/
│   │   ├── hooks/
│   │   │   ├── useVideoAnalysis.ts
│   │   │   └── useConversation.ts
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   └── VideoView.tsx
│   │   ├── types/                 # shared shape defs mirroring API spec responses
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
│
├── server/                        # Express API, deployed via EB
│   ├── src/
│   │   ├── routes/
│   │   │   ├── videos.ts          # POST/GET /videos, GET /videos/:id/similar
│   │   │   └── messages.ts        # POST/GET .../messages
│   │   ├── services/
│   │   │   ├── youtube/
│   │   │   │   ├── transcriptFetcher.ts
│   │   │   │   └── metadataFetcher.ts
│   │   │   ├── llm/
│   │   │   │   ├── LLMProvider.ts         # interface
│   │   │   │   ├── GeminiProvider.ts
│   │   │   │   ├── AnthropicProvider.ts
│   │   │   │   └── getLLMProvider.ts      # factory, reads LLM_PROVIDER env
│   │   │   ├── embeddings/
│   │   │   │   ├── chunker.ts
│   │   │   │   └── retrieval.ts           # pgvector similarity queries
│   │   │   └── cache/
│   │   │       └── videoCache.ts          # Postgres cached_at check-before-fetch
│   │   ├── db/
│   │   │   ├── schema.sql                 # mirrors spec/03-data-model.md
│   │   │   ├── migrations/
│   │   │   └── client.ts
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts            # normalizes to API spec error shape
│   │   │   └── auth.ts
│   │   ├── types/                         # mirrors client/src/types, keep in sync
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .ebextensions/
│   │   └── 01-environment.config
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore
├── AGENTS.md                               # Agent instructions
├── SPEC.md                                 # project scope and specifications
└── README.md
```

## Deferred until real traffic justifies the cost
- ElastiCache Redis (add when repeated-lookup cost/latency actually matters)
- SQS + separate worker tier (add when transcript/embedding jobs are slow enough to block requests)
- Load-balanced EB environment + auto-scaling (add when a single t3.micro is the bottleneck)
- Whisper fallback pipeline (needs its own compute — GPU or long CPU jobs — add in phase 2)

## Data flow (MVP)
1. React app (S3/CloudFront) → API (EB single instance) over HTTPS
2. API checks Postgres for a cached transcript/summary by `youtube_id`
3. If not cached: call YouTube Data API for metadata + transcript endpoint for captions, store in Postgres
4. API calls the LLM provider (via the abstraction layer) to generate summary + embeddings
5. Embeddings stored in the `video_embeddings` table (pgvector)
6. Q&A requests: embed the question, `pgvector` similarity search scoped to that video's chunks, build prompt with retrieved chunks + conversation history, call LLM, stream response back

## What changes when you outgrow this
- Bottleneck is request latency on transcript/embedding jobs → introduce SQS + worker EB environment
- Bottleneck is repeated DB reads for popular videos → introduce ElastiCache
- Bottleneck is single-instance capacity/downtime on deploy → migrate to load-balanced EB environment
None of these require a rewrite — the abstraction points (LLM provider interface, cache-check-before-fetch pattern) are designed to absorb them.

# Data model — MVP

Postgres with the `pgvector` extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  channel_id TEXT,
  channel_title TEXT,
  transcript TEXT,               -- full transcript text, null if unavailable
  has_captions BOOLEAN DEFAULT true,
  stats_json JSONB,               -- views, likes, comment_count, upload_date, etc.
  summary TEXT,                   -- cached initial LLM summary
  cached_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE video_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_start_seconds INT,        -- transcript timestamp this chunk starts at, for citations
  embedding VECTOR(768)           -- dimension depends on Gemini embedding model in use — confirm before migrating
);

CREATE INDEX ON video_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  video_id UUID REFERENCES videos(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations_json JSONB,           -- array of {chunk_id, timestamp_seconds}
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Notes
- `stats_json` and `citations_json` are JSONB rather than normalized tables — for MVP scale this is simpler and fast enough; normalize later if you need to query inside them frequently.
- `video_embeddings.embedding` dimension **must match your embedding model's output size** — check this before writing the migration, not after (Gemini and Anthropic use different embedding models/dimensions, relevant if you switch providers later).
- The `ivfflat` index needs a reasonable amount of data to be effective (rule of thumb: don't bother below a few thousand rows) — for true MVP scale a sequential scan is fine; add the index when video count grows.
- No `similar_videos` table — that's computed live via a `pgvector` query across all videos' embeddings, not stored.


# API spec — MVP

Base path: `/api/v1`

## `POST /videos`
Submit a YouTube URL for analysis.

**Request**
```json
{ "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX" }
```

**Response `200`** (cached) or `202` (newly processing)
```json
{
  "videoId": "uuid",
  "youtubeId": "XXXXXXXXXXX",
  "status": "ready" | "processing" | "no_captions",
  "title": "...",
  "summary": "..." ,
  "stats": { "views": 0, "likes": 0, "commentCount": 0, "uploadDate": "..." }
}
```
If `status: "processing"`, frontend polls `GET /videos/:id` until `ready`.

## `GET /videos/:id`
Fetch a previously analyzed video's current state (poll target for the above).

## `POST /videos/:id/messages`
Ask a question about a video.

**Request**
```json
{ "conversationId": "uuid | null", "question": "What does the speaker say about X?" }
```

**Response**
```json
{
  "conversationId": "uuid",
  "answer": "...",
  "citations": [{ "timestampSeconds": 142, "text": "excerpt the claim is grounded in" }]
}
```
Stream this response (SSE or chunked) rather than waiting for the full generation — matters for perceived latency on longer answers.

## `GET /videos/:id/conversations/:conversationId/messages`
Fetch message history for a conversation (used when the user reopens a video).

## `GET /videos/:id/similar`
Returns 3-5 similar videos by transcript-embedding similarity.

**Response**
```json
{ "similar": [{ "youtubeId": "...", "title": "...", "similarityScore": 0.83 }] }
```

## Error shape (all endpoints)
```json
{ "error": { "code": "NO_CAPTIONS" | "QUOTA_EXCEEDED" | "INVALID_URL" | "LLM_ERROR", "message": "..." } }
```
Keep error codes as an enum from day one — the frontend needs to distinguish "no captions available" from "YouTube quota hit" from "LLM failed," since the right user-facing message differs for each.


# Deployment spec — MVP

Full detail in `skills/eb-deployment/SKILL.md`. This is the checklist version.

## Infrastructure to provision
1. RDS Postgres, db.t3.micro, single-AZ, 20GB storage, `pgvector` extension enabled
2. Elastic Beanstalk **single-instance** environment (`eb create ... --single`), t3.micro, Node.js 20 platform
3. S3 bucket for the React static build
4. CloudFront distribution pointed at the S3 bucket
5. IAM: a scoped role/user for the API server with only the permissions it needs (no admin-level keys in env vars)

## Explicitly not provisioned at MVP
- ElastiCache
- SQS / worker EB environment
- NAT Gateway / private VPC subnets
- Application Load Balancer

## Environment variables (set via `eb setenv`, never committed)
```
DATABASE_URL
YOUTUBE_API_KEY
GEMINI_API_KEY
ANTHROPIC_API_KEY       # present even if unused at MVP, for the provider interface
LLM_PROVIDER=gemini
NODE_ENV=production
```

## Pre-launch checklist
- [ ] CloudWatch billing alarm set at a low threshold (e.g. $5) — see `skills/cost-guardrails/SKILL.md`
- [ ] RDS security group only allows inbound from the EB instance's security group, not `0.0.0.0/0`
- [ ] `.env` and any credentials excluded via `.gitignore`
- [ ] Confirm which AWS free-tier model your account is on (pre- or post- July 15 2025) before relying on any specific free-hours number
- [ ] React build's API base URL points to the EB environment's domain, set at build time