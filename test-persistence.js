const { createClient } = require('@libsql/client');
const path = require('path');

async function testPersistenceAndCleanup() {
  const PORT = 3005;
  const baseUrl = `http://127.0.0.1:${PORT}`;
  
  // Set up database client directly
  const dbPath = path.join(__dirname, 'nexanime.db');
  const db = createClient({
    url: `file:${dbPath}`,
  });

  try {
    console.log('--- DB CLEANUP ---');
    
    // Delete dummy test rows from sqlite
    const del1 = await db.execute({
      sql: 'DELETE FROM watchlist WHERE anilist_id IN (?, ?)',
      args: [54, 99]
    });
    const del2 = await db.execute({
      sql: 'DELETE FROM watch_progress WHERE anilist_id IN (?, ?)',
      args: [54, 99]
    });
    const del3 = await db.execute({
      sql: 'DELETE FROM anime_cache WHERE anilist_id IN (?, ?)',
      args: [54, 99]
    });
    const del4 = await db.execute({
      sql: 'DELETE FROM activity_log WHERE anilist_id IN (?, ?)',
      args: [54, 99]
    });

    console.log(`Deleted test rows: Watchlist (${del1.rowsAffected}), Progress (${del2.rowsAffected}), Cache (${del3.rowsAffected}), Logs (${del4.rowsAffected})`);

    // Verify cleanup
    const checkWL = await db.execute('SELECT COUNT(*) as count FROM watchlist WHERE anilist_id IN (54, 99)');
    console.log(`Remaining test rows in watchlist: ${checkWL.rows[0].count}`);

    console.log('\n--- PERSISTENCE AFTER RESTART CHECK ---');
    console.log('Requesting settings from restarted server (No POST updates)...');
    
    const getSettingsRes = await fetch(`${baseUrl}/api/settings`);
    const settingsData = await getSettingsRes.json();
    console.log('Settings retrieved:', settingsData.settings);

    if (settingsData.settings.title_language === 'english' && settingsData.settings.auto_play === 0) {
      console.log('✅ PERSISTENCE VERIFICATION PASSED: Settings successfully survived server restart!');
    } else {
      console.log('❌ PERSISTENCE VERIFICATION FAILED: Settings returned to default or lost.');
    }
  } catch (err) {
    console.error('Error during persistence test:', err);
  } finally {
    db.close();
  }
}

testPersistenceAndCleanup();
