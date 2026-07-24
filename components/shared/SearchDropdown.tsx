'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setSelectedIndex(-1);
      try {
        const res = await fetch(`/api/meta?action=search&q=${encodeURIComponent(query)}&limit=8`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data.media ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!results.length && e.key !== 'Escape') return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            router.push(`/anime/${results[selectedIndex].id}`);
            onSelect();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onSelect();
          break;
      }
    },
    [results, selectedIndex, router, onSelect]
  );

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  if (!query.trim()) return null;

  return (
    <div className={styles.dropdown} role="listbox" onKeyDown={handleKeyDown}>
      {loading && results.length === 0 && (
        <div className={styles.loading}>Searching...</div>
      )}

      {!loading && results.length === 0 && query.length > 1 && (
        <div className={styles.empty}>No results for &ldquo;{query}&rdquo;</div>
      )}

      {results.map((result, index) => (
        <Link
          key={result.id}
          href={`/anime/${result.id}`}
          className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={onSelect}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className={styles.thumb}>
            {result.coverImage?.large ? (
              <img src={result.coverImage.large} alt={result.title?.english || result.title?.romaji || 'Anime'} className={styles.thumbImage} loading="lazy" />
            ) : (
              <div className={styles.thumbPlaceholder} />
            )}
          </div>

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
