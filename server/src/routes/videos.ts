import { Router, Request, Response, NextFunction } from 'express';
import { fetchVideoMetadata } from '../services/youtube/metadataFetcher';
import { fetchTranscript } from '../services/youtube/transcriptFetcher';
import {
  getCachedVideo,
  getVideoById,
  upsertVideo,
  updateVideoStatus,
} from '../services/cache/videoCache';
import { chunkTranscript } from '../services/embeddings/chunker';
import { storeEmbeddings, findSimilarVideos } from '../services/embeddings/retrieval';
import { getLLMProvider } from '../services/llm/getLLMProvider';
import { AppError } from '../middleware/errorHandler';
import { VideoResponse } from '../types';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the YouTube video ID from a variety of URL formats. */
function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Standard: youtube.com/watch?v=ID
    if (
      (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') &&
      parsed.pathname === '/watch'
    ) {
      return parsed.searchParams.get('v');
    }
    // Short: youtu.be/ID
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1) || null;
    }
    // Embed: youtube.com/embed/ID
    const embedMatch = parsed.pathname.match(/^\/embed\/([^/?#]+)/);
    if (embedMatch) return embedMatch[1];
  } catch {
    // invalid URL
  }
  return null;
}

function toVideoResponse(v: Awaited<ReturnType<typeof getVideoById>>): VideoResponse {
  if (!v) throw new AppError('NOT_FOUND', 'Video not found.', 404);
  return {
    videoId: v.id,
    youtubeId: v.youtubeId,
    status: v.status,
    title: v.title,
    channelTitle: v.channelTitle,
    summary: v.summary,
    stats: v.statsJson,
    hasCaptions: v.hasCaptions,
  };
}

/**
 * Runs all heavy async work (transcript fetch → embed → summary) in the background
 * after the HTTP response has already been sent with status:"processing".
 */
async function processVideoInBackground(videoId: string, youtubeId: string) {
  try {
    const llm = getLLMProvider();

    // 1. Fetch transcript
    const transcriptResult = await fetchTranscript(youtubeId);

    // 2. Update DB with transcript
    await upsertVideo({
      youtubeId,
      title: '', // title already set — COALESCE keeps existing
      transcript: transcriptResult.fullText,
      hasCaptions: true,
    });

    // 3. Generate summary
    const { text: summary } = await llm.generateSummary(transcriptResult.fullText);

    // 4. Chunk + embed
    const chunks = chunkTranscript(transcriptResult.segments);
    await storeEmbeddings(videoId, chunks);

    // 5. Mark ready
    await updateVideoStatus(videoId, 'ready', summary);
  } catch (err) {
    if (err instanceof AppError && err.code === 'NO_CAPTIONS') {
      await updateVideoStatus(videoId, 'no_captions');
    } else {
      console.error(`Background processing failed for video ${videoId}:`, err);
      // Leave as 'processing' so the client can retry later
    }
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/videos — submit a YouTube URL
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== 'string') {
      throw new AppError('INVALID_URL', 'Request body must contain a "url" field.', 400);
    }

    const youtubeId = extractYoutubeId(url.trim());
    if (!youtubeId) {
      throw new AppError('INVALID_URL', `"${url}" is not a valid YouTube URL.`, 400);
    }

    // Cache-first check
    const cached = await getCachedVideo(youtubeId);
    if (cached) {
      const statusCode = cached.status === 'processing' ? 202 : 200;
      res.status(statusCode).json(toVideoResponse(cached));
      return;
    }

    // Fetch metadata immediately (fast, required for title)
    const metadata = await fetchVideoMetadata(youtubeId);

    // Insert with status=processing so the frontend can start polling
    const videoId = await upsertVideo({
      youtubeId,
      title: metadata.title,
      channelId: metadata.channelId,
      channelTitle: metadata.channelTitle,
      statsJson: metadata.stats,
      status: 'processing',
    });

    // Fire-and-forget the heavy work
    processVideoInBackground(videoId, youtubeId).catch(console.error);

    const newVideo = await getVideoById(videoId);
    res.status(202).json(toVideoResponse(newVideo));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/videos/:id — poll for video status
// ---------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const video = await getVideoById(String(req.params.id));
    if (!video) throw new AppError('NOT_FOUND', 'Video not found.', 404);
    res.json(toVideoResponse(video));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/videos/:id/similar — similar videos by embedding similarity
// ---------------------------------------------------------------------------
router.get('/:id/similar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const video = await getVideoById(String(req.params.id));
    if (!video) throw new AppError('NOT_FOUND', 'Video not found.', 404);

    const similar = await findSimilarVideos(video.id);
    res.json({ similar });
  } catch (err) {
    next(err);
  }
});

export default router;
