# NexAnime — Full Rebuild Instructions

## Step 0: Cleanup

Delete everything in the project root **except** the `reference/` folder (contains screenshots of the target UI — use these as your visual source of truth for every layout, spacing, and interaction detail). Start the codebase from scratch.

## What You're Building

A self-hosted, single-user anime streaming and tracking web app called **NexAnime**. This runs on localhost for one person — there is no login screen, no user accounts, no multi-device sync, no social features. One local profile, one machine, full anime-tracking experience: browse, watch, track progress, maintain a watchlist, get notified about new episodes.

This is a 1:1 visual and functional clone of the reference screenshots' layout and interactions, with three changes: brand name is **NexAnime**, accent color is **blue** (not the reference's teal/white), and a new SVG logo styled after the reference's wordmark logo but rebranded. Everything else — layout patterns, card designs, hover behaviors, page structure, component interactions — should match the reference screenshots exactly.

Do not build: login/auth screens, device management, account deletion flows, multi-user comment threads, or anything implying more than one user exists. Where the reference shows those, see the per-feature notes below for what replaces them.

---

## Tech Stack

- **Frontend + API layer**: Next.js (App Router), TypeScript
- **Database**: SQLite (single file, `nexanime.db`, gitignored)
- **Metadata source**: AniList GraphQL API (`https://graphql.anilist.co`) — free, public, no auth needed for reads. Use this for all anime metadata, characters, voice actors, airing schedules, and relations.
- **Metadata fallback**: Jikan API (unofficial MyAnimeList wrapper, free, no auth) for cross-referencing when AniList data is incomplete
- **Video sources**: standalone scraper module (see Section 6) — build the adapter interface first; actual scrape targets are decided separately, don't hardcode assumptions about which sites
- **Styling**: dark theme, blue-dominant accent (palette in Section 7)

---

## Section 1: Critical Path / Build Order

1. Next.js scaffold, SQLite schema, AniList GraphQL client, theme tokens
2. `AnimeCard` component + hover-expand preview panel (used everywhere — build once, reuse across Homepage/Browse/Watchlist)
3. Browse/Search page (fully AniList-driven, no scraper dependency — biggest early unblock)
4. Anime Detail page, all four tabs (Episodes/Characters/Related/More Like This)
5. Scraper skeleton + adapter interface (parallel-buildable alongside step 4)
6. Episode Player page, wired to scraper output (or a mock stream URL as placeholder if scraper isn't finished yet)
7. Onboarding flow + avatar picker (independent, can be built any time)
8. Watchlist page + Profile page + Settings pages
9. Notifications (depends on scraper's schedule-check job)
10. Homepage (composes everything above — build last, it's a composition of already-built pieces)

If time runs short: cut the "Recently Updated" strip and the "Estimated Schedule" sidebar widget first — visually nice, functionally lowest priority. Never cut Watchlist, Progress Tracking, or the Player — those are the actual product.

---

## Section 2: Complete Page & Feature List

### Homepage (`/`)
- Hero banner: backdrop image, title, format/score/runtime/season badges, synopsis, "Watch Now" + bookmark buttons, prev/next arrows to cycle featured anime
- **Dive Back In** carousel: continue-watching cards with a thin progress bar overlaid on the thumbnail bottom edge, duration badge top-right
- **Trending Now** carousel: standard anime cards. On hover, card expands into a preview panel showing title, format/status/genre badges, star-rating percentage, runtime, air date, 2–3 line synopsis, "Watch now" pill button, bookmark icon button. Adjacent cards shift to make room for the expanded panel.
- Filter tabs above a secondary grid: "This Season" / "All Time Popular" / "Top Rated" — switching tabs re-queries and re-renders the grid below
- **Top Upcoming**: distinct wide-card layout — cover image, "Ep 1 airing in [Month Year]", Source badge (LIGHT NOVEL/MANGA/VIDEO GAME/etc.), 2–3 line synopsis, genre pills, studio name
- **Recently Updated** strip: thumbnail, episode-number badge bottom-left corner, small "new" flag tag on the most recent item
- **Estimated Schedule** sidebar widget: horizontal day-tabs (today + next several days), and beneath the selected day, a chronological list of air times paired with show name and episode number

### Browse / Search (`/browse`)
- Filter bar with these fields, all as dropdowns: Search (text), Genres (multi-select), Format (Movie/TV/TV Short/Special/OVA/ONA), Year, Sort (Popularity/etc.), Season, Airing Status, Tags, Country of Origin, Source
- Result count display and pagination controls (first page / previous / current page number / next / last page)
- Standard card grid below filters, reusing the `AnimeCard` + hover-preview component
- Separate from the full browse page: a compact search-as-you-type dropdown attached to the global header search bar — shows thumbnail, title, format, episode count, status badge, season/year per result row

### Anime Detail (`/anime/[id]`)
- Backdrop image, poster, title, season/year label, genre pills
- Action row: "Watch Now" button, bookmark button that opens a status dropdown (Plan to watch / Watching / Open editor), share button, external link icons (AniList, MAL)
- Synopsis text
- Tab bar: Episodes / Characters / Related / More like this
  - **Episodes tab**: episode count label, grid/list view toggle, sort-order toggle, episode thumbnails each showing view count
  - **Characters tab**: repeating two-column rows — character portrait + character name + role label (MAIN/SUPPORTING) paired with voice actor portrait + VA name + VA language
  - **Related tab**: card(s) for prequel/sequel/side-story entries, each tagged with a relation-type badge (PREQUEL, SEQUEL, etc.)
  - **More like this tab**: standard recommendation grid, same card component as elsewhere
- Sidebar: "Next ep airing in X days" countdown pill, "Watch trailer" button, then a metadata list — Format, Status, Aired date, Season, Average score, Mean score, Source, Studios (as chips), Genres (as chips), Tags (full list as chips), Romaji title, English title, Native title, Synonyms list
- **Watchlist editor modal** (opens from the bookmark dropdown's "Open editor" option): Status select, Start date picker, End date picker, Score input, Episode watched input, Total rewatches input, Notes textarea, Cancel/Save buttons

### Episode Player (`/watch/[animeId]/[episodeId]`)
- Breadcrumb: Home > Anime title > Episode title
- Video player area
- Dismissible warning banner: "If the current server doesn't work, feel free to try the other available servers"
- Controls row: Dub/Sub toggle, Server picker (opens a list of available source adapters), Share button
- Watchlist status pill inline near the title
- Episode air date, episode synopsis with a show-more/show-less toggle
- Small metadata card: Studio, Status, Aired date range
- Genre pills
- Right rail: sticky "Up Next" header showing the currently-playing episode, then the full episode list with a search-episode input, a refresh icon, a sort-order toggle, and a grid-view toggle. Each episode row shows thumbnail and how long ago it was added. Below the list: "Next ep airing in X days" pill, then a "More like this" recommendation list.
- **Do not build**: comments section, view-count display, like/dislike counters, "report" button, "#1 trending" badge — these are social/aggregate features with no meaning for a single-user local app. If a personal "flag this source as broken" utility is wanted later, that's a separate small feature, not a copy of the reference's report button.

### Onboarding (`/onboarding`, first launch only)
- Welcome screen
- Form: Display name, pronouns (optional), About Me (optional)
- Anime avatar picker: searchable/filterable grid of character portraits (source these from AniList's character data — cache a batch locally for the picker)
- On finish: write the profile row to SQLite, mark onboarding complete, redirect to Homepage. Never show this screen again after first completion.

### Profile (`/profile`)
- Avatar, display name, pronouns, About Me text, "Member since" date
- Stat blocks: Minutes Watched, Anime Finished, Total Anime
- History row: same progress-bar-thumbnail card component as Dive Back In
- Anime List / Watchlist preview row
- Recent Activity feed: chronological log of the user's own actions — "Plans to watch X", "Watched ep N of Y", etc. This is a personal activity log, not a social feed — populate it from local database writes whenever watchlist status changes or an episode is marked watched.

### Watchlist (`/watchlist`)
- Left sidebar:
  - **Lists** section: All / Planning / Watching / On hold / Dropped / Finished / Rewatching, each with a count badge
  - **Filters** section: Format (with counts), Status — Airing/Finished/Upcoming (with counts), Country (with count), Genre (full list, with counts), Year (full list, with counts)
  - Search input and sort control above the lists
- Main area: anime grouped by list category, each category as a horizontally-scrollable row of cards using the standard `AnimeCard` component

### Settings (`/settings`)
Sidebar nav: My Account / Anime / Playback / Import List

- **My Account**: Display Name, Pronouns, About Me textarea. Include a "Reset Local Data" action (replaces the reference's account-deletion flow — since there's no account system, this should clear the local database/profile instead, with a clear confirmation step, not a 7-day grace period).
- **Anime**: Anime Title Language selector, Hide Adult Content toggle, Autoplay Trailers toggle
- **Playback**: Video Quality Preference selector, Auto Play toggle, Auto Next toggle, Auto Skip Intro/Outro toggle, MiniPlayer toggle, Ambient Mode toggle, Pause History toggle (when on, episode progress stops being saved)
- **Import List**: AniList username input, checkboxes per category (Plan to watch/Watching/On hold/Dropped/Finished/Rewatching), Import button — pulls the specified public AniList list into the local watchlist

### Notifications
- Bell icon with unread-count badge in the header
- Panel with tabs: All / New Episodes / Airing Soon
- Each entry: anime thumbnail, title, message (e.g. "Episode 13 just got added!", "Airs in 2 days")
- Source: the scraper's schedule-check job detects new episodes for anime the user has subscribed to / has in their watchlist, and writes notification rows to the database. This is a genuinely functional feature (not a stub) — it's how the user finds out their subscribed shows updated.

---

## Section 3: Component Inventory

| Component | Key props | Reused in |
|---|---|---|
| `AnimeCard` | id, poster, title, format, year, statusDot, score | Homepage, Browse, Watchlist, search dropdown |
| `AnimeCardHoverPreview` | synopsis, runtime, airDate, genres, format tags | Wraps AnimeCard on hover |
| `UpcomingCard` | cover, airDate, sourceBadge, synopsis, genres, studio | Homepage Top Upcoming |
| `ContinueWatchingCard` | poster, progressPercent, durationLabel, title, subtitle | Dive Back In, Profile History |
| `RecentlyUpdatedThumb` | thumb, epNumberBadge, newFlag | Homepage |
| `ScheduleWidget` | days[], entries[{time, title, epNumber}] | Homepage sidebar |
| `EpisodeGrid` / `EpisodeListRow` | epNumber, thumb, title, viewCount | Anime Detail, Player right rail |
| `CharacterRow` | charPortrait, charName, role, vaPortrait, vaName, vaLanguage | Anime Detail Characters tab |
| `TabNav` | tabs[], activeTab | Anime Detail, Settings, Watchlist |
| `WatchlistEditorModal` | status, startDate, endDate, score, epWatched, rewatches, notes | Anime Detail |
| `StatusDropdownButton` | currentStatus, options[] | Anime Detail bookmark button |
| `FilterSidebar` | sections[{label, options[{label, count}]}] | Watchlist |
| `FilterBar` | search, genres, format, year, sort, season, airingStatus, tags, country, source | Browse |
| `SearchDropdown` | query, results[] | Global header |
| `VideoPlayer` | src, sources[], subtitleTracks, onProgress, autoNext, autoSkip | Episode Player |
| `ServerPicker` | servers[{name, status}] | Episode Player |
| `NotificationPanel` | tabs[], notifications[] | Header bell dropdown |
| `AvatarPicker` | catalog[], selected, onSelect | Onboarding |
| `SettingsToggleRow` | label, description, checked | All Settings tabs |
| `SettingsSelectRow` | label, description, value, options[] | All Settings tabs |
| `ActivityFeedItem` | icon, message, timestamp | Profile Recent Activity |

---

## Section 4: Data Model (SQLite)

```sql
-- Single-row table — one local profile, no user_id foreign keys anywhere in this schema
profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT,
  pronouns TEXT,
  about_me TEXT,
  avatar_char_id INTEGER,
  onboarded_at DATETIME,
  created_at DATETIME
)

settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title_language TEXT DEFAULT 'romaji',
  hide_adult_content BOOLEAN DEFAULT 0,
  autoplay_trailers BOOLEAN DEFAULT 0,
  video_quality TEXT DEFAULT 'auto',
  auto_play BOOLEAN DEFAULT 1,
  auto_next BOOLEAN DEFAULT 0,
  auto_skip_intro_outro BOOLEAN DEFAULT 0,
  mini_player BOOLEAN DEFAULT 0,
  ambient_mode BOOLEAN DEFAULT 0,
  pause_history BOOLEAN DEFAULT 0
)

anime_cache (
  anilist_id INTEGER PRIMARY KEY,
  title_romaji TEXT, title_english TEXT, title_native TEXT,
  synonyms TEXT,               -- JSON array
  synopsis TEXT,
  format TEXT, status TEXT, season TEXT, season_year INTEGER,
  average_score INTEGER, mean_score INTEGER,
  source TEXT,
  studios TEXT,                 -- JSON array
  genres TEXT,                  -- JSON array
  tags TEXT,                    -- JSON array
  cover_image TEXT, banner_image TEXT,
  episode_count INTEGER,
  next_airing_at DATETIME,
  cached_at DATETIME
)

episode_sources (
  id INTEGER PRIMARY KEY,
  anilist_id INTEGER,
  episode_number INTEGER,
  title TEXT,
  thumbnail TEXT,
  source_adapter TEXT,
  stream_url TEXT,
  subtitle_url TEXT,
  resolved_at DATETIME
)

watchlist (
  id INTEGER PRIMARY KEY,
  anilist_id INTEGER,
  list_status TEXT,             -- planning/watching/on_hold/dropped/finished/rewatching
  start_date DATE, end_date DATE,
  score INTEGER,
  episode_watched INTEGER,
  total_rewatches INTEGER DEFAULT 0,
  notes TEXT,
  updated_at DATETIME
)

watch_progress (
  id INTEGER PRIMARY KEY,
  anilist_id INTEGER,
  episode_number INTEGER,
  seconds_watched INTEGER,
  duration_seconds INTEGER,
  last_watched_at DATETIME
)

activity_log (
  id INTEGER PRIMARY KEY,
  type TEXT,                     -- 'status_change' | 'episode_watched' | 'score_updated'
  anilist_id INTEGER,
  message TEXT,
  created_at DATETIME
)

notifications (
  id INTEGER PRIMARY KEY,
  anilist_id INTEGER,
  type TEXT,                      -- 'new_episode' | 'airing_soon'
  message TEXT,
  read BOOLEAN DEFAULT 0,
  created_at DATETIME
)

subscriptions (
  anilist_id INTEGER PRIMARY KEY,
  subscribed_at DATETIME
)
```

---

## Section 5: Folder Structure

```
nexanime/
├── reference/                    # KEEP — screenshots, do not delete or modify
├── app/
│   ├── page.tsx                  # Homepage
│   ├── onboarding/page.tsx
│   ├── browse/page.tsx
│   ├── anime/[id]/page.tsx
│   ├── watch/[animeId]/[episodeId]/page.tsx
│   ├── profile/page.tsx
│   ├── watchlist/page.tsx
│   ├── settings/
│   │   ├── layout.tsx
│   │   ├── account/page.tsx
│   │   ├── anime/page.tsx
│   │   ├── playback/page.tsx
│   │   └── import/page.tsx
│   └── api/
│       ├── anilist/route.ts
│       ├── watchlist/route.ts
│       ├── progress/route.ts
│       ├── notifications/route.ts
│       ├── profile/route.ts
│       └── stream/[animeId]/[ep]/route.ts
├── components/
│   ├── cards/
│   ├── player/
│   ├── detail/
│   ├── browse/
│   ├── settings/
│   ├── onboarding/
│   └── shared/
├── lib/
│   ├── anilist.ts
│   ├── jikan.ts
│   ├── db.ts
│   └── theme.ts
├── scraper/                      # standalone process, separate from Next.js request lifecycle
│   ├── index.ts
│   ├── adapters/
│   ├── schedule-check.ts
│   └── db.ts
├── types/
├── public/
│   └── avatars/
└── nexanime.db                   # gitignored
```

---

## Section 6: Scraper Architecture

Build the scraper as a **standalone Node process**, separate from the Next.js app — it should not run inside API route request/response cycles. It writes to the same SQLite file the Next.js app reads from.

- **Adapter interface**: define one common interface (e.g. `resolveEpisodeSource(animeId, episodeNumber) → { streamUrl, subtitleUrl, sourceName }`) that every video-source integration implements. This lets sources be added/swapped/removed without touching the player or any other part of the app.
- **Resolution model**: resolve episode sources on-demand (when the user clicks play) rather than pre-scraping everything — avoids serving stale/dead links.
- **Schedule-check job**: a separate scheduled task (cron or `node-cron`) that queries AniList's `AiringSchedule` for anime in the `subscriptions` table and writes rows to `notifications` when a new episode is detected.
- Which actual sites/services the adapters pull from is a separate decision to make during implementation — build the interface generically first.

---

## Section 7: Logo & Color Palette

**Logo**: new SVG wordmark for "NexAnime," styled after the reference's logo treatment (bold geometric wordmark, angular/tech feel) but original artwork, not a traced copy — blue-dominant instead of the reference's white/teal.

**Palette** — dark theme, blue as the primary/brand color only. Secondary and tertiary UI elements (genre pills, format badges, secondary buttons) stay neutral gray — blue is not used everywhere, only for primary actions and branding.

| Token | Hex | Use |
|---|---|---|
| `--bg-base` | `#0a0a0f` | page background |
| `--bg-surface` | `#141420` | cards, panels |
| `--bg-surface-hover` | `#1c1c2c` | card hover state |
| `--primary` | `#3b82f6` | primary buttons, active nav/tab state, links, logo |
| `--primary-hover` | `#2563eb` | button hover state |
| `--accent-airing` | `#22c55e` | airing-status green dot (status color, unrelated to brand) |
| `--accent-hiatus` | `#eab308` | hiatus/other-status amber dot |
| `--text-primary` | `#f5f5f7` | headings, primary text |
| `--text-secondary` | `#a1a1aa` | metadata, secondary text |
| `--border` | `#27272f` | card borders, dividers |

---

## Section 8: Development Phases (3–5 Day Solo Sprint)

- **Day 1**: Scaffold, DB schema, AniList client, theme tokens, `AnimeCard` + hover preview, Browse page
- **Day 2**: Anime Detail page (all tabs) + Watchlist editor modal; scraper skeleton + adapter interface in parallel
- **Day 3**: Episode Player + Up Next rail + server picker; Onboarding + avatar picker
- **Day 4**: Watchlist page, Profile page, Settings (all four tabs), Notifications wired to scraper's schedule-check
- **Day 5**: Homepage (composes everything), Estimated Schedule widget, polish, theme consistency pass, bug fixes

---

## Section 9: Open Decisions to Make During Build

1. Which actual site(s)/services the video-source adapters scrape — decide and implement per-adapter, keep the interface generic in the meantime.
2. Subtitle delivery — whether adapters return subtitle URLs directly or need a separate fetch step; affects `VideoPlayer` prop shape.
3. Whether to add a personal "flag this source as broken" utility on the player page (small, optional — not a copy of the reference's social report button).
