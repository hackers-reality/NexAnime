const { createClient } = require('@libsql/client');
const path = require('path');

async function runNotificationsTest() {
  console.log('--- STARTING NOTIFICATIONS TEST ---');

  // Set up database client directly
  const dbPath = path.join(__dirname, 'nexanime.db');
  const db = createClient({
    url: `file:${dbPath}`,
  });

  try {
    // 1. Wipe subscriptions and notifications first
    await db.execute('DELETE FROM subscriptions');
    await db.execute('DELETE FROM notifications');
    console.log('Cleaned subscriptions and notifications tables.');

    // 2. Query AniList for the next airing show
    const now = Math.floor(Date.now() / 1000);
    const query = `
      query ($now: Int) {
        Page(page: 1, perPage: 1) {
          airingSchedules(airingAt_greater: $now, sort: [TIME]) {
            mediaId
            episode
            airingAt
            media {
              title {
                romaji
                english
              }
            }
          }
        }
      }
    `;

    console.log('Querying AniList for next airing show...');
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { now } })
    });
    
    const data = await res.json();
    const schedule = data?.data?.Page?.airingSchedules?.[0];
    if (!schedule) {
      throw new Error('Failed to fetch airing schedules from AniList');
    }

    const { mediaId, episode, media } = schedule;
    const title = media.title.english || media.title.romaji;
    console.log(`Found next airing show: "${title}" (ID: ${mediaId}), Episode: ${episode}, Airs at: ${new Date(schedule.airingAt * 1000).toLocaleString()}`);

    // 3. Subscribe to this anime in the SQLite DB
    await db.execute({
      sql: 'INSERT INTO subscriptions (anilist_id, subscribed_at) VALUES (?, datetime(\'now\'))',
      args: [mediaId]
    });
    console.log(`Subscribed to anime ID ${mediaId} in local database.`);

    // 4. Run the scraper schedule-check process using npx tsx
    console.log('Running scraper schedule check script...');
    const { execSync } = require('child_process');
    
    // Run the tsx command to execute checkAiringSchedule
    execSync('npx tsx -e "import { checkAiringSchedule } from \'./scraper/schedule-check\'; checkAiringSchedule()"', {
      cwd: __dirname,
      stdio: 'inherit'
    });

    // 5. Query the notifications table to see the row it produced
    console.log('\nQuerying notifications table directly...');
    const notifs = await db.execute('SELECT * FROM notifications');
    console.log('Notifications Row Output in SQLite:');
    console.log(notifs.rows);

    if (notifs.rows.length > 0) {
      console.log('\n✅ NOTIFICATIONS PERSISTENCE TEST PASSED SUCCESSFULLY!');
      console.log('Created Notification:', notifs.rows[0].message);
    } else {
      throw new Error('No notifications were created in the database.');
    }

    // 6. Test the Next.js API endpoint returns it
    console.log('\nQuerying Next.js API /api/notifications...');
    const PORT = 3005;
    const apiRes = await fetch(`http://127.0.0.1:${PORT}/api/notifications`);
    const apiData = await apiRes.json();
    console.log('API Response notifications:', apiData.notifications);
    if (apiData.notifications && apiData.notifications.length > 0) {
      console.log('✅ API Route correctly served the notification.');
    } else {
      throw new Error('API Route returned no notifications.');
    }

  } catch (err) {
    console.error('❌ NOTIFICATIONS TEST FAILED:', err);
  } finally {
    db.close();
  }
}

runNotificationsTest();
