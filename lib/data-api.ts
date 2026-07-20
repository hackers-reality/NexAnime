import type { AniListMedia, AniListAiringSchedule, AnimeFormat, BrowseFilters, CharacterWithVA, StaffEntry, ExtendedAnime } from '@/types';
import {
  getReanimeHome,
  getReanimeAnimeDetail,
  getReanimeByAnilistId,
  getReanimeSchedule,
  searchReanime,
  getReanimeRecommendations,
  getReanimeEpisodes,
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
} from './anilist';

export interface HomePayload {
  trending: AniListMedia[];
  thisSeason: AniListMedia[];
  upcoming: AniListMedia[];
  recentlyUpdated: AniListAiringSchedule[];
  schedule: AniListAiringSchedule[];
}

// ─── Home ──────────────────────────────────────────────────

export async function getHomeData(): Promise<HomePayload> {
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysSec = 7 * 24 * 60 * 60;

  // Try reanime.to API v1 first for trending/upcoming
  const [reanimeHome, reanimeSchedule, seasonRes, upcomingRes, recentlyUpdatedRes, anilistSchedule] = await Promise.allSettled([
    getReanimeHome(),
    getReanimeSchedule(),
    getThisSeason(1, 10),
    getUpcoming(1, 10),
    getRecentlyUpdated(1, 10),
    getAnilistSchedule(now - 12 * 3600, now + sevenDaysSec, 1, 100),
  ]);

  let trending: AniListMedia[] = [];

  // Prefer reanime.to for trending
  if (reanimeHome.status === 'fulfilled' && reanimeHome.value) {
    const home = reanimeHome.value;
    trending = [
      ...(home.trending || []).map(mapHomeItem).filter(Boolean),
      ...(home.latest_aired || []).map(mapHomeItem).filter(Boolean),
      ...(home.new_on_site || []).map(mapHomeItem).filter(Boolean),
    ] as AniListMedia[];
    // Deduplicate
    const seen = new Set<number>();
    trending = trending.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    }).slice(0, 20);
  }

  // Build schedule from reanime.to if available
  let schedule: AniListAiringSchedule[] = [];
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
  if (schedule.length === 0 && anilistSchedule.status === 'fulfilled') {
    schedule = anilistSchedule.value;
  }

  return {
    trending,
    thisSeason: seasonRes.status === 'fulfilled' ? seasonRes.value.media : [],
    upcoming: upcomingRes.status === 'fulfilled' ? upcomingRes.value.media : [],
    recentlyUpdated: recentlyUpdatedRes.status === 'fulfilled' ? recentlyUpdatedRes.value : [],
    schedule,
  };
}

// ─── Media detail ──────────────────────────────────────────

export async function getMediaDetail(anilistId: number): Promise<AniListMedia | null> {
  // Try reanime.to first
  const reanimeDetail = await getReanimeByAnilistId(anilistId);
  if (reanimeDetail) return mapAnimeDetail(reanimeDetail);
  // Fallback to AniList
  return getAnilistDetail(anilistId);
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
  // Try AniList recommendations
  const recs = await getAnilistRecommendations(anilistId);
  if (recs?.nodes) {
    return recs.nodes
      .map(n => n.mediaRecommendation)
      .filter((m): m is AniListMedia => m !== null);
  }
  return [];
}

// ─── Slug by AniList ID ────────────────────────────────────

export async function getSlugForAnilistId(anilistId: number): Promise<string | null> {
  const map = await buildSlugMapping();
  return map.get(anilistId)?.slug || null;
}

// Re-exports
export { getReanimeAnimeDetail, getReanimeHome, buildSlugMapping, searchAnime, getAnilistDetail as getAnimeDetail, getAnilistIdByMalId, getHianimeAnimeList, getHianimeCategory, quickSearch, anilistMediaToAnime, searchReanime, getReanimeSchedule, getReanimeRecommendations, getReanimeEpisodes };
export type { BrowseFilters, AnimeFormat };
