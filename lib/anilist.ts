// NexAnime — AniList GraphQL API client
// Free, public, no auth needed for reads
// Rate limit: 90 requests/minute

import type {
  AniListMedia,
  AniListAiringSchedule,
  AniListPageInfo,
  AniListSearchResult,
  AnimeSeason,
  BrowseFilters,
} from '@/types';
import { queryOne, execute } from '@/lib/db';

const ANILIST_API = 'https://graphql.anilist.co';

// ─── Rate limiter ────────────────────────────────────────

const RATE_LIMIT = 80; // AniList allows 90/min, stay just under
const RATE_WINDOW = 60_000;
let requestTimestamps: number[] = [];
const queue: Array<() => void> = [];
let activeCount = 0;
const MAX_CONCURRENT = 8; // allow more parallel requests

function processQueue() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()!;
    activeCount++;
    next();
  }
}

async function waitForRateLimit(): Promise<void> {
  await new Promise<void>((resolve) => {
    const tryAcquire = () => {
      const now = Date.now();
      requestTimestamps = requestTimestamps.filter((t) => now - t < RATE_WINDOW);
      if (requestTimestamps.length >= RATE_LIMIT) {
        const oldestInWindow = requestTimestamps[0];
        const waitMs = RATE_WINDOW - (now - oldestInWindow) + 200;
        setTimeout(tryAcquire, Math.min(waitMs, 2000));
        return;
      }
      if (activeCount >= MAX_CONCURRENT) {
        queue.push(tryAcquire);
        return;
      }
      activeCount++;
      requestTimestamps.push(Date.now());
      resolve();
    };
    tryAcquire();
  });
}

function releaseRateLimit() {
  activeCount = Math.max(0, activeCount - 1);
  processQueue();
}

// ─── Core GraphQL fetch ──────────────────────────────────

async function anilistFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  retries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    await waitForRateLimit();

    try {
      const response = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
      });

      releaseRateLimit();

      if (response.status === 429) {
        const retryAfter = Math.min(parseInt(response.headers.get('Retry-After') || '10'), 15);
        const waitMs = retryAfter * 1000;
        console.log(`[AniList] Rate limited, waiting ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AniList API error ${response.status}: ${text}`);
      }

      const json = await response.json();
      if (json.errors) {
        throw new Error(`AniList GraphQL error: ${JSON.stringify(json.errors)}`);
      }

      return json.data as T;
    } catch (err) {
      releaseRateLimit();
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error('AniList API: max retries exceeded');
}

// ─── GraphQL fragments ──────────────────────────────────

const MEDIA_FRAGMENT = `
  fragment MediaFields on Media {
    id
    idMal
    title {
      romaji
      english
      native
    }
    synonyms
    description(asHtml: false)
    format
    status
    season
    seasonYear
    averageScore
    meanScore
    source
    studios(isMain: true) {
      nodes {
        name
        isAnimationStudio
      }
    }
    genres
    tags {
      name
      rank
      isAdult
    }
    coverImage {
      extraLarge
      large
      medium
    }
    bannerImage
    episodes
    nextAiringEpisode {
      airingAt
      episode
    }
    streamingEpisodes {
      title
      thumbnail
      site
    }
    trailer {
      id
      site
    }
    popularity
    favourites
    stats {
      scoreDistribution {
        score
        amount
      }
    }
  }
`;

const MEDIA_DETAIL_FRAGMENT = `
  fragment MediaDetailFields on Media {
    ...MediaFields
    relations {
      edges {
        relationType(version: 2)
        node {
          ...MediaFields
        }
      }
    }
    recommendations(perPage: 12, sort: RATING_DESC) {
      nodes {
        mediaRecommendation {
          ...MediaFields
        }
      }
    }
    characters(perPage: 25, sort: [ROLE, RELEVANCE]) {
      edges {
        role
        node {
          id
          name { full }
          image { large }
        }
        voiceActors(language: JAPANESE, sort: RELEVANCE) {
          id
          name { full }
          image { large }
          languageV2
        }
      }
    }
    staff(sort: RELEVANCE, perPage: 20) {
      edges {
        role
        node {
          id
          name { full }
          image { large }
        }
      }
    }
  }
  ${MEDIA_FRAGMENT}
`;

// ─── Search / Browse ─────────────────────────────────────

export async function searchAnime(
  filters: BrowseFilters
): Promise<{ media: AniListMedia[]; pageInfo: AniListPageInfo }> {
  const query = `
    query SearchAnime(
      $page: Int,
      $perPage: Int,
      $search: String,
      $genres: [String],
      $format: MediaFormat,
      $seasonYear: Int,
      $season: MediaSeason,
      $status: MediaStatus,
      $sort: [MediaSort],
      $countryOfOrigin: CountryCode,
      $source: MediaSource,
      $tag_in: [String],
      $isAdult: Boolean
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(
          type: ANIME,
          search: $search,
          genre_in: $genres,
          format: $format,
          seasonYear: $seasonYear,
          season: $season,
          status: $status,
          sort: $sort,
          countryOfOrigin: $countryOfOrigin,
          source: $source,
          tag_in: $tag_in,
          isAdult: $isAdult
        ) {
          ...MediaFields
        }
      }
    }
    ${MEDIA_FRAGMENT}
  `;

  const variables: Record<string, unknown> = {
    page: filters.page ?? 1,
    perPage: filters.perPage ?? 20,
    sort: filters.sort ?? ['POPULARITY_DESC'],
  };

  if (filters.search) variables.search = filters.search;
  if (filters.genres?.length) variables.genres = filters.genres;
  if (filters.format) variables.format = filters.format;
  if (filters.seasonYear) variables.seasonYear = filters.seasonYear;
  if (filters.season) variables.season = filters.season;
  if (filters.status) variables.status = filters.status;
  if (filters.countryOfOrigin) variables.countryOfOrigin = filters.countryOfOrigin;
  if (filters.source) variables.source = filters.source;
  if (filters.tags?.length) variables.tag_in = filters.tags;
  if (filters.isAdult !== undefined) variables.isAdult = filters.isAdult;

  const data = await anilistFetch<AniListSearchResult>(query, variables);
  return {
    media: data.Page.media,
    pageInfo: data.Page.pageInfo,
  };
}

// ─── Trending ────────────────────────────────────────────

export async function getTrending(
  page = 1,
  perPage = 20
): Promise<{ media: AniListMedia[]; pageInfo: AniListPageInfo }> {
  return searchAnime({ sort: ['TRENDING_DESC'], page, perPage });
}

// ─── Popular (All Time) ──────────────────────────────────

export async function getPopular(
  page = 1,
  perPage = 20
): Promise<{ media: AniListMedia[]; pageInfo: AniListPageInfo }> {
  return searchAnime({ sort: ['POPULARITY_DESC'], page, perPage });
}

// ─── Top Rated ───────────────────────────────────────────

export async function getTopRated(
  page = 1,
  perPage = 20
): Promise<{ media: AniListMedia[]; pageInfo: AniListPageInfo }> {
  return searchAnime({ sort: ['SCORE_DESC'], page, perPage });
}

// ─── This Season ─────────────────────────────────────────

export async function getThisSeason(
  page = 1,
  perPage = 20
): Promise<{ media: AniListMedia[]; pageInfo: AniListPageInfo }> {
  const now = new Date();
  const month = now.getMonth();
  const seasons: AnimeSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const seasonIndex = Math.floor(month / 3);
  const season = seasons[seasonIndex];
  const year = now.getFullYear();

  return searchAnime({
    season,
    seasonYear: year,
    sort: ['POPULARITY_DESC'],
    page,
    perPage,
  });
}

// ─── Top Upcoming ────────────────────────────────────────

export async function getUpcoming(
  page = 1,
  perPage = 10
): Promise<{ media: AniListMedia[]; pageInfo: AniListPageInfo }> {
  return searchAnime({
    status: 'NOT_YET_RELEASED',
    sort: ['POPULARITY_DESC'],
    page,
    perPage,
  });
}

// ─── Anime Detail ────────────────────────────────────────

let queuedDetailIds = new Set<number>();
let detailCacheTimer: ReturnType<typeof setTimeout> | null = null;

export async function getAnimeDetail(id: number): Promise<AniListMedia | null> {
  // Always fetch fresh — reanime.to and hianime are the fast paths; AniList is the slow fallback
  const query = `
    query AnimeDetail($id: Int!) {
      Media(id: $id, type: ANIME) {
        ...MediaDetailFields
      }
    }
    ${MEDIA_DETAIL_FRAGMENT}
  `;

  const data = await anilistFetch<{ Media: AniListMedia | null }>(query, { id });
  const media = data.Media;
  if (media) {
    queueDetailCache(media);
  }
  return media;
}

const queuedDetailMedia = new Map<number, AniListMedia>();

function queueDetailCache(media: AniListMedia): void {
  if (queuedDetailMedia.has(media.id)) return;
  queuedDetailMedia.set(media.id, media);
  if (detailCacheTimer) clearTimeout(detailCacheTimer);
  detailCacheTimer = setTimeout(async () => {
    const idsToCache = [...queuedDetailMedia.keys()];
    const itemsToCache = idsToCache.map(id => queuedDetailMedia.get(id)!);
    queuedDetailMedia.clear();
    for (const m of itemsToCache) {
      try {
        await execute(
          `INSERT INTO anime_cache
           (anilist_id, mal_id, title_romaji, title_english, title_native, synopsis, format, status, season, season_year, average_score, mean_score, genres, cover_image, banner_image, episode_count, next_airing_at, streaming_episodes, full_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(anilist_id) DO UPDATE SET
             mal_id = COALESCE(excluded.mal_id, mal_id),
             title_romaji = COALESCE(excluded.title_romaji, title_romaji),
             title_english = COALESCE(excluded.title_english, title_english),
             title_native = COALESCE(excluded.title_native, title_native),
             synopsis = COALESCE(excluded.synopsis, synopsis),
             format = COALESCE(excluded.format, format),
             status = COALESCE(excluded.status, status),
             season = COALESCE(excluded.season, season),
             season_year = COALESCE(excluded.season_year, season_year),
             average_score = COALESCE(excluded.average_score, average_score),
             mean_score = COALESCE(excluded.mean_score, mean_score),
             genres = COALESCE(excluded.genres, genres),
             cover_image = COALESCE(excluded.cover_image, cover_image),
             banner_image = COALESCE(excluded.banner_image, banner_image),
             episode_count = COALESCE(excluded.episode_count, episode_count),
             next_airing_at = COALESCE(excluded.next_airing_at, next_airing_at),
             streaming_episodes = COALESCE(excluded.streaming_episodes, streaming_episodes),
             full_data = COALESCE(excluded.full_data, full_data)`,
          [
            m.id, m.idMal || null,
            m.title?.romaji || null, m.title?.english || null, m.title?.native || null,
            m.description || null, m.format || null, m.status || null,
            m.season || null, m.seasonYear || null,
            m.averageScore || null, m.meanScore || null,
            m.genres ? JSON.stringify(m.genres) : null,
            m.coverImage?.extraLarge || m.coverImage?.large || null,
            m.bannerImage || null, m.episodes || null,
            m.nextAiringEpisode ? new Date(m.nextAiringEpisode.airingAt * 1000).toISOString() : null,
            m.streamingEpisodes ? JSON.stringify(m.streamingEpisodes) : null,
            JSON.stringify(m),
          ]
        );
      } catch {}
    }
  }, 100);
}

interface AnimeCacheRow {
  title_romaji: string | null;
  title_english: string | null;
  title_native: string | null;
  synopsis: string | null;
  format: string | null;
  status: string | null;
  season: string | null;
  season_year: number | null;
  average_score: number | null;
  mean_score: number | null;
  genres: string | null;
  cover_image: string | null;
  banner_image: string | null;
  episode_count: number | null;
  next_airing_at: string | null;
  streaming_episodes: string | null;
  mal_id: number | null;
}

function dbRowToMedia(id: number, row: AnimeCacheRow): AniListMedia {
  let streamingEps: Array<{ title: string; thumbnail?: string; url?: string; site?: string }> = [];
  try {
    if (row.streaming_episodes) streamingEps = JSON.parse(row.streaming_episodes);
  } catch {}

  return {
    id,
    idMal: row.mal_id || null,
    title: {
      romaji: row.title_romaji || 'Unknown',
      english: row.title_english || null,
      native: row.title_native || null,
    },
    synonyms: [],
    description: row.synopsis || '',
    format: row.format || 'TV',
    status: row.status || 'FINISHED',
    season: row.season || null,
    seasonYear: row.season_year || null,
    averageScore: row.average_score || null,
    meanScore: row.mean_score || null,
    studios: { nodes: [] },
    genres: row.genres ? JSON.parse(row.genres) : [],
    tags: [],
    coverImage: { extraLarge: row.cover_image || null, large: row.cover_image || null, medium: row.cover_image || null },
    bannerImage: row.banner_image || null,
    episodes: row.episode_count || null,
    nextAiringEpisode: row.next_airing_at ? { airingAt: Math.floor(new Date(row.next_airing_at).getTime() / 1000), episode: 0, timeUntilAiring: 0 } : null,
    streamingEpisodes: streamingEps,
    trailer: null,
    popularity: null,
    favourites: null,
    stats: null,
    relations: null,
    recommendations: null,
    characters: null,
    staff: null,
  } as unknown as AniListMedia;
}

// ─── Resolve MAL ID to AniList ID ─────────────────────────

export async function getAnilistIdByMalId(malId: number): Promise<number | null> {
  if (!malId) return null;
  // Check DB cache first
  const cached = await queryOne<{ anilist_id: number }>(
    'SELECT anilist_id FROM anime_cache WHERE mal_id = ?', [malId]
  );
  if (cached) return cached.anilist_id;

  // Query AniList (lightweight, just id)
  try {
    const data = await anilistFetch<{ Media: { id: number } | null }>(
      `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id } }`,
      { idMal: malId }
    );
    if (data?.Media?.id) {
      // Cache the mapping
      await execute(
        'UPDATE anime_cache SET mal_id = ? WHERE anilist_id = ?',
        [malId, data.Media.id]
      );
      return data.Media.id;
    }
  } catch {}
  return null;
}

// ─── Recently Updated (latest airing) ───────────────────

export async function getRecentlyUpdated(
  page = 1,
  perPage = 15
): Promise<AniListAiringSchedule[]> {
  const query = `
    query RecentlyUpdated($page: Int, $perPage: Int, $airingAtLesser: Int) {
      Page(page: $page, perPage: $perPage) {
        airingSchedules(
          airingAt_lesser: $airingAtLesser,
          sort: [TIME_DESC],
          notYetAired: false
        ) {
          id
          airingAt
          episode
          mediaId
          media {
            ...MediaFields
          }
        }
      }
    }
    ${MEDIA_FRAGMENT}
  `;

  const now = Math.floor(Date.now() / 1000);
  const data = await anilistFetch<{
    Page: { airingSchedules: AniListAiringSchedule[] };
  }>(query, { page, perPage, airingAtLesser: now });

  return data.Page.airingSchedules;
}

// ─── Airing Schedule (for schedule widget) ───────────────

export async function getAiringSchedule(
  startTime: number,
  endTime: number,
  page = 1,
  perPage = 50
): Promise<AniListAiringSchedule[]> {
  const query = `
    query AiringSchedule(
      $page: Int,
      $perPage: Int,
      $airingAtGreater: Int,
      $airingAtLesser: Int
    ) {
      Page(page: $page, perPage: $perPage) {
        airingSchedules(
          airingAt_greater: $airingAtGreater,
          airingAt_lesser: $airingAtLesser,
          sort: [TIME]
        ) {
          id
          airingAt
          episode
          mediaId
          media {
            ...MediaFields
          }
        }
      }
    }
    ${MEDIA_FRAGMENT}
  `;

  const data = await anilistFetch<{
    Page: { airingSchedules: AniListAiringSchedule[] };
  }>(query, {
    page,
    perPage,
    airingAtGreater: startTime,
    airingAtLesser: endTime,
  });

  return data.Page.airingSchedules;
}

// ─── Quick search (for header dropdown) ──────────────────

export async function quickSearch(
  term: string,
  perPage = 8
): Promise<AniListMedia[]> {
  if (!term.trim()) return [];
  const result = await searchAnime({ search: term, perPage, page: 1 });
  return result.media;
}

// ─── Character search (for avatar picker) ────────────────

export interface AniListCharacter {
  id: number;
  name: { full: string; native?: string };
  image: { large: string | null };
  description?: string;
  favourites?: number;
  gender?: string;
  dateOfBirth?: { year?: number; month?: number; day?: number };
  age?: string;
  bloodType?: string;
  media?: {
    edges: {
      node: {
        id: number;
        title: { english?: string; romaji?: string };
        coverImage?: { large?: string; medium?: string };
        format?: string;
        status?: string;
      };
      role: string;
    }[];
  };
  voiceActors?: {
    id: number;
    name: { full: string };
    image: { large: string | null };
    language?: string;
  }[];
}

export async function searchCharacters(
  search: string,
  page = 1,
  perPage = 30
): Promise<{ characters: AniListCharacter[]; pageInfo: AniListPageInfo }> {
  const query = `
    query SearchCharacters($page: Int, $perPage: Int, $search: String) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        characters(search: $search, sort: FAVOURITES_DESC) {
          id
          name { full }
          image { large }
        }
      }
    }
  `;

  const data = await anilistFetch<{
    Page: { pageInfo: AniListPageInfo; characters: AniListCharacter[] };
  }>(query, { page, perPage, search: search || undefined });

  return {
    characters: data.Page.characters,
    pageInfo: data.Page.pageInfo,
  };
}

export async function getCharacterById(id: number): Promise<AniListCharacter | null> {
  const query = `
    query GetCharacter($id: Int!) {
      Character(id: $id) {
        id
        name { full native }
        image { large }
        description(asHtml: false)
        favourites
        gender
        dateOfBirth { year month day }
        age
        bloodType
        media(sort: FAVOURITES_DESC, perPage: 20) {
          edges {
            node {
              id
              title { english romaji }
              coverImage { large medium }
              format
              status
            }
            role
          }
        }
        mediaConnections: staffVoiceActors(sort: FAVOURITES_DESC, perPage: 10) {
          id
          name { full }
          image { large }
          language: languageV2
        }
      }
    }
  `;

  try {
    const data = await anilistFetch<{ Character: AniListCharacter }>(query, { id });
    const char = data.Character;
    // Map voiceActors from mediaConnections
    char.voiceActors = (char as any).mediaConnections || [];
    return char;
  } catch (err) {
    console.warn(`[AniList] Character ID ${id} not found, using default fallback.`);
    return null;
  }
}

// ─── Import user list from AniList ───────────────────────

export interface AniListListEntry {
  mediaId: number;
  status: string;
  score: number;
  progress: number;
  startedAt: { year: number | null; month: number | null; day: number | null };
  completedAt: { year: number | null; month: number | null; day: number | null };
  notes: string | null;
  repeat: number;
  media: AniListMedia;
}

export async function fetchUserList(
  username: string
): Promise<AniListListEntry[]> {
  const query = `
    query UserList($username: String!) {
      MediaListCollection(userName: $username, type: ANIME) {
        lists {
          name
          entries {
            mediaId
            status
            score(format: POINT_10)
            progress
            startedAt { year month day }
            completedAt { year month day }
            notes
            repeat
            media {
              ...MediaFields
            }
          }
        }
      }
    }
    ${MEDIA_FRAGMENT}
  `;

  const data = await anilistFetch<{
    MediaListCollection: {
      lists: Array<{
        name: string;
        entries: AniListListEntry[];
      }>;
    };
  }>(query, { username });

  // Flatten all lists into a single array
  return data.MediaListCollection.lists.flatMap((list) => list.entries);
}

// ─── Lightweight recommendations fetcher ──────────────────

export async function getAnimeRecommendations(
  anilistId: number
): Promise<{ nodes: Array<{ mediaRecommendation: AniListMedia | null }> } | null> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        recommendations(page: 1, perPage: 10, sort: [RATING_DESC]) {
          nodes {
            mediaRecommendation {
              id
              title { romaji english native }
              coverImage { extraLarge large medium }
              format
              status
              seasonYear
              averageScore
              description
              genres
            }
          }
        }
      }
    }
  `;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { id: anilistId } }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    const json = await response.json();
    if (json.errors) return null;
    return json.data?.Media?.recommendations || null;
  } catch {
    return null;
  }
}

// ─── Helper: convert AniList media to local Anime type ───

import type { Anime } from '@/types';

export function anilistMediaToAnime(media: AniListMedia): Anime {
  return {
    anilistId: media.id,
    titleRomaji: media.title.romaji,
    titleEnglish: media.title.english,
    titleNative: media.title.native,
    synonyms: media.synonyms ?? [],
    synopsis: media.description,
    format: media.format,
    status: media.status,
    season: media.season,
    seasonYear: media.seasonYear,
    averageScore: media.averageScore,
    meanScore: media.meanScore,
    source: media.source,
    studios: media.studios?.nodes
      ?.filter((s) => s.isAnimationStudio || (s as any).isMain)
      .map((s) => s.name) ?? [],
    genres: media.genres ?? [],
    tags: media.tags?.map((t) => ({
      name: t.name,
      rank: t.rank,
      isAdult: t.isAdult,
    })) ?? [],
    coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    bannerImage: media.bannerImage,
    episodeCount: media.episodes,
    nextAiringAt: media.nextAiringEpisode
      ? new Date(media.nextAiringEpisode.airingAt * 1000).toISOString()
      : null,
    cachedAt: null,
  };
}
