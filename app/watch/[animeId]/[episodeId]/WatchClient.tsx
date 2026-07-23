'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import VideoPlayer from '@/components/player/VideoPlayer';
import ServerPicker from '@/components/player/ServerPicker';
import StatusDropdownButton from '@/components/detail/StatusDropdownButton';
import WatchlistEditorModal from '@/components/detail/WatchlistEditorModal';
import StackedAnimeCard from '@/components/cards/StackedAnimeCard';
import EpisodeGrid from '@/components/watch/EpisodeGrid';
import { useToast } from '@/components/ui/Toast';
import styles from './WatchClient.module.css';

interface ServerSource {
  adapterId: string;
  sourceName: string;
  streamUrl: string;
  subtitleUrl?: string;
}

interface WatchClientProps {
  media: any;
  episodeNumber: number;
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'Plan to Watch',
  watching: 'Watching',
  on_hold: 'On Hold',
  dropped: 'Dropped',
  finished: 'Completed',
  rewatching: 'Rewatching',
};

function getEpisodeTitle(media: any, epNum: number, jikanEpisodes: any[] = [], reanimeEps: Array<{ episode_number: number; title: string | null }> = []): string {
  const reanimeEp = reanimeEps.find(e => e.episode_number === epNum);
  if (reanimeEp?.title) return reanimeEp.title;

  if (media.streamingEpisodes?.length) {
    const ep = media.streamingEpisodes.find((e: any) => {
      const t = e.title || '';
      const match = t.match(/(?:Episode|Ep|Chapter)\s*(\d+)/i);
      return match && parseInt(match[1]) === epNum;
    });
    if (ep?.title) {
      const cleaned = ep.title.replace(/^(?:Episode|Ep|Chapter)\s*\d+[:\s\-–]*/i, '').trim();
      if (cleaned.length > 0) return cleaned;
    }
  }

  if (jikanEpisodes?.length) {
    const jEp = jikanEpisodes.find((e: any) => e.mal_id === epNum);
    if (jEp?.title) {
      return jEp.title_english || jEp.title || `Episode ${epNum}`;
    }
  }

  return `Episode ${epNum}`;
}

function getEpisodeThumb(media: any, epNum: number, reanimeEps: Array<{ episode_number: number; thumbnail: string | null }> = []): string | null {
  const reanimeEp = reanimeEps.find(e => e.episode_number === epNum);
  if (reanimeEp?.thumbnail) return reanimeEp.thumbnail;
  if (media.streamingEpisodes?.length) {
    const ep = media.streamingEpisodes.find((e: any) => {
      const t = e.title || '';
      const match = t.match(/(?:Episode|Ep|Chapter)\s*(\d+)/i);
      return match && parseInt(match[1]) === epNum;
    });
    if (ep?.thumbnail) return ep.thumbnail;
  }
  return media.coverImage?.medium || media.coverImage?.extraLarge || null;
}

function getRelationByType(media: any, type: string): any[] {
  if (!media.relations?.edges) return [];
  return media.relations.edges
    .filter((r: any) => r.relationType === type)
    .map((r: any) => r.node)
    .filter(Boolean);
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function WatchClient({ media, episodeNumber }: WatchClientProps) {
  const [sources, setSources] = useState<ServerSource[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const { toast } = useToast();

  const [watchlistStatus, setWatchlistStatus] = useState<string | null>(null);
  const [isDub, setIsDub] = useState(false);
  const episodeListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!episodeListRef.current) return;
    const activeEl = episodeListRef.current.querySelector(`.${styles.activeEpRow}`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [episodeNumber]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isGridView, setIsGridView] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [clientAutoPlay, setClientAutoPlay] = useState(true);
  const [clientAutoSkip, setClientAutoSkip] = useState(false);
  const [videoQuality, setVideoQuality] = useState('auto');
  const [jikanEpisodes, setJikanEpisodes] = useState<any[]>([]);
  const [reanimeEpisodes, setReanimeEpisodes] = useState<Array<{ episode_number: number; title: string | null; thumbnail: string | null }>>([]);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!media.idMal && !media.id) return;

    // Fetch reanime episodes (thumbnails) and Jikan episodes in parallel
    Promise.allSettled([
      fetch(`/api/meta?action=episodes&id=${media.id}`).then(r => r.ok ? r.json() : Promise.reject()).then(d => { if (d.episodes?.length) setReanimeEpisodes(d.episodes); }),
      media.idMal ? fetch(`https://api.jikan.moe/v4/anime/${media.idMal}/episodes`)
        .then((res) => {
          if (!res.ok) throw new Error('Jikan API rate limit');
          return res.json();
        })
        .then((data) => {
          if (data.data) {
            setJikanEpisodes(data.data);
          }
        })
        .catch((err) => console.warn('[Jikan] Fallback episode titles unavailable:', err))
        : Promise.resolve(),
    ]);
  }, [media.idMal, media.id]);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setClientAutoPlay(data.settings.auto_next !== false);
          setClientAutoSkip(!!data.settings.auto_skip_intro_outro);
          setVideoQuality(data.settings.video_quality || 'auto');
        }
      })
      .catch(() => {});
  }, []);

  // Fetch watched episodes for checkmark display
  useEffect(() => {
    if (!media.id) return;
    fetch(`/api/progress/history?anilistId=${media.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.history) {
          setWatchedEpisodes(new Set(data.history.map((h: any) => h.episode_number)));
        }
      })
      .catch(() => {});
  }, [media.id]);

  useEffect(() => {
    if (!media.id) return;

    // Auto-track progress on page visit (works for embed sources too)
    const trackProgress = () => {
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anilistId: media.id, episodeNumber, secondsWatched: 0, durationSeconds: 0 }),
      }).catch(() => {});

      // Also auto-add to watchlist with "watching" status if not already
      fetch(`/api/watchlist?anilistId=${media.id}`)
        .then(r => r.json())
        .then(data => {
          if (!data.entry) {
            fetch('/api/watchlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                anilistId: media.id,
                listStatus: 'watching',
                episodeWatched: episodeNumber,
                animeTitle: media.title?.english || media.title?.romaji || '',
              }),
            }).catch(() => {});
          } else if (data.entry.listStatus === 'planning') {
            // Auto-move from "Plan to watch" to "Watching"
            fetch('/api/watchlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                anilistId: media.id,
                listStatus: 'watching',
                episodeWatched: episodeNumber,
                animeTitle: media.title?.english || media.title?.romaji || '',
              }),
            }).catch(() => {});
          } else if (episodeNumber > (data.entry.episodeWatched || 0)) {
            // Update episode_watched if higher
            fetch('/api/watchlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                anilistId: media.id,
                listStatus: data.entry.listStatus,
                episodeWatched: episodeNumber,
                animeTitle: media.title?.english || media.title?.romaji || '',
              }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    };

    trackProgress();

    // Periodically update progress while on page (every 30s)
    const interval = setInterval(() => {
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anilistId: media.id, episodeNumber, secondsWatched: 0, durationSeconds: 0 }),
      }).catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [media.id, episodeNumber, media.title?.english, media.title?.romaji]);

  const fetchWatchlistStatus = async () => {
    if (!media.id) return;
    try {
      const res = await fetch(`/api/watchlist?anilistId=${media.id}`);
      if (res.ok) {
        const data = await res.json();
        setWatchlistStatus(data.entry?.listStatus || null);
      }
    } catch (err) {
      console.error('Failed to fetch watchlist status:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    if (!media.id) {
      setError('Invalid anime ID');
      setLoading(false);
      return;
    }

    fetch(`/api/stream/${media.id}/${episodeNumber}?dub=${isDub}&quality=${videoQuality}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.error) {
          setError(data.error);
          toast(data.error, 'error');
        } else if (data.sources && data.sources.length > 0) {
          setSources(data.sources);
          setActiveServerId(data.sources[0].adapterId);
        } else {
          setError('No streaming sources found for this episode.');
          toast('No streaming sources found for this episode.', 'error');
        }
        setLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        const msg = err.message || 'Failed to fetch streams';
        setError(msg);
        toast(msg, 'error');
        setLoading(false);
      });

    fetchWatchlistStatus();
    return () => { isMounted = false; };
  }, [media.id, episodeNumber, isDub, videoQuality]);

  const activeSource = sources.find(s => s.adapterId === activeServerId);

  const nextAiring = media.nextAiringEpisode;
  let countdownText = '';
  if (media.status === 'RELEASING' && nextAiring) {
    const now = Math.floor(Date.now() / 1000);
    const secondsLeft = nextAiring.airingAt - now;
    if (secondsLeft > 0) {
      const days = Math.floor(secondsLeft / (24 * 3600));
      const hours = Math.floor((secondsLeft % (24 * 3600)) / 3600);
      const minutes = Math.floor((secondsLeft % 3600) / 60);
      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      countdownText = `Episode ${nextAiring.episode} airs in ${parts.join(' ')}`;
    }
  }

  const nextEpisode = media.nextAiringEpisode?.episode;
  const isNotYetReleased = media.status === 'NOT_YET_RELEASED';
  const totalEpisodes = isNotYetReleased ? 0 : (media.episodes || (nextEpisode ? nextEpisode - 1 : 0) || media.streamingEpisodes?.length || 0);
  const hasNextEp = totalEpisodes > 0 && episodeNumber + 1 <= totalEpisodes;

  const [showAutoAdvance, setShowAutoAdvance] = useState(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Iframe postMessage progress tracking (Zoko + MegaPlay embeds) ──
  useEffect(() => {
    let lastSync = 0;
    const syncProgress = (currentTime: number, duration: number) => {
      const now = Date.now();
      if (now - lastSync < 10000) return;
      lastSync = now;
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anilistId: media.id,
          episodeNumber,
          secondsWatched: Math.floor(currentTime),
          durationSeconds: Math.floor(duration),
        }),
      }).catch(() => {});
    };
    const markComplete = () => {
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anilistId: media.id,
          episodeNumber,
          secondsWatched: 99999,
          durationSeconds: 99999,
        }),
      }).catch(() => {});
      // Auto-advance to next episode
      if (hasNextEp) {
        setShowAutoAdvance(true);
        autoAdvanceTimer.current = setTimeout(() => {
          window.location.href = `/watch/${media.id}/${episodeNumber + 1}`;
        }, 8000);
      }
    };
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!data) return;
        // Zoko format: { channel: 'zokoanime', type: 'timeupdate', currentTime, duration }
        if (data.channel === 'zokoanime') {
          if (data.type === 'timeupdate' && data.currentTime != null && data.duration != null) {
            syncProgress(data.currentTime, data.duration);
          } else if (data.type === 'ended') {
            markComplete();
          }
          return;
        }
        // MegaPlay format: { event: 'time', time, duration, percent }
        if (data.event === 'time' && data.time != null && data.duration != null) {
          syncProgress(data.time, data.duration);
          return;
        }
        // MegaPlay complete
        if (data.event === 'complete') {
          markComplete();
          return;
        }
        // MegaPlay watching-log: { type: 'watching-log', currentTime, duration }
        if (data.type === 'watching-log' && data.currentTime != null && data.duration != null) {
          syncProgress(data.currentTime, data.duration);
        }
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [media.id, episodeNumber, hasNextEp]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (showEditor) setShowEditor(false);
        if (showEpisodeList) setShowEpisodeList(false);
        if (showAutoAdvance) {
          setShowAutoAdvance(false);
          if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
        }
      }
      if (e.key === 'ArrowLeft' && episodeNumber > 1) {
        window.location.href = `/watch/${media.id}/${episodeNumber - 1}`;
      }
      if (e.key === 'ArrowRight' && hasNextEp) {
        window.location.href = `/watch/${media.id}/${episodeNumber + 1}`;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showEditor, showEpisodeList, showAutoAdvance, media.id, episodeNumber, hasNextEp]);

  const rawEpisodes = Array.from({ length: totalEpisodes }, (_, i) => i + 1);
  const filteredEpisodes = rawEpisodes.filter(epNum =>
    epNum.toString().includes(searchQuery) ||
    getEpisodeTitle(media, epNum, jikanEpisodes, reanimeEpisodes).toLowerCase().includes(searchQuery.toLowerCase())
  );
  const sortedEpisodes = sortOrder === 'asc' ? filteredEpisodes : [...filteredEpisodes].reverse();

  const stripHtml = (htmlStr: string) => {
    if (!htmlStr) return '';
    return htmlStr.replace(/<[^>]*>/g, '');
  };

  const animeSynopsis = stripHtml(media.description || '');
  const displaySynopsis = showFullSynopsis || animeSynopsis.length <= 250
    ? animeSynopsis
    : `${animeSynopsis.slice(0, 250)}...`;

  const prequels = getRelationByType(media, 'PREQUEL');
  const sequels = getRelationByType(media, 'SEQUEL');
  const sideStories = getRelationByType(media, 'SIDE_STORY');
  const alternatives = getRelationByType(media, 'ALTERNATIVE');
  const spinOffs = getRelationByType(media, 'SPIN_OFF');
  const summaries = getRelationByType(media, 'SUMMARY');
  const hasRelations = prequels.length > 0 || sequels.length > 0 || sideStories.length > 0 || alternatives.length > 0 || spinOffs.length > 0 || summaries.length > 0;

  return (
    <main className={styles.container}>
      <div className={styles.leftCol}>
        <div className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span className={styles.separator}>›</span>
          <Link href={`/anime/${media.id}`}>{media.title.romaji || media.title.english}</Link>
          <span className={styles.separator}>›</span>
          <span className={styles.currentCrumb}>{getEpisodeTitle(media, episodeNumber, jikanEpisodes, reanimeEpisodes)}</span>
        </div>

        <div className={styles.playerSection}>
          {loading ? (
            <div className={styles.loadingPlayer}>
              <div className={styles.spinner} />
              <p>Resolving streams...</p>
            </div>
          ) : error ? (
            <div className={styles.errorPlayer}>
              <p>{error}</p>
            </div>
          ) : (
            <>
              <VideoPlayer
                src={activeSource?.streamUrl || null}
                subtitleUrl={activeSource?.subtitleUrl}
                animeId={media.id}
                episodeNumber={episodeNumber}
                totalEpisodes={totalEpisodes}
              />
              {showAutoAdvance && hasNextEp && (
                <div className={styles.autoAdvanceBanner}>
                  <div className={styles.autoAdvanceInfo}>
                    <span className={styles.autoAdvanceIcon}>▶</span>
                    <div>
                      <p className={styles.autoAdvanceTitle}>Up Next: Episode {episodeNumber + 1}</p>
                      <p className={styles.autoAdvanceSub}>Starting in 8 seconds...</p>
                    </div>
                  </div>
                  <div className={styles.autoAdvanceActions}>
                    <button
                      className={styles.autoAdvanceCancel}
                      onClick={() => {
                        setShowAutoAdvance(false);
                        if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
                      }}
                    >
                      Cancel
                    </button>
                    <Link
                      href={`/watch/${media.id}/${episodeNumber + 1}`}
                      className={styles.autoAdvancePlayNow}
                    >
                      Play Now
                    </Link>
                  </div>
                </div>
              )}
              <div className={styles.playerControlsBar}>
                <div className={styles.playNavGroup}>
                  <Link
                    href={`/watch/${media.id}/${episodeNumber - 1}`}
                    className={`${styles.navControlBtn} ${episodeNumber <= 1 ? styles.disabledBtn : ''}`}
                    onClick={(e) => episodeNumber <= 1 && e.preventDefault()}
                  >
                    ⏮ Prev Ep
                  </Link>
                  <Link
                    href={`/watch/${media.id}/${episodeNumber + 1}`}
                    className={`${styles.navControlBtn} ${totalEpisodes > 0 && episodeNumber >= totalEpisodes ? styles.disabledBtn : ''}`}
                    onClick={(e) => totalEpisodes > 0 && episodeNumber >= totalEpisodes && e.preventDefault()}
                  >
                    Next Ep ⏭
                  </Link>
                </div>
                <div className={styles.playSettingsGroup}>
                  <label className={styles.settingToggle}>
                    <input
                      type="checkbox"
                      checked={clientAutoPlay}
                      onChange={(e) => {
                        setClientAutoPlay(e.target.checked);
                        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoNext: e.target.checked }) });
                      }}
                    />
                    <span>Auto Next</span>
                  </label>

        {/* Series Progress Bar */}
        {totalEpisodes > 0 && (
          <div className={styles.seriesProgress}>
            <div className={styles.seriesProgressLabel}>
              <span>Episode {episodeNumber} of {totalEpisodes}</span>
              <span>{Math.round((episodeNumber / totalEpisodes) * 100)}%</span>
            </div>
            <div className={styles.seriesProgressBar}>
              <div
                className={styles.seriesProgressFill}
                style={{ width: `${(episodeNumber / totalEpisodes) * 100}%` }}
              />
            </div>
          </div>
        )}
                  <label className={styles.settingToggle}>
                    <input
                      type="checkbox"
                      checked={clientAutoSkip}
                      onChange={(e) => {
                        setClientAutoSkip(e.target.checked);
                        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoSkipIntroOutro: e.target.checked }) });
                      }}
                    />
                    <span>Auto Skip</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {showWarning && (
          <div className={styles.warningBanner}>
            <div className={styles.warningLeft}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.infoIcon}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>If the current server doesn't work, feel free to try the other available servers</span>
            </div>
            <button className={styles.dismissBtn} onClick={() => setShowWarning(false)}>×</button>
          </div>
        )}

        <div className={styles.controlsRow}>
          <div className={styles.serverPickerWrapper}>
            <ServerPicker
              servers={sources}
              activeServerId={activeServerId}
              onSelectServer={setActiveServerId}
            />
            <button
              className={`${styles.dubSubBtn} ${isDub ? styles.dubActive : ''}`}
              onClick={() => setIsDub(!isDub)}
            >
              🌐 {isDub ? 'DUB' : 'SUB'}
            </button>
          </div>
          <div className={styles.actionsGroup}>
            <StatusDropdownButton
              animeId={media.id}
              animeTitle={media.title.english || media.title.romaji}
              onOpenEditor={() => setShowEditor(true)}
              onStatusUpdated={fetchWatchlistStatus}
              isAiring={media.status === 'RELEASING'}
            />
            <button className={styles.secondaryButton} onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(() => {
                const btn = document.querySelector(`.${styles.secondaryButton}`);
                if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => { btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Share'; }, 2000); }
              });
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              Share
            </button>
          </div>
        </div>

        <div className={styles.detailsSection}>
          <div className={styles.episodeHeaderRow}>
            <h1 className={styles.episodeTitle}>
              {getEpisodeTitle(media, episodeNumber, jikanEpisodes, reanimeEpisodes)}
            </h1>
            {watchlistStatus && (
              <span className={`${styles.statusPill} ${styles[watchlistStatus]}`}>
                {STATUS_LABELS[watchlistStatus]}
              </span>
            )}
          </div>

          <div className={styles.episodeMeta}>
            <span className={styles.epNumber}>Ep {episodeNumber}</span>
            <span className={styles.epDot}>·</span>
            <span>{media.format?.replace('_', ' ') || 'TV Show'}</span>
            <span className={styles.epDot}>·</span>
            <span>{media.title.english || media.title.romaji}</span>
          </div>

          <p className={styles.synopsis}>
            {stripHtml(media.description || '') || 'No episode synopsis available.'}
          </p>

          <div className={styles.genreList}>
            {media.genres?.map((g: string) => (
              <span key={g} className={styles.genrePill}>{g}</span>
            ))}
          </div>
        </div>

        <div className={styles.animeInfoCard}>
          {media.coverImage?.extraLarge && (
            <div className={styles.animeCover} suppressHydrationWarning>
              <img
                src={media.coverImage.extraLarge}
                alt={media.title.romaji || 'Cover'}
                width={120}
                height={170}
                className={styles.animeCoverImg}
                suppressHydrationWarning
                onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }}
              />
            </div>
          )}
          <div className={styles.animeMetaDetails}>
            <h2 className={styles.animeMetaTitle}>
              {media.title.english || media.title.romaji}
              {media.averageScore && (
                <span className={styles.animeScore}>
                  ★ {media.averageScore}% Rating
                </span>
              )}
            </h2>
            <div className={styles.animeMetaPills}>
              <span>{media.season} {media.seasonYear}</span>
              <span>·</span>
              <span>{media.format?.replace('_', ' ')}</span>
              <span>·</span>
              <span>{media.episodes ? `${media.episodes} Episodes` : 'Ongoing'}</span>
            </div>
            <p className={styles.animeSynopsisText}>
              {displaySynopsis}
              {animeSynopsis.length > 250 && (
                <button
                  className={styles.showMoreBtn}
                  onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                >
                  {showFullSynopsis ? 'Show less' : 'Show more'}
                </button>
              )}
            </p>
          </div>
        </div>

        <EpisodeGrid
          animeId={media.id}
          totalEpisodes={totalEpisodes}
          currentEpisode={episodeNumber}
        />
      </div>

      <button
        className={styles.mobileEpToggle}
        onClick={() => setShowEpisodeList(!showEpisodeList)}
      >
        {showEpisodeList ? '✕ Close Episodes' : `☰ Episodes (${episodeNumber}/${totalEpisodes || '?'})`}
      </button>

      {showEpisodeList && <div className={styles.railOverlay} onClick={() => setShowEpisodeList(false)} />}
      <aside className={`${styles.rightRail} ${showEpisodeList ? styles.rightRailOpen : ''}`}>
        <div className={styles.upNextHeader}>
          <div>
            <h2>Up Next - {getEpisodeTitle(media, totalEpisodes > 0 && episodeNumber + 1 <= totalEpisodes ? episodeNumber + 1 : episodeNumber, jikanEpisodes, reanimeEpisodes)}</h2>
            <p className={styles.upNextSub}>Playing - Episode {episodeNumber} - {media.title.english || media.title.romaji}</p>
          </div>
          <div className={styles.headerIcons}>
            <button
              className={`${styles.iconBtn} ${isGridView ? styles.iconBtnActive : ''}`}
              onClick={() => setIsGridView(!isGridView)}
              title={isGridView ? "List View" : "Grid View"}
            >
              {isGridView ? '☰' : '⊞'}
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? "Sort Descending" : "Sort Ascending"}
            >
              {sortOrder === 'asc' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        <div className={styles.searchBarRow}>
          <input
            type="text"
            placeholder="Search Episode"
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isGridView ? (
          <div className={styles.episodeGrid}>
            {sortedEpisodes.map((epNum) => {
              const isCurrent = epNum === episodeNumber;
              return (
                  <Link
                    key={epNum}
                    href={`/watch/${media.id}/${epNum}`}
                    className={`${styles.gridEpItem} ${isCurrent ? styles.activeGridEpItem : ''}`}
                  >
                    {watchedEpisodes.has(epNum) && <span className={styles.epCheckmark}>✓</span>}
                    {epNum}
                  </Link>
              );
            })}
          </div>
        ) : (
          <div className={styles.episodeList} ref={episodeListRef}>
            {sortedEpisodes.map((epNum) => {
              const isCurrent = epNum === episodeNumber;
              const thumb = getEpisodeThumb(media, epNum, reanimeEpisodes);
              const title = getEpisodeTitle(media, epNum, jikanEpisodes, reanimeEpisodes);

              return (
                <Link
                  key={epNum}
                  href={`/watch/${media.id}/${epNum}`}
                  className={`${styles.epRow} ${isCurrent ? styles.activeEpRow : ''}`}
                >
                  <div className={styles.epThumbContainer} suppressHydrationWarning>
                    {thumb && (
                      <img
                        src={thumb}
                        alt={title}
                        className={styles.epThumb}
                        suppressHydrationWarning
                        onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }}
                      />
                    )}
                    <div className={styles.epNumOverlay}>
                      {watchedEpisodes.has(epNum) && <span className={styles.epCheckmark}>✓</span>}
                      Ep {epNum}
                    </div>
                  </div>
                  <div className={styles.epInfo}>
                    <div className={styles.epTitle}>{title}</div>
                    <div className={styles.epSub}>{media.format?.replace('_', ' ') || 'TV Show'}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {countdownText && (
          <div className={styles.railCountdown}>
            <span className={styles.airingDot} />
            <span className={styles.countdownMsg}>✨ <strong>Next airing:</strong> {countdownText}</span>
          </div>
        )}

        {hasRelations && (
          <div className={styles.relationsSection}>
            <h3 className={styles.relationsHeader}>Related Anime</h3>
            <div className={styles.relationsList}>
              {[...prequels, ...sequels, ...sideStories, ...alternatives, ...spinOffs, ...summaries].map((relMedia: any) => {
                const relTitle = relMedia.title?.english || relMedia.title?.romaji || 'Unknown';
                let relType = 'RELATED';
                if (prequels.includes(relMedia)) relType = 'PREQUEL';
                else if (sequels.includes(relMedia)) relType = 'SEQUEL';
                else if (sideStories.includes(relMedia)) relType = 'SIDE STORY';
                else if (alternatives.includes(relMedia)) relType = 'ALTERNATIVE';
                else if (spinOffs.includes(relMedia)) relType = 'SPIN OFF';
                else if (summaries.includes(relMedia)) relType = 'SUMMARY';
                return (
                  <Link
                    key={relMedia.id}
                    href={`/anime/${relMedia.id}`}
                    className={styles.relRow}
                    style={{ position: 'relative' }}
                  >
                    {relMedia.coverImage?.medium && (
                      <div className={styles.relThumbContainer} suppressHydrationWarning>
                        <img
                          src={relMedia.coverImage.medium}
                          alt={relTitle}
                          width={48}
                          height={68}
                          className={styles.relThumb}
                          suppressHydrationWarning
                          onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }}
                        />
                        <span className={styles.relTypeBadge} style={{
                          backgroundColor: relType === 'PREQUEL' ? 'rgba(99,102,241,0.2)' : relType === 'SEQUEL' ? 'rgba(16,185,129,0.2)' : relType === 'SIDE STORY' ? 'rgba(245,158,11,0.2)' : relType === 'ALTERNATIVE' ? 'rgba(236,72,153,0.2)' : relType === 'SPIN OFF' ? 'rgba(139,92,246,0.2)' : 'rgba(107,114,128,0.2)',
                          color: relType === 'PREQUEL' ? '#818cf8' : relType === 'SEQUEL' ? '#34d399' : relType === 'SIDE STORY' ? '#fbbf24' : relType === 'ALTERNATIVE' ? '#f472b6' : relType === 'SPIN OFF' ? '#a78bfa' : '#9ca3af',
                        }}>{relType}</span>
                      </div>
                    )}
                    <div className={styles.relInfo}>
                      <div className={styles.relTitle}>{relTitle}</div>
                      <div className={styles.relMeta}>
                        <span>{relMedia.format?.replace('_', ' ')}</span>
                        {relMedia.season && <span>{relMedia.season} {relMedia.seasonYear}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {media.recommendations?.nodes?.length > 0 && (
          <div className={styles.recommendationsSection}>
            <h3 className={styles.recsHeader}>More Like This</h3>
            <div className={styles.stackedRecList}>
              {media.recommendations.nodes.slice(0, 10).map((rec: any) => {
                const recMedia = rec.mediaRecommendation;
                if (!recMedia) return null;
                return (
                  <StackedAnimeCard
                    key={recMedia.id}
                    id={recMedia.id}
                    poster={recMedia.coverImage?.medium || recMedia.coverImage?.large || null}
                    title={recMedia.title?.english || recMedia.title?.romaji || 'Untitled'}
                    format={recMedia.format}
                    year={recMedia.seasonYear}
                    status={recMedia.status}
                    score={recMedia.averageScore}
                    synopsis={recMedia.description}
                    genres={recMedia.genres || []}
                  />
                );
              })}
            </div>
          </div>
        )}
      </aside>

      {showEditor && (
        <WatchlistEditorModal
          isOpen={showEditor}
          onClose={() => setShowEditor(false)}
          animeId={media.id}
          animeTitle={media.title.english || media.title.romaji}
          posterUrl={media.coverImage?.extraLarge || null}
          totalEpisodes={media.episodes}
          onSaveSuccess={fetchWatchlistStatus}
        />
      )}
    </main>
  );
}
