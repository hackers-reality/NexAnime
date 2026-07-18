import { NextResponse } from 'next/server';
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

// In-memory cache for home data (2 min TTL)
let homeCache: { data: unknown; expiry: number } | null = null;
const HOME_CACHE_TTL = 120_000;

export async function GET() {
  try {
    // Return cached response if fresh
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

    const [trendingRes, thisSeasonRes, upcomingRes, recentlyUpdated, schedule] = await Promise.allSettled([
      animetsuTrending(1, 15),
      animetsuSeason(currentSeason, currentYear, 1, 10),
      animetsuUpcoming(1, 10),
      getRecentlyUpdated(1, 10),
      getAiringSchedule(now - 12 * 3600, now + sevenDaysSec, 1, 100),
    ]);

    const mapMedia = (m: any) => ({
      anilistId: m.id,
      titleRomaji: m.title?.romaji || m.title?.english || 'Unknown',
      titleEnglish: m.title?.english,
      coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
      format: m.format,
      seasonYear: m.seasonYear,
      status: m.status,
      averageScore: m.averageScore,
      synopsis: m.description,
      genres: m.genres || [],
    });

    const payload = {
      trending: trendingRes.status === 'fulfilled' ? trendingRes.value.media.map(mapMedia) : [],
      thisSeason: thisSeasonRes.status === 'fulfilled' ? thisSeasonRes.value.media.map(mapMedia) : [],
      upcoming: upcomingRes.status === 'fulfilled' ? upcomingRes.value.media.map(mapMedia) : [],
      recentlyUpdated: recentlyUpdated.status === 'fulfilled'
        ? (recentlyUpdated.value || []).map((s: any) => s)
        : [],
      schedule: schedule.status === 'fulfilled'
        ? (schedule.value || []).map((s: any) => ({
            id: s.id,
            airingAt: s.airingAt,
            episode: s.episode,
            mediaId: s.mediaId,
            title: s.media?.title?.english || s.media?.title?.romaji || 'Unknown',
            coverImage: s.media?.coverImage?.large || null,
          }))
        : [],
    };

    homeCache = { data: payload, expiry: Date.now() + HOME_CACHE_TTL };
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[Home] Batch load error:', err);
    // Return stale cache if available
    if (homeCache) return NextResponse.json(homeCache.data);
    return NextResponse.json(
      { error: 'Failed to load home data' },
      { status: 500 }
    );
  }
}
