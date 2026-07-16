const fs = require('fs');
const path = require('path');
const { HianimeAdapter } = require('./scraper/adapters/hianime');
const { GogoanimeAdapter } = require('./scraper/adapters/gogoanime');
const { AnimepaheAdapter } = require('./scraper/adapters/animepahe');

// AniList GraphQL call to get One Piece details
async function fetchOnePieceMeta() {
  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        title {
          romaji
          english
        }
        episodes
        nextAiringEpisode {
          episode
        }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: 21 } })
    });
    const json = await res.json();
    const media = json.data?.Media;
    const title = media?.title?.english || media?.title?.romaji || 'One Piece';
    const latestEpisode = media?.nextAiringEpisode 
      ? media.nextAiringEpisode.episode - 1 
      : media?.episodes || 1100;
    return { title, latestEpisode };
  } catch (err) {
    console.error('Failed to fetch AniList metadata:', err.message);
    return { title: 'One Piece', latestEpisode: 1100 };
  }
}

async function main() {
  console.log('Fetching One Piece metadata from AniList...');
  const { title, latestEpisode } = await fetchOnePieceMeta();
  console.log(`Title: ${title}`);
  console.log(`Latest Episode: ${latestEpisode}`);

  const hianime = new HianimeAdapter();
  const gogo = new GogoanimeAdapter();
  const pahe = new AnimepaheAdapter();

  const results = {
    hianimeEp1: null,
    hianimeEpLast: null,
    gogoEp1: null,
    gogoEpLast: null,
    paheEp1: null,
    paheEpLast: null
  };

  // Resolve Episode 1
  console.log('\n--- Resolving Episode 1 ---');
  try {
    console.log('[HiAnime] Resolving Episode 1...');
    results.hianimeEp1 = await hianime.resolveEpisodeSource(21, 1);
  } catch (e) {
    console.error('HiAnime Ep 1 resolution failed:', e.message);
  }
  try {
    console.log('[Gogoanime] Resolving Episode 1...');
    results.gogoEp1 = await gogo.resolveEpisodeSource(21, 1);
  } catch (e) {
    console.error('Gogoanime Ep 1 resolution failed:', e.message);
  }
  try {
    console.log('[Animepahe] Resolving Episode 1...');
    results.paheEp1 = await pahe.resolveEpisodeSource(21, 1);
  } catch (e) {
    console.error('Animepahe Ep 1 resolution failed:', e.message);
  }

  // Resolve Latest Episode
  console.log(`\n--- Resolving Latest Episode (${latestEpisode}) ---`);
  try {
    console.log(`[HiAnime] Resolving Episode ${latestEpisode}...`);
    results.hianimeEpLast = await hianime.resolveEpisodeSource(21, latestEpisode);
  } catch (e) {
    console.error(`HiAnime Ep ${latestEpisode} resolution failed:`, e.message);
  }
  try {
    console.log(`[Gogoanime] Resolving Episode ${latestEpisode}...`);
    results.gogoEpLast = await gogo.resolveEpisodeSource(21, latestEpisode);
  } catch (e) {
    console.error(`Gogoanime Ep ${latestEpisode} resolution failed:`, e.message);
  }
  try {
    console.log(`[Animepahe] Resolving Episode ${latestEpisode}...`);
    results.paheEpLast = await pahe.resolveEpisodeSource(21, latestEpisode);
  } catch (e) {
    console.error(`Animepahe Ep ${latestEpisode} resolution failed:`, e.message);
  }

  // Create verify-onepiece.html
  const htmlPath = path.join(__dirname, 'verify-onepiece.html');
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>One Piece Stream Verification</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    :root {
      --bg-dark: #0b0f19;
      --bg-surface: #151d30;
      --border: #233554;
      --primary: #3b82f6;
      --text: #f8fafc;
      --text-secondary: #94a3b8;
      --success: #22c55e;
      --warning: #eab308;
    }
    body {
      background-color: var(--bg-dark);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      font-size: 32px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .subtitle {
      color: var(--text-secondary);
      margin-bottom: 32px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-bottom: 32px;
    }
    @media (max-width: 992px) {
      .grid {
        grid-template-columns: 1fr 1fr;
      }
    }
    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .card-title {
      font-size: 18px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status-badge {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge.real {
      background: rgba(34, 197, 94, 0.15);
      color: var(--success);
    }
    .status-badge.fallback {
      background: rgba(234, 179, 8, 0.15);
      color: var(--warning);
    }
    .url-box {
      background: #0f172a;
      border: 1px solid var(--border);
      padding: 10px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      margin-bottom: 16px;
      color: var(--text-secondary);
      height: 48px;
      overflow-y: auto;
    }
    video {
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: 8px;
      background: #000;
      margin-bottom: 16px;
    }
    .btn-group {
      display: flex;
      gap: 8px;
    }
    .btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      transition: opacity 0.2s;
      font-size: 13px;
      flex: 1;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .btn-secondary {
      background: #334155;
    }
    .help-section {
      background: rgba(59, 130, 246, 0.05);
      border: 1px dashed var(--primary);
      padding: 20px;
      border-radius: 12px;
      margin-top: 32px;
    }
    .help-section h3 {
      margin-top: 0;
      color: var(--primary);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>One Piece Stream Verification</h1>
    <p class="subtitle">Verifying stream resolution for Episode 1 and Episode ${latestEpisode} of One Piece</p>

    <h2>Episode 1</h2>
    <div class="grid">
      <!-- HiAnime Ep 1 -->
      <div class="card">
        <div class="card-title">
          HiAnime
          <span class="status-badge ${results.hianimeEp1 ? 'real' : 'fallback'}">
            ${results.hianimeEp1 ? 'Real Stream' : 'Failed'}
          </span>
        </div>
        <div class="url-box">
          ${results.hianimeEp1?.streamUrl || 'Failed to resolve stream URL'}
        </div>
        <video id="hianime1" controls></video>
        <div class="btn-group">
          <button class="btn" onclick="playVideo('hianime1', '${results.hianimeEp1?.streamUrl}')">Play Stream</button>
          <a href="https://hianimes.se/watch/one-piece-episode-1-1m0d92-733" target="_blank" class="btn btn-secondary">Open HiAnime</a>
        </div>
      </div>

      <!-- Gogoanime Ep 1 -->
      <div class="card">
        <div class="card-title">
          Gogoanime
          <span class="status-badge ${results.gogoEp1?.streamUrl?.includes('test-streams') || !results.gogoEp1 ? 'fallback' : 'real'}">
            ${results.gogoEp1?.streamUrl?.includes('test-streams') || !results.gogoEp1 ? 'Fallback Stream' : 'Real Stream'}
          </span>
        </div>
        <div class="url-box">
          ${results.gogoEp1?.streamUrl || 'Failed to resolve stream URL'}
        </div>
        <video id="gogo1" controls></video>
        <div class="btn-group">
          <button class="btn" onclick="playVideo('gogo1', '${results.gogoEp1?.streamUrl}')">Play Stream</button>
          <a href="https://anitaku.pe/one-piece-episode-1" target="_blank" class="btn btn-secondary">Open Gogoanime</a>
        </div>
      </div>

      <!-- Animepahe Ep 1 -->
      <div class="card">
        <div class="card-title">
          Animepahe
          <span class="status-badge ${results.paheEp1?.streamUrl?.includes('tears-of-steel') || !results.paheEp1 ? 'fallback' : 'real'}">
            ${results.paheEp1?.streamUrl?.includes('tears-of-steel') || !results.paheEp1 ? 'Fallback Stream' : 'Real Stream'}
          </span>
        </div>
        <div class="url-box">
          ${results.paheEp1?.streamUrl || 'Failed to resolve stream URL'}
        </div>
        <video id="pahe1" controls></video>
        <div class="btn-group">
          <button class="btn" onclick="playVideo('pahe1', '${results.paheEp1?.streamUrl}')">Play Stream</button>
          <a href="https://animepahe.ru/" target="_blank" class="btn btn-secondary">Open Animepahe</a>
        </div>
      </div>
    </div>

    <h2>Latest Episode (Episode ${latestEpisode})</h2>
    <div class="grid">
      <!-- HiAnime Ep Last -->
      <div class="card">
        <div class="card-title">
          HiAnime
          <span class="status-badge ${results.hianimeEpLast ? 'real' : 'fallback'}">
            ${results.hianimeEpLast ? 'Real Stream' : 'Failed'}
          </span>
        </div>
        <div class="url-box">
          ${results.hianimeEpLast?.streamUrl || 'Failed to resolve stream URL'}
        </div>
        <video id="hianimeLast" controls></video>
        <div class="btn-group">
          <button class="btn" onclick="playVideo('hianimeLast', '${results.hianimeEpLast?.streamUrl}')">Play Stream</button>
          <a href="https://hianimes.se/watch/one-piece-episode-${latestEpisode}-1m0d92-733" target="_blank" class="btn btn-secondary">Open HiAnime</a>
        </div>
      </div>

      <!-- Gogoanime Ep Last -->
      <div class="card">
        <div class="card-title">
          Gogoanime
          <span class="status-badge ${results.gogoEpLast?.streamUrl?.includes('test-streams') || !results.gogoEpLast ? 'fallback' : 'real'}">
            ${results.gogoEpLast?.streamUrl?.includes('test-streams') || !results.gogoEpLast ? 'Fallback Stream' : 'Real Stream'}
          </span>
        </div>
        <div class="url-box">
          ${results.gogoEpLast?.streamUrl || 'Failed to resolve stream URL'}
        </div>
        <video id="gogoLast" controls></video>
        <div class="btn-group">
          <button class="btn" onclick="playVideo('gogoLast', '${results.gogoEpLast?.streamUrl}')">Play Stream</button>
          <a href="https://anitaku.pe/one-piece-episode-${latestEpisode}" target="_blank" class="btn btn-secondary">Open Gogoanime</a>
        </div>
      </div>

      <!-- Animepahe Ep Last -->
      <div class="card">
        <div class="card-title">
          Animepahe
          <span class="status-badge ${results.paheEpLast?.streamUrl?.includes('tears-of-steel') || !results.paheEpLast ? 'fallback' : 'real'}">
            ${results.paheEpLast?.streamUrl?.includes('tears-of-steel') || !results.paheEpLast ? 'Fallback Stream' : 'Real Stream'}
          </span>
        </div>
        <div class="url-box">
          ${results.paheEpLast?.streamUrl || 'Failed to resolve stream URL'}
        </div>
        <video id="paheLast" controls></video>
        <div class="btn-group">
          <button class="btn" onclick="playVideo('paheLast', '${results.paheEpLast?.streamUrl}')">Play Stream</button>
          <a href="https://animepahe.ru/" target="_blank" class="btn btn-secondary">Open Animepahe</a>
        </div>
      </div>
    </div>
  </div>

  <script>
    function playVideo(videoId, streamUrl) {
      if (!streamUrl || streamUrl === 'null' || streamUrl === 'undefined') {
        alert('No stream URL available to play!');
        return;
      }
      const video = document.getElementById(videoId);
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          video.play().catch(e => console.log('Autoplay blocked:', e.message));
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play().catch(e => console.log('Autoplay blocked:', e.message));
      } else {
        alert('HLS streaming is not supported in this browser.');
      }
    }
  </script>
</body>
</html>
  `;

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log(`\n==================================================`);
  console.log(`✅ Success! Created stream verification file:`);
  console.log(`file:///${htmlPath.replace(/\\/g, '/')}`);
  console.log(`==================================================\n`);
}

main();
