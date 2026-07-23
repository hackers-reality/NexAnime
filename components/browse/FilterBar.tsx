'use client';

import { useState, useEffect, useRef } from 'react';
import type { BrowseFilters, AnimeFormat, AnimeStatus, AnimeSeason } from '@/types';
import styles from './FilterBar.module.css';

// Constants
const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 
  'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 
  'Sports', 'Supernatural', 'Thriller'
];

const TAGS = [
  'Isekai', 'Magic', 'School', 'CGI', 'Overpowered Main Character', 
  'Harem', 'Military', 'Super Power', 'Gore', 'Post-Apocalyptic', 
  'Martial Arts', 'Survival', 'Video Games', 'Music', 'Historical'
];

const FORMATS: { value: AnimeFormat; label: string }[] = [
  { value: 'TV', label: 'TV Show' },
  { value: 'TV_SHORT', label: 'TV Short' },
  { value: 'MOVIE', label: 'Movie' },
  { value: 'SPECIAL', label: 'Special' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
  { value: 'MUSIC', label: 'Music Video' },
];

const STATUSES: { value: AnimeStatus; label: string }[] = [
  { value: 'FINISHED', label: 'Finished' },
  { value: 'RELEASING', label: 'Airing' },
  { value: 'NOT_YET_RELEASED', label: 'Upcoming' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'HIATUS', label: 'Hiatus' },
];

const SEASONS: { value: AnimeSeason; label: string }[] = [
  { value: 'WINTER', label: 'Winter' },
  { value: 'SPRING', label: 'Spring' },
  { value: 'SUMMER', label: 'Summer' },
  { value: 'FALL', label: 'Fall' },
];

const SORT_OPTIONS = [
  { value: 'POPULARITY_DESC', label: 'Popularity' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'SCORE_DESC', label: 'Average Score' },
  { value: 'START_DATE_DESC', label: 'Release Date' },
  { value: 'TITLE_ROMAJI_DESC', label: 'Title (A-Z)' },
];

const COUNTRIES = [
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'CN', label: 'China' },
  { value: 'TW', label: 'Taiwan' },
];

const SOURCES = [
  { value: 'ORIGINAL', label: 'Original' },
  { value: 'MANGA', label: 'Manga' },
  { value: 'LIGHT_NOVEL', label: 'Light Novel' },
  { value: 'VISUAL_NOVEL', label: 'Visual Novel' },
  { value: 'VIDEO_GAME', label: 'Video Game' },
  { value: 'OTHER', label: 'Other' },
];

// Generate years from current down to 1940
const currentYear = new Date().getFullYear() + 1; // Lookahead
const YEARS = Array.from({ length: currentYear - 1940 + 1 }, (_, i) => currentYear - i);

interface FilterBarProps {
  initialFilters: BrowseFilters;
  onFilterChange: (filters: BrowseFilters) => void;
}

export default function FilterBar({ initialFilters, onFilterChange }: FilterBarProps) {
  const [search, setSearch] = useState(initialFilters.search ?? '');
  const [genres, setGenres] = useState<string[]>(initialFilters.genres ?? []);
  const [format, setFormat] = useState<string>(initialFilters.format ?? '');
  const [year, setYear] = useState<string>(initialFilters.seasonYear?.toString() ?? '');
  const [sort, setSort] = useState<string>(initialFilters.sort?.[0] ?? 'POPULARITY_DESC');
  const [season, setSeason] = useState<string>(initialFilters.season ?? '');
  const [status, setStatus] = useState<string>(initialFilters.status ?? '');
  const [tags, setTags] = useState<string[]>(initialFilters.tags ?? []);
  const [country, setCountry] = useState<string>(initialFilters.countryOfOrigin ?? '');
  const [source, setSource] = useState<string>(initialFilters.source ?? '');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  const [showGenrePopover, setShowGenrePopover] = useState(false);
  const [showTagPopover, setShowTagPopover] = useState(false);

  const genreRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);

  // Debounce search text input
  useEffect(() => {
    const handler = setTimeout(() => {
      triggerChange({ search: search || undefined });
      if (search.trim()) {
        const stored = JSON.parse(localStorage.getItem('nexanime_search_history') || '[]') as string[];
        const updated = [search.trim(), ...stored.filter(s => s !== search.trim())].slice(0, 8);
        localStorage.setItem('nexanime_search_history', JSON.stringify(updated));
        setRecentSearches(updated);
      }
    }, 450);

    return () => clearTimeout(handler);
  }, [search]);

  // Load recent searches on mount
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('nexanime_search_history') || '[]') as string[];
    setRecentSearches(stored);
  }, []);

  // Click outside to close popovers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (genreRef.current && !genreRef.current.contains(event.target as Node)) {
        setShowGenrePopover(false);
      }
      if (tagRef.current && !tagRef.current.contains(event.target as Node)) {
        setShowTagPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerChange = (updatedFields: Partial<BrowseFilters>) => {
    const currentFilters: BrowseFilters = {
      search: search || undefined,
      genres: genres.length > 0 ? genres : undefined,
      format: format ? (format as AnimeFormat) : undefined,
      seasonYear: year ? parseInt(year) : undefined,
      sort: sort ? [sort] : undefined,
      season: season ? (season as AnimeSeason) : undefined,
      status: status ? (status as AnimeStatus) : undefined,
      tags: tags.length > 0 ? tags : undefined,
      countryOfOrigin: country || undefined,
      source: source || undefined,
    };

    onFilterChange({
      ...currentFilters,
      ...updatedFields,
    });
  };

  const handleGenreToggle = (genre: string) => {
    const newGenres = genres.includes(genre)
      ? genres.filter((g) => g !== genre)
      : [...genres, genre];
    setGenres(newGenres);
    triggerChange({ genres: newGenres.length > 0 ? newGenres : undefined });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = tags.includes(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag];
    setTags(newTags);
    triggerChange({ tags: newTags.length > 0 ? newTags : undefined });
  };

  const handleReset = () => {
    setSearch('');
    setGenres([]);
    setFormat('');
    setYear('');
    setSort('POPULARITY_DESC');
    setSeason('');
    setStatus('');
    setTags([]);
    setCountry('');
    setSource('');

    onFilterChange({
      sort: ['POPULARITY_DESC'],
    });
  };

  return (
    <div className={styles.filterBar}>
      {/* Search Input Row */}
      <div className={styles.searchRow} style={{ position: 'relative' }}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search for anime..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowRecent(true)}
          onBlur={() => setTimeout(() => setShowRecent(false), 200)}
        />
        {showRecent && !search && recentSearches.length > 0 && (
          <div className={styles.recentSearches}>
            <div className={styles.recentHeader}>
              <span>Recent</span>
              <button
                type="button"
                onClick={() => { localStorage.removeItem('nexanime_search_history'); setRecentSearches([]); }}
                className={styles.clearRecentBtn}
              >
                Clear
              </button>
            </div>
            {recentSearches.map((term, i) => (
              <button
                key={`${term}-${i}`}
                type="button"
                className={styles.recentItem}
                onMouseDown={() => { setSearch(term); setShowRecent(false); }}
              >
                <span style={{ opacity: 0.5, marginRight: 6 }}>⌕</span>
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Dropdowns */}
      <div className={styles.filtersGrid}>
        {/* Genres Multi-select Popover */}
        <div className={styles.filterGroup} ref={genreRef}>
          <span className={styles.label}>Genres</span>
          <div className={styles.selectWrapper}>
            <button
              className={styles.customDropdownBtn}
              onClick={() => {
                setShowGenrePopover(!showGenrePopover);
                setShowTagPopover(false);
              }}
            >
              {genres.length === 0
                ? 'Any Genre'
                : genres.length === 1
                ? genres[0]
                : `${genres.length} selected`}
              <span className={styles.dropdownChevron}>▼</span>
            </button>
            {showGenrePopover && (
              <div className={styles.popover}>
                {GENRES.map((g) => (
                  <label key={g} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={genres.includes(g)}
                      onChange={() => handleGenreToggle(g)}
                    />
                    {g}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Format Select */}
        <div className={styles.filterGroup}>
          <span className={styles.label}>Format</span>
          <div className={styles.selectWrapper}>
            <select
              className={styles.select}
              value={format}
              onChange={(e) => {
                const val = e.target.value;
                setFormat(val);
                triggerChange({ format: val ? (val as AnimeFormat) : undefined });
              }}
            >
              <option value="">Any Format</option>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Year Select */}
        <div className={styles.filterGroup}>
          <span className={styles.label}>Year</span>
          <div className={styles.selectWrapper}>
            <select
              className={styles.select}
              value={year}
              onChange={(e) => {
                const val = e.target.value;
                setYear(val);
                triggerChange({ seasonYear: val ? parseInt(val) : undefined });
              }}
            >
              <option value="">Any Year</option>
              {YEARS.map((y) => (
                <option key={y} value={y.toString()}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Season Select */}
        <div className={styles.filterGroup}>
          <span className={styles.label}>Season</span>
          <div className={styles.selectWrapper}>
            <select
              className={styles.select}
              value={season}
              onChange={(e) => {
                const val = e.target.value;
                setSeason(val);
                triggerChange({ season: val ? (val as AnimeSeason) : undefined });
              }}
            >
              <option value="">Any Season</option>
              {SEASONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Airing Status Select */}
        <div className={styles.filterGroup}>
          <span className={styles.label}>Airing Status</span>
          <div className={styles.selectWrapper}>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => {
                const val = e.target.value;
                setStatus(val);
                triggerChange({ status: val ? (val as AnimeStatus) : undefined });
              }}
            >
              <option value="">Any Status</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags Multi-select Popover */}
        <div className={styles.filterGroup} ref={tagRef}>
          <span className={styles.label}>Tags</span>
          <div className={styles.selectWrapper}>
            <button
              className={styles.customDropdownBtn}
              onClick={() => {
                setShowTagPopover(!showTagPopover);
                setShowGenrePopover(false);
              }}
            >
              {tags.length === 0
                ? 'Any Tag'
                : tags.length === 1
                ? tags[0]
                : `${tags.length} selected`}
              <span className={styles.dropdownChevron}>▼</span>
            </button>
            {showTagPopover && (
              <div className={styles.popover}>
                {TAGS.map((t) => (
                  <label key={t} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={tags.includes(t)}
                      onChange={() => handleTagToggle(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Country of Origin Select */}
        <div className={styles.filterGroup}>
          <span className={styles.label}>Country</span>
          <div className={styles.selectWrapper}>
            <select
              className={styles.select}
              value={country}
              onChange={(e) => {
                const val = e.target.value;
                setCountry(val);
                triggerChange({ countryOfOrigin: val || undefined });
              }}
            >
              <option value="">Any Country</option>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Source Select */}
        <div className={styles.filterGroup}>
          <span className={styles.label}>Source</span>
          <div className={styles.selectWrapper}>
            <select
              className={styles.select}
              value={source}
              onChange={(e) => {
                const val = e.target.value;
                setSource(val);
                triggerChange({ source: val || undefined });
              }}
            >
              <option value="">Any Source</option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort Select */}
        <div className={styles.filterGroup}>
          <span className={styles.label}>Sort By</span>
          <div className={styles.selectWrapper}>
            <select
              className={styles.select}
              value={sort}
              onChange={(e) => {
                const val = e.target.value;
                setSort(val);
                triggerChange({ sort: val ? [val] : undefined });
              }}
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className={styles.actionRow}>
        <button className={styles.resetBtn} onClick={handleReset}>
          Reset all filters
        </button>
      </div>
    </div>
  );
}
