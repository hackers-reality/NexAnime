# 🌌 NexAnime — Premium Anime Tracker & Streaming Platform

[![Next.js Version](https://img.shields.io/badge/Next.js-16.2.10--turbopack-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![React Version](https://img.shields.io/badge/React-19.2.4-blue?style=for-the-badge&logo=react)](https://react.dev)
[![Database](https://img.shields.io/badge/SQLite-Libsql-003b57?style=for-the-badge&logo=sqlite)](https://github.com/tursodatabase/libsql)

NexAnime is a state-of-the-art, high-performance web application designed for anime tracking and streaming. Engineered with Next.js 16 (Turbopack) and SQLite, it offers a visual experience featuring rich dark mode themes, glassmorphic UI panels, micro-animations, and real-time streaming integrations.

---

## ✨ Features

### 🎨 Premium UI / UX Design
* **Modern Aesthetic**: Harmonious glassmorphic cards, Outfit typography, vibrant gradients, and customized scrollbars.
* **Responsive Layouts**: Designed to adapt across mobile, tablet, and desktop viewports.
* **Micro-Animations**: Hover animations on posters, cards, and buttons for responsive feedback.

### 📺 Interactive Playback Interface (`/watch/[animeId]/[episodeId]`)
* **Anime Metadata Panel**: Integrates cover art, average score, airing season, and format with an expandable **Show More/Show Less** synopsis.
* **Dub/Sub Toggle**: A clean action selector to toggle preferences.
* **Watchlist Status Badge**: Dynamic color-coded status badge synced with the local database.
* **Smart Right-Rail Navigation**:
  - **Episode Filter/Search**: Instant search bar to filter episode lists.
  - **Sorting Order**: Sort episodes in ascending (`↑`) or descending (`↓`) order.
  - **Layout View Toggle**: Switch between List View (with thumbnails) and Grid View (square number cards, ideal for long-running series).
  - **Recommendations Feed**: "More Like This" list matching the current title.

### 📋 Watchlist & Settings Dashboard
* **Dynamic Watchlist Categories**: All, Planning, Watching, On Hold, Dropped, Finished, and Rewatching panels with count badges.
* **Settings Tabs**: Account configuration, Playback preferences, Anime listing style, and **AniList watchlist importer** syncing directly to SQLite.

---

## 🛠 Tech Stack

* **Framework**: [Next.js 16.2.10](https://nextjs.org/) (App Router, Turbopack)
* **Frontend Library**: [React 19](https://react.dev/)
* **Database Layer**: [LibSQL / SQLite Client](https://github.com/tursodatabase/libsql)
* **Styling**: Vanilla CSS with CSS Modules and CSS variables
* **Streaming Engine**: HLS.js video player integration

---

## ⚡ Scraper Architecture & Verification

The streaming route `/api/stream/[animeId]/[episodeId]` executes two independent scraper engines (Gogoanime & Animepahe).

### 🔍 Fast-Fail Domain Rotation
To bypass ISP bans and network timeouts:
1. **Mirror Rotation**: Iterates sequentially over unblocked mirrors (e.g. `anitaku.pe`, `gogoanime3.co`, `animepahe.pw`).
2. **Fast-Fail on Timeout**: If the first domain is blocked by your ISP, the request immediately fails-fast (within 3 seconds) and skips to the next mirror, preventing browser thread hangs.
3. **Local Test Stream**: If all mirror lookups fail or are blocked, the client safely falls back to a verified test stream.

### 🧪 Stream Verification Tool
A standalone integration test is included to resolve and verify streaming connections directly:
* **Verify Script**: `verify-onepiece-streams.js` fetches metadata from AniList for *One Piece* (Episode 1 and the latest episode), resolves them using the project's scraping engine, and outputs a static page.
* **Verification Page**: `verify-onepiece.html` allows you to play the HLS streams directly in your browser.

---

## 🚀 Getting Started

### 📦 Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### 🔨 Build and Compile
Compile the production Next.js bundle:
```bash
npm run build
```

### ▶ Start Application
Run the local production server:
```bash
npm run start
```
The server will boot on `http://localhost:3000`.

---

## 📜 License
Private repository. Built for personal educational purposes. All data fetched dynamically using the AniList API.
