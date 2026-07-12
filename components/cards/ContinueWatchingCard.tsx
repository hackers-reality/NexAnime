'use client';

import Link from 'next/link';
import type { ContinueWatchingCardProps } from '@/types';
import styles from './ContinueWatchingCard.module.css';

export default function ContinueWatchingCard({
  anilistId,
  poster,
  title,
  subtitle,
  progressPercent,
  durationLabel,
}: ContinueWatchingCardProps) {
  return (
    <Link
      href={`/anime/${anilistId}`}
      className={styles.card}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      {/* Thumbnail */}
      <div className={styles.thumbnail}>
        {poster ? (
          <img
            src={poster}
            alt={title}
            className={styles.thumbnailImage}
            loading="lazy"
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-xs)',
          }}>
            No Image
          </div>
        )}

        {/* Duration badge */}
        {durationLabel && (
          <div className={styles.durationBadge}>{durationLabel}</div>
        )}

        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      </div>

      {/* Info */}
      <div className={styles.info}>
        <div className={styles.title}>{title}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
    </Link>
  );
}
