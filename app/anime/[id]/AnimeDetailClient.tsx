'use client';

import { useState } from 'react';
import Link from 'next/link';
import TabNav, { type Tab } from '@/components/shared/TabNav';
import AnimeCard from '@/components/cards/AnimeCard';
import StatusDropdownButton from '@/components/detail/StatusDropdownButton';
import WatchlistEditorModal from '@/components/detail/WatchlistEditorModal';
import { anilistMediaToAnime } from '@/lib/anilist';
import type { AniListMedia } from '@/types';
import styles from './page.module.css';

interface AnimeDetailClientProps {
  media: AniListMedia;
}

const DETAIL_TABS: Tab[] = [
  { key: 'episodes', label: 'Episodes' },
  { key: 'characters', label: 'Characters' },
  { key: 'related', label: 'Related' },
  { key: 'recommendations', label: 'More Like This' },
];

export default function AnimeDetailClient({ media }: AnimeDetailClientProps) {
  const [activeTab, setActiveTab] = useState('episodes');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [watchlistVersion, setWatchlistVersion] = useState(0);

  const anime = anilistMediaToAnime(media);

  // Clean HTML from synopsis
  const cleanSynopsis = media.description
    ? media.description.replace(/<[^>]*>/g, '').trim()
    : 'No synopsis available.';

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
          <img src={media.bannerImage} alt="" className={styles.bannerImage} suppressHydrationWarning />
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
            
            {media.trailer && media.trailer.site === 'youtube' && (
              <a
                href={`https://www.youtube.com/watch?v=${media.trailer.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--primary"
                style={{ width: '100%', textDecoration: 'none', color: 'white' }}
              >
                ▶ Watch Trailer
              </a>
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
              href={`/watch/${media.id}/1`}
              className="btn btn--primary btn--pill btn--lg"
              style={{ textDecoration: 'none', color: 'white' }}
            >
              ▶ Watch Now
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
          </div>

          {/* Synopsis */}
          <div className={styles.synopsisSection}>
            <h3 className={styles.sectionTitle}>Synopsis</h3>
            <p className={styles.synopsisText}>{cleanSynopsis}</p>
          </div>

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
                  </h3>
                </div>
                
                <div className={styles.episodesGrid}>
                  {Array.from({ length: media.episodes || (media.nextAiringEpisode ? media.nextAiringEpisode.episode - 1 : 0) || media.streamingEpisodes?.length || 12 }, (_, i) => {
                    const epNum = i + 1;
                    return (
                      <Link
                        key={epNum}
                        href={`/watch/${media.id}/${epNum}`}
                        className={styles.episodeCard}
                      >
                        <div className={styles.epThumbWrap}>
                          <img
                            src={media.bannerImage || media.coverImage?.large || ''}
                            alt=""
                            className={styles.epThumb}
                            loading="lazy"
                          />
                          <span className={styles.epBadge}>Episode {epNum}</span>
                        </div>
                        <div className={styles.epInfo}>
                          <div className={styles.epTitle}>
                            Episode {epNum}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'characters' && (
              <div>
                <h3 className={styles.sectionTitle}>Characters &amp; Voice Actors</h3>
                {media.characters?.edges && media.characters.edges.length > 0 ? (
                  <div className={styles.charactersGrid}>
                    {media.characters.edges.map((edge, index) => {
                      const character = edge.node;
                      const va = edge.voiceActors?.[0];
                      return (
                        <div key={`${character.id}-${index}`} className={styles.charCard}>
                          {/* Character Part */}
                          <div className={styles.charHalf}>
                            {character.image?.large && (
                              <img src={character.image.large} alt="" className={styles.charImage} />
                            )}
                            <div className={styles.charMeta}>
                              <span className={styles.charName}>{character.name.full}</span>
                              <span className={styles.charRole}>{edge.role}</span>
                            </div>
                          </div>
                          {/* VA Part */}
                          <div className={styles.vaHalf}>
                            {va?.image?.large && (
                              <img src={va.image.large} alt="" className={styles.vaImage} />
                            )}
                            <div className={styles.vaMeta}>
                              <span className={styles.vaName}>{va ? va.name.full : 'N/A'}</span>
                              <span className={styles.vaLang}>{va ? 'Japanese' : ''}</span>
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

            {activeTab === 'related' && (
              <div>
                <h3 className={styles.sectionTitle}>Relations</h3>
                {media.relations?.edges && media.relations.edges.length > 0 ? (
                  <div className={styles.relationsGrid}>
                    {media.relations.edges
                      .filter((edge) => edge.node.format === 'TV' || edge.node.format === 'MOVIE' || edge.node.format === 'OVA')
                      .map((edge, index) => {
                        const rel = edge.node;
                        return (
                          <div key={`${rel.id}-${index}`} className={styles.relationCard}>
                            <span className={styles.relationTypeBadge}>
                              {edge.relationType.replace('_', ' ')}
                            </span>
                            <AnimeCard
                              id={rel.id}
                              poster={rel.coverImage?.extraLarge || rel.coverImage?.large}
                              title={rel.title.english || rel.title.romaji || 'Untitled'}
                              format={rel.format}
                              year={rel.seasonYear}
                              status={rel.status}
                              score={rel.averageScore}
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
                  <div className="anime-grid">
                    {media.recommendations.nodes
                      .filter((n) => n.mediaRecommendation !== null)
                      .map((n, index) => {
                        const rec = n.mediaRecommendation!;
                        return (
                          <AnimeCard
                            key={`${rec.id}-${index}`}
                            id={rec.id}
                            poster={rec.coverImage?.extraLarge || rec.coverImage?.large}
                            title={rec.title.english || rec.title.romaji || 'Untitled'}
                            format={rec.format}
                            year={rec.seasonYear}
                            status={rec.status}
                            score={rec.averageScore}
                          />
                        );
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

      {/* Watchlist Editor Dialog Modal */}
      <WatchlistEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        animeId={media.id}
        animeTitle={anime.titleEnglish || anime.titleRomaji || ''}
        posterUrl={media.coverImage?.large}
        onSaveSuccess={handleWatchlistUpdate}
      />
    </div>
  );
}
