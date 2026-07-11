const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const extractor = require("./services/extractor");

const root = __dirname;
const dataDir = path.join(root, "data");
const statePath = path.join(dataDir, "state.json");
const sourceMapPath = path.join(dataDir, "source-map.json");

const demoVideo = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const demoHls = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

// Rich data catalog seeding mirroring Anilist elements and screenshots detail
const seedTitles = [
  {
    id: "slime-s4",
    slug: "that-time-i-got-reincarnated-as-a-slime-season-4",
    title: "That Time I Got Reincarnated as a Slime Season 4",
    altTitle: "Tensei Shitara Slime Datta Ken 4th Season",
    season: "Spring 2026",
    type: "TV Show",
    status: "RELEASING",
    year: 2026,
    score: 8.2,
    episodeCount: 14,
    runtime: "24 min",
    source: "Light Novel",
    studio: "8-bit",
    tags: ["Isekai", "Action", "Adventure", "Comedy", "Fantasy"],
    synopsis: "The fourth season of Rimuru's story as Tempest negotiates a fragile balance between monsters, kingdoms, and the looming pressure of a larger war.",
    poster: { from: "#3ca7ff", to: "#0b1524", glow: "#7fd7ff" },
    intro: [86, 192],
    outro: [1330, 1440],
    servers: [
      { id: "aurora", label: "Aurora", quality: "1080p", url: demoHls, kind: "hls" },
      { id: "nova", label: "Nova", quality: "720p", url: demoVideo, kind: "mp4" }
    ],
    episodes: Array.from({ length: 14 }, (_, index) => ({
      id: index + 1,
      title: [
        "New Days",
        "The Dungeon Evolves",
        "The Avatar Team Is Formed",
        "Invitation",
        "The First Step",
        "The Council of the West",
        "The Mastermind's Identity",
        "The Groundwork of Greed",
        "Investigating the Ruins",
        "The Master of Greed",
        "Milim's Friend",
        "Tempest Evolves",
        "New Companions",
        "Black Numbers"
      ][index],
      views: ["201K", "101K", "105K", "140K", "167K", "209K", "214K", "236K", "227K", "215K", "204K", "181K", "128K", "118K"][index],
      released: ["3 months ago", "3 months ago", "3 months ago", "3 months ago", "2 months ago", "2 months ago", "2 months ago", "2 months ago", "1 month ago", "1 month ago", "3 weeks ago", "2 weeks ago", "1 week ago", "2 days ago"][index]
    })),
    related: ["mushoku-3", "overlord", "shield-hero", "rezero", "tsukimichi-2"]
  },
  {
    id: "mushoku-3",
    slug: "mushoku-tensei-jobless-reincarnation-season-3",
    title: "Mushoku Tensei: Jobless Reincarnation Season 3",
    altTitle: "Mushoku Tensei 3",
    season: "Winter 2025",
    type: "TV Show",
    status: "RELEASING",
    year: 2025,
    score: 8.7,
    episodeCount: 12,
    runtime: "25 min",
    source: "Light Novel",
    studio: "Studio Bind",
    tags: ["Adventure", "Drama", "Fantasy"],
    synopsis: "Rudeus keeps moving forward in a world that constantly demands a new version of him, with the family, the future, and the cost of growth all colliding at once.",
    poster: { from: "#6bc7ff", to: "#14223b", glow: "#d5f3ff" },
    intro: [92, 204],
    outro: [1330, 1440],
    servers: [
      { id: "aurora", label: "Aurora", quality: "1080p", url: demoHls, kind: "hls" }
    ],
    episodes: Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      title: [
        "The Return",
        "Crossroads",
        "Guild Contract",
        "The Promise",
        "A New Journey",
        "The Old Road",
        "Sands and Storms",
        "The Family Name",
        "Silver Threads",
        "The Sky Cart",
        "Departure",
        "The Oath"
      ][index],
      views: ["196K", "122K", "118K", "141K", "130K", "149K", "162K", "173K", "184K", "193K", "207K", "229K"][index],
      released: ["6 months ago", "6 months ago", "5 months ago", "5 months ago", "4 months ago", "4 months ago", "3 months ago", "2 months ago", "1 month ago", "3 weeks ago", "1 week ago", "today"][index]
    })),
    related: ["slime-s4", "overlord", "rezero", "shield-hero"]
  },
  {
    id: "one-piece",
    slug: "one-piece",
    title: "ONE PIECE",
    altTitle: "One Piece",
    season: "Ongoing",
    type: "TV Show",
    status: "RELEASING",
    year: 1999,
    score: 9.0,
    episodeCount: 1100,
    runtime: "24 min",
    source: "Manga",
    studio: "Toei Animation",
    tags: ["Adventure", "Action", "Comedy"],
    synopsis: "Luffy's voyage keeps expanding into stranger seas, bigger alliances, and impossible enemies while the world itself starts changing shape.",
    poster: { from: "#ffb347", to: "#2c1a12", glow: "#ffdca2" },
    intro: [78, 198],
    outro: [1320, 1440],
    servers: [
      { id: "aurora", label: "Aurora", quality: "1080p", url: demoHls, kind: "hls" }
    ],
    episodes: Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      title: `Episode ${index + 1}`,
      views: ["201K", "101K", "105K", "140K", "167K", "209K", "214K", "236K", "227K", "215K", "204K", "181K"][index],
      released: ["today", "3 days ago", "1 week ago", "2 weeks ago", "3 weeks ago", "1 month ago", "1 month ago", "2 months ago", "2 months ago", "3 months ago", "3 months ago", "4 months ago"][index]
    })),
    related: ["slime-s4", "mushoku-3", "overlord"]
  }
];

const seedUsers = [
  {
    id: "demo-user",
    username: "demo@asteria.local",
    displayName: "OmaiwaMuShindeiro",
    pronouns: "he/him",
    password: hashPassword("demo1234"),
    avatar: "",
    bio: "Ohayō! 🌞",
    settings: {
      theme: "midnight",
      autoplay: true,
      autoNext: true,
      autoSkip: true,
      quality: "Auto",
      captions: "English",
      softCc: true,
      minimizeOnBlur: false,
      pauseHistory: false,
      nsfwHidden: true
    },
    library: {
      "slime-s4": { status: "Watching", score: 82, progress: 0.58, currentEpisode: 8, start_date: "2026-05-23", end_date: "", rewatched: 0, notes: "Best Isekai!", list: "watching", server: "Aurora", quality: "1080p", caption: "English" },
      "mushoku-3": { status: "Plan to watch", score: 0, progress: 0, currentEpisode: 1, start_date: "", end_date: "", rewatched: 0, notes: "", list: "planning", server: "Aurora", quality: "1080p", caption: "English" }
    },
    favorites: ["slime-s4", "mushoku-3"],
    watchLater: ["mushoku-3"],
    history: [
      { titleId: "slime-s4", episode: 1, progress: 0.42, updatedAt: isoHoursAgo(1), server: "Aurora" }
    ],
    continueWatching: [
      { titleId: "slime-s4", episode: 8, progress: 0.42, updatedAt: isoHoursAgo(1) }
    ],
    devices: [
      { id: "dev-1", label: "Windows · Chrome", location: "SG", lastSeen: "current" },
      { id: "dev-2", label: "Windows · Chrome", location: "IN", lastSeen: "9d ago" }
    ],
    importLists: {
      planning: true,
      watching: true,
      on_hold: true,
      dropped: true,
      finished: true,
      rewatching: true
    }
  }
];

const seedComments = [
  { id: "c1", titleId: "slime-s4", username: "binchilin", body: "Im here just because Hianime got shut down 😭🙏", createdAt: isoMinutesAgo(8), episode: 14, likes: 69, replies: 4 }
];

const mediaAssets = {
  "slime-s4": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101280-tDxCVJm714nt.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101280-9t7J3774n955.jpg",
    color: "#5daef1"
  },
  "mushoku-3": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx108465-1ANspF1EWyFx.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/108465-RgsRpTMhP9Sv.jpg",
    color: "#43a1e4"
  },
  "one-piece": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg",
    color: "#e49335"
  }
};

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}
function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}
function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadState() {
  ensureDir(dataDir);
  if (!fs.existsSync(statePath)) {
    const seeded = {
      users: seedUsers,
      sessions: {},
      titles: enrichTitles(seedTitles),
      comments: seedComments,
      notifications: [
        { id: "n1", title: "Daemons of the Shadow Realm", body: "Episode 13 just got added!", createdAt: isoDaysAgo(7) },
        { id: "n2", title: "ONE PIECE", body: "Episode 1168 just got added!", createdAt: isoDaysAgo(13) }
      ],
      schedule: [
        { time: "04:00", title: "Ninjala the Animation", episode: "Ep 224" },
        { time: "05:00", title: "Pan no Akachan (TV)", episode: "Ep 2" },
        { time: "07:30", title: "Soul Land 2: The Peerless Tang Clan", episode: "Ep 161" }
      ]
    };
    fs.writeFileSync(statePath, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function enrichTitles(titles) {
  return titles.map((title) => {
    const asset = mediaAssets[title.id];
    if (!asset) return title;
    return {
      ...title,
      coverImage: asset.cover,
      bannerImage: asset.banner,
      poster: {
        ...title.poster,
        from: asset.color || title.poster.from
      }
    };
  });
}

let state = loadState();

function saveState() {
  ensureDir(dataDir);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf("=");
        const key = index >= 0 ? pair.slice(0, index) : pair;
        const value = index >= 0 ? decodeURIComponent(pair.slice(index + 1)) : "";
        return [key, value];
      })
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function send(res, statusCode, payload, headers = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": typeof payload === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Content-Length": Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

function setSessionCookie(token) {
  return `nexanime_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`;
}

function getCurrentUser(req) {
  const token = parseCookies(req.headers.cookie || "").nexanime_session;
  if (!token) return null;
  const session = state.sessions[token];
  if (!session) return null;
  return state.users.find((user) => user.id === session.userId) || null;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    pronouns: user.pronouns,
    avatar: user.avatar,
    bio: user.bio || "",
    settings: user.settings,
    favorites: user.favorites,
    watchLater: user.watchLater,
    history: user.history,
    continueWatching: user.continueWatching,
    devices: user.devices,
    importLists: user.importLists,
    library: user.library
  };
}

function findTitle(idOrSlug) {
  return state.titles.find((title) => title.id === idOrSlug || title.slug === idOrSlug);
}

function buildBootstrapFallback(user) {
  return {
    user: user ? publicUser(user) : null,
    titles: state.titles,
    comments: state.comments,
    notifications: state.notifications,
    schedule: state.schedule,
    home: {
      spotlight: state.titles[0],
      trending: [...state.titles].sort((a, b) => b.score - a.score).slice(0, 8),
      continueWatching: user ? user.continueWatching.map((entry) => ({ ...entry, title: findTitle(entry.titleId) })).filter((entry) => entry.title) : [],
      recommended: user ? state.titles.filter((title) => !user.favorites.includes(title.id)).slice(0, 8) : state.titles.slice(0, 8),
      upcoming: [],
      recentlyUpdated: []
    }
  };
}

async function fetchLiveBootstrapData(user) {
  const query = `
    query {
      trending: Page(page: 1, perPage: 12) {
        media(sort: TRENDING_DESC, type: ANIME) {
          id
          title { romaji english }
          coverImage { extraLarge color }
          bannerImage
          averageScore
          seasonYear
          format
          description
          genres
        }
      }
      popular: Page(page: 1, perPage: 12) {
        media(sort: POPULAR_DESC, type: ANIME) {
          id
          title { romaji english }
          coverImage { extraLarge color }
          bannerImage
          averageScore
          seasonYear
          format
          description
          genres
        }
      }
      upcoming: Page(page: 1, perPage: 8) {
        media(sort: POPULAR_DESC, status: NOT_YET_RELEASED, type: ANIME) {
          id
          title { romaji english }
          coverImage { extraLarge color }
          bannerImage
          averageScore
          seasonYear
          format
          description
          studios(isMain: true) { nodes { name } }
          genres
          source
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query })
    });
    if (response.ok) {
      const payload = await response.json();
      const data = payload?.data;
      
      const formatMedia = (m) => ({
        id: m.title.romaji.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        slug: m.title.romaji.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        title: m.title.english || m.title.romaji,
        altTitle: m.title.romaji,
        type: m.format === "TV" ? "TV Show" : (m.format || "TV Show"),
        season: m.seasonYear ? `Released ${m.seasonYear}` : "Unknown",
        year: m.seasonYear,
        score: (m.averageScore || 0) / 10,
        synopsis: m.description ? m.description.replace(/<[^>]*>/g, "") : "",
        coverImage: m.coverImage?.extraLarge || "",
        bannerImage: m.bannerImage || m.coverImage?.extraLarge || "",
        poster: {
          from: m.coverImage?.color || "#3ca7ff",
          to: "#0b1524",
          glow: m.coverImage?.color || "#7fd7ff"
        },
        tags: m.genres || ["Action", "Adventure"],
        studio: m.studios?.nodes?.[0]?.name || "Unknown",
        source: m.source || "Original",
        episodes: [{ id: 1, title: "Episode 1", views: "100K", released: "today" }]
      });

      const trendingList = (data?.trending?.media || []).map(formatMedia);
      const popularList = (data?.popular?.media || []).map(formatMedia);
      const upcomingList = (data?.upcoming?.media || []).map(formatMedia);

      // Scrape Gogoanime for actual recently updated episodes list
      const recentlyUpdatedScraped = await extractor.getRecentlyUpdated();
      const recentlyUpdatedList = recentlyUpdatedScraped.map(ep => {
        return {
          id: ep.id,
          episode: ep.episode,
          title: ep.title,
          coverImage: ep.coverImage,
          bannerImage: ep.coverImage,
          poster: { from: "#333", to: "#111" }
        };
      });

      // Cache all these dynamic titles in our server state titles list so client can lookup details on click!
      const allFetched = [...trendingList, ...popularList, ...upcomingList];
      allFetched.forEach(item => {
        if (!state.titles.some(t => t.id === item.id)) {
          state.titles.push(item);
        }
      });
      saveState();

      return {
        user: user ? publicUser(user) : null,
        titles: state.titles,
        comments: state.comments,
        notifications: state.notifications,
        schedule: state.schedule,
        home: {
          spotlight: trendingList[0] || state.titles[0],
          trending: trendingList.slice(0, 8),
          continueWatching: user ? user.continueWatching.map((entry) => ({ ...entry, title: findTitle(entry.titleId) })).filter((entry) => entry.title) : [],
          recommended: popularList.slice(0, 8),
          upcoming: upcomingList,
          recentlyUpdated: recentlyUpdatedList
        }
      };
    }
  } catch (err) {
    console.error("Live AniList bootstrap failed, falling back to static cache:", err.message);
  }

  // Fallback to static seed data
  return buildBootstrapFallback(user);
}

async function buildBootstrap(user) {
  return fetchLiveBootstrapData(user);
}

function updateUser(userId, updater) {
  const idx = state.users.findIndex((user) => user.id === userId);
  if (idx === -1) return null;
  const next = updater(JSON.parse(JSON.stringify(state.users[idx])));
  if (!next) return null;
  state.users[idx] = next;
  saveState();
  return next;
}

// CORS, Header-spoofing Streaming Proxy Endpoint
async function handleStreamProxy(req, res, url) {
  if (!url) return send(res, 400, "Missing url parameter.");
  try {
    const urlObj = new URL(url);
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://gogoanime3.co/",
      "Origin": "https://gogoanime3.co"
    };

    const client = urlObj.protocol === "https:" ? https : http;

    const proxyRequest = client.request(
      url,
      {
        method: req.method,
        headers: {
          ...req.headers,
          host: urlObj.host,
          connection: "keep-alive",
          referer: headers.Referer,
          origin: headers.Origin,
          "user-agent": headers["User-Agent"]
        }
      },
      (proxyResponse) => {
        // Intercept M3U8 files to rewrite absolute/relative paths to go through our proxy
        const contentType = proxyResponse.headers["content-type"] || "";
        if (contentType.includes("mpegurl") || contentType.includes("apple-mpegurl") || url.endsWith(".m3u8")) {
          let body = "";
          proxyResponse.on("data", (chunk) => {
            body += chunk;
          });
          proxyResponse.on("end", () => {
            // Rewrite lines containing HTTP endpoints or relative segments
            const lines = body.split("\n");
            const hostBase = url.substring(0, url.lastIndexOf("/") + 1);
            const rewritten = lines.map(line => {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith("#")) {
                let absoluteUrl = trimmed;
                if (!trimmed.startsWith("http")) {
                  absoluteUrl = trimmed.startsWith("/") ? `${urlObj.protocol}//${urlObj.host}${trimmed}` : `${hostBase}${trimmed}`;
                }
                return `http://localhost:${preferredPort}/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}`;
              }
              return line;
            }).join("\n");

            res.writeHead(200, {
              "Content-Type": "application/vnd.apple.mpegurl",
              "Access-Control-Allow-Origin": "*",
              "Content-Length": Buffer.byteLength(rewritten)
            });
            res.end(rewritten);
          });
        } else {
          // Stream raw media chunks directly (.ts segments or MP4 videos)
          res.writeHead(proxyResponse.statusCode, {
            ...proxyResponse.headers,
            "Access-Control-Allow-Origin": "*"
          });
          proxyResponse.pipe(res);
        }
      }
    );

    proxyRequest.on("error", (err) => {
      console.error("Stream Proxy Error:", err.message);
      send(res, 502, "Bad Gateway");
    });
    req.pipe(proxyRequest);
  } catch (err) {
    console.error("Invalid proxy URL:", err.message);
    send(res, 400, "Invalid URL format.");
  }
}

async function fetchAniListDetails(idOrSearch) {
  const isId = /^\d+$/.test(idOrSearch);
  const variables = isId ? { id: Number(idOrSearch) } : { search: idOrSearch };
  const query = `
    query ($id: Int, $search: String) {
      Media (id: $id, search: $search, type: ANIME) {
        id
        title { romaji english native }
        synonyms
        coverImage { extraLarge color }
        bannerImage
        season seasonYear
        status
        format
        episodes
        duration
        averageScore
        meanScore
        source
        description
        genres
        studios(isMain: true) { nodes { name } }
        tags { name }
        relations {
          edges {
            relationType
            node {
              id
              title { romaji english }
              coverImage { large }
              format
              seasonYear
            }
          }
        }
        characters(sort: [ROLE, RELEVANCE], perPage: 12) {
          edges {
            role
            node {
              name { full }
              image { large }
            }
            voiceActors(language: JAPANESE) {
              name { full }
              image { large }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) {
    throw new Error(`AniList details failed (${response.status})`);
  }
  const payload = await response.json();
  const media = payload?.data?.Media;
  if (!media) return null;

  return {
    id: String(media.id),
    slug: media.title.romaji.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    title: media.title.english || media.title.romaji,
    altTitle: media.title.romaji,
    nativeTitle: media.title.native || "",
    synonyms: media.synonyms || [],
    season: media.season && media.seasonYear ? `${media.season} ${media.seasonYear}` : "Unknown",
    type: media.format === "TV" ? "TV Show" : (media.format || "TV Show"),
    status: media.status || "RELEASING",
    year: media.seasonYear || null,
    score: (media.averageScore || 0) / 10,
    meanScore: (media.meanScore || 0) / 10,
    episodeCount: media.episodes || 0,
    runtime: media.duration ? `${media.duration} min` : "Unknown",
    source: media.source || "Original",
    studio: media.studios?.nodes?.[0]?.name || "Unknown",
    tags: media.genres || [],
    tagsList: (media.tags || []).slice(0, 10).map(t => t.name),
    synopsis: media.description ? media.description.replace(/<[^>]*>/g, "") : "",
    coverImage: media.coverImage?.extraLarge || "",
    bannerImage: media.bannerImage || media.coverImage?.extraLarge || "",
    poster: {
      from: media.coverImage?.color || "#3ca7ff",
      to: "#0b1524",
      glow: media.coverImage?.color || "#7fd7ff"
    },
    relations: (media.relations?.edges || []).map(e => ({
      relation: e.relationType,
      id: String(e.node.id),
      title: e.node.title.english || e.node.title.romaji,
      coverImage: e.node.coverImage?.large,
      type: e.node.format,
      year: e.node.seasonYear
    })),
    characters: (media.characters?.edges || []).map(e => ({
      role: e.role,
      name: e.node.name.full,
      image: e.node.image.large,
      actor: e.voiceActors?.[0] ? {
        name: e.voiceActors[0].name.full,
        image: e.voiceActors[0].image.large,
        language: "Japanese"
      } : null
    }))
  };
}

async function handleApi(req, res, pathname, searchParams) {
  const user = getCurrentUser(req);
  
  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const data = await buildBootstrap(user);
    return send(res, 200, data);
  }
  if (req.method === "GET" && pathname === "/api/me") {
    return send(res, 200, { user: publicUser(user) });
  }

  // Rich Details Retrieval API with dynamic scraper merging
  if (req.method === "GET" && pathname === "/api/anime/details") {
    const id = searchParams.get("id");
    if (!id) return send(res, 400, { error: "Missing anime id parameter." });

    let anime = state.titles.find(t => t.id === id || t.slug === id);
    if (!anime || !anime.characters) {
      try {
        const cleanSearch = id.replace(/-/g, " ");
        const enriched = await fetchAniListDetails(cleanSearch);
        if (enriched) {
          const episodes = await extractor.getEpisodes(id);
          enriched.id = id; // retain Gogoanime slug
          enriched.episodes = episodes.length ? episodes.map(ep => ({
            id: ep.episodeNum,
            title: `Episode ${ep.episodeNum}`,
            views: `${Math.floor(Math.random() * 150) + 50}K`,
            released: "scraped"
          })) : [
            { id: 1, title: "Episode 1", views: "100K", released: "today" }
          ];
          enriched.episodeCount = enriched.episodes.length;

          state.titles = state.titles.filter(t => t.id !== id);
          state.titles.push(enriched);
          saveState();
          anime = enriched;
        }
      } catch (err) {
        console.error("AniList details enrichment failed:", err.message);
        if (!anime) {
          // skeleton fallback
          anime = {
            id,
            title: id.replace(/-/g, " ").toUpperCase(),
            synopsis: "Details could not be enriched, but streams are ready.",
            episodes: [{ id: 1, title: "Episode 1", views: "100K", released: "today" }],
            tags: ["Anime"],
            score: 0,
            poster: { from: "#333", to: "#111" }
          };
        }
      }
    }
    return send(res, 200, { anime });
  }

  // Scraper Servers Search Endpoint
  if (req.method === "GET" && pathname === "/api/servers") {
    const anime = searchParams.get("anime") || "slime-s4";
    const ep = Number(searchParams.get("ep") || 1);
    
    // Find matching catalog anime to get its slug for scraping index
    const titleObj = findTitle(anime);
    const slug = titleObj ? titleObj.id : anime;
    
    const scraperServers = await extractor.getEpisodeServers(slug, ep);
    return send(res, 200, scraperServers);
  }

  // Extract Stream Details Endpoint
  if (req.method === "GET" && pathname === "/api/watch") {
    const serverName = searchParams.get("server") || "Vidstreaming";
    const embedUrl = searchParams.get("url") || "";
    
    if (!embedUrl) return send(res, 400, { error: "Missing embed URL." });
    
    const extraction = await extractor.extractStreamUrl(serverName, embedUrl);
    
    // Wrap target stream URL in our header-spoofing proxy to bypass CORS
    const proxiedUrl = `http://localhost:${preferredPort}/api/stream-proxy?url=${encodeURIComponent(extraction.stream_url)}`;
    
    return send(res, 200, {
      stream_url: proxiedUrl,
      type: extraction.type,
      subtitles: extraction.subtitles
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = JSON.parse(await readBody(req) || "{}");
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!username || !password) {
      return send(res, 400, { error: "Username and password are required." });
    }
    let account = state.users.find((entry) => entry.username.toLowerCase() === username);
    if (!account) {
      account = {
        id: crypto.randomUUID(),
        username: username,
        displayName: body.displayName || username.split("@")[0],
        pronouns: "he/him",
        password: hashPassword(password),
        avatar: "",
        bio: "Ohayō! 🌞",
        settings: {
          theme: "midnight", autoplay: true, autoNext: true, autoSkip: true, quality: "Auto", captions: "English", softCc: true
        },
        favorites: [],
        watchLater: [],
        history: [],
        continueWatching: [],
        devices: [{ id: crypto.randomUUID(), label: "Windows · Chrome", location: "SG", lastSeen: "current" }],
        importLists: { planning: true, watching: true, finished: true },
        library: {}
      };
      state.users.push(account);
    } else if (!verifyPassword(password, account.password)) {
      return send(res, 401, { error: "Invalid credentials." });
    }
    const token = crypto.randomUUID();
    state.sessions[token] = { userId: account.id, createdAt: new Date().toISOString() };
    saveState();
    return send(
      res,
      200,
      { user: publicUser(account) },
      { "Set-Cookie": setSessionCookie(token) }
    );
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const cookies = parseCookies(req.headers.cookie || "");
    if (cookies.nexanime_session) {
      delete state.sessions[cookies.nexanime_session];
      saveState();
    }
    return send(res, 200, { ok: true }, { "Set-Cookie": "nexanime_session=; Max-Age=0; Path=/; SameSite=Lax" });
  }

  if (req.method === "POST" && pathname === "/api/progress") {
    if (!user) return send(res, 401, { error: "Not signed in." });
    const body = JSON.parse(await readBody(req) || "{}");
    const title = findTitle(body.titleId);
    if (!title) return send(res, 404, { error: "Not found." });
    const episode = Number(body.episode || 1);
    const progress = Number(body.progress || 0);
    const next = updateUser(user.id, (draft) => {
      draft.history = [{ titleId: title.id, episode, progress, updatedAt: new Date().toISOString(), server: body.server || "Aurora" }, ...draft.history.filter((entry) => entry.titleId !== title.id)];
      draft.continueWatching = [{ titleId: title.id, episode, progress, updatedAt: new Date().toISOString() }, ...draft.continueWatching.filter((entry) => entry.titleId !== title.id)].slice(0, 20);
      draft.library[title.id] = {
        ...(draft.library[title.id] || { list: "watching", progress: 0, currentEpisode: 1, score: 0, rewatched: 0, notes: "", start_date: "", end_date: "" }),
        progress,
        currentEpisode: episode,
        status: body.status || "Watching",
        server: body.server || "Aurora"
      };
      return draft;
    });
    return send(res, 200, { user: publicUser(next) });
  }

  // Edit Library Item Details Endpoint (Modal Support)
  if (req.method === "PUT" && pathname === "/api/library") {
    if (!user) return send(res, 401, { error: "Not signed in." });
    const body = JSON.parse(await readBody(req) || "{}");
    const { titleId, status, score, currentEpisode, start_date, end_date, notes, rewatched } = body;
    const next = updateUser(user.id, (draft) => {
      draft.library[titleId] = {
        ...(draft.library[titleId] || { list: "watching", progress: 0, currentEpisode: 1, server: "Vidstreaming" }),
        status: status || "Plan to watch",
        list: status === "Plan to watch" ? "planning" : (status === "Finished" ? "finished" : "watching"),
        score: Number(score || 0),
        currentEpisode: Number(currentEpisode || 1),
        start_date: start_date || "",
        end_date: end_date || "",
        notes: notes || "",
        rewatched: Number(rewatched || 0)
      };
      return draft;
    });
    return send(res, 200, { user: publicUser(next) });
  }

  const favoriteMatch = pathname.match(/^\/api\/favorites\/([^/]+)$/);
  if (favoriteMatch && req.method === "POST") {
    if (!user) return send(res, 401, { error: "Not signed in." });
    const titleId = decodeURIComponent(favoriteMatch[1]);
    const next = updateUser(user.id, (draft) => {
      if (!draft.favorites.includes(titleId)) draft.favorites.unshift(titleId);
      return draft;
    });
    return send(res, 200, { user: publicUser(next) });
  }
  if (favoriteMatch && req.method === "DELETE") {
    if (!user) return send(res, 401, { error: "Not signed in." });
    const titleId = decodeURIComponent(favoriteMatch[1]);
    const next = updateUser(user.id, (draft) => {
      draft.favorites = draft.favorites.filter((item) => item !== titleId);
      return draft;
    });
    return send(res, 200, { user: publicUser(next) });
  }

  if (req.method === "PUT" && pathname === "/api/settings") {
    if (!user) return send(res, 401, { error: "Not signed in." });
    const body = JSON.parse(await readBody(req) || "{}");
    const next = updateUser(user.id, (draft) => {
      if (body.username) draft.username = String(body.username).trim().toLowerCase();
      if (body.displayName) draft.displayName = String(body.displayName);
      if (body.pronouns) draft.pronouns = String(body.pronouns);
      if (body.bio) draft.bio = String(body.bio);
      draft.settings = { ...draft.settings, ...body };
      return draft;
    });
    return send(res, 200, { user: publicUser(next) });
  }

  // Real AniList Watchlist Import and sync route
  if (req.method === "POST" && pathname === "/api/library/import") {
    if (!user) return send(res, 401, { error: "Not signed in." });
    const body = JSON.parse(await readBody(req) || "{}");
    const targetUsername = String(body.username || "").trim();
    if (!targetUsername) return send(res, 400, { error: "Anilist username is required." });

    const query = `
      query ($username: String) {
        MediaListCollection(userName: $username, type: ANIME) {
          lists {
            name
            status
            entries {
              score(format: POINT_100)
              progress
              repeat
              notes
              startedAt { year month day }
              completedAt { year month day }
              media {
                id
                title { romaji english }
                coverImage { extraLarge color }
                bannerImage
                format
                seasonYear
                description
                genres
                duration
                studios(isMain: true) { nodes { name } }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables: { username: targetUsername } })
      });
      if (!response.ok) throw new Error(`AniList returned status ${response.status}`);
      
      const payload = await response.json();
      const lists = payload?.data?.MediaListCollection?.lists || [];
      
      const next = updateUser(user.id, (draft) => {
        lists.forEach(list => {
          const statusMap = {
            "CURRENT": "Watching",
            "PLANNING": "Plan to watch",
            "COMPLETED": "Finished",
            "ON_HOLD": "On hold",
            "DROPPED": "Dropped",
            "REPEATING": "Watching"
          };
          const mappedStatus = statusMap[list.status] || "Plan to watch";
          
          list.entries.forEach(entry => {
            const m = entry.media;
            const titleId = m.title.romaji.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            
            draft.library[titleId] = {
              status: mappedStatus,
              list: list.status.toLowerCase(),
              score: entry.score || 0,
              currentEpisode: entry.progress || 1,
              start_date: entry.startedAt?.year ? `${entry.startedAt.year}-${String(entry.startedAt.month).padStart(2,"0")}-${String(entry.startedAt.day).padStart(2,"0")}` : "",
              end_date: entry.completedAt?.year ? `${entry.completedAt.year}-${String(entry.completedAt.month).padStart(2,"0")}-${String(entry.completedAt.day).padStart(2,"0")}` : "",
              notes: entry.notes || "",
              rewatched: entry.repeat || 0,
              server: "Vidstreaming",
              quality: "Auto",
              caption: "English"
            };

            const titleObj = {
              id: titleId,
              slug: titleId,
              title: m.title.english || m.title.romaji,
              altTitle: m.title.romaji,
              type: m.format === "TV" ? "TV Show" : (m.format || "TV Show"),
              season: m.seasonYear ? `Released ${m.seasonYear}` : "Unknown",
              year: m.seasonYear,
              score: m.averageScore ? m.averageScore / 10 : 0,
              synopsis: m.description ? m.description.replace(/<[^>]*>/g, "") : "",
              coverImage: m.coverImage?.extraLarge || "",
              bannerImage: m.bannerImage || m.coverImage?.extraLarge || "",
              poster: {
                from: m.coverImage?.color || "#3ca7ff",
                to: "#0b1524",
                glow: m.coverImage?.color || "#7fd7ff"
              },
              tags: m.genres || ["Action"],
              studio: m.studios?.nodes?.[0]?.name || "Unknown",
              source: "Manga",
              episodes: [{ id: 1, title: "Episode 1", views: "100K", released: "today" }]
            };

            if (!state.titles.some(t => t.id === titleObj.id)) {
              state.titles.push(titleObj);
            }
          });
        });
        return draft;
      });

      return send(res, 200, { user: publicUser(next) });
    } catch (err) {
      console.error("Anilist Import Error:", err.message);
      return send(res, 502, { error: `List sync failed: ${err.message}` });
    }
  }

  if (req.method === "POST" && pathname === "/api/comments") {
    if (!user) return send(res, 401, { error: "Not signed in." });
    const body = JSON.parse(await readBody(req) || "{}");
    const comment = {
      id: crypto.randomUUID(),
      titleId: body.titleId,
      username: user.displayName,
      body: String(body.body || "").slice(0, 500),
      createdAt: new Date().toISOString(),
      episode: Number(body.episode || 1),
      likes: 0,
      replies: 0
    };
    state.comments.unshift(comment);
    saveState();
    return send(res, 200, { comment });
  }

  return send(res, 404, { error: "Unknown API route." });
}

function mimeType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const body = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": mimeType(filePath), "Content-Length": body.length });
  res.end(body);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    // Intercept streaming proxy requests
    if (url.pathname === "/api/stream-proxy") {
      const targetUrl = url.searchParams.get("url");
      return handleStreamProxy(req, res, targetUrl);
    }
    
    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, res, url.pathname, url.searchParams);
    }
    if (url.pathname === "/") {
      return serveFile(res, path.join(root, "index.html")) || send(res, 404, "Not found");
    }
    const staticPath = path.join(root, url.pathname.replace(/^\/+/, ""));
    if (serveFile(res, staticPath)) return;
    send(res, 404, "Not found");
  } catch (error) {
    console.error(error);
    send(res, 500, { error: "Internal server error." });
  }
});

const preferredPort = Number(process.env.PORT || 3000);

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
}

async function startServer() {
  let port = preferredPort;
  while (port < preferredPort + 25) {
    try {
      await listenOnPort(port);
      console.log(`nexanime running at http://localhost:${port}`);
      return;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
      port += 1;
    }
  }
}

startServer().catch(console.error);
