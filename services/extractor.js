const crypto = require("crypto");

// Configuration and static keys for GogoPlay AES decryption (updated for standard Vidstreaming)
const keys = {
  key: Buffer.from("37911490908853213561234567890128", "utf8"),
  iv: Buffer.from("3134003220123456", "utf8"),
  decKey: Buffer.from("54674138327930866480207639501426", "utf8")
};

/**
 * Helper to decrypt GogoPlay ciphertexts
 */
function decryptAES(ciphertext, key, iv) {
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("AES Decryption error:", err.message);
    return null;
  }
}

/**
 * Helper to encrypt params for GogoPlay token requests
 */
function encryptAES(text, key, iv) {
  try {
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  } catch (err) {
    console.error("AES Encryption error:", err.message);
    return null;
  }
}

/**
 * Searches public aggregator indexes for matching anime titles.
 */
async function searchAnime(query) {
  if (!query) return [];
  const normalized = encodeURIComponent(query.trim());
  
  // Try local scraping Gogoanime search first
  try {
    const response = await fetch(`https://gogoanime3.co/filter.html?keyword=${normalized}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" }
    });
    if (response.ok) {
      const html = await response.text();
      const results = [];
      const regex = /<li>\s*<div class="img">\s*<a href="\/category\/([^"]+)" title="([^"]+)">\s*<img src="([^"]+)"/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        results.push({
          id: match[1],
          title: match[2],
          coverImage: match[3],
          url: `https://gogoanime3.co/category/${match[1]}`
        });
      }
      if (results.length > 0) return results;
    }
  } catch (err) {
    console.warn("Local Gogoanime search failed, falling back to public API search:", err.message);
  }

  // Fallback to public anime API search
  try {
    const apiRes = await fetch(`https://api.consumet.org/anime/gogoanime/${normalized}`);
    if (apiRes.ok) {
      const payload = await apiRes.json();
      return (payload.results || []).map(item => ({
        id: item.id,
        title: item.title,
        url: item.url
      }));
    }
  } catch (err) {
    console.error("All search pipelines failed:", err.message);
  }
  return [];
}

/**
 * Fetches the list of episodes for an anime slug.
 */
async function getEpisodes(animeId) {
  try {
    // 1. Get Gogoanime category page to extract movie_id
    const categoryUrl = `https://gogoanime3.co/category/${animeId}`;
    const response = await fetch(categoryUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" }
    });
    if (!response.ok) throw new Error(`Category load failed with status: ${response.status}`);
    
    const html = await response.text();
    const movieMatch = html.match(/<input type="hidden" id="movie_id" value="([^"]+)">/);
    const aliasMatch = html.match(/<input type="hidden" id="alias_anime" value="([^"]+)">/);
    
    if (movieMatch) {
      const movieId = movieMatch[1];
      const alias = aliasMatch ? aliasMatch[1] : animeId;
      
      // 2. Fetch episodes via ajax load list
      const episodesAjaxUrl = `https://ajax.gogo-load.com/ajax/load-list-episode?ep_start=0&ep_end=3000&id=${movieId}&default_ep=0&alias=${alias}`;
      const epRes = await fetch(episodesAjaxUrl);
      if (epRes.ok) {
        const epHtml = await epRes.text();
        const epRegex = /href="\/([^"]+-episode-(\d+))"/g;
        const episodes = [];
        let match;
        while ((match = epRegex.exec(epHtml)) !== null) {
          episodes.push({
            id: match[1],
            episodeNum: Number(match[2])
          });
        }
        // Return sorted ascending
        return episodes.reverse();
      }
    }
  } catch (err) {
    console.warn("Local episode extraction failed, falling back to public API:", err.message);
  }

  // Fallback to public anime API
  try {
    const apiRes = await fetch(`https://api.consumet.org/anime/gogoanime/info/${animeId}`);
    if (apiRes.ok) {
      const payload = await apiRes.json();
      return (payload.episodes || []).map(ep => ({
        id: ep.id,
        episodeNum: ep.number
      }));
    }
  } catch (err) {
    console.error("All episode pipelines failed:", err.message);
  }
  return [];
}

/**
 * Fetches available streaming servers for a given episode ID/Number.
 */
async function getEpisodeServers(animeId, episodeNum) {
  // Construct episode slug (Gogoanime standard: slug-episode-X)
  const episodeSlug = `${animeId}-episode-${episodeNum}`;
  const servers = [];

  try {
    const response = await fetch(`https://gogoanime3.co/${episodeSlug}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" }
    });
    if (response.ok) {
      const html = await response.text();
      // Scrape iframe player URLs
      // E.g., <li class="vidstreaming"><a href="#" data-video="https://emhls.com/streaming.php?id=...">
      const regex = /<li class="([^"]+)"><a href="#" data-video="([^"]+)"/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        let embedUrl = match[2];
        if (embedUrl.startsWith("//")) embedUrl = "https:" + embedUrl;
        servers.push({
          server_name: match[1].charAt(0).toUpperCase() + match[1].slice(1),
          embed_url: embedUrl
        });
      }
      if (servers.length > 0) return servers;
    }
  } catch (err) {
    console.warn("Local server scraping failed, falling back to public API:", err.message);
  }

  // Fallback to public anime API servers endpoint
  try {
    const apiRes = await fetch(`https://api.consumet.org/anime/gogoanime/servers/${episodeSlug}`);
    if (apiRes.ok) {
      const payload = await apiRes.json();
      return (payload || []).map(server => ({
        server_name: server.name,
        embed_url: server.url
      }));
    }
  } catch (err) {
    console.error("All server extraction pipelines failed:", err.message);
  }
  
  // Default mock fallback server if all else fails
  return [
    { server_name: "Aurora", embed_url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
    { server_name: "Nova", embed_url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" }
  ];
}

/**
 * Extracts the direct streaming URL and subtitles from an embed URL.
 */
async function extractStreamUrl(serverName, embedUrl) {
  const cleanName = serverName.toLowerCase();
  
  // 1. Check if the embed URL is already a direct stream
  if (embedUrl.endsWith(".m3u8") || embedUrl.endsWith(".mp4")) {
    return { stream_url: embedUrl, type: embedUrl.endsWith(".m3u8") ? "hls" : "mp4", subtitles: [] };
  }

  // 2. Local decryptor logic for Vidstreaming/GogoPlay (Standard AES decryption)
  if (cleanName === "vidstreaming" || cleanName === "gogoplay") {
    try {
      const urlObj = new URL(embedUrl);
      const id = urlObj.searchParams.get("id");
      if (id) {
        // Fetch GogoPlay embed page
        const response = await fetch(embedUrl, {
          headers: { "Referer": "https://gogoanime3.co/", "User-Agent": "Mozilla/5.0" }
        });
        if (response.ok) {
          const html = await response.text();
          // Find the encrypted data value
          const dataMatch = html.match(/<script data-name="episode" data-value="([^"]+)">/);
          if (dataMatch) {
            const ciphertext = dataMatch[1];
            // Decrypt the ID parameter
            const decryptedId = decryptAES(ciphertext, keys.key, keys.iv);
            if (decryptedId) {
              // Construct request to fetch direct sources
              const ajaxUrl = `https://${urlObj.hostname}/encrypt-ajax.php?id=${encryptAES(id, keys.key, keys.iv)}&alias=${id}`;
              const ajaxRes = await fetch(ajaxUrl, {
                headers: {
                  "X-Requested-With": "XMLHttpRequest",
                  "Referer": embedUrl,
                  "User-Agent": "Mozilla/5.0"
                }
              });
              if (ajaxRes.ok) {
                const payload = await ajaxRes.json();
                if (payload && payload.data) {
                  // Decrypt response sources payload
                  const decryptedPayload = decryptAES(payload.data, keys.decKey, keys.iv);
                  if (decryptedPayload) {
                    const parsed = JSON.parse(decryptedPayload);
                    // Find HLS source
                    const hlsSource = (parsed.source || []).find(src => src.file.endsWith(".m3u8"));
                    if (hlsSource) {
                      return {
                        stream_url: hlsSource.file,
                        type: "hls",
                        subtitles: (parsed.track || []).map(track => ({
                          lang: track.label || "English",
                          url: track.file
                        }))
                      };
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Local GogoPlay AES decryption failed, falling back to public extractor:", err.message);
    }
  }

  // 3. Fallback to public extractor APIs (consumet extractors)
  try {
    // Determine episode ID from embed URL or use API watch endpoint
    // Consumet supports fetching sources directly via episode ID
    const urlObj = new URL(embedUrl);
    const idParam = urlObj.searchParams.get("id");
    const cleanId = idParam || embedUrl.split("/").pop().split("?")[0];
    
    // Attempt calling Consumet watch API
    const apiWatchUrl = `https://api.consumet.org/anime/gogoanime/watch/${cleanId}`;
    const watchRes = await fetch(apiWatchUrl);
    if (watchRes.ok) {
      const payload = await watchRes.json();
      const bestSource = (payload.sources || []).find(src => src.quality === "default" || src.quality === "auto") || (payload.sources || [])[0];
      if (bestSource) {
        return {
          stream_url: bestSource.url,
          type: bestSource.isM3U8 ? "hls" : "mp4",
          subtitles: (payload.subtitles || []).map(sub => ({
            lang: sub.lang || "English",
            url: sub.url
          }))
        };
      }
    }
  } catch (err) {
    console.error("All stream extraction pipelines failed:", err.message);
  }

  // Ultimate fallback link (MDN test stream)
  return {
    stream_url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    type: "hls",
    subtitles: []
  };
}

async function getRecentlyUpdated() {
  try {
    const response = await fetch("https://gogoanime3.co/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" }
    });
    if (response.ok) {
      const html = await response.text();
      const list = [];
      const regex = /<li>\s*<div class="img">\s*<a href="\/([^"-]+)-episode-(\d+)" title="([^"]+)">\s*<img src="([^"]+)"/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        list.push({
          id: match[1],
          episode: Number(match[2]),
          title: match[3].replace(/Episode \d+/, "").trim(),
          coverImage: match[4]
        });
      }
      return list.slice(0, 10);
    }
  } catch (err) {
    console.error("Error scraping recently updated:", err.message);
  }
  return [];
}

module.exports = {
  searchAnime,
  getEpisodes,
  getEpisodeServers,
  extractStreamUrl,
  getRecentlyUpdated
};
