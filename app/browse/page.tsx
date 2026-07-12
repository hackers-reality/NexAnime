'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/shared/Header';
import FilterBar from '@/components/browse/FilterBar';
import AnimeCard from '@/components/cards/AnimeCard';
import type { BrowseFilters, AniListMedia, AniListPageInfo } from '@/types';
import styles from './page.module.css';

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse filters from search params on load
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
    const page = searchParams?.get('page') ? parseInt(searchParams.get('page')!) : 1;

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
      page,
    };
  };

  const [filters, setFilters] = useState<BrowseFilters>(getFiltersFromParams());
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [pageInfo, setPageInfo] = useState<AniListPageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync state with URL params if they change externally (e.g. back button)
  useEffect(() => {
    setFilters(getFiltersFromParams());
  }, [searchParams]);

  // Fetch results when filters change
  useEffect(() => {
    let active = true;
    setLoading(true);

    const fetchResults = async () => {
      try {
        const res = await fetch('/api/anilist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'search',
            ...filters,
          }),
        });
        const data = await res.json();
        
        if (active) {
          setResults(data.media ?? []);
          setPageInfo(data.pageInfo ?? null);
        }
      } catch (err) {
        console.error('Failed to search anime:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      active = false;
    };
  }, [filters]);

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
    if (newFilters.page && newFilters.page > 1) params.set('page', newFilters.page.toString());

    router.push(`/browse?${params.toString()}`);
  };

  const handleFilterChange = (newFilters: BrowseFilters) => {
    const updated = {
      ...newFilters,
      page: 1, // Reset page on filter change
    };
    setFilters(updated);
    updateUrlParams(updated);
  };

  const handlePageChange = (newPage: number) => {
    if (!pageInfo || newPage < 1 || newPage > pageInfo.lastPage) return;
    const updated = {
      ...filters,
      page: newPage,
    };
    setFilters(updated);
    updateUrlParams(updated);
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        {/* Title & Stats */}
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Browse Anime</h1>
          {pageInfo && (
            <span className={styles.countLabel}>
              Showing {results.length} of {pageInfo.total.toLocaleString()} results
            </span>
          )}
        </div>

        {/* Filter panel */}
        <FilterBar initialFilters={filters} onFilterChange={handleFilterChange} />

        {/* Loading Spinner */}
        {loading ? (
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <p style={{ color: 'var(--text-muted)' }}>Fetching matching titles...</p>
          </div>
        ) : results.length === 0 ? (
          /* Empty State */
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🔍</span>
            <h3 className={styles.emptyTitle}>No anime found</h3>
            <p className={styles.emptySub}>
              We couldn&apos;t find any titles matching those filters. Try clearing some selections!
            </p>
          </div>
        ) : (
          /* Grid of Cards */
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
                  // Optional preview details
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

            {/* Pagination Controls */}
            {pageInfo && pageInfo.lastPage > 1 && (
              <div className={styles.paginationRow}>
                {/* First Page */}
                <button
                  className={styles.pagerBtn}
                  disabled={pageInfo.currentPage === 1}
                  onClick={() => handlePageChange(1)}
                  title="First Page"
                >
                  «
                </button>

                {/* Prev */}
                <button
                  className={styles.pagerBtn}
                  disabled={pageInfo.currentPage === 1}
                  onClick={() => handlePageChange(pageInfo.currentPage - 1)}
                  title="Previous Page"
                >
                  ‹
                </button>

                {/* Current & Surrounding Pages */}
                {Array.from({ length: Math.min(5, pageInfo.lastPage) }, (_, i) => {
                  let pageNum = pageInfo.currentPage - 2 + i;
                  // Boundary checks
                  if (pageInfo.currentPage <= 2) {
                    pageNum = i + 1;
                  } else if (pageInfo.currentPage >= pageInfo.lastPage - 1) {
                    pageNum = pageInfo.lastPage - 4 + i;
                  }
                  pageNum = Math.max(1, Math.min(pageInfo.lastPage, pageNum));

                  return (
                    <button
                      key={pageNum}
                      className={`${styles.pagerBtn} ${
                        pageInfo.currentPage === pageNum ? styles.pagerBtnActive : ''
                      }`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {/* Next */}
                <button
                  className={styles.pagerBtn}
                  disabled={pageInfo.currentPage === pageInfo.lastPage}
                  onClick={() => handlePageChange(pageInfo.currentPage + 1)}
                  title="Next Page"
                >
                  ›
                </button>

                {/* Last Page */}
                <button
                  className={styles.pagerBtn}
                  disabled={pageInfo.currentPage === pageInfo.lastPage}
                  onClick={() => handlePageChange(pageInfo.lastPage)}
                  title="Last Page"
                >
                  »
                </button>
              </div>
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
