import { NextResponse } from 'next/server';
import type { AniListMedia, AniListAiringSchedule } from '@/types';
import { getHomeData } from '@/lib/data-api';

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
  bannerImage: string | null;
  format: string;
  seasonYear: number | null;
  status: string;
  averageScore: number | null;
  synopsis: string;
  genres: string[];
  trailer: string | null;
  rating: string | null;
  subbed: number | null;
  dubbed: number | null;
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
const HOME_CACHE_TTL = 600_000;

function mapMedia(m: AniListMedia): HomeMediaItem {
  return {
    anilistId: m.id,
    titleRomaji: m.title?.romaji || m.title?.english || 'Unknown',
    titleEnglish: m.title?.english ?? null,
    coverImage: m.coverImage?.extraLarge || m.coverImage?.large || null,
    bannerImage: m.bannerImage ?? null,
    trailer: m.trailer?.id || null,
    format: m.format ?? '',
    seasonYear: m.seasonYear ?? null,
    status: m.status ?? '',
    averageScore: m.averageScore ?? null,
    synopsis: m.description ?? '',
    genres: m.genres ?? [],
    rating: m.rating ?? null,
    subbed: m.subbed ?? null,
    dubbed: m.dubbed ?? null,
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

    const data = await getHomeData();

    const payload: HomePayload = {
      trending: data.trending.map(mapMedia),
      thisSeason: data.thisSeason.map(mapMedia),
      upcoming: data.upcoming.map(mapMedia),
      recentlyUpdated: data.recentlyUpdated,
      schedule: data.schedule.reduce((acc: HomeScheduleItem[], s) => {
        const dupKey = `${s.mediaId}-${s.episode}`;
        if (!acc.some((existing) => `${existing.mediaId}-${existing.episode}` === dupKey)) {
          acc.push(mapSchedule(s));
        }
        return acc;
      }, []),
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
