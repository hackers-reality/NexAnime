'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import type { AnimeFormat, AnimeStatus } from '@/types';
import AnimeCardHoverPreview from './AnimeCardHoverPreview';
import styles from './StackedAnimeCard.module.css';

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  RELEASING: { dot: 'var(--accent-airing)', label: 'Airing' },
  FINISHED: { dot: 'var(--accent-finished)', label: 'Finished' },
  NOT_YET_RELEASED: { dot: 'var(--primary)', label: 'Upcoming' },
  CANCELLED: { dot: 'var(--accent-cancelled)', label: 'Cancelled' },
  HIATUS: { dot: 'var(--accent-hiatus)', label: 'Hiatus' },
};

export interface StackedAnimeCardProps {
  id: number;
  poster: string | null;
  title: string;
  format?: AnimeFormat | null;
  year?: number | null;
  status?: AnimeStatus | null;
  score?: number | null;
  synopsis?: string | null;
  genres?: string[];
}

export default function StackedAnimeCard({
  id,
  poster,
  title,
  format,
  year,
  status,
  score,
  synopsis,
  genres,
}: StackedAnimeCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewSide, setPreviewSide] = useState<'left' | 'right'>('right');
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

  const statusInfo = status ? STATUS_CONFIG[status] : null;

  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const viewportCenter = window.innerWidth / 2;
      setPreviewSide(rect.left > viewportCenter ? 'left' : 'right');
    }
    hoverTimeout.current = setTimeout(() => setShowPreview(true), 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setShowPreview(false);
  };

  return (
    <div
      ref={cardRef}
      className={styles.card}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative' }}
    >
      <Link href={`/anime/${id}`} className={styles.link}>
        <div className={styles.thumb}>
          {poster ? (
            <img
              src={poster}
              alt={title}
              className={styles.thumbImg}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }}
            />
          ) : (
            <div className={styles.noImage}>No Image</div>
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.title}>{title}</div>
          <div className={styles.meta}>
            {format && <span className={styles.format}>{format.replace('_', ' ')}</span>}
            {year && <span>{year}</span>}
            {score != null && score > 0 && (
              <span className={styles.score}>★ {score}%</span>
            )}
          </div>
          {statusInfo && (
            <div className={styles.status}>
              <span className={styles.statusDot} style={{ backgroundColor: statusInfo.dot }} />
              <span style={{ color: statusInfo.dot }}>{statusInfo.label}</span>
            </div>
          )}
        </div>
      </Link>

      {showPreview && synopsis && (
        <AnimeCardHoverPreview
          id={id}
          title={title}
          poster={poster}
          synopsis={synopsis}
          runtime={null}
          airDate={null}
          genres={genres ?? []}
          format={format ?? null}
          status={status ?? null}
          score={score ?? null}
          side={previewSide}
        />
      )}
    </div>
  );
}
