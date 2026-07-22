import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // Get watch_progress entries first (native video sources)
    const progressResult = await db.execute(`
      SELECT wp.anilist_id, wp.episode_number, wp.seconds_watched, wp.duration_seconds,
             wp.last_watched_at, 'progress' as source_type,
             c.title_romaji, c.title_english, c.cover_image, c.format,
             (SELECT thumbnail FROM episode_sources WHERE anilist_id = wp.anilist_id AND episode_number = wp.episode_number AND thumbnail IS NOT NULL LIMIT 1) as ep_thumbnail
      FROM watch_progress wp
      LEFT JOIN anime_cache c ON wp.anilist_id = c.anilist_id
      ORDER BY wp.last_watched_at DESC
    `);

    // Get watchlist entries with "watching" status (embed sources)
    const watchlistResult = await db.execute(`
      SELECT w.anilist_id, w.episode_watched as episode_number, 0 as seconds_watched, 0 as duration_seconds,
             w.updated_at as last_watched_at, 'watchlist' as source_type,
             c.title_romaji, c.title_english, c.cover_image, c.format,
             NULL as ep_thumbnail
      FROM watchlist w
      LEFT JOIN anime_cache c ON w.anilist_id = c.anilist_id
      WHERE w.list_status = 'watching' AND w.episode_watched > 0
      ORDER BY w.updated_at DESC
    `);

    // Merge and deduplicate by anilist_id (prefer progress over watchlist)
    const allRows = [...progressResult.rows, ...watchlistResult.rows];
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const row of allRows) {
      const key = `${row.anilist_id}-${row.episode_number}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(row);
      }
    }

    // Sort by last_watched_at desc and limit
    merged.sort((a: any, b: any) => {
      const ta = a.last_watched_at ? new Date(a.last_watched_at).getTime() : 0;
      const tb = b.last_watched_at ? new Date(b.last_watched_at).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({ progress: merged.slice(0, 50) });
  } catch (err) {
    console.error('Failed to fetch watch history:', err);
    return NextResponse.json({ progress: [] });
  }
}
