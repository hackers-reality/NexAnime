import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.execute(`
      SELECT wp.anilist_id, wp.episode_number, wp.seconds_watched, wp.duration_seconds,
             wp.last_watched_at,
             c.title_romaji, c.title_english, c.cover_image, c.format,
             (SELECT thumbnail FROM episode_sources WHERE anilist_id = wp.anilist_id AND episode_number = wp.episode_number AND thumbnail IS NOT NULL LIMIT 1) as ep_thumbnail
      FROM watch_progress wp
      LEFT JOIN anime_cache c ON wp.anilist_id = c.anilist_id
      ORDER BY wp.last_watched_at DESC
      LIMIT 50
    `);

    return NextResponse.json({ progress: result.rows });
  } catch (err) {
    console.error('Failed to fetch watch history:', err);
    return NextResponse.json({ progress: [] });
  }
}
