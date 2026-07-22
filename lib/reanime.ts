import type { AniListMedia, CharacterWithVA, StaffEntry, BrowseFilters } from '@/types';
import { getJikanCharacters, getJikanStaff } from './jikan-api';

const API_BASE = 'https://reanime.to/api/v1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── In-memory cache ──────────────────────────────────────

interface CacheEntry<T> { data: T; expiry: number }
const cache = new Map<string, CacheEntry<unknown>>();
const TTL = 600_000;

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

// ─── API fetch helper ──────────────────────────────────────

async function apiFetch<T>(path: string, timeoutMs = 10000): Promise<T | null> {
  const key = `reanime:api:${path}`;
  const cachedVal = cached<T>(key);
  if (cachedVal !== null) return cachedVal;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const json = await res.json();
    setCache(key, json);
    return json as T;
  } catch {
    return null;
  }
}

// ─── Raw API types from reanime.to ─────────────────────────

export interface ReanimeAnimeItem {
  anilist_id: number;
  mal_id: number;
  anime_id: string;
  title: { english: string | null; native: string | null; romaji: string | null; user_preferred: string | null };
  description: string | null;
  format: string | null;
  type: string | null;
  status: string | null;
  season: string | null;
  season_year: number | null;
  average_score: number | null;
  mean_score: number | null;
  mal_score: number | null;
  popularity: number | null;
  trending: number | null;
  favourites: number | null;
  duration: number | null;
  source: string | null;
  rating: string | null;
  is_adult: boolean;
  country_of_origin: string | null;
  hashtag: string | null;
  cover_image: { color: string; extra_large: string; large: string; medium: string } | null;
  banner_image: string | null;
  episodes_total: number | null;
  chapters: number | null;
  volumes: number | null;
  start_date: string | null;
  end_date: string | null;
  last_episode: number | null;
  last_episode_aired_at: string | null;
  genres: string[];
  synonyms: string[];
  tags: Array<{ id: number; name: string; description: string; category: string; rank: number; is_spoiler: boolean; is_adult: boolean }>;
  studios: Array<{ id: number; name: string; is_main: boolean }>;
  relations: Array<{
    anime: ReanimeAnimeItem;
    relation_type: string;
  }>;
  characters: Array<{ id: number; name: string; role: string; image?: string }>;
  staff: Array<{ id: number; name: string; role: string; image?: string }>;
  score_distribution: Array<{ score: number; amount: number }>;
  status_distribution: Array<{ status: string; amount: number }>;
  rankings: Array<{ rank: number; type: string; context: string; format: string; season: string; all_time: boolean }>;
  external_links: Array<{ id: number; site: string; url: string }>;
  artworks: string[];
  youtube_trailer_id: string | null;
  trailer: { id: string; site: string; thumbnail: string } | null;
  next_airing_episode: { airing_at: number; episode: number; time_until_airing: number } | null;
  sub_release: { airing_at: number; episode: number } | null;
  anidb_id: number | null;
  kitsu_id: number | null;
  livechart_id: number | null;
  simkl_id: number | null;
  themoviedb_id: number | null;
  tvdb_id: number | null;
  imdb_id: string | null;
  anime_planet_id: string | null;
  animecountdown_id: number | null;
  animenewnetwork_id: number | null;
  anisearch_id: number | null;
  subbed: boolean;
  dubbed: boolean;
  is_licensed: boolean;
  is_locked: boolean;
  can_watch: boolean;
  can_request: boolean;
  requested: boolean;
}

export interface ReanimeHomeSection {
  trending: ReanimeAnimeItem[];
  latest_aired: ReanimeAnimeItem[];
  new_on_site: ReanimeAnimeItem[];
  upcoming: ReanimeAnimeItem[];
}

export interface ReanimeSearchResult {
  results: ReanimeAnimeItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReanimeRecommendation {
  anime: ReanimeAnimeItem;
  score: number;
}

export interface ReanimeEpisode {
  episode_number: number;
  title: string | null;
  thumbnail: string | null;
  aired: string | null;
  filler: boolean;
  recap: boolean;
  playable: boolean;
}

export interface ReanimeScheduleEpisode {
  anime_id: string;
  mal_id: number;
  anilist_id: number;
  title: { english: string | null; native: string | null; romaji: string | null; user_preferred: string | null };
  cover_image: { color: string; extra_large: string; large: string; medium: string } | null;
  banner_image: string | null;
  description: string | null;
  format: string;
  status: string;
  genres: string;
  season: string;
  season_year: number;
  duration: string;
  subbed: number;
  dubbed: number;
  average_score: number;
  popularity: number;
  route: string;
  episode_number: number;
  episodes_total: number | null;
  delayed_from: number | null;
  delayed_until: number | null;
  airing_status: string;
  episode_date: string;
  air_type: string;
}

export interface ReanimeScheduleItem {
  anime: ReanimeAnimeItem;
  airing_at: number;
  episode: number;
  airing_status: string;
  delayed_from: number | null;
  delayed_until: number | null;
  air_type: string;
  day: string;
  week: string;
}

export interface ReanimeWatchData {
  anime: ReanimeAnimeItem;
  episode: ReanimeEpisode;
}

// ─── Home ──────────────────────────────────────────────────

export async function getReanimeHome(): Promise<ReanimeHomeSection | null> {
  const data = await apiFetch<ReanimeHomeSection>('/home', 20000);
  if (!data) return null;
  return data;
}

// ─── Anime detail ──────────────────────────────────────────

export async function getReanimeAnimeDetail(slug: string): Promise<ReanimeAnimeItem | null> {
  const data = await apiFetch<ReanimeAnimeItem>(`/anime/${slug}`);
  if (!data?.anilist_id) return null;
  return data;
}

// ─── Search ────────────────────────────────────────────────

export async function searchReanime(params: {
  q?: string;
  genre?: string;
  studio?: string;
  season?: string;
  year?: number;
  format?: string;
  status?: string;
  sort?: string;
  country?: string;
  type?: string;
  is_adult?: boolean;
  has_dub?: boolean;
  has_sub?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ReanimeSearchResult | null> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.genre) searchParams.set('genre', params.genre);
  if (params.studio) searchParams.set('studio', params.studio);
  if (params.season) searchParams.set('season', params.season);
  if (params.year) searchParams.set('year', params.year.toString());
  if (params.format) searchParams.set('format', params.format);
  if (params.status) searchParams.set('status', params.status);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.country) searchParams.set('country', params.country);
  if (params.type) searchParams.set('type', params.type);
  if (params.is_adult !== undefined) searchParams.set('is_adult', params.is_adult.toString());
  if (params.has_dub !== undefined) searchParams.set('has_dub', params.has_dub.toString());
  if (params.has_sub !== undefined) searchParams.set('has_sub', params.has_sub.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());

  const qs = searchParams.toString();
  const data = await apiFetch<ReanimeSearchResult>(`/search${qs ? `?${qs}` : ''}`);
  if (!data) return null;
  return data;
}

// ─── Schedule ──────────────────────────────────────────────

interface ReanimeScheduleResponse {
  month: number;
  year: number;
  timezone: string;
  schedule: Array<{
    date: string;
    day: string;
    episodes: ReanimeScheduleEpisode[];
  }>;
}

export async function getReanimeSchedule(): Promise<ReanimeScheduleItem[] | null> {
  const data = await apiFetch<ReanimeScheduleResponse>('/schedule');
  if (!data?.schedule) return null;

  const items: ReanimeScheduleItem[] = [];
  for (const day of data.schedule) {
    for (const ep of day.episodes) {
      items.push({
        anime: ep as unknown as ReanimeAnimeItem,
        airing_at: new Date(ep.episode_date || day.date).getTime() / 1000,
        episode: ep.episode_number,
        airing_status: ep.airing_status,
        delayed_from: ep.delayed_from ?? null,
        delayed_until: ep.delayed_until ?? null,
        air_type: ep.air_type || '',
        day: day.day,
        week: day.date,
      });
    }
  }
  return items;
}

// ─── Recommendations ───────────────────────────────────────

export async function getReanimeRecommendations(slug: string): Promise<ReanimeRecommendation[] | null> {
  const data = await apiFetch<ReanimeRecommendation[]>(`/anime/${slug}/recommendations`);
  return data;
}

// ─── Episodes (paginated) ──────────────────────────────────

interface ReanimeEpisodesResponse {
  data: ReanimeEpisode[];
  total: number;
  totalPages: number;
  limit: number;
  offset: number;
  source: string;
}

export async function getReanimeEpisodes(slug: string): Promise<ReanimeEpisode[] | null> {
  const first = await apiFetch<ReanimeEpisodesResponse>(`/anime/${slug}/episodes?limit=50&offset=0`);
  if (!first?.data) return null;

  let all = [...first.data];
  const totalPages = first.totalPages || 1;

  // Fetch remaining pages in parallel
  if (totalPages > 1) {
    const pages = [];
    for (let p = 1; p < totalPages; p++) {
      pages.push(apiFetch<ReanimeEpisodesResponse>(`/anime/${slug}/episodes?limit=50&offset=${p * 50}`));
    }
    const results = await Promise.allSettled(pages);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value?.data) {
        all.push(...r.value.data);
      }
    }
  }

  return all;
}

// ─── Watch data ────────────────────────────────────────────

export async function getReanimeWatchData(slug: string): Promise<ReanimeWatchData | null> {
  const data = await apiFetch<ReanimeWatchData>(`/watch/${slug}`);
  return data;
}

// ─── Health ────────────────────────────────────────────────

export async function getReanimeHealth(): Promise<string | null> {
  const data = await apiFetch<string>('/health');
  return data;
}

// ─── Build slug mapping from search ────────────────────────

let slugMappingCache: Map<number, { slug: string; malId: number }> | null = null;
let slugMappingExpiry = 0;

export async function buildSlugMapping(): Promise<Map<number, { slug: string; malId: number }>> {
  if (slugMappingCache && Date.now() < slugMappingExpiry) return slugMappingCache;

  const mapping = new Map<number, { slug: string; malId: number }>();

  // Reanime caps at 20 per page — paginate to get more
  const PER_PAGE = 20;
  const MAX_PAGES = 50; // 50 pages * 20 = 1000 items max
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const results = await apiFetch<ReanimeSearchResult>(`/search?limit=${PER_PAGE}&offset=${offset}`, 8000);
    if (!results?.results?.length) break;

    for (const item of results.results) {
      const anilistId = extractAnilistId(item);
      if (anilistId && item.anime_id) {
        mapping.set(anilistId, { slug: item.anime_id, malId: item.mal_id || 0 });
      }
    }

    offset += PER_PAGE;
    if (offset >= (results.total || 0)) break;
  }

  slugMappingCache = mapping;
  slugMappingExpiry = Date.now() + 3600_000;
  return mapping;
}

// ─── Get detail by AniList ID (fast: uses MAL ID lookup) ───

export async function getReanimeByAnilistId(anilistId: number): Promise<ReanimeAnimeItem | null> {
  // Try to get MAL ID from DB cache first (fastest)
  const { queryOne } = await import('./db');
  const cached = await queryOne<{ mal_id: number }>(
    'SELECT mal_id FROM anime_cache WHERE anilist_id = ? AND mal_id IS NOT NULL',
    [anilistId]
  );
  if (cached?.mal_id) {
    const slug = await getSlugByMalIdCached(cached.mal_id);
    if (slug) {
      const detail = await getReanimeAnimeDetail(slug);
      if (detail) return detail;
    }
  }

  // Fallback: try AniList to get MAL ID (fast GraphQL query)
  try {
    const { getAnilistIdByMalId: _noop } = await import('./anilist');
    // Reverse lookup: query AniList for MAL ID
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query ($id: Int!) { Media(id: $id, type: ANIME) { idMal } }`,
        variables: { id: anilistId },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      const malId = json?.data?.Media?.idMal;
      if (malId) {
        // Cache for future lookups
        const { execute } = await import('./db');
        await execute(
          'INSERT OR REPLACE INTO anime_cache (anilist_id, mal_id) VALUES (?, ?) ON CONFLICT(anilist_id) DO UPDATE SET mal_id = excluded.mal_id',
          [anilistId, malId]
        );
        const slug = await getSlugByMalIdCached(malId);
        if (slug) {
          const detail = await getReanimeAnimeDetail(slug);
          if (detail) return detail;
        }
      }
    }
  } catch {}

  // Last resort: build full slug mapping (slow, cached 1hr)
  const mapping = await buildSlugMapping();
  const entry = mapping.get(anilistId);
  if (!entry?.slug) return null;
  return getReanimeAnimeDetail(entry.slug);
}

// ─── MAL ID → slug cache (small targeted search) ──────────

const malSlugCache = new Map<number, string | null>();
const malSlugCacheExpiry = new Map<number, number>();

async function getSlugByMalIdCached(malId: number): Promise<string | null> {
  const now = Date.now();
  if (malSlugCache.has(malId)) {
    const expiry = malSlugCacheExpiry.get(malId) || 0;
    if (now < expiry) return malSlugCache.get(malId) || null;
  }

  // Search specifically for this MAL ID using reanime's search
  const results = await apiFetch<ReanimeSearchResult>(`/search?limit=20&offset=0`, 8000);
  if (results?.results) {
    for (const r of results.results) {
      if (r.mal_id) {
        malSlugCache.set(r.mal_id, r.anime_id);
        malSlugCacheExpiry.set(r.mal_id, now + 3600_000);
      }
    }
  }
  return malSlugCache.get(malId) || null;
}

// ─── Get episodes with thumbnails (fast MAL ID path) ──────

export async function getReanimeEpisodesByAnilistId(anilistId: number): Promise<ReanimeEpisode[] | null> {
  // Get MAL ID from cache
  const { queryOne } = await import('./db');
  const cached = await queryOne<{ mal_id: number }>(
    'SELECT mal_id FROM anime_cache WHERE anilist_id = ? AND mal_id IS NOT NULL',
    [anilistId]
  );
  if (cached?.mal_id) {
    const slug = await getSlugByMalIdCached(cached.mal_id);
    if (slug) return getReanimeEpisodes(slug);
  }

  // Try full mapping
  const mapping = await buildSlugMapping();
  const entry = mapping.get(anilistId);
  if (entry?.slug) return getReanimeEpisodes(entry.slug);
  return null;
}

// ─── Get MAL ID → slug mapping ────────────────────────────

export async function getSlugByMalId(malId: number): Promise<string | null> {
  const results = await searchReanime({ limit: 50 });
  if (results?.results) {
    const found = results.results.find(r => r.mal_id === malId);
    if (found?.anime_id) return found.anime_id;
  }
  return null;
}

// ─── Map ReanimeAnimeItem → AniListMedia ───────────────────

export function mapAnimeDetail(anime: ReanimeAnimeItem): AniListMedia {
  return {
    id: anime.anilist_id,
    idMal: anime.mal_id || null,
    title: {
      romaji: anime.title?.romaji || anime.title?.user_preferred || 'Unknown',
      english: anime.title?.english || null,
      native: anime.title?.native || null,
    },
    synonyms: anime.synonyms || [],
    description: anime.description?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') || '',
    format: anime.type || anime.format || 'TV',
    status: mapStatus(anime.status),
    season: anime.season || null,
    seasonYear: anime.season_year || null,
    averageScore: anime.average_score || null,
    meanScore: anime.mean_score || anime.mal_score || anime.average_score || null,
    source: anime.source?.replace(/_/g, ' ') || null,
    popularity: anime.popularity || null,
    favourites: anime.favourites || null,
    studios: { nodes: (anime.studios || []).map(s => ({ name: s.name, isAnimationStudio: s.is_main })) },
    genres: anime.genres || [],
    tags: (anime.tags || []).map(t => ({ name: t.name, rank: t.rank || 0, isAdult: t.is_adult || false })),
    coverImage: {
      extraLarge: anime.cover_image?.extra_large || null,
      large: anime.cover_image?.large || null,
      medium: anime.cover_image?.medium || null,
    },
    bannerImage: anime.banner_image || null,
    episodes: anime.episodes_total || null,
    lastEpisode: anime.last_episode || null,
    nextAiringEpisode: anime.next_airing_episode ? {
      airingAt: anime.next_airing_episode.airing_at,
      episode: anime.next_airing_episode.episode,
      timeUntilAiring: anime.next_airing_episode.time_until_airing,
    } : null,
    streamingEpisodes: [],
    trailer: anime.youtube_trailer_id ? { id: anime.youtube_trailer_id, site: 'youtube' }
      : anime.trailer ? { id: anime.trailer.id, site: anime.trailer.site } : null,
    characters: {
      edges: (anime.characters || []).map(c => ({
        role: c.role || 'MAIN',
        node: {
          id: c.id,
          name: { full: c.name || 'Unknown' },
          image: { large: c.image || `https://img.anili.st/media/${c.id}` },
        },
        voiceActors: [],
      })),
    },
    staff: {
      edges: (anime.staff || []).map(s => ({
        role: s.role || 'Staff',
        node: {
          id: s.id,
          name: { full: s.name || 'Unknown' },
          image: { large: s.image || `https://img.anili.st/media/${s.id}` },
        },
      })),
    },
    relations: Array.isArray(anime.relations) ? {
      edges: anime.relations.map(r => ({
        relationType: r.relation_type || 'UNKNOWN',
        node: r.anime ? {
          id: r.anime.anilist_id || 0,
          idMal: r.anime.mal_id || null,
          title: {
            romaji: r.anime.title?.romaji || '',
            english: r.anime.title?.english || null,
            native: r.anime.title?.native || null,
          },
          format: r.anime.type || r.anime.format || 'TV',
          status: mapStatus(r.anime.status),
          season: r.anime.season || null,
          seasonYear: r.anime.season_year || null,
          averageScore: r.anime.average_score || null,
          meanScore: r.anime.mean_score || null,
          source: r.anime.source || null,
          popularity: r.anime.popularity || null,
          favourites: r.anime.favourites || null,
          studios: { nodes: [] },
          genres: r.anime.genres || [],
          tags: [],
          coverImage: {
            extraLarge: r.anime.cover_image?.extra_large || null,
            large: r.anime.cover_image?.large || null,
            medium: r.anime.cover_image?.medium || null,
          },
          bannerImage: r.anime.banner_image || null,
          episodes: r.anime.episodes_total || null,
          nextAiringEpisode: null,
          streamingEpisodes: [],
          trailer: null,
          characters: { edges: [] },
          staff: { edges: [] },
          relations: null,
          recommendations: null,
          stats: null,
          synonyms: [],
          description: r.anime.description || '',
        } as unknown as AniListMedia : null,
      })).filter(e => e.node),
    } : null,
    recommendations: null,
    stats: anime.score_distribution ? {
      scoreDistribution: anime.score_distribution.map(sd => ({ score: sd.score, amount: sd.amount })),
    } : null,
  } as unknown as AniListMedia;
}

// ─── Map home item ─────────────────────────────────────────

export function mapHomeItem(item: ReanimeAnimeItem): AniListMedia | null {
  const id = extractAnilistId(item);
  if (!id) return null;
  return {
    id,
    idMal: item.mal_id || null,
    title: {
      romaji: item.title?.romaji || item.title?.user_preferred || 'Unknown',
      english: item.title?.english || null,
      native: item.title?.native || null,
    },
    description: item.description?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') || '',
    format: item.type || item.format || 'TV',
    status: mapStatus(item.status),
    season: item.season || null,
    seasonYear: item.season_year || null,
    averageScore: item.average_score || null,
    meanScore: item.mal_score || item.average_score || null,
    popularity: item.popularity || null,
    studios: { nodes: [] },
    genres: item.genres || [],
    tags: [],
    coverImage: {
      extraLarge: item.cover_image?.extra_large || null,
      large: item.cover_image?.large || null,
      medium: item.cover_image?.medium || null,
    },
    bannerImage: item.banner_image || null,
    episodes: item.episodes_total || null,
    lastEpisode: item.last_episode || null,
    nextAiringEpisode: item.next_airing_episode ? {
      airingAt: item.next_airing_episode.airing_at,
      episode: item.next_airing_episode.episode,
    } : null,
    streamingEpisodes: [],
    trailer: item.youtube_trailer_id ? { id: item.youtube_trailer_id, site: 'youtube' } : null,
    characters: { edges: [] },
    staff: { edges: [] },
    relations: null,
    recommendations: null,
    stats: null,
    synonyms: item.synonyms || [],
  } as unknown as AniListMedia;
}

// ─── Map schedule item ─────────────────────────────────────

export function mapScheduleItem(item: ReanimeScheduleItem): {
  media: AniListMedia;
  airingAt: number;
  episode: number;
} | null {
  if (!item.anime) return null;
  const media = mapHomeItem(item.anime);
  if (!media) return null;
  return {
    media,
    airingAt: item.airing_at,
    episode: item.episode,
  };
}

// ─── Extract AniList ID from cover image URL ───────────────

function extractAnilistId(item: { anilist_id?: number | string | null; cover_image?: { extra_large?: string | null; large?: string | null; medium?: string | null } | null }): number | null {
  if (item.anilist_id && Number(item.anilist_id) > 0) return Number(item.anilist_id);
  const url = item.cover_image?.extra_large || item.cover_image?.large || '';
  const match = url.match(/[\\/]bx(\d+)-/);
  if (match) return parseInt(match[1], 10);
  return null;
}

// ─── Helpers ──────────────────────────────────────────────

function mapStatus(s: string | null | undefined): string {
  if (!s) return 'FINISHED';
  const lower = s.toLowerCase();
  if (lower.includes('releas') || lower.includes('airing')) return 'RELEASING';
  if (lower.includes('not yet') || lower.includes('upcoming')) return 'NOT_YET_RELEASED';
  if (lower.includes('hiatus')) return 'HIATUS';
  if (lower.includes('cancel')) return 'CANCELLED';
  return 'FINISHED';
}

// ─── Character/staff image from AniList CDN ────────────────

export function getCharacterImageUrl(anilistCharId: number): string {
  return `https://img.anili.st/media/${anilistCharId}`;
}

export function getStaffImageUrl(anilistStaffId: number): string {
  return `https://img.anili.st/media/${anilistStaffId}`;
}
