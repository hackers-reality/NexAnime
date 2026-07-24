import { NextResponse } from 'next/server';
import { query, queryOne, execute, getDb } from '@/lib/db';
import { getAiringSchedule } from '@/lib/anilist';
import type { AniListAiringSchedule } from '@/types';

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

    // Get existing notifications to avoid duplicates (dedup by anilist_id)
    const existing = await query<{ anilist_id: number; message: string }>(
      'SELECT anilist_id, message FROM notifications WHERE created_at > datetime(?, \'unixepoch\')',
      [sixHoursAgo]
    );

    const existingKeys = new Set<string>();
    for (const n of existing) {
      existingKeys.add(String(n.anilist_id));
    }

    // Batch insert all new notifications in one round-trip
    const statements: { sql: string; args: any[] }[] = [];
    for (const entry of schedule) {
      const mediaId = entry.mediaId;
      if (existingKeys.has(String(mediaId))) continue;

      const isPast = entry.airingAt <= now;
      const type = isPast ? 'new_episode' : 'airing_soon';
      const title = entry.media?.title?.english || entry.media?.title?.romaji || 'Unknown';
      const message = isPast
        ? `Episode ${entry.episode} of ${title} has aired!`
        : `${title} Episode ${entry.episode} airing soon`;

      statements.push({
        sql: 'INSERT INTO notifications (anilist_id, type, message) VALUES (?, ?, ?)',
        args: [mediaId, type, message],
      });
    }

    let created = 0;
    if (statements.length > 0) {
      try {
        const db = getDb();
        // Execute in chunks of 50 to keep batch size reasonable
        for (let i = 0; i < statements.length; i += 50) {
          const chunk = statements.slice(i, i + 50);
          const result = await db.batch(chunk, 'write');
          created += result.reduce((sum, r) => sum + (r.rowsAffected || 0), 0);
        }
      } catch (e) {
        console.error('[Notifications] batch insert failed, falling back to individual:', e);
        for (const stmt of statements) {
          try {
            await execute(stmt.sql, stmt.args);
            created++;
          } catch {}
        }
      }
    }

    return NextResponse.json({ success: true, created });
  } catch (err) {
    console.error('Failed to generate notifications:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getCachedSchedule(): Promise<AniListAiringSchedule[] | null> {
  try {
    const cached = await queryOne<{ data: string; cached_at: string }>(
      `SELECT data, cached_at FROM home_cache WHERE key = 'airing_schedule'`
    );
    if (!cached?.data) return null;
    const age = Date.now() - new Date(cached.cached_at + 'Z').getTime();
    if (age > 6 * 3600 * 1000) return null;
    return JSON.parse(cached.data);
  } catch {
    // Corrupt cache — delete it so the next call re-fetches cleanly
    try { await execute(`DELETE FROM home_cache WHERE key = 'airing_schedule'`); } catch {}
    return null;
  }
}

async function cacheSchedule(schedule: AniListAiringSchedule[]) {
  try {
    await execute(
      `INSERT INTO home_cache (key, data, cached_at) VALUES ('airing_schedule', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET data = excluded.data, cached_at = datetime('now')`,
      [JSON.stringify(schedule)]
    );
  } catch {}
}
