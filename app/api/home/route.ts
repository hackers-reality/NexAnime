import { NextResponse } from 'next/server';
import type { AniListMedia, AniListAiringSchedule } from '@/types';
import {
  animetsuTrending,
  animetsuSeason,
  animetsuUpcoming,
} from '@/lib/animetsu';
import {
  getRecentlyUpdated,
  getAiringSchedule,
} from '@/lib/anilist';

export const dynamic = 'force-dynamic';

interface HomePayload {
  trending: HomeMediaItem[];
  thisSeason: HomeMediaItem[];
  upcoming: HomeMediaItem[];
  recentlyUpdated: AniListAiringSchedule[];
  schedule: HomeScheduleItem[];
}

interface HomeMediaItem {
  anilistId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImage: string | null;
  format: string;
  seasonYear: number | null;
  status: string;
  averageScore: number | null;
  synopsis: string;
  genres: string[];
}

interface HomeScheduleItem {
  id: number;
  airingAt: number;
  episode: number;
  mediaId: number;
  title: string;
  coverImage: string | null;
}

let homeCache: { data: HomePayload; expiry: number } | null = null;
const HOME_CACHE_TTL = 120_000;

function mapMedia(m: AniListMedia): HomeMediaItem {
  return {
    anilistId: m.id,
    titleRomaji: m.title?.romaji || m.title?.english || 'Unknown',
    titleEnglish: m.title?.english ?? null,
    coverImage: m.coverImage?.extraLarge || m.coverImage?.large || null,
    format: m.format ?? '',
    seasonYear: m.seasonYear ?? null,
    status: m.status ?? '',
    averageScore: m.averageScore ?? null,
    synopsis: m.description ?? '',
    genres: m.genres ?? [],
  };
}

function mapSchedule(s: AniListAiringSchedule): HomeScheduleItem {
  return {
    id: s.id,
    airingAt: s.airingAt,
    episode: s.episode,
    mediaId: s.mediaId,
    title: s.media?.title?.english || s.media?.title?.romaji || 'Unknown',
    coverImage: s.media?.coverImage?.large || null,
  };
}

export async function GET() {
  try {
    if (homeCache && Date.now() < homeCache.expiry) {
      return NextResponse.json(homeCache.data);
    }

    const now = Math.floor(Date.now() / 1000);
    const sevenDaysSec = 7 * 24 * 60 * 60;

    const currentSeason = (() => {
      const m = new Date().getMonth();
      return ['WINTER','WINTER','SPRING','SPRING','SPRING','SUMMER','SUMMER','SUMMER','FALL','FALL','FALL','WINTER'][m];
    })();
    const currentYear = new Date().getFullYear();

    const [trendingRes, thisSeasonRes, upcomingRes, recentlyUpdatedRes, scheduleRes] = await Promise.allSettled([
      animetsuTrending(1, 15),
      animetsuSeason(currentSeason, currentYear, 1, 10),
      animetsuUpcoming(1, 10),
      getRecentlyUpdated(1, 10),
      getAiringSchedule(now - 12 * 3600, now + sevenDaysSec, 1, 100),
    ]);

    const payload: HomePayload = {
      trending: trendingRes.status === 'fulfilled' ? trendingRes.value.media.map(mapMedia) : [],
      thisSeason: thisSeasonRes.status === 'fulfilled' ? thisSeasonRes.value.media.map(mapMedia) : [],
      upcoming: upcomingRes.status === 'fulfilled' ? upcomingRes.value.media.map(mapMedia) : [],
      recentlyUpdated: recentlyUpdatedRes.status === 'fulfilled' ? recentlyUpdatedRes.value : [],
      schedule: scheduleRes.status === 'fulfilled' ? scheduleRes.value.map(mapSchedule) : [],
    };

    homeCache = { data: payload, expiry: Date.now() + HOME_CACHE_TTL };
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[Home] Batch load error:', err);
    if (homeCache) return NextResponse.json(homeCache.data);
    return NextResponse.json(
      { error: 'Failed to load home data' },
      { status: 500 }
    );
  }
}
