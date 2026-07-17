// NexAnime — AniList API proxy route
// Server-side proxy for AniList GraphQL queries
// Caches results to anime_cache table

import { NextRequest, NextResponse } from 'next/server';
import {
  searchCharacters,
  getCharacterById,
  fetchUserList,
} from '@/lib/anilist';
import { execute } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'searchCharacters': {
        const result = await searchCharacters(
          params.search,
          params.page,
          params.perPage
        );
        return NextResponse.json(result);
      }

      case 'getCharacterById': {
        const character = await getCharacterById(params.id);
        return NextResponse.json({ character });
      }

      case 'importUserList': {
        const entries = await fetchUserList(params.username);

        // Persist imported entries into SQLite watchlist table
        for (const entry of entries) {
          let status = 'planning';
          const alStatus = entry.status.toUpperCase();
          if (alStatus === 'CURRENT') status = 'watching';
          else if (alStatus === 'PAUSED') status = 'on_hold';
          else if (alStatus === 'DROPPED') status = 'dropped';
          else if (alStatus === 'COMPLETED') status = 'finished';
          else if (alStatus === 'REPEATING') status = 'rewatching';

          await execute(
            `INSERT OR REPLACE INTO watchlist (
              anilist_id, list_status, score, episode_watched, total_rewatches, notes, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              entry.mediaId,
              status,
              entry.score ? Math.floor(entry.score * 10) : null,
              entry.progress || 0,
              entry.repeat || 0,
              entry.notes || null,
            ]
          );
        }
        return NextResponse.json({ entries });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AniList API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
