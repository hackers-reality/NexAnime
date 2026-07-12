'use client';

import Link from 'next/link';
import styles from './UpcomingCard.module.css';

export interface UpcomingCardProps {
  id: number;
  cover: string | null;
  airDate: string | null;
  sourceBadge: string | null;
  synopsis: string | null;
  genres: string[];
  studio: string | null;
  title: string;
}

export default function UpcomingCard({
  id,
  cover,
  airDate,
  sourceBadge,
  synopsis,
  genres,
  studio,
  title,
}: UpcomingCardProps) {
  const cleanSynopsis = synopsis
    ? synopsis.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim()
    : null;

  return (
    <Link
      href={`/anime/${id}`}
      className={styles.card}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      {/* Cover image */}
      <div className={styles.coverWrap}>
        {cover ? (
          <img src={cover} alt={title} className={styles.coverImage} loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder}>No Image</div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>

        {/* Air date */}
        {airDate && (
          <div className={styles.airDate}>
            Ep 1 airing in {airDate}
          </div>
        )}

        {/* Source badge */}
        {sourceBadge && (
          <span className={styles.sourceBadge}>
            {sourceBadge.replace('_', ' ')}
          </span>
        )}

        {/* Synopsis */}
        {cleanSynopsis && (
          <div className={styles.synopsis}>{cleanSynopsis}</div>
        )}

        {/* Genres + Studio */}
        <div className={styles.footer}>
          <div className={styles.genres}>
            {genres.slice(0, 4).map((g) => (
              <span key={g} className={styles.genrePill}>{g}</span>
            ))}
          </div>
          {studio && <span className={styles.studio}>{studio}</span>}
        </div>
      </div>
    </Link>
  );
}
