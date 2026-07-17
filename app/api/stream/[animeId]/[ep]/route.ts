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

    if (cachedSources.length > 0) {
    return NextResponse.json({
      sources: cachedSources.map(s => ({
        adapterId: s.source_adapter,
        sourceName: s.source_adapter,
        streamUrl: s.stream_url.startsWith('/') ? `${request.nextUrl.origin}${s.stream_url}` : s.stream_url,
        subtitleUrl: s.subtitle_url,
      })),
    });
    }

    // Resolve Animetsu (primary — no AniList rate limits) first
    const primaryAdapter = ADAPTERS.find(a => a.id === 'animetsu');
    const fallbackAdapters = ADAPTERS.filter(a => a.id !== 'animetsu');

    const sources: { adapterId: string; sourceName: string; streamUrl: string; subtitleUrl: string | null }[] = [];

    // Try primary adapter first
    if (primaryAdapter) {
      try {
        const source = await primaryAdapter.resolveEpisodeSource(anilistId, episodeNumber, isDub);
        if (source) {
          sources.push(source);
          await execute(
            `INSERT INTO episode_sources (anilist_id, episode_number, source_adapter, stream_url, subtitle_url, resolved_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [anilistId, episodeNumber, source.adapterId, source.streamUrl, source.subtitleUrl]
          );
        }
      } catch (err) {
        console.error(`Primary adapter ${primaryAdapter.id} failed:`, err);
      }
    }

    // If primary failed or we want all sources, try fallbacks in parallel
    if (sources.length === 0 || request.nextUrl.searchParams.get('all') === 'true') {
      const fallbackResults = await Promise.allSettled(
        fallbackAdapters.map(async (adapter) => {
          const source = await adapter.resolveEpisodeSource(anilistId, episodeNumber, isDub);
          if (source) {
            await execute(
              `INSERT INTO episode_sources (anilist_id, episode_number, source_adapter, stream_url, subtitle_url, resolved_at)
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

    return NextResponse.json({
      sources: sources.map(s => ({
        ...s,
        streamUrl: s.streamUrl.startsWith('/') ? `${request.nextUrl.origin}${s.streamUrl}` : s.streamUrl,
      })),
    });
  } catch (error) {
    console.error('Stream resolution API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
