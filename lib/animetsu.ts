// NexAnime — Animetsu.cc API client
// Provides streaming sources from animetsu.cc's backend API
// No AniList rate limits — completely independent data source

import { queryOne, execute } from './db';

const ANIMETSU_BASES = [
  'https://animetsu.cc/v2/api/anime',
  'https://animetsu.live/v2/api/anime',
];
let currentBaseIndex = 0;
const PROXY_BASE = '/api/proxy/hls';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Referer': 'https://animetsu.cc/',
  'Origin': 'https://animetsu.cc',
};

// ─── Types ──────────────────────────────────────────────

export interface AnimetsuSearchResult {
  id: string; // MongoDB ObjectId
  type: string;
  title: string; // Raw format: "@{romaji=X; english=Y; native=Z}"
  status: string;
  is_adult: boolean;
  cover_image: string;
  banner: string | null;
  description: string;
  total_eps: number;
  start_date: string;
  end_date: string;
  year: number;
  format: string;
  duration: number;
  genres: string;
  average_score: number;
  trailer: string | null;
  season: string;
}

export interface AnimetsuEpisode {
  ep_num: number;
  aired_at: string;
  desc: string;
  dislikes: number;
  img: string;
  is_filler: boolean;
  likes: number;
  name: string;
  views: number;
  id: string;
}

export interface AnimetsuServer {
  id: string; // 'kite', 'dio', 'sage', 'meg'
  default: boolean;
  tip: string;
}

export interface AnimetsuSource {
  quality: string;
  url: string;
  old_hls: boolean;
  type: string;
  need_proxy: boolean;
}

export interface AnimetsuStreamResponse {
  sources: AnimetsuSource[];
  subs: Array<{ label: string; url: string; lang: string }>;
  skips: {
    intro: { start: number; end: number };
    outro: { start: number; end: number };
    ep_num: number;
  };
  server: string;
}

// ─── Title parser ────────────────────────────────────────
// Animetsu returns titles in Java toString format:
// "@{romaji=NARUTO; english=Naruto; native=NARUTO -???-}"
function parseAnimetsuTitle(raw: string): { romaji: string; english: string; native: string } {
  const result = { romaji: '', english: '', native: '' };
  if (!raw) return result;
  
  const romajiMatch = raw.match(/romaji=([^;)]+)/);
  const englishMatch = raw.match(/english=([^;)]+)/);
  const nativeMatch = raw.match(/native=([^;)]+)/);
  
  if (romajiMatch) result.romaji = romajiMatch[1].trim();
  if (englishMatch) result.english = englishMatch[1].trim();
  if (nativeMatch) result.native = nativeMatch[1].trim();
  
  return result;
}

// ─── ID Mapping Cache ───────────────────────────────────
// Cache AniList ID → Animetsu MongoDB ID mapping in DB

async function getCachedAnimetsuId(anilistId: number): Promise<string | null> {
  const row = await queryOne<{ animetsu_id: string }>(
    'SELECT animetsu_id FROM animetsu_id_cache WHERE anilist_id = ?',
    [anilistId]
  );
  return row?.animetsu_id ?? null;
}

async function cacheAnimetsuId(anilistId: number, animetsuId: string): Promise<void> {
  await execute(
    `INSERT OR REPLACE INTO animetsu_id_cache (anilist_id, animetsu_id, cached_at)
     VALUES (?, ?, datetime('now'))`,
    [anilistId, animetsuId]
  );
}

// ─── API Functions ──────────────────────────────────────

async function animetsuFetch<T>(path: string): Promise<T | null> {
  // Try each base URL, rotating on failure
  for (let attempt = 0; attempt < ANIMETSU_BASES.length; attempt++) {
    const baseIndex = (currentBaseIndex + attempt) % ANIMETSU_BASES.length;
    const base = ANIMETSU_BASES[baseIndex];
    try {
      const res = await fetch(`${base}${path}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      currentBaseIndex = baseIndex; // Stick with working base
      return await res.json() as T;
    } catch (err) {
      console.error(`[Animetsu] API error for ${base}${path}:`, err);
    }
  }
  return null;
}

/**
 * Search animetsu by title to find the MongoDB ID.
 * Used to bridge AniList IDs → Animetsu IDs.
 */
export async function searchAnimetsu(title: string): Promise<AnimetsuSearchResult | null> {
  const data = await animetsuFetch<{ results: AnimetsuSearchResult[] }>(
    `/search?query=${encodeURIComponent(title)}`
  );
  if (!data?.results?.length) return null;
  return data.results[0];
}

/**
 * Resolve the animetsu MongoDB ID for an AniList anime.
 * Checks cache first, then searches by title.
 */
export async function resolveAnimetsuId(anilistId: number, title: string): Promise<string | null> {
  // Check cache first
  const cached = await getCachedAnimetsuId(anilistId);
  if (cached) return cached;

  // Search by title
  const result = await searchAnimetsu(title);
  if (!result) return null;

  // Cache the mapping
  await cacheAnimetsuId(anilistId, result.id);
  return result.id;
}

/**
 * Get episode list from animetsu.
 */
export async function getAnimetsuEpisodes(animetsuId: string): Promise<AnimetsuEpisode[]> {
  const data = await animetsuFetch<AnimetsuEpisode[]>(`/eps/${animetsuId}`);
  return data ?? [];
}

/**
 * Get available servers for an episode.
 */
export async function getAnimetsuServers(animetsuId: string, ep: number): Promise<AnimetsuServer[]> {
  const data = await animetsuFetch<AnimetsuServer[]>(`/servers/${animetsuId}/${ep}`);
  return data ?? [];
}

/**
 * Get streaming sources for a specific episode and server.
 * Returns proxied URLs ready for playback.
 */
export async function getAnimetsuStream(
  animetsuId: string,
  ep: number,
  server: string = 'kite',
  sourceType: string = 'sub'
): Promise<AnimetsuStreamResponse | null> {
  const data = await animetsuFetch<AnimetsuStreamResponse>(
    `/oppai/${animetsuId}/${ep}?server=${server}&source_type=${sourceType}`
  );
  if (!data) return null;

  // Proxy URLs that need proxying
  data.sources = data.sources.map(s => ({
    ...s,
    url: s.need_proxy ? `${PROXY_BASE}${s.url}` : s.url,
  }));

  return data;
}

/**
 * Get all available servers with streaming sources for an episode.
 * Tries each server and returns working ones.
 */
export async function getAnimetsuAllSources(
  animetsuId: string,
  ep: number,
  sourceType: string = 'sub'
): Promise<Array<{ server: string; source: AnimetsuSource; skips?: AnimetsuStreamResponse['skips'] }>> {
  const servers = await getAnimetsuServers(animetsuId, ep);
  if (!servers.length) return [];

  const results: Array<{ server: string; source: AnimetsuSource; skips?: AnimetsuStreamResponse['skips'] }> = [];

  // Try servers in parallel (max 3 concurrent)
  const serverBatch = servers.slice(0, 3);
  const streamPromises = serverBatch.map(async (srv) => {
    const stream = await getAnimetsuStream(animetsuId, ep, srv.id, sourceType);
    if (stream?.sources?.length) {
      return {
        server: srv.id,
        source: stream.sources[0],
        skips: stream.skips,
      };
    }
    return null;
  });

  const results_raw = await Promise.allSettled(streamPromises);
  for (const r of results_raw) {
    if (r.status === 'fulfilled' && r.value) {
      results.push(r.value);
    }
  }

  return results;
}

/**
 * Convenience function: resolve an AniList ID + episode to animetsu stream URLs.
 * This is the main entry point for the adapter.
 */
export async function resolveAnimetsuStream(
  anilistId: number,
  animeTitle: string,
  episodeNumber: number,
  isDub: boolean = false
): Promise<{ adapterId: string; sourceName: string; streamUrl: string; subtitleUrl: string | null }[]> {
  const animetsuId = await resolveAnimetsuId(anilistId, animeTitle);
  if (!animetsuId) {
    console.log(`[Animetsu] No mapping found for AniList ID ${anilistId} (${animeTitle})`);
    return [];
  }

  const sourceType = isDub ? 'dub' : 'sub';
  const allSources = await getAnimetsuAllSources(animetsuId, episodeNumber, sourceType);

  return allSources.map(s => ({
    adapterId: `animetsu-${s.server}`,
    sourceName: `Animetsu (${s.server})`,
    streamUrl: s.source.url,
    subtitleUrl: null, // subs are embedded in HLS or returned separately
  }));
}
