import { NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getAiringSchedule } from '@/lib/anilist';

export async function POST() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sixHoursAgo = now - 6 * 3600;
    const sixHoursLater = now + 6 * 3600;

    // Fetch airing schedule from AniList
    const schedule = await getAiringSchedule(sixHoursAgo, sixHoursLater, 1, 100);
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
