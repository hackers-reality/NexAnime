// NexAnime — Unified metadata API (reanime.to / hianime / AniList)
import { NextRequest, NextResponse } from 'next/server';
import { searchReanime, getReanimeEpisodes, getReanimeEpisodesByAnilistId, buildSlugMapping } from '@/lib/reanime';
import { searchMedia } from '@/lib/data-api';
import {
  getTrending,
  getPopular,
  getTopRated,
  getUpcoming,
  searchAnime,
} from '@/lib/anilist';

// ─── Timeout wrapper — kills slow API calls after ms ─────
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function mapMedia(m: any) {
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
  };
}

function extractAnilistId(r: any): number | null {
  if (r.anilist_id && Number(r.anilist_id) > 0) return Number(r.anilist_id);
  const url = r.cover_image?.extra_large || r.cover_image?.large || '';
  const match = url.match(/[\\/]bx(\d+)-/);
  if (match) return parseInt(match[1], 10);
  return null;
}

function mapReanimeMedia(r: any) {
  const id = extractAnilistId(r);
  if (!id) return null;
  return {
    anilistId: id,
    titleRomaji: r.title?.romaji || r.title?.english || 'Unknown',
    titleEnglish: r.title?.english,
    coverImage: r.cover_image?.extra_large || r.cover_image?.large,
    format: r.format,
    seasonYear: r.season_year || null,
    status: r.status,
    averageScore: r.average_score || null,
    synopsis: r.description,
    genres: r.genres || [],
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
          const mapped = reanimeResult.results.map(mapReanimeMedia).filter((m: any) => m?.anilistId);
          if (mapped.length > 0) {
            return NextResponse.json({
              media: mapped,
              pageInfo: { total: reanimeResult.total, lastPage: Math.ceil(reanimeResult.total / limit), currentPage: page },
            });
          }
        }

        // AniList fallback (10s timeout)
        const alSort = sort ? (AL_SORT_MAP[sort] || ['POPULARITY_DESC']) : ['POPULARITY_DESC'];
        const alFilters: any = { page, perPage: limit, sort: alSort };
        if (query) alFilters.search = query;
        if (status) alFilters.status = status;
        if (genres) alFilters.genres = genres.split(',');
        if (season) alFilters.season = season;
        if (year) alFilters.seasonYear = year;
        if (format) alFilters.format = format;
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
          const mapped = reanimeResult.results.map(mapReanimeMedia).filter((m: any) => m?.anilistId);
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
          const mapped = reanimeResult.results.map(mapReanimeMedia).filter((m: any) => m?.anilistId);
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
          const mapped = reanimeResult.results.map(mapReanimeMedia).filter((m: any) => m?.anilistId);
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
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const alResult = await withTimeout(
          searchAnime({ season: seasonParam as any, seasonYear: yearParam, sort: ['POPULARITY_DESC'], page, perPage: limit }),
          10000
        );
        return NextResponse.json({ media: alResult ? alResult.media.map(mapMedia) : [] });
      }

      case 'upcoming': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const alResult = await withTimeout(getUpcoming(page, limit), 10000);
        return NextResponse.json({ media: alResult ? alResult.media.map(mapMedia) : [] });
      }

      case 'episodes': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const anilistId = parseInt(id);
        if (!isNaN(anilistId)) {
          try {
            const eps = await getReanimeEpisodesByAnilistId(anilistId);
            if (eps?.length) return NextResponse.json({ episodes: eps });
          } catch {}
        }
        return NextResponse.json({ episodes: [] });
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
  } catch (err: any) {
    console.error('[Meta API]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
