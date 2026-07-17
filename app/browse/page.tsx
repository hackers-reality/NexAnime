'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/shared/Header';
import FilterBar from '@/components/browse/FilterBar';
import AnimeCard from '@/components/cards/AnimeCard';
import type { BrowseFilters, AniListMedia, AniListPageInfo } from '@/types';
import styles from './page.module.css';

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const getFiltersFromParams = (): BrowseFilters => {
    const search = searchParams?.get('search') ?? undefined;
    const genres = searchParams?.get('genres')?.split(',') ?? undefined;
    const format = (searchParams?.get('format') as any) ?? undefined;
    const seasonYear = searchParams?.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const season = (searchParams?.get('season') as any) ?? undefined;
    const status = (searchParams?.get('status') as any) ?? undefined;
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
  const [currentPage, setCurrentPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFilters(getFiltersFromParams());
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResults([]);
    setCurrentPage(1);

    const fetchResults = async () => {
      try {
        const res = await fetch('/api/anilist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'search', ...filters, page: 1 }),
        });
        const data = await res.json();
        if (active) {
          setResults(data.media ?? []);
          setPageInfo(data.pageInfo ?? null);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error('Failed to search anime:', err);
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
      const res = await fetch('/api/anilist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', ...filters, page: nextPage }),
      });
      const data = await res.json();
      setResults((prev) => [...prev, ...(data.media ?? [])]);
      setPageInfo(data.pageInfo ?? null);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error('Failed to load more:', err);
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
      <main className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Browse Anime</h1>
          {pageInfo && (
            <span className={styles.countLabel}>
              Showing {results.length} of {pageInfo.total.toLocaleString()} results
            </span>
          )}
        </div>

        <FilterBar initialFilters={filters} onFilterChange={handleFilterChange} />

        {loading ? (
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <p style={{ color: 'var(--text-muted)' }}>Fetching matching titles...</p>
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
            <div className="anime-grid">
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
