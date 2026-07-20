// NexAnime — Unified metadata API (reanime.to / hianime / AniList)
import { NextRequest, NextResponse } from 'next/server';
import { getHianimeTrending, getHianimePopular } from '@/lib/hianime-api';
import { searchReanime, getReanimeEpisodes, buildSlugMapping } from '@/lib/reanime';
import { getMediaDetail, searchMedia } from '@/lib/data-api';
import {
  getTrending,
  getPopular,
  getTopRated,
  getUpcoming,
  searchAnime,
} from '@/lib/anilist';

const SORT_MAP: Record<string, string[]> = {
  POPULARITY_DESC: ['POPULARITY_DESC'],
  TRENDING_DESC: ['TRENDING_DESC'],
  SCORE_DESC: ['SCORE_DESC'],
  TITLE_ROMAJI_DESC: ['TITLE_ROMAJI_DESC'],
  TITLE_ROMAJI: ['TITLE_ROMAJI'],
  FAVOURITES_DESC: ['FAVOURITES_DESC'],
};

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

async function reanimeSearchToMedia(params: {
  q?: string; genre?: string; season?: string; year?: number;
  format?: string; status?: string; sort?: string; country?: string;
  page?: number; limit?: number;
}) {
  const result = await searchReanime({
    q: params.q, genre: params.genre, season: params.season,
    year: params.year, format: params.format, status: params.status,
    sort: params.sort, country: params.country,
    limit: params.limit || 20, offset: ((params.page || 1) - 1) * (params.limit || 20),
  });
  if (!result?.results?.length) return null;
  return {
    media: result.results.map(r => ({
      anilistId: r.anilist_id,
      titleRomaji: r.title?.romaji || r.title?.english || 'Unknown',
      titleEnglish: r.title?.english,
      coverImage: r.cover_image?.extra_large || r.cover_image?.large,
      format: r.format,
      seasonYear: r.season_year,
      status: r.status,
      averageScore: r.average_score,
      synopsis: r.description,
      genres: r.genres || [],
    })),
    pageInfo: { total: result.total, lastPage: Math.ceil(result.total / (params.limit || 20)), currentPage: params.page || 1 },
  };
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');

  try {
    switch (action) {
      case 'search': {
        const query = request.nextUrl.searchParams.get('q') || '';
        if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

        const dataApiResult = await searchMedia(query);
        if (dataApiResult.length > 0) {
          return NextResponse.json({ media: dataApiResult, total: dataApiResult.length, lastPage: 1 });
        }

        return NextResponse.json({ media: [], total: 0, lastPage: 1 });
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

        const reanimeResult = await reanimeSearchToMedia({ q: query, genre: genres, season, year, format, status, sort: sort === 'SCORE_DESC' ? 'score' : undefined, country, page, limit });
        if (reanimeResult) return NextResponse.json(reanimeResult);

        const alSort = sort ? (SORT_MAP[sort] || ['POPULARITY_DESC']) : ['POPULARITY_DESC'];
        const alFilters: any = { page, perPage: limit, sort: alSort };
        if (query) alFilters.search = query;
        if (status) alFilters.status = status;
        if (genres) alFilters.genres = genres.split(',');
        if (season) alFilters.season = season;
        if (year) alFilters.seasonYear = year;

        const alResult = await searchAnime(alFilters);
        return NextResponse.json({ media: alResult.media.map(mapMedia), pageInfo: alResult.pageInfo });
      }

      case 'trending': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        try {
          const hiResult = await getHianimeTrending();
          if (hiResult.length > 0) return NextResponse.json({ media: hiResult.map(mapMedia) });
        } catch {}
        const alResult = await getTrending(page, limit);
        return NextResponse.json({ media: alResult.media.map(mapMedia) });
      }

      case 'popular': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        try {
          const hiResult = await getHianimePopular();
          if (hiResult.length > 0) return NextResponse.json({ media: hiResult.map(mapMedia) });
        } catch {}
        const alResult = await getPopular(page, limit);
        return NextResponse.json({ media: alResult.media.map(mapMedia) });
      }

      case 'topRated': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const reanimeResult = await reanimeSearchToMedia({ sort: 'score', page, limit });
        if (reanimeResult) return NextResponse.json(reanimeResult);
        const alResult = await getTopRated(page, limit);
        return NextResponse.json({ media: alResult.media.map(mapMedia) });
      }

      case 'season': {
        const seasonParam = request.nextUrl.searchParams.get('season') || 'SUMMER';
        const yearParam = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const reanimeResult = await reanimeSearchToMedia({ season: seasonParam, year: yearParam, limit, page });
        if (reanimeResult) return NextResponse.json(reanimeResult);
        const alResult = await searchAnime({ season: seasonParam as any, seasonYear: yearParam, sort: ['POPULARITY_DESC'], page, perPage: limit });
        return NextResponse.json({ media: alResult.media.map(mapMedia) });
      }

      case 'upcoming': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const reanimeResult = await reanimeSearchToMedia({ status: 'NOT_YET_RELEASED', sort: 'score', limit, page });
        if (reanimeResult) return NextResponse.json(reanimeResult);
        const alResult = await getUpcoming(page, limit);
        return NextResponse.json({ media: alResult.media.map(mapMedia) });
      }

      case 'episodes': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const anilistId = parseInt(id);
        if (!isNaN(anilistId)) {
          try {
            const mapping = await buildSlugMapping();
            const entry = mapping.get(anilistId);
            if (entry?.slug) {
              const eps = await getReanimeEpisodes(entry.slug);
              if (eps?.length) return NextResponse.json({ episodes: eps });
            }
          } catch {}
        }
        return NextResponse.json({ episodes: [] });
      }

      case 'info': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const anilistId = parseInt(id);
        if (!isNaN(anilistId)) {
          const media = await getMediaDetail(anilistId);
          if (media) return NextResponse.json({ media });
        }
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Animetsu API]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
