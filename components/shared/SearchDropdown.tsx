'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './SearchDropdown.module.css';

interface SearchResult {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null };
  format: string | null;
  episodes: number | null;
  status: string | null;
  seasonYear: number | null;
  season: string | null;
}

interface SearchDropdownProps {
  query: string;
  onSelect: () => void;
}

export default function SearchDropdown({ query, onSelect }: SearchDropdownProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/anilist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'quickSearch', term: query }),
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.media ?? []);
      } catch {
        // Aborted or error — ignore
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  if (!query.trim()) return null;

  return (
    <div className={styles.dropdown}>
      {loading && results.length === 0 && (
        <div className={styles.loading}>Searching...</div>
      )}

      {!loading && results.length === 0 && query.length > 1 && (
        <div className={styles.empty}>No results for &ldquo;{query}&rdquo;</div>
      )}

      {results.map((result) => (
        <Link
          key={result.id}
          href={`/anime/${result.id}`}
          className={styles.item}
          onClick={onSelect}
        >
          {/* Thumbnail */}
          <div className={styles.thumb}>
            {result.coverImage?.large ? (
              <img src={result.coverImage.large} alt="" className={styles.thumbImage} />
            ) : (
              <div className={styles.thumbPlaceholder} />
            )}
          </div>

          {/* Info */}
          <div className={styles.info}>
            <div className={styles.title}>
              {result.title.english || result.title.romaji || 'Untitled'}
            </div>
            <div className={styles.meta}>
              {result.format && (
                <span className={styles.badge}>
                  {result.format.replace('_', ' ')}
                </span>
              )}
              {result.episodes && (
                <span className={styles.badge}>
                  {result.episodes} eps
                </span>
              )}
              {result.status && (
                <span className={`${styles.badge} ${
                  result.status === 'RELEASING' ? styles.badgeAiring : ''
                }`}>
                  {result.status === 'RELEASING' ? 'Airing' :
                   result.status === 'FINISHED' ? 'Finished' :
                   result.status === 'NOT_YET_RELEASED' ? 'Upcoming' :
                   result.status}
                </span>
              )}
              {result.season && result.seasonYear && (
                <span className={styles.seasonLabel}>
                  {result.season.charAt(0) + result.season.slice(1).toLowerCase()} {result.seasonYear}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}

      {results.length > 0 && (
        <Link
          href={`/browse?search=${encodeURIComponent(query)}`}
          className={styles.viewAll}
          onClick={onSelect}
        >
          View all results →
        </Link>
      )}
    </div>
  );
}
