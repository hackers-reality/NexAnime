import type { ScraperAdapter, ScraperSource } from './adapter';

async function getMalId(anilistId: number): Promise<number | null> {
  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        idMal
      }
    }
  `;
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: anilistId } })
    });
    const json = await res.json();
    return json.data?.Media?.idMal || null;
  } catch (err) {
    console.error('[Hianime Scraper] Failed to fetch MAL ID from AniList:', err);
    return null;
  }
}

export class HianimeAdapter implements ScraperAdapter {
  id = 'hianime';
  name = 'HiAnime (High Quality)';

  async resolveEpisodeSource(
    anilistId: number,
    episodeNumber: number,
    isDub?: boolean
  ): Promise<ScraperSource | null> {
    console.log(`[Hianime Scraper] Resolving source for AniList ID: ${anilistId}, Episode: ${episodeNumber}, Dub: ${!!isDub}`);

    try {
      const malId = await getMalId(anilistId);
      if (!malId) {
        console.log(`[Hianime Scraper] Could not find MAL ID mapping for AniList ID ${anilistId}`);
        return null;
      }

      const type = isDub ? 'dub' : 'sub';
      const embedUrl = `https://zokoanime.video/stream/mal/${malId}/${episodeNumber}/${type}?color=35d5bf`;
      console.log(`[Hianime Scraper] Verifying stream embed: ${embedUrl}`);

      const res = await fetch(embedUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          'Referer': 'https://hianimes.se/'
        }
      });

      if (res.status !== 200) {
        throw new Error(`Episode embed not available (HTTP ${res.status})`);
      }

      console.log(`[Hianime Scraper] Successfully verified embed URL: ${embedUrl}`);

      return {
        adapterId: this.id,
        sourceName: this.name,
        streamUrl: embedUrl,
        subtitleUrl: null, // Subtitles are rendered natively inside the ZokoAnime player iframe
      };
    } catch (err: any) {
      console.error(`[Hianime Scraper] Failed to resolve stream:`, err.message);
      return null;
    }
  }
}
