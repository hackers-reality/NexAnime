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
    synopsis: string | null;
    genres: string[];
  };
}

const CATEGORIES: { status: ListStatus | 'all'; label: string; icon: string }[] = [
  { status: 'all', label: 'All', icon: '☰' },
  { status: 'planning', label: 'Planning', icon: '📋' },
  { status: 'watching', label: 'Watching', icon: '▶' },
  { status: 'on_hold', label: 'On hold', icon: '⏸' },
  { status: 'dropped', label: 'Dropped', icon: '⊘' },
  { status: 'finished', label: 'Finished', icon: '✓' },
  { status: 'rewatching', label: 'Rewatching', icon: '🔄' },
];

const FORMAT_OPTIONS = ['TV Show', 'MOVIE', 'ONA', 'SPECIAL'];
const STATUS_OPTIONS = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED'];

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/watchlist')
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getCategoryCount = (status: string) => {
    if (status === 'all') return entries.length;
    return entries.filter((e) => e.listStatus === status).length;
  };

  const getFormatCount = (format: string) => {
    return entries.filter((e) => e.anime?.format?.replace('_', ' ') === format).length;
  };

  const getStatusCount = (animeStatus: string) => {
    return entries.filter((e) => e.anime?.status === animeStatus).length;
  };

  const filteredEntries = entries.filter((entry) => {
    const statusMatch = activeTab === 'all' || entry.listStatus === activeTab;
    const title = (entry.anime?.title?.english || entry.anime?.title?.romaji || '').toLowerCase();
    const queryMatch = !searchQuery || title.includes(searchQuery.toLowerCase());
    const formatMatch = !formatFilter || entry.anime?.format?.replace('_', ' ') === formatFilter;
    const animeStatusMatch = !statusFilter || entry.anime?.status === statusFilter;
    return statusMatch && queryMatch && formatMatch && animeStatusMatch;
  });

  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.wrapper}>
        <aside className={styles.sidebar}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <h3 className={styles.sidebarTitle}>Lists</h3>
          <nav className={styles.nav}>
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

          <h3 className={styles.sidebarTitle} style={{ marginTop: 24 }}>Filters</h3>

          <div className={styles.filterSection}>
            <h4 className={styles.filterTitle}>Format</h4>
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f}
                className={`${styles.filterItem} ${formatFilter === f ? styles.activeFilter : ''}`}
                onClick={() => setFormatFilter(formatFilter === f ? null : f)}
              >
                <span>{f}</span>
                <span className={styles.filterCount}>{getFormatCount(f)}</span>
              </button>
            ))}
          </div>

          <div className={styles.filterSection}>
            <h4 className={styles.filterTitle}>Status</h4>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                className={`${styles.filterItem} ${statusFilter === s ? styles.activeFilter : ''}`}
                onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              >
                <span>{s === 'RELEASING' ? 'AIRING' : s === 'FINISHED' ? 'FINISHED' : 'UPCOMING'}</span>
                <span className={styles.filterCount}>{getStatusCount(s)}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className={styles.mainContent}>
          {loading ? (
            <div className={styles.loading}>Loading watchlist...</div>
          ) : filteredEntries.length === 0 ? (
            <div className={styles.emptyState}>Your watchlist is empty.</div>
          ) : activeTab === 'all' ? (
            <div className={styles.categoriesList}>
              {CATEGORIES.filter(c => c.status !== 'all').map((cat) => {
                const catEntries = filteredEntries.filter((e) => e.listStatus === cat.status);
                if (catEntries.length === 0) return null;
                return (
                  <section key={cat.status} className={styles.categoryRow}>
                    <h3 className={styles.categoryHeader}>{cat.label}</h3>
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
                            synopsis={entry.anime?.synopsis}
                            genres={entry.anime?.genres || []}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
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
                      synopsis={entry.anime?.synopsis}
                      genres={entry.anime?.genres || []}
                    />
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
