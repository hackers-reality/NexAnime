// NexAnime — AniList GraphQL API client
// Free, public, no auth needed for reads
// Rate limit: 90 requests/minute

import type {
  AniListMedia,
  AniListSearchResult,
  AniListAiringSchedule,
  AniListPageInfo,
  AnimeFormat,
  AnimeStatus,
  AnimeSeason,
  BrowseFilters,
} from '@/types';

const ANILIST_API = 'https://graphql.anilist.co';

// ─── Rate limiter ────────────────────────────────────────

let requestTimestamps: number[] = [];
const RATE_LIMIT = 85; // stay under 90/min
const RATE_WINDOW = 60_000; // 1 minute

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter((t) => now - t < RATE_WINDOW);
  if (requestTimestamps.length >= RATE_LIMIT) {
    const oldestInWindow = requestTimestamps[0];
    const waitMs = RATE_WINDOW - (now - oldestInWindow) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  requestTimestamps.push(Date.now());
}

// ─── Core GraphQL fetch ──────────────────────────────────

async function anilistFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  retries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    await waitForRateLimit();

    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
      const waitMs = (retryAfter || 5) * 1000 * (attempt + 1);
      console.log(`AniList rate limited, waiting ${waitMs}ms before retry ${attempt + 1}/${retries}`);
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

// ─── Anime Detail ────────────────────────────────────────

export async function getAnimeDetail(id: number): Promise<AniListMedia | null> {
  const query = `
    query AnimeDetail($id: Int!) {
      Media(id: $id, type: ANIME) {
        ...MediaDetailFields
      }
    }
    ${MEDIA_DETAIL_FRAGMENT}
  `;

  const data = await anilistFetch<{ Media: AniListMedia | null }>(query, { id });
  return data.Media;
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
  const month = now.getMonth(); // 0-indexed
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
      ?.filter((s) => s.isAnimationStudio)
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
