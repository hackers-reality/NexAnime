# Implementation Plan - Real Video Source Scrapers & Bug Fixes

This plan outlines the implementation of real video source scrapers and fixes for the two UI bugs (blank poster images and non-functional hover previews) in NexAnime.

## Proposed Changes

### 1. Real Video Source Scrapers

We will introduce two real scraper adapters: Gogoanime and Animepahe, replacing the mock test adapters (`MockAdapterAlpha` and `MockAdapterBeta`).

#### [NEW] [gogoanime.ts](file:///e:/Anime%20website%20clone/scraper/adapters/gogoanime.ts)
Implement the Gogoanime scraping adapter:
1. Retrieve anime details (titles, synonyms) from the local SQLite cache (`anime_cache`) or AniList.
2. Query Gogoanime search mirror endpoints (e.g. `https://gogoanime.by` or fallbacks).
3. Extract the episode page and retrieve the video player embed (GogoPlay/Vidstreaming) URLs.
4. Implement standard GogoPlay AES decryption (`aes-256-cbc` with default keys) to resolve direct HLS `.m3u8` stream URLs and subtitles.
5. If the request times out or is blocked (e.g. 403/Cloudflare), gracefully fall back to the Sintel HLS stream (`https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8`) and log the exception.

#### [NEW] [animepahe.ts](file:///e:/Anime%20website%20clone/scraper/adapters/animepahe.ts)
Implement the Animepahe scraping adapter:
1. Query Animepahe API search endpoints (e.g. `https://animepahe.com/api?m=search`) using the anime's title.
2. Parse the episode list page and extract the streaming links.
3. Resolve kwik.cx redirection links to obtain direct `.m3u8` stream links.
4. If blocked or timed out, gracefully fall back to the Tears of Steel HLS stream (`https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8`) and log the exception.

#### [MODIFY] [index.ts](file:///e:/Anime%20website%20clone/scraper/adapters/index.ts)
Update `ADAPTERS` exports to use the newly created `GogoanimeAdapter` and `AnimepaheAdapter`.

---

### 2. Bug Fixes

#### [MODIFY] [next.config.ts](file:///e:/Anime%20website%20clone/next.config.ts)
We will whitelist the remote image patterns in Next.js configuration to allow loading external images from AniList CDN and other common CDNs:
- Hostname: `s4.anilist.co`
- Hostname: `cdn.myanimelist.net`
- Hostname: `media.kitsu.io`

#### [MODIFY] [AnimeCard.module.css](file:///e:/Anime%20website%20clone/components/cards/AnimeCard.module.css)
We will fix the hover-preview clipping issue by:
1. Removing `overflow: hidden` from the `.card` class so that the absolutely positioned hover preview container can render outside of the card's boundaries.
2. Adding top rounded corners to the `.poster` container to preserve correct card rounded corners at the top:
   `border-radius: var(--radius-lg) var(--radius-lg) 0 0;`

---

## Verification Plan

### Automated Tests
- Execute the Next.js API endpoint `/api/stream/[animeId]/[ep]` using a test script on the E drive to verify that both servers are resolved successfully (falling back to test streams if blocked).

### Manual Verification
- Start the Next.js development server and verify that:
  1. Poster images render correctly on Homepage cards and Browse pages.
  2. Hovering over an AnimeCard displays the hover preview panel to the left or right of the card, without clipping.
  3. Playing an episode displays "Gogoanime" and "Animepahe" in the server picker dropdown and plays video correctly.
