import type { AniListMedia } from '@/types';
import { getAnilistIdByMalId } from '@/lib/anilist';

const BASE = 'https://aniwatchbackend.cfd/api';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ─── In-memory cache ──────────────────────────────────────

interface CacheEntry<T> { data: T; expiry: number }
const cache = new Map<string, CacheEntry<unknown>>();
const TTL = 300_000;

function cached<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiry) { cache.delete(key); return null; }
  return e.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiry: Date.now() + TTL });
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) { if (now > v.expiry) cache.delete(k); }
  }
}

// ─── Raw API types (matching actual API response) ─────────

function parseGenres(g: any): string[] {
  if (Array.isArray(g)) return g;
  if (typeof g === 'string') return g.split(/\s+/).filter(Boolean);
  return [];
}

interface HianimeAnime {
  _id: string;
  title: string;
  mal_id: number | null;
  image: string;
  landScapeImage: string;
  synopsis: string;
  genres: any;
  English: string;
  Japanese: string;
  Type: string;
  Status: string;
  Aired: string;
  Duration: string;
  Score: string | null;
  totalSubbed: number;
  totalDubbed: number;
  slug: string;
  episodes?: HianimeEpisode[];
  Broadcast?: string;
  Favorites?: string;
  Popularity?: string;
  Ranked?: string;
  Rating?: string;
  Source?: string;
  Producers?: string;
  Licensors?: string;
  Premiered?: string;
  Members?: string;
  totalEpisodes?: number | string | null;
  slugs?: string[];
  alternateTitle?: string;
  score?: number;
}

interface HianimeCategoryMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface HianimeCategoryResponse {
  meta: HianimeCategoryMeta;
  animes: HianimeAnime[];
}

interface HianimeAnimeListResponse {
  animes: HianimeAnime[];
  nextCursor: string;
  hasNextPage: boolean;
  pageSize: number;
}

interface HianimeEpisodeListResponse {
  total: number;
  episodes: HianimeEpisode[];
}

interface HianimeEpisode {
  _id: string;
  anime_id: string;
  episodeNumber: number;
  title: string;
  slug: string;
  link: {
    sub: string[];
    dub: string[];
  };
}

interface HianimeHomeResponse {
  featured: Array<{ anime: HianimeAnime }>;
  latestAnime: { animes: HianimeAnime[] };
  latestEpisodes: { episodes: Array<HianimeEpisode & { anime_info: HianimeAnime }> };
  popular: { animes: HianimeAnime[] };
  trending: { animes: HianimeAnime[] };
  currentlyAiring: { animes: HianimeAnime[] };
  finishedAiring: { animes: HianimeAnime[] };
}

// ─── Core fetch ───────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const key = `${path}:${init?.method || 'GET'}:${init?.body || ''}`;
  const cachedVal = cached<T>(key);
  if (cachedVal !== null) return cachedVal;

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as T;
    setCache(key, data);
    return data;
  } catch {
    return null;
  }
}

// ─── Search ───────────────────────────────────────────────

export async function searchHianime(
  query: string
): Promise<{ media: AniListMedia[]; total: number }> {
  const data = await apiFetch<HianimeAnime[]>('/search', {
    method: 'POST',
    body: JSON.stringify({ title: query }),
  });
  if (!data || !Array.isArray(data)) return { media: [], total: 0 };

  const mapped = await Promise.all(data.map(a => mapAnime(a)));
  return {
    media: mapped.filter(Boolean) as AniListMedia[],
    total: data.length,
  };
}

// ─── Trending ─────────────────────────────────────────────

export async function getHianimeTrending(): Promise<AniListMedia[]> {
  const data = await apiFetch<HianimeHomeResponse>('/home');
  if (!data?.trending?.animes) return [];
  const mapped = await Promise.all(data.trending.animes.map(a => mapAnime(a)));
  return mapped.filter(Boolean) as AniListMedia[];
}

// ─── Popular ──────────────────────────────────────────────

export async function getHianimePopular(): Promise<AniListMedia[]> {
  const data = await apiFetch<HianimeHomeResponse>('/home');
  if (!data?.popular?.animes) return [];
  const mapped = await Promise.all(data.popular.animes.map(a => mapAnime(a)));
  return mapped.filter(Boolean) as AniListMedia[];
}

// ─── Latest Episodes ──────────────────────────────────────

export async function getHianimeLatestEpisodes(): Promise<AniListMedia[]> {
  const data = await apiFetch<HianimeHomeResponse>('/home');
  if (!data?.latestEpisodes?.episodes) return [];

  const results: AniListMedia[] = [];
  for (const ep of data.latestEpisodes.episodes) {
    const anime = ep.anime_info;
    if (!anime) continue;
    const media = await mapAnime(anime);
    if (media) {
      (media as any).streamingEpisodes = [{
        title: ep.title,
        thumbnail: anime.image,
        site: 'hianime',
      }];
      results.push(media);
    }
  }
  return results;
}

// ─── Home data (single fetch, everything we need) ─────────

export async function getHianimeHome(): Promise<{
  trending: AniListMedia[];
  popular: AniListMedia[];
  latest: AniListMedia[];
  featured: AniListMedia[];
  currentlyAiring: AniListMedia[];
  finishedAiring: AniListMedia[];
} | null> {
  const data = await apiFetch<HianimeHomeResponse>('/home');
  if (!data) return null;

  const [
    trending, popular, latest, featured,
    currentlyAiring, finishedAiring,
  ] = await Promise.all([
    Promise.all((data.trending?.animes || []).map(a => mapAnime(a))),
    Promise.all((data.popular?.animes || []).map(a => mapAnime(a))),
    Promise.all((data.latestAnime?.animes || []).map(a => mapAnime(a))),
    Promise.all((data.featured || []).map(f => mapAnime(f.anime))),
    Promise.all((data.currentlyAiring?.animes || []).map(a => mapAnime(a))),
    Promise.all((data.finishedAiring?.animes || []).map(a => mapAnime(a))),
  ]);

  return {
    trending: trending.filter(Boolean) as AniListMedia[],
    popular: popular.filter(Boolean) as AniListMedia[],
    latest: latest.filter(Boolean) as AniListMedia[],
    featured: featured.filter(Boolean) as AniListMedia[],
    currentlyAiring: currentlyAiring.filter(Boolean) as AniListMedia[],
    finishedAiring: finishedAiring.filter(Boolean) as AniListMedia[],
  };
}

// ─── Get stream URLs from home endpoint ───────────────────

export async function getHianimeStreamUrls(
  malId: number,
  episodeNumber: number
): Promise<{ sub: string[]; dub: string[] } | null> {
  const data = await apiFetch<HianimeHomeResponse>('/home');
  if (!data) return null;

  const allEpisodes = [
    ...(data.latestEpisodes?.episodes || []),
    ...(data.featured || []).flatMap(f => f.anime?.episodes || []),
  ];

  for (const ep of allEpisodes) {
    if (ep.episodeNumber === episodeNumber) {
      const extEp = ep as HianimeEpisode & { anime_info?: HianimeAnime };
      const anime = extEp.anime_info || (data.featured || []).find(f => f.anime?._id === ep.anime_id)?.anime;
      if (anime?.mal_id === malId) {
        return ep.link;
      }
    }
  }

  return null;
}

// ─── Mappers ──────────────────────────────────────────────

const malIdCache = new Map<number, number>();

async function mapAnime(anime: HianimeAnime): Promise<AniListMedia | null> {
  if (!anime) return null;

  let id = extractAnilistId(anime.image);
  if (!id && anime.mal_id) {
    const cached = malIdCache.get(anime.mal_id);
    if (cached) {
      id = cached;
    } else {
      id = await getAnilistIdByMalId(anime.mal_id);
      if (id) malIdCache.set(anime.mal_id, id);
    }
  }
  if (!id) id = hashStringToNumber(anime.title);

  return {
    id,
    idMal: anime.mal_id || null,
    title: {
      romaji: anime.title || anime.Japanese || 'Unknown',
      english: anime.English || anime.title || null,
      native: anime.Japanese || null,
    },
    synonyms: anime.alternateTitle ? [anime.alternateTitle] : [],
    description: anime.synopsis || '',
    format: mapHianimeType(anime.Type),
    status: mapHianimeStatus(anime.Status),
    season: anime.Premiered ? extractSeason(anime.Premiered) : null,
    seasonYear: anime.Premiered ? extractSeasonYear(anime.Premiered) : null,
    averageScore: parseScore(anime.Score),
    meanScore: parseScore(anime.Score),
    source: anime.Source ? anime.Source.replace(/[_-]/g, ' ') : null,
    popularity: anime.Popularity ? parseInt(anime.Popularity) || null : null,
    favourites: anime.Favorites ? parseInt(anime.Favorites) || null : null,
    studios: { nodes: anime.Producers ? anime.Producers.split(/\s*,\s*/).filter(Boolean).map(p => ({ name: p.trim(), isAnimationStudio: false })) : [] },
    genres: parseGenres(anime.genres),
    tags: [],
    coverImage: {
      extraLarge: anime.image || null,
      large: anime.image || null,
      medium: anime.image || null,
    },
    bannerImage: anime.landScapeImage || null,
    episodes: anime.totalEpisodes ? (typeof anime.totalEpisodes === 'string' ? parseInt(anime.totalEpisodes) || null : anime.totalEpisodes) : null,
    nextAiringEpisode: null,
    streamingEpisodes: [],
    trailer: null,
    rating: anime.Rating || null,
  } as unknown as AniListMedia;
}

function extractSeasonYear(premiered: string): number | null {
  if (!premiered) return null;
  const m = premiered.match(/\b(\d{4})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function extractSeason(premiered: string): string | null {
  if (!premiered) return null;
  const lower = premiered.toLowerCase();
  if (lower.includes('spring')) return 'SPRING';
  if (lower.includes('summer')) return 'SUMMER';
  if (lower.includes('fall') || lower.includes('autumn')) return 'FALL';
  if (lower.includes('winter')) return 'WINTER';
  return null;
}

function extractAnilistId(imageUrl: string): number | null {
  if (!imageUrl) return null;
  const m = imageUrl.match(/\/bx(\d+)-/);
  return m ? parseInt(m[1], 10) : null;
}

function mapHianimeType(t: string): string {
  if (!t) return 'TV';
  const map: Record<string, string> = {
    'TV': 'TV', 'Movie': 'MOVIE', 'OVA': 'OVA', 'ONA': 'ONA',
    'Special': 'SPECIAL', 'Music': 'MUSIC',
  };
  return map[t] || 'TV';
}

function mapHianimeStatus(s: string): string {
  if (!s) return 'FINISHED';
  if (s.includes('Currently Airing') || s.includes('Airing') || s.includes('Ongoing')) return 'RELEASING';
  if (s.includes('Finished Airing') || s.includes('Finished')) return 'FINISHED';
  if (s.includes('Not yet aired') || s.includes('Not Yet Aired') || s.includes('Upcoming')) return 'NOT_YET_RELEASED';
  if (s.includes('RELEASING')) return 'RELEASING';
  if (s.includes('FINISHED')) return 'FINISHED';
  return 'FINISHED';
}

function parseScore(s: string | null): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n * 10) / 10;
}

// ─── List all anime (cursor pagination) ───────────────────

export async function getHianimeAnimeList(
  limit = 50,
  nextCursor?: string
): Promise<{ animes: AniListMedia[]; nextCursor: string | null; hasNextPage: boolean }> {
  let path = `/anime?limit=${limit}`;
  if (nextCursor) path += `&nextCursor=${nextCursor}`;
  const data = await apiFetch<HianimeAnimeListResponse>(path);
  if (!data) return { animes: [], nextCursor: null, hasNextPage: false };

  const mapped = await Promise.all(data.animes.map(a => mapAnime(a)));
  return {
    animes: mapped.filter(Boolean) as AniListMedia[],
    nextCursor: data.nextCursor || null,
    hasNextPage: data.hasNextPage,
  };
}

// ─── Browse by category (page-based) ─────────────────────

export async function getHianimeCategory(
  type?: string,
  page = 1,
  limit = 20
): Promise<{ animes: AniListMedia[]; total: number; page: number; totalPages: number }> {
  let path = `/category?page=${page}&limit=${limit}`;
  if (type) path += `&type=${type}`;
  const data = await apiFetch<HianimeCategoryResponse>(path);
  if (!data) return { animes: [], total: 0, page, totalPages: 0 };

  const mapped = await Promise.all(data.animes.map(a => mapAnime(a)));
  return {
    animes: mapped.filter(Boolean) as AniListMedia[],
    total: data.meta.total,
    page: data.meta.page,
    totalPages: data.meta.totalPages,
  };
}

// ─── Get all episodes for an anime (by MongoDB _id) ──────

export async function getHianimeEpisodes(
  mongoId: string
): Promise<{ total: number; episodes: HianimeEpisode[] }> {
  const data = await apiFetch<HianimeEpisodeListResponse>(`/episodes/${mongoId}`);
  if (!data) return { total: 0, episodes: [] };
  return { total: data.total, episodes: data.episodes };
}

function hashStringToNumber(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}
