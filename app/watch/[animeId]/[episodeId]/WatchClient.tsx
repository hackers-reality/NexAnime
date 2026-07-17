'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import VideoPlayer from '@/components/player/VideoPlayer';
import ServerPicker from '@/components/player/ServerPicker';
import StatusDropdownButton from '@/components/detail/StatusDropdownButton';
import WatchlistEditorModal from '@/components/detail/WatchlistEditorModal';
import AnimeCard from '@/components/cards/AnimeCard';
import EpisodeGrid from '@/components/watch/EpisodeGrid';
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

function getEpisodeTitle(media: any, epNum: number, jikanEpisodes: any[] = []): string {
  if (media.streamingEpisodes?.length) {
    // Try exact match first: "Episode N: Title" or "Ep N - Title"
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

  // Fallback to Jikan (MAL) episodes list titles if available
  if (jikanEpisodes?.length) {
    const jEp = jikanEpisodes.find((e: any) => e.mal_id === epNum);
    if (jEp?.title) {
      return jEp.title_english || jEp.title || `Episode ${epNum}`;
    }
  }

  return `Episode ${epNum}`;
}

function getEpisodeThumb(media: any, epNum: number): string | null {
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

  const [watchlistStatus, setWatchlistStatus] = useState<string | null>(null);
  const [isDub, setIsDub] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isGridView, setIsGridView] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [clientAutoPlay, setClientAutoPlay] = useState(true);
  const [clientAutoSkip, setClientAutoSkip] = useState(false);
  const [jikanEpisodes, setJikanEpisodes] = useState<any[]>([]);

  useEffect(() => {
    if (!media.idMal) return;
    if (media.streamingEpisodes && media.streamingEpisodes.length > 5) return;

    fetch(`https://api.jikan.moe/v4/anime/${media.idMal}/episodes`)
      .then((res) => {
        if (!res.ok) throw new Error('Jikan API rate limit');
        return res.json();
      })
      .then((data) => {
        if (data.data) {
          setJikanEpisodes(data.data);
        }
      })
      .catch((err) => console.warn('[Jikan] Fallback episode titles unavailable:', err));
  }, [media.idMal, media.streamingEpisodes]);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setClientAutoPlay(data.settings.auto_next !== false);
          setClientAutoSkip(!!data.settings.auto_skip_intro_outro);
        }
      })
      .catch(() => {});
  }, []);

  const fetchWatchlistStatus = async () => {
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

    fetch(`/api/stream/${media.id}/${episodeNumber}?dub=${isDub}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.error) {
          setError(data.error);
        } else if (data.sources && data.sources.length > 0) {
          setSources(data.sources);
          setActiveServerId(data.sources[0].adapterId);
        } else {
          setError('No streaming sources found for this episode.');
        }
        setLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message || 'Failed to fetch streams');
        setLoading(false);
      });

    fetchWatchlistStatus();
    return () => { isMounted = false; };
  }, [media.id, episodeNumber, isDub]);

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
  const totalEpisodes = media.episodes || (nextEpisode ? nextEpisode - 1 : 0) || media.streamingEpisodes?.length || 12;
  const rawEpisodes = Array.from({ length: totalEpisodes }, (_, i) => i + 1);
  const filteredEpisodes = rawEpisodes.filter(epNum =>
    epNum.toString().includes(searchQuery) ||
    getEpisodeTitle(media, epNum, jikanEpisodes).toLowerCase().includes(searchQuery.toLowerCase())
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
  const hasRelations = prequels.length > 0 || sequels.length > 0;

  return (
    <main className={styles.container}>
      <div className={styles.leftCol}>
        <div className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span className={styles.separator}>›</span>
          <Link href={`/anime/${media.id}`}>{media.title.romaji || media.title.english}</Link>
          <span className={styles.separator}>›</span>
          <span className={styles.currentCrumb}>{getEpisodeTitle(media, episodeNumber, jikanEpisodes)}</span>
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
                    className={`${styles.navControlBtn} ${episodeNumber >= totalEpisodes ? styles.disabledBtn : ''}`}
                    onClick={(e) => episodeNumber >= totalEpisodes && e.preventDefault()}
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
              {getEpisodeTitle(media, episodeNumber, jikanEpisodes)}
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

      <aside className={styles.rightRail}>
        <div className={styles.upNextHeader}>
          <div>
            <h2>Up Next - {getEpisodeTitle(media, episodeNumber + 1 <= totalEpisodes ? episodeNumber + 1 : episodeNumber, jikanEpisodes)}</h2>
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
                  {epNum}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={styles.episodeList}>
            {sortedEpisodes.map((epNum) => {
              const isCurrent = epNum === episodeNumber;
              const thumb = getEpisodeThumb(media, epNum);
              const title = getEpisodeTitle(media, epNum, jikanEpisodes);

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
                    <div className={styles.epNumOverlay}>Ep {epNum}</div>
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
            <h3 className={styles.relationsHeader}>Sequels & Prequels</h3>
            <div className={styles.relationsList}>
              {[...prequels, ...sequels].map((relMedia: any) => {
                const relTitle = relMedia.title?.english || relMedia.title?.romaji || 'Unknown';
                const relType = prequels.includes(relMedia) ? 'PREQUEL' : 'SEQUEL';
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
                        <span className={styles.relTypeBadge}>{relType}</span>
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
            <div className={styles.horizontalCardScroll}>
              {media.recommendations.nodes.slice(0, 10).map((rec: any) => {
                const recMedia = rec.mediaRecommendation;
                if (!recMedia) return null;
                return (
                  <div key={recMedia.id} className={styles.recCardWrapper}>
                    <AnimeCard
                      id={recMedia.id}
                      poster={recMedia.coverImage?.extraLarge || recMedia.coverImage?.large || null}
                      title={recMedia.title?.english || recMedia.title?.romaji || 'Untitled'}
                      format={recMedia.format}
                      year={recMedia.seasonYear}
                      status={recMedia.status}
                      score={recMedia.averageScore}
                      synopsis={recMedia.description}
                      genres={recMedia.genres || []}
                    />
                  </div>
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
