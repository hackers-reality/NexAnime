import { getAiringSchedule } from '@/lib/anilist';
import type { AniListAiringSchedule } from '@/types';
import ScheduleClient from '@/components/schedule/ScheduleClient';

export const metadata = {
  title: 'Airing Schedule — NexAnime',
  description: 'See what anime are airing this week with episode counts and air times.',
};

export default async function SchedulePage() {
  // Fetch this week's schedule (Mon-Sun)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const startTimestamp = Math.floor(monday.getTime() / 1000);
  const endTimestamp = Math.floor(sunday.getTime() / 1000);

  let schedule: AniListAiringSchedule[] = [];
  try {
    schedule = await getAiringSchedule(startTimestamp, endTimestamp, 1, 50);
  } catch {
    // Silently fail on SSR
  }

  return <ScheduleClient initialSchedule={schedule} />;
}
