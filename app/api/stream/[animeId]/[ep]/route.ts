import { NextRequest, NextResponse } from 'next/server';
import { ADAPTERS } from '@/scraper/adapters';
import { execute, query, queryOne } from '@/lib/db';
import { recordSuccess, recordFailure, sortByHealth } from '@/lib/provider-health';
import { logStream } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ animeId: string; ep: string }>;
}

async function getEpisodeMeta(anilistId: number, epNum: number): Promise<{ title: string | null; thumbnail: string | null }> {
  try {
    const row = await queryOne<{ episodes_data: string }>(
      'SELECT episodes_data FROM anime_cache WHERE anilist_id = ? AND episodes_data IS NOT NULL',
      [anilistId]
    );
    if (row?.episodes_data) {
      const eps = JSON.parse(row.episodes_data) as Array<{ episode_number: number; title: string | null; thumbnail: string | null }>;
      const ep = eps.find(e => e.episode_number === epNum);
      if (ep) return { title: ep.title, thumbnail: ep.thumbnail };
    }
  } catch {}
  return { title: null, thumbnail: null };
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
    const isDubInt = isDub ? 1 : 0;

    const epMeta = await getEpisodeMeta(anilistId, episodeNumber);

    // Check episode_sources cache, filtered by SUB/DUB
    const cachedSources = await query<{
      source_adapter: string;
      stream_url: string;
      subtitle_url: string | null;
      resolved_at: string;
    }>(
      `SELECT source_adapter, stream_url, subtitle_url, resolved_at
       FROM episode_sources
       WHERE anilist_id = ? AND episode_number = ? AND is_dub = ?
       AND resolved_at >= datetime('now', '-24 hours')
       ORDER BY resolved_at DESC`,
      [anilistId, episodeNumber, isDubInt]
    );

    const knownAdapters = new Set(ADAPTERS.map(a => a.id));
    const adapterNameMap = Object.fromEntries(ADAPTERS.map(a => [a.id, a.name]));
    const validCached = cachedSources.filter(s => knownAdapters.has(s.source_adapter));

    if (validCached.length > 0 && !all) {
      return NextResponse.json({
        sources: validCached.map(s => ({
          adapterId: s.source_adapter,
          sourceName: adapterNameMap[s.source_adapter] || s.source_adapter,
          streamUrl: s.stream_url,
          subtitleUrl: s.subtitle_url,
        })),
      });
    }

    // Sort adapters by health score (healthiest first)
    const sortedPrimary = sortByHealth(
      ADAPTERS.filter(a => a.id === 'rapidstream' || a.id === 'nova' || a.id === 'megaplay').map(a => a.id)
    );
    const sortedFallback = sortByHealth(
      ADAPTERS.filter(a => a.id !== 'rapidstream' && a.id !== 'nova' && a.id !== 'megaplay').map(a => a.id)
    );
    const adapterMap = Object.fromEntries(ADAPTERS.map(a => [a.id, a]));

    const sources: { adapterId: string; sourceName: string; streamUrl: string; subtitleUrl: string | null }[] = [];

    // Try primary adapters in health order
    const primaryResults = await Promise.allSettled(
      sortedPrimary.map(async (adapterId) => {
        const adapter = adapterMap[adapterId];
        const start = Date.now();
        const source = await adapter.resolveEpisodeSource(anilistId, episodeNumber, isDub);
        const latency = Date.now() - start;
        if (source) {
          recordSuccess(adapterId, latency);
          logStream(`${adapterNameMap[adapterId] || adapterId} resolved ep ${episodeNumber} in ${latency}ms`);
          await execute(
            `INSERT OR REPLACE INTO episode_sources
             (anilist_id, episode_number, is_dub, source_adapter, stream_url, subtitle_url, title, thumbnail, resolved_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [anilistId, episodeNumber, isDubInt, source.adapterId, source.streamUrl, source.subtitleUrl, epMeta.title, epMeta.thumbnail]
          );
        } else {
          recordFailure(adapterId);
        }
        return source;
      })
    );

    for (const result of primaryResults) {
      if (result.status === 'fulfilled' && result.value) {
        sources.push({
          ...result.value,
          sourceName: adapterNameMap[result.value.adapterId] || result.value.adapterId,
        });
      }
    }

    if (sources.length === 0 || all) {
      const fallbackResults = await Promise.allSettled(
        sortedFallback.map(async (adapterId) => {
          const adapter = adapterMap[adapterId];
          const start = Date.now();
          const source = await adapter.resolveEpisodeSource(anilistId, episodeNumber, isDub);
          const latency = Date.now() - start;
          if (source) {
            recordSuccess(adapterId, latency);
            await execute(
              `INSERT OR REPLACE INTO episode_sources
               (anilist_id, episode_number, is_dub, source_adapter, stream_url, subtitle_url, title, thumbnail, resolved_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
              [anilistId, episodeNumber, isDubInt, source.adapterId, source.streamUrl, source.subtitleUrl, epMeta.title, epMeta.thumbnail]
            );
          } else {
            recordFailure(adapterId);
          }
          return source;
        })
      );

      for (const result of fallbackResults) {
        if (result.status === 'fulfilled' && result.value) {
          sources.push({
            ...result.value,
            sourceName: adapterNameMap[result.value.adapterId] || result.value.adapterId,
          });
        }
      }
    }

    logStream(`ep ${episodeNumber}: ${sources.length} source(s) found`);
    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Stream resolution API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
