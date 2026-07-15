import { YoutubeTranscript } from 'youtube-transcript';
import { AppError } from '../../middleware/errorHandler';

export interface TranscriptSegment {
  text: string;
  startSeconds: number;
}

export interface TranscriptResult {
  fullText: string;
  segments: TranscriptSegment[];
}

export async function fetchTranscript(youtubeId: string): Promise<TranscriptResult> {
  let raw: Array<{ text: string; offset: number; duration: number }>;

  try {
    raw = await YoutubeTranscript.fetchTranscript(youtubeId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // youtube-transcript throws when captions are disabled / unavailable
    if (
      msg.toLowerCase().includes('disabled') ||
      msg.toLowerCase().includes('not available') ||
      msg.toLowerCase().includes('no transcript') ||
      msg.toLowerCase().includes('could not find')
    ) {
      throw new AppError(
        'NO_CAPTIONS',
        `No captions available for video "${youtubeId}".`,
        422,
      );
    }

    throw new AppError('INTERNAL_ERROR', `Transcript fetch error: ${msg}`, 502);
  }

  if (!raw || raw.length === 0) {
    throw new AppError(
      'NO_CAPTIONS',
      `Transcript is empty for video "${youtubeId}".`,
      422,
    );
  }

  const segments: TranscriptSegment[] = raw.map((item) => ({
    // offset is in milliseconds
    startSeconds: Math.round(item.offset / 1000),
    text: item.text,
  }));

  const fullText = segments.map((s) => s.text).join(' ');

  return { fullText, segments };
}
