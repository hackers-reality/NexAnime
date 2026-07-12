// NexAnime — Standalone Scraper Daemon
// Runs cron tasks for background operations (e.g. notifications check)

import cron from 'node-cron';
import { checkAiringSchedule } from './schedule-check';

console.log('==================================================');
console.log('    NexAnime Standalone Scraper Daemon Started    ');
console.log('==================================================');

// Run immediately on startup
checkAiringSchedule().then(() => {
  console.log('[Daemon] Initial airing schedule check complete.');
});

// Run every hour: "0 * * * *"
// For testing/development, every 10 minutes: "*/10 * * * *"
const scheduleInterval = '0 * * * *';

console.log(`[Daemon] Scheduling schedule-check cron job with interval: "${scheduleInterval}"`);
cron.schedule(scheduleInterval, async () => {
  console.log('[Daemon] Running scheduled check...');
  await checkAiringSchedule();
});
