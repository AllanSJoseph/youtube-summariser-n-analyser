import { google } from 'googleapis';
import { AppError } from '../../middleware/errorHandler';
import { VideoStats } from '../../types';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

export interface VideoMetadata {
  youtubeId: string;
  title: string;
  channelId: string | null;
  channelTitle: string | null;
  stats: VideoStats;
}

export async function fetchVideoMetadata(youtubeId: string): Promise<VideoMetadata> {
  let response;
  try {
    response = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: [youtubeId],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('quotaExceeded') || msg.includes('dailyLimitExceeded')) {
      throw new AppError('QUOTA_EXCEEDED', 'YouTube API quota exceeded.', 429);
    }
    throw new AppError('INTERNAL_ERROR', `YouTube API error: ${msg}`, 502);
  }

  const item = response.data.items?.[0];
  if (!item) {
    throw new AppError('NOT_FOUND', `No YouTube video found for id "${youtubeId}".`, 404);
  }

  const snippet = item.snippet!;
  const stats = item.statistics ?? {};

  return {
    youtubeId,
    title: snippet.title ?? 'Untitled',
    channelId: snippet.channelId ?? null,
    channelTitle: snippet.channelTitle ?? null,
    stats: {
      views: parseInt(stats.viewCount ?? '0', 10),
      likes: parseInt(stats.likeCount ?? '0', 10),
      commentCount: parseInt(stats.commentCount ?? '0', 10),
      uploadDate: snippet.publishedAt ?? '',
    },
  };
}
