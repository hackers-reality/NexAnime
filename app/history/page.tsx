'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/shared/Header';
import EmptyState from '@/components/ui/EmptyState';
import styles from './page.module.css';

interface HistoryItem {
  anilist_id: number;
  episode_number: number;
  seconds_watched: number;
  duration_seconds: number;
  last_watched_at: string;
  title_romaji: string | null;
  title_english: string | null;
  cover_image: string | null;
  ep_thumbnail: string | null;
  format: string | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + 'Z').getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export default function WatchHistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/watchlist?continue=true')
      .then((r) => r.json())
      .then((data) => {
        // Continue watching endpoint returns partial progress; let's fetch full history
        return fetch('/api/progress/history').then((r) => r.ok ? r.json() : data);
      })
      .then((data) => {
        setHistory(data.progress || data.entries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.page}>
        <h1 className={styles.title}>Watch History</h1>
        <p className={styles.subtitle}>Recently watched episodes</p>

        {loading ? (
          <div className={styles.loading}>Loading history...</div>
        ) : history.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No watch history yet"
            description="Start watching anime and your progress will appear here."
            action={{ label: "Browse Anime", href: "/browse" }}
          />
        ) : (
          <div className={styles.list}>
            {history.map((item, i) => {
              const title = item.title_english || item.title_romaji || 'Unknown';
              const watched = item.duration_seconds > 0 ? Math.round((item.seconds_watched / item.duration_seconds) * 100) : 0;
              return (
                <Link
                  key={`${item.anilist_id}-${item.episode_number}-${i}`}
                  href={`/watch/${item.anilist_id}/${item.episode_number}`}
                  className={styles.card}
                >
                  <div className={styles.cardImage}>
                    <img
                      src={item.ep_thumbnail || item.cover_image || '/logo.svg'}
                      alt={title}
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                    />
                    <div className={styles.epBadge}>EP {item.episode_number}</div>
                  </div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardTitle}>{title}</div>
                    <div className={styles.cardMeta}>
                      {item.format && <span className={styles.format}>{item.format.replace('_', ' ')}</span>}
                      {item.seconds_watched > 0 ? (
                        <span>{formatDuration(item.seconds_watched)} watched</span>
                      ) : (
                        <span>Ep {item.episode_number}</span>
                      )}
                      <span className={styles.timeAgo}>{timeAgo(item.last_watched_at)}</span>
                    </div>
                    {item.duration_seconds > 0 && (
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${Math.min(watched, 100)}%` }} />
                      </div>
                    )}
                    {item.duration_seconds > 0 && (
                      <div className={styles.progressLabel}>{watched}% watched</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
