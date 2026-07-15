import { useState } from 'react';
import styles from './VideoInput.module.css';

interface Props {
  onSubmit: (url: string) => void;
  loading: boolean;
}

function isValidYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (
      (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') &&
      parsed.pathname === '/watch' &&
      parsed.searchParams.has('v')
    ) return true;
    if (parsed.hostname === 'youtu.be' && parsed.pathname.length > 1) return true;
  } catch {
    return false;
  }
  return false;
}

export function VideoInput({ onSubmit, loading }: Props) {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!isValidYouTubeUrl(trimmed)) {
      setValidationError('Please enter a valid YouTube URL.');
      return;
    }
    setValidationError('');
    onSubmit(trimmed);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        type="url"
        placeholder="Paste a YouTube URL…"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setValidationError(''); }}
        disabled={loading}
        aria-label="YouTube URL"
        autoFocus
      />
      <button className={styles.button} type="submit" disabled={loading || !url.trim()}>
        {loading ? 'Analysing…' : 'Analyse'}
      </button>
      {validationError && <p className={styles.error}>{validationError}</p>}
    </form>
  );
}
