import type { AniListMedia, AniListAiringSchedule, AnimeFormat, BrowseFilters, CharacterWithVA, StaffEntry, ExtendedAnime } from '@/types';
import {
  getReanimeHome,
  getReanimeAnimeDetail,
  getReanimeByAnilistId,
  getReanimeSchedule,
  searchReanime,
  getReanimeRecommendations,
  mapReanimeRecommendation,
  getReanimeEpisodes,
  getReanimeEpisodesByAnilistId,
  buildSlugMapping,
  mapAnimeDetail,
  mapHomeItem,
  mapScheduleItem,
  type ReanimeAnimeItem,
} from './reanime';
import { getJikanCharacters, getJikanStaff, getJikanEpisodes } from './jikan-api';
import { getHianimeCategory, getHianimeAnimeList } from './hianime-api';
import {
  getAnimeDetail as getAnilistDetail,
  getThisSeason,
  getUpcoming,
  getRecentlyUpdated,
  getAiringSchedule as getAnilistSchedule,
  searchAnime,
  getAnilistIdByMalId,
  quickSearch,
  anilistMediaToAnime,
  getAnimeRecommendations as getAnilistRecommendations,
  getTrending,
} from './anilist';

export interface HomePayload {
  trending: AniListMedia[];
  thisSeason: AniListMedia[];
  upcoming: AniListMedia[];
  recentlyUpdated: AniListAiringSchedule[];
  schedule: AniListAiringSchedule[];
}

// ─── Home ──────────────────────────────────────────────────

async function batchFetchTrailers(ids: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (ids.length === 0) return result;
  const BATCH = 50;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query ($ids: [Int]) { Page(page: 1, perPage: 50) { media(id_in: $ids, type: ANIME) { id trailer { id site } } } }`,
          variables: { ids: batch },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const json = await res.json();
        for (const m of json?.data?.Page?.media || []) {
          if (m.trailer?.id && m.trailer?.site === 'youtube') {
            result.set(m.id, m.trailer.id);
          }
        }
      }
    } catch {}
  }
  return result;
}

export async function getHomeData(): Promise<HomePayload> {
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysSec = 7 * 24 * 60 * 60;

  // Step 1: Try reanime.to only (no AniList parallel calls)
  const [reanimeHome, reanimeSchedule] = await Promise.allSettled([
    getReanimeHome(),
    getReanimeSchedule(),
  ]);

  let trending: AniListMedia[] = [];
  let schedule: AniListAiringSchedule[] = [];
  let thisSeason: AniListMedia[] = [];
  let upcoming: AniListMedia[] = [];
  let recentlyUpdated: AniListAiringSchedule[] = [];

  // Build trending from reanime.to
  if (reanimeHome.status === 'fulfilled' && reanimeHome.value) {
    const home = reanimeHome.value;
    trending = [
      ...(home.trending || []).map(mapHomeItem).filter(Boolean),
      ...(home.latest_aired || []).map(mapHomeItem).filter(Boolean),
      ...(home.new_on_site || []).map(mapHomeItem).filter(Boolean),
    ] as AniListMedia[];
    trending = trending.filter(m => m && m.id > 0);
    const seenIds = new Set<number>();
    trending = trending.filter(m => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    }).slice(0, 20);

    // Batch-fetch missing trailers
    const missingTrailers = trending.filter(m => !m.trailer?.id).map(m => m.id).filter(Boolean);
    if (missingTrailers.length > 0) {
      const trailerMap = await batchFetchTrailers(missingTrailers);
      for (const m of trending) {
        if (!m.trailer?.id && trailerMap.has(m.id)) {
          m.trailer = { id: trailerMap.get(m.id)!, site: 'youtube' };
        }
      }
    }
  }

  // Build schedule from reanime.to
  if (reanimeSchedule.status === 'fulfilled' && reanimeSchedule.value) {
    schedule = reanimeSchedule.value
      .map(item => {
        const mapped = mapScheduleItem(item);
        if (!mapped) return null;
        return {
          id: 0,
          airingAt: mapped.airingAt,
          episode: mapped.episode,
          mediaId: mapped.media.id,
          media: mapped.media,
        } as AniListAiringSchedule;
      })
      .filter(Boolean) as AniListAiringSchedule[];
  }

  // Step 2: Only fire AniList queries if reanime.to failed or returned too little
  const needsAniListFallback = trending.length < 6 || reanimeHome.status !== 'fulfilled';

  // Always try reanime.to for thisSeason + upcoming (cheap search calls, run in parallel)
  try {
    const currentYear = new Date().getFullYear();
    const currentSeason = ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor((new Date().getMonth() / 12) * 4)] || 'WINTER';
    const [seasonSettled, upcomingSettled] = await Promise.allSettled([
      searchReanime({ season: currentSeason.toLowerCase(), year: currentYear, limit: 12 }),
      searchReanime({ status: 'not yet released', limit: 12 }),
    ]);

    if (seasonSettled.status === 'fulfilled' && seasonSettled.value?.results?.length) {
      thisSeason = seasonSettled.value.results.map(mapHomeItem).filter(Boolean) as AniListMedia[];
      const existingIds = new Set(trending.map(m => m.id));
      thisSeason = thisSeason.filter(m => !existingIds.has(m.id)).slice(0, 12);
    }

    if (upcomingSettled.status === 'fulfilled' && upcomingSettled.value?.results?.length) {
      upcoming = upcomingSettled.value.results.map(mapHomeItem).filter(Boolean) as AniListMedia[];
      const existingIds = new Set([...trending.map(m => m.id), ...thisSeason.map(m => m.id)]);
      upcoming = upcoming.filter(m => !existingIds.has(m.id)).slice(0, 12);
    }
  } catch {}

  if (needsAniListFallback) {
    // Fire AniList queries in parallel — the in-process rate limiter handles throttling
    const [trendingSettled, seasonSettled, upcomingSettled] = await Promise.allSettled([
      getTrending(1, 15),
      getThisSeason(1, 12),
      getUpcoming(1, 10),
    ]);

    if (trendingSettled.status === 'fulfilled' && trendingSettled.value?.media) {
      const existingIds = new Set(trending.map(m => m.id));
      const fillers = trendingSettled.value.media.filter(m => !existingIds.has(m.id));
      trending = [...trending, ...fillers].slice(0, 20);
    }

    if (trending.length < 6 && seasonSettled.status === 'fulfilled' && seasonSettled.value?.media) {
      const existingIds = new Set(trending.map(m => m.id));
      const fillers = seasonSettled.value.media.filter(m => !existingIds.has(m.id));
      trending = [...trending, ...fillers].slice(0, 20);
    }

    if (thisSeason.length === 0 && seasonSettled.status === 'fulfilled' && seasonSettled.value?.media) {
      const existingIds = new Set(trending.map(m => m.id));
      thisSeason = seasonSettled.value.media.filter(m => !existingIds.has(m.id)).slice(0, 12);
    }

    if (upcoming.length < 6 && upcomingSettled.status === 'fulfilled' && upcomingSettled.value?.media) {
      const existingIds = new Set([...trending.map(m => m.id), ...thisSeason.map(m => m.id), ...upcoming.map(m => m.id)]);
      const fillers = upcomingSettled.value.media.filter(m => !existingIds.has(m.id));
      upcoming = [...upcoming, ...fillers].slice(0, 12);
    }
  }

  // Step 3: Use hianime for recentlyUpdated if available, else skip
  try {
    const hianimeHome = await fetch('https://aniwatchbackend.cfd/api/home', {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (hianimeHome.ok) {
      const data = await hianimeHome.json();
      if (data?.latestEpisodes?.length) {
        recentlyUpdated = data.latestEpisodes.slice(0, 10).map((ep: any) => ({
          id: 0,
          airingAt: Math.floor(Date.now() / 1000),
          episode: ep.episodeNumber || ep.episode || 0,
          mediaId: ep.animeId || ep.id || 0,
          media: {
            id: ep.animeId || ep.id || 0,
            title: { romaji: ep.title || '', english: ep.title || '' },
            coverImage: { large: ep.image || ep.thumbnail || null, medium: ep.image || ep.thumbnail || null, extraLarge: null },
          },
        } as AniListAiringSchedule));
      }
    }
  } catch {}

  // Step 4: Fill schedule from AniList only if reanime.to failed
  if (schedule.length === 0) {
    try {
      const anilistSchedule = await getAnilistSchedule(now - 12 * 3600, now + sevenDaysSec, 1, 50);
      if (anilistSchedule?.length) schedule = anilistSchedule;
    } catch {}
  }

  return { trending, thisSeason, upcoming, recentlyUpdated, schedule };
}

// ─── Media detail ──────────────────────────────────────────

export async function getMediaDetail(anilistId: number): Promise<AniListMedia | null> {
  // Check DB cache first (instant)
  const { queryOne } = await import('./db');
  const cached = await queryOne<{ full_data: string }>(
    'SELECT full_data FROM anime_cache WHERE anilist_id = ?',
    [anilistId]
  );
  if (cached?.full_data) {
    try {
      const parsed = JSON.parse(cached.full_data) as AniListMedia;
      if (parsed?.id) {
        // If cached data is missing key fields, try to supplement from AniList
        if (hasIncompleteFields(parsed)) {
          const alDetail = await getAnilistDetail(anilistId);
          if (alDetail) mergeAnilistFields(parsed, alDetail);
        }
        return parsed;
      }
    } catch {}
  }

  // Try reanime.to first (fast MAL ID path)
  const reanimeDetail = await getReanimeByAnilistId(anilistId);
  if (reanimeDetail) {
    const media = mapAnimeDetail(reanimeDetail);
    // Reanime.to data is missing some fields (voice actors, recommendations, streaming eps, etc.)
    // Merge missing fields from AniList
    if (hasIncompleteFields(media)) {
      const alDetail = await getAnilistDetail(anilistId);
      if (alDetail) mergeAnilistFields(media, alDetail);
    }
    // Cache reanime.to result to DB for instant subsequent loads
    try {
      const { execute } = await import('./db');
      await execute(
        `INSERT INTO anime_cache (anilist_id, mal_id, title_romaji, title_english, synopsis, cover_image, full_data)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(anilist_id) DO UPDATE SET
           mal_id = COALESCE(excluded.mal_id, mal_id),
           title_romaji = COALESCE(excluded.title_romaji, title_romaji),
           title_english = COALESCE(excluded.title_english, title_english),
           synopsis = COALESCE(excluded.synopsis, synopsis),
           cover_image = COALESCE(excluded.cover_image, cover_image),
           full_data = excluded.full_data`,
        [
          anilistId,
          reanimeDetail.mal_id || null,
          media.title?.romaji || null,
          media.title?.english || null,
          media.description || null,
          media.coverImage?.extraLarge || media.coverImage?.large || null,
          JSON.stringify(media),
        ]
      );
    } catch {}
    return media;
  }
  // Fallback to AniList
  return getAnilistDetail(anilistId);
}

function hasIncompleteFields(media: AniListMedia): boolean {
  const firstChar = media.characters?.edges?.[0];
  const hasVA = firstChar ? (firstChar.voiceActors?.length ?? 0) > 0 : true;
  return (
    !media.recommendations ||
    (media.recommendations.nodes?.length === 0 && !media.rating) ||
    !media.relations ||
    media.relations.edges?.length === 0 ||
    !hasVA ||
    (!media.stats?.scoreDistribution?.length && !media.rating)
  );
}

function mergeAnilistFields(target: AniListMedia, source: AniListMedia): void {
  if (!target.trailer?.id && source.trailer?.id) target.trailer = source.trailer;
  if (!target.recommendations?.nodes?.length && source.recommendations?.nodes?.length) {
    target.recommendations = source.recommendations;
  }
  if (!target.relations?.edges?.length && source.relations?.edges?.length) {
    target.relations = source.relations;
  }
  if (!target.stats?.scoreDistribution?.length && source.stats?.scoreDistribution?.length) {
    target.stats = source.stats;
  }
  if (!target.streamingEpisodes?.length && source.streamingEpisodes?.length) {
    target.streamingEpisodes = source.streamingEpisodes;
  }
  // Merge character voice actors and images
  if (target.characters?.edges && source.characters?.edges) {
    const srcMap = new Map(source.characters.edges.map(e => [e.node?.id, e]));
    for (const edge of target.characters.edges) {
      if (edge.node?.id) {
        const src = srcMap.get(edge.node.id);
        if (src) {
          if (!edge.voiceActors?.length) edge.voiceActors = src.voiceActors || [];
          if (!edge.node?.image?.large && src.node?.image?.large) {
            edge.node.image = src.node.image;
          }
        }
      }
    }
  }
  // Merge staff images
  if (target.staff?.edges && source.staff?.edges) {
    const srcMap = new Map(source.staff.edges.map(e => [e.node?.id, e]));
    for (const edge of target.staff.edges) {
      if (edge.node?.id) {
        const src = srcMap.get(edge.node.id);
        if (src && !edge.node?.image?.large && src.node?.image?.large) {
          edge.node.image = src.node.image;
        }
      }
    }
  }
  if (!target.averageScore && source.averageScore) target.averageScore = source.averageScore;
  if (!target.popularity && source.popularity) target.popularity = source.popularity;
  if (!target.favourites && source.favourites) target.favourites = source.favourites;
  // Merge new metadata from AniList if reanime.to didn't have it
  if (!target.rating && source.rating) target.rating = source.rating;
  if (!target.duration && source.duration) target.duration = source.duration;
  if (!target.startDate && source.startDate) target.startDate = source.startDate;
  if (!target.endDate && source.endDate) target.endDate = source.endDate;
  if (!target.countryOfOrigin && source.countryOfOrigin) target.countryOfOrigin = source.countryOfOrigin;
  if (!target.hashtag && source.hashtag) target.hashtag = source.hashtag;
}

// ─── Search ────────────────────────────────────────────────

export async function searchMedia(query: string): Promise<AniListMedia[]> {
  // Try reanime.to search first
  const reanimeResults = await searchReanime({ q: query, limit: 20 });
  if (reanimeResults?.results && reanimeResults.results.length > 0) {
    const mapped = reanimeResults.results.map(mapHomeItem).filter(Boolean) as AniListMedia[];
    if (mapped.length > 0) return mapped;
  }
  // Fallback to AniList
  const result = await searchAnime({ search: query, page: 1, perPage: 20 });
  return result.media;
}

// ─── Browse with filters ──────────────────────────────────

export async function browseMedia(filters: BrowseFilters & {
  type?: string;
  genre?: string;
  studio?: string;
  page?: number;
  limit?: number;
  sort?: string;
}): Promise<{ animes: AniListMedia[]; total: number; page: number; totalPages: number }> {
  // Try reanime.to search with filters
  const reanimeResults = await searchReanime({
    q: filters.search,
    genre: filters.genre || (filters.genres?.[0]),
    studio: filters.studio,
    season: filters.season,
    year: filters.seasonYear,
    format: filters.format,
    status: filters.status,
    sort: filters.sort || 'popularity',
    limit: filters.limit || 20,
    offset: ((filters.page || 1) - 1) * (filters.limit || 20),
  });

  if (reanimeResults?.results && reanimeResults.results.length > 0) {
    const animes = reanimeResults.results.map(mapHomeItem).filter(Boolean) as AniListMedia[];
    if (animes.length > 0) {
      const totalPages = Math.ceil((reanimeResults.total || reanimeResults.results.length) / (filters.limit || 20));
      return {
        animes,
        total: reanimeResults.total || reanimeResults.results.length,
        page: filters.page || 1,
        totalPages: Math.max(totalPages, 1),
      };
    }
  }

  // Fallback to hianime category
  return getHianimeCategory(filters.type || 'tv', filters.page || 1, filters.limit || 20);
}

// ─── Schedule ──────────────────────────────────────────────

export async function getAiringSchedule(): Promise<AniListAiringSchedule[]> {
  const reanimeSchedule = await getReanimeSchedule();
  if (reanimeSchedule) {
    return reanimeSchedule
      .map(item => {
        const mapped = mapScheduleItem(item);
        if (!mapped) return null;
        return {
          id: 0,
          airingAt: mapped.airingAt,
          episode: mapped.episode,
          mediaId: mapped.media.id,
          media: mapped.media,
        } as AniListAiringSchedule;
      })
      .filter(Boolean) as AniListAiringSchedule[];
  }

  // Fallback to AniList
  const now = Math.floor(Date.now() / 1000);
  return getAnilistSchedule(now - 12 * 3600, now + 7 * 24 * 3600, 1, 100);
}

// ─── Characters with voice actors (via Jikan) ─────────────

export async function getMediaCharacters(malId: number): Promise<CharacterWithVA[]> {
  return getJikanCharacters(malId);
}

// ─── Staff (via Jikan) ─────────────────────────────────────

export async function getMediaStaff(malId: number): Promise<StaffEntry[]> {
  return getJikanStaff(malId);
}

// ─── Episodes metadata (via Jikan) ─────────────────────────

export async function getMediaEpisodes(malId: number): Promise<any[]> {
  return getJikanEpisodes(malId);
}

// ─── Recommendations ───────────────────────────────────────

export async function getMediaRecommendations(anilistId: number): Promise<AniListMedia[]> {
  // Try AniList recommendations first (gives proper AniList IDs for linking)
  const recs = await getAnilistRecommendations(anilistId);
  if (recs?.nodes && recs.nodes.length > 0) {
    return recs.nodes
      .map(n => n.mediaRecommendation)
      .filter((m): m is AniListMedia => m !== null);
  }

  // Fallback to reanime.to recommendations (cover images + scores, but no AniList IDs)
  const { queryOne } = await import('./db');
  const cached = await queryOne<{ mal_id: number }>(
    'SELECT mal_id FROM anime_cache WHERE anilist_id = ? AND mal_id IS NOT NULL',
    [anilistId]
  );
  if (cached?.mal_id) {
    const { getSlugByMalId } = await import('./reanime');
    const slug = await getSlugByMalId(cached.mal_id);
    if (slug) {
      const reanimeRecs = await getReanimeRecommendations(slug);
      if (reanimeRecs && reanimeRecs.length > 0) {
        return reanimeRecs.map(r => mapReanimeRecommendation(r)).filter((m): m is AniListMedia => m !== null);
      }
    }
  }

  return [];
}

// ─── Slug by AniList ID ────────────────────────────────────

export async function getSlugForAnilistId(anilistId: number): Promise<string | null> {
  const map = await buildSlugMapping();
  return map.get(anilistId)?.slug || null;
}

// Re-exports
export { getReanimeAnimeDetail, getReanimeHome, buildSlugMapping, searchAnime, getAnilistDetail as getAnimeDetail, getAnilistIdByMalId, getHianimeAnimeList, getHianimeCategory, quickSearch, anilistMediaToAnime, searchReanime, getReanimeSchedule, getReanimeRecommendations, getReanimeEpisodes, getReanimeEpisodesByAnilistId };
export type { BrowseFilters, AnimeFormat };
