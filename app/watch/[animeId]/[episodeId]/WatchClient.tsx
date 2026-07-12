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

export default function WatchClient({ media, episodeNumber }: WatchClientProps) {
  const [sources, setSources] = useState<ServerSource[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    fetch(`/api/stream/${media.id}/${episodeNumber}`)
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

    return () => { isMounted = false; };
  }, [media.id, episodeNumber]);

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
      
      countdownText = `Episode ${nextAiring.episode} airs in ${parts.join(' ')}`;
    }
  }

  // Derive episode title if available from streamingEpisodes, or default
  const episodeObj = media.streamingEpisodes?.find((ep: any) => {
    // Sometimes title format is "Episode 1 - Title"
    return ep.title.includes(`Episode ${episodeNumber}`) || ep.title.startsWith(`Ep ${episodeNumber}`);
  });
  const episodeTitle = episodeObj ? episodeObj.title : `Episode ${episodeNumber}`;

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

        {countdownText && (
          <div className={styles.airingCountdown}>
            <span className={styles.airingDot} />
            <span className={styles.countdownMsg}>✨ <strong>Next Episode:</strong> {countdownText}</span>
          </div>
        )}

        <div className={styles.warningBanner}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.infoIcon}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          If the current server doesn't work, feel free to try the other available servers
        </div>

        <div className={styles.controlsRow}>
          <div className={styles.serverPickerWrapper}>
            <ServerPicker 
              servers={sources}
              activeServerId={activeServerId}
              onSelectServer={setActiveServerId}
            />
          </div>
          <div className={styles.actionsGroup}>
            <StatusDropdownButton
              animeId={media.id}
              animeTitle={media.title.english || media.title.romaji}
              onOpenEditor={() => setShowEditor(true)}
              isAiring={media.status === 'RELEASING'}
            />
            <button className={styles.secondaryButton}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              Share
            </button>
          </div>
        </div>

        <div className={styles.detailsSection}>
          <h1 className={styles.episodeTitle}>
            {episodeTitle}
            <span className={styles.statusPill}>Watching</span>
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
      </div>

      <aside className={styles.rightRail}>
        <div className={styles.upNextHeader}>
          <h2>Up Next</h2>
        </div>
        
        <div className={styles.episodeList}>
          {Array.from({ length: media.episodes || 12 }).map((_, i) => {
            const epNum = i + 1;
            const isCurrent = epNum === episodeNumber;
            // Best effort episode thumbnail or anime banner as fallback
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
