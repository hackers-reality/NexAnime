// NexAnime — Batch home page API
// Runs all home page AniList queries in parallel server-side
// Client makes ONE request instead of 6 sequential ones

import { NextResponse } from 'next/server';
import {
  getTrending,
  getThisSeason,
  getUpcoming,
  getRecentlyUpdated,
  getAiringSchedule,
  anilistMediaToAnime,
} from '@/lib/anilist';
import { execute } from '@/lib/db';
import type { AniListMedia } from '@/types';

async function cacheMedia(media: AniListMedia): Promise<void> {
  const anime = anilistMediaToAnime(media);
  await execute(
    `INSERT OR REPLACE INTO anime_cache (
      anilist_id, title_romaji, title_english, title_native,
      synonyms, synopsis, format, status, season, season_year,
      average_score, mean_score, source, studios, genres, tags,
      cover_image, banner_image, episode_count, next_airing_at, cached_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
    )`,
    [
      anime.anilistId, anime.titleRomaji, anime.titleEnglish, anime.titleNative,
      JSON.stringify(anime.synonyms), anime.synopsis, anime.format, anime.status,
      anime.season, anime.seasonYear, anime.averageScore, anime.meanScore,
      anime.source, JSON.stringify(anime.studios), JSON.stringify(anime.genres),
      JSON.stringify(anime.tags), anime.coverImage, anime.bannerImage,
      anime.episodeCount, anime.nextAiringAt,
    ]
  );
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysSec = 7 * 24 * 60 * 60;

    // Run ALL 5 AniList queries in parallel server-side
    const [trending, thisSeason, upcoming, recentlyUpdated, schedule] = await Promise.allSettled([
      getTrending(1, 15),
      getThisSeason(1, 10),
      getUpcoming(1, 10),
      getRecentlyUpdated(1, 10),
      getAiringSchedule(now - 12 * 3600, now + sevenDaysSec, 1, 100),
    ]);

    // Cache trending in background (non-blocking)
    if (trending.status === 'fulfilled') {
      Promise.allSettled(trending.value.media.map(cacheMedia));
    }

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

    return NextResponse.json({
      trending: trending.status === 'fulfilled' ? trending.value.media.map(mapMedia) : [],
      thisSeason: thisSeason.status === 'fulfilled' ? thisSeason.value.media.map(mapMedia) : [],
      upcoming: upcoming.status === 'fulfilled' ? upcoming.value.media.map(mapMedia) : [],
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
    });
  } catch (err) {
    console.error('[Home] Batch load error:', err);
    return NextResponse.json(
      { error: 'Failed to load home data' },
      { status: 500 }
    );
  }
}
