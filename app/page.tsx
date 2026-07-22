'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/shared/Header';
import AnimeCard from '@/components/cards/AnimeCard';
import HomeCarousel from '@/components/home/HomeCarousel';
import SkeletonCarousel from '@/components/home/SkeletonCarousel';
import ScheduleWidget from '@/components/home/ScheduleWidget';
import SkeletonGrid from '@/components/shared/SkeletonGrid';
import Image from 'next/image';
import styles from './page.module.css';

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

interface ProgressItem {
  anilist_id: number;
  episode_number: number;
  seconds_watched: number;
  duration_seconds: number;
  title_romaji: string | null;
  title_english: string | null;
  cover_image: string | null;
  ep_thumbnail: string | null;
}

interface CarouselItem {
  id: number;
  title: { romaji?: string; english?: string };
  coverImage: { extraLarge: string | null };
  bannerImage: string | null;
  description: string | null;
  genres: string[];
  trailer: string | null;
}

interface MediaItem {
  id: number;
  title: { romaji: string; english: string; native: string };
  coverImage: { extraLarge: string; large: string; medium: string };
  bannerImage: string | null;
  format: string;
  season: string;
  seasonYear: number;
  status: string;
  averageScore: number;
  description: string;
  genres: string[];
  episodes: number | null;
}

interface HomeCardItem {
  anilistId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImage: string | null;
  bannerImage: string | null;
  format: string;
  seasonYear: number | null;
  status: string;
  averageScore: number | null;
  synopsis: string;
  genres: string[];
  trailer: string | null;
}

export default function HomePage() {
  const [carouselMedia, setCarouselMedia] = useState<CarouselItem[]>([]);
  const [trendingCards, setTrendingCards] = useState<HomeCardItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ProgressItem[]>([]);
  const [thisSeasonCards, setThisSeasonCards] = useState<HomeCardItem[]>([]);
  const currentSeason = (() => {
    const m = new Date().getMonth();
    return ['WINTER', 'WINTER', 'SPRING', 'SPRING', 'SPRING', 'SUMMER', 'SUMMER', 'SUMMER', 'FALL', 'FALL', 'FALL', 'WINTER'][m];
  })();
  const [upcomingCards, setUpcomingCards] = useState<HomeCardItem[]>([]);
  const [recentlyUpdatedCards, setRecentlyUpdatedCards] = useState<any[]>([]);
  const [formattedSchedules, setFormattedSchedules] = useState<any[]>([]);
  const [activeTrendTab, setActiveTrendTab] = useState<'trending' | 'popular' | 'topRated'>('trending');
  const [tabAnime, setTabAnime] = useState<HomeCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAttempt = useRef(0);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        loadAttempt.current++;

        // Fetch ALL home data in one batch request (server runs 5 AniList queries in parallel)
        const [homeData, contData] = await Promise.all([
          fetchJSON('/api/home'),
          fetchJSON('/api/watchlist?continue=true').then(d => d || { progress: [] }),
        ]);

        if (!active) return;

        if (homeData) {
          const allTrending = (homeData.trending || []).filter((m: HomeCardItem) => m.anilistId && m.anilistId > 0);
          setCarouselMedia(allTrending.slice(0, 5).map((m: HomeCardItem): CarouselItem => ({
            id: m.anilistId,
            title: { english: m.titleEnglish ?? undefined, romaji: m.titleRomaji },
            coverImage: { extraLarge: m.coverImage },
            bannerImage: m.bannerImage ?? null,
            description: m.synopsis ?? null,
            genres: m.genres ?? [],
            trailer: m.trailer ?? null,
          })));
          setTrendingCards(allTrending.slice(5));
          setTabAnime(allTrending.slice(5));
          setThisSeasonCards(homeData.thisSeason || []);
          setUpcomingCards(homeData.upcoming || []);
          setRecentlyUpdatedCards(Array.isArray(homeData.recentlyUpdated) ? homeData.recentlyUpdated : []);
          setFormattedSchedules(homeData.schedule || []);

          // If reanime home didn't give us enough trending, pre-fetch from meta API
          if (allTrending.length < 6) {
            fetchJSON('/api/meta?action=trending&limit=15').then(fallbackData => {
              const fallbackMedia = (fallbackData?.media || []);
              if (fallbackMedia.length > 0) {
                setTabAnime(fallbackMedia);
                setTrendingCards(fallbackMedia);
              }
            }).catch(() => {});
          }
        }

        if (contData.progress) {
          setContinueWatching(contData.progress);
        }
      } catch (err) {
        console.error('Failed to load home data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, []);

  const handleTrendTabChange = async (tab: 'trending' | 'popular' | 'topRated') => {
    setActiveTrendTab(tab);
    try {
      const res = await fetch(`/api/meta?action=${tab}&limit=15`);
      const data = await res.json();
      const media = (data.media || []);
      if (media.length > 0) { setTabAnime(media); return; }
    } catch {}
    // Fallback: use trending cards we already loaded
    setTabAnime(trendingCards);
  };

  return (
    <div className={styles.container}>
      <Header />

      {loading ? (
        <>
          <SkeletonCarousel />
          <main className={styles.main}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Trending Now</h2>
            <SkeletonGrid count={8} horizontal />
          </section>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>This Season</h2>
            <SkeletonGrid count={8} horizontal />
          </section>
        </main>
        </>
      ) : (
        <>
          {carouselMedia.length > 0 && <HomeCarousel items={carouselMedia} />}

          <main className={styles.main}>
            {continueWatching.length > 0 ? (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Dive Back In</h2>
                <div className={styles.continueGrid}>
                  {continueWatching.map((item) => {
                    const percent = item.duration_seconds > 0
                      ? Math.min(100, Math.round((item.seconds_watched / item.duration_seconds) * 100))
                      : 0;
                    const title = item.title_romaji || item.title_english || 'Anime';
                    const remaining = item.duration_seconds > 0
                      ? Math.floor((item.duration_seconds - item.seconds_watched) / 60)
                      : null;
                    return (
                      <Link
                        key={`${item.anilist_id}-${item.episode_number}`}
                        href={`/watch/${item.anilist_id}/${item.episode_number}`}
                        className={styles.continueCard}
                      >
                        <div className={styles.thumbWrapper}>
                          {(item.ep_thumbnail || item.cover_image) && (
                            <Image
                              src={item.ep_thumbnail || item.cover_image!}
                              alt={title}
                              fill
                              sizes="180px"
                              className={styles.thumbImage}
                            />
                          )}
                          {remaining != null && (
                            <div className={styles.durationBadge}>{remaining}m left</div>
                          )}
                          {remaining == null && item.episode_number && (
                            <div className={styles.durationBadge}>Ep {item.episode_number}</div>
                          )}
                          {item.duration_seconds > 0 && (
                            <div className={styles.progressBar}>
                              <div className={styles.progressFill} style={{ width: `${percent}%` }} />
                            </div>
                          )}
                        </div>
                        <div className={styles.continueInfo}>
                          <h4 className={styles.continueTitle}>{title}</h4>
                          <p className={styles.continueSubtitle}>
                            Episode {item.episode_number} · {percent}% watched
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Dive Back In</h2>
                <div className={styles.emptyState}>
                  <p>Start watching anime to see your progress here!</p>
                  <Link href="/browse" className={styles.browseLink}>Browse Anime</Link>
                </div>
              </section>
            )}

            {tabAnime.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Trending Now</h2>
                <Link href="/browse?sort=POPULARITY_DESC" className={styles.viewAllLink}>
                  →
                </Link>
              </div>
              <div className={styles.trendTabs}>
                <button
                  className={`${styles.trendTab} ${activeTrendTab === 'trending' ? styles.activeTab : ''}`}
                  onClick={() => handleTrendTabChange('trending')}
                >
                  🔥 Trending
                </button>
                <button
                  className={`${styles.trendTab} ${activeTrendTab === 'popular' ? styles.activeTab : ''}`}
                  onClick={() => handleTrendTabChange('popular')}
                >
                  🏆 All Time Popular
                </button>
                <button
                  className={`${styles.trendTab} ${activeTrendTab === 'topRated' ? styles.activeTab : ''}`}
                  onClick={() => handleTrendTabChange('topRated')}
                >
                  ⭐ Top Rated
                </button>
              </div>
              <div className={styles.horizontalScroll}>
                {tabAnime.filter((a: HomeCardItem) => a.anilistId && a.anilistId > 0).map((anime: HomeCardItem) => (
                  <div key={`trend-${anime.anilistId}-${activeTrendTab}`} className={styles.cardWrapper}>
                    <AnimeCard
                      id={anime.anilistId}
                      poster={anime.coverImage}
                      title={anime.titleRomaji}
                      format={anime.format as any}
                      year={anime.seasonYear}
                      status={anime.status as any}
                      score={anime.averageScore}
                      synopsis={anime.synopsis}
                      genres={anime.genres}
                    />
                  </div>
                ))}
              </div>
            </section>
            )}

            {thisSeasonCards.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>This Season</h2>
                  <Link href={`/browse?season=${currentSeason}&sort=POPULARITY_DESC`} className={styles.viewAllLink}>
                    →
                  </Link>
                </div>
                <div className={styles.horizontalScroll}>
                  {thisSeasonCards.map((anime: HomeCardItem) => (
                    <div key={`season-${anime.anilistId}`} className={styles.cardWrapper}>
                      <AnimeCard
                        id={anime.anilistId}
                        poster={anime.coverImage}
                        title={anime.titleRomaji}
                        format={anime.format as any}
                        year={anime.seasonYear}
                        status={anime.status as any}
                        score={anime.averageScore}
                        synopsis={anime.synopsis}
                        genres={anime.genres}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Browse by Genre</h2>
              <div className={styles.genrePills}>
                {['Action', 'Romance', 'Comedy', 'Drama', 'Fantasy', 'Sci-Fi', 'Horror', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Mystery'].map((genre) => (
                  <Link
                    key={genre}
                    href={`/browse?genres=${encodeURIComponent(genre)}`}
                    className={styles.genrePill}
                  >
                    {genre}
                  </Link>
                ))}
              </div>
            </section>

            <div className={styles.splitGrid}>
              <div className={styles.leftCol}>
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Recently Updated</h2>
                    <Link href="/browse?sort=UPDATED_AT_DESC" className={styles.viewAllBtn}>
                      View All →
                    </Link>
                  </div>
                  <div className={styles.homeCardGridLimited}>
                    {(() => {
                      const seen = new Set<number>();
                      return recentlyUpdatedCards.slice(0, 12).filter((item: any) => {
                        const anime = item.media;
                        if (!anime?.id || seen.has(anime.id)) return false;
                        seen.add(anime.id);
                        return true;
                      }).map((item: any) => {
                        const anime = item.media;
                        return (
                          <div key={`recent-${anime.id}`} className={styles.gridCardWrap}>
                            <AnimeCard
                              id={anime.id}
                              poster={anime.coverImage?.extraLarge || anime.coverImage?.large || null}
                              title={anime.title?.english || anime.title?.romaji || 'Unknown'}
                              format={anime.format}
                              year={anime.seasonYear}
                              status={anime.status}
                              score={anime.averageScore}
                              synopsis={anime.description}
                              genres={anime.genres || []}
                            />
                          </div>
                        );
                      });
                    })()}
                  </div>
                </section>
              </div>

              <div className={styles.rightCol}>
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Airing Schedule</h2>
                  <ScheduleWidget schedules={formattedSchedules} />
                </section>
              </div>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Top Upcoming</h2>
                <Link href="/browse?status=NOT_YET_RELEASED&sort=POPULARITY_DESC" className={styles.viewAllBtn}>
                  View All →
                </Link>
              </div>
              <div className={styles.homeCardGridLimited}>
                {upcomingCards.slice(0, 12).map((anime: HomeCardItem) => (
                  <div key={`upcoming-${anime.anilistId}`} className={styles.cardWrapper}>
                    <AnimeCard
                      id={anime.anilistId}
                      poster={anime.coverImage}
                      title={anime.titleRomaji}
                      format={anime.format as any}
                      year={anime.seasonYear}
                      status={anime.status as any}
                      score={anime.averageScore}
                      synopsis={anime.synopsis}
                      genres={anime.genres}
                    />
                  </div>
                ))}
              </div>
            </section>
          </main>
        </>
      )}
    </div>
  );
}
