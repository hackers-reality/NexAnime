'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import type { AnimeCardProps, AnimeStatus } from '@/types';
import AnimeCardHoverPreview from './AnimeCardHoverPreview';
import styles from './AnimeCard.module.css';

// Status display config — fully self-contained, no external deps
const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  RELEASING: { dot: 'var(--accent-airing)', label: 'Airing' },
  FINISHED: { dot: 'var(--accent-finished)', label: 'Finished' },
  NOT_YET_RELEASED: { dot: 'var(--primary)', label: 'Upcoming' },
  CANCELLED: { dot: 'var(--accent-cancelled)', label: 'Cancelled' },
  HIATUS: { dot: 'var(--accent-hiatus)', label: 'Hiatus' },
};

// Props for the hover preview (optional — passed through when available)
export interface AnimeCardWithPreviewProps extends AnimeCardProps {
  synopsis?: string | null;
  banner?: string | null;
  runtime?: string | null;
  airDate?: string | null;
  genres?: string[];
  formatLabel?: string | null;
  statusLabel?: string | null;
  rating?: string | null;
  subbed?: number | null;
  dubbed?: number | null;
}

export default function AnimeCard({
  id,
  poster,
  title,
  format,
  year,
  status,
  score,
  synopsis,
  banner,
  runtime,
  airDate,
  genres,
  rating,
  subbed,
  dubbed,
}: AnimeCardWithPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewSide, setPreviewSide] = useState<'left' | 'right'>('right');
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

  const statusInfo = status ? STATUS_CONFIG[status] : null;

  const handleMouseEnter = () => {
    // Determine which side to show preview based on card position
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
      <Link href={`/anime/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        {/* Poster */}
        <div className={styles.poster}>
          {poster ? (
            <img
              src={poster}
              alt={title}
              className={styles.posterImage}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }}
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

          {/* Score badge */}
          {score != null && score > 0 && (
            <div className={styles.scoreBadge}>
              <span className={styles.starIcon}>★</span>
              {score}%
            </div>
          )}

          {/* Status indicator */}
          {statusInfo && (
            <div className={styles.statusIndicator}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: statusInfo.dot,
                  display: 'inline-block',
                }}
              />
              <span style={{ color: statusInfo.dot }}>{statusInfo.label}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className={styles.info}>
          <div className={styles.title}>{title}</div>
          <div className={styles.meta}>
            {format && <span className={styles.format}>{format.replace('_', ' ')}</span>}
            {format && year && <span className={styles.dot} />}
            {year && <span>{year}</span>}
            {rating && <><span className={styles.dot} /><span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{rating}</span></>}
          </div>
          {(subbed || dubbed) && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {subbed ? `${subbed} Sub` : ''}
              {subbed && dubbed ? ' · ' : ''}
              {dubbed ? `${dubbed} Dub` : ''}
            </div>
          )}
        </div>
      </Link>

      {/* Hover Preview */}
      {showPreview && synopsis && (
        <AnimeCardHoverPreview
          id={id}
          title={title}
          poster={poster}
          banner={banner}
          synopsis={synopsis}
          runtime={runtime ?? null}
          airDate={airDate ?? null}
          genres={genres ?? []}
          format={format}
          status={status}
          score={score}
          side={previewSide}
        />
      )}
    </div>
  );
}
