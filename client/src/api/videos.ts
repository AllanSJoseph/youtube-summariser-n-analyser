import type { VideoResponse } from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'INTERNAL_ERROR', message: res.statusText } }));
    throw body;
  }
  return res.json() as Promise<T>;
}

/** Submit a YouTube URL for analysis. Returns 200 (cached) or 202 (processing). */
export async function submitVideo(url: string): Promise<VideoResponse> {
  const res = await fetch(`${BASE}/api/v1/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return handleResponse<VideoResponse>(res);
}

/** Poll a video's current status. */
export async function getVideo(videoId: string): Promise<VideoResponse> {
  const res = await fetch(`${BASE}/api/v1/videos/${videoId}`);
  return handleResponse<VideoResponse>(res);
}

/** Fetch similar videos by transcript-embedding similarity. */
export async function getSimilarVideos(videoId: string): Promise<{ similar: import('../types').SimilarVideo[] }> {
  const res = await fetch(`${BASE}/api/v1/videos/${videoId}/similar`);
  return handleResponse(res);
}
