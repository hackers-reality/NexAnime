'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/shared/Header';
import Link from 'next/link';
import styles from './page.module.css';

interface Stats {
  overview: {
    totalInList: number;
    uniqueAnime: number;
    totalEpisodesWatched: number;
    totalRewatches: number;
    totalHours: number;
    avgScore: number | null;
  };
  statusBreakdown: Record<string, number>;
  formatBreakdown: Record<string, number>;
  topGenres: Array<{ genre: string; count: number }>;
  recentActivity: Array<{ day: string; entries: number }>;
}

const STATUS_LABELS: Record<string, string> = {
  watching: 'Watching',
  completed: 'Completed',
  on_hold: 'On Hold',
  dropped: 'Dropped',
  planning: 'Plan to Watch',
  rewatching: 'Rewatching',
};

const STATUS_COLORS: Record<string, string> = {
  watching: 'var(--accent-airing)',
  completed: 'var(--accent-finished)',
  on_hold: 'var(--accent-on-hold)',
  dropped: 'var(--color-error)',
  planning: 'var(--primary)',
  rewatching: 'var(--accent-hiatus)',
};

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <Header />
      <main id="main-content" className={styles.main}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Watch Stats</h1>
          <Link href="/" className={styles.backLink}>← Back to Home</Link>
        </div>

        {loading ? (
          <div className={styles.loadingGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        ) : !stats ? (
          <div className={styles.emptyState}>
            <p>No watch data yet. Start watching some anime!</p>
          </div>
        ) : (
          <>
            <section className={styles.overviewGrid}>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{stats.overview.totalInList}</span>
                <span className={styles.statLabel}>In Watchlist</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{stats.overview.uniqueAnime}</span>
                <span className={styles.statLabel}>Unique Anime</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{stats.overview.totalEpisodesWatched}</span>
                <span className={styles.statLabel}>Episodes Watched</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{stats.overview.totalHours}h</span>
                <span className={styles.statLabel}>Time Watched</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{stats.overview.totalRewatches}</span>
                <span className={styles.statLabel}>Rewatches</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{stats.overview.avgScore ?? '—'}</span>
                <span className={styles.statLabel}>Avg Score</span>
              </div>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Status Breakdown</h2>
                <div className={styles.barChart}>
                  {Object.entries(stats.statusBreakdown).map(([status, count]) => {
                    const pct = stats.overview.totalInList > 0
                      ? Math.round((count / stats.overview.totalInList) * 100)
                      : 0;
                    return (
                      <div key={status} className={styles.barRow}>
                        <span className={styles.barLabel}>{STATUS_LABELS[status] || status}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{
                              width: `${pct}%`,
                              backgroundColor: STATUS_COLORS[status] || 'var(--primary)',
                            }}
                          />
                        </div>
                        <span className={styles.barValue}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Format Breakdown</h2>
                <div className={styles.barChart}>
                  {Object.entries(stats.formatBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 8)
                    .map(([format, count]) => {
                      const maxCount = Math.max(...Object.values(stats.formatBreakdown));
                      const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                      return (
                        <div key={format} className={styles.barRow}>
                          <span className={styles.barLabel}>{format.replace('_', ' ')}</span>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{ width: `${pct}%`, backgroundColor: 'var(--primary)' }}
                            />
                          </div>
                          <span className={styles.barValue}>{count}</span>
                        </div>
                      );
                    })}
                </div>
              </section>
            </div>

            {stats.topGenres.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Top Genres</h2>
                <div className={styles.genreGrid}>
                  {stats.topGenres.map(({ genre, count }) => {
                    const maxCount = stats.topGenres[0]?.count || 1;
                    const pct = Math.round((count / maxCount) * 100);
                    return (
                      <div key={genre} className={styles.genreCard}>
                        <Link
                          href={`/browse?genres=${encodeURIComponent(genre)}`}
                          className={styles.genreLink}
                        >
                          <span className={styles.genreName}>{genre}</span>
                          <span className={styles.genreCount}>{count}</span>
                          <div className={styles.genreBar}>
                            <div
                              className={styles.genreBarFill}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {stats.recentActivity.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Last 30 Days Activity</h2>
                <div className={styles.activityChart}>
                  {stats.recentActivity.map(({ day, entries }) => {
                    const maxEntries = Math.max(...stats.recentActivity.map((a) => a.entries));
                    const pct = maxEntries > 0 ? Math.round((entries / maxEntries) * 100) : 0;
                    return (
                      <div key={day} className={styles.activityBar} title={`${day}: ${entries} entries`}>
                        <div
                          className={styles.activityBarFill}
                          style={{ height: `${pct}%` }}
                        />
                        <span className={styles.activityDay}>
                          {new Date(day).getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
