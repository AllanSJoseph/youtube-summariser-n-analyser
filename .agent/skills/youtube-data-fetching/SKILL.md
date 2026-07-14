---
name: youtube-data-fetching
description: Use this skill whenever implementing or modifying code that fetches transcripts, metadata, or stats for a YouTube video.
---

# YouTube data fetching

## Two separate APIs, don't conflate them
- **YouTube Data API v3** gives metadata: title, channel, view/like/comment counts, upload date, description, chapters (if the creator set them). It does NOT give transcripts.
- **Transcripts** are not exposed through the official Data API. Use the `timedtext` endpoint / a transcript-scraping library (e.g. `youtube-transcript`-style packages), which relies on YouTube's caption track being available. This is a fragile point — endpoint behavior isn't officially documented or guaranteed stable.

## Caption availability
Not all videos have captions (auto-generated or creator-uploaded). Before doing anything else:
1. Attempt transcript fetch first — it's the higher-value data and the one more likely to fail
2. If no captions exist, mark the video `status: no_captions` and stop — MVP does not attempt Whisper transcription (see product spec, deferred to phase 2)
3. Never silently proceed with an empty transcript — downstream LLM calls will hallucinate content if given no grounding text

## Quota management
YouTube Data API has a daily quota (default 10,000 units/day). Costs per call type vary — `videos.list` is cheap, `search.list` is expensive. Rules to follow:
- Always check Postgres (`videos` table, `cached_at`) before calling the Data API — never re-fetch metadata for a video already cached within a reasonable window (e.g. 24h for stats, indefinite for transcript/title which rarely change)
- Batch metadata requests where possible (`videos.list` accepts up to 50 IDs per call) rather than one call per video
- Log quota errors distinctly (`QUOTA_EXCEEDED` error code from the API spec) so the frontend can show a clear message instead of a generic failure

## Chapter/timestamp handling
If a video has creator-defined chapters (in the description, formatted as timestamps), extract and use them to structure the summary instead of arbitrary transcript chunking — this produces a noticeably better summary than blind time-based or token-based chunking.