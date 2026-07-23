import { NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getAiringSchedule } from '@/lib/anilist';

export async function POST() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sixHoursAgo = now - 6 * 3600;
    const sixHoursLater = now + 6 * 3600;

    // Check schedule cache (valid for 6 hours)
    let schedule = await getCachedSchedule();
    if (!schedule) {
      schedule = await getAiringSchedule(sixHoursAgo, sixHoursLater, 1, 100);
      if (schedule?.length) {
        await cacheSchedule(schedule);
      }
    }

    if (!schedule?.length) {
      return NextResponse.json({ success: true, created: 0 });
    }

    // Get existing notifications to avoid duplicates
    const existing = await query(
      'SELECT anilist_id FROM notifications WHERE created_at > datetime(?, \'unixepoch\')',
      [sixHoursAgo]
    ) as Array<{ anilist_id: number }>;

    const existingSet = new Set(existing.map((n: any) => n.anilist_id));

    let created = 0;
    for (const entry of schedule) {
      const mediaId = entry.mediaId;
      if (existingSet.has(mediaId)) continue;

      const isPast = entry.airingAt <= now;
      const type = isPast ? 'new_episode' : 'airing_soon';
      const title = entry.media?.title?.english || entry.media?.title?.romaji || 'Unknown';
      const message = isPast
        ? `Episode ${entry.episode} of ${title} has aired!`
        : `${title} Episode ${entry.episode} airing soon`;

      await execute(
        'INSERT INTO notifications (anilist_id, type, message) VALUES (?, ?, ?)',
        [mediaId, type, message]
      );
      created++;
    }

    return NextResponse.json({ success: true, created });
  } catch (err) {
    console.error('Failed to generate notifications:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getCachedSchedule() {
  try {
    const cached = await queryOne<{ data: string; cached_at: string }>(
      `SELECT data, cached_at FROM home_cache WHERE key = 'airing_schedule'`
    );
    if (!cached?.data) return null;
    const age = Date.now() - new Date(cached.cached_at + 'Z').getTime();
    if (age > 6 * 3600 * 1000) return null;
    return JSON.parse(cached.data);
  } catch {
    return null;
  }
}

async function cacheSchedule(schedule: any[]) {
  try {
    await execute(
      `INSERT INTO home_cache (key, data, cached_at) VALUES ('airing_schedule', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET data = excluded.data, cached_at = datetime('now')`,
      [JSON.stringify(schedule)]
    );
  } catch {}
}
