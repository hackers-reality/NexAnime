import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const anilistId = searchParams.get('anilistId');

  if (!anilistId) {
    return NextResponse.json({ error: 'Missing anilistId' }, { status: 400 });
  }

  const parsedId = parseInt(anilistId);
  if (isNaN(parsedId)) {
    return NextResponse.json({ error: 'Invalid anilistId' }, { status: 400 });
  }

  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT episode_number, seconds_watched, duration_seconds FROM watch_progress WHERE anilist_id = ?',
      args: [parsedId]
    });

    const progress: Record<number, { secondsWatched: number; durationSeconds: number }> = {};
    for (const row of result.rows) {
      progress[row.episode_number as number] = {
        secondsWatched: row.seconds_watched as number,
        durationSeconds: row.duration_seconds as number,
      };
    }

    return NextResponse.json({ progress });
  } catch (err) {
    console.error('Failed to fetch anime progress:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
