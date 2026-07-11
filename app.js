const state = {
  bootstrap: null,
  route: "home",
  search: "",
  genre: "All",
  sort: "top",
  activeScheduleDay: "Sat Jul 11",
  detailsTab: "episodes",
  detailsLayout: "grid",
  detailsSort: "asc",
  settingsTab: "account",
  listFilter: "all",
  watchlistGenre: "All",
  watchlistYear: "All",
  watchlistFormat: "All",
  watchlistStatus: "All",
  titleId: null,
  activeHoverId: null,
  activeHoverTimer: null,
  spotlightIndex: 0,
  player: {
    server: "",
    quality: "Auto",
    caption: "English",
    autoplay: true,
    autoNext: true,
    autoSkip: true,
    softCc: true,
    hls: null,
    currentEpisode: 1,
    currentTime: 0,
    playing: false,
    serversList: [],
    loadingStream: false
  },
  miniPlayer: {
    active: false
  }
};

const els = {
  app: document.getElementById("app"),
  loader: document.getElementById("loader"),
  backdrop: document.getElementById("backdrop"),
  toastStack: document.getElementById("toastStack"),
  searchInput: document.getElementById("searchInput"),
  menuButton: document.getElementById("menuButton"),
  notifButton: document.getElementById("notifButton"),
  notifBadge: document.getElementById("notifBadge"),
  notifPopover: document.getElementById("notifPopover"),
  notifList: document.getElementById("notifList"),
  markAllReadBtn: document.getElementById("markAllReadBtn"),
  accountButton: document.getElementById("accountButton"),
  userMenuPopover: document.getElementById("userMenuPopover"),
  editLibraryModal: document.getElementById("editLibraryModal"),
  editLibForm: document.getElementById("editLibForm"),
  editLibTitle: document.getElementById("editLibTitle"),
  editLibPoster: document.getElementById("editLibPoster"),
  closeEditLibBtn: document.getElementById("closeEditLibBtn"),
  headerBreadcrumbs: document.getElementById("headerBreadcrumbs"),
  miniPlayer: document.getElementById("miniPlayer"),
  miniVideoPlayer: document.getElementById("miniVideoPlayer"),
  miniPlayerClose: document.getElementById("miniPlayerClose"),
  miniPlayerExpand: document.getElementById("miniPlayerExpand"),
  miniPlayerPlay: document.getElementById("miniPlayerPlay"),
  miniPlayerTime: document.getElementById("miniPlayerTime")
};

function api(path, options = {}) {
  return fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  }).then(async (response) => {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      throw new Error(payload && payload.error ? payload.error : `Request failed (${response.status})`);
    }
    return payload;
  });
}

function user() {
  return state.bootstrap?.user || null;
}

function titleById(id) {
  return state.bootstrap?.titles.find((entry) => entry.id === id || entry.slug === id) || null;
}

function currentLibraryEntry(titleId) {
  return user()?.library?.[titleId] || null;
}

function posterStyle(title) {
  if (!title) return "";
  const cover = title.coverImage ? `url("${title.coverImage}")` : "none";
  const banner = title.bannerImage ? `url("${title.bannerImage}")` : cover;
  return [
    `--poster-gradient: linear-gradient(155deg, ${title.poster?.from || "#333"}, ${title.poster?.to || "#111"})`,
    `--poster-image: ${cover}`,
    `--banner-image: ${banner}`,
    `--banner-gradient: linear-gradient(135deg, ${title.poster?.from || "#333"} 0%, ${title.poster?.to || "#111"} 55%, rgba(0,0,0,0.25) 100%)`
  ].join("; ");
}

function fmtDate(iso) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  els.toastStack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
  }, 2200);
  setTimeout(() => toast.remove(), 2800);
}

function toggleBackdrop(open) {
  els.backdrop.hidden = !open;
}

function openEditLibraryModal(titleId) {
  const titleObj = titleById(titleId);
  if (!titleObj) return;
  const entry = currentLibraryEntry(titleId) || {
    status: "Plan to watch",
    score: 0,
    currentEpisode: 1,
    start_date: "",
    end_date: "",
    rewatched: 0,
    notes: ""
  };

  els.editLibTitle.textContent = titleObj.title;
  els.editLibPoster.setAttribute("style", posterStyle(titleObj));
  els.editLibForm.elements["status"].value = entry.status;
  els.editLibForm.elements["start_date"].value = entry.start_date || "";
  els.editLibForm.elements["end_date"].value = entry.end_date || "";
  els.editLibForm.elements["score"].value = entry.score || 0;
  els.editLibForm.elements["currentEpisode"].value = entry.currentEpisode || 1;
  els.editLibForm.elements["rewatched"].value = entry.rewatched || 0;
  els.editLibForm.elements["notes"].value = entry.notes || "";
  
  els.editLibForm.dataset.titleId = titleId;

  els.editLibraryModal.style.display = "block";
  toggleBackdrop(true);
}

function closeEditLibraryModal() {
  els.editLibraryModal.style.display = "none";
  toggleBackdrop(false);
}

async function boot() {
  try {
    state.bootstrap = await api("/api/bootstrap");
    
    // Apply user theme preferences on boot
    const activeTheme = user()?.settings?.theme || "midnight";
    document.documentElement.setAttribute("data-theme", activeTheme);

    parseRoute();
    updateUnreadBadge();
    render();
    
    // Start automatic Spotlight slide rotation
    startSpotlightAutoplay();

    els.loader.classList.add("is-hidden");
  } catch (error) {
    els.loader.classList.add("is-hidden");
    showToast(error.message);
  }
}

function updateUnreadBadge() {
  const count = (state.bootstrap?.notifications || []).length;
  if (count > 0) {
    els.notifBadge.textContent = count;
    els.notifBadge.style.display = "grid";
  } else {
    els.notifBadge.style.display = "none";
  }
}

function parseRoute() {
  const hash = (location.hash || "#/home").replace(/^#\/?/, "");
  const [route, id, ep] = hash.split("/");
  state.route = route || "home";
  state.titleId = id || null;
  if (ep) {
    state.player.currentEpisode = Number(ep);
  }
}

function setBreadcrumbs() {
  els.headerBreadcrumbs.innerHTML = "";
  if (state.route === "watch" && state.titleId) {
    const titleObj = titleById(state.titleId);
    if (titleObj) {
      els.headerBreadcrumbs.innerHTML = `
        <span>&gt;</span>
        <a href="#/anime/${titleObj.id}" style="color: var(--text);">${titleObj.title}</a>
        <span>&gt;</span>
        <span style="color: var(--muted);">Episode ${state.player.currentEpisode}</span>
      `;
    }
  } else if (state.route === "anime" && state.titleId) {
    const titleObj = titleById(state.titleId);
    if (titleObj) {
      els.headerBreadcrumbs.innerHTML = `
        <span>&gt;</span>
        <span style="color: var(--muted);">${titleObj.title}</span>
      `;
    }
  } else if (state.route === "watchlist") {
    els.headerBreadcrumbs.innerHTML = `<span>&gt;</span> <span style="color: var(--text);">Watchlist</span>`;
  } else if (state.route === "profile") {
    els.headerBreadcrumbs.innerHTML = `<span>&gt;</span> <span style="color: var(--text);">Profile</span>`;
  } else if (state.route === "settings") {
    els.headerBreadcrumbs.innerHTML = `<span>&gt;</span> <span style="color: var(--text);">Settings</span>`;
  }
}

function render() {
  parseRoute();
  setBreadcrumbs();
  closePopovers();
  
  if (state.route === "watch" && state.titleId) {
    renderWatch();
  } else if (state.route === "anime" && state.titleId) {
    renderDetails();
  } else if (state.route === "watchlist") {
    renderWatchlist();
  } else if (state.route === "profile") {
    renderProfile();
  } else if (state.route === "settings") {
    renderSettings();
  } else {
    renderHome();
  }
  bindInteractions();
}

function closePopovers() {
  els.notifPopover.classList.add("hidden");
  els.userMenuPopover.classList.add("hidden");
}

let spotlightTimer = null;
function startSpotlightAutoplay() {
  clearInterval(spotlightTimer);
  spotlightTimer = setInterval(() => {
    if (state.route !== "home") return;
    const trending = state.bootstrap?.home?.trending || [];
    if (trending.length === 0) return;
    
    state.spotlightIndex = (state.spotlightIndex + 1) % Math.min(5, trending.length);
    state.bootstrap.home.spotlight = trending[state.spotlightIndex];
    render();
  }, 7000);
}

/* ==========================================================================
   PAGE RENDERERS
   ========================================================================== */

function renderHome() {
  const trending = state.bootstrap.home.trending;
  const spotlight = state.bootstrap.home.spotlight || trending[0];
  const recommended = state.bootstrap.home.recommended;
  const upcoming = state.bootstrap.home.upcoming || [];
  const recentlyUpdated = state.bootstrap.home.recentlyUpdated || [];
  const continueWatching = state.bootstrap.home.continueWatching || [];
  const comments = state.bootstrap.comments.slice(0, 4);

  // Search Results Scraper query integration
  let searchedCatalog = state.bootstrap.titles;
  if (state.search.trim()) {
    searchedCatalog = state.bootstrap.titles.filter(title => 
      title.title.toLowerCase().includes(state.search.toLowerCase())
    );
  }

  // Spotlight Carousel Dot indicators
  const dotsHTML = trending.slice(0, 5).map((t, idx) => `
    <button class="carousel-dot ${spotlight.id === t.id ? "active" : ""}" data-spotlight-dot="${idx}" style="width:10px; height:10px; border-radius:50%; border:1px solid var(--border-strong); background: ${spotlight.id === t.id ? "var(--accent)" : "rgba(255,255,255,0.2)"}; padding:0; cursor:pointer; transition:background 120ms;"></button>
  `).join("");

  els.app.innerHTML = `
    <section class="view layout-home">
      <!-- Spotlight Hero (Full Width Overhaul) -->
      <div class="hero" style="grid-template-columns: 1fr; min-height: 52vh;">
        <article class="hero-main" style="${posterStyle(spotlight)}">
          <div class="hero-backdrop"></div>
          <div class="hero-content" style="max-width: 900px;">
            <div class="eyebrow">SPOTLIGHT</div>
            <h1 style="font-size: clamp(2.4rem, 5vw, 4.2rem); max-width: 25ch;">${spotlight.title}</h1>
            <div class="pill-row">
              <span class="pill">${spotlight.type}</span>
              <span class="rating-pill">★ ${spotlight.score.toFixed(1)}</span>
              <span class="pill">${spotlight.runtime}</span>
              <span class="pill">${spotlight.season}</span>
            </div>
            <p style="font-size:0.92rem; max-width:680px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${spotlight.synopsis}</p>
            <div class="hero-actions">
              <a class="primary-button" href="#/watch/${spotlight.id}/1"><span style="margin-right:4px;">▶</span> Watch Now</a>
              <a class="secondary-button" href="#/anime/${spotlight.id}">Details</a>
            </div>
          </div>
        </article>
      </div>

      <!-- Carousel indicators dots -->
      <div class="carousel-dots-row" style="display:flex; justify-content:center; gap:8px; margin-top:-24px; margin-bottom:24px; position:relative; z-index:3;">
        ${dotsHTML}
      </div>

      <!-- Dive Back In (Continue Watching) -->
      ${continueWatching.length > 0 ? `
      <section class="section">
        <div class="section-heading">
          <h2>Dive Back In</h2>
        </div>
        <div class="rail">
          ${continueWatching.map(item => `
            <article class="media-card" style="display:flex; flex-direction:column; gap:8px;">
              <div class="poster" style="${posterStyle(item.title)}; aspect-ratio:16/9; position:relative; min-height:unset; border-radius:10px;">
                <a href="#/watch/${item.titleId}/${item.episode}" style="position:absolute; inset:0; z-index:2;"></a>
                <span class="mini-player-time" style="position:absolute; bottom:8px; right:8px; z-index:3;">Ep ${item.episode}</span>
                <div class="progress-bar" style="position:absolute; bottom:0; left:0; right:0; height:4px; border-radius:0; z-index:3;">
                  <div class="progress-fill" style="width: ${Math.round(item.progress * 100)}%"></div>
                </div>
              </div>
              <strong style="font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${item.title.title}</strong>
            </article>
          `).join("")}
        </div>
      </section>
      ` : ""}

      <!-- Recently Updated Rail -->
      ${recentlyUpdated.length > 0 ? `
      <section class="section">
        <div class="section-heading">
          <h2>Recently Updated</h2>
        </div>
        <div class="rail">
          ${recentlyUpdated.map(ep => `
            <article class="media-card" style="display:flex; flex-direction:column; gap:8px;">
              <div class="poster" style="background: url('${ep.coverImage}') center/cover no-repeat; aspect-ratio:16/9; position:relative; min-height:unset; border-radius:10px;">
                <a href="#/watch/${ep.id}/${ep.episode}" style="position:absolute; inset:0; z-index:2;"></a>
                <span class="mini-player-time" style="position:absolute; bottom:8px; right:8px; z-index:3; background: var(--accent); color: #000; font-weight:700;">Episode ${ep.episode}</span>
              </div>
              <strong style="font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; color:var(--text);">${ep.title}</strong>
            </article>
          `).join("")}
        </div>
      </section>
      ` : ""}

      <!-- Trending Section & Main Split Layout -->
      <section class="section">
        <div class="layout-profile" style="grid-template-columns: 1fr 340px;">
          <!-- Trending Grid & Tabs -->
          <div class="panel" style="background:transparent; border:0; box-shadow:none; padding:0;">
            <div class="section-heading" style="margin-bottom:12px;">
              <h2>Trending Now</h2>
            </div>
            <div class="tabs" style="margin-bottom: 16px;">
              <button class="tab-button active">This Season</button>
              <button class="tab-button">All Time Popular</button>
              <button class="tab-button">Top Rated</button>
            </div>
            <div class="row" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:16px;">
              ${trending.map(title => cardHTML(title)).join("")}
            </div>

            <!-- Top Upcoming Grid Section -->
            ${upcoming.length > 0 ? `
            <div style="margin-top: 36px;">
              <div class="section-heading" style="margin-bottom:12px;">
                <h2>Top Upcoming</h2>
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
                ${upcoming.map(title => `
                  <div class="related-card" style="display:flex; gap:12px; padding:12px; background:rgba(255,255,255,0.02); border-radius:10px;">
                    <div class="poster" style="${posterStyle(title)}; width:82px; height:110px; min-height:unset; flex-shrink:0; border-radius:6px;">
                      <a href="#/anime/${title.id}" style="position:absolute; inset:0; z-index:2;"></a>
                    </div>
                    <div style="display:flex; flex-direction:column; justify-content:space-between; overflow:hidden;">
                      <div>
                        <strong style="font-size:0.86rem; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${title.title}</strong>
                        <span class="subtle" style="font-size:0.75rem; margin-top:2px; display:block;">Source: ${title.source} · Studio: ${title.studio}</span>
                      </div>
                      <p style="font-size:0.76rem; color:var(--muted); margin:4px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height:1.35;">${title.synopsis}</p>
                      <div class="pill-row" style="gap:4px;">
                        ${title.tags.slice(0, 2).map(t => `<span class="tiny-pill" style="font-size:0.68rem; padding:2px 6px;">${t}</span>`).join("")}
                      </div>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
            ` : ""}

            <!-- Browse Library -->
            <div style="margin-top: 36px;">
              <div class="section-heading" style="margin-bottom:12px;">
                <h2>Browse Library</h2>
              </div>
              <div class="tabs" style="margin-bottom:12px; gap:8px;">
                ${["All", "Isekai", "Action", "Adventure", "Comedy", "Fantasy", "Drama"].map(tag => `
                  <button class="tab-button ${state.genre === tag ? "active" : ""}" data-genre-btn="${tag}">${tag}</button>
                `).join("")}
              </div>
              <div class="row" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:16px;">
                ${searchedCatalog.filter(t => state.genre === "All" || t.tags.includes(state.genre)).map(title => cardHTML(title)).join("") || `<div class="subtle">No matches found in library.</div>`}
              </div>
            </div>
          </div>

          <!-- Sidebar Comments & Schedule Calendar -->
          <aside class="sidebar">
            <div class="panel">
              <div class="up-next-header">Recent Comments</div>
              <div class="comment-list" style="max-height: 380px; overflow-y:auto; gap:12px;">
                ${comments.map(c => `
                  <div class="comment-card" style="padding: 10px; background: rgba(255,255,255,0.02);">
                    <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--muted); margin-bottom:6px;">
                      <strong>${c.username}</strong>
                      <span>${timeAgo(c.createdAt)}</span>
                    </div>
                    <div style="font-size:0.86rem; line-height:1.4;">${c.body}</div>
                  </div>
                `).join("")}
              </div>
            </div>

            <!-- Estimated Weekly Schedule Tabs -->
            <div class="panel">
              <div class="up-next-header">Estimated Airing Schedule</div>
              <div class="tabs" style="margin-bottom:12px; gap:6px; overflow-x:auto; flex-wrap:nowrap; padding-bottom:6px;">
                ${["Thu Jul 9", "Fri Jul 10", "Sat Jul 11", "Sun Jul 12", "Mon Jul 13"].map(day => `
                  <button class="tab-button ${state.activeScheduleDay === day ? "active" : ""}" data-schedule-day="${day}" style="padding:6px 10px; font-size:0.78rem; white-space:nowrap;">${day}</button>
                `).join("")}
              </div>
              <div class="schedule-list" style="display:grid; gap:8px;" id="scheduleContainer">
                ${scheduleHTML(state.activeScheduleDay)}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </section>
  `;
}

function scheduleHTML(day) {
  const scheduleData = {
    "Thu Jul 9": [
      { time: "04:00", title: "Ninjala the Animation", episode: "Ep 224" },
      { time: "14:00", title: "Ascendance of a Bookworm", episode: "Ep 13" }
    ],
    "Fri Jul 10": [
      { time: "05:00", title: "Pan no Akachan (TV)", episode: "Ep 2" },
      { time: "14:56", title: "Welcome to Demon School! Iruma-kun", episode: "Ep 15" }
    ],
    "Sat Jul 11": [
      { time: "07:30", title: "Soul Land 2: The Peerless Tang Clan", episode: "Ep 161" },
      { time: "18:00", title: "Chainsmoker Cat", episode: "Ep 2" },
      { time: "23:00", title: "That Time I Got Reincarnated S4", episode: "Ep 14" }
    ],
    "Sun Jul 12": [
      { time: "09:30", title: "One Piece", episode: "Ep 1101" }
    ],
    "Mon Jul 13": [
      { time: "02:00", title: "A Letter From The Past", episode: "Ep 5" }
    ]
  };
  const list = scheduleData[day] || [];
  return list.map(s => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; font-size:0.84rem;">
      <div>
        <strong style="color:var(--accent); margin-right:8px;">${s.time}</strong>
        <span>${s.title}</span>
      </div>
      <span class="tiny-pill">${s.episode}</span>
    </div>
  `).join("") || `<div class="subtle">No schedules listed.</div>`;
}

async function renderDetails() {
  els.app.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; min-height:40vh;">
      <div class="player-loading-badge">Enriching anime specifications from databases...</div>
    </div>
  `;

  try {
    const res = await api(`/api/anime/details?id=${state.titleId}`);
    const titleObj = res.anime;
    
    if (!titleById(titleObj.id)) {
      state.bootstrap.titles.push(titleObj);
    }

    const libraryEntry = currentLibraryEntry(titleObj.id) || {};

    const tabsList = `
      <div class="tabs" style="border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:16px;">
        <button class="tab-button ${state.detailsTab === "episodes" ? "active" : ""}" data-details-tab-sel="episodes">Episodes</button>
        <button class="tab-button ${state.detailsTab === "characters" ? "active" : ""}" data-details-tab-sel="characters">Characters</button>
        <button class="tab-button ${state.detailsTab === "related" ? "active" : ""}" data-details-tab-sel="related">Related</button>
        <button class="tab-button ${state.detailsTab === "more" ? "active" : ""}" data-details-tab-sel="more">More like this</button>
      </div>
    `;

    let activeTabContent = "";
    if (state.detailsTab === "episodes") {
      const sortedEps = [...titleObj.episodes].sort((a,b) => 
        state.detailsSort === "asc" ? a.id - b.id : b.id - a.id
      );
      
      const gridLayout = sortedEps.map(ep => `
        <a href="#/watch/${titleObj.id}/${ep.id}" class="episode-card" style="display:flex; flex-direction:column; gap:8px; padding:10px; text-decoration:none;">
          <div class="poster" style="${posterStyle(titleObj)}; aspect-ratio:16/9; min-height:unset; border-radius:8px; position:relative;">
            <span class="mini-player-time" style="position:absolute; bottom:6px; left:6px; font-size:0.75rem; background:rgba(0,0,0,0.6); padding:2px 4px; border-radius:4px;">Ep ${ep.id}</span>
            <span class="mini-player-time" style="position:absolute; bottom:6px; right:6px; font-size:0.75rem; background:rgba(0,0,0,0.6); padding:2px 4px; border-radius:4px;">👁 ${ep.views}</span>
          </div>
          <strong style="font-size:0.86rem; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ep.title}</strong>
        </a>
      `).join("");

      activeTabContent = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span class="subtle" style="font-size:0.88rem;">${titleObj.episodes.length} Episodes available</span>
          <div style="display:flex; gap:8px;">
            <button class="ghost-button" id="detailsSortBtn" style="padding:6px 12px; font-size:0.8rem;">Sort: ${state.detailsSort === "asc" ? "0-1" : "1-0"}</button>
          </div>
        </div>
        <div class="episode-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:12px;">
          ${gridLayout}
        </div>
      `;
    } else if (state.detailsTab === "characters") {
      activeTabContent = `
        <div class="row" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
          ${(titleObj.characters || []).map(c => `
            <div class="character-actor-card">
              <div class="char-part">
                <img class="char-avatar" src="${c.image}" alt="${c.name}"/>
                <div>
                  <strong style="font-size:0.84rem; display:block; color:var(--text);">${c.name}</strong>
                  <span class="subtle" style="font-size:0.74rem;">${c.role}</span>
                </div>
              </div>
              ${c.actor ? `
                <div class="actor-part">
                  <div>
                    <strong style="font-size:0.84rem; display:block; color:var(--text);">${c.actor.name}</strong>
                    <span class="subtle" style="font-size:0.74rem;">JP VA</span>
                  </div>
                  <img class="actor-avatar" src="${c.actor.image}" alt="${c.actor.name}"/>
                </div>
              ` : `
                <div class="actor-part subtle" style="font-size:0.76rem;">No voice actor listed</div>
              `}
            </div>
          `).join("") || `<div class="subtle">No characters data found.</div>`}
        </div>
      `;
    } else if (state.detailsTab === "related") {
      activeTabContent = `
        <div class="row" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:16px;">
          ${(titleObj.relations || []).map(rel => `
            <div class="media-card" style="display:flex; flex-direction:column; gap:8px;">
              <div class="poster" style="background: url('${rel.coverImage}') center/cover no-repeat; aspect-ratio:3/4; border-radius:8px; position:relative;">
                <span class="mini-player-time" style="position:absolute; top:6px; left:6px; background:var(--danger); border-radius:4px; font-size:0.7rem; padding:2px 4px;">${rel.relation}</span>
              </div>
              <strong style="font-size:0.86rem; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${rel.title}</strong>
              <span class="subtle" style="font-size:0.76rem;">${rel.type} · ${rel.year || ""}</span>
            </div>
          `).join("") || `<div class="subtle">No related entries.</div>`}
        </div>
      `;
    } else if (state.detailsTab === "more") {
      activeTabContent = `
        <div class="row" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:16px;">
          ${relatedTitles(titleObj).map(title => cardHTML(title)).join("") || `<div class="subtle">No recommendations listed.</div>`}
        </div>
      `;
    }

    els.app.innerHTML = `
      <section class="view" style="grid-template-columns: 280px 1fr; gap:24px;">
        <!-- Left Specifications column -->
        <aside class="sidebar">
          <div class="panel" style="${posterStyle(titleObj)}; border-radius:12px; padding:16px; margin-bottom:12px;">
            <div class="poster" style="aspect-ratio:3/4; border-radius:8px;"></div>
            <div style="margin-top:14px; display:grid; gap:8px;">
              <span class="status-pill good" style="font-size:0.82rem; width:100%; border-radius:8px;">${titleObj.status}</span>
              <a class="primary-button" href="#/watch/${titleObj.id}/1" style="width:100%; border-radius:8px; padding:10px;">▶ Watch Now</a>
              <button class="secondary-button" id="detailsSaveBtn" data-title-id="${titleObj.id}" style="width:100%; border-radius:8px; padding:10px;">Save to Library</button>
            </div>
          </div>

          <!-- Detail Lists specifications sidebar -->
          <div class="panel" style="padding:16px; display:grid; gap:12px;">
            <div class="up-next-header">Specifications</div>
            <div style="font-size:0.86rem; display:grid; gap:8px;">
              <div><span class="subtle">Format:</span> <span>${titleObj.type}</span></div>
              <div><span class="subtle">Episodes:</span> <span>${titleObj.episodeCount}</span></div>
              <div><span class="subtle">Duration:</span> <span>${titleObj.runtime}</span></div>
              <div><span class="subtle">Average Score:</span> <span>${titleObj.score.toFixed(1)} / 10</span></div>
              <div><span class="subtle">Source:</span> <span>${titleObj.source}</span></div>
              <div><span class="subtle">Studio:</span> <span>${titleObj.studio}</span></div>
            </div>
            
            <div class="up-next-header" style="margin-top:8px;">Title Variants</div>
            <div style="font-size:0.82rem; display:grid; gap:8px;">
              <div><span class="subtle">English:</span> <span>${titleObj.title}</span></div>
              <div><span class="subtle">Romaji:</span> <span>${titleObj.altTitle}</span></div>
              <div><span class="subtle">Native:</span> <span>${titleObj.nativeTitle || ""}</span></div>
            </div>
          </div>
        </aside>

        <!-- Right Specifications column -->
        <div>
          <!-- Title details & banner backdrop header -->
          <div class="panel" style="${posterStyle(titleObj)}; position:relative; overflow:hidden; border-radius:12px; padding:24px; min-height:220px; display:flex; flex-direction:column; justify-content:flex-end;">
            <div class="hero-backdrop" style="opacity:0.35;"></div>
            <div style="position:relative; z-index:2;">
              <h1 style="font-family:'Fraunces', Georgia, serif; font-size:2.4rem; margin:0;">${titleObj.title}</h1>
              <div class="pill-row" style="margin-top:12px;">
                ${titleObj.tags.map(t => `<span class="pill" style="background:rgba(255,255,255,0.06);">${t}</span>`).join("")}
              </div>
            </div>
          </div>

          <!-- Description details -->
          <div class="panel" style="margin-top:16px; padding:20px;">
            <div class="up-next-header">Synopsis</div>
            <p style="font-size:0.92rem; line-height:1.6; color:var(--text); margin-top:8px;">${titleObj.synopsis}</p>
          </div>

          <!-- Tabs menu list -->
          <div style="margin-top:18px;">
            ${tabsList}
            <div id="detailsTabContent">
              ${activeTabContent}
            </div>
          </div>
        </div>
      </section>
    `;

    document.querySelectorAll("[data-details-tab-sel]").forEach(btn => {
      btn.onclick = () => {
        state.detailsTab = btn.dataset.detailsTabSel;
        renderDetails();
      };
    });

    const detailsSortBtn = document.getElementById("detailsSortBtn");
    if (detailsSortBtn) {
      detailsSortBtn.onclick = () => {
        state.detailsSort = state.detailsSort === "asc" ? "desc" : "asc";
        renderDetails();
      };
    }

    const detailsSaveBtn = document.getElementById("detailsSaveBtn");
    if (detailsSaveBtn) {
      detailsSaveBtn.onclick = () => {
        if (!user()) {
          showToast("Please sign in to save your library.");
          return;
        }
        openEditLibraryModal(titleObj.id);
      };
    }

  } catch (err) {
    els.app.innerHTML = `
      <div class="panel" style="padding:24px; text-align:center;">
        <h3 class="danger">Database error loading specifications</h3>
        <p>${err.message}</p>
        <a class="primary-button" href="#/home" style="margin-top:12px;">Return home</a>
      </div>
    `;
  }
}

function renderWatch() {
  const titleObj = titleById(state.titleId);
  if (!titleObj) return;

  const currentEp = selectedEpisode();
  const libraryEntry = currentLibraryEntry(state.titleId) || {};
  
  // Scraped servers details
  const serverOptions = state.player.serversList.map(srv => `
    <button class="tab-button ${state.player.server === srv.server_name ? "active" : ""}" data-player-server="${srv.server_name}" data-embed-url="${srv.embed_url}" type="button">${srv.server_name}</button>
  `).join("") || `<span class="subtle">Searching public scrapers...</span>`;

  const qualityOptions = ["Auto", "1080p", "720p", "480p"].map(q => `
    <button class="chip-button ${state.player.quality === q ? "active" : ""}" data-player-quality="${q}" type="button">${q}</button>
  `).join("");

  const captionOptions = ["English", "Hindi", "Off"].map(c => `
    <button class="chip-button ${state.player.caption === c ? "active" : ""}" data-player-caption="${c}" type="button">${c}</button>
  `).join("");

  els.app.innerHTML = `
    <section class="view layout-watch" style="grid-template-columns: minmax(0, 1fr) 340px; gap: 20px;">
      <!-- Main Playback Column -->
      <div>
        <!-- Video Player Wrapper -->
        <div class="player-card" style="${posterStyle(titleObj)}">
          <div class="player-frame ${state.player.loadingStream ? "is-loading" : ""}" id="videoFrame" style="aspect-ratio: 16/9; min-height: unset; height: auto;">
            <video id="videoPlayer" playsinline preload="auto"></video>
            
            <div class="player-loading">
              <div class="player-loading-badge">STREAMING</div>
              <div class="player-loading-text">${state.player.loadingStream ? "Extracting direct video links..." : "Initialising Video Player..."}</div>
            </div>
            
            <div class="subtitle-layer" id="subtitleLayer" style="display:none;"></div>
          </div>

          <!-- Video Playback Controls Bar (Overlay on hover) -->
          <div class="player-controls">
            <div class="player-row space">
              <div class="player-row">
                <button class="primary-button" id="playBtn" type="button">▶ Play</button>
                <button class="ghost-button" id="seekBackBtn" type="button">-10s</button>
                <button class="ghost-button" id="seekForwardBtn" type="button">+10s</button>
                <button class="ghost-button" id="prevEpBtn" type="button">Prev</button>
                <button class="ghost-button" id="nextEpBtn" type="button">Next</button>
              </div>
              <div class="player-row">
                <span class="tiny-pill" id="timeLabel" style="font-family: monospace;">0:00 / 0:00</span>
                <span class="tiny-pill" style="background:var(--accent-2); color:#fff;">Episode ${state.player.currentEpisode}</span>
              </div>
            </div>

            <!-- Seekbar track -->
            <div class="timeline" style="margin-top:6px;">
              <input id="seekbar" class="seekbar" type="range" min="0" max="1000" value="0" />
            </div>

            <!-- Settings Selector Bars -->
            <div style="display:grid; gap:8px; margin-top:8px;">
              <div class="player-row"><span class="subtle" style="font-size:0.8rem; width:64px;">Server:</span> ${serverOptions}</div>
              <div class="player-row"><span class="subtle" style="font-size:0.8rem; width:64px;">Quality:</span> ${qualityOptions}</div>
              <div class="player-row"><span class="subtle" style="font-size:0.8rem; width:64px;">Captions:</span> ${captionOptions}</div>
            </div>

            <div class="player-row space" style="border-top:1px solid rgba(255,255,255,0.06); padding-top:10px; margin-top:10px;">
              <div class="pill-row">
                <button class="chip-button" data-play-setting="autoplay" aria-pressed="${state.player.autoplay}">Auto play</button>
                <button class="chip-button" data-play-setting="autoNext" aria-pressed="${state.player.autoNext}">Auto next</button>
                <button class="chip-button" data-play-setting="autoSkip" aria-pressed="${state.player.autoSkip}">Auto skip</button>
                <button class="chip-button" data-play-setting="softCc" aria-pressed="${state.player.softCc}">Soft CC</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Orange server alert warning banner -->
        <div class="alert-banner" id="serverAlert">
          <span>⚠️ If the current server doesn't work, feel free to try other available scraper servers.</span>
          <button onclick="document.getElementById('serverAlert').style.display='none'">&times;</button>
        </div>

        <!-- Title, Sync and Actions Row -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:18px;">
          <div>
            <h1 style="font-size:1.8rem; margin:0;">${currentEp ? currentEp.title : `Episode ${state.player.currentEpisode}`}</h1>
            <a href="#/anime/${titleObj.id}" style="color:var(--accent); font-size:0.9rem; text-decoration:underline;">${titleObj.title} (Specifications Page)</a>
          </div>
          <div class="player-row">
            <button class="secondary-button" id="watchSyncBtn" data-title-id="${titleObj.id}" type="button">${libraryEntry.status || "Save to Library"}</button>
            <button class="secondary-button" id="shareBtn" type="button">Share</button>
            <button class="secondary-button" id="reportBtn" type="button">Report</button>
          </div>
        </div>

        <!-- Description Details Card -->
        <div class="panel" style="margin-top:24px; background: rgba(39, 214, 212, 0.04); border-color: rgba(39, 214, 212, 0.12);">
          <strong style="color:var(--accent);">Description Details</strong>
          <p style="font-size:0.92rem; line-height:1.6; margin-top:8px;">${titleObj.synopsis}</p>
          <div class="pill-row" style="margin-top:12px;">
            ${titleObj.tags.map(t => `<span class="pill">${t}</span>`).join("")}
          </div>
        </div>

        <!-- Comments Section -->
        <div class="panel" style="margin-top:24px;">
          <div class="up-next-header" style="font-size:1.2rem;">Comments</div>
          <form id="commentForm" class="settings-form" style="margin-top:12px;">
            <textarea class="field" name="body" placeholder="Which character stood out the most this episode?" required style="border-radius:12px; min-height:80px;"></textarea>
            <div style="display:flex; justify-content:flex-end;">
              <button class="primary-button" type="submit">Post comment</button>
            </div>
          </form>

          <div class="comment-list" style="margin-top:20px; display:grid; gap:16px;">
            ${commentsFor(titleObj.id).map(c => `
              <div class="comment-card" style="padding:14px; background:rgba(255,255,255,0.02); border-radius:10px;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--muted); margin-bottom:8px;">
                  <strong>${c.username}</strong>
                  <span>${timeAgo(c.createdAt)}</span>
                </div>
                <div style="font-size:0.92rem; line-height:1.4;">${c.body}</div>
              </div>
            `).join("") || `<div class="subtle">Be the first to comment!</div>`}
          </div>
        </div>
      </div>

      <!-- Right Sidebar (Up Next / Episode Selection) -->
      <aside class="sidebar">
        <div class="panel watch-side-panel">
          <div class="up-next-header">Up Next</div>
          
          <div class="sidebar-search-row">
            <input type="text" id="epSearchInput" placeholder="Search Episode..." />
          </div>

          <div class="episode-grid" style="display:grid; grid-template-columns:1fr; gap:8px; max-height:480px; overflow-y:auto; padding-right:4px;">
            ${titleObj.episodes.map(ep => `
              <a href="#/watch/${titleObj.id}/${ep.id}" class="episode-card ${ep.id === state.player.currentEpisode ? "active" : ""}" style="display:flex; justify-content:space-between; align-items:center; border-radius:8px; padding:10px; border: 1px solid var(--border); text-decoration:none;">
                <div>
                  <strong>Ep ${ep.id}</strong>
                  <div class="subtle" style="font-size:0.76rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ep.title}</div>
                </div>
                <span class="tiny-pill" style="font-size:0.75rem;">${ep.views}</span>
              </a>
            `).join("")}
          </div>
        </div>

        <!-- Airing Banner -->
        <div style="background: rgba(37, 223, 154, 0.08); border: 1px solid rgba(37, 223, 154, 0.2); padding: 12px 16px; border-radius:12px; display:flex; align-items:center; gap:10px; color:#d6ffe7; font-size:0.88rem;">
          <span>🔔</span>
          <strong>Next ep airing in 6 days</strong>
        </div>

        <!-- Recommendations column -->
        <div class="panel">
          <div class="up-next-header">More Like This</div>
          <div class="comment-list" style="gap:10px;">
            ${relatedTitles(titleObj).map(title => `
              <a href="#/anime/${title.id}" style="display:flex; gap:12px; text-decoration:none; background:rgba(255,255,255,0.01); border-radius:8px; padding:6px; border:1px solid transparent; transition:border-color 150ms;">
                <div class="poster" style="${posterStyle(title)}; width:52px; height:68px; aspect-ratio:unset; border-radius:6px; min-height:unset; flex-shrink:0;"></div>
                <div style="display:flex; flex-direction:column; justify-content:center;">
                  <strong style="font-size:0.85rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text);">${title.title}</strong>
                  <span class="subtle" style="font-size:0.74rem;">${title.season} · ${title.type}</span>
                </div>
              </a>
            `).join("")}
          </div>
        </div>
      </aside>
    </section>
  `;
}

function renderWatchlist() {
  const entries = libraryEntries();
  const genres = [...new Set(state.bootstrap.titles.flatMap(t => t.tags))];
  const years = [...new Set(state.bootstrap.titles.map(t => t.year))].sort((a,b)=>b-a);
  
  const filtered = entries.filter(({ title, entry }) => {
    const matchesStatus = state.listFilter === "all" || entry.status.toLowerCase() === state.listFilter.toLowerCase();
    const matchesSearch = !state.search.trim() || title.title.toLowerCase().includes(state.search.toLowerCase());
    const matchesGenre = state.watchlistGenre === "All" || title.tags.includes(state.watchlistGenre);
    const matchesYear = state.watchlistYear === "All" || String(title.year) === String(state.watchlistYear);
    const matchesFormat = state.watchlistFormat === "All" || title.type.toLowerCase() === state.watchlistFormat.toLowerCase();
    
    return matchesStatus && matchesSearch && matchesGenre && matchesYear && matchesFormat;
  });

  els.app.innerHTML = `
    <section class="view layout-watchlist">
      <!-- Left sidebar filters -->
      <aside class="sidebar">
        <div class="panel sticky" style="display:grid; gap:16px;">
          <div>
            <div class="eyebrow">Lists</div>
            <h2>Watchlist</h2>
          </div>
          
          <input type="text" class="field" id="wlSearchInput" value="${state.search}" placeholder="Search..." style="padding:10px 14px; border-radius:8px;" />
          
          <div class="watchlist-sidebar-group">
            <div class="watchlist-sidebar-group-title">Status</div>
            <div class="filter-stack" style="gap:4px;">
              ${["all", "Plan to watch", "Watching", "Finished", "On hold", "Dropped"].map(status => `
                <button class="watchlist-sidebar-item ${state.listFilter === status.toLowerCase() ? "active" : ""}" data-wl-status-btn="${status}">
                  <span>${status === "all" ? "All" : status}</span>
                  <span class="watchlist-sidebar-item-count">${status === "all" ? entries.length : entries.filter(e => e.entry.status === status).length}</span>
                </button>
              `).join("")}
            </div>
          </div>

          <div class="watchlist-sidebar-group">
            <div class="watchlist-sidebar-group-title">Format</div>
            <div class="watchlist-sidebar-list">
              <button class="watchlist-sidebar-item ${state.watchlistFormat === "All" ? "active" : ""}" data-wl-format-btn="All">All</button>
              <button class="watchlist-sidebar-item ${state.watchlistFormat === "TV Show" ? "active" : ""}" data-wl-format-btn="TV Show">TV Show</button>
              <button class="watchlist-sidebar-item ${state.watchlistFormat === "Movie" ? "active" : ""}" data-wl-format-btn="Movie">Movie</button>
            </div>
          </div>

          <div class="watchlist-sidebar-group">
            <div class="watchlist-sidebar-group-title">Genre</div>
            <div class="watchlist-sidebar-list">
              <button class="watchlist-sidebar-item ${state.watchlistGenre === "All" ? "active" : ""}" data-wl-genre-btn="All">All</button>
              ${genres.map(g => `
                <button class="watchlist-sidebar-item ${state.watchlistGenre === g ? "active" : ""}" data-wl-genre-btn="${g}">${g}</button>
              `).join("")}
            </div>
          </div>

          <div class="watchlist-sidebar-group">
            <div class="watchlist-sidebar-group-title">Year</div>
            <div class="watchlist-sidebar-list">
              <button class="watchlist-sidebar-item ${state.watchlistYear === "All" ? "active" : ""}" data-wl-year-btn="All">All</button>
              ${years.map(y => `
                <button class="watchlist-sidebar-item ${state.watchlistYear === String(y) ? "active" : ""}" data-wl-year-btn="${y}">${y}</button>
              `).join("")}
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Display Shelves -->
      <section class="panel">
        <div class="section-heading">
          <h2>Your Saved Library</h2>
        </div>
        <div class="stats-grid" style="margin: 16px 0;">
          <div class="mini-tile"><strong>${entries.length}</strong><span>Total Items</span></div>
          <div class="mini-tile"><strong>${entries.filter(e => e.entry.status === "Watching").length}</strong><span>Watching</span></div>
          <div class="mini-tile"><strong>${entries.filter(e => e.entry.status === "Finished").length}</strong><span>Finished</span></div>
        </div>

        <div class="watchlist-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:16px;">
          ${filtered.map(({ title, entry }) => `
            <article class="media-card" style="${posterStyle(title)}">
              <a href="#/anime/${title.id}" class="card-hit"></a>
              <div class="poster"></div>
              <div class="card-body">
                <div class="card-topline">
                  <span class="pill" style="font-size:0.75rem;">${entry.status}</span>
                  <span class="rating-pill" style="font-size:0.75rem;">${entry.score}%</span>
                </div>
                <h3 class="card-title">${title.title}</h3>
                <div class="subtle" style="font-size:0.78rem;">Ep ${entry.currentEpisode || 1} watched</div>
              </div>
            </article>
          `).join("") || `<div class="subtle">No matching saved anime found.</div>`}
        </div>
      </section>
    </section>
  `;
}

function renderProfile() {
  const u = user();
  const history = u?.history || [];
  const entries = libraryEntries();

  els.app.innerHTML = `
    <section class="view layout-profile" style="grid-template-columns: 1fr 340px;">
      <!-- Profile Content Left -->
      <div>
        <div class="profile-header panel" style="padding:24px; margin-bottom:20px;">
          <div style="display:flex; gap:20px; align-items:center;">
            <div class="avatar" style="width:72px; height:72px; font-size:1.6rem; font-weight:700;">${u?.displayName?.[0]?.toUpperCase() || "A"}</div>
            <div>
              <h1 style="margin:0; font-size:1.6rem;">${u?.displayName || "Guest"}</h1>
              <div class="subtle" style="font-size:0.9rem;">${u?.username} · ${u?.pronouns || ""}</div>
              <div class="subtle" style="font-size:0.8rem; margin-top:4px;">Member since May 2026</div>
            </div>
          </div>
          <div class="stats-grid" style="margin-top:20px;">
            <div class="mini-tile"><strong>2,738+</strong><span>Minutes Watched</span></div>
            <div class="mini-tile"><strong>${entries.filter(e => e.entry.status === "Finished").length}</strong><span>Anime Finished</span></div>
            <div class="mini-tile"><strong>${entries.length}</strong><span>Total Saved</span></div>
          </div>
        </div>

        <!-- Saved list grid -->
        <div class="panel">
          <div class="up-next-header">Anime List</div>
          <div class="row" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:16px; margin-top:12px;">
            ${entries.map(({ title }) => `
              <div class="media-card" style="${posterStyle(title)}; aspect-ratio:3/4; border-radius:10px;">
                <a href="#/anime/${title.id}" style="position:absolute; inset:0; z-index:2;"></a>
                <div class="poster" style="height:100%;"></div>
              </div>
            `).join("") || `<div class="subtle">No saved items in list.</div>`}
          </div>
        </div>
      </div>

      <!-- Recent Activity Right -->
      <aside class="sidebar">
        <div class="panel">
          <div class="up-next-header">Recent Activity</div>
          <div class="comment-list" style="gap:12px; max-height:480px; overflow-y:auto;">
            ${history.map(h => {
              const title = titleById(h.titleId);
              return `
                <div style="display:flex; gap:12px; background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; font-size:0.84rem; align-items:center;">
                  <div class="poster" style="${posterStyle(title)}; width:40px; height:52px; min-height:unset; flex-shrink:0; border-radius:4px;"></div>
                  <div>
                    <span>Watched ep <strong>${h.episode}</strong> of <strong>${title?.title}</strong></span>
                    <div class="subtle" style="font-size:0.75rem; margin-top:2px;">${timeAgo(h.updatedAt)}</div>
                  </div>
                </div>
              `;
            }).join("") || `<div class="subtle">No recent activity.</div>`}
          </div>
        </div>
      </aside>
    </section>
  `;
}

function renderSettings() {
  const u = user() || { settings: {}, importLists: {}, devices: [] };
  const settings = u.settings || {};

  els.app.innerHTML = `
    <section class="view layout-settings" style="grid-template-columns: 240px 1fr; gap: 20px;">
      <!-- Sidebar navigation -->
      <aside class="sidebar">
        <div class="panel settings-nav">
          <button class="tab-button ${state.settingsTab === "account" ? "active" : ""}" data-settings-tab-btn="account">My Account</button>
          <button class="tab-button ${state.settingsTab === "anime" ? "active" : ""}" data-settings-tab-btn="anime">Anime</button>
          <button class="tab-button ${state.settingsTab === "playback" ? "active" : ""}" data-settings-tab-btn="playback">Playback</button>
          <button class="tab-button ${state.settingsTab === "import" ? "active" : ""}" data-settings-tab-btn="import">Import List</button>
          <button class="tab-button ${state.settingsTab === "devices" ? "active" : ""}" data-settings-tab-btn="devices">Devices</button>
          <button class="tab-button danger" id="signOutBtn" style="margin-top: 20px;">Sign Out</button>
        </div>
      </aside>

      <!-- Settings Content -->
      <section class="panel">
        ${state.settingsTab === "account" ? `
          <h2>My Account</h2>
          <form class="settings-form" id="accountSettingsForm" style="margin-top:16px;">
            <div class="settings-row">
              <label>
                <span class="label" style="font-size:0.82rem; margin-bottom:6px; display:block;">Display Name</span>
                <input class="field" name="displayName" value="${u.displayName || ""}" style="width:100%; padding:10px; border-radius:8px;" />
              </label>
              <label>
                <span class="label" style="font-size:0.82rem; margin-bottom:6px; display:block;">Username</span>
                <input class="field" name="username" value="${u.username || ""}" style="width:100%; padding:10px; border-radius:8px;" />
              </label>
            </div>
            <div class="settings-row">
              <label>
                <span class="label" style="font-size:0.82rem; margin-bottom:6px; display:block;">Pronouns</span>
                <input class="field" name="pronouns" value="${u.pronouns || ""}" style="width:100%; padding:10px; border-radius:8px;" />
              </label>
            </div>
            <label>
              <span class="label" style="font-size:0.82rem; margin-bottom:6px; display:block;">About Me</span>
              <textarea class="field" name="bio" style="width:100%; padding:10px; border-radius:8px; min-height:80px;">${u.bio || ""}</textarea>
            </label>
            <div style="display:flex; justify-content:flex-end; margin-top:10px;">
              <button class="primary-button" type="submit">Save Changes</button>
            </div>
          </form>
        ` : ""}

        ${state.settingsTab === "anime" ? `
          <h2>Anime Settings</h2>
          <div class="settings-grid" style="display:grid; gap:16px; margin-top:16px;">
            <div class="setting-item">
              <div class="switch-row">
                <div>
                  <strong>Website Theme</strong>
                  <div class="settings-help">Choose your default styling aesthetic.</div>
                </div>
                <select class="field" id="themeSelect" style="padding:6px 12px; border-radius:8px; background: rgba(255,255,255,0.04); color: #fff;">
                  <option value="midnight" ${settings.theme === "midnight" ? "selected" : ""}>Midnight (Cyan/Blue)</option>
                  <option value="ember" ${settings.theme === "ember" ? "selected" : ""}>Ember (Orange/Red)</option>
                  <option value="aurora" ${settings.theme === "aurora" ? "selected" : ""}>Aurora (Green/Cyan)</option>
                </select>
              </div>
            </div>
            <div class="setting-item">
              <div class="switch-row">
                <div>
                  <strong>Anime Title Language</strong>
                  <div class="settings-help">Choose how anime titles should be displayed.</div>
                </div>
                <select class="field" id="titleLangSelect" style="padding:6px 12px; border-radius:8px;">
                  <option value="English">English</option>
                  <option value="Romaji">Romaji</option>
                  <option value="Native">Native</option>
                </select>
              </div>
            </div>
            <div class="setting-item">
              <div class="switch-row">
                <div>
                  <strong>Hide Adult Content</strong>
                  <div class="settings-help">Hide content intended for mature audiences (18+).</div>
                </div>
                <button class="switch" data-toggle-sett="nsfwHidden" data-on="${settings.nsfwHidden || false}"></button>
              </div>
            </div>
            <div class="setting-item">
              <div class="switch-row">
                <div>
                  <strong>Autoplay Trailers</strong>
                  <div class="settings-help">Automatically play trailers in preview panels.</div>
                </div>
                <button class="switch" data-toggle-sett="autoplay" data-on="${settings.autoplay || false}"></button>
              </div>
            </div>
          </div>
        ` : ""}

        ${state.settingsTab === "playback" ? `
          <h2>Playback Settings</h2>
          <div class="settings-grid" style="display:grid; gap:16px; margin-top:16px;">
            <div class="setting-item">
              <div class="switch-row">
                <div>
                  <strong>Video Quality Preference</strong>
                  <div class="settings-help">Choose your default video stream quality.</div>
                </div>
                <select class="field" id="qualitySelect" style="padding:6px 12px; border-radius:8px;">
                  <option value="Auto" ${settings.quality === "Auto" ? "selected" : ""}>Auto (recommended)</option>
                  <option value="1080p" ${settings.quality === "1080p" ? "selected" : ""}>1080p</option>
                  <option value="720p" ${settings.quality === "720p" ? "selected" : ""}>720p</option>
                  <option value="480p" ${settings.quality === "480p" ? "selected" : ""}>480p</option>
                </select>
              </div>
            </div>
            <div class="setting-item">
              <div class="switch-row">
                <div>
                  <strong>Auto Play</strong>
                  <div class="settings-help">Automatically start playback when video loads.</div>
                </div>
                <button class="switch" data-toggle-sett="autoplay" data-on="${settings.autoplay || false}"></button>
              </div>
            </div>
            <div class="setting-item">
              <div class="switch-row">
                <div>
                  <strong>Auto Next</strong>
                  <div class="settings-help">Play next episode automatically when finished.</div>
                </div>
                <button class="switch" data-toggle-sett="autoNext" data-on="${settings.autoNext || false}"></button>
              </div>
            </div>
            <div class="setting-item">
              <div class="switch-row">
                <div>
                  <strong>Auto Skip Intro/Outro</strong>
                  <div class="settings-help">Automatically skip intro/outro segment markers.</div>
                </div>
                <button class="switch" data-toggle-sett="autoSkip" data-on="${settings.autoSkip || false}"></button>
              </div>
            </div>
          </div>
        ` : ""}

        ${state.settingsTab === "import" ? `
          <h2>Import Watchlist from AniList</h2>
          <form class="settings-form" id="importForm" style="margin-top:16px;">
            <label>
              <span class="label" style="font-size:0.82rem; margin-bottom:6px; display:block;">Anilist username</span>
              <input class="field" name="username" placeholder="Enter username..." style="width:100%; padding:10px; border-radius:8px;" required />
            </label>
            <div style="display:flex; justify-content:flex-end; margin-top:10px;">
              <button class="primary-button" type="submit">Import Watchlist</button>
            </div>
          </form>
        ` : ""}

        ${state.settingsTab === "devices" ? `
          <h2>Signed In Devices</h2>
          <div class="settings-grid" style="display:grid; gap:12px; margin-top:16px;">
            ${(u.devices || []).map(d => `
              <div class="device-item" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:8px;">
                <div>
                  <strong>${d.label}</strong>
                  <div class="subtle" style="font-size:0.76rem;">Location: ${d.location} · Last seen: ${d.lastSeen}</div>
                </div>
                ${d.lastSeen !== "current" ? `<button class="ghost-button" data-device-logout="${d.id}" style="width:32px; height:32px; border-radius:50%; padding:0;">&times;</button>` : ""}
              </div>
            `).join("")}
            <div style="display:flex; justify-content:flex-end; margin-top:10px;">
              <button class="secondary-button" id="signoutAllBtn" style="color:var(--danger); border-color:rgba(255, 95, 109, 0.3);">Sign Out All Other Devices</button>
            </div>
          </div>
        ` : ""}
      </section>
    </section>
  `;
}

function cardHTML(title) {
  if (!title) return "";
  return `
    <article class="media-card" style="${posterStyle(title)}; position:relative; overflow:visible;" data-media-card-id="${title.id}">
      <a class="card-hit" href="#/anime/${title.id}" style="position:absolute; inset:0; z-index:2;"></a>
      <div class="poster" style="aspect-ratio: 3/4; border-radius:10px;"></div>
      <div class="card-body" style="padding: 8px 4px;">
        <h3 class="card-title" style="font-size:0.86rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title.title}</h3>
        <div class="meta-row" style="font-size:0.75rem; color:var(--muted); margin-top:4px;">
          <span>${title.type}</span>
          <span>★ ${title.score.toFixed(1)}</span>
        </div>
      </div>
    </article>
  `;
}

function selectedEpisode() {
  const title = titleById(state.titleId);
  if (!title) return null;
  return title.episodes.find(e => e.id === state.player.currentEpisode) || title.episodes[0];
}

function relatedTitles(title) {
  if (!title) return [];
  return (state.bootstrap?.titles || []).filter((entry) => title.related.includes(entry.id));
}

function commentsFor(titleId) {
  return (state.bootstrap?.comments || []).filter((comment) => comment.titleId === titleId);
}

function libraryEntries() {
  return Object.entries(user()?.library || {}).map(([titleId, entry]) => ({
    title: titleById(titleId),
    entry
  })).filter(({ title }) => title);
}

/* ==========================================================================
   VIDEO PLAYER CONTROLS & STREAM FETCH ENGINE
   ========================================================================== */

async function loadEpisodeStream() {
  const video = document.getElementById("videoPlayer");
  if (!video) return;

  state.player.loadingStream = true;
  renderWatch();

  try {
    const titleObj = titleById(state.titleId);
    if (!titleObj) return;

    const servers = await api(`/api/servers?anime=${state.titleId}&ep=${state.player.currentEpisode}`);
    state.player.serversList = servers;
    
    const selectedSrv = servers.find(s => s.server_name === state.player.server) || servers[0];
    if (selectedSrv) {
      state.player.server = selectedSrv.server_name;
      
      const watchDetails = await api(`/api/watch?server=${selectedSrv.server_name}&url=${encodeURIComponent(selectedSrv.embed_url)}`);
      mountVideoSource(watchDetails.stream_url, watchDetails.type);
    } else {
      throw new Error("No active servers found.");
    }
  } catch (err) {
    showToast(`Streaming error: ${err.message}`);
    mountVideoSource("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", "hls");
  } finally {
    state.player.loadingStream = false;
    renderWatch();
  }
}

function mountVideoSource(streamUrl, type) {
  const video = document.getElementById("videoPlayer");
  if (!video) return;

  if (state.player.hls) {
    state.player.hls.destroy();
    state.player.hls = null;
  }

  video.removeAttribute("src");
  video.load();

  if (type === "hls" && window.Hls?.isSupported()) {
    const hls = new window.Hls();
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    state.player.hls = hls;

    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      // Apply quality lock preference on source parse
      applyQualityBitrateSelection();
    });
  } else {
    video.src = streamUrl;
  }

  video.currentTime = state.player.currentTime || 0;
  if (state.player.autoplay) {
    video.play().catch(() => {});
  }

  const seekbar = document.getElementById("seekbar");
  const timeLabel = document.getElementById("timeLabel");

  video.ontimeupdate = () => {
    const duration = video.duration || 1;
    const pct = (video.currentTime / duration) * 100;
    if (seekbar) seekbar.value = String(Math.round(pct * 10));
    if (timeLabel) timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
    state.player.currentTime = video.currentTime;
    
    // Auto-Skip Intro Overlay Trigger
    const titleObj = titleById(state.titleId);
    const intro = titleObj?.intro || [80, 180];
    
    let skipBtn = document.getElementById("skipIntroBtn");
    if (video.currentTime >= intro[0] && video.currentTime <= intro[1]) {
      if (state.player.autoSkip) {
        video.currentTime = intro[1];
        showToast("Intro skipped automatically.");
      } else {
        if (!skipBtn) {
          skipBtn = document.createElement("button");
          skipBtn.id = "skipIntroBtn";
          skipBtn.className = "primary-button";
          skipBtn.style.position = "absolute";
          skipBtn.style.bottom = "80px";
          skipBtn.style.right = "24px";
          skipBtn.style.zIndex = "100";
          skipBtn.textContent = "⏩ Skip Intro";
          skipBtn.onclick = () => {
            video.currentTime = intro[1];
            skipBtn.remove();
            showToast("Intro skipped.");
          };
          document.getElementById("videoFrame").appendChild(skipBtn);
        }
      }
    } else {
      if (skipBtn) skipBtn.remove();
    }

    throttleProgress(state.titleId, state.player.currentEpisode, video.currentTime, duration);
  };

  video.onended = () => {
    const titleObj = titleById(state.titleId);
    if (state.player.autoNext && titleObj && state.player.currentEpisode < titleObj.episodes.length) {
      state.player.currentEpisode += 1;
      state.player.currentTime = 0;
      location.hash = `#/watch/${state.titleId}/${state.player.currentEpisode}`;
      loadEpisodeStream();
    }
  };
}

function applyQualityBitrateSelection() {
  const hls = state.player.hls;
  const q = state.player.quality;
  if (!hls) return;

  if (q === "Auto") {
    hls.currentLevel = -1;
  } else {
    const targetHeight = parseInt(q);
    const matchedIdx = hls.levels.findIndex(lvl => lvl.height === targetHeight);
    if (matchedIdx !== -1) {
      hls.currentLevel = matchedIdx;
    } else {
      // select closest resolution
      let bestIdx = 0;
      let minDiff = Infinity;
      hls.levels.forEach((lvl, idx) => {
        const diff = Math.abs(lvl.height - targetHeight);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = idx;
        }
      });
      hls.currentLevel = bestIdx;
    }
  }
}

let progressDebounce = null;
function throttleProgress(titleId, episode, currentTime, duration) {
  clearTimeout(progressDebounce);
  progressDebounce = setTimeout(() => {
    api("/api/progress", {
      method: "POST",
      body: JSON.stringify({
        titleId,
        episode,
        progress: currentTime / duration,
        status: "Watching",
        server: state.player.server,
        quality: state.player.quality,
        caption: state.player.caption
      })
    }).then(res => {
      state.bootstrap.user = res.user;
    }).catch(console.error);
  }, 1200);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const sec = total % 60;
  return `${minutes}:${String(sec).padStart(2, "0")}`;
}

/* ==========================================================================
   MINIPLAYER WINDOW ENGINE
   ========================================================================== */

function setupMiniPlayerScroll() {
  window.onscroll = () => {
    if (state.route !== "watch") {
      els.miniPlayer.classList.add("hidden");
      stopMiniPlayer();
      return;
    }
    
    const primaryPlayer = document.getElementById("videoPlayer");
    if (!primaryPlayer) return;

    const rect = primaryPlayer.getBoundingClientRect();
    const isOffscreen = rect.bottom < 0;

    if (isOffscreen && !state.miniPlayer.active && !primaryPlayer.paused) {
      state.miniPlayer.active = true;
      els.miniPlayer.classList.remove("hidden");
      
      els.miniVideoPlayer.src = primaryPlayer.src;
      els.miniVideoPlayer.currentTime = primaryPlayer.currentTime;
      els.miniVideoPlayer.play().catch(() => {});
      primaryPlayer.pause();
    } else if (!isOffscreen && state.miniPlayer.active) {
      state.miniPlayer.active = false;
      els.miniPlayer.classList.add("hidden");
      
      primaryPlayer.currentTime = els.miniVideoPlayer.currentTime;
      primaryPlayer.play().catch(() => {});
      els.miniVideoPlayer.pause();
      els.miniVideoPlayer.removeAttribute("src");
    }
  };
}

function stopMiniPlayer() {
  state.miniPlayer.active = false;
  els.miniVideoPlayer.pause();
  els.miniVideoPlayer.removeAttribute("src");
}

function makeElementDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  const dragMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("video")) return;
    
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  };

  const elementDrag = (e) => {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    const topVal = element.offsetTop - pos2;
    const leftVal = element.offsetLeft - pos1;
    
    element.style.top = `${topVal}px`;
    element.style.left = `${leftVal}px`;
    element.style.bottom = "auto";
    element.style.right = "auto";
  };

  const closeDragElement = () => {
    document.onmouseup = null;
    document.onmousemove = null;
  };

  element.onmousedown = dragMouseDown;
}

/* ==========================================================================
   INTERACTIONS & COMPONENT EVENT BINDINGS
   ========================================================================== */

function bindInteractions() {
  // Search inputs mapping
  els.searchInput.oninput = (e) => {
    state.search = e.target.value;
    render();
  };

  // Genre pill selectors in Home
  document.querySelectorAll("[data-genre-btn]").forEach(btn => {
    btn.onclick = () => {
      state.genre = btn.dataset.genreBtn;
      render();
    };
  });

  // Spotlight dot clicks
  document.querySelectorAll("[data-spotlight-dot]").forEach(dot => {
    dot.onclick = () => {
      const idx = Number(dot.dataset.spotlightDot);
      state.spotlightIndex = idx;
      state.bootstrap.home.spotlight = state.bootstrap.home.trending[idx];
      render();
    };
  });

  // Airing schedule tab selectors
  document.querySelectorAll("[data-schedule-day]").forEach(btn => {
    btn.onclick = () => {
      state.activeScheduleDay = btn.dataset.scheduleDay;
      const container = document.getElementById("scheduleContainer");
      if (container) {
        container.innerHTML = scheduleHTML(state.activeScheduleDay);
      }
      document.querySelectorAll("[data-schedule-day]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });

  // Watch page interactions
  const playBtn = document.getElementById("playBtn");
  if (playBtn) {
    playBtn.onclick = () => {
      const video = document.getElementById("videoPlayer");
      if (video.paused) {
        video.play();
        playBtn.textContent = "⏸ Pause";
      } else {
        video.pause();
        playBtn.textContent = "▶ Play";
      }
    };
  }

  const seekBackBtn = document.getElementById("seekBackBtn");
  if (seekBackBtn) {
    seekBackBtn.onclick = () => {
      const video = document.getElementById("videoPlayer");
      video.currentTime = Math.max(0, video.currentTime - 10);
    };
  }

  const seekForwardBtn = document.getElementById("seekForwardBtn");
  if (seekForwardBtn) {
    seekForwardBtn.onclick = () => {
      const video = document.getElementById("videoPlayer");
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    };
  }

  const prevEpBtn = document.getElementById("prevEpBtn");
  if (prevEpBtn) {
    prevEpBtn.onclick = () => {
      if (state.player.currentEpisode > 1) {
        state.player.currentEpisode -= 1;
        location.hash = `#/watch/${state.titleId}/${state.player.currentEpisode}`;
        loadEpisodeStream();
      }
    };
  }

  const nextEpBtn = document.getElementById("nextEpBtn");
  if (nextEpBtn) {
    nextEpBtn.onclick = () => {
      const titleObj = titleById(state.titleId);
      if (titleObj && state.player.currentEpisode < titleObj.episodes.length) {
        state.player.currentEpisode += 1;
        location.hash = `#/watch/${state.titleId}/${state.player.currentEpisode}`;
        loadEpisodeStream();
      }
    };
  }

  const seekbar = document.getElementById("seekbar");
  if (seekbar) {
    seekbar.oninput = (e) => {
      const video = document.getElementById("videoPlayer");
      const duration = video.duration || 1;
      video.currentTime = (Number(e.target.value) / 1000) * duration;
    };
  }

  // Server selection buttons
  document.querySelectorAll("[data-player-server]").forEach(btn => {
    btn.onclick = () => {
      state.player.server = btn.dataset.playerServer;
      loadEpisodeStream();
    };
  });

  // Quality adaptive lock toggles
  document.querySelectorAll("[data-player-quality]").forEach(btn => {
    btn.onclick = () => {
      const q = btn.dataset.playerQuality;
      state.player.quality = q;
      applyQualityBitrateSelection();
      showToast(`Quality preference changed: ${q}`);
      renderWatch();
    };
  });

  // Watch sync button
  const watchSyncBtn = document.getElementById("watchSyncBtn");
  if (watchSyncBtn) {
    watchSyncBtn.onclick = () => {
      if (!user()) {
        showToast("Please sign in to sync your library.");
        return;
      }
      openEditLibraryModal(state.titleId);
    };
  }

  // Watchlist sidebar filter updates
  document.querySelectorAll("[data-wl-status-btn]").forEach(btn => {
    btn.onclick = () => {
      state.listFilter = btn.dataset.wlStatusBtn.toLowerCase();
      render();
    };
  });

  document.querySelectorAll("[data-wl-format-btn]").forEach(btn => {
    btn.onclick = () => {
      state.watchlistFormat = btn.dataset.wlFormatBtn;
      render();
    };
  });

  document.querySelectorAll("[data-wl-genre-btn]").forEach(btn => {
    btn.onclick = () => {
      state.watchlistGenre = btn.dataset.wlGenreBtn;
      render();
    };
  });

  document.querySelectorAll("[data-wl-year-btn]").forEach(btn => {
    btn.onclick = () => {
      state.watchlistYear = btn.dataset.wlYearBtn;
      render();
    };
  });

  const wlSearchInput = document.getElementById("wlSearchInput");
  if (wlSearchInput) {
    wlSearchInput.oninput = (e) => {
      state.search = e.target.value;
      render();
    };
  }

  // Settings tab selections
  document.querySelectorAll("[data-settings-tab-btn]").forEach(btn => {
    btn.onclick = () => {
      state.settingsTab = btn.dataset.settingsTabBtn;
      render();
    };
  });

  // Theme variable selections
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    themeSelect.onchange = (e) => {
      const selectedTheme = e.target.value;
      document.documentElement.setAttribute("data-theme", selectedTheme);
      api("/api/settings", { method: "PUT", body: JSON.stringify({ theme: selectedTheme }) })
        .then(res => {
          state.bootstrap.user = res.user;
          showToast(`Theme switched to ${selectedTheme}.`);
        }).catch(console.error);
    };
  }

  // Account settings update form
  const accountSettingsForm = document.getElementById("accountSettingsForm");
  if (accountSettingsForm) {
    accountSettingsForm.onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(accountSettingsForm);
      const payload = {
        displayName: form.get("displayName"),
        username: form.get("username"),
        pronouns: form.get("pronouns"),
        bio: form.get("bio")
      };
      try {
        const res = await api("/api/settings", { method: "PUT", body: JSON.stringify(payload) });
        state.bootstrap.user = res.user;
        showToast("Settings updated successfully!");
        render();
      } catch (err) {
        showToast(err.message);
      }
    };
  }

  // Real Import list sync form
  const importForm = document.getElementById("importForm");
  if (importForm) {
    importForm.onsubmit = async (e) => {
      e.preventDefault();
      const username = new FormData(importForm).get("username");
      showToast(`Syncing library catalog with Anilist user '${username}'...`);
      try {
        const res = await api("/api/library/import", {
          method: "POST",
          body: JSON.stringify({ username })
        });
        state.bootstrap.user = res.user;
        showToast("Anilist watchlist imported successfully!");
        render();
      } catch (err) {
        showToast(`Sync error: ${err.message}`);
      }
    };
  }

  // Device logouts
  document.querySelectorAll("[data-device-logout]").forEach(btn => {
    btn.onclick = () => {
      showToast("Device signed out!");
      btn.closest(".device-item").remove();
    };
  });

  const signoutAllBtn = document.getElementById("signoutAllBtn");
  if (signoutAllBtn) {
    signoutAllBtn.onclick = () => {
      showToast("All other device sessions terminated.");
    };
  }

  // Sign out button
  const signOutBtn = document.getElementById("signOutBtn");
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      await api("/api/auth/logout", { method: "POST" });
      state.bootstrap = await api("/api/bootstrap");
      location.hash = "#/home";
      render();
    };
  }

  // Card hover preview card effects
  document.querySelectorAll("[data-media-card-id]").forEach(card => {
    card.onmouseenter = (e) => {
      if (state.route === "watchlist") return;
      const titleId = card.dataset.mediaCardId;
      clearTimeout(state.activeHoverTimer);
      state.activeHoverTimer = setTimeout(() => {
        showHoverPreview(card, titleId);
      }, 500);
    };

    card.onmouseleave = () => {
      clearTimeout(state.activeHoverTimer);
      removeHoverPreview();
    };
  });
}

/* ==========================================================================
   POPOVER CARD HOVER HANDLERS
   ========================================================================== */

function showHoverPreview(cardElement, titleId) {
  const title = titleById(titleId);
  if (!title) return;

  removeHoverPreview();

  const preview = document.createElement("div");
  preview.className = "card-preview";
  preview.id = "hoverPreviewCard";
  preview.style.display = "grid";
  preview.style.position = "absolute";
  preview.style.zIndex = "2000";
  preview.setAttribute("style", posterStyle(title));

  preview.innerHTML = `
    <div class="preview-backdrop" style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(8, 11, 17, 0.76), rgba(8, 11, 17, 0.98)), var(--banner-image) center / cover no-repeat; z-index:-1; border-radius:10px;"></div>
    <div class="detail-topline" style="display:flex; justify-content:space-between; align-items:center;">
      <span class="pill">${title.type}</span>
      <span class="rating-pill">★ ${title.score.toFixed(1)}</span>
    </div>
    <h3 style="margin:8px 0 4px; font-size:1.1rem; line-height:1.2;">${title.title}</h3>
    <p style="font-size:0.82rem; line-height:1.4; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; margin-bottom:8px;">${title.synopsis}</p>
    <div class="player-row" style="margin-top:auto; display:flex; gap:10px;">
      <a class="primary-button" href="#/watch/${title.id}/1" style="font-size:0.8rem; padding:8px 12px; border-radius:8px;">Watch now</a>
      <a class="secondary-button" href="#/anime/${title.id}" style="font-size:0.8rem; padding:8px 12px; border-radius:8px;">Details</a>
    </div>
  `;

  document.body.appendChild(preview);

  const rect = cardElement.getBoundingClientRect();
  const top = window.scrollY + rect.top;
  const left = rect.right + 12;

  preview.style.top = `${top}px`;
  preview.style.left = `${left}px`;
}

function removeHoverPreview() {
  const existing = document.getElementById("hoverPreviewCard");
  if (existing) existing.remove();
}

/* ==========================================================================
   GLOBAL POPUPS & DRAWER ATTACHMENTS
   ========================================================================== */

function bindGlobalPopups() {
  els.notifButton.onclick = (e) => {
    e.stopPropagation();
    closePopovers();
    loadNotificationsList();
    els.notifPopover.classList.remove("hidden");
  };

  els.accountButton.onclick = (e) => {
    e.stopPropagation();
    closePopovers();
    if (!user()) {
      openAuthDrawer();
    } else {
      els.userMenuPopover.classList.remove("hidden");
    }
  };

  document.onclick = () => {
    closePopovers();
    removeHoverPreview();
  };

  els.notifPopover.onclick = (e) => e.stopPropagation();
  els.userMenuPopover.onclick = (e) => e.stopPropagation();

  els.markAllReadBtn.onclick = () => {
    state.bootstrap.notifications = [];
    updateUnreadBadge();
    loadNotificationsList();
    showToast("All notifications marked as read.");
  };

  document.getElementById("menuPublicProfileBtn").onclick = () => {
    location.hash = "#/profile";
    render();
  };
  document.getElementById("menuEditProfileBtn").onclick = () => {
    location.hash = "#/settings";
    state.settingsTab = "account";
    render();
  };
  document.getElementById("menuSettingsBtn").onclick = () => {
    location.hash = "#/settings";
    render();
  };
  document.getElementById("menuSignOutBtn").onclick = async () => {
    await api("/api/auth/logout", { method: "POST" });
    state.bootstrap = await api("/api/bootstrap");
    location.hash = "#/home";
    render();
  };

  // Library Edit Form submit
  els.editLibForm.onsubmit = async (e) => {
    e.preventDefault();
    const titleId = els.editLibForm.dataset.titleId;
    const form = new FormData(els.editLibForm);
    const payload = {
      titleId,
      status: form.get("status"),
      start_date: form.get("start_date"),
      end_date: form.get("end_date"),
      score: Number(form.get("score")),
      currentEpisode: Number(form.get("currentEpisode")),
      rewatched: Number(form.get("rewatched")),
      notes: form.get("notes")
    };
    try {
      const res = await api("/api/library", { method: "PUT", body: JSON.stringify(payload) });
      state.bootstrap.user = res.user;
      showToast("Library synced!");
      closeEditLibraryModal();
      render();
    } catch (err) {
      showToast(err.message);
    }
  };

  els.closeEditLibBtn.onclick = closeEditLibraryModal;

  els.miniPlayerClose.onclick = () => {
    els.miniPlayer.classList.add("hidden");
    stopMiniPlayer();
  };

  els.miniPlayerExpand.onclick = () => {
    state.miniPlayer.active = false;
    els.miniPlayer.classList.add("hidden");
    const primaryPlayer = document.getElementById("videoPlayer");
    if (primaryPlayer) {
      primaryPlayer.currentTime = els.miniVideoPlayer.currentTime;
      primaryPlayer.play().catch(() => {});
      els.miniVideoPlayer.pause();
      primaryPlayer.scrollIntoView({ behavior: "smooth" });
    }
  };

  els.miniPlayerPlay.onclick = () => {
    if (els.miniVideoPlayer.paused) {
      els.miniVideoPlayer.play();
      els.miniPlayerPlay.textContent = "⏸";
    } else {
      els.miniVideoPlayer.pause();
      els.miniPlayerPlay.textContent = "▶";
    }
  };
}

function loadNotificationsList() {
  const notifs = state.bootstrap.notifications || [];
  els.notifList.innerHTML = "";
  if (notifs.length === 0) {
    els.notifList.innerHTML = `<div class="subtle" style="padding:16px; text-align:center;">No new updates.</div>`;
    return;
  }
  notifs.forEach(n => {
    const item = document.createElement("div");
    item.className = "notif-item";
    item.innerHTML = `
      <div class="notif-content">
        <strong>${n.title}</strong>
        <div>${n.body}</div>
        <span class="notif-time">${timeAgo(n.createdAt)}</span>
      </div>
    `;
    els.notifList.appendChild(item);
  });
}

function openAuthDrawer() {
  const drawer = document.getElementById("authDrawer");
  drawer.innerHTML = `
    <div class="drawer-head">
      <div>
        <div class="eyebrow">Sign In</div>
        <h3 class="drawer-title">Sync your library</h3>
      </div>
      <button class="drawer-close" id="closeAuthBtn" type="button">&times;</button>
    </div>
    <div class="drawer-body">
      <form id="authForm" class="settings-form">
        <label><span class="label">Username</span><input class="field" name="username" value="demo@nexanime.local" style="width:100%;" /></label>
        <label><span class="label">Password</span><input class="field" name="password" type="password" value="demo1234" style="width:100%;" /></label>
        <button class="primary-button" type="submit">Sign In / Create Account</button>
      </form>
      <div class="subtle" style="font-size:0.75rem; text-align:center;">Demo account: demo@nexanime.local / demo1234</div>
    </div>
  `;

  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  toggleBackdrop(true);

  document.getElementById("closeAuthBtn").onclick = () => {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    toggleBackdrop(false);
  };

  document.getElementById("authForm").onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const username = form.get("username");
    const password = form.get("password");
    try {
      const res = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      state.bootstrap.user = res.user;
      showToast("Successfully signed in!");
      
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      toggleBackdrop(false);
      
      render();
    } catch (err) {
      showToast(err.message);
    }
  };
}

window.addEventListener("hashchange", () => {
  parseRoute();
  render();
  if (state.route === "watch") {
    loadEpisodeStream();
  }
});

// Setup global events on boot
bindGlobalPopups();
setupMiniPlayerScroll();
makeElementDraggable(els.miniPlayer);
boot();
