import { query, queryOne } from '@/lib/db';
import { 
  getTrending, 
  getUpcoming, 
  getRecentlyUpdated, 
  getAiringSchedule,
  anilistMediaToAnime 
} from '@/lib/anilist';
import Header from '@/components/shared/Header';
import AnimeCard from '@/components/cards/AnimeCard';
import HomeCarousel from '@/components/home/HomeCarousel';
import ScheduleWidget from '@/components/home/ScheduleWidget';
import Link from 'next/link';
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
}

export default async function HomePage() {
  // 1. Fetch Carousel (Trending Top 5)
  const trendingData = await getTrending(1, 15);
  const carouselMedia = trendingData.media.slice(0, 5);
  const trendingCards = trendingData.media.slice(5, 15).map(anilistMediaToAnime);

  // 2. Fetch Dive Back In (Continue Watching)
  const continueWatching = await query<ProgressItem>(`
    SELECT wp.*, c.title_romaji, c.title_english, c.cover_image 
    FROM watch_progress wp
    LEFT JOIN anime_cache c ON wp.anilist_id = c.anilist_id
    WHERE wp.seconds_watched < wp.duration_seconds - 15
    ORDER BY wp.last_watched_at DESC
    LIMIT 6
  `);

  // 3. Fetch Top Upcoming
  const upcomingData = await getUpcoming(1, 10);
  const upcomingCards = upcomingData.media.map(anilistMediaToAnime);

  // 4. Fetch Recently Updated Airing Episodes
  const recentlyUpdatedData = await getRecentlyUpdated(1, 10);
  const recentlyUpdatedCards = recentlyUpdatedData.map(item => ({
    episode: item.episode,
    airingAt: item.airingAt,
    anime: anilistMediaToAnime(item.media)
  }));

  // 5. Fetch 7 Days Airing Schedule for the widget
  const nowSec = Math.floor(Date.now() / 1000);
  const sevenDaysSec = 7 * 24 * 60 * 60;
  const scheduleData = await getAiringSchedule(nowSec - 12 * 3600, nowSec + sevenDaysSec, 1, 100);

  const formattedSchedules = scheduleData.map(item => ({
    id: item.id,
    airingAt: item.airingAt, // UTC timestamp
    episode: item.episode,
    mediaId: item.mediaId,
    title: item.media.title.english || item.media.title.romaji || 'Unknown Anime',
    coverImage: item.media.coverImage?.large || null
  }));

  return (
    <div className={styles.container}>
      <Header />
      
      {/* 1. Hero Carousel */}
      <HomeCarousel items={carouselMedia as any} />

      <main className={styles.main}>
        {/* 2. Dive Back In (Continue Watching) */}
        {continueWatching.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Dive Back In</h2>
            <div className={styles.continueGrid}>
              {continueWatching.map((item) => {
                const percent = Math.min(
                  100,
                  Math.round((item.seconds_watched / (item.duration_seconds || 1)) * 100)
                );
                const title = item.title_romaji || item.title_english || 'Anime';
                return (
                  <Link
                    key={`${item.anilist_id}-${item.episode_number}`}
                    href={`/watch/${item.anilist_id}/${item.episode_number}`}
                    className={styles.continueCard}
                  >
                    <div className={styles.thumbWrapper}>
                      {item.cover_image && (
                        <Image
                          src={item.cover_image}
                          alt={title}
                          fill
                          sizes="180px"
                          className={styles.thumbImage}
                        />
                      )}
                      <div className={styles.epOverlay}>E{item.episode_number}</div>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <div className={styles.continueInfo}>
                      <h4 className={styles.continueTitle}>{title}</h4>
                      <p className={styles.continueSubtitle}>Episode {item.episode_number} • {percent}%</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. Trending Now row */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Trending Now</h2>
          <div className={styles.horizontalScroll}>
            {trendingCards.map((anime) => (
              <div key={anime.anilistId} className={styles.cardWrapper}>
                <AnimeCard
                  id={anime.anilistId}
                  poster={anime.coverImage}
                  title={anime.titleRomaji || anime.titleEnglish || 'Unknown'}
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

        {/* 4. Double column: Recently Updated vs Airing Schedule */}
        <div className={styles.splitGrid}>
          <div className={styles.leftCol}>
            {/* Recently Updated */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Recently Updated</h2>
              <div className={styles.recentList}>
                {recentlyUpdatedCards.map((item) => (
                  <Link
                    key={`${item.anime.anilistId}-${item.episode}`}
                    href={`/anime/${item.anime.anilistId}`}
                    className={styles.recentItem}
                  >
                    <div className={styles.recentImgContainer}>
                      {item.anime.coverImage && (
                        <Image
                          src={item.anime.coverImage}
                          alt={item.anime.titleRomaji || 'Cover'}
                          fill
                          sizes="60px"
                          className={styles.recentImg}
                        />
                      )}
                    </div>
                    <div className={styles.recentInfo}>
                      <h4 className={styles.recentTitle}>
                        {item.anime.titleRomaji || item.anime.titleEnglish}
                      </h4>
                      <span className={styles.recentEpBadge}>
                        Episode {item.episode}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div className={styles.rightCol}>
            {/* Airing Schedule Widget */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Airing Schedule</h2>
              <ScheduleWidget schedules={formattedSchedules} />
            </section>
          </div>
        </div>

        {/* 5. Top Upcoming row */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Top Upcoming</h2>
          <div className={styles.horizontalScroll}>
            {upcomingCards.map((anime) => (
              <div key={anime.anilistId} className={styles.cardWrapper}>
                <AnimeCard
                  id={anime.anilistId}
                  poster={anime.coverImage}
                  title={anime.titleRomaji || anime.titleEnglish || 'Unknown'}
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
    </div>
  );
}
