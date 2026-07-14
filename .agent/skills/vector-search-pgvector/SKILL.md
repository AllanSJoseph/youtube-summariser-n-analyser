---
name: vector-search-pgvector
description: Use this skill whenever implementing transcript chunking, embedding storage, or similarity search (Q&A retrieval, similar-videos feature).
---

# Vector search with pgvector

## Chunking transcripts
- Chunk by a fixed token/character window with overlap (e.g. ~500 tokens, ~50 token overlap), not by arbitrary character count — overlap prevents losing context at chunk boundaries
- Prefer chunking on sentence/paragraph boundaries within that window over hard-cutting mid-sentence
- Store `chunk_start_seconds` per chunk (approximate transcript timestamp) so answers can cite a specific moment in the video — this is required for the citation feature in the API spec, not optional

## Writing embeddings
- Batch embedding generation calls where the provider SDK supports it, rather than one call per chunk
- Always write the embedding and its source chunk in the same transaction as the chunk row itself — a chunk row without a corresponding embedding is a silent bug that surfaces later as a retrieval gap

## Querying
Cosine similarity via pgvector's `<=>` operator:
```sql
SELECT chunk_text, chunk_start_seconds, 1 - (embedding <=> $1) AS similarity
FROM video_embeddings
WHERE video_id = $2
ORDER BY embedding <=> $1
LIMIT 5;
```
- Scope every Q&A query to a single `video_id` — don't search across all videos for the Q&A feature (that's the separate similar-videos feature, which intentionally searches broadly)
- For "similar videos," drop the `video_id` filter and instead aggregate per-video (e.g. average or max chunk similarity per `video_id`), then rank videos — not chunks

## Index timing
Don't add an `ivfflat` index prematurely. It's a lossy/approximate index that needs a meaningful amount of data to build well (rule of thumb: don't bother below a few thousand rows) — a plain sequential scan is fine and more accurate at MVP data volumes. Add the index when query latency actually becomes a problem, and rebuild it periodically as data grows (`ivfflat` doesn't self-tune).

## Retrieval-augmented prompt construction
When building the Q&A prompt: retrieved chunks + last N messages of conversation history + the question. Keep retrieved-chunk count small (3-5) rather than dumping everything above a similarity threshold — more context isn't always better and increases both cost and hallucination risk from irrelevant material.