import type { ScraperAdapter, ScraperSource } from './adapter';
import { queryOne } from '@/lib/db';
import { getAnimeDetail } from '@/lib/anilist';
import crypto from 'crypto';

const keys = {
  key: Buffer.from("37911490908853213561234567890128", "utf8"),
  iv: Buffer.from("3134003220123456", "utf8"),
  decKey: Buffer.from("54674138327930866480207639501426", "utf8")
};

function decryptAES(ciphertext: string, key: Buffer, iv: Buffer): string | null {
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err: any) {
    console.error("[Gogoanime Scraper] AES Decryption error:", err.message);
    return null;
  }
}

function encryptAES(text: string, key: Buffer, iv: Buffer): string | null {
  try {
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  } catch (err: any) {
    console.error("[Gogoanime Scraper] AES Encryption error:", err.message);
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export class GogoanimeAdapter implements ScraperAdapter {
  id = 'gogoanime';
  name = 'Gogoanime (Real Server)';

  async resolveEpisodeSource(
    anilistId: number,
    episodeNumber: number
  ): Promise<ScraperSource | null> {
    console.log(`[Gogoanime Scraper] Resolving source for AniList ID: ${anilistId}, Episode: ${episodeNumber}`);
    
    // Fallback stream source (Sintel HLS)
    const fallbackSource: ScraperSource = {
      adapterId: this.id,
      sourceName: this.name,
      streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
      subtitleUrl: null,
    };

    try {
      // 1. Retrieve titles from DB cache
      let dbAnime = await queryOne<{ title_romaji: string; title_english: string; synonyms: string }>(
        'SELECT title_romaji, title_english, synonyms FROM anime_cache WHERE anilist_id = ?',
        [anilistId]
      );

      let titleCandidates: string[] = [];
      if (dbAnime) {
        if (dbAnime.title_romaji) titleCandidates.push(dbAnime.title_romaji);
        if (dbAnime.title_english) titleCandidates.push(dbAnime.title_english);
        if (dbAnime.synonyms) {
          try {
            const parsed = JSON.parse(dbAnime.synonyms);
            if (Array.isArray(parsed)) {
              titleCandidates.push(...parsed);
            }
          } catch (_) {}
        }
      } else {
        // Fallback: Query AniList API directly
        const details = await getAnimeDetail(anilistId);
        if (details) {
          if (details.title.romaji) titleCandidates.push(details.title.romaji);
          if (details.title.english) titleCandidates.push(details.title.english);
          if (details.synonyms) titleCandidates.push(...details.synonyms);
        }
      }

      // Filter and unique title candidates
      titleCandidates = Array.from(new Set(titleCandidates.filter(Boolean)));
      if (titleCandidates.length === 0) {
        throw new Error('No title candidates found to search Gogoanime');
      }

      // 2. Try candidates to find working watch page
      for (const title of titleCandidates) {
        const slug = slugify(title);
        const episodeSlug = `${slug}-episode-${episodeNumber}`;
        const watchUrl = `https://gogoanime.by/${episodeSlug}`;
        
        console.log(`[Gogoanime Scraper] Attempting to scrape: ${watchUrl}`);
        try {
          const res = await fetch(watchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
            },
            signal: AbortSignal.timeout(4000) // 4 second timeout per attempt
          });

          if (!res.ok) continue;
          
          const html = await res.text();
          const match = html.match(/data-video="([^"]+)"/);
          if (!match) continue;

          let embedUrl = match[1];
          if (embedUrl.startsWith("//")) embedUrl = "https:" + embedUrl;
          console.log(`[Gogoanime Scraper] Found embed player URL: ${embedUrl}`);

          // 3. Resolve embed url and decrypt stream sources
          const urlObj = new URL(embedUrl);
          const idParam = urlObj.searchParams.get("id");
          if (!idParam) continue;

          const embedRes = await fetch(embedUrl, {
            headers: {
              'Referer': 'https://gogoanime.by/',
              'User-Agent': 'Mozilla/5.0'
            },
            signal: AbortSignal.timeout(4000)
          });

          if (!embedRes.ok) continue;
          const embedHtml = await embedRes.text();
          const dataMatch = embedHtml.match(/<script data-name="episode" data-value="([^"]+)">/);
          if (!dataMatch) continue;

          const ciphertext = dataMatch[1];
          const decryptedId = decryptAES(ciphertext, keys.key, keys.iv);
          if (!decryptedId) continue;

          // Call encrypt-ajax.php to get streams
          const encryptedId = encryptAES(idParam, keys.key, keys.iv);
          const ajaxUrl = `https://${urlObj.hostname}/encrypt-ajax.php?id=${encryptedId}&alias=${idParam}`;
          
          const ajaxRes = await fetch(ajaxUrl, {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "Referer": embedUrl,
              "User-Agent": "Mozilla/5.0"
            },
            signal: AbortSignal.timeout(4000)
          });

          if (!ajaxRes.ok) continue;
          const ajaxData = await ajaxRes.json() as { data: string };
          if (!ajaxData || !ajaxData.data) continue;

          const decryptedPayloadStr = decryptAES(ajaxData.data, keys.decKey, keys.iv);
          if (!decryptedPayloadStr) continue;

          const decryptedPayload = JSON.parse(decryptedPayloadStr);
          const hlsSource = (decryptedPayload.source || []).find((src: any) => src.file.endsWith(".m3u8"));
          
          if (hlsSource) {
            console.log(`[Gogoanime Scraper] Successfully resolved direct stream: ${hlsSource.file}`);
            return {
              adapterId: this.id,
              sourceName: this.name,
              streamUrl: hlsSource.file,
              subtitleUrl: (decryptedPayload.track || []).find((t: any) => t.label === "English")?.file || null
            };
          }
        } catch (err: any) {
          console.warn(`[Gogoanime Scraper] Failed to resolve candidate ${slug}: ${err.message}`);
        }
      }
    } catch (e: any) {
      console.error(`[Gogoanime Scraper] Error during resolution: ${e.message}`);
    }

    console.log(`[Gogoanime Scraper] Falling back to test stream for AniList ID: ${anilistId}`);
    return fallbackSource;
  }
}
