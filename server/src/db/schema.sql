-- Enable pgvector extension (must be done by a superuser)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- videos  (cache table — one row per unique youtube_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id     TEXT UNIQUE NOT NULL,
  title          TEXT NOT NULL,
  channel_id     TEXT,
  channel_title  TEXT,
  transcript     TEXT,                    -- full flat text; NULL when no captions
  has_captions   BOOLEAN DEFAULT true,
  stats_json     JSONB,                   -- { views, likes, commentCount, uploadDate }
  summary        TEXT,                    -- cached LLM summary
  status         TEXT NOT NULL DEFAULT 'processing'
                   CHECK (status IN ('ready', 'processing', 'no_captions', 'failed')),
  cached_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- video_embeddings  (pgvector store — one row per transcript chunk)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_embeddings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id            UUID REFERENCES videos(id) ON DELETE CASCADE,
  chunk_index         INT NOT NULL,
  chunk_text          TEXT NOT NULL,
  chunk_start_seconds INT,               -- transcript timestamp for citation
  embedding           VECTOR(3072)       -- gemini-embedding-001 output dimension
);

-- ---------------------------------------------------------------------------
-- conversations  (per-video chat sessions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  video_id   UUID REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- messages  (persisted Q&A history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  citations_json   JSONB,               -- [{ timestampSeconds, text }]
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- Note: ivfflat index is intentionally omitted at MVP scale.
-- Add it when video_embeddings grows to several thousand rows.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_video_embeddings_video_id
  ON video_embeddings(video_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversations_video_id
  ON conversations(video_id);
