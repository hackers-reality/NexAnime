// NexAnime — Standalone Scraper Schedule Check Job
// Fetches AniList airing schedule for subscribed anime and creates notifications

import { getScraperDb } from './db';

const ANILIST_API = 'https://graphql.anilist.co';

interface AiringScheduleResponse {
  data: {
    Page: {
      airingSchedules: Array<{
        id: number;
        airingAt: number;
        episode: number;
        media: {
          id: number;
          title: {
            romaji: string | null;
            english: string | null;
          };
        };
      }>;
    };
  };
}

async function fetchFromAniList(query: string, variables: Record<string, any>) {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`AniList API error: ${response.statusText}`);
  }
  return response.json();
}

export async function checkAiringSchedule(): Promise<void> {
  const db = getScraperDb();
  console.log('[Schedule Check] Running check...');

  try {
    // 1. Get subscribed anime IDs from the local DB
    const subsResult = await db.execute('SELECT anilist_id FROM subscriptions');
    const subscribedIds = subsResult.rows.map((row: any) => Number(row.anilist_id));

    if (subscribedIds.length === 0) {
      console.log('[Schedule Check] No active subscriptions found.');
      return;
    }

    // 2. Query AniList for airing schedules from the past 24 hours to the next 24 hours
    const now = Math.floor(Date.now() / 1000);
    const dayInSeconds = 24 * 60 * 60;
    const startTime = now - dayInSeconds;
    const endTime = now + dayInSeconds;

    const query = `
      query ($mediaIds: [Int], $airingAtGreater: Int, $airingAtLesser: Int) {
        Page(page: 1, perPage: 50) {
          airingSchedules(
            mediaId_in: $mediaIds,
            airingAt_greater: $airingAtGreater,
            airingAt_lesser: $airingAtLesser
          ) {
            id
            airingAt
            episode
            media {
              id
              title {
                romaji
                english
              }
            }
          }
        }
      }
    `;

    const variables = {
      mediaIds: subscribedIds,
      airingAtGreater: startTime,
      airingAtLesser: endTime,
    };

    const res = (await fetchFromAniList(query, variables)) as AiringScheduleResponse;
    const schedules = res?.data?.Page?.airingSchedules ?? [];

    console.log(`[Schedule Check] Found ${schedules.length} airing schedule entries.`);

    for (const schedule of schedules) {
      const anilistId = schedule.media.id;
      const episodeNum = schedule.episode;
      const title = schedule.media.title.english || schedule.media.title.romaji || 'Unknown Anime';
      const isAired = schedule.airingAt <= now;

      const type = isAired ? 'new_episode' : 'airing_soon';
      const uniqueMsgKey = `[${type}]-${anilistId}-${episodeNum}`;

      // Check if this notification already exists
      const existingNotif = await db.execute({
        sql: 'SELECT id FROM notifications WHERE anilist_id = ? AND message LIKE ?',
        args: [anilistId, `%Ep ${episodeNum}%`],
      });

      if (existingNotif.rows.length === 0) {
        let message = '';
        if (isAired) {
          message = `Episode ${episodeNum} of "${title}" is now available!`;
        } else {
          const hoursLeft = Math.ceil((schedule.airingAt - now) / 3600);
          message = `Episode ${episodeNum} of "${title}" airs in ${hoursLeft} hours!`;
        }

        // Insert notification
        await db.execute({
          sql: 'INSERT INTO notifications (anilist_id, type, message, read, created_at) VALUES (?, ?, ?, 0, datetime(\'now\'))',
          args: [anilistId, type, message],
        });

        console.log(`[Schedule Check] Created notification: "${message}"`);
      }
    }
    console.log('[Schedule Check] Check completed successfully.');
  } catch (err) {
    console.error('[Schedule Check] Error checking airing schedule:', err);
  }
}
