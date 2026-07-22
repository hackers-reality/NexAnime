'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { AnimeFormat, AnimeStatus } from '@/types';
import styles from './AnimeCardHoverPreview.module.css';

const STATUS_OPTIONS = [
  { value: 'watching', label: 'Watching' },
  { value: 'finished', label: 'Completed' },
  { value: 'planning', label: 'Plan to Watch' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'rewatching', label: 'Rewatching' },
];

const STATUS_HEART: Record<string, string> = {
  watching: '♥',
  finished: '♥',
  planning: '♡',
  on_hold: '♥',
  dropped: '♥',
  rewatching: '♥',
};

export interface AnimeCardHoverPreviewProps {
  id: number;
  title: string;
  poster: string | null;
  banner?: string | null;
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
  poster,
  banner,
  synopsis,
  runtime,
  airDate,
  genres,
  format,
  status,
  score,
  side,
}: AnimeCardHoverPreviewProps) {
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const bannerUrl = banner || poster;

  // Fetch current watchlist status
  useEffect(() => {
    fetch(`/api/watchlist?anilistId=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.entry?.listStatus) {
          setCurrentStatus(data.entry.listStatus);
        }
      })
      .catch(() => {});
  }, [id]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const handleStatusSelect = (newStatus: string) => {
    fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anilistId: id,
        listStatus: newStatus,
        animeTitle: title,
      }),
    })
      .then(() => {
        setCurrentStatus(newStatus);
        setShowDropdown(false);
      })
      .catch(console.error);
  };

  const heartIcon = currentStatus ? (STATUS_HEART[currentStatus] || '♥') : '♡';
  const isFilled = !!currentStatus;

  return (
    <div
      className={`${styles.overlay} ${side === 'left' ? styles.left : styles.right}`}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {bannerUrl && (
        <div className={styles.bannerWrap}>
          <img src={bannerUrl} alt="" className={styles.bannerImage} aria-hidden="true" />
          <div className={styles.bannerFade} />
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.title}>{title}</div>

        <div className={styles.badges}>
          {format && (
            <span className={styles.badge}>
              {format.replace('_', ' ')}
            </span>
          )}
          {statusLabel && (
            <span className={`${styles.badge} ${status === 'RELEASING' ? styles.badgeAiring : ''}`}>
              {statusLabel}
            </span>
          )}
          {genres.slice(0, 3).map((g) => (
            <span key={g} className={styles.badge}>{g}</span>
          ))}
        </div>

        <div className={styles.scoreRow}>
          {score != null && score > 0 && (
            <>
              <span className={styles.star}>★</span>
              <span className={styles.scoreValue}>{score}%</span>
              <span className={styles.scoreSuffix}>rating</span>
            </>
          )}
          {runtime && (
            <span className={styles.metaSep}>·</span>
          )}
          {runtime && (
            <span className={styles.scoreSuffix}>{runtime}</span>
          )}
          {airDate && (
            <span className={styles.metaSep}>·</span>
          )}
          {airDate && (
            <span className={styles.scoreSuffix}>{airDate}</span>
          )}
        </div>

        {cleanSynopsis && (
          <div className={styles.synopsis}>{cleanSynopsis}</div>
        )}

        <div className={styles.actions}>
          <Link
            href={`/anime/${id}`}
            className={styles.watchBtn}
            onClick={(e) => e.stopPropagation()}
          >
            ▶ Watch now
          </Link>
          <div className={styles.heartWrap} ref={dropdownRef}>
            <button
              className={`${styles.bookmarkBtn} ${isFilled ? styles.bookmarkFilled : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              title={currentStatus ? `Status: ${STATUS_OPTIONS.find(s => s.value === currentStatus)?.label}` : 'Add to watchlist'}
            >
              {heartIcon}
            </button>
            {showDropdown && (
              <div className={styles.statusDropdown}>
                <div className={styles.statusDropdownTitle}>Add to List</div>
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`${styles.statusOption} ${currentStatus === opt.value ? styles.statusActive : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStatusSelect(opt.value);
                    }}
                  >
                    <span className={styles.statusDot} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
