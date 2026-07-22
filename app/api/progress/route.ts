import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { anilistId, episodeNumber, secondsWatched, durationSeconds } = body;

    if (!anilistId || episodeNumber === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();

    // Respect pause_history setting
    const settingsRes = await db.execute({
      sql: 'SELECT pause_history FROM settings WHERE id = 1',
      args: [],
    });
    if (settingsRes.rows.length > 0 && settingsRes.rows[0].pause_history === 1) {
      return NextResponse.json({ success: true });
    }

    const safeSeconds = secondsWatched ?? 0;
    const safeDuration = durationSeconds ?? 0;

    // Check if progress already exists
    const existing = await db.execute({
      sql: 'SELECT id FROM watch_progress WHERE anilist_id = ? AND episode_number = ?',
      args: [anilistId, episodeNumber]
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `
          UPDATE watch_progress 
          SET seconds_watched = ?, duration_seconds = ?, last_watched_at = datetime('now')
          WHERE anilist_id = ? AND episode_number = ?
        `,
        args: [safeSeconds, safeDuration, anilistId, episodeNumber]
      });
    } else {
      await db.execute({
        sql: `
          INSERT INTO watch_progress (anilist_id, episode_number, seconds_watched, duration_seconds, last_watched_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `,
        args: [anilistId, episodeNumber, safeSeconds, safeDuration]
      });
    }

    // Sync watchlist episode_watched with max episode from watch_progress
    await db.execute({
      sql: `
        UPDATE watchlist
        SET episode_watched = (
          SELECT COALESCE(MAX(episode_number), 0)
          FROM watch_progress
          WHERE anilist_id = ?
        ),
        updated_at = datetime('now')
        WHERE anilist_id = ?
      `,
      args: [anilistId, anilistId]
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update progress:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const anilistId = searchParams.get('anilistId');
  const episodeNumber = searchParams.get('episodeNumber');

  if (!anilistId || !episodeNumber) {
    return NextResponse.json({ error: 'Missing anilistId or episodeNumber' }, { status: 400 });
  }

  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT seconds_watched, duration_seconds FROM watch_progress WHERE anilist_id = ? AND episode_number = ?',
      args: [parseInt(anilistId), parseInt(episodeNumber)]
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ secondsWatched: 0, durationSeconds: 0 });
    }

    return NextResponse.json({
      secondsWatched: result.rows[0].seconds_watched,
      durationSeconds: result.rows[0].duration_seconds
    });
  } catch (err) {
    console.error('Failed to fetch progress:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
