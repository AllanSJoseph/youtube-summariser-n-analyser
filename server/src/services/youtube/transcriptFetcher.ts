import { fetch, ProxyAgent } from 'undici';
import { AppError } from '../../middleware/errorHandler';

export interface TranscriptSegment {
  text: string;
  startSeconds: number;
}

export interface TranscriptResult {
  fullText: string;
  segments: TranscriptSegment[];
}

// Configure Proxy Agent if YOUTUBE_PROXY is provided in the environment
const proxyUrl = process.env.YOUTUBE_PROXY;
const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

if (proxyAgent) {
  console.info(`[YouTube Scraper] ProxyAgent initialized using YOUTUBE_PROXY.`);
}

// ---------------------------------------------------------------------------
// Browser-like headers — required to avoid YouTube bot-detection on server IPs
// ---------------------------------------------------------------------------
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
};

if (process.env.YOUTUBE_COOKIES) {
  BROWSER_HEADERS['Cookie'] = process.env.YOUTUBE_COOKIES;
}

// ---------------------------------------------------------------------------
// Step 1 — fetch the video page HTML and extract the caption track URL
// ---------------------------------------------------------------------------
async function getCaptionTrackUrl(youtubeId: string): Promise<string> {
  const pageUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  const res = await fetch(pageUrl, { 
    headers: BROWSER_HEADERS,
    dispatcher: proxyAgent,
  });

  if (!res.ok) {
    throw new AppError(
      'INTERNAL_ERROR',
      `YouTube page fetch failed: ${res.status} ${res.statusText}`,
      502,
    );
  }

  const html = await res.text();

  // YouTube embeds all player data in a ytInitialPlayerResponse JSON blob
  const match = html.match(/"captionTracks":\s*(\[.*?\])/s);
  if (!match) {
    // Log diagnostics to help troubleshoot bot detection or consent walls in production
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1] : 'Unknown Page';

    console.warn(
      `[YouTube Scraper] captionTracks regex mismatch on video ${youtubeId}. ` +
      `Page title was "${pageTitle}". HTML Snippet: ${html.slice(0, 300).replace(/\s+/g, ' ')}`
    );

    if (pageTitle.includes('Before you continue') || pageTitle.includes('Consent')) {
      throw new AppError(
        'INTERNAL_ERROR',
        `YouTube blocked transcript fetching with a Cookie Consent wall. Please configure YOUTUBE_COOKIES.`,
        502,
      );
    }

    // No captionTracks key in the page — captions are disabled or unavailable
    throw new AppError(
      'NO_CAPTIONS',
      `No captions found for video "${youtubeId}" (Page title: ${pageTitle}).`,
      422,
    );
  }

  let tracks: Array<{ baseUrl: string; languageCode: string; kind?: string }>;
  try {
    tracks = JSON.parse(match[1]);
  } catch {
    throw new AppError('NO_CAPTIONS', `Could not parse caption tracks for "${youtubeId}".`, 422);
  }

  if (!tracks || tracks.length === 0) {
    throw new AppError('NO_CAPTIONS', `No caption tracks for "${youtubeId}".`, 422);
  }

  // Prefer: English manual → English auto-generated → any auto → first available
  const pick =
    tracks.find((t) => t.languageCode === 'en' && !t.kind) ??
    tracks.find((t) => t.languageCode === 'en') ??
    tracks.find((t) => t.kind === 'asr') ??
    tracks[0];

  return pick.baseUrl;
}

// ---------------------------------------------------------------------------
// Step 2 — fetch the timedtext XML and parse segments
// ---------------------------------------------------------------------------
async function fetchTimedText(
  trackUrl: string,
): Promise<TranscriptSegment[]> {
  // Request plain text XML format (fmt=srv1 or fmt=json3; json3 is more reliable)
  const url = `${trackUrl}&fmt=json3`;
  const res = await fetch(url, { 
    headers: BROWSER_HEADERS,
    dispatcher: proxyAgent,
  });

  if (!res.ok) {
    throw new AppError('INTERNAL_ERROR', `Caption fetch failed: ${res.status}`, 502);
  }

  const data = (await res.json()) as {
    events?: Array<{
      tStartMs?: number;
      segs?: Array<{ utf8?: string }>;
    }>;
  };

  if (!data.events || data.events.length === 0) {
    throw new AppError('NO_CAPTIONS', 'Caption data is empty.', 422);
  }

  const segments: TranscriptSegment[] = [];

  for (const event of data.events) {
    if (!event.segs || event.tStartMs === undefined) continue;

    const text = event.segs
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/\n/g, ' ')
      .trim();

    if (!text || text === '\n') continue;

    segments.push({
      text,
      startSeconds: Math.round(event.tStartMs / 1000),
    });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function fetchTranscript(youtubeId: string): Promise<TranscriptResult> {
  let trackUrl: string;
  try {
    trackUrl = await getCaptionTrackUrl(youtubeId);
  } catch (err) {
    // Re-throw AppErrors (NO_CAPTIONS, INTERNAL_ERROR) as-is
    if (err instanceof AppError) throw err;
    throw new AppError('INTERNAL_ERROR', `Failed to reach YouTube: ${String(err)}`, 502);
  }

  let segments: TranscriptSegment[];
  try {
    segments = await fetchTimedText(trackUrl);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('INTERNAL_ERROR', `Failed to fetch caption track: ${String(err)}`, 502);
  }

  if (segments.length === 0) {
    throw new AppError('NO_CAPTIONS', `Transcript is empty for video "${youtubeId}".`, 422);
  }

  const fullText = segments.map((s) => s.text).join(' ');
  return { fullText, segments };
}
