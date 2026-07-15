import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoInput } from '../components/VideoInput/VideoInput';
import { submitVideo } from '../api/videos';
import styles from './Home.module.css';

export function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(url: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await submitVideo(url);
      navigate(`/video/${result.videoId}`);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.title}>YouTube Summariser &amp; Analyser</h1>
        <p className={styles.subtitle}>
          Paste a YouTube link to get an AI summary, transcript-grounded Q&amp;A,
          and similar video recommendations.
        </p>
        <VideoInput onSubmit={handleSubmit} loading={loading} />
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}
