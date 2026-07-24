'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/shared/Header';
import AnimeCard from '@/components/cards/AnimeCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonGrid } from '@/components/ui/Skeleton';
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

const FORMAT_OPTIONS = ['TV', 'TV_SHORT', 'MOVIE', 'ONA', 'SPECIAL', 'OVA'];
const FORMAT_LABELS: Record<string, string> = { TV: 'TV', TV_SHORT: 'TV Short', MOVIE: 'Movie', ONA: 'ONA', SPECIAL: 'Special', OVA: 'OVA' };
const STATUS_OPTIONS = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED'];

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'score' | 'progress'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [bulkLoading, setBulkLoading] = useState(false);

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
    return entries.filter((e) => e.anime?.format === format).length;
  };

  const getStatusCount = (animeStatus: string) => {
    return entries.filter((e) => e.anime?.status === animeStatus).length;
  };

  const filteredEntries = entries.filter((entry) => {
    const statusMatch = activeTab === 'all' || entry.listStatus === activeTab;
    const title = (entry.anime?.title?.english || entry.anime?.title?.romaji || '').toLowerCase();
    const queryMatch = !searchQuery || title.includes(searchQuery.toLowerCase());
    const formatMatch = !formatFilter || entry.anime?.format === formatFilter;
    const animeStatusMatch = !statusFilter || entry.anime?.status === statusFilter;
    return statusMatch && queryMatch && formatMatch && animeStatusMatch;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    switch (sortBy) {
      case 'title': {
        const aTitle = (a.anime?.title?.english || a.anime?.title?.romaji || '').toLowerCase();
        const bTitle = (b.anime?.title?.english || b.anime?.title?.romaji || '').toLowerCase();
        return aTitle.localeCompare(bTitle);
      }
      case 'score':
        return (b.score || b.anime?.averageScore || 0) - (a.score || a.anime?.averageScore || 0);
      case 'progress':
        return b.episodeWatched - a.episodeWatched;
      case 'recent':
      default:
        return 0; // Keep original order (API returns by recently updated)
    }
  });

  const handleBulkAction = async (action: 'mark_all_watched' | 'remove_all') => {
    const label = action === 'mark_all_watched' ? 'mark all as completed' : 'remove all from this list';
    const confirm = window.confirm(`Are you sure you want to ${label}? This cannot be undone.`);
    if (!confirm) return;

    setBulkLoading(true);
    try {
      await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, listStatus: activeTab !== 'all' ? activeTab : undefined }),
      });
      // Refresh the list
      const res = await fetch('/api/watchlist');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      console.error('Bulk action failed:', err);
    } finally {
      setBulkLoading(false);
    }
  };

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
                <span>{FORMAT_LABELS[f] || f}</span>
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

        <main id="main-content" className={styles.mainContent}>
          {loading ? (
            <SkeletonGrid count={8} />
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              title="Your watchlist is empty"
              description="Start browsing anime and add titles to your watchlist to track your progress."
              action={{ label: "Browse Anime", href: "/browse" }}
            />
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
                            score={entry.score ?? entry.anime?.averageScore}
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
                {CATEGORIES.find((c) => c.status === activeTab)?.label} ({sortedEntries.length})
              </h3>
              <div className={styles.sortRow}>
                {([
                  ['recent', 'Recent'],
                  ['title', 'Title'],
                  ['score', 'Score'],
                  ['progress', 'Progress'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={`${styles.sortBtn} ${sortBy === key ? styles.activeSortBtn : ''}`}
                    onClick={() => setSortBy(key)}
                  >
                    {label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button
                  className={`${styles.viewToggle} ${viewMode === 'grid' ? styles.activeViewToggle : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                >
                  ⊞
                </button>
                <button
                  className={`${styles.viewToggle} ${viewMode === 'list' ? styles.activeViewToggle : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  ☰
                </button>
                {activeTab !== 'all' && (
                  <>
                    <button
                      className={styles.bulkBtn}
                      onClick={() => handleBulkAction('mark_all_watched')}
                      disabled={bulkLoading}
                    >
                      {bulkLoading ? '...' : '✓ Mark All Completed'}
                    </button>
                    <button
                      className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`}
                      onClick={() => handleBulkAction('remove_all')}
                      disabled={bulkLoading}
                    >
                      {bulkLoading ? '...' : '✕ Remove All'}
                    </button>
                  </>
                )}
              </div>
              {viewMode === 'grid' ? (
                <div className={styles.grid}>
                  {sortedEntries.map((entry) => (
                    <div key={entry.id} className={styles.gridCardContainer}>
                      <AnimeCard
                        id={entry.anilistId}
                        poster={entry.anime?.coverImage?.extraLarge || null}
                        title={entry.anime?.title?.romaji || entry.anime?.title?.english || 'Unknown'}
                        format={entry.anime?.format as any}
                        year={entry.anime?.seasonYear || null}
                        score={entry.score ?? entry.anime?.averageScore}
                        status={entry.anime?.status as any}
                        synopsis={entry.anime?.synopsis}
                        genres={entry.anime?.genres || []}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.list}>
                  {sortedEntries.map((entry) => {
                    const title = entry.anime?.title?.english || entry.anime?.title?.romaji || 'Unknown';
                    const totalEps = entry.anime?.episodes || 0;
                    return (
                      <Link
                        key={entry.id}
                        href={`/anime/${entry.anilistId}`}
                        className={styles.listItem}
                      >
                        <img
                          src={entry.anime?.coverImage?.extraLarge || '/placeholder.png'}
                          alt={title}
                          className={styles.listThumb}
                        />
                        <div className={styles.listInfo}>
                          <span className={styles.listTitle}>{title}</span>
                          <span className={styles.listMeta}>
                            {entry.anime?.format?.replace('_', ' ')} · {entry.anime?.seasonYear}
                          </span>
                          {totalEps > 0 && (
                            <div className={styles.listProgress}>
                              <div className={styles.listProgressBar}>
                                <div
                                  className={styles.listProgressFill}
                                  style={{ width: `${Math.min((entry.episodeWatched / totalEps) * 100, 100)}%` }}
                                />
                              </div>
                              <span className={styles.listProgressText}>
                                {entry.episodeWatched}/{totalEps}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className={styles.listRight}>
                          {entry.score ? (
                            <span className={styles.listScore}>★ {entry.score}</span>
                          ) : null}
                          <span className={`${styles.listStatusBadge} ${styles[entry.listStatus]}`}>
                            {entry.listStatus.replace('_', ' ')}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
