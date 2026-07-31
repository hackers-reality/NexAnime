# NexAnime

[![Next.js Version](https://img.shields.io/badge/Next.js-16.2.10--turbopack-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![React Version](https://img.shields.io/badge/React-19.2.4-blue?style=for-the-badge&logo=react)](https://react.dev)
[![Database](https://img.shields.io/badge/SQLite-Libsql-003b57?style=for-the-badge&logo=sqlite)](https://github.com/tursodatabase/libsql)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

Self-hosted anime streaming and tracking platform. Browse, watch, track progress, maintain a watchlist, and get notified about new episodes.

---

## Quick Install

### Windows

Clone the repo, then double-click `install.cmd` (or run it in PowerShell):

```bash
git clone https://github.com/hackers-reality/NexAnime.git
cd NexAnime
install.cmd
```

Once done, open a **new** terminal and type:

```
nexanime
```

### Mac / Linux

```bash
git clone https://github.com/hackers-reality/NexAnime.git
cd NexAnime
chmod +x install.sh
./install.sh
```

Open a **new** terminal and type:

```
nexanime
```

The `nexanime` command starts the server and opens your browser automatically. On first run it builds the project, which takes a minute.

### Manual Install

```bash
git clone https://github.com/hackers-reality/NexAnime.git
cd NexAnime
npm install
npm run build
npm run start
```

Server runs at `http://localhost:3000`.

---

## Features

### Playback
- Multi-server streaming with auto-failover (Zoko, MegaPlay, VidStreaming, StreamTape)
- Dub/Sub toggle with server-specific source switching
- Auto-skip intro/outro
- Auto-play next episode
- Keyboard shortcuts: `T` theatre mode, `E` episode list, `M` mute, `,`/`.` playback speed, `Shift+Left/Right` prev/next episode
- Mini-player with drag support (persists across pages)
- Progress tracking — saves watched position, resumes where you left off

### Browse & Discovery
- Trending tabs (TODAY, THIS WEEK, THIS MONTH) from AniList + reanime
- Recently Updated with live episode counts
- Upcoming anime with airing countdown timers
- Genre quick-links
- Full-text search with merged results (AniList + reanime)
- Anime detail pages with characters, staff, relations, recommendations

### Watchlist & Tracking
- Categories: All, Planning, Watching, On Hold, Dropped, Finished, Rewatching
- Inline status badges on cards — update without opening modals
- Progress stats: hours watched, episodes completed
- Watch history with timestamps
- AniList watchlist import

### Settings
- Account: display name, avatar, pronouns, data reset
- Playback: auto-play, auto-skip, video quality
- Appearance: Dark / Light / System theme
- Anime listing style preferences

### Notifications
- Auto-updates check on startup
- Real-time anime update notifications from AniList
- Episode release notifications

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `/` | Focus search |
| `?` | Show shortcuts overlay |
| `g` then `h/b/w/s` | Go to Home/Browse/Watchlist/Stats |
| `T` | Toggle theatre mode |
| `E` | Toggle episode list |
| `M` | Toggle mute |
| `,` / `.` | Decrease/increase playback speed |
| `Shift+Left/Right` | Previous/next episode |

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **UI**: [React 19](https://react.dev/), CSS Modules, glassmorphic design
- **Database**: [LibSQL / SQLite](https://github.com/tursodatabase/libsql)
- **Video**: HLS.js, multi-source embed players
- **APIs**: AniList GraphQL, reanime.to, Jikan (MAL), HiAnime
- **PWA**: Service worker, offline support, installable

---

## Project Structure

```
app/
  api/          # Route handlers (progress, watchlist, settings, stream, meta, etc.)
  watch/        # Watch page with player + episode navigation
  anime/        # Anime detail pages
  browse/       # Browse/search with filters
  watchlist/    # Watchlist management
  stats/        # Viewing statistics
  settings/     # Account, playback, appearance settings
  onboarding/   # First-time user setup
components/
  cards/        # AnimeCard, ContinueWatchingCard, UpcomingCard, etc.
  player/       # VideoPlayer (HLS + embed + mini-player)
  shared/       # Header, SearchDropdown, BackToTop, Toast, etc.
  watchlist/    # WatchlistStatusBadge
lib/
  anilist.ts    # AniList GraphQL client
  reanime.ts    # reanime.to API
  hianime-api.ts # HiAnime scraper
  jikan-api.ts  # Jikan (MAL) API
  db.ts         # SQLite database + schema
  data-api.ts   # Unified data fetching layer
  settings-cache.ts # Client-side settings cache
bin/
  nexanime.js   # CLI entry point
```

---

## License

[MIT](LICENSE) — Built by [Arnav Phulari](https://github.com/hackers-reality).
