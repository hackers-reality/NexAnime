import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    const [watchlistResult, progressResult, episodesResult, formatResult] = await Promise.all([
      db.execute(`
        SELECT 
          list_status,
          COUNT(*) as count,
          AVG(score) as avg_score,
          SUM(total_rewatches) as total_rewatches
        FROM watchlist
        WHERE list_status IS NOT NULL
        GROUP BY list_status
      `),
      db.execute(`
        SELECT 
          COUNT(DISTINCT anilist_id) as unique_anime,
          SUM(seconds_watched) as total_seconds,
          COUNT(*) as total_entries
        FROM watch_progress
      `),
      db.execute(`
        SELECT COUNT(DISTINCT anilist_id || '-' || episode_number) as total_episodes_watched
        FROM watch_progress
        WHERE seconds_watched > 0
      `),
      db.execute(`
        SELECT 
          c.format,
          COUNT(DISTINCT w.anilist_id) as count
        FROM watchlist w
        LEFT JOIN anime_cache c ON w.anilist_id = c.anilist_id
        WHERE c.format IS NOT NULL
        GROUP BY c.format
        ORDER BY count DESC
      `),
    ]);

    const [genreResult, recentActivityResult] = await Promise.all([
      db.execute(`
        SELECT 
          c.genres,
          COUNT(DISTINCT w.anilist_id) as count
        FROM watchlist w
        LEFT JOIN anime_cache c ON w.anilist_id = c.anilist_id
        WHERE c.genres IS NOT NULL
        GROUP BY c.genres
        ORDER BY count DESC
        LIMIT 10
      `),
      db.execute(`
        SELECT 
          date(last_watched_at) as day,
          COUNT(*) as entries
        FROM watch_progress
        WHERE last_watched_at IS NOT NULL 
          AND last_watched_at > datetime('now', '-30 days')
        GROUP BY date(last_watched_at)
        ORDER BY day ASC
      `),
    ]);

    const statusBreakdown: Record<string, number> = {};
    let totalScore = 0;
    let scoreCount = 0;
    let totalRewatches = 0;

    for (const row of watchlistResult.rows) {
      const status = row.list_status as string;
      statusBreakdown[status] = Number(row.count) || 0;
      totalRewatches += Number(row.total_rewatches) || 0;
      if (row.avg_score && Number(row.avg_score) > 0) {
        totalScore += Number(row.avg_score) * Number(row.count);
        scoreCount += Number(row.count);
      }
    }

    const progressRow = progressResult.rows[0];
    const uniqueAnime = Number(progressRow?.unique_anime) || 0;
    const totalSeconds = Number(progressRow?.total_seconds) || 0;
    const totalHours = Math.round(totalSeconds / 3600);

    const totalEpisodesWatched = Number(episodesResult.rows[0]?.total_episodes_watched) || 0;

    const formatBreakdown: Record<string, number> = {};
    for (const row of formatResult.rows) {
      const format = (row as Record<string, unknown>).format as string || 'Unknown';
      formatBreakdown[format] = Number((row as Record<string, unknown>).count) || 0;
    }

    const genreMap: Record<string, number> = {};
    for (const row of genreResult.rows) {
      try {
        const genres = JSON.parse(row.genres as string) as string[];
        for (const g of genres) {
          genreMap[g] = (genreMap[g] || 0) + Number(row.count);
        }
      } catch { /* malformed genres JSON — skip row */ }
    }
    const topGenres = Object.entries(genreMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([genre, count]) => ({ genre, count }));

    const activity = (recentActivityResult.rows || []).map((r) => ({
      day: r.day,
      entries: Number(r.entries),
    }));

    const totalInList = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);
    const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount * 10) / 10 : null;

    return NextResponse.json({
      overview: {
        totalInList,
        uniqueAnime,
        totalEpisodesWatched,
        totalRewatches,
        totalHours,
        avgScore,
      },
      statusBreakdown,
      formatBreakdown,
      topGenres,
      recentActivity: activity,
    });
  } catch (err) {
    console.error('[Stats] Failed to fetch stats:', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
