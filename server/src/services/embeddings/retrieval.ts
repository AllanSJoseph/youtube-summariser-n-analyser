import pool from '../../db/client';
import { getLLMProvider } from '../llm/getLLMProvider';
import { Chunk } from './chunker';
import { SimilarVideo } from '../../types';

/**
 * Embeds all chunks and inserts them into the video_embeddings table.
 * Each chunk is embedded individually to keep memory usage low.
 * Runs inside a single transaction so partial states are never committed.
 */
export async function storeEmbeddings(videoId: string, chunks: Chunk[]): Promise<void> {
  if (chunks.length === 0) return;

  const llm = getLLMProvider();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete any stale embeddings (re-processing case)
    await client.query('DELETE FROM video_embeddings WHERE video_id = $1', [videoId]);

    for (const chunk of chunks) {
      const embedding = await llm.generateEmbedding(chunk.text);
      const vectorLiteral = `[${embedding.join(',')}]`;

      await client.query(
        `INSERT INTO video_embeddings
           (video_id, chunk_index, chunk_text, chunk_start_seconds, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [videoId, chunk.index, chunk.text, chunk.startSeconds, vectorLiteral],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface RetrievedChunk {
  chunkText: string;
  startSeconds: number;
  similarity: number;
}

/**
 * Embed a question, then retrieve the top-k most similar transcript chunks
 * scoped to a single video. Used for Q&A grounding.
 */
export async function retrieveChunks(
  videoId: string,
  question: string,
  k = 5,
): Promise<RetrievedChunk[]> {
  const llm = getLLMProvider();
  const embedding = await llm.generateEmbedding(question);
  const vectorLiteral = `[${embedding.join(',')}]`;

  const { rows } = await pool.query<{
    chunk_text: string;
    chunk_start_seconds: number;
    similarity: number;
  }>(
    `SELECT chunk_text, chunk_start_seconds,
            1 - (embedding <=> $1::vector) AS similarity
     FROM video_embeddings
     WHERE video_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorLiteral, videoId, k],
  );

  return rows.map((r) => ({
    chunkText: r.chunk_text,
    startSeconds: r.chunk_start_seconds,
    similarity: r.similarity,
  }));
}

/**
 * Find videos similar to the given video using average embedding similarity.
 * Excludes the video itself. Used for the "similar videos" sidebar.
 */
export async function findSimilarVideos(
  videoId: string,
  k = 5,
): Promise<SimilarVideo[]> {
  // Strategy: compare the average embedding of each other video
  // against the average embedding of the target video.
  const { rows } = await pool.query<{
    youtube_id: string;
    title: string;
    similarity: number;
  }>(
    `WITH target_avg AS (
       SELECT AVG(embedding) AS avg_emb
       FROM video_embeddings
       WHERE video_id = $1
     )
     SELECT v.youtube_id, v.title,
            1 - (AVG(ve.embedding) <=> (SELECT avg_emb FROM target_avg)) AS similarity
     FROM video_embeddings ve
     JOIN videos v ON v.id = ve.video_id
     WHERE ve.video_id != $1
       AND v.status = 'ready'
     GROUP BY v.id, v.youtube_id, v.title
     ORDER BY similarity DESC
     LIMIT $2`,
    [videoId, k],
  );

  return rows.map((r) => ({
    youtubeId: r.youtube_id,
    title: r.title,
    similarityScore: parseFloat(String(r.similarity)),
  }));
}
