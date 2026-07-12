const fs = require('fs');

async function testWatchlist() {
  try {
    console.log('Sending POST to /api/watchlist...');
    const postRes = await fetch('http://localhost:3000/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId: 1, status: 'watching' })
    });
    
    console.log('POST Response status:', postRes.status);
    const postData = await postRes.json();
    console.log('POST Response body:', postData);

    console.log('Fetching GET to /api/watchlist?anilistId=1...');
    const getRes = await fetch('http://localhost:3000/api/watchlist?anilistId=1');
    const getData = await getRes.json();
    console.log('GET Response body:', getData);

    if (getData.status === 'watching') {
      console.log('✅ TEST PASSED: Watchlist status persisted successfully.');
    } else {
      console.log('❌ TEST FAILED: Watchlist status did not persist.');
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}

setTimeout(testWatchlist, 1000);
