import { NextResponse } from 'next/server';
import { getMediaDetail } from '@/lib/data-api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const anilistId = parseInt(id);
  if (isNaN(anilistId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const media = await getMediaDetail(anilistId);
    if (!media) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(media);
  } catch (err) {
    console.error('[Media API]', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
