import type { JikanCharacterEntry, JikanStaffEntry, JikanEpisode, CharacterWithVA, StaffEntry } from '@/types';

const BASE = 'https://api.jikan.moe/v4';

// ─── Simple rate limiter (1 req/second) ────────────────────

let lastRequestTime = 0;

async function jikanFetch<T>(path: string, retries = 1): Promise<T | null> {
  const now = Date.now();
  const waitTime = Math.max(0, 1100 - (now - lastRequestTime));
  if (waitTime > 0) {
    await new Promise(r => setTimeout(r, waitTime));
  }
  lastRequestTime = Date.now();

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': 'NexAnime/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      // Retry once on 429 (rate limit) or 504 (upstream MAL timeout) after a longer pause
      if (retries > 0 && (res.status === 429 || res.status === 504 || res.status === 500)) {
        await new Promise(r => setTimeout(r, 2000));
        // Reset lastRequestTime so the next attempt also waits a bit
        lastRequestTime = Date.now();
        return jikanFetch<T>(path, retries - 1);
      }
      return null;
    }
    const json = await res.json();
    return json.data as T;
  } catch {
    return null;
  }
}

// Variant that ALSO returns pagination metadata — needed for episode list pagination
async function jikanFetchWithPagination<T>(path: string, retries = 1): Promise<{ data: T; hasNext: boolean } | null> {
  const now = Date.now();
  const waitTime = Math.max(0, 1100 - (now - lastRequestTime));
  if (waitTime > 0) {
    await new Promise(r => setTimeout(r, waitTime));
  }
  lastRequestTime = Date.now();

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': 'NexAnime/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      if (retries > 0 && (res.status === 429 || res.status === 504 || res.status === 500)) {
        await new Promise(r => setTimeout(r, 2000));
        lastRequestTime = Date.now();
        return jikanFetchWithPagination<T>(path, retries - 1);
      }
      return null;
    }
    const json = await res.json();
    return {
      data: json.data as T,
      hasNext: Boolean(json.pagination?.has_next_page),
    };
  } catch {
    return null;
  }
}

// ─── Characters with voice actors ──────────────────────────

export async function getJikanCharacters(malId: number): Promise<CharacterWithVA[]> {
  const entries = await jikanFetch<JikanCharacterEntry[]>(`/anime/${malId}/characters`);
  if (!entries) return [];

  return entries.map(entry => ({
    id: entry.character.mal_id,
    malId: entry.character.mal_id,
    name: entry.character.name,
    image: entry.character.images?.jpg?.image_url || null,
    role: entry.role || 'MAIN',
    voiceActors: (entry.voice_actors || []).map(va => ({
      id: va.person.mal_id,
      name: va.person.name,
      image: va.person.images?.jpg?.image_url || null,
      language: va.language || 'Japanese',
    })),
  }));
}

// ─── Staff ──────────────────────────────────────────────────

export async function getJikanStaff(malId: number): Promise<StaffEntry[]> {
  const entries = await jikanFetch<JikanStaffEntry[]>(`/anime/${malId}/staff`);
  if (!entries) return [];

  return entries.map(entry => ({
    id: entry.person.mal_id,
    name: entry.person.name,
    image: entry.person.images?.jpg?.image_url || null,
    roles: entry.positions || [],
  }));
}

// ─── Episodes ───────────────────────────────────────────────

export async function getJikanEpisodes(malId: number): Promise<JikanEpisode[]> {
  const allEpisodes: JikanEpisode[] = [];
  let page = 1;
  let hasMore = true;
  // Cap at 12 pages (1200 episodes) to avoid unbounded pagination on long-running shows
  const MAX_PAGES = 12;

  while (hasMore && page <= MAX_PAGES) {
    const res = await jikanFetchWithPagination<JikanEpisode[]>(`/anime/${malId}/episodes?page=${page}`);
    if (!res) break;
    allEpisodes.push(...res.data);
    hasMore = res.hasNext;
    page++;
  }

  return allEpisodes;
}

// ─── Character detail (bio) ─────────────────────────────────

export async function getJikanCharacterDetail(malId: number): Promise<{ name: string; about: string | null; image: string | null } | null> {
  const data = await jikanFetch<any>(`/characters/${malId}`);
  if (!data) return null;
  return {
    name: data.name || '',
    about: data.about || null,
    image: data.images?.jpg?.image_url || null,
  };
}

// ─── Person/Staff detail (bio) ──────────────────────────────

export async function getJikanPersonDetail(malId: number): Promise<{ name: string; about: string | null; image: string | null; birthday: string | null; website: string | null } | null> {
  const data = await jikanFetch<any>(`/people/${malId}`);
  if (!data) return null;
  return {
    name: data.name || '',
    about: data.about || null,
    image: data.images?.jpg?.image_url || null,
    birthday: data.birthday || null,
    website: data.website_url || null,
  };
}

// ─── Search anime to get MAL ID ────────────────────────────

export async function searchJikanAnime(query: string): Promise<{ malId: number; title: string; image: string | null } | null> {
  const data = await jikanFetch<any[]>(`/anime?q=${encodeURIComponent(query)}&limit=1`);
  if (!data || data.length === 0) return null;
  return {
    malId: data[0].mal_id,
    title: data[0].title || '',
    image: data[0].images?.jpg?.image_url || null,
  };
}
