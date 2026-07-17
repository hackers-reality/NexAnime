'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/shared/Header';
import AnimeCard from '@/components/cards/AnimeCard';
import HomeCarousel from '@/components/home/HomeCarousel';
import ScheduleWidget from '@/components/home/ScheduleWidget';
import Image from 'next/image';
import styles from './page.module.css';

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

export default function HomePage() {
  const [carouselMedia, setCarouselMedia] = useState<any[]>([]);
  const [trendingCards, setTrendingCards] = useState<any[]>([]);
  const [continueWatching, setContinueWatching] = useState<ProgressItem[]>([]);
  const [thisSeasonCards, setThisSeasonCards] = useState<any[]>([]);
  const currentSeason = (() => {
    const m = new Date().getMonth();
    return ['WINTER', 'WINTER', 'SPRING', 'SPRING', 'SPRING', 'SUMMER', 'SUMMER', 'SUMMER', 'FALL', 'FALL', 'FALL', 'WINTER'][m];
  })();
  const [upcomingCards, setUpcomingCards] = useState<any[]>([]);
  const [recentlyUpdatedCards, setRecentlyUpdatedCards] = useState<any[]>([]);
  const [formattedSchedules, setFormattedSchedules] = useState<any[]>([]);
  const [activeTrendTab, setActiveTrendTab] = useState<'trending' | 'popular' | 'topRated'>('trending');
  const [tabAnime, setTabAnime] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const loadData = async () => {
      try {
        setLoading(true);

        // 1. Trending (Carousel)
        const trend = await fetch('/api/anilist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'trending', page: 1, perPage: 15 })
        }).then(r => r.json()).catch(err => {
          console.error('Failed to load trending cards:', err);
          return { media: [] };
        });

        if (!active) return;
        const trendMedia = trend.media || [];
        setCarouselMedia(trendMedia.slice(0, 5));
        
        const mappedTrending = trendMedia.map((m: any) => ({
          anilistId: m.id,
          titleRomaji: m.title?.romaji || m.title?.english || 'Unknown',
          titleEnglish: m.title?.english,
          coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
          format: m.format,
          seasonYear: m.seasonYear,
          status: m.status,
          averageScore: m.averageScore,
          synopsis: m.description,
          genres: m.genres || [],
        }));

        setTrendingCards(mappedTrending.slice(5, 15));
        setTabAnime(mappedTrending.slice(5, 15));

        // 2. This Season (Staggered)
        await delay(350);
        if (!active) return;
        const thisSeason = await fetch('/api/anilist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'thisSeason', page: 1, perPage: 10 })
        }).then(r => r.json()).catch(err => {
          console.error('Failed to load this season:', err);
          return { media: [] };
        });

        if (!active) return;
        setThisSeasonCards((thisSeason.media || []).map((m: any) => ({
          anilistId: m.id,
          titleRomaji: m.title?.romaji || m.title?.english || 'Unknown',
          titleEnglish: m.title?.english,
          coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
          format: m.format,
          seasonYear: m.seasonYear,
          status: m.status,
          averageScore: m.averageScore,
          synopsis: m.description,
          genres: m.genres || [],
        })));

        // 3. Continue Watching
        const cont = await fetch('/api/watchlist?continue=true')
          .then(r => r.json())
          .catch(() => ({ progress: [] }));

        if (!active) return;
        if (cont.progress) {
          setContinueWatching(cont.progress);
        }

        // 4. Upcoming (Staggered to avoid rate limit)
        await delay(350);
        if (!active) return;
        const up = await fetch('/api/anilist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upcoming', page: 1, perPage: 10 })
        }).then(r => r.json()).catch(err => {
          console.error('Failed to load upcoming cards:', err);
          return { media: [] };
        });

        if (!active) return;
        setUpcomingCards((up.media || []).map((m: any) => ({
          anilistId: m.id,
          titleRomaji: m.title?.romaji || m.title?.english || 'Unknown',
          titleEnglish: m.title?.english,
          coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
          format: m.format,
          seasonYear: m.seasonYear,
          status: m.status,
          averageScore: m.averageScore,
          synopsis: m.description,
          genres: m.genres || [],
        })));

        // 5. Recently Updated (Staggered)
        await delay(350);
        if (!active) return;
        const recent = await fetch('/api/anilist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'recentlyUpdated', page: 1, perPage: 10 })
        }).then(r => r.json()).catch(err => {
          console.error('Failed to load recently updated:', err);
          return { schedules: [] };
        });

        if (!active) return;
        const recentSchedules = recent.schedules || recent || [];
        setRecentlyUpdatedCards(Array.isArray(recentSchedules) ? recentSchedules : []);

        // 6. Airing Schedule (Staggered)
        await delay(350);
        if (!active) return;
        const nowSec = Math.floor(Date.now() / 1000);
        const sevenDaysSec = 7 * 24 * 60 * 60;
        const sched = await fetch('/api/anilist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'airingSchedule', startTime: nowSec - 12 * 3600, endTime: nowSec + sevenDaysSec, page: 1, perPage: 100 })
        }).then(r => r.json()).catch(err => {
          console.error('Failed to load schedule:', err);
          return { schedules: [] };
        });

        if (!active) return;
        const schedSchedules = sched.schedules || sched || [];
        setFormattedSchedules((Array.isArray(schedSchedules) ? schedSchedules : []).map((item: any) => ({
          id: item.id,
          airingAt: item.airingAt,
          episode: item.episode,
          mediaId: item.mediaId,
          title: item.media?.title?.english || item.media?.title?.romaji || 'Unknown',
          coverImage: item.media?.coverImage?.large || null,
        })));

      } catch (err) {
        console.error('Failed staggered load:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const handleTrendTabChange = async (tab: 'trending' | 'popular' | 'topRated') => {
    setActiveTrendTab(tab);
    try {
      const res = await fetch('/api/anilist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: tab === 'trending' ? 'trending' : tab === 'popular' ? 'popular' : 'topRated', page: 1, perPage: 15 })
      });
      const data = await res.json();
      const media = (data.media || []).slice(5, 15);
      setTabAnime(media.map((m: any) => ({
        anilistId: m.id,
        titleRomaji: m.title?.romaji || m.title?.english || 'Unknown',
        titleEnglish: m.title?.english,
        coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
        format: m.format,
        seasonYear: m.seasonYear,
        status: m.status,
        averageScore: m.averageScore,
        synopsis: m.description,
        genres: m.genres || [],
      })));
    } catch (err) {
      console.error('Failed to load tab data:', err);
    }
  };

  return (
    <div className={styles.container}>
      <Header />

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {carouselMedia.length > 0 && <HomeCarousel items={carouselMedia} />}

          <main className={styles.main}>
            {continueWatching.length > 0 ? (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Dive Back In</h2>
                <div className={styles.continueGrid}>
                  {continueWatching.map((item) => {
                    const percent = Math.min(
                      100,
                      Math.round((item.seconds_watched / (item.duration_seconds || 1)) * 100)
                    );
                    const title = item.title_romaji || item.title_english || 'Anime';
                    const remaining = item.duration_seconds
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
                          <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
                          </div>
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
                {tabAnime.map((anime: any) => (
                  <div key={anime.anilistId} className={styles.cardWrapper}>
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

            {thisSeasonCards.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>This Season</h2>
                  <Link href={`/browse?season=${currentSeason}&sort=POPULARITY_DESC`} className={styles.viewAllLink}>
                    →
                  </Link>
                </div>
                <div className={styles.horizontalScroll}>
                  {thisSeasonCards.map((anime: any) => (
                    <div key={anime.anilistId} className={styles.cardWrapper}>
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
                  <h2 className={styles.sectionTitle}>Recently Updated</h2>
                  <div className={styles.horizontalScroll}>
                    {recentlyUpdatedCards.map((item: any) => {
                      const anime = item.media;
                      if (!anime?.id) return null;
                      return (
                        <div key={`${anime.id}-${item.episode}`} className={styles.cardWrapper}>
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
                    })}
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
                <Link href="/browse?status=NOT_YET_RELEASED&sort=POPULARITY_DESC" className={styles.viewAllLink}>
                  →
                </Link>
              </div>
              <div className={styles.horizontalScroll}>
                {upcomingCards.map((anime: any) => (
                  <div key={anime.anilistId} className={styles.cardWrapper}>
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
