import { useState, useEffect, useRef, useCallback } from 'react';
import { submitVideo, getVideo } from '../api/videos';
import type { VideoResponse } from '../types';

const POLL_INTERVAL_MS = 3000;

interface UseVideoAnalysisResult {
  video: VideoResponse | null;
  loading: boolean;
  error: string | null;
  submit: (url: string) => void;
}

export function useVideoAnalysis(): UseVideoAnalysisResult {
  const [video, setVideo] = useState<VideoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (videoId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const updated = await getVideo(videoId);
          setVideo(updated);
          if (updated.status !== 'processing') {
            stopPolling();
          }
        } catch {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const submit = useCallback(
    async (url: string) => {
      stopPolling();
      setLoading(true);
      setError(null);
      setVideo(null);

      try {
        const result = await submitVideo(url);
        setVideo(result);

        if (result.status === 'processing') {
          startPolling(result.videoId);
        }
      } catch (err: unknown) {
        const msg =
          (err as { error?: { message?: string } })?.error?.message ??
          'Something went wrong. Please try again.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [startPolling, stopPolling],
  );

  return { video, loading, error, submit };
}
