'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import TabNav, { type Tab } from '@/components/shared/TabNav';
import AnimeCard from '@/components/cards/AnimeCard';
import StatusDropdownButton from '@/components/detail/StatusDropdownButton';
import WatchlistEditorModal from '@/components/detail/WatchlistEditorModal';
import Lightbox from '@/components/ui/Lightbox';
import { anilistMediaToAnime, getMediaCharacters, getMediaStaff } from '@/lib/data-api';
import type { AniListMedia, CharacterWithVA, StaffEntry } from '@/types';
import styles from './page.module.css';

interface AnimeDetailClientProps {
  media: AniListMedia;
}

const DETAIL_TABS: Tab[] = [
  { key: 'episodes', label: 'Episodes' },
  { key: 'characters', label: 'Characters' },
  { key: 'staff', label: 'Staff' },
  { key: 'stats', label: 'Stats' },
  { key: 'related', label: 'Related' },
  { key: 'recommendations', label: 'More Like This' },
];

function AnimeDetailClientInner({ media }: AnimeDetailClientProps) {
  const [activeTab, setActiveTab] = useState('episodes');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [watchlistVersion, setWatchlistVersion] = useState(0);
  const [jikanEpisodes, setJikanEpisodes] = useState<any[]>([]);
  const [reanimeEpisodes, setReanimeEpisodes] = useState<Array<{ episode_number: number; title: string | null; thumbnail: string | null }>>([]);
  const [jikanCharacters, setJikanCharacters] = useState<CharacterWithVA[]>([]);
  const [jikanStaff, setJikanStaff] = useState<StaffEntry[]>([]);
  const [charsLoading, setCharsLoading] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [watchProgress, setWatchProgress] = useState<Record<number, { secondsWatched: number; durationSeconds: number }>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!media.idMal && !media.id) return;

    setCharsLoading(true);
    setEpisodesLoading(true);

    // Fetch episodes (reanime.to + Jikan synopses) and characters/staff in parallel
    Promise.allSettled([
      // Episodes via meta endpoint (reanime.to thumbnails + Jikan synopses)
      fetch(`/api/meta?action=episodes&id=${media.id}${media.idMal ? `&malId=${media.idMal}` : ''}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => {
          if (d.episodes?.length) setReanimeEpisodes(d.episodes);
          if (d.jikanEpisodes?.length) setJikanEpisodes(d.jikanEpisodes);
        }),
      // Characters with voice actors
      media.idMal ? getMediaCharacters(media.idMal).then(setJikanCharacters) : Promise.resolve(),
      // Staff
      media.idMal ? getMediaStaff(media.idMal).then(setJikanStaff) : Promise.resolve(),
    ]).finally(() => { setCharsLoading(false); setEpisodesLoading(false); });
  }, [media.idMal, media.id]);

  useEffect(() => {
    fetch(`/api/progress/anime?anilistId=${media.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch progress');
        return res.json();
      })
      .then((data) => {
        if (data.progress) {
          setWatchProgress(data.progress);
        }
      })
      .catch(() => {});
  }, [media.id]);

  const anime = anilistMediaToAnime(media);

  // Clean HTML from synopsis
  const cleanSynopsis = media.description
    ? media.description.replace(/<[^>]*>/g, '').trim()
    : 'No synopsis available.';

  const formatAirDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Airing countdown info
  const formatAiringCountdown = (timestamp: number) => {
    const diff = timestamp * 1000 - Date.now();
    if (diff <= 0) return 'Airing soon';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) {
      return `Ep airing in ${days}d ${hours}h`;
    }
    return `Ep airing in ${hours}h`;
  };

  const handleWatchlistUpdate = () => {
    // Increment version to trigger status button refetch
    setWatchlistVersion((v) => v + 1);
  };

  return (
    <div className={styles.page}>
      {/* Hero Banner Section */}
      <div className={styles.bannerWrap}>
        {media.bannerImage ? (
          <img src={media.bannerImage} alt="" className={styles.bannerImage} suppressHydrationWarning onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-surface)' }} />
        )}
        <div className={styles.bannerOverlay} />
      </div>

      {/* Main Content Area */}
      <div className={styles.content}>
        {/* Left column - Poster & Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.posterWrap}>
            {media.coverImage?.extraLarge || media.coverImage?.large ? (
              <img
                src={media.coverImage.extraLarge || media.coverImage.large || ''}
                alt={anime.titleEnglish || anime.titleRomaji || ''}
                className={styles.posterImage}
                suppressHydrationWarning
                onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-surface-hover)' }} />
            )}
          </div>

          <div className={styles.sidebarActions}>
            {media.nextAiringEpisode && (
              <div className={styles.airingSoonPill}>
                🔔 {formatAiringCountdown(media.nextAiringEpisode.airingAt)}
              </div>
            )}
          </div>

          {/* Sidebar Metadata List */}
          <div className={styles.metaList}>
            {media.format && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Format</span>
                <span className={styles.metaValue}>{media.format.replace('_', ' ')}</span>
              </div>
            )}
            {media.status && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Status</span>
                <span
                  className={styles.metaValue}
                  style={{
                    color: media.status === 'RELEASING' ? 'var(--accent-airing)' : 'inherit',
                  }}
                >
                  {media.status === 'RELEASING'
                    ? 'Airing'
                    : media.status === 'FINISHED'
                    ? 'Finished'
                    : media.status.replace('_', ' ')}
                </span>
              </div>
            )}
            {media.season && media.seasonYear && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Season</span>
                <span className={styles.metaValue}>
                  {media.season.charAt(0) + media.season.slice(1).toLowerCase()} {media.seasonYear}
                </span>
              </div>
            )}
            {(() => {
              const tvRelations = media.relations?.edges?.filter(
                (edge) => (edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL') && edge.node.format === 'TV'
              ) || [];
              const totalSeasons = tvRelations.length + 1;
              if (totalSeasons > 1) {
                return (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Seasons</span>
                    <span className={styles.metaValue}>{totalSeasons} Seasons</span>
                  </div>
                );
              }
              return null;
            })()}
            {media.episodes && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Episodes</span>
                <span className={styles.metaValue}>{media.episodes}</span>
              </div>
            )}
            {media.averageScore && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Average Score</span>
                <span className={styles.metaValue}>{media.averageScore}%</span>
              </div>
            )}
            {media.source && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Source</span>
                <span className={styles.metaValue}>{media.source.replace('_', ' ')}</span>
              </div>
            )}
            {media.rating && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Rating</span>
                <span className={styles.metaValue}>{media.rating}</span>
              </div>
            )}
            {media.duration && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Duration</span>
                <span className={styles.metaValue}>{media.duration} min</span>
              </div>
            )}
            {(media.subbed || media.dubbed) && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Available</span>
                <span className={styles.metaValue}>
                  {media.subbed ? `${media.subbed} Sub` : ''}
                  {media.subbed && media.dubbed ? ' | ' : ''}
                  {media.dubbed ? `${media.dubbed} Dub` : ''}
                </span>
              </div>
            )}
            {media.hashtag && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Hashtag</span>
                <span className={styles.metaValue}>{media.hashtag}</span>
              </div>
            )}
            {media.startDate && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Aired</span>
                <span className={styles.metaValue}>
                  {media.startDate.month}/{media.startDate.day}/{media.startDate.year}
                  {media.endDate ? ` - ${media.endDate.month}/${media.endDate.day}/${media.endDate.year}` : ''}
                </span>
              </div>
            )}
            {anime.studios.length > 0 && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Studios</span>
                <div className={styles.chipGrid}>
                  {anime.studios.map((studio) => (
                    <span key={studio} className={styles.metaChip}>
                      {studio}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {media.externalLinks && media.externalLinks.length > 0 && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Links</span>
                <div className={styles.chipGrid}>
                  {media.externalLinks.filter(l => l.type !== 'INFO' || l.site === 'Official Site').slice(0, 6).map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.metaChip}
                      style={{ textDecoration: 'none', color: 'var(--text-primary)' }}
                    >
                      {link.site}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Title, tabs, and content */}
        <div className={styles.mainDetails}>
          {media.seasonYear && (
            <div className={styles.seasonLabel}>
              {media.season} {media.seasonYear}
            </div>
          )}
          <h1 className={styles.title}>
            {anime.titleEnglish || anime.titleRomaji || 'Untitled Anime'}
          </h1>

          <div className={styles.genresRow}>
            {anime.genres.map((genre) => (
              <span key={genre} className="genre-pill">
                {genre}
              </span>
            ))}
          </div>

          {/* Action Row */}
          <div className={styles.actionRow}>
            <Link
              href={`/watch/${media.id}/${(() => {
                const epNums = Object.keys(watchProgress).map(Number).filter(n => !isNaN(n));
                if (epNums.length === 0) return 1;
                const maxEp = Math.max(...epNums);
                const maxProgress = watchProgress[maxEp];
                if (maxProgress && maxProgress.secondsWatched / maxProgress.durationSeconds < 0.9) return maxEp;
                return maxEp + 1;
              })()}`}
              className="btn btn--primary btn--pill btn--lg"
              style={{ textDecoration: 'none', color: 'white' }}
            >
              {Object.keys(watchProgress).length > 0 ? '▶ Continue Watching' : '▶ Watch Now'}
            </Link>

            <StatusDropdownButton
              key={watchlistVersion}
              animeId={media.id}
              animeTitle={anime.titleEnglish || anime.titleRomaji || ''}
              onOpenEditor={() => setIsEditorOpen(true)}
              onStatusUpdated={handleWatchlistUpdate}
            />

            <a
              href={`https://anilist.co/anime/${media.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.externalLink}
              title="View on AniList"
            >
              AL
            </a>
            {media.trailer?.id && (
              <button
                className={styles.trailerBtn}
                onClick={() => setShowTrailer(true)}
                title="Watch Trailer"
              >
                ▶ Trailer
              </button>
            )}
          </div>

          {/* Synopsis */}
          <div className={styles.synopsisSection}>
            <h3 className={styles.sectionTitle}>Synopsis</h3>
            <p className={styles.synopsisText}>{cleanSynopsis}</p>
          </div>

          {/* Artworks Gallery */}
          {media.artworks && media.artworks.length > 1 && (
            <div>
              <h3 className={styles.sectionTitle}>Gallery</h3>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x mandatory' }}>
                {media.artworks.slice(0, 10).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    style={{ height: 120, borderRadius: 8, objectFit: 'cover', scrollSnapAlign: 'start', flexShrink: 0, border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'transform 0.2s' }}
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    onClick={() => setLightboxIndex(i)}
                    onMouseEnter={(e) => { (e.target as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                    onMouseLeave={(e) => { (e.target as HTMLImageElement).style.transform = ''; }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tab bar Navigation */}
          <div className={styles.tabsContainer}>
            <TabNav
              tabs={DETAIL_TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              variant="underline"
            />

            {/* Tab Panels */}
            {activeTab === 'episodes' && (
              <div>
                <div className={styles.episodesHeader}>
                  <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
                    Episodes
                    {!episodesLoading && (() => {
                      const isNotYetReleased = media.status === 'NOT_YET_RELEASED';
                      const actualEpisodes = reanimeEpisodes.length || jikanEpisodes.length || media.streamingEpisodes?.length || 0;
                      const ec = isNotYetReleased ? 0 : (actualEpisodes || media.episodes || (media as any).lastEpisode || (media.nextAiringEpisode ? media.nextAiringEpisode.episode - 1 : 0) || 0);
                      return ec > 0 ? (
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>
                          ({ec})
                        </span>
                      ) : null;
                    })()}
                  </h3>
                </div>
                
                {episodesLoading ? (
                  <div className={styles.episodesGrid}>
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className={styles.episodeCard} style={{ opacity: 0.5 }}>
                        <div className={styles.epThumbWrap} style={{ background: 'var(--bg-surface)' }} />
                        <div className={styles.epInfo}>
                          <div className={styles.epTitle} style={{ background: 'var(--bg-surface)', borderRadius: 4, height: 14, width: '70%' }} />
                          <div className={styles.epSynopsis} style={{ background: 'var(--bg-surface)', borderRadius: 4, height: 12, width: '90%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className={styles.episodesGrid}>
                  {(() => {
                    const isNotYetReleased = media.status === 'NOT_YET_RELEASED';
                    const actualEpisodes = reanimeEpisodes.length || jikanEpisodes.length || media.streamingEpisodes?.length || 0;
                    const epCount = isNotYetReleased ? 0 : (actualEpisodes || media.episodes || (media as any).lastEpisode || (media.nextAiringEpisode ? media.nextAiringEpisode.episode - 1 : 0) || 0);
                    if (epCount === 0 && !media.streamingEpisodes?.length) {
                      return <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>{isNotYetReleased ? 'This anime has not been released yet. No episodes available.' : 'No episode data available yet.'}</p>;
                    }
                    return Array.from({ length: epCount || media.streamingEpisodes?.length || 0 }, (_, i) => {
                    const epNum = i + 1;
                    const streamingEp = media.streamingEpisodes?.find((ep: any) => {
                      const match = ep.title?.match(/(?:Episode|Ep|Chapter)\s*(\d+)/i);
                      return match && parseInt(match[1]) === epNum;
                    });
                    const reanimeEp = reanimeEpisodes.find((e: any) => e.episode_number === epNum);
                    const jikanEp = jikanEpisodes.find((e: any) => e.mal_id === epNum);
                    // Helper: ignore reanime "Episode N" generic titles — they're not real titles
                    const isGenericTitle = (t: string | null | undefined) =>
                      !t || /^episode\s*\d+$/i.test(t.trim());
                    const epTitle =
                      (!isGenericTitle(reanimeEp?.title) ? reanimeEp?.title : null) ||
                      (jikanEp?.title_english && jikanEp.title_english.trim()) ||
                      (jikanEp?.title && jikanEp.title.trim()) ||
                      (streamingEp?.title
                        ? (streamingEp.title.replace(/^(?:Episode|Ep|Chapter)\s*\d+[:\s\-–]*/i, '').trim() || `Episode ${epNum}`)
                        : null) ||
                      `Episode ${epNum}`;
                    const epThumb =
                      reanimeEp?.thumbnail ||
                      jikanEp?.images?.jpg?.large_image_url ||
                      streamingEp?.thumbnail ||
                      media.bannerImage ||
                      media.coverImage?.large ||
                      '';
                    const progress = watchProgress[epNum];
                    const hasProgress = progress && progress.durationSeconds > 0;
                    const pct = hasProgress ? Math.min(progress.secondsWatched / progress.durationSeconds, 1) : 0;
                    const isWatched = pct >= 0.9;
                    // Strip HTML from synopsis
                    const epSynopsis = jikanEp?.synopsis
                      ? jikanEp.synopsis.replace(/<[^>]*>/g, '').trim()
                      : null;

                    return (
                      <Link
                        key={epNum}
                        href={`/watch/${media.id}/${epNum}`}
                        className={styles.episodeCard}
                      >
                        <div className={styles.epThumbWrap}>
                          <img
                            src={epThumb}
                            alt=""
                            className={styles.epThumb}
                            loading="lazy"
                            suppressHydrationWarning
                            onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }}
                          />
                          <span className={styles.epBadge}>Ep {epNum}</span>
                          {jikanEp && (jikanEp.filler || jikanEp.recap) && (
                            <div className={styles.epThumbBadges}>
                              {jikanEp.filler && <span className={styles.fillerBadge}>Filler</span>}
                              {jikanEp.recap && <span className={styles.recapBadge}>Recap</span>}
                            </div>
                          )}
                        </div>
                        <div className={styles.epInfo}>
                          <div className={styles.epTitle}>{epTitle}</div>
                          {epSynopsis && (
                            <div className={styles.epSynopsis}>{epSynopsis}</div>
                          )}
                          {formatAirDate(jikanEp?.aired) && (
                            <div className={styles.epAirDate}>Aired: {formatAirDate(jikanEp.aired)}</div>
                          )}
                          {hasProgress && (
                            <>
                              <div className={styles.epStatusText + ' ' + (isWatched ? styles.watchedText : styles.resumeText)}>
                                {isWatched ? '✓ Watched' : '▶ Resume'}
                              </div>
                              <div className={styles.progressBarWrap}>
                                <div className={styles.progressBar} style={{ width: `${pct * 100}%` }} />
                              </div>
                            </>
                          )}
                        </div>
                      </Link>
                    );
                  });
                  })()}
                </div>
                )}
              </div>
            )}

            {activeTab === 'characters' && (
              <div>
                <h3 className={styles.sectionTitle}>Characters &amp; Voice Actors</h3>
                {charsLoading ? (
                  <p style={{ color: 'var(--text-muted)' }}>Loading characters...</p>
                ) : jikanCharacters.length > 0 ? (
                  <div className={styles.charactersGrid}>
                    {jikanCharacters.map((entry, index) => {
                      const va = entry.voiceActors?.find(v => v.language === 'Japanese') || entry.voiceActors?.[0];
                      return (
                        <div key={`${entry.id}-${index}`} className={styles.charCard}>
                          {/* Character Part */}
                          <Link href={`/character/${entry.malId}`} className={styles.charHalf}>
                            {entry.image && (
                              <img src={entry.image} alt="" className={styles.charImage} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }} />
                            )}
                            <div className={styles.charMeta}>
                              <span className={styles.charName}>{entry.name}</span>
                              <span className={styles.charRole}>{entry.role}</span>
                            </div>
                          </Link>
                          {/* VA Part */}
                          <div className={styles.vaHalf}>
                            {va?.image && (
                              <img src={va.image} alt="" className={styles.vaImage} onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }} />
                            )}
                            <div className={styles.vaMeta}>
                              <span className={styles.vaName}>{va ? va.name : 'N/A'}</span>
                              <span className={styles.vaLang}>{va ? va.language : ''}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : media.characters?.edges && media.characters.edges.length > 0 ? (
                  <div className={styles.charactersGrid}>
                    {media.characters.edges.map((edge, index) => {
                      const character = edge.node;
                      const va = edge.voiceActors?.find(v => v.languageV2 === 'Japanese') || edge.voiceActors?.[0];
                      return (
                        <div key={`${character.id}-${index}`} className={styles.charCard}>
                          <div className={styles.charHalf}>
                            {character.image?.large && (
                              <img src={character.image.large} alt="" className={styles.charImage} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }} />
                            )}
                            <div className={styles.charMeta}>
                              <span className={styles.charName}>{character.name.full}</span>
                              <span className={styles.charRole}>{edge.role}</span>
                            </div>
                          </div>
                          <div className={styles.vaHalf}>
                            {va?.image?.large && (
                              <img src={va.image.large} alt="" className={styles.vaImage} onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }} />
                            )}
                            <div className={styles.vaMeta}>
                              <span className={styles.vaName}>{va ? va.name?.full : 'N/A'}</span>
                              <span className={styles.vaLang}>{va ? (va.languageV2 || '') : ''}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No character data available.</p>
                )}
              </div>
            )}

            {activeTab === 'staff' && (
              <div>
                <h3 className={styles.sectionTitle}>Staff</h3>
                {charsLoading ? (
                  <p style={{ color: 'var(--text-muted)' }}>Loading staff...</p>
                ) : jikanStaff.length > 0 ? (
                  <div className={styles.charactersGrid}>
                    {jikanStaff.map((entry, index) => (
                      <div key={`${entry.id}-${index}`} className={styles.charCard}>
                        <div className={styles.charHalf}>
                          {entry.image && (
                            <img src={entry.image} alt="" className={styles.charImage} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }} />
                          )}
                          <div className={styles.charMeta}>
                            <span className={styles.charName}>{entry.name}</span>
                            <span className={styles.charRole}>{entry.roles.join(', ')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : media.staff?.edges && media.staff.edges.length > 0 ? (
                  <div className={styles.charactersGrid}>
                    {media.staff.edges.map((edge, index) => (
                      <div key={`${edge.node.id}-${index}`} className={styles.charCard}>
                        <div className={styles.charHalf}>
                          {edge.node.image?.large && (
                            <img src={edge.node.image.large} alt="" className={styles.charImage} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }} />
                          )}
                          <div className={styles.charMeta}>
                            <span className={styles.charName}>{edge.node.name.full}</span>
                            <span className={styles.charRole}>{edge.role}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No staff data available.</p>
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div>
                <h3 className={styles.sectionTitle}>Statistics</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
                  {media.averageScore && (
                    <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Score</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>{media.averageScore}%</div>
                    </div>
                  )}
                  {media.meanScore && (
                    <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mean Score</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-airing)', marginTop: 4 }}>{media.meanScore}%</div>
                    </div>
                  )}
                  {media.popularity && (
                    <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Popularity</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>#{media.popularity.toLocaleString()}</div>
                    </div>
                  )}
                  {media.favourites != null && (
                    <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Favourites</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#f43f5e', marginTop: 4 }}>{media.favourites.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {media.stats?.scoreDistribution && media.stats.scoreDistribution.length > 0 && (() => {
                  const dist = media.stats.scoreDistribution!;
                  const maxAmount = dist.length > 0 ? Math.max(...dist.map((d) => d.amount)) : 0;
                  return (
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Score Distribution</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {dist.map((s) => {
                        const pct = maxAmount > 0 ? (s.amount / maxAmount) * 100 : 0;
                        return (
                          <div key={s.score} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 24, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.score}</span>
                            <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: 4, transition: 'width 0.5s' }} />
                            </div>
                            <span style={{ width: 40, fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.amount}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'related' && (
              <div>
                <h3 className={styles.sectionTitle}>Relations</h3>
                {media.relations?.edges && media.relations.edges.length > 0 ? (
                  <div className={styles.relationsGrid}>
                    {media.relations.edges
                      .filter((edge) => {
                        if (!edge.node) return false;
                        const fmt = (edge.node.format as string)?.toUpperCase() || '';
                        return ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'].includes(fmt);
                      })
                      .map((edge, index) => {
                        const rel = edge.node;
                        const relType = edge.relationType.replace('_', ' ');
                        const isPrequel = edge.relationType === 'PREQUEL';
                        const isSequel = edge.relationType === 'SEQUEL';
                        return (
                          <div key={`${rel.id}-${index}`} className={styles.relationCard}>
                            {(isPrequel || isSequel) && (
                              <span className={`${styles.relationTypeBadge} ${isPrequel ? styles.prequelBadge : styles.sequelBadge}`}>
                                {relType}
                              </span>
                            )}
                            {!isPrequel && !isSequel && (
                              <span className={styles.relationTypeBadge}>
                                {relType}
                              </span>
                            )}
                            <AnimeCard
                              id={rel.id}
                              poster={rel.coverImage?.extraLarge || rel.coverImage?.large}
                              title={rel.title.english || rel.title.romaji || 'Untitled'}
                              format={rel.format}
                              year={rel.seasonYear}
                              status={rel.status}
                              score={rel.averageScore}
                              synopsis={rel.description}
                              genres={[]}
                            />
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No related titles available.</p>
                )}
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div>
                <h3 className={styles.sectionTitle}>More Like This</h3>
                {media.recommendations?.nodes && media.recommendations.nodes.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
                    {media.recommendations.nodes
                      .filter((n) => n.mediaRecommendation !== null)
                      .map((n, index) => {
                        const rec = n.mediaRecommendation!;
                        const card = (
                          <AnimeCard
                            id={rec.id}
                            poster={rec.coverImage?.extraLarge || rec.coverImage?.large}
                            title={rec.title.english || rec.title.romaji || 'Untitled'}
                            format={rec.format}
                            year={rec.seasonYear}
                            status={rec.status}
                            score={rec.averageScore}
                            synopsis={rec.description}
                            genres={rec.genres || []}
                          />
                        );
                        return <div key={`${rec.id}-${index}`}>{card}</div>;
                      })}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No recommendations available.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Artworks Lightbox */}
      {lightboxIndex !== null && media.artworks && (
        <Lightbox
          images={media.artworks.slice(0, 10)}
          initialIndex={lightboxIndex}
          alt={anime.titleEnglish || anime.titleRomaji || ''}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Watchlist Editor Dialog Modal */}
      <WatchlistEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        animeId={media.id}
        animeTitle={anime.titleEnglish || anime.titleRomaji || ''}
        posterUrl={media.coverImage?.large}
        totalEpisodes={media.episodes}
        onSaveSuccess={handleWatchlistUpdate}
      />

      {/* Trailer Modal */}
      {showTrailer && media.trailer?.id && (
        <div className={styles.trailerOverlay} onClick={() => setShowTrailer(false)}>
          <div className={styles.trailerModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.trailerClose} onClick={() => setShowTrailer(false)}>✕</button>
            <div className={styles.trailerEmbed}>
              <iframe
                src={`https://www.youtube.com/embed/${media.trailer.id}?autoplay=1&rel=0&showinfo=0`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Trailer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnimeDetailClient(props: AnimeDetailClientProps) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <AnimeDetailClientInner {...props} />
    </Suspense>
  );
}
