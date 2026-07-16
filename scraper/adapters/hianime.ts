import type { ScraperAdapter, ScraperSource } from './adapter';

const OBF_KEY = 'otaku-embed-v1';

function xor(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length));
  }
  return out;
}

function deobfuscate(blob: string): any {
  const binary = Buffer.from(blob, 'base64').toString('binary');
  const xored = xor(binary);
  return JSON.parse(decodeURIComponent(escape(xored)));
}

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
    episodeNumber: number
  ): Promise<ScraperSource | null> {
    console.log(`[Hianime Scraper] Resolving source for AniList ID: ${anilistId}, Episode: ${episodeNumber}`);

    try {
      const malId = await getMalId(anilistId);
      if (!malId) {
        console.log(`[Hianime Scraper] Could not find MAL ID mapping for AniList ID ${anilistId}`);
        return null;
      }

      const url = `https://zokoanime.video/stream/mal/${malId}/${episodeNumber}/sub?color=35d5bf`;
      console.log(`[Hianime Scraper] Fetching stream embed: ${url}`);

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          'Referer': 'https://hianimes.se/'
        }
      });

      if (!res.ok) {
        throw new Error(`zokoanime.video returned HTTP ${res.status}`);
      }

      const text = await res.text();
      const match = text.match(/window\.__P\s*=\s*"([^"]+)"/);
      if (!match) {
        throw new Error('Could not extract window.__P from stream player page');
      }

      const decrypted = deobfuscate(match[1]);
      if (!decrypted || !decrypted.src) {
        throw new Error('Decrypted player options did not contain a valid source URL');
      }

      console.log(`[Hianime Scraper] Successfully decrypted stream URL: ${decrypted.src}`);

      let subtitleUrl: string | null = null;
      if (decrypted.subtitles && Array.isArray(decrypted.subtitles)) {
        const enSub = decrypted.subtitles.find((sub: any) => 
          sub.lang?.toLowerCase() === 'en' || 
          sub.label?.toLowerCase()?.includes('english')
        );
        if (enSub) {
          subtitleUrl = enSub.src;
        }
      }

      return {
        adapterId: this.id,
        sourceName: this.name,
        streamUrl: decrypted.src,
        subtitleUrl: subtitleUrl,
      };
    } catch (err: any) {
      console.error(`[Hianime Scraper] Failed to resolve stream:`, err.message);
      return null;
    }
  }
}
