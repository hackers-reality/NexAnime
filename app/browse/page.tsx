'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/shared/Header';
import FilterBar from '@/components/browse/FilterBar';
import AnimeCard from '@/components/cards/AnimeCard';
import SkeletonGrid from '@/components/shared/SkeletonGrid';
import type { BrowseFilters, AniListMedia, AniListPageInfo, AnimeFormat, AnimeSeason, AnimeStatus } from '@/types';
import styles from './page.module.css';

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const getFiltersFromParams = (): BrowseFilters => {
    const search = searchParams?.get('search') ?? undefined;
    const genres = searchParams?.get('genres')?.split(',') ?? undefined;
    const format = (searchParams?.get('format') as AnimeFormat | undefined) ?? undefined;
    const seasonYear = searchParams?.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const season = (searchParams?.get('season') as AnimeSeason | undefined) ?? undefined;
    const status = (searchParams?.get('status') as AnimeStatus | undefined) ?? undefined;
    const tags = searchParams?.get('tags')?.split(',') ?? undefined;
    const country = searchParams?.get('country') ?? undefined;
    const source = searchParams?.get('source') ?? undefined;
    const sort = searchParams?.get('sort')?.split(',') ?? ['POPULARITY_DESC'];

    return {
      search,
      genres,
      format,
      seasonYear,
      season,
      status,
      tags,
      countryOfOrigin: country,
      source,
      sort,
      page: 1,
    };
  };

  const [filters, setFilters] = useState<BrowseFilters>(getFiltersFromParams());
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [pageInfo, setPageInfo] = useState<AniListPageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'dense'>('grid');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFilters(getFiltersFromParams());
  }, [searchParams]);

  const SORT_MAP: Record<string, string> = {
    POPULARITY_DESC: 'popular',
    TRENDING_DESC: 'trending',
    SCORE_DESC: 'score',
    START_DATE_DESC: 'newest',
    START_DATE: 'oldest',
    TITLE_ROMAJI_DESC: 'title',
  };

  const buildBrowseUrl = (f: BrowseFilters, pg: number) => {
    const p = new URLSearchParams();
    p.set('action', 'browse');
    if (f.search) p.set('q', f.search);
    if (f.genres?.length) p.set('genres', f.genres.join(','));
    if (f.format) p.set('format', f.format);
    if (f.season) p.set('season', f.season);
    if (f.seasonYear) p.set('year', String(f.seasonYear));
    if (f.status) p.set('status', f.status);
    if (f.tags?.length) p.set('tags', f.tags.join(','));
    if (f.countryOfOrigin) p.set('country', f.countryOfOrigin);
    if (f.source) p.set('source', f.source);
    if (f.sort?.length) {
      const mapped = SORT_MAP[f.sort[0]];
      if (mapped) p.set('sort', mapped);
    }
    p.set('page', String(pg));
    p.set('limit', '20');
    return `/api/meta?${p.toString()}`;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResults([]);
    setError(null);
    setCurrentPage(1);

    const fetchResults = async () => {
      try {
        const res = await fetch(buildBrowseUrl(filters, 1));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (active) {
          setResults(data.media ?? []);
          setPageInfo(data.pageInfo ?? null);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error('Failed to search anime:', err);
        if (active) setError('Failed to load results. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchResults();
    return () => { active = false; };
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !pageInfo || currentPage >= pageInfo.lastPage) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const res = await fetch(buildBrowseUrl(filters, nextPage));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults((prev) => [...prev, ...(data.media ?? [])]);
      setPageInfo(data.pageInfo ?? null);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error('Failed to load more:', err);
      setError('Failed to load more results.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, pageInfo, currentPage, filters]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, loading]);

  const updateUrlParams = (newFilters: BrowseFilters) => {
    const params = new URLSearchParams();
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.genres?.length) params.set('genres', newFilters.genres.join(','));
    if (newFilters.format) params.set('format', newFilters.format);
    if (newFilters.seasonYear) params.set('year', newFilters.seasonYear.toString());
    if (newFilters.season) params.set('season', newFilters.season);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.tags?.length) params.set('tags', newFilters.tags.join(','));
    if (newFilters.countryOfOrigin) params.set('country', newFilters.countryOfOrigin);
    if (newFilters.source) params.set('source', newFilters.source);
    if (newFilters.sort?.length) params.set('sort', newFilters.sort.join(','));

    router.push(`/browse?${params.toString()}`);
  };

  const handleFilterChange = (newFilters: BrowseFilters) => {
    const updated = { ...newFilters, page: 1 };
    setFilters(updated);
    updateUrlParams(updated);
  };

  const allLoaded = pageInfo ? currentPage >= pageInfo.lastPage : true;

  return (
    <div className={styles.page}>
      <Header />
      <main id="main-content" className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Browse Anime</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {pageInfo && (
              <span className={styles.countLabel}>
                Showing {results.length} of {pageInfo.total.toLocaleString()} results
              </span>
            )}
            <div className="viewToggle">
              <button
                className={`viewToggleBtn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Standard grid"
              >
                ▦
              </button>
              <button
                className={`viewToggleBtn ${viewMode === 'dense' ? 'active' : ''}`}
                onClick={() => setViewMode('dense')}
                title="Dense grid"
              >
                ▤
              </button>
            </div>
          </div>
        </div>

        <FilterBar initialFilters={filters} onFilterChange={handleFilterChange} />

        {loading ? (
          <SkeletonGrid count={12} horizontal={false} />
        ) : error ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>⚠️</span>
            <h3 className={styles.emptyTitle}>Something went wrong</h3>
            <p className={styles.emptySub}>{error}</p>
            <button
              className={styles.retryBtn}
              onClick={() => { setError(null); setFilters({ ...filters }); }}
              style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              Try Again
            </button>
          </div>
        ) : results.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🔍</span>
            <h3 className={styles.emptyTitle}>No anime found</h3>
            <p className={styles.emptySub}>
              We couldn&apos;t find any titles matching those filters. Try clearing some selections!
            </p>
          </div>
        ) : (
          <>
            <div className={`anime-grid ${viewMode === 'dense' ? 'anime-grid--dense' : ''}`}>
              {results.map((anime) => (
                <AnimeCard
                  key={anime.id}
                  id={anime.id}
                  poster={anime.coverImage?.extraLarge ?? anime.coverImage?.large}
                  title={anime.title.english || anime.title.romaji || 'Untitled'}
                  format={anime.format}
                  year={anime.seasonYear}
                  status={anime.status}
                  score={anime.averageScore}
                  synopsis={anime.description}
                  genres={anime.genres}
                  rating={anime.rating}
                  subbed={anime.subbed}
                  dubbed={anime.dubbed}
                  airDate={
                    anime.nextAiringEpisode
                      ? `Ep ${anime.nextAiringEpisode.episode} airing soon`
                      : undefined
                  }
                />
              ))}
            </div>

            <div ref={sentinelRef} />

            {loadingMore && (
              <div className={styles.loadingMore}>
                <div className={styles.spinner} />
              </div>
            )}

            {allLoaded && results.length > 0 && (
              <div className={styles.allLoaded}>All results loaded</div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          <div className={styles.spinner} />
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}
