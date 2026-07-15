import type { Citation } from '../../types';
import styles from './CitationBadge.module.css';

interface Props {
  citation: Citation;
  playerRef?: React.RefObject<YT.Player | null>;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CitationBadge({ citation, playerRef }: Props) {
  function handleClick() {
    if (playerRef?.current) {
      playerRef.current.seekTo(citation.timestampSeconds, true);
    }
  }

  return (
    <button
      className={styles.badge}
      onClick={handleClick}
      title={`Jump to ${formatTime(citation.timestampSeconds)}`}
      type="button"
    >
      ▶ {formatTime(citation.timestampSeconds)}
    </button>
  );
}
