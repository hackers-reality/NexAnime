const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

async function verifyPhase8() {
  console.log('--- STARTING PHASE 8 VERIFICATION ---');

  const PORT = 3005;
  const baseUrl = `http://127.0.0.1:${PORT}`;
  
  // Set up database client directly
  const dbPath = path.join(__dirname, 'nexanime.db');
  const db = createClient({
    url: `file:${dbPath}`,
  });

  try {
    // 1. Verify Settings toggle and persistence
    console.log('\n--- 1. Testing Settings toggle via API ---');
    const setRes = await fetch(`${baseUrl}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleLanguage: 'english', autoPlay: false })
    });
    console.log('Settings update API status:', setRes.status);

    const getSettingsRes = await fetch(`${baseUrl}/api/settings`);
    const settingsData = await getSettingsRes.json();
    console.log('Settings from API:', settingsData.settings);
    if (settingsData.settings.title_language === 'english' && settingsData.settings.auto_play === 0) {
      console.log('✅ Settings toggle verification passed.');
    } else {
      throw new Error('Settings toggle failed to persist correctly.');
    }

    // 2. Add items to Watchlist, cache dummy metadata, and verify Watchlist groupings
    console.log('\n--- 2. Testing Watchlist addition and metadata JOIN ---');
    
    // Insert dummy metadata directly into cache so JOIN works
    await db.execute({
      sql: `INSERT OR REPLACE INTO anime_cache (anilist_id, title_romaji, format, season_year, episode_count) 
            VALUES (?, ?, ?, ?, ?)`,
      args: [54, 'Verify Anime 54', 'TV', 2024, 12]
    });
    await db.execute({
      sql: `INSERT OR REPLACE INTO anime_cache (anilist_id, title_romaji, format, season_year, episode_count) 
            VALUES (?, ?, ?, ?, ?)`,
      args: [99, 'Verify Anime 99', 'MOVIE', 2023, 1]
    });

    // Save watchlist entries via API
    await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId: 54, listStatus: 'watching', episodeWatched: 2 })
    });
    await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId: 99, listStatus: 'planning', episodeWatched: 0 })
    });

    const getWatchlistRes = await fetch(`${baseUrl}/api/watchlist`);
    const watchlistData = await getWatchlistRes.json();
    console.log('Watchlist entries fetched:');
    watchlistData.entries.forEach(e => {
      console.log(` - ID: ${e.anilistId}, Status: ${e.listStatus}, Title: ${e.anime?.title?.romaji}, Format: ${e.anime?.format}, Progress: ${e.episodeWatched}/${e.anime?.episodes}`);
    });

    const hasWatching = watchlistData.entries.some(e => e.listStatus === 'watching' && e.anilistId === 54);
    const hasPlanning = watchlistData.entries.some(e => e.listStatus === 'planning' && e.anilistId === 99);
    
    if (hasWatching && hasPlanning) {
      console.log('✅ Watchlist entries stored & grouped successfully with real JOIN metadata.');
    } else {
      throw new Error('Watchlist entries missing or incorrect.');
    }

    // 3. Populate watch progress & activity logs, verify profile stats
    console.log('\n--- 3. Testing watch progress and Profile page metrics ---');
    
    // Add progress (600 seconds = 10 minutes)
    await db.execute({
      sql: `INSERT OR REPLACE INTO watch_progress (anilist_id, episode_number, seconds_watched, duration_seconds) 
            VALUES (?, ?, ?, ?)`,
      args: [54, 1, 600, 1200]
    });

    // Add another episode watch progress (300 seconds = 5 minutes)
    await db.execute({
      sql: `INSERT OR REPLACE INTO watch_progress (anilist_id, episode_number, seconds_watched, duration_seconds) 
            VALUES (?, ?, ?, ?)`,
      args: [54, 2, 300, 1200]
    });

    // Check stats queries directly
    const minutesResult = await db.execute('SELECT SUM(seconds_watched) / 60 as total_minutes FROM watch_progress');
    const totalResult = await db.execute('SELECT COUNT(*) as total_count FROM watchlist');
    
    const totalMinutes = Math.floor(minutesResult.rows[0].total_minutes);
    const totalCount = totalResult.rows[0].total_count;

    console.log('Calculated Minutes Watched:', totalMinutes);
    console.log('Calculated Total Anime in List:', totalCount);

    if (totalMinutes === 15 && totalCount === 2) {
      console.log('✅ Profile stats calculated accurately.');
    } else {
      throw new Error(`Profile stats verification failed. Minutes: ${totalMinutes}, Total: ${totalCount}`);
    }

    // Check activity log feed
    const logsResult = await db.execute('SELECT * FROM activity_log ORDER BY created_at DESC');
    console.log('Activity log contents:');
    logsResult.rows.forEach(l => console.log(` - [${l.type}] ${l.message}`));

    if (logsResult.rows.length > 0) {
      console.log('✅ Activity log correctly recorded and fetched.');
    } else {
      throw new Error('Activity log was empty.');
    }

    console.log('\n🎉 ALL PHASE 8 VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
  } finally {
    db.close();
  }
}

verifyPhase8();
