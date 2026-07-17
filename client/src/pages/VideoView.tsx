import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConversation } from '../hooks/useConversation';
import { SummaryPanel } from '../components/SummaryPanel/SummaryPanel';
import { ChatPanel } from '../components/ChatPanel/ChatPanel';
import { SimilarVideos } from '../components/SimilarVideos/SimilarVideos';
import { VideoInput } from '../components/VideoInput/VideoInput';
import { getVideo, submitVideo } from '../api/videos';
import type { VideoResponse } from '../types';
import styles from './VideoView.module.css';

export function VideoView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<YT.Player | null>(null);
  const iframeRef = useRef<HTMLDivElement>(null);

  const [video, setVideo] = useState<VideoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { messages, streaming, sendMessage } = useConversation(
    video?.videoId ?? null,
  );

  // Load video by internal UUID on mount; poll if still processing
  useEffect(() => {
    if (!id) return;
    let pollId: ReturnType<typeof setInterval> | null = null;

    setLoading(true);
    getVideo(id)
      .then((v) => {
        setVideo(v);
        if (v.status === 'processing') {
          pollId = setInterval(async () => {
            try {
              const updated = await getVideo(id);
              setVideo(updated);
              // Stop polling when terminal state is reached
              if (updated.status !== 'processing') {
                clearInterval(pollId!);
                pollId = null;
              }
            } catch {
              clearInterval(pollId!);
              pollId = null;
            }
          }, 3000);
        }
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));

    return () => {
      if (pollId) clearInterval(pollId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // YouTube IFrame Player API — initialise when we have a youtubeId
  useEffect(() => {
    if (!video?.youtubeId || !iframeRef.current) return;

    if (typeof window.YT !== 'undefined' && window.YT?.Player) {
      playerRef.current = new window.YT.Player(iframeRef.current, {
        videoId: video.youtubeId,
        playerVars: { modestbranding: 1, rel: 0 },
      });
    }
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [video?.youtubeId]);

  async function handleNewUrl(url: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await submitVideo(url);
      navigate(`/video/${result.videoId}`);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        'Failed to submit URL.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSimilarSelect(url: string) {
    void handleNewUrl(url);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.logo} onClick={() => navigate('/')} type="button">
          ▶ YT Analyser
        </button>
        <div className={styles.inputWrap}>
          <VideoInput onSubmit={handleNewUrl} loading={loading} />
        </div>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {video && (
        <div className={styles.layout}>
          <main className={styles.main}>
            {/* YouTube embed */}
            <div className={styles.playerWrap}>
              <div ref={iframeRef} className={styles.player} />
            </div>

            <SummaryPanel video={video} />
            <ChatPanel
              messages={messages}
              streaming={streaming}
              disabled={video.status !== 'ready'}
              playerRef={playerRef}
              onSend={sendMessage}
            />
          </main>

          {video.status === 'ready' && (
            <aside className={styles.sidebar}>
              <SimilarVideos videoId={video.videoId} onSelect={handleSimilarSelect} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
