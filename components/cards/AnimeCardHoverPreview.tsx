'use client';

import Link from 'next/link';
import type { AnimeFormat, AnimeStatus } from '@/types';
import styles from './AnimeCardHoverPreview.module.css';

export interface AnimeCardHoverPreviewProps {
  id: number;
  title: string;
  synopsis: string | null;
  runtime: string | null;
  airDate: string | null;
  genres: string[];
  format: AnimeFormat | null;
  status: AnimeStatus | null;
  score: number | null;
  side: 'left' | 'right';
}

export default function AnimeCardHoverPreview({
  id,
  title,
  synopsis,
  runtime,
  airDate,
  genres,
  format,
  status,
  score,
  side,
}: AnimeCardHoverPreviewProps) {
  // Clean HTML tags from AniList synopsis
  const cleanSynopsis = synopsis
    ? synopsis.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim()
    : null;

  const statusLabel = status
    ? {
        RELEASING: 'Airing',
        FINISHED: 'Finished',
        NOT_YET_RELEASED: 'Upcoming',
        CANCELLED: 'Cancelled',
        HIATUS: 'Hiatus',
      }[status] ?? status
    : null;

  return (
    <div
      className={`${styles.overlay} ${side === 'left' ? styles.left : styles.right}`}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>

        {/* Badges */}
        <div className={styles.badges}>
          {format && (
            <span className={styles.badge}>
              {format.replace('_', ' ')}
            </span>
          )}
          {statusLabel && (
            <span className={`${styles.badge} ${status === 'RELEASING' ? styles.badgePrimary : ''}`}>
              {statusLabel}
            </span>
          )}
          {runtime && (
            <span className={styles.badge}>
              {runtime}
            </span>
          )}
          {airDate && (
            <span className={styles.badge}>
              {airDate}
            </span>
          )}
        </div>

        {/* Score */}
        {score != null && score > 0 && (
          <div className={styles.scoreRow}>
            <span className={styles.star}>★</span>
            <span className={styles.scoreValue}>{score}%</span>
            <span className={styles.scoreSuffix}>rating</span>
          </div>
        )}
      </div>

      {/* Synopsis */}
      {cleanSynopsis && (
        <div className={styles.synopsis}>{cleanSynopsis}</div>
      )}

      {/* Genres */}
      {genres.length > 0 && (
        <div className={styles.genres}>
          {genres.slice(0, 5).map((genre) => (
            <span key={genre} className={styles.genrePill}>
              {genre}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <Link
          href={`/anime/${id}`}
          className={styles.watchBtn}
          onClick={(e) => e.stopPropagation()}
        >
          ▶ Watch now
        </Link>
        <button
          className={styles.bookmarkBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Bookmark action will be wired in Phase 4
          }}
          title="Add to watchlist"
        >
          ♡
        </button>
      </div>
    </div>
  );
}
