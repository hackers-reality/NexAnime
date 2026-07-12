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

    // Call all adapters in parallel to resolve stream sources
    const resolvePromises = ADAPTERS.map(async (adapter) => {
      try {
        const source = await adapter.resolveEpisodeSource(anilistId, episodeNumber);
        if (source) {
          // Log resolved stream source to local SQLite table for records
          await execute(
            `INSERT INTO episode_sources (
              anilist_id, episode_number, source_adapter, stream_url, subtitle_url, resolved_at
            ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [
              anilistId,
              episodeNumber,
              source.adapterId,
              source.streamUrl,
              source.subtitleUrl,
            ]
          );
        }
        return source;
      } catch (err) {
        console.error(`Adapter ${adapter.id} failed to resolve:`, err);
        return null;
      }
    });

    const resolved = await Promise.all(resolvePromises);
    const sources = resolved.filter((s): s is NonNullable<typeof s> => s !== null);

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Stream resolution API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
