// NexAnime — AniList API proxy route
// Server-side proxy for AniList GraphQL queries
// Caches results to anime_cache table

import { NextRequest, NextResponse } from 'next/server';
import {
  searchAnime,
  getAnimeDetail,
  getTrending,
  getPopular,
  getTopRated,
  getThisSeason,
  getUpcoming,
  getRecentlyUpdated,
  getAiringSchedule,
  quickSearch,
  searchCharacters,
  fetchUserList,
  anilistMediaToAnime,
} from '@/lib/anilist';
import { execute } from '@/lib/db';
import type { AniListMedia, BrowseFilters } from '@/types';

// Cache an AniList media item to the local database
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
      anime.anilistId,
      anime.titleRomaji,
      anime.titleEnglish,
      anime.titleNative,
      JSON.stringify(anime.synonyms),
      anime.synopsis,
      anime.format,
      anime.status,
      anime.season,
      anime.seasonYear,
      anime.averageScore,
      anime.meanScore,
      anime.source,
      JSON.stringify(anime.studios),
      JSON.stringify(anime.genres),
      JSON.stringify(anime.tags),
      anime.coverImage,
      anime.bannerImage,
      anime.episodeCount,
      anime.nextAiringAt,
    ]
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'search': {
        const filters: BrowseFilters = params;
        const result = await searchAnime(filters);
        // Cache results in background
        Promise.allSettled(result.media.map(cacheMedia));
        return NextResponse.json(result);
      }

      case 'detail': {
        const media = await getAnimeDetail(params.id);
        if (media) {
          await cacheMedia(media);
        }
        return NextResponse.json({ media });
      }

      case 'trending': {
        const result = await getTrending(params.page, params.perPage);
        Promise.allSettled(result.media.map(cacheMedia));
        return NextResponse.json(result);
      }

      case 'popular': {
        const result = await getPopular(params.page, params.perPage);
        Promise.allSettled(result.media.map(cacheMedia));
        return NextResponse.json(result);
      }

      case 'topRated': {
        const result = await getTopRated(params.page, params.perPage);
        Promise.allSettled(result.media.map(cacheMedia));
        return NextResponse.json(result);
      }

      case 'thisSeason': {
        const result = await getThisSeason(params.page, params.perPage);
        Promise.allSettled(result.media.map(cacheMedia));
        return NextResponse.json(result);
      }

      case 'upcoming': {
        const result = await getUpcoming(params.page, params.perPage);
        Promise.allSettled(result.media.map(cacheMedia));
        return NextResponse.json(result);
      }

      case 'recentlyUpdated': {
        const schedules = await getRecentlyUpdated(params.page, params.perPage);
        Promise.allSettled(schedules.map((s) => cacheMedia(s.media)));
        return NextResponse.json({ schedules });
      }

      case 'airingSchedule': {
        const schedules = await getAiringSchedule(
          params.startTime,
          params.endTime,
          params.page,
          params.perPage
        );
        return NextResponse.json({ schedules });
      }

      case 'quickSearch': {
        const media = await quickSearch(params.term, params.perPage);
        return NextResponse.json({ media });
      }

      case 'searchCharacters': {
        const result = await searchCharacters(
          params.search,
          params.page,
          params.perPage
        );
        return NextResponse.json(result);
      }

      case 'importUserList': {
        const entries = await fetchUserList(params.username);
        Promise.allSettled(entries.map((e) => cacheMedia(e.media)));

        // Persist imported entries into SQLite watchlist table
        for (const entry of entries) {
          let status = 'planning';
          const alStatus = entry.status.toUpperCase();
          if (alStatus === 'CURRENT') status = 'watching';
          else if (alStatus === 'PAUSED') status = 'on_hold';
          else if (alStatus === 'DROPPED') status = 'dropped';
          else if (alStatus === 'COMPLETED') status = 'finished';
          else if (alStatus === 'REPEATING') status = 'rewatching';

          await execute(
            `INSERT OR REPLACE INTO watchlist (
              anilist_id, list_status, score, episode_watched, total_rewatches, notes, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              entry.mediaId,
              status,
              entry.score ? Math.floor(entry.score * 10) : null,
              entry.progress || 0,
              entry.repeat || 0,
              entry.notes || null,
            ]
          );
        }
        return NextResponse.json({ entries });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AniList API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
