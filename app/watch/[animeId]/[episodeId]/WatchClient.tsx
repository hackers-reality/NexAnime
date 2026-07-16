'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import VideoPlayer from '@/components/player/VideoPlayer';
import ServerPicker from '@/components/player/ServerPicker';
import StatusDropdownButton from '@/components/detail/StatusDropdownButton';
import WatchlistEditorModal from '@/components/detail/WatchlistEditorModal';
import styles from './WatchClient.module.css';

interface ServerSource {
  adapterId: string;
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

export default function WatchClient({ media, episodeNumber }: WatchClientProps) {
  const [sources, setSources] = useState<ServerSource[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // New features state
  const [watchlistStatus, setWatchlistStatus] = useState<string | null>(null);
  const [isDub, setIsDub] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isGridView, setIsGridView] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [showWarning, setShowWarning] = useState(true);

  // Fetch watchlist status
  const fetchWatchlistStatus = async () => {
    try {
      const res = await fetch(`/api/watchlist?anilistId=${media.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.entry) {
          setWatchlistStatus(data.entry.listStatus);
        } else {
          setWatchlistStatus(null);
        }
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

  // Airing countdown calculation (timezone correct using browser local system time)
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
      
      countdownText = `Episode {nextAiring.episode} airs in ${parts.join(' ')}`;
    }
  }

  // Derive episode title if available from streamingEpisodes, or default
  const episodeObj = media.streamingEpisodes?.find((ep: any) => {
    return ep.title.includes(`Episode ${episodeNumber}`) || ep.title.startsWith(`Ep ${episodeNumber}`);
  });
  const episodeTitle = episodeObj ? episodeObj.title : `Episode ${episodeNumber}`;

  // Filter and sort episode numbers
  const totalEpisodes = media.episodes || 12;
  const rawEpisodes = Array.from({ length: totalEpisodes }, (_, i) => i + 1);
  const filteredEpisodes = rawEpisodes.filter(epNum => 
    epNum.toString().includes(searchQuery) || `Episode ${epNum}`.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const sortedEpisodes = sortOrder === 'asc' ? filteredEpisodes : [...filteredEpisodes].reverse();

  // Strip html description tags helper
  const stripHtml = (htmlStr: string) => {
    if (!htmlStr) return '';
    return htmlStr.replace(/<[^>]*>/g, '');
  };

  const animeSynopsis = stripHtml(media.description || '');
  const displaySynopsis = showFullSynopsis || animeSynopsis.length <= 250
    ? animeSynopsis
    : `${animeSynopsis.slice(0, 250)}...`;

  return (
    <main className={styles.container}>
      <div className={styles.leftCol}>
        <div className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span className={styles.separator}>›</span>
          <Link href={`/anime/${media.id}`}>{media.title.romaji || media.title.english}</Link>
          <span className={styles.separator}>›</span>
          <span className={styles.currentCrumb}>Episode {episodeNumber}</span>
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
            <VideoPlayer 
              src={activeSource?.streamUrl || null} 
              animeId={media.id} 
              episodeNumber={episodeNumber} 
            />
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
            <button className={styles.secondaryButton}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              Share
            </button>
          </div>
        </div>

        {/* Dynamic Episode Details Section */}
        <div className={styles.detailsSection}>
          <h1 className={styles.episodeTitle}>
            {episodeTitle}
            {watchlistStatus && (
              <span className={`${styles.statusPill} ${styles[watchlistStatus]}`}>
                {STATUS_LABELS[watchlistStatus]}
              </span>
            )}
          </h1>
          
          <p className={styles.synopsis}>
            {episodeObj?.description ? (
              <span dangerouslySetInnerHTML={{ __html: episodeObj.description }} />
            ) : (
              'No episode synopsis available.'
            )}
          </p>

          <div className={styles.metadataCard}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Studio</span>
              <span className={styles.metaValue}>{media.studios?.nodes?.[0]?.name || 'Unknown'}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Status</span>
              <span className={styles.metaValue}>{media.status}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Aired</span>
              <span className={styles.metaValue}>
                {media.startDate?.year ? `${media.startDate.year}-${media.startDate.month}-${media.startDate.day}` : '?'}
              </span>
            </div>
          </div>

          <div className={styles.genreList}>
            {media.genres?.map((g: string) => (
              <span key={g} className={styles.genrePill}>{g}</span>
            ))}
          </div>
        </div>

        {/* NEW: Anime Information Section */}
        <div className={styles.animeInfoCard}>
          {media.coverImage?.extraLarge && (
            <div className={styles.animeCover}>
              <Image 
                src={media.coverImage.extraLarge} 
                alt={media.title.romaji || 'Cover'} 
                width={120} 
                height={170}
                className={styles.animeCoverImg}
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
              <span>•</span>
              <span>{media.format}</span>
              <span>•</span>
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
      </div>

      <aside className={styles.rightRail}>
        <div className={styles.upNextHeader}>
          <h2>Up Next</h2>
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
            placeholder="Search episode..." 
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
              const fallbackThumb = media.bannerImage || media.coverImage?.extraLarge;
              
              return (
                <Link 
                  key={epNum} 
                  href={`/watch/${media.id}/${epNum}`}
                  className={`${styles.epRow} ${isCurrent ? styles.activeEpRow : ''}`}
                >
                  <div className={styles.epThumbContainer}>
                    {fallbackThumb && (
                      <Image 
                        src={fallbackThumb} 
                        alt={`Episode ${epNum}`} 
                        fill
                        className={styles.epThumb}
                        sizes="120px"
                      />
                    )}
                    <div className={styles.epNumOverlay}>E{epNum}</div>
                  </div>
                  <div className={styles.epInfo}>
                    <div className={styles.epTitle}>Episode {epNum}</div>
                    <div className={styles.epSub}>Recently Added</div>
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

        {/* NEW: More Like This Recommendations Section */}
        {media.recommendations?.nodes?.length > 0 && (
          <div className={styles.recommendationsSection}>
            <h3 className={styles.recsHeader}>More Like This</h3>
            <div className={styles.recsList}>
              {media.recommendations.nodes.slice(0, 4).map((rec: any) => {
                const recMedia = rec.mediaRecommendation;
                if (!recMedia) return null;
                const recTitle = recMedia.title.english || recMedia.title.romaji;
                
                return (
                  <Link 
                    key={recMedia.id} 
                    href={`/anime/${recMedia.id}`}
                    className={styles.recRow}
                  >
                    {recMedia.coverImage?.large && (
                      <div className={styles.recThumbContainer}>
                        <Image 
                          src={recMedia.coverImage.large} 
                          alt={recTitle} 
                          width={48} 
                          height={68}
                          className={styles.recThumb}
                        />
                      </div>
                    )}
                    <div className={styles.recInfo}>
                      <div className={styles.recTitle}>{recTitle}</div>
                      <div className={styles.recMeta}>
                        {recMedia.averageScore && <span>★ {recMedia.averageScore}%</span>}
                        <span>{recMedia.format}</span>
                      </div>
                    </div>
                  </Link>
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
        />
      )}
    </main>
  );
}
