// NexAnime — Animetsu.cc/liv Metadata Scraper
// Fetches anime metadata (search, details, episodes) from animetsu
// Bypasses AniList rate limits for metadata-heavy pages

import { queryOne, execute } from './db';
import type { AniListMedia, AnimeFormat, AnimeStatus, AnimeSeason, BrowseFilters } from '@/types';

const ANIMETSU_BASES = [
  'https://animetsu.cc/v2/api/anime',
  'https://animetsu.live/v2/api/anime',
];
let activeBaseIndex = 0;

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Referer': 'https://animetsu.cc/',
  'Origin': 'https://animetsu.cc',
};

// ─── Raw animetsu response types ────────────────────────

interface AnimetsuSearchResult {
  id: string;
  type: string;
  title: string;
  status: string;
  is_adult: boolean;
  cover_image: string;
  banner: string | null;
  description: string;
  total_eps: number;
  start_date: string;
  end_date: string;
  year: number;
  format: string;
  duration: number;
  genres: string;
  average_score: number;
  trailer: string | null;
  season: string;
}

interface AnimetsuSearchResponse {
  results: AnimetsuSearchResult[];
  page: number;
  last_page: number;
  total: number;
}

interface AnimetsuEpisode {
  ep_num: number;
  aired_at: string;
  desc: string;
  dislikes: number;
  img: string;
  is_filler: boolean;
  likes: number;
  name: string;
  views: number;
  id: string;
}

// ─── Helpers ─────────────────────────────────────────────

function parseAnimetsuTitle(raw: string): { romaji: string; english: string; native: string } {
  const result = { romaji: '', english: '', native: '' };
  if (!raw) return result;
  const romaji = raw.match(/romaji=([^;)]+)/);
  const english = raw.match(/english=([^;)]+)/);
  const native = raw.match(/native=([^;)]+)/);
  if (romaji) result.romaji = romaji[1].trim();
  if (english) result.english = english[1].trim();
  if (native) result.native = native[1].trim();
  return result;
}

function extractAniListIdFromCover(coverImage: string): number | null {
  const match = coverImage.match(/\/bx(\d+)-/);
  return match ? parseInt(match[1]) : null;
}

function mapFormat(fmt: string): AnimeFormat {
  const map: Record<string, AnimeFormat> = {
    TV: 'TV', MOVIE: 'MOVIE', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'SPECIAL',
    TV_SHORT: 'TV_SHORT', MUSIC: 'MUSIC',
  };
  return map[fmt] ?? 'TV';
}

function mapStatus(status: string): AnimeStatus {
  const map: Record<string, AnimeStatus> = {
    FINISHED: 'FINISHED', RELEASING: 'RELEASING', NOT_YET_RELEASED: 'NOT_YET_RELEASED',
    CANCELLED: 'CANCELLED', HIATUS: 'HIATUS',
  };
  return map[status] ?? 'FINISHED';
}

function mapSeason(s: string): AnimeSeason {
  const map: Record<string, AnimeSeason> = {
    WINTER: 'WINTER', SPRING: 'SPRING', SUMMER: 'SUMMER', FALL: 'FALL',
  };
  return map[s] ?? 'FALL';
}

function parseGenres(genres: string): string[] {
  return genres ? genres.split(/\s+/).filter(Boolean) : [];
}

// ─── Core fetch with failover ────────────────────────────

async function animetsuFetch<T>(path: string): Promise<T | null> {
  for (let i = 0; i < ANIMETSU_BASES.length; i++) {
    const idx = (activeBaseIndex + i) % ANIMETSU_BASES.length;
    const base = ANIMETSU_BASES[idx];
    try {
      const res = await fetch(`${base}${path}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      activeBaseIndex = idx;
      return await res.json() as T;
    } catch {
      // try next base
    }
  }
  return null;
}

// ─── Public API: Search ──────────────────────────────────

export async function animetsuSearch(
  query: string,
  page = 1,
  limit = 20
): Promise<{ media: AniListMedia[]; total: number; lastPage: number }> {
  const data = await animetsuFetch<AnimetsuSearchResponse>(
    `/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  );
  if (!data?.results) return { media: [], total: 0, lastPage: 1 };

  const media = data.results.map(r => animetsuResultToMedia(r)).filter(Boolean) as AniListMedia[];
  return { media, total: data.total, lastPage: data.last_page };
}

// ─── Public API: Anime Detail (by animetsu MongoDB ID) ──

export async function animetsuGetInfo(animetsuId: string): Promise<AnimetsuSearchResult | null> {
  const data = await animetsuFetch<AnimetsuSearchResult>(`/info/${animetsuId}`);
  return data;
}

// ─── Public API: Episodes ────────────────────────────────

export async function animetsuGetEpisodes(animetsuId: string): Promise<AnimetsuEpisode[]> {
  const data = await animetsuFetch<AnimetsuEpisode[]>(`/eps/${animetsuId}`);
  return data ?? [];
}

// ─── Public API: Get servers for episode ─────────────────

export async function animetsuGetServers(animetsuId: string, ep: number) {
  return await animetsuFetch<Array<{ id: string; default: boolean; tip: string }>>(
    `/servers/${animetsuId}/${ep}`
  ) ?? [];
}

// ─── Convert animetsu result → AniListMedia ──────────────

function animetsuResultToMedia(r: AnimetsuSearchResult): AniListMedia | null {
  if (!r) return null;
  const titles = parseAnimetsuTitle(r.title);
  const anilistId = extractAniListIdFromCover(r.cover_image);

  // Extract cover URL from the cover_image field
  const coverLargeMatch = r.cover_image?.match(/large=([^;]+)/);
  const coverMediumMatch = r.cover_image?.match(/medium=([^;]+)/);
  const coverUrl = coverLargeMatch?.[1] || coverMediumMatch?.[1] || '';

  return {
    id: anilistId ?? 0,
    title: {
      romaji: titles.romaji || titles.english || 'Unknown',
      english: titles.english || null,
      native: titles.native || null,
    },
    synonyms: [],
    description: r.description?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') ?? '',
    format: mapFormat(r.format),
    status: mapStatus(r.status),
    season: mapSeason(r.season),
    seasonYear: r.year,
    averageScore: r.average_score,
    meanScore: r.average_score,
    studios: { nodes: [] },
    genres: parseGenres(r.genres),
    tags: [],
    coverImage: {
      extraLarge: coverUrl || null,
      large: coverUrl || null,
      medium: coverUrl || null,
    },
    bannerImage: r.banner,
    episodes: r.total_eps,
    nextAiringEpisode: null,
    streamingEpisodes: [],
    trailer: r.trailer ? { id: r.trailer, site: 'youtube' } : null,
  } as unknown as AniListMedia;
}

// ─── Search by AniList ID (lookup via cover image) ───────
// Animetsu stores AniList IDs in cover URLs, so we can reverse-lookup

let idSearchCache: Map<number, string> = new Map();

export async function findAnimetsuIdByAnilistId(anilistId: number): Promise<string | null> {
  const cached = idSearchCache.get(anilistId);
  if (cached) return cached;

  // Check DB cache
  const dbCached = await queryOne<{ animetsu_id: string }>(
    'SELECT animetsu_id FROM animetsu_id_cache WHERE anilist_id = ?',
    [anilistId]
  );
  if (dbCached) {
    idSearchCache.set(anilistId, dbCached.animetsu_id);
    return dbCached.animetsu_id;
  }

  return null;
}

export async function cacheAnimetsuId(anilistId: number, animetsuId: string): Promise<void> {
  idSearchCache.set(anilistId, animetsuId);
  await execute(
    'INSERT OR REPLACE INTO animetsu_id_cache (anilist_id, animetsu_id, cached_at) VALUES (?, ?, datetime(\'now\'))',
    [anilistId, animetsuId]
  );
}
