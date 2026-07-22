import { NextRequest, NextResponse } from 'next/server';
import { ADAPTERS } from '@/scraper/adapters';
import { execute, query } from '@/lib/db';

interface RouteParams {
  params: Promise<{ animeId: string; ep: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { animeId, ep } = await params;
    const anilistId = parseInt(animeId);
    const episodeNumber = parseInt(ep);

    if (isNaN(anilistId) || isNaN(episodeNumber)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const isDub = request.nextUrl.searchParams.get('dub') === 'true';
    const all = request.nextUrl.searchParams.get('all') === 'true';
    const quality = request.nextUrl.searchParams.get('quality');

    if (quality) {
      console.log(`[Stream] Quality preference "${quality}" requested for anime ${anilistId} ep ${episodeNumber} — adapters do not support quality selection yet`);
    }

    // Check episode_sources cache first
    const cachedSources = await query<{
      source_adapter: string;
      stream_url: string;
      subtitle_url: string | null;
      resolved_at: string;
    }>(
      `SELECT source_adapter, stream_url, subtitle_url, resolved_at
       FROM episode_sources
       WHERE anilist_id = ? AND episode_number = ?
       AND resolved_at >= datetime('now', '-24 hours')
       ORDER BY resolved_at DESC`,
      [anilistId, episodeNumber]
    );

    const knownAdapters = new Set(ADAPTERS.map(a => a.id));
    const validCached = cachedSources.filter(s => knownAdapters.has(s.source_adapter));

    if (validCached.length > 0 && !all) {
      return NextResponse.json({
        sources: validCached.map(s => ({
          adapterId: s.source_adapter,
          sourceName: s.source_adapter,
          streamUrl: s.stream_url,
          subtitleUrl: s.subtitle_url,
        })),
      });
    }

    // Try primary adapters (RapidStream + Nova + MegaPlay) first, then fallbacks in parallel
    const primaryAdapters = ADAPTERS.filter(a => a.id === 'rapidstream' || a.id === 'nova' || a.id === 'megaplay');
    const fallbackAdapters = ADAPTERS.filter(a => a.id !== 'rapidstream' && a.id !== 'nova' && a.id !== 'megaplay');

    const sources: { adapterId: string; sourceName: string; streamUrl: string; subtitleUrl: string | null }[] = [];

    // Try primary adapters in parallel (fast — just HEAD requests)
    const primaryResults = await Promise.allSettled(
      primaryAdapters.map(async (adapter) => {
        const source = await adapter.resolveEpisodeSource(anilistId, episodeNumber, isDub);
        if (source) {
          await execute(
            `INSERT OR IGNORE INTO episode_sources (anilist_id, episode_number, source_adapter, stream_url, subtitle_url, resolved_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [anilistId, episodeNumber, source.adapterId, source.streamUrl, source.subtitleUrl]
          );
        }
        return source;
      })
    );

    for (const result of primaryResults) {
      if (result.status === 'fulfilled' && result.value) {
        sources.push(result.value);
      }
    }

    // If no primary sources found or all requested, try fallbacks
    if (sources.length === 0 || all) {
      const fallbackResults = await Promise.allSettled(
        fallbackAdapters.map(async (adapter) => {
          const source = await adapter.resolveEpisodeSource(anilistId, episodeNumber, isDub);
          if (source) {
            await execute(
              `INSERT OR IGNORE INTO episode_sources (anilist_id, episode_number, source_adapter, stream_url, subtitle_url, resolved_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))`,
              [anilistId, episodeNumber, source.adapterId, source.streamUrl, source.subtitleUrl]
            );
          }
          return source;
        })
      );

      for (const result of fallbackResults) {
        if (result.status === 'fulfilled' && result.value) {
          sources.push(result.value);
        }
      }
    }

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Stream resolution API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
