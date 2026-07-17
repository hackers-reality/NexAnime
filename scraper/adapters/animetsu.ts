import type { ScraperAdapter, ScraperSource } from './adapter';
import { queryOne } from '@/lib/db';
import { resolveAnimetsuStream } from '@/lib/animetsu';

export class AnimetsuAdapter implements ScraperAdapter {
  id = 'animetsu';
  name = 'Animetsu';

  async resolveEpisodeSource(
    anilistId: number,
    episodeNumber: number,
    isDub?: boolean
  ): Promise<ScraperSource | null> {
    console.log(`[Animetsu] Resolving for AniList ${anilistId}, ep ${episodeNumber}, dub=${!!isDub}`);

    try {
      // Get anime title from local cache (avoids AniList API call)
      const cached = await queryOne<{ title_romaji: string; title_english: string }>(
        'SELECT title_romaji, title_english FROM anime_cache WHERE anilist_id = ?',
        [anilistId]
      );

      const title = cached?.title_english || cached?.title_romaji;
      if (!title) {
        console.log(`[Animetsu] No title in cache for AniList ID ${anilistId}`);
        return null;
      }

      const sources = await resolveAnimetsuStream(anilistId, title, episodeNumber, !!isDub);
      if (sources.length === 0) {
        console.log(`[Animetsu] No streams found for "${title}" ep ${episodeNumber}`);
        return null;
      }

      // Return the first working source (prefer kite for soft subs)
      const best = sources.find(s => s.adapterId.includes('kite')) || sources[0];

      console.log(`[Animetsu] Resolved stream from ${best.sourceName}`);
      return {
        adapterId: best.adapterId,
        sourceName: best.sourceName,
        streamUrl: best.streamUrl,
        subtitleUrl: best.subtitleUrl,
      };
    } catch (err: any) {
      console.error(`[Animetsu] Failed:`, err.message);
      return null;
    }
  }
}
