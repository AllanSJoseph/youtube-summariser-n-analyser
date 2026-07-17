import type { VideoResponse } from '../../types';
import styles from './SummaryPanel.module.css';

interface Props {
  video: VideoResponse;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function SummaryPanel({ video }: Props) {
  const { stats, status } = video;
  const isProcessing = status === 'processing';

  return (
    <section className={styles.panel}>
      <h1 className={styles.title}>{video.title}</h1>
      {video.channelTitle && (
        <p className={styles.channel}>{video.channelTitle}</p>
      )}

      {stats && (
        <div className={styles.stats}>
          <Stat label="Views" value={formatNumber(stats.views)} />
          <Stat label="Likes" value={formatNumber(stats.likes)} />
          <Stat label="Comments" value={formatNumber(stats.commentCount)} />
          <Stat label="Published" value={formatDate(stats.uploadDate)} />
        </div>
      )}

      {status === 'no_captions' && (
        <div className={styles.noCaption}>
          ⚠️ This video does not have captions — summary and Q&amp;A are unavailable.
        </div>
      )}

      {status === 'failed' && (
        <div className={styles.failed}>
          ❌ Analysis failed. Please try submitting the video again.
        </div>
      )}

      {isProcessing && (
        <div className={styles.skeleton}>
          <div className={styles.skeletonLine} />
          <div className={`${styles.skeletonLine} ${styles.short}`} />
          <div className={styles.skeletonLine} />
        </div>
      )}

      {video.summary && (
        <div className={styles.summary}>
          {video.summary.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
