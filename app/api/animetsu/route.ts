// NexAnime — Animetsu metadata API route
// Provides search, detail, and episode data from animetsu.cc/live

import { NextRequest, NextResponse } from 'next/server';
import {
  animetsuSearch,
  animetsuBrowse,
  animetsuTrending,
  animetsuPopular,
  animetsuTopRated,
  animetsuSeason,
  animetsuUpcoming,
  animetsuGetInfo,
  animetsuInfoToMedia,
  animetsuGetEpisodes,
  animetsuGetServers,
} from '@/lib/animetsu';

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

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');

  try {
    switch (action) {
      case 'search': {
        const query = request.nextUrl.searchParams.get('q') || '';
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
        if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
        const result = await animetsuSearch(query, page, limit);
        return NextResponse.json(result);
      }

      case 'browse': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
        const query = request.nextUrl.searchParams.get('q') || undefined;
        const sort = request.nextUrl.searchParams.get('sort') || undefined;
        const status = request.nextUrl.searchParams.get('status') || undefined;
        const genres = request.nextUrl.searchParams.get('genres') || undefined;
        const format = request.nextUrl.searchParams.get('format') || undefined;
        const season = request.nextUrl.searchParams.get('season') || undefined;
        const year = request.nextUrl.searchParams.get('year') ? parseInt(request.nextUrl.searchParams.get('year')!) : undefined;
        const tags = request.nextUrl.searchParams.get('tags') || undefined;
        const country = request.nextUrl.searchParams.get('country') || undefined;
        const source = request.nextUrl.searchParams.get('source') || undefined;
        const result = await animetsuBrowse({ query, sort, status, genres, format, season, year, tags, country, source, page, limit });
        return NextResponse.json({ media: result.media, pageInfo: { total: result.total, lastPage: result.lastPage, currentPage: page } });
      }

      case 'trending': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const result = await animetsuTrending(page, limit);
        return NextResponse.json({ media: result.media.map(mapMedia) });
      }

      case 'popular': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const result = await animetsuPopular(page, limit);
        return NextResponse.json({ media: result.media.map(mapMedia) });
      }

      case 'topRated': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const result = await animetsuTopRated(page, limit);
        return NextResponse.json({ media: result.media.map(mapMedia) });
      }

      case 'season': {
        const seasonParam = request.nextUrl.searchParams.get('season') || 'SUMMER';
        const yearParam = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const result = await animetsuSeason(seasonParam, yearParam, page, limit);
        return NextResponse.json({ media: result.media.map(mapMedia) });
      }

      case 'upcoming': {
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '15');
        const result = await animetsuUpcoming(page, limit);
        return NextResponse.json({ media: result.media.map(mapMedia) });
      }

      case 'episodes': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const episodes = await animetsuGetEpisodes(id);
        return NextResponse.json({ episodes });
      }

      case 'info': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const info = await animetsuGetInfo(id);
        if (!info) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const media = animetsuInfoToMedia(info);
        return NextResponse.json({ media });
      }

      case 'servers': {
        const id = request.nextUrl.searchParams.get('id');
        const ep = parseInt(request.nextUrl.searchParams.get('ep') || '1');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const servers = await animetsuGetServers(id, ep);
        return NextResponse.json({ servers });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Animetsu API]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
