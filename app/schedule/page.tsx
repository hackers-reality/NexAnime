import { getAiringSchedule } from '@/lib/data-api';
import type { AniListAiringSchedule } from '@/types';
import ScheduleClient from '@/components/schedule/ScheduleClient';

export const metadata = {
  title: 'Airing Schedule — NexAnime',
  description: 'See what anime are airing this week with episode counts and air times.',
};

export default async function SchedulePage() {
  let schedule: AniListAiringSchedule[] = [];
  try {
    schedule = await getAiringSchedule();
  } catch {
    // Silently fail on SSR
  }

  return <ScheduleClient initialSchedule={schedule} />;
}
