// NexAnime — Watchlist API route
// Handles operations for the user's watchlist entries and logs activity

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, query } from '@/lib/db';
import type { WatchlistEntry, ListStatus } from '@/types';

// Map database status string to friendly display representation for activity messages
const STATUS_LABELS: Record<ListStatus, string> = {
  planning: 'Plan to watch',
  watching: 'Watching',
  on_hold: 'On hold',
  dropped: 'Dropped',
  finished: 'Completed',
  rewatching: 'Rewatching',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anilistId = searchParams.get('anilistId');
    const continueMode = searchParams.get('continue') === 'true';
    if (continueMode) {
      // First try watch_progress table (native video sources)
      const progress = await query<any>(
        `SELECT wp.anilist_id, wp.episode_number, wp.seconds_watched, wp.duration_seconds,
                c.title_romaji, c.title_english, c.cover_image,
                (SELECT thumbnail FROM episode_sources WHERE anilist_id = wp.anilist_id AND episode_number = wp.episode_number AND thumbnail IS NOT NULL LIMIT 1) as ep_thumbnail
         FROM watch_progress wp
         LEFT JOIN anime_cache c ON wp.anilist_id = c.anilist_id
         WHERE (wp.duration_seconds = 0 OR wp.seconds_watched < wp.duration_seconds - 15)
           AND wp.seconds_watched > 0
         ORDER BY wp.last_watched_at DESC
         LIMIT 6`
      );

      if (progress.length >= 1) {
        return NextResponse.json({ progress });
      }

      // Fallback: use watchlist entries with "watching" status (for embed sources)
      const watching = await query<any>(
        `SELECT w.anilist_id, w.episode_watched as episode_number, 0 as seconds_watched, 0 as duration_seconds,
                c.title_romaji, c.title_english, c.cover_image,
                NULL as ep_thumbnail
         FROM watchlist w
         LEFT JOIN anime_cache c ON w.anilist_id = c.anilist_id
         WHERE w.list_status = 'watching' AND w.episode_watched > 0
         ORDER BY w.updated_at DESC
         LIMIT 6`
      );

      return NextResponse.json({ progress: watching });
    }

    if (anilistId && anilistId !== 'undefined' && anilistId !== 'null') {
      const parsedId = parseInt(anilistId);
      if (isNaN(parsedId)) {
        return NextResponse.json({ entry: null });
      }
      // Get a single watchlist entry
      const entry = await queryOne<any>(
        'SELECT * FROM watchlist WHERE anilist_id = ?',
        [parsedId]
      );

      if (!entry) {
        return NextResponse.json({ entry: null });
      }

      // Convert snake_case columns from SQLite to camelCase
      const formattedEntry: WatchlistEntry = {
        id: entry.id,
        anilistId: entry.anilist_id,
        listStatus: entry.list_status,
        startDate: entry.start_date,
        endDate: entry.end_date,
        score: entry.score,
        episodeWatched: entry.episode_watched,
        totalRewatches: entry.total_rewatches,
        notes: entry.notes,
        updatedAt: entry.updated_at,
      };

      return NextResponse.json({ entry: formattedEntry });
    }

    // List all watchlist entries with cached metadata
    const entries = await query<any>(`
      SELECT w.*, 
             c.title_romaji, c.title_english, c.title_native,
             c.cover_image, c.format, c.episode_count, c.season_year,
             c.average_score, c.status, c.synopsis, c.genres
      FROM watchlist w
      LEFT JOIN anime_cache c ON w.anilist_id = c.anilist_id
      ORDER BY w.updated_at DESC
    `);
    
    const formattedEntries = entries.map((entry) => {
      let parsedGenres: string[] = [];
      try {
        if (entry.genres) parsedGenres = JSON.parse(entry.genres);
      } catch {}

      return {
        id: entry.id,
        anilistId: entry.anilist_id,
        listStatus: entry.list_status,
        startDate: entry.start_date,
        endDate: entry.end_date,
        score: entry.score,
        episodeWatched: entry.episode_watched,
        totalRewatches: entry.total_rewatches,
        notes: entry.notes,
        updatedAt: entry.updated_at,
        anime: {
          title: {
            romaji: entry.title_romaji,
            english: entry.title_english,
            native: entry.title_native,
          },
          coverImage: {
            extraLarge: entry.cover_image,
          },
          format: entry.format,
          episodes: entry.episode_count,
          seasonYear: entry.season_year,
          averageScore: entry.average_score,
          status: entry.status,
          synopsis: entry.synopsis || null,
          genres: parsedGenres,
        }
      };
    });

    return NextResponse.json({ entries: formattedEntries });
  } catch (error) {
    console.error('Watchlist GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      anilistId,
      listStatus,
      startDate,
      endDate,
      score,
      episodeWatched,
      totalRewatches,
      notes,
      animeTitle, // Passed optionally for activity logging message clarity
    } = body;

    if (!anilistId) {
      return NextResponse.json({ error: 'Missing anilistId' }, { status: 400 });
    }

    // Check if an entry already exists to log the appropriate activity diff
    const existing = await queryOne<any>(
      'SELECT list_status, score, episode_watched FROM watchlist WHERE anilist_id = ?',
      [anilistId]
    );

    // Save or update watchlist entry
    await execute(
      `INSERT INTO watchlist (
        anilist_id, list_status, start_date, end_date, score,
        episode_watched, total_rewatches, notes, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
      ) ON CONFLICT(anilist_id) DO UPDATE SET
        list_status = excluded.list_status,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        score = excluded.score,
        episode_watched = excluded.episode_watched,
        total_rewatches = excluded.total_rewatches,
        notes = excluded.notes,
        updated_at = datetime('now')`,
      [
        anilistId,
        listStatus || 'planning',
        startDate || null,
        endDate || null,
        score || null,
        episodeWatched || 0,
        totalRewatches || 0,
        notes || null,
      ]
    );

    // Activity logging
    const title = animeTitle || `Anime #${anilistId}`;
    if (!existing) {
      // New entry
      const displayStatus = STATUS_LABELS[listStatus as ListStatus] || listStatus;
      await execute(
        'INSERT INTO activity_log (type, anilist_id, message) VALUES (?, ?, ?)',
        ['status_change', anilistId, `Added "${title}" to ${displayStatus}`]
      );
    } else {
      // Check status changes
      if (listStatus && existing.list_status !== listStatus) {
        const displayStatus = STATUS_LABELS[listStatus as ListStatus] || listStatus;
        await execute(
          'INSERT INTO activity_log (type, anilist_id, message) VALUES (?, ?, ?)',
          ['status_change', anilistId, `Changed status of "${title}" to ${displayStatus}`]
        );
      }
      // Check episode watched progress
      if (episodeWatched !== undefined && existing.episode_watched !== episodeWatched) {
        await execute(
          'INSERT INTO activity_log (type, anilist_id, message) VALUES (?, ?, ?)',
          [
            'episode_watched',
            anilistId,
            `Watched episode ${episodeWatched} of "${title}"`,
          ]
        );
      }
      // Check score changes
      if (score !== undefined && existing.score !== score) {
        await execute(
          'INSERT INTO activity_log (type, anilist_id, message) VALUES (?, ?, ?)',
          ['score_updated', anilistId, `Rated "${title}" a ${score}/100`]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Watchlist POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anilistId = searchParams.get('anilistId');

    if (!anilistId) {
      return NextResponse.json({ error: 'Missing anilistId' }, { status: 400 });
    }

    // Delete from watchlist
    await execute('DELETE FROM watchlist WHERE anilist_id = ?', [parseInt(anilistId)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Watchlist DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH — Bulk operations
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, listStatus } = body as {
      action: 'mark_all_watched' | 'remove_all' | 'change_status';
      listStatus?: ListStatus;
    };

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    let whereClause = '';
    const params: any[] = [];

    if (listStatus) {
      whereClause = 'WHERE list_status = ?';
      params.push(listStatus);
    }

    if (action === 'mark_all_watched') {
      // Move all entries (or filtered by status) to 'finished'
      await execute(
        `UPDATE watchlist SET list_status = 'finished', updated_at = datetime('now') ${whereClause}`,
        params
      );
    } else if (action === 'remove_all') {
      await execute(`DELETE FROM watchlist ${whereClause}`, params);
    } else if (action === 'change_status') {
      // Body should also have `targetStatus`
      const { targetStatus } = body;
      if (!targetStatus) {
        return NextResponse.json({ error: 'Missing targetStatus' }, { status: 400 });
      }
      await execute(
        `UPDATE watchlist SET list_status = ?, updated_at = datetime('now') ${whereClause}`,
        [targetStatus, ...params]
      );
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Watchlist PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
