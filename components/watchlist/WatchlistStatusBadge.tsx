'use client';

import { useState, useRef, useEffect } from 'react';
import type { ListStatus } from '@/types';
import styles from './WatchlistStatusBadge.module.css';

interface WatchlistStatusBadgeProps {
  entryId: number;
  anilistId: number;
  animeTitle: string;
  currentStatus: ListStatus;
  onStatusUpdated?: () => void;
}

const STATUS_LABELS: Record<ListStatus, string> = {
  planning: 'Plan to Watch',
  watching: 'Watching',
  on_hold: 'On Hold',
  dropped: 'Dropped',
  finished: 'Completed',
  rewatching: 'Rewatching',
};

const STATUS_ICONS: Record<ListStatus, string> = {
  planning: '📋',
  watching: '▶',
  on_hold: '⏸',
  dropped: '🗑',
  finished: '✓',
  rewatching: '🔄',
};

export default function WatchlistStatusBadge({
  entryId,
  anilistId,
  animeTitle,
  currentStatus,
  onStatusUpdated,
}: WatchlistStatusBadgeProps) {
  const [status, setStatus] = useState(currentStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusChange = async (newStatus: ListStatus) => {
    setIsOpen(false);
    if (newStatus === status) return;
    setLoading(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anilistId, animeTitle, listStatus: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        onStatusUpdated?.();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={`${styles.badge} ${styles[status]}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        title={`Status: ${STATUS_LABELS[status]}`}
      >
        <span className={styles.badgeIcon}>{STATUS_ICONS[status]}</span>
        <span className={styles.badgeLabel}>{STATUS_LABELS[status]}</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {(Object.keys(STATUS_LABELS) as ListStatus[]).map((s) => (
            <button
              key={s}
              className={`${styles.item} ${status === s ? styles.itemActive : ''}`}
              onClick={() => handleStatusChange(s)}
            >
              <span>{STATUS_ICONS[s]}</span>
              <span>{STATUS_LABELS[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
