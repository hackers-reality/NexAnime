import Link from 'next/link';
import Header from '@/components/shared/Header';
import { queryOne, query } from '@/lib/db';
import { getCharacterById } from '@/lib/anilist';
import styles from './page.module.css';

interface DbProfile {
  display_name: string | null;
  pronouns: string | null;
  about_me: string | null;
  avatar_char_id: number | null;
  avatar_url: string | null;
  created_at: string;
}

interface ActivityLog {
  id: number;
  type: string;
  anilist_id: number;
  message: string;
  created_at: string;
}

interface WatchHistoryItem {
  anilist_id: number;
  episode_number: number;
  seconds_watched: number;
  duration_seconds: number;
  last_watched_at: string;
  title_romaji: string | null;
  title_english: string | null;
  cover_image: string | null;
  ep_thumbnail: string | null;
}

export default async function ProfilePage() {
  // 1. Fetch Profile
  const profile = await queryOne<DbProfile>('SELECT * FROM profile WHERE id = 1');
  
  // 2. Fetch avatar — use cached URL from DB first, only hit AniList as fallback
  let avatarUrl: string = '/avatars/default.svg';
  let avatarName = 'User';
  if (profile?.avatar_url) {
    avatarUrl = profile.avatar_url;
    avatarName = profile.display_name || 'User';
  } else if (profile?.avatar_char_id) {
    const char = await getCharacterById(profile.avatar_char_id);
    if (char) {
      avatarUrl = char.image.large || '/avatars/default.svg';
      avatarName = char.name.full;
    }
  }

  // 3. Stats
  const minutesResult = await queryOne<{ total_minutes: number }>(
    'SELECT SUM(seconds_watched) / 60 as total_minutes FROM watch_progress'
  );
  const finishedResult = await queryOne<{ finished_count: number }>(
    "SELECT COUNT(*) as finished_count FROM watchlist WHERE list_status = 'finished'"
  );
  const totalResult = await queryOne<{ total_count: number }>(
    'SELECT COUNT(*) as total_count FROM watchlist'
  );

  const minutesWatched = Math.floor(minutesResult?.total_minutes || 0);
  const finishedAnime = finishedResult?.finished_count || 0;
  const totalAnime = totalResult?.total_count || 0;

  // 4. History (last watched items)
  const history = await query<WatchHistoryItem>(`
    SELECT wp.*, c.title_romaji, c.title_english, c.cover_image,
           (SELECT thumbnail FROM episode_sources WHERE anilist_id = wp.anilist_id AND episode_number = wp.episode_number AND thumbnail IS NOT NULL LIMIT 1) as ep_thumbnail
    FROM watch_progress wp
    LEFT JOIN anime_cache c ON wp.anilist_id = c.anilist_id
    ORDER BY wp.last_watched_at DESC
    LIMIT 6
  `);

  // 5. Activity Log
  const activities = await query<ActivityLog>(
    'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10'
  );

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.wrapper}>
        {/* Profile Card */}
        <section className={styles.profileCard}>
          <div className={styles.avatarWrapper}>
            <img
              src={avatarUrl}
              alt={avatarName}
              width={120}
              height={120}
              className={styles.avatarImg}
            />
          </div>
          <div className={styles.profileDetails}>
            <h1 className={styles.displayName}>
              {profile?.display_name || 'Anonymous User'}
              {profile?.pronouns && <span className={styles.pronouns}>({profile.pronouns})</span>}
            </h1>
            <p className={styles.memberSince}>
              Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'recently'}
            </p>
            <p className={styles.aboutMe}>
              {profile?.about_me || 'No bio written yet.'}
            </p>
          </div>
        </section>

        {/* Stats Grid */}
        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{minutesWatched}</span>
            <span className={styles.statLabel}>Minutes Watched</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{finishedAnime}</span>
            <span className={styles.statLabel}>Completed Anime</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{totalAnime}</span>
            <span className={styles.statLabel}>Total Anime</span>
          </div>
        </section>

        <div className={styles.contentGrid}>
          {/* Left Column: History & Quick List Link */}
          <div className={styles.leftCol}>
            <section className={styles.historySection}>
              <h2 className={styles.sectionHeader}>Continue Watching</h2>
              {history.length === 0 ? (
                <p className={styles.noData}>No watch history yet.</p>
              ) : (
                <div className={styles.historyGrid}>
                  {history.map((item) => {
                    const percent = Math.min(
                      100,
                      Math.round((item.seconds_watched / (item.duration_seconds || 1)) * 100)
                    );
                    const title = item.title_romaji || item.title_english || 'Anime';
                    return (
                      <Link
                        key={`${item.anilist_id}-${item.episode_number}`}
                        href={`/watch/${item.anilist_id}/${item.episode_number}`}
                        className={styles.historyCard}
                      >
                        <div className={styles.thumbWrapper}>
                          {(item.ep_thumbnail || item.cover_image) && (
                            <img
                              src={item.ep_thumbnail || item.cover_image!}
                              alt={title}
                              className={styles.thumbImage}
                            />
                          )}
                          <div className={styles.epBadge}>E{item.episode_number}</div>
                          <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                        <div className={styles.historyInfo}>
                          <h4 className={styles.historyTitle}>{title}</h4>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Recent Activity Feed */}
          <aside className={styles.rightCol}>
            <section className={styles.activitySection}>
              <h2 className={styles.sectionHeader}>Recent Activity</h2>
              {activities.length === 0 ? (
                <p className={styles.noData}>No recent activities recorded.</p>
              ) : (
                <div className={styles.activityFeed}>
                  {activities.map((act) => (
                    <div key={act.id} className={styles.activityItem}>
                      <span className={styles.activityIcon}>
                        {act.type === 'status_change' ? '📋' : act.type === 'score_updated' ? '⭐' : '▶'}
                      </span>
                      <div className={styles.activityContent}>
                        <p className={styles.activityText}>{act.message}</p>
                        <span className={styles.activityTime}>
                          {new Date(act.created_at + ' UTC').toLocaleDateString()} at{' '}
                          {new Date(act.created_at + ' UTC').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
