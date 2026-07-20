import type { ScraperAdapter, ScraperSource } from './adapter';
import { queryOne } from '@/lib/db';
import { getReanimeByAnilistId } from '@/lib/reanime';

export class AnimepaheAdapter implements ScraperAdapter {
  id = 'animepahe';
  name = 'Animepahe (Real Server)';

  async resolveEpisodeSource(
    anilistId: number,
    episodeNumber: number,
    isDub?: boolean
  ): Promise<ScraperSource | null> {
    console.log(`[Animepahe Scraper] Resolving source for AniList ID: ${anilistId}, Episode: ${episodeNumber}, Dub: ${!!isDub}`);
    
    try {
      // 1. Retrieve titles from DB cache or AniList
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
        const details = await getReanimeByAnilistId(anilistId);
        if (details) {
          if (details.title?.romaji) titleCandidates.push(details.title.romaji);
          if (details.title?.english) titleCandidates.push(details.title.english);
          if (details.synonyms) titleCandidates.push(...details.synonyms);
        }
      }

      titleCandidates = Array.from(new Set(titleCandidates.filter(Boolean)));
      if (titleCandidates.length === 0) {
        throw new Error('No title candidates found to search Animepahe');
      }

      // 2. Attempt to resolve on Animepahe base domains
      const baseDomains = [
        'https://animepahe.com',
        'https://animepahe.ru'
      ];

      for (const baseDomain of baseDomains) {
        console.log(`[Animepahe Scraper] Trying base domain: ${baseDomain}`);
        let domainUnreachable = false;

        for (const title of titleCandidates) {
          // Skip empty or invalid queries containing only dashes/whitespace
          if (!title || title.trim() === '' || title === '-' || title.replace(/-/g, '') === '') continue;

          const searchUrl = `${baseDomain}/api?m=search&q=${encodeURIComponent(title)}`;
          console.log(`[Animepahe Scraper] Searching Animepahe: ${searchUrl}`);
          
          try {
            const searchRes = await fetch(searchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
              },
              signal: AbortSignal.timeout(3000)
            });

            if (!searchRes.ok) continue;
            const searchData = await searchRes.json() as { data?: Array<{ session: string; title: string }> };
            if (!searchData || !searchData.data || searchData.data.length === 0) continue;

            // Use the best matching result (typically first)
            const session = searchData.data[0].session;
            console.log(`[Animepahe Scraper] Found anime session: ${session} for title: ${searchData.data[0].title}`);

            // Fetch the release list for this session to find the episode kwik link
            // Calculate page: Animepahe paginates episodes (30 per page)
            const page = Math.ceil(episodeNumber / 30);
            const releaseUrl = `${baseDomain}/api?m=release&id=${session}&sort=asc&page=${page}`;
            
            const releaseRes = await fetch(releaseUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
              },
              signal: AbortSignal.timeout(3000)
            });

            if (!releaseRes.ok) continue;
            const releaseData = await releaseRes.json() as { data?: Array<{ episode: number; kwik: string }> };
            if (!releaseData || !releaseData.data) continue;

            const episodeObj = releaseData.data.find(ep => ep.episode === episodeNumber);
            if (!episodeObj || !episodeObj.kwik) continue;

            const kwikUrl = episodeObj.kwik;
            console.log(`[Animepahe Scraper] Found kwik link: ${kwikUrl}`);

            // Fetch kwik redirect page and extract m3u8 source
            const kwikRes = await fetch(kwikUrl, {
              headers: {
                'Referer': baseDomain + '/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
              },
              signal: AbortSignal.timeout(3000)
            });

            if (!kwikRes.ok) continue;
            const kwikHtml = await kwikRes.text();
            
            // Regex to extract the direct m3u8 URL from the packed Javascript
            const sourceMatch = kwikHtml.match(/source\s*=\s*['"](https:\/\/[^'"]+index\.m3u8)['"]/i) || 
                                kwikHtml.match(/(https:\/\/[^'"]+index\.m3u8)/i);
            
            if (sourceMatch) {
              const m3u8Url = sourceMatch[1];
              console.log(`[Animepahe Scraper] Successfully resolved direct stream: ${m3u8Url}`);
              return {
                adapterId: this.id,
                sourceName: this.name,
                streamUrl: m3u8Url,
                subtitleUrl: null
              };
            }
          } catch (err: any) {
            console.warn(`[Animepahe Scraper] Failed to resolve candidate ${title} on ${baseDomain}: ${err.message}`);
            // Network block/timeout check to instantly fail-fast and save time
            const errMsg = (err.message || '').toLowerCase();
            if (errMsg.includes('timeout') || errMsg.includes('fetch failed') || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
              console.warn(`[Animepahe Scraper] Base domain ${baseDomain} is unreachable. Skipping remaining candidates for this domain.`);
              domainUnreachable = true;
              break;
            }
          }
        }

        if (domainUnreachable) continue;
      }
    } catch (e: any) {
      console.error(`[Animepahe Scraper] Error during resolution: ${e.message}`);
    }

    return null;
  }
}
