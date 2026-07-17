// NexAnime — Animetsu metadata API route
// Provides search, detail, and episode data from animetsu.cc/live

import { NextRequest, NextResponse } from 'next/server';
import { animetsuSearch, animetsuGetEpisodes, animetsuGetServers } from '@/lib/animetsu';

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

      case 'episodes': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const episodes = await animetsuGetEpisodes(id);
        return NextResponse.json({ episodes });
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
