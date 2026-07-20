import { NextResponse } from 'next/server';
import { searchMedia } from '@/lib/data-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  if (!query) {
    return NextResponse.json({ media: [] });
  }

  try {
    const media = await searchMedia(query);
    return NextResponse.json({ media });
  } catch (err) {
    console.error('[Search API]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
