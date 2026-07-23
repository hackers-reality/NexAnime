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
  start_date: { day: number; month: number; year: number } | null;
  end_date: { day: number; month: number; year: number } | null;
  last_episode: number | null;
  last_episode_aired_at: string | null;
  genres: string[];
  synonyms: string[];
  tags: Array<{ id: number; name: string; description: string; category: string; rank: number; is_spoiler: boolean; is_adult: boolean }>;
  studios: Array<{ id: number; name: string; is_main: boolean }>;
  relations: Array<{
    anime_id: string;
    relation_type: string;
    title: { english?: string | null; native?: string | null; romaji?: string | null; user_preferred?: string | null };
    cover_image: { color?: string; extra_large?: string | null; large?: string | null };
    format: string;
    season?: string | null;
    season_year?: number | null;
    status?: string | null;
    episodes_total?: number | null;
  }>;
  characters: Array<{ id: number; name: string; role: string; image?: string }>;
  staff: Array<{ id: number; name: string; role: string; image?: string }>;
  score_distribution: Array<{ score: number; amount: number }> | null;
  status_distribution: Array<{ status: string; amount: number }> | null;
  rankings: Array<{ rank: number; type: string; context: string; format: string; season: string; all_time: boolean; id?: number; year?: number }>;
  external_links: Array<{ id: number; site: string; url: string; type?: string; language?: string }>;
  artworks: Array<{ height: number; image_type: string; source: string; url: string }> | string[];
  youtube_trailer_id: string | null;
  trailer: { id: string; site: string; thumbnail: string } | null;
  next_airing_episode: { airing_at: number; episode: number; time_until_airing: number } | null;
  sub_release: { airing_at: number; episode: number } | null;
  recommendation_ids: string[];
  subbed: number;
  dubbed: number;
  is_licensed: boolean;
  is_locked: boolean;
  can_watch: boolean;
  can_request: boolean;
  requested: boolean;
  last_updated: string;
  updated_at: string;
  anidb_id: number | null;
  kitsu_id: number | null;
  livechart_id: number | null;
  simkl_id: number | null;
  themoviedb_id: number | null;
  tvdb_id: number | null;
  imdb_id: string | null;
  anime_planet_id: string | null;
  animecountdown_id: number | null;
  animenewsnetwork_id: number | null;
  anisearch_id: number | null;
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
  id: string;
  title: { english: string | null; romaji: string | null };
  cover_image: { color: string | null; extra_large: string | null; large: string | null; medium: string | null };
  format: string;
  year: number | null;
  status: string;
  episodeCount: number;
  genres: string[];
  average_score: number;
  rating: string | null;
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
  const data = await apiFetch<{ recommendations: ReanimeRecommendation[] }>(`/anime/${slug}/recommendations`);
  return data?.recommendations || null;
}

export function mapReanimeRecommendation(rec: ReanimeRecommendation, targetId?: string): AniListMedia | null {
  if (!rec) return null;
  return {
    id: 0,
    title: {
      romaji: rec.title?.romaji || 'Unknown',
      english: rec.title?.english || null,
      native: null,
    },
    synonyms: [],
    description: '',
    format: rec.format || 'TV',
    status: mapStatus(rec.status),
    season: null,
    seasonYear: rec.year || null,
    averageScore: rec.average_score || null,
    meanScore: rec.average_score || null,
    source: null,
    popularity: null,
    favourites: null,
    studios: { nodes: [] },
    genres: rec.genres || [],
    tags: [],
    coverImage: {
      extraLarge: rec.cover_image?.extra_large || null,
      large: rec.cover_image?.large || null,
      medium: rec.cover_image?.medium || null,
    },
    bannerImage: null,
    episodes: rec.episodeCount || null,
    lastEpisode: null,
    nextAiringEpisode: null,
    streamingEpisodes: [],
    trailer: null,
    characters: { edges: [] },
    staff: { edges: [] },
    relations: null,
    recommendations: null,
    stats: null,
    rating: rec.rating || null,
  } as unknown as AniListMedia;
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
  // Try anilist slug cache first (fastest)
  const cachedSlug = await getSlugByAnilistIdCached(anilistId);
  if (cachedSlug) {
    const detail = await getReanimeAnimeDetail(cachedSlug);
    if (detail) return detail;
  }

  // Try to get MAL ID from DB cache first (fast)
  const { queryOne } = await import('./db');
  const cached = await queryOne<{ mal_id: number }>(
    'SELECT mal_id FROM anime_cache WHERE anilist_id = ? AND mal_id IS NOT NULL',
    [anilistId]
  );
  if (cached?.mal_id) {
    const slug = await getSlugByMalIdCached(cached.mal_id);
    if (slug) {
      const detail = await getReanimeAnimeDetail(slug);
      if (detail) {
        cacheSlugMapping(anilistId, cached.mal_id, slug);
        return detail;
      }
    }
  }

  // Try AniList to get title + MAL ID, then search reanime.to by title
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query ($id: Int!) { Media(id: $id, type: ANIME) { idMal title { romaji english } } }`,
        variables: { id: anilistId },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      const media = json?.data?.Media;
      const malId = media?.idMal;
      const title = media?.title?.romaji || media?.title?.english;
      
      if (malId) {
        const { execute } = await import('./db');
        await execute(
          'INSERT OR REPLACE INTO anime_cache (anilist_id, mal_id) VALUES (?, ?) ON CONFLICT(anilist_id) DO UPDATE SET mal_id = excluded.mal_id',
          [anilistId, malId]
        );
      }

      // Search reanime.to by title (much more reliable than MAL ID lookup)
      if (title) {
        const searchResult = await searchReanime({ q: title, limit: 10 });
        if (searchResult?.results) {
          // Find exact match by anilist_id
          const match = searchResult.results.find(r => Number(r.anilist_id) === anilistId);
          if (match?.anime_id) {
            cacheSlugMapping(anilistId, malId, match.anime_id);
            const detail = await getReanimeAnimeDetail(match.anime_id);
            if (detail) return detail;
          }
          // If no exact match, try MAL ID match
          if (malId) {
            const malMatch = searchResult.results.find(r => r.mal_id === malId);
            if (malMatch?.anime_id) {
              cacheSlugMapping(anilistId, malId, malMatch.anime_id);
              const detail = await getReanimeAnimeDetail(malMatch.anime_id);
              if (detail) return detail;
            }
          }
        }
      }
    }
  } catch {}

  // Last resort: build full slug mapping (slow, cached 1hr)
  const mapping = await buildSlugMapping();
  const entry = mapping.get(anilistId);
  if (!entry?.slug) return null;
  const detail = await getReanimeAnimeDetail(entry.slug);
  if (detail) {
    cacheSlugMapping(anilistId, entry.malId || null, entry.slug);
  }
  return detail;
}

// ─── MAL ID → slug cache (small targeted search) ──────────

const malSlugCache = new Map<number, string | null>();
const malSlugCacheExpiry = new Map<number, number>();
const anilistSlugCache = new Map<number, string | null>();
const anilistSlugCacheExpiry = new Map<number, number>();

export function cacheSlugMapping(anilistId: number, malId: number | null, slug: string): void {
  const now = Date.now();
  anilistSlugCache.set(anilistId, slug);
  anilistSlugCacheExpiry.set(anilistId, now + 3600_000);
  if (malId) {
    malSlugCache.set(malId, slug);
    malSlugCacheExpiry.set(malId, now + 3600_000);
  }
}

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

async function getSlugByAnilistIdCached(anilistId: number): Promise<string | null> {
  const now = Date.now();
  if (anilistSlugCache.has(anilistId)) {
    const expiry = anilistSlugCacheExpiry.get(anilistId) || 0;
    if (now < expiry) return anilistSlugCache.get(anilistId) || null;
  }
  return null;
}

// ─── Get episodes with thumbnails (fast MAL ID path) ──────

export async function getReanimeEpisodesByAnilistId(anilistId: number): Promise<ReanimeEpisode[] | null> {
  // Check DB cache first (valid for 30 min)
  try {
    const { queryOne } = await import('./db');
    const cached = await queryOne<{ episodes_data: string; cached_at: string }>(
      'SELECT episodes_data, cached_at FROM anime_cache WHERE anilist_id = ? AND episodes_data IS NOT NULL',
      [anilistId]
    );
    if (cached?.episodes_data) {
      const cacheAge = Date.now() - new Date(cached.cached_at + 'Z').getTime();
      if (cacheAge < 30 * 60 * 1000) { // 30 min
        const parsed = JSON.parse(cached.episodes_data);
        if (Array.isArray(parsed)) return parsed as ReanimeEpisode[];
      }
    }
  } catch {}

  // Check anilist slug cache first (fastest)
  const cachedSlug = await getSlugByAnilistIdCached(anilistId);
  if (cachedSlug) {
    const eps = await getReanimeEpisodes(cachedSlug);
    if (eps?.length) {
      cacheEpisodesInDb(anilistId, eps);
      return eps;
    }
  }

  // Try to get slug from reanime detail (this populates slug cache too)
  const detail = await getReanimeByAnilistId(anilistId);
  if (detail?.anime_id) {
    cacheSlugMapping(anilistId, detail.mal_id, detail.anime_id);
    const eps = await getReanimeEpisodes(detail.anime_id);
    if (eps?.length) {
      cacheEpisodesInDb(anilistId, eps);
      return eps;
    }
  }

  return null;
}

async function cacheEpisodesInDb(anilistId: number, episodes: ReanimeEpisode[]): Promise<void> {
  try {
    const { execute } = await import('./db');
    await execute(
      `INSERT INTO anime_cache (anilist_id, episodes_data, cached_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(anilist_id) DO UPDATE SET episodes_data = excluded.episodes_data, cached_at = datetime('now')`,
      [anilistId, JSON.stringify(episodes)]
    );
  } catch {}
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
  // Extract artworks as string URLs
  const artworkUrls = (anime.artworks || [])
    .map(a => typeof a === 'string' ? a : a?.url)
    .filter(Boolean) as string[];

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
      edges: anime.relations.filter(r => r.anime_id !== anime.anime_id).map(r => ({
        relationType: r.relation_type || 'UNKNOWN',
        node: {
          id: 0,
          idMal: null,
          title: {
            romaji: r.title?.romaji || '',
            english: r.title?.english || null,
            native: r.title?.native || null,
          },
          format: r.format || 'TV',
          status: (r as any).status || 'FINISHED',
          season: r.season || null,
          seasonYear: r.season_year || null,
          episodes: r.episodes_total || null,
          coverImage: {
            extraLarge: r.cover_image?.extra_large || null,
            large: r.cover_image?.large || null,
            medium: null,
          },
          bannerImage: null,
          averageScore: null,
          meanScore: null,
          source: null,
          popularity: null,
          favourites: null,
          studios: { nodes: [] },
          genres: [],
          tags: [],
          nextAiringEpisode: null,
          streamingEpisodes: [],
          trailer: null,
          characters: { edges: [] },
          staff: { edges: [] },
          relations: null,
          recommendations: null,
          stats: null,
          synonyms: [],
          description: '',
        } as unknown as AniListMedia,
      })),
    } : null,
    recommendations: null,
    stats: anime.score_distribution?.length ? {
      scoreDistribution: anime.score_distribution.map(sd => ({ score: sd.score, amount: sd.amount })),
    } : null,
    rating: anime.rating || null,
    duration: anime.duration || null,
    subbed: typeof anime.subbed === 'number' ? anime.subbed : null,
    dubbed: typeof anime.dubbed === 'number' ? anime.dubbed : null,
    trending: anime.trending || null,
    artworks: artworkUrls,
    externalLinks: (anime.external_links || []).map(l => ({
      id: l.id,
      site: l.site,
      url: l.url,
      type: l.type,
      language: l.language,
    })),
    startDate: anime.start_date ? {
      year: anime.start_date.year,
      month: anime.start_date.month,
      day: anime.start_date.day,
    } : null,
    endDate: anime.end_date ? {
      year: anime.end_date.year,
      month: anime.end_date.month,
      day: anime.end_date.day,
    } : null,
    countryOfOrigin: anime.country_of_origin || null,
    hashtag: anime.hashtag || null,
    isLicensed: anime.is_licensed || null,
    canWatch: anime.can_watch || null,
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
    favourites: item.favourites || null,
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
    trailer: item.youtube_trailer_id ? { id: item.youtube_trailer_id, site: 'youtube' }
      : item.trailer ? { id: item.trailer.id, site: item.trailer.site } : null,
    characters: { edges: [] },
    staff: { edges: [] },
    relations: null,
    recommendations: null,
    stats: null,
    synonyms: item.synonyms || [],
    rating: item.rating || null,
    duration: item.duration || null,
    subbed: typeof item.subbed === 'number' ? item.subbed : null,
    dubbed: typeof item.dubbed === 'number' ? item.dubbed : null,
    trending: item.trending || null,
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
