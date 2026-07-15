import { TranscriptSegment } from '../youtube/transcriptFetcher';

export interface Chunk {
  text: string;
  startSeconds: number;
  index: number;
}

/**
 * Splits transcript segments into overlapping text chunks suitable for embedding.
 *
 * Strategy:
 * - Target ~500 characters per chunk (roughly 100-125 tokens for English text)
 * - 50-character overlap to avoid losing cross-boundary context
 * - Chunk start time is taken from the first segment included in the chunk
 */
const TARGET_CHARS = 500;
const OVERLAP_CHARS = 50;

export function chunkTranscript(segments: TranscriptSegment[]): Chunk[] {
  if (segments.length === 0) return [];

  const chunks: Chunk[] = [];
  let chunkText = '';
  let chunkStart = segments[0].startSeconds;
  let chunkIndex = 0;

  for (const segment of segments) {
    // Append segment text (with space separator)
    chunkText += (chunkText ? ' ' : '') + segment.text;

    if (chunkText.length >= TARGET_CHARS) {
      chunks.push({
        text: chunkText.trim(),
        startSeconds: chunkStart,
        index: chunkIndex++,
      });

      // Overlap: retain the last OVERLAP_CHARS characters as the start of the next chunk
      const overlapText = chunkText.slice(-OVERLAP_CHARS);
      chunkText = overlapText;
      chunkStart = segment.startSeconds;
    }
  }

  // Flush any remaining text as the last chunk
  if (chunkText.trim().length > 0) {
    chunks.push({
      text: chunkText.trim(),
      startSeconds: chunkStart,
      index: chunkIndex,
    });
  }

  return chunks;
}
