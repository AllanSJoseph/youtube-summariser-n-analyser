import { useEffect, useState } from 'react';
import { getSimilarVideos } from '../../api/videos';
import type { SimilarVideo } from '../../types';
import styles from './SimilarVideos.module.css';

interface Props {
  videoId: string;
  onSelect: (url: string) => void;
}

export function SimilarVideos({ videoId, onSelect }: Props) {
  const [videos, setVideos] = useState<SimilarVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSimilarVideos(videoId)
      .then(({ similar }) => setVideos(similar))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, [videoId]);

  if (loading) {
    return (
      <aside className={styles.aside}>
        <h3 className={styles.heading}>Similar Videos</h3>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </aside>
    );
  }

  if (videos.length === 0) return null;

  return (
    <aside className={styles.aside}>
      <h3 className={styles.heading}>Similar Videos</h3>
      <ul className={styles.list}>
        {videos.map((v) => (
          <li key={v.youtubeId}>
            <button
              className={styles.card}
              onClick={() => onSelect(`https://www.youtube.com/watch?v=${v.youtubeId}`)}
              type="button"
            >
              <img
                className={styles.thumb}
                src={`https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`}
                alt={v.title}
                loading="lazy"
              />
              <div className={styles.info}>
                <span className={styles.cardTitle}>{v.title}</span>
                <span className={styles.score}>
                  {Math.round(v.similarityScore * 100)}% match
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
