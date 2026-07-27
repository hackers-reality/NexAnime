'use client';

import Link from 'next/link';
import styles from './EpisodeGrid.module.css';

interface EpisodeGridProps {
  animeId: number;
  totalEpisodes: number | null;
  currentEpisode: number;
}

export default function EpisodeGrid({ animeId, totalEpisodes, currentEpisode }: EpisodeGridProps) {
  if (!totalEpisodes || totalEpisodes <= 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Episodes</h3>
        <p className={styles.count} style={{ opacity: 0.5 }}>Episode count not yet available</p>
        <div className={styles.grid} aria-label="Episode navigation">
          <Link
            href={`/watch/${animeId}/${currentEpisode}`}
            className={`${styles.episode} ${styles.current}`}
            aria-current="page"
            aria-label={`Episode ${currentEpisode} (currently playing)`}
          >
            {currentEpisode}
          </Link>
        </div>
      </div>
    );
  }

  const episodes = Array.from({ length: totalEpisodes }, (_, i) => i + 1);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        Episodes <span className={styles.count}>({totalEpisodes})</span>
      </h3>
      <nav className={styles.grid} aria-label="Episode navigation">
        {episodes.map((ep) => (
          <Link
            key={ep}
            href={`/watch/${animeId}/${ep}`}
            className={`${styles.episode} ${ep === currentEpisode ? styles.current : ''} ${ep < currentEpisode ? styles.watched : ''}`}
            aria-current={ep === currentEpisode ? 'page' : undefined}
            aria-label={`Episode ${ep}${ep === currentEpisode ? ' (currently playing)' : ''}${ep < currentEpisode ? ' (watched)' : ''}`}
          >
            {ep}
          </Link>
        ))}
      </nav>
    </div>
  );
}
