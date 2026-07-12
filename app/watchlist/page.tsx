'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/shared/Header';
import AnimeCard from '@/components/cards/AnimeCard';
import styles from './page.module.css';
import type { ListStatus } from '@/types';

interface WatchlistEntry {
  id: number;
  anilistId: number;
  listStatus: ListStatus;
  score: number | null;
  episodeWatched: number;
  anime: {
    title: { romaji: string; english: string; native: string };
    coverImage: { extraLarge: string };
    format: string;
    episodes: number;
    seasonYear: number;
    averageScore: number;
    status: string;
  };
}

const CATEGORIES: { status: ListStatus; label: string; icon: string }[] = [
  { status: 'watching', label: 'Watching', icon: '▶' },
  { status: 'planning', label: 'Plan to Watch', icon: '📋' },
  { status: 'finished', label: 'Completed', icon: '✓' },
  { status: 'on_hold', label: 'On Hold', icon: '⏸' },
  { status: 'dropped', label: 'Dropped', icon: '🗑' },
  { status: 'rewatching', label: 'Rewatching', icon: '🔄' },
];

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all'); // 'all' or specific status
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/watchlist')
      .then((res) => res.json())
      .then((data) => {
        if (data.entries) {
          setEntries(data.entries);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load watchlist:', err);
        setLoading(false);
      });
  }, []);

  // Filter entries by activeTab and searchQuery
  const filteredEntries = entries.filter((entry) => {
    const statusMatch = activeTab === 'all' || entry.listStatus === activeTab;
    const title = (entry.anime?.title?.english || entry.anime?.title?.romaji || '').toLowerCase();
    const queryMatch = !searchQuery || title.includes(searchQuery.toLowerCase());
    return statusMatch && queryMatch;
  });

  // Calculate counts for categories sidebar
  const getCategoryCount = (status: string) => {
    if (status === 'all') return entries.length;
    return entries.filter((e) => e.listStatus === status).length;
  };

  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.wrapper}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Search watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <h3 className={styles.sidebarTitle}>Lists</h3>
          <nav className={styles.nav}>
            <button
              className={`${styles.navItem} ${activeTab === 'all' ? styles.activeNavItem : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span>📂 All Anime</span>
              <span className={styles.badge}>{getCategoryCount('all')}</span>
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.status}
                className={`${styles.navItem} ${activeTab === cat.status ? styles.activeNavItem : ''}`}
                onClick={() => setActiveTab(cat.status)}
              >
                <span>{cat.icon} {cat.label}</span>
                <span className={styles.badge}>{getCategoryCount(cat.status)}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className={styles.mainContent}>
          {loading ? (
            <div className={styles.loading}>Loading watchlist...</div>
          ) : filteredEntries.length === 0 ? (
            <div className={styles.emptyState}>Your watchlist is empty.</div>
          ) : activeTab === 'all' ? (
            // Group by Status in Categories rows
            <div className={styles.categoriesList}>
              {CATEGORIES.map((cat) => {
                const catEntries = filteredEntries.filter((e) => e.listStatus === cat.status);
                if (catEntries.length === 0) return null;

                return (
                  <section key={cat.status} className={styles.categoryRow}>
                    <h3 className={styles.categoryHeader}>
                      {cat.icon} {cat.label} ({catEntries.length})
                    </h3>
                    <div className={styles.horizontalScroll}>
                      {catEntries.map((entry) => (
                        <div key={entry.id} className={styles.cardContainer}>
                          <AnimeCard
                            id={entry.anilistId}
                            poster={entry.anime?.coverImage?.extraLarge || null}
                            title={entry.anime?.title?.romaji || entry.anime?.title?.english || 'Unknown'}
                            format={entry.anime?.format as any}
                            year={entry.anime?.seasonYear || null}
                            score={entry.score || entry.anime?.averageScore}
                            status={entry.anime?.status as any}
                          />
                          <div className={styles.progressLabel}>
                            Progress: {entry.episodeWatched} / {entry.anime?.episodes || '?'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            // Single Grid of Active Category
            <div className={styles.singleGridSection}>
              <h3 className={styles.gridHeader}>
                {CATEGORIES.find((c) => c.status === activeTab)?.label} ({filteredEntries.length})
              </h3>
              <div className={styles.grid}>
                {filteredEntries.map((entry) => (
                  <div key={entry.id} className={styles.gridCardContainer}>
                    <AnimeCard
                      id={entry.anilistId}
                      poster={entry.anime?.coverImage?.extraLarge || null}
                      title={entry.anime?.title?.romaji || entry.anime?.title?.english || 'Unknown'}
                      format={entry.anime?.format as any}
                      year={entry.anime?.seasonYear || null}
                      score={entry.score || entry.anime?.averageScore}
                      status={entry.anime?.status as any}
                    />
                    <div className={styles.progressLabel}>
                      Progress: {entry.episodeWatched} / {entry.anime?.episodes || '?'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
