import { queryOne, execute } from './db';
import type { AniListMedia, AnimeFormat, AnimeStatus, AnimeSeason } from '@/types';

const ANIMETSU_BASES = [
  'https://animetsu.cc/v2/api/anime',
  'https://animetsu.live/v2/api/anime',
];
let activeBaseIndex = 0;

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://animetsu.cc/',
  'Origin': 'https://animetsu.cc',
};

// ─── Animetsu API response types ────────────────────────────

interface AnimetsuTitle {
  romaji: string;
  english: string | null;
  native: string | null;
}

interface AnimetsuCover {
  large: string;
  medium: string;
  small?: string;
}

interface AnimetsuSearchResult {
  id: string;
  type: string;
  title: AnimetsuTitle;
  status: string;
  is_adult: boolean;
  cover_image: AnimetsuCover;
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
  mean_score?: number;
  trailer: string | null;
  season: string;
  anilist_id?: number;
  mal_id?: number;
}

interface AnimetsuSearchResponse {
  results: AnimetsuSearchResult[];
  page: number;
  last_page: number;
  total: number;
}

interface AnimetsuInfoResponse extends AnimetsuSearchResult {
  color: string;
  clear_logo: string | null;
  mean_score: number;
  popularity: number;
  favourites: number;
  trending: number;
  source: string;
  synonyms: string;
  country: string;
  hashtag: string;
  rank: number;
  users: number;
  anilist_id: number;
  mal_id: number;
  tags: string[];
  next_airing_ep: {
    airing_at: number;
    ep_num: number;
    time_left: number;
  } | null;
  characters: Array<{
    anilist_id: number;
    name: string;
    role: string;
    image: string;
    voice_actor: {
      anilist_id: number;
      name: string;
      image: string;
      language: string;
    };
  }>;
  staff: Array<{
    name: string;
    role: string;
  }>;
  studios: Array<{
    name: string;
    is_main: boolean;
  }>;
  relations: Array<{
    id: string;
    relation_type: string;
    title: AnimetsuTitle;
    anilist_id?: number;
    poster?: AnimetsuCover | string;
    format?: string;
    status?: string;
    year?: number;
    average_score?: number;
  }>;
  recommendations: Array<{
    id: string;
    title: AnimetsuTitle;
    anilist_id?: number;
    poster?: AnimetsuCover | string;
    format?: string;
    status?: string;
    year?: number;
    average_score?: number;
  }>;
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

// ─── Flexible field extractors (handle both object & string) ──

function getTitle(raw: AnimetsuTitle | string | null | undefined): { romaji: string; english: string | null; native: string | null } {
  if (!raw) return { romaji: '', english: null, native: null };
  if (typeof raw === 'object' && raw !== null) {
    return {
      romaji: raw.romaji || raw.english || '',
      english: raw.english || null,
      native: raw.native || null,
    };
  }
  if (typeof raw === 'string') {
    const romaji = raw.match(/romaji=([^;)]+)/);
    const english = raw.match(/english=([^;)]+)/);
    const native = raw.match(/native=([^;)]+)/);
    return {
      romaji: romaji?.[1]?.trim() || '',
      english: english?.[1]?.trim() || null,
      native: native?.[1]?.trim() || null,
    };
  }
  return { romaji: '', english: null, native: null };
}

function getCoverUrl(cover: AnimetsuCover | string | null | undefined): string | null {
  if (!cover) return null;
  if (typeof cover === 'object' && cover !== null) return cover.large || cover.medium || null;
  if (typeof cover === 'string') {
    const m = cover.match(/large=([^;]+)/);
    return m?.[1] || null;
  }
  return null;
}

function extractAniListId(cover: AnimetsuCover | string | null | undefined): number | null {
  const url = getCoverUrl(cover);
  if (!url) return null;
  const m = url.match(/\/bx(\d+)-/);
  return m ? parseInt(m[1], 10) : null;
}

// ─── Mappers ─────────────────────────────────────────────────

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

function parseScore(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'string') {
    const n = parseInt(v.replace('%', ''), 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

function parseGenres(genres: string): string[] {
  return genres ? genres.split(/\s+/).filter(Boolean) : [];
}

// ─── In-memory response cache with TTL ───────────────────────

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL: Record<string, number> = {
  search: 300_000,  // 5 min
  info:   600_000,  // 10 min
  eps:    120_000,  // 2 min
  servers: 60_000,  // 1 min
};

function getCacheTtl(path: string): number {
  for (const [key, ttl] of Object.entries(CACHE_TTL)) {
    if (path.startsWith(`/${key}`)) return ttl;
  }
  return 60_000; // default 1 min
}

function cacheGet<T>(path: string): T | null {
  const entry = responseCache.get(path);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    responseCache.delete(path);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(path: string, data: T): void {
  const ttl = getCacheTtl(path);
  responseCache.set(path, { data, expiry: Date.now() + ttl });
  // Evict old entries when cache grows large
  if (responseCache.size > 500) {
    const now = Date.now();
    for (const [key, entry] of responseCache) {
      if (now > entry.expiry) responseCache.delete(key);
    }
  }
}

// ─── Core fetch with dual-base failover + cache ─────────────

async function animetsuFetch<T>(path: string): Promise<T | null> {
  const cached = cacheGet<T>(path);
  if (cached !== null) return cached;

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
      const data = await res.json() as T;
      cacheSet(path, data);
      return data;
    } catch {
      // try next base
    }
  }
  return null;
}

// ─── Background ID cache ─────────────────────────────────────

function cacheIdMapping(r: AnimetsuSearchResult): void {
  const anilistId = r.anilist_id ?? extractAniListId(r.cover_image);
  if (anilistId && r.id) {
    execute(
      "INSERT OR REPLACE INTO animetsu_id_cache (anilist_id, animetsu_id, cached_at) VALUES (?, ?, datetime('now'))",
      [anilistId, r.id]
    ).catch(() => {});
  }
}

// ─── Convert search result → AniListMedia ────────────────────

function searchResultToMedia(r: AnimetsuSearchResult): AniListMedia | null {
  if (!r) return null;
  cacheIdMapping(r);
  const titles = getTitle(r.title);
  const anilistId = r.anilist_id ?? extractAniListId(r.cover_image);
  if (!anilistId) return null; // skip results without AniList ID (can't link to them)
  const coverUrl = getCoverUrl(r.cover_image);

  return {
    id: anilistId,
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
    averageScore: parseScore(r.average_score),
    meanScore: parseScore(r.mean_score) ?? parseScore(r.average_score),
    studios: { nodes: [] },
    genres: parseGenres(r.genres),
    tags: [],
    coverImage: {
      extraLarge: coverUrl || null,
      large: coverUrl || null,
      medium: coverUrl || null,
    },
    bannerImage: r.banner || null,
    episodes: r.total_eps,
    nextAiringEpisode: null,
    streamingEpisodes: [],
    trailer: r.trailer ? { id: r.trailer, site: 'youtube' } : null,
  } as unknown as AniListMedia;
}

// ─── Public API: Basic Search ────────────────────────────────

export async function animetsuSearch(
  query: string,
  page = 1,
  limit = 20
): Promise<{ media: AniListMedia[]; total: number; lastPage: number }> {
  const data = await animetsuFetch<AnimetsuSearchResponse>(
    `/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  );
  if (!data?.results) return { media: [], total: 0, lastPage: 1 };
  const media = data.results.map(r => searchResultToMedia(r)).filter(Boolean) as AniListMedia[];
  return { media, total: data.total, lastPage: data.last_page };
}

// ─── Public API: Browse with all filters ─────────────────────

export interface AnimetsuBrowseParams {
  query?: string;
  sort?: string;
  status?: string;
  genres?: string;
  format?: string;
  season?: string;
  year?: number;
  tags?: string;
  country?: string;
  source?: string;
  page?: number;
  limit?: number;
}

function buildBrowseQuery(params: AnimetsuBrowseParams): string {
  const parts: string[] = [];
  if (params.query) parts.push(`query=${encodeURIComponent(params.query)}`);
  if (params.sort) parts.push(`sort=${params.sort}`);
  if (params.status) parts.push(`status=${params.status}`);
  if (params.genres) parts.push(`genres=${encodeURIComponent(params.genres)}`);
  if (params.format) parts.push(`format=${params.format}`);
  if (params.season) parts.push(`season=${params.season}`);
  if (params.year) parts.push(`year=${params.year}`);
  if (params.tags) parts.push(`tags=${encodeURIComponent(params.tags)}`);
  if (params.country) parts.push(`country=${params.country}`);
  if (params.source) parts.push(`source=${params.source}`);
  if (params.page) parts.push(`page=${params.page}`);
  if (params.limit) parts.push(`limit=${params.limit}`);
  return parts.join('&');
}

export async function animetsuBrowse(
  params: AnimetsuBrowseParams
): Promise<{ media: AniListMedia[]; total: number; lastPage: number }> {
  const qs = buildBrowseQuery(params);
  const data = await animetsuFetch<AnimetsuSearchResponse>(`/search?${qs}`);
  if (!data?.results) return { media: [], total: 0, lastPage: 1 };
  const media = data.results.map(r => searchResultToMedia(r)).filter(Boolean) as AniListMedia[];
  return { media, total: data.total, lastPage: data.last_page };
}

export async function animetsuTrending(page = 1, limit = 15) {
  return animetsuBrowse({ sort: 'trending', page, limit });
}

export async function animetsuPopular(page = 1, limit = 15) {
  return animetsuBrowse({ sort: 'popular', page, limit });
}

export async function animetsuTopRated(page = 1, limit = 15) {
  return animetsuBrowse({ sort: 'score', page, limit });
}

export async function animetsuSeason(season: string, year: number, page = 1, limit = 15) {
  return animetsuBrowse({ season, year, sort: 'popular', page, limit });
}

export async function animetsuUpcoming(page = 1, limit = 15) {
  return animetsuBrowse({ status: 'NOT_YET_RELEASED', sort: 'popular', page, limit });
}

// ─── Public API: Anime Detail (full info) ────────────────────

export async function animetsuGetInfo(animetsuId: string): Promise<AnimetsuInfoResponse | null> {
  const data = await animetsuFetch<AnimetsuInfoResponse>(`/info/${animetsuId}`);
  return data;
}

export function animetsuInfoToMedia(r: AnimetsuInfoResponse): AniListMedia | null {
  if (!r) return null;
  const titles = getTitle(r.title);
  const anilistId = r.anilist_id ?? extractAniListId(r.cover_image);
  if (!anilistId) return null;
  const coverUrl = getCoverUrl(r.cover_image);

  return {
    id: anilistId,
    idMal: r.mal_id ?? null,
    title: {
      romaji: titles.romaji || titles.english || 'Unknown',
      english: titles.english || null,
      native: titles.native || null,
    },
    synonyms: r.synonyms ? r.synonyms.split(/\s+/).filter(Boolean) : [],
    description: r.description?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') ?? '',
    format: mapFormat(r.format),
    status: mapStatus(r.status),
    season: mapSeason(r.season),
    seasonYear: r.year,
    averageScore: parseScore(r.average_score),
    meanScore: parseScore(r.mean_score) ?? parseScore(r.average_score),
    popularity: r.popularity ?? null,
    favourites: r.favourites ?? null,
    studios: { nodes: (r.studios || []).map(s => ({ name: s.name, isMain: s.is_main })) },
    genres: parseGenres(r.genres),
    tags: (r.tags || []).map(t => ({ name: t, rank: 50 })),
    coverImage: {
      extraLarge: coverUrl || null,
      large: coverUrl || null,
      medium: coverUrl || null,
    },
    bannerImage: r.banner || null,
    episodes: r.total_eps,
    nextAiringEpisode: r.next_airing_ep
      ? { airingAt: r.next_airing_ep.airing_at, episode: r.next_airing_ep.ep_num, timeUntilAiring: r.next_airing_ep.time_left }
      : null,
    streamingEpisodes: [],
    trailer: r.trailer ? { id: r.trailer, site: 'youtube' } : null,
    relations: {
      edges: (r.relations || []).map(rel => {
        const relId = rel.anilist_id ?? extractAniListId(rel.poster ?? null);
        const relCover = getCoverUrl(rel.poster ?? null);
        return {
          relationType: rel.relation_type,
          node: {
            id: relId ?? 0,
            title: (() => { const t = getTitle(rel.title); return { romaji: t.romaji || '', english: t.english, native: t.native }; })(),
            coverImage: { extraLarge: relCover, large: relCover, medium: relCover },
            format: mapFormat(rel.format!) || null,
            status: mapStatus(rel.status!) || null,
            season: null, seasonYear: rel.year ?? null,
            averageScore: parseScore(rel.average_score),
            meanScore: null, episodes: null,
          } as unknown as AniListMedia,
        };
      }),
    },
    recommendations: {
      nodes: (r.recommendations || []).map(rec => {
        const recId = rec.anilist_id ?? extractAniListId(rec.poster ?? null);
        const recCover = getCoverUrl(rec.poster ?? null);
        return {
          mediaRecommendation: {
            id: recId ?? 0,
            title: (() => { const t = getTitle(rec.title); return { romaji: t.romaji || '', english: t.english, native: t.native }; })(),
            coverImage: { extraLarge: recCover, large: recCover, medium: recCover },
            format: mapFormat(rec.format!) || null,
            status: mapStatus(rec.status!) || null,
            season: null, seasonYear: rec.year ?? null,
            averageScore: parseScore(rec.average_score),
            meanScore: null, episodes: null,
          } as unknown as AniListMedia,
        };
      }),
    },
    characters: {
      edges: (r.characters || []).map(char => ({
        role: char.role as 'MAIN' | 'SUPPORTING' | 'BACKGROUND',
        node: {
          id: char.anilist_id ?? 0,
          name: { full: char.name || '' },
          image: { large: char.image || null },
        },
        voiceActors: char.voice_actor ? [{
          id: char.voice_actor.anilist_id ?? 0,
          name: { full: char.voice_actor.name || '' },
          image: { large: char.voice_actor.image || null },
          languageV2: char.voice_actor.language || 'Japanese',
        }] : [],
      })),
    },
    staff: {
      edges: (r.staff || []).map(s => ({
        role: s.role || '',
        node: {
          id: 0,
          name: { full: s.name || '' },
          image: { large: null },
        },
      })),
    },
  } as unknown as AniListMedia;
}

// ─── Public API: Episodes ────────────────────────────────────

export async function animetsuGetEpisodes(animetsuId: string): Promise<AnimetsuEpisode[]> {
  const data = await animetsuFetch<AnimetsuEpisode[]>(`/eps/${animetsuId}`);
  return data ?? [];
}

// ─── Public API: Servers ─────────────────────────────────────

export async function animetsuGetServers(animetsuId: string, ep: number) {
  return await animetsuFetch<Array<{ id: string; default: boolean; tip: string }>>(
    `/servers/${animetsuId}/${ep}`
  ) ?? [];
}

// ─── AniList ID ↔ Animetsu ID bridge ────────────────────────

const idSearchCache: Map<number, string> = new Map();

export async function findAnimetsuIdByAnilistId(anilistId: number): Promise<string | null> {
  const cached = idSearchCache.get(anilistId);
  if (cached) return cached;

  const dbCached = await queryOne<{ animetsu_id: string }>(
    'SELECT animetsu_id FROM animetsu_id_cache WHERE anilist_id = ?',
    [anilistId]
  );
  if (dbCached) {
    idSearchCache.set(anilistId, dbCached.animetsu_id);
    return dbCached.animetsu_id;
  }

  // Search animetsu by AniList ID as text query
  // The search endpoint accepts AniList ID numbers as query
  const searchRes = await animetsuFetch<AnimetsuSearchResponse>(
    `/search?query=${anilistId}&limit=1`
  );
  if (searchRes?.results?.length) {
    const foundId = searchRes.results[0].id;
    idSearchCache.set(anilistId, foundId);
    await cacheAnimetsuIdDb(anilistId, foundId);
    return foundId;
  }

  return null;
}

async function cacheAnimetsuIdDb(anilistId: number, animetsuId: string): Promise<void> {
  await execute(
    "INSERT OR REPLACE INTO animetsu_id_cache (anilist_id, animetsu_id, cached_at) VALUES (?, ?, datetime('now'))",
    [anilistId, animetsuId]
  );
}

export async function cacheAnimetsuId(anilistId: number, animetsuId: string): Promise<void> {
  idSearchCache.set(anilistId, animetsuId);
  await cacheAnimetsuIdDb(anilistId, animetsuId);
}
