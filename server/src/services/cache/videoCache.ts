import pool from '../../db/client';
import { VideoStatus, VideoStats } from '../../types';

export interface CachedVideo {
  id: string;
  youtubeId: string;
  title: string;
  channelId: string | null;
  channelTitle: string | null;
  transcript: string | null;
  hasCaptions: boolean;
  statsJson: VideoStats | null;
  summary: string | null;
  status: VideoStatus;
  cachedAt: Date;
}

/** Returns the cached video row, or null if not in DB yet. */
export async function getCachedVideo(youtubeId: string): Promise<CachedVideo | null> {
  const { rows } = await pool.query<{
    id: string;
    youtube_id: string;
    title: string;
    channel_id: string | null;
    channel_title: string | null;
    transcript: string | null;
    has_captions: boolean;
    stats_json: VideoStats | null;
    summary: string | null;
    status: VideoStatus;
    cached_at: Date;
  }>('SELECT * FROM videos WHERE youtube_id = $1 LIMIT 1', [youtubeId]);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    youtubeId: r.youtube_id,
    title: r.title,
    channelId: r.channel_id,
    channelTitle: r.channel_title,
    transcript: r.transcript,
    hasCaptions: r.has_captions,
    statsJson: r.stats_json,
    summary: r.summary,
    status: r.status,
    cachedAt: r.cached_at,
  };
}

/** Returns the video row by internal UUID, or null if not found. */
export async function getVideoById(id: string): Promise<CachedVideo | null> {
  const { rows } = await pool.query<{
    id: string;
    youtube_id: string;
    title: string;
    channel_id: string | null;
    channel_title: string | null;
    transcript: string | null;
    has_captions: boolean;
    stats_json: VideoStats | null;
    summary: string | null;
    status: VideoStatus;
    cached_at: Date;
  }>('SELECT * FROM videos WHERE id = $1 LIMIT 1', [id]);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    youtubeId: r.youtube_id,
    title: r.title,
    channelId: r.channel_id,
    channelTitle: r.channel_title,
    transcript: r.transcript,
    hasCaptions: r.has_captions,
    statsJson: r.stats_json,
    summary: r.summary,
    status: r.status,
    cachedAt: r.cached_at,
  };
}

export interface UpsertVideoInput {
  youtubeId: string;
  title: string;
  channelId?: string | null;
  channelTitle?: string | null;
  transcript?: string | null;
  hasCaptions?: boolean;
  statsJson?: VideoStats | null;
  summary?: string | null;
  status?: VideoStatus;
}

/** Insert or update a video row. Returns the internal UUID. */
export async function upsertVideo(input: UpsertVideoInput): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO videos
       (youtube_id, title, channel_id, channel_title, transcript,
        has_captions, stats_json, summary, status, cached_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (youtube_id) DO UPDATE SET
       title         = EXCLUDED.title,
       channel_id    = EXCLUDED.channel_id,
       channel_title = EXCLUDED.channel_title,
       transcript    = COALESCE(EXCLUDED.transcript, videos.transcript),
       has_captions  = EXCLUDED.has_captions,
       stats_json    = EXCLUDED.stats_json,
       summary       = COALESCE(EXCLUDED.summary, videos.summary),
       status        = EXCLUDED.status,
       cached_at     = now()
     RETURNING id`,
    [
      input.youtubeId,
      input.title,
      input.channelId ?? null,
      input.channelTitle ?? null,
      input.transcript ?? null,
      input.hasCaptions ?? true,
      input.statsJson ? JSON.stringify(input.statsJson) : null,
      input.summary ?? null,
      input.status ?? 'processing',
    ],
  );
  return rows[0].id;
}

/** Update only the status + summary columns (used after async job completes). */
export async function updateVideoStatus(
  id: string,
  status: VideoStatus,
  summary?: string | null,
): Promise<void> {
  await pool.query(
    `UPDATE videos SET status = $1, summary = COALESCE($2, summary) WHERE id = $3`,
    [status, summary ?? null, id],
  );
}
