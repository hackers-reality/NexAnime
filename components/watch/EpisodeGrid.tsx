'use client';

import Link from 'next/link';
import styles from './EpisodeGrid.module.css';

interface EpisodeGridProps {
  animeId: number;
  totalEpisodes: number | null;
  currentEpisode: number;
}

export default function EpisodeGrid({ animeId, totalEpisodes, currentEpisode }: EpisodeGridProps) {
  const maxEp = totalEpisodes || 25;
  const episodes = Array.from({ length: maxEp }, (_, i) => i + 1);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        Episodes <span className={styles.count}>({maxEp})</span>
      </h3>
      <div className={styles.grid}>
        {episodes.map((ep) => (
          <Link
            key={ep}
            href={`/watch/${animeId}/${ep}`}
            className={`${styles.episode} ${ep === currentEpisode ? styles.current : ''} ${ep < currentEpisode ? styles.watched : ''}`}
          >
            {ep}
          </Link>
        ))}
      </div>
    </div>
  );
}
