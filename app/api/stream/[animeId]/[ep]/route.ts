import { NextRequest, NextResponse } from 'next/server';
import { ADAPTERS } from '@/scraper/adapters';
import { execute } from '@/lib/db';

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

    // Resolve Nova (primary) first for fastest response
    const primaryAdapter = ADAPTERS.find(a => a.id === 'nova');
    const fallbackAdapters = ADAPTERS.filter(a => a.id !== 'nova');

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

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Stream resolution API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
