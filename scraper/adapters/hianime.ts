import type { ScraperAdapter, ScraperSource } from './adapter';
import { queryOne } from '@/lib/db';

async function getMalId(anilistId: number): Promise<number | null> {
  const cached = await queryOne<{ mal_id: number }>(
    'SELECT mal_id FROM anime_cache WHERE anilist_id = ?',
    [anilistId]
  );
  if (cached?.mal_id) return cached.mal_id;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query ($id: Int) { Media(id: $id, type: ANIME) { idMal } }`,
        variables: { id: anilistId }
      }),
      signal: AbortSignal.timeout(3000),
    });
    const json = await res.json();
    return json.data?.Media?.idMal || null;
  } catch {
    return null;
  }
}

export class AnimePlayAdapter implements ScraperAdapter {
  id = 'rapidstream';
  name = 'RapidStream';

  async resolveEpisodeSource(anilistId: number, episodeNumber: number, isDub?: boolean): Promise<ScraperSource | null> {
    const malId = await getMalId(anilistId);
    if (!malId) return null;

    const type = isDub ? 'dub' : 'sub';
    const streamUrl = `https://animeplay.cfd/stream/mal/${malId}/${episodeNumber}/${type}`;

    try {
      const res = await fetch(streamUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://hianimes.se/' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 200) {
        return { adapterId: this.id, sourceName: this.name, streamUrl, subtitleUrl: null };
      }
    } catch {}
    return null;
  }
}

export class ZokoAdapter implements ScraperAdapter {
  id = 'nova';
  name = 'Nova';

  private OBF_KEY = 'otaku-embed-v1';

  private xorDec(str: string): string {
    let out = '';
    for (let i = 0; i < str.length; i++) {
      out += String.fromCharCode(str.charCodeAt(i) ^ this.OBF_KEY.charCodeAt(i % this.OBF_KEY.length));
    }
    return out;
  }

  private deobfuscate(blob: string): { src?: string; subtitles?: Array<{ src: string; lang: string; label: string }> } {
    return JSON.parse(decodeURIComponent(escape(this.xorDec(atob(blob)))));
  }

  async resolveEpisodeSource(anilistId: number, episodeNumber: number, isDub?: boolean): Promise<ScraperSource | null> {
    const malId = await getMalId(anilistId);
    if (!malId) return null;

    const type = isDub ? 'dub' : 'sub';
    const iframeUrl = `https://zokoanime.video/stream/mal/${malId}/${episodeNumber}/${type}?color=35d5bf`;

    try {
      const res = await fetch(iframeUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://hianimes.se/' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const html = await res.text();

      // Extract __P token
      const pMatch = html.match(/window\.__P\s*=\s*["']([^"']+)["']/);
      if (!pMatch) return null;

      const decoded = this.deobfuscate(pMatch[1]);
      if (!decoded.src) return null;

      const streamUrl = decoded.src;
      const subtitleUrl = decoded.subtitles?.[0]?.src || null;

      return { adapterId: this.id, sourceName: this.name, streamUrl, subtitleUrl };
    } catch {
      return null;
    }
  }
}

export class MegaPlayAdapter implements ScraperAdapter {
  id = 'megaplay';
  name = 'MegaPlay';

  async resolveEpisodeSource(anilistId: number, episodeNumber: number, isDub?: boolean): Promise<ScraperSource | null> {
    const malId = await getMalId(anilistId);
    if (!malId) return null;

    const type = isDub ? 'dub' : 'sub';
    const streamUrl = `https://megaplay.buzz/stream/mal/${malId}/${episodeNumber}/${type}`;

    try {
      const res = await fetch(streamUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://hianimes.se/' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 200) {
        return { adapterId: this.id, sourceName: this.name, streamUrl, subtitleUrl: null };
      }
    } catch {}
    return null;
  }
}
