'use client';

import { useState, useEffect, useRef } from 'react';
import type { ListStatus } from '@/types';
import styles from './StatusDropdownButton.module.css';

interface StatusDropdownButtonProps {
  animeId: number;
  animeTitle: string;
  onOpenEditor: () => void;
  onStatusUpdated?: () => void;
  isAiring?: boolean;
}

const STATUS_LABELS: Record<ListStatus, string> = {
  planning: 'Plan to Watch',
  watching: 'Watching',
  on_hold: 'On Hold',
  dropped: 'Dropped',
  finished: 'Completed',
  rewatching: 'Rewatching',
};

export default function StatusDropdownButton({
  animeId,
  animeTitle,
  onOpenEditor,
  onStatusUpdated,
  isAiring,
}: StatusDropdownButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ListStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/watchlist?anilistId=${animeId}`);
      const data = await res.json();
      if (data.entry) {
        setStatus(data.entry.listStatus);
      } else {
        setStatus(null);
      }
    } catch (err) {
      console.error('Failed to fetch watchlist status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [animeId]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusSelect = async (newStatus: ListStatus) => {
    setIsOpen(false);
    setLoading(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anilistId: animeId,
          animeTitle,
          listStatus: newStatus,
        }),
      });

      if (res.ok) {
        setStatus(newStatus);
        onStatusUpdated?.();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist?anilistId=${animeId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setStatus(null);
        onStatusUpdated?.();
      }
    } catch (err) {
      console.error('Failed to remove from watchlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const label = loading
    ? 'Loading...'
    : status
    ? STATUS_LABELS[status]
    : 'Add to Watchlist';

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <button
        className={`${styles.triggerBtn} ${status ? styles.triggerBtnActive : ''} ${isAiring ? styles.airingStyle : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
      >
        <span>{status ? '✓' : '♡'}</span>
        <span>{label}</span>
        <span className={styles.dropdownChevron}>▼</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <button
            className={`${styles.item} ${status === 'planning' ? styles.itemActive : ''}`}
            onClick={() => handleStatusSelect('planning')}
          >
            <span className={styles.itemIcon}>📋</span>
            <span>Plan to watch</span>
          </button>
          <button
            className={`${styles.item} ${status === 'watching' ? styles.itemActive : ''}`}
            onClick={() => handleStatusSelect('watching')}
          >
            <span className={styles.itemIcon}>▶</span>
            <span>Watching</span>
          </button>
          <button
            className={`${styles.item} ${status === 'finished' ? styles.itemActive : ''}`}
            onClick={() => handleStatusSelect('finished')}
          >
            <span className={styles.itemIcon}>✓</span>
            <span>Completed</span>
          </button>
          <button
            className={`${styles.item} ${status === 'on_hold' ? styles.itemActive : ''}`}
            onClick={() => handleStatusSelect('on_hold')}
          >
            <span className={styles.itemIcon}>⏸</span>
            <span>On Hold</span>
          </button>
          <button
            className={`${styles.item} ${status === 'dropped' ? styles.itemActive : ''}`}
            onClick={() => handleStatusSelect('dropped')}
          >
            <span className={styles.itemIcon}>🗑</span>
            <span>Dropped</span>
          </button>

          {status && (
            <button className={styles.item} onClick={handleRemove}>
              <span className={styles.itemIcon}>✖</span>
              <span>Remove</span>
            </button>
          )}

          <div className={styles.divider} />

          <button
            className={`${styles.item} ${styles.editorItem}`}
            onClick={() => {
              setIsOpen(false);
              onOpenEditor();
            }}
          >
            <span className={styles.itemIcon}>📝</span>
            <span>Open editor</span>
          </button>
        </div>
      )}
    </div>
  );
}
