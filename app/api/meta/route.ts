// NexAnime — Unified metadata API (reanime.to / hianime / AniList)
import { NextRequest, NextResponse } from 'next/server';
import { searchReanime, getReanimeEpisodes, getReanimeEpisodesByAnilistId, getReanimeSchedule, buildSlugMapping } from '@/lib/reanime';
import type { ReanimeAnimeItem } from '@/lib/reanime';
import { searchMedia, getAiringSchedule } from '@/lib/data-api';
import { getJikanEpisodes } from '@/lib/jikan-api';
import { getHianimeEpisodesByTitle } from '@/lib/hianime-api';
import {
  getTrending,
  getPopular,
  getTopRated,
  getUpcoming,
  searchAnime,
} from '@/lib/anilist';
import type { AniListMedia, BrowseFilters, AnimeStatus, AnimeSeason, AnimeFormat } from '@/types';

// ─── Timeout wrapper — kills slow API calls after ms ─────
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

interface MappedMedia {
  anilistId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImage: string | null;
  format: string | null;
  seasonYear: number | null;
  status: string | null;
  averageScore: number | null;
  synopsis: string | null;
  genres: string[];
  rating: string | null;
  subbed: number | null;
  dubbed: number | null;
}

function mapMedia(m: AniListMedia): MappedMedia {
  return {
    anilistId: m.id,
    titleRomaji: m.title?.romaji || m.title?.english || 'Unknown',
    titleEnglish: m.title?.english,
    coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
    format: m.format,
    seasonYear: m.seasonYear,
    status: m.status,
    averageScore: m.averageScore,
    synopsis: m.description,
    genres: m.genres || [],
    rating: m.rating ?? null,
    subbed: m.subbed ?? null,
    dubbed: m.dubbed ?? null,
  };
}

function extractAnilistId(r: ReanimeAnimeItem): number | null {
  if (r.anilist_id && Number(r.anilist_id) > 0) return Number(r.anilist_id);
  const url = r.cover_image?.extra_large || r.cover_image?.large || '';
  const match = url.match(/[\\/]bx(\d+)-/);
  if (match) return parseInt(match[1], 10);
  return null;
}

function mapReanimeMedia(r: ReanimeAnimeItem): MappedMedia | null {
  const id = extractAnilistId(r);
  if (!id) return null;
  return {
    anilistId: id,
    titleRomaji: r.title?.romaji || r.title?.english || 'Unknown',
    titleEnglish: r.title?.english || null,
    coverImage: r.cover_image?.extra_large || r.cover_image?.large || null,
    format: r.format || null,
    seasonYear: r.season_year || null,
    status: r.status || null,
    averageScore: r.average_score || null,
    synopsis: r.description || null,
    genres: r.genres || [],
    rating: r.rating ?? null,
    subbed: null,
    dubbed: null,
  };
}

const AL_SORT_MAP: Record<string, string[]> = {
  popular: ['POPULARITY_DESC'],
  trending: ['TRENDING_DESC'],
  score: ['SCORE_DESC'],
  newest: ['START_DATE_DESC'],
  oldest: ['START_DATE'],
  title: ['TITLE_ROMAJI_DESC'],
  SCORE_DESC: ['SCORE_DESC'],
  POPULARITY_DESC: ['POPULARITY_DESC'],
  TRENDING_DESC: ['TRENDING_DESC'],
  TITLE_ROMAJI_DESC: ['TITLE_ROMAJI_DESC'],
  FAVOURITES_DESC: ['FAVOURITES_DESC'],
};

const REANIME_SORT_MAP: Record<string, string> = {
  popular: 'popularity',
  trending: 'trending',
  score: 'score',
  newest: 'start_date',
  oldest: 'start_date',
  title: 'title',
  SCORE_DESC: 'score',
  POPULARITY_DESC: 'popularity',
  TRENDING_DESC: 'trending',
};

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');

  try {
    switch (action) {
      case 'search': {
        const query = request.nextUrl.searchParams.get('q') || '';
        if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
        const dataApiResult = await searchMedia(query);
        return NextResponse.json({ media: dataApiResult, total: dataApiResult.length, lastPage: 1 });
      }

      case 'browse': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
        const query = request.nextUrl.searchParams.get('q') || undefined;
        const sort = request.nextUrl.searchParams.get('sort') || undefined;
        const status = request.nextUrl.searchParams.get('status') || undefined;
        const genres = request.nextUrl.searchParams.get('genres') || undefined;
        const season = request.nextUrl.searchParams.get('season') || undefined;
        const year = request.nextUrl.searchParams.get('year') ? parseInt(request.nextUrl.searchParams.get('year')!) : undefined;
        const format = request.nextUrl.searchParams.get('format') || undefined;
        const country = request.nextUrl.searchParams.get('country') || undefined;

        // Try reanime first (8s timeout), fallback to AniList
        const reanimeResult = await withTimeout(
          searchReanime({
            q: query, genre: genres, season, year, format, status,
            sort: sort ? REANIME_SORT_MAP[sort] : undefined,
            country, limit, offset: (page - 1) * limit,
          }),
          8000
        );
        if (reanimeResult?.results?.length) {
          const mapped = reanimeResult.results.map(mapReanimeMedia).filter((m): m is MappedMedia => m !== null && m?.anilistId > 0);
          if (mapped.length > 0) {
            return NextResponse.json({
              media: mapped,
              pageInfo: { total: reanimeResult.total, lastPage: Math.ceil(reanimeResult.total / limit), currentPage: page },
            });
          }
        }

        // AniList fallback (10s timeout)
        const alSort = sort ? (AL_SORT_MAP[sort] || ['POPULARITY_DESC']) : ['POPULARITY_DESC'];
        const alFilters: BrowseFilters = { page, perPage: limit, sort: alSort };
        if (query) alFilters.search = query;
        if (status) alFilters.status = status as AnimeStatus;
        if (genres) alFilters.genres = genres.split(',');
        if (season) alFilters.season = season as AnimeSeason;
        if (year) alFilters.seasonYear = year;
        if (format) alFilters.format = format as AnimeFormat;
        const alResult = await withTimeout(searchAnime(alFilters), 10000);
        return NextResponse.json({
          media: alResult ? alResult.media.map(mapMedia) : [],
          pageInfo: alResult?.pageInfo,
        });
      }

      case 'trending': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        // Try reanime first (5s timeout), fallback to AniList (10s timeout)
        const reanimeResult = await withTimeout(
          searchReanime({ sort: 'trending', limit, offset: (page - 1) * limit }),
          5000
        );
        if (reanimeResult?.results?.length) {
          const mapped = reanimeResult.results.map(mapReanimeMedia).filter((m): m is MappedMedia => m !== null && m?.anilistId > 0);
          if (mapped.length > 0) {
            return NextResponse.json({
              media: mapped,
              pageInfo: { total: reanimeResult.total, lastPage: Math.ceil(reanimeResult.total / limit), currentPage: page },
            });
          }
        }
        const alResult = await withTimeout(getTrending(page, limit), 10000);
        if (alResult) return NextResponse.json({ media: alResult.media.map(mapMedia) });
        return NextResponse.json({ media: [] });
      }

      case 'popular': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        // Try reanime first (5s timeout), fallback to AniList (10s timeout)
        const reanimeResult = await withTimeout(
          searchReanime({ sort: 'popularity', limit, offset: (page - 1) * limit }),
          5000
        );
        if (reanimeResult?.results?.length) {
          const mapped = reanimeResult.results.map(mapReanimeMedia).filter((m): m is MappedMedia => m !== null && m?.anilistId > 0);
          if (mapped.length > 0) {
            return NextResponse.json({
              media: mapped,
              pageInfo: { total: reanimeResult.total, lastPage: Math.ceil(reanimeResult.total / limit), currentPage: page },
            });
          }
        }
        const alResult = await withTimeout(getPopular(page, limit), 10000);
        if (alResult) return NextResponse.json({ media: alResult.media.map(mapMedia) });
        return NextResponse.json({ media: [] });
      }

      case 'topRated': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        // Try reanime first (8s timeout), fallback to AniList
        const reanimeResult = await withTimeout(
          searchReanime({ sort: 'score', limit, offset: (page - 1) * limit }),
          8000
        );
        if (reanimeResult?.results?.length) {
          const mapped = reanimeResult.results.map(mapReanimeMedia).filter((m): m is MappedMedia => m !== null && m?.anilistId > 0);
          if (mapped.length > 0) {
            return NextResponse.json({
              media: mapped,
              pageInfo: { total: reanimeResult.total, lastPage: Math.ceil(reanimeResult.total / limit), currentPage: page },
            });
          }
        }
        const alResult = await getTopRated(page, limit);
        return NextResponse.json({ media: alResult.media.map(mapMedia) });
      }

      case 'season': {
        const seasonParam = request.nextUrl.searchParams.get('season') || 'SUMMER';
        const yearParam = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        // Try reanime.to first
        try {
          const reResult = await withTimeout(
            searchReanime({ season: seasonParam.toLowerCase() as any, year: yearParam, sort: 'popularity', limit }),
            8000
          );
          if (reResult?.results?.length) {
            return NextResponse.json({ media: reResult.results.map(mapReanimeMedia) });
          }
        } catch {}
        // Fallback to AniList
        const alResult = await withTimeout(
          searchAnime({ season: seasonParam as any, seasonYear: yearParam, sort: ['POPULARITY_DESC'], page: 1, perPage: limit }),
          10000
        );
        return NextResponse.json({ media: alResult ? alResult.media.map(mapMedia) : [] });
      }

      case 'upcoming': {
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        // Try reanime.to first
        try {
          const reResult = await withTimeout(
            searchReanime({ status: 'not yet released', sort: 'popularity', limit }),
            8000
          );
          if (reResult?.results?.length) {
            return NextResponse.json({ media: reResult.results.map(mapReanimeMedia) });
          }
        } catch {}
        // Fallback to AniList
        const alResult = await withTimeout(getUpcoming(1, limit), 10000);
        return NextResponse.json({ media: alResult ? alResult.media.map(mapMedia) : [] });
      }

      case 'episodes': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const anilistId = parseInt(id);
        let episodes: any[] = [];
        let jikanEpisodes: any[] = [];

        if (!isNaN(anilistId)) {
          try {
            const eps = await getReanimeEpisodesByAnilistId(anilistId);
            if (eps?.length) episodes = eps;
          } catch {}
        }

        // Fetch Jikan episodes for synopses (fetches up to 3 pages / 300 eps)
        try {
          const mediaIdMal = request.nextUrl.searchParams.get('malId');
          if (mediaIdMal) {
            const jikan = await getJikanEpisodes(parseInt(mediaIdMal));
            if (jikan?.length) jikanEpisodes = jikan;
          }
        } catch {}

        // If no malId param, try to find it from our DB cache
        if (jikanEpisodes.length === 0) {
          try {
            const { queryOne } = await import('@/lib/db');
            const cached = await queryOne<{ mal_id: number }>(
              'SELECT mal_id FROM anime_cache WHERE anilist_id = ? AND mal_id IS NOT NULL',
              [anilistId]
            );
            if (cached?.mal_id) {
              const jikan = await getJikanEpisodes(cached.mal_id);
              if (jikan?.length) jikanEpisodes = jikan;
            }
          } catch {}
        }

        // Hianime fallback: if reanime returned no episodes, try hianime search by title
        if (episodes.length === 0) {
          try {
            const { queryOne } = await import('@/lib/db');
            const cached = await queryOne<{ title_romaji: string; title_english: string }>(
              'SELECT title_romaji, title_english FROM anime_cache WHERE anilist_id = ?',
              [anilistId]
            );
            const title = cached?.title_english || cached?.title_romaji;
            if (title) {
              const hiEps = await withTimeout(getHianimeEpisodesByTitle(title), 8000);
              if (hiEps?.episodes?.length) episodes = hiEps.episodes;
            }
          } catch {}
        }

        return NextResponse.json({ episodes, jikanEpisodes });
      }

      case 'schedule': {
        const schedule = await getAiringSchedule();
        return NextResponse.json({ schedule: schedule.map(s => ({
          id: s.id,
          airingAt: s.airingAt,
          episode: s.episode,
          mediaId: s.mediaId,
          airingStatus: s.airingStatus,
          delayedFrom: s.delayedFrom,
          delayedUntil: s.delayedUntil,
          media: {
            id: s.media?.id,
            title: s.media?.title,
            coverImage: s.media?.coverImage,
            format: s.media?.format,
            status: s.media?.status,
          },
        }))});
      }

      case 'info': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const anilistId = parseInt(id);
        if (!isNaN(anilistId)) {
          const { getMediaDetail } = await import('@/lib/data-api');
          const media = await getMediaDetail(anilistId);
          if (media) return NextResponse.json({ media });
        }
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Meta API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
