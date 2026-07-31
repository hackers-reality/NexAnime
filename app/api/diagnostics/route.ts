import { NextResponse } from 'next/server';
import { getRecentLogs } from '@/lib/logger';
import { getAllHealth } from '@/lib/provider-health';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // DB stats
    const tables = ['profile', 'settings', 'watchlist', 'watch_progress', 'anime_cache', 'episode_sources', 'activity_log', 'notifications', 'subscriptions', 'schema_version'];
    const stats: Record<string, number> = {};
    for (const table of tables) {
      try {
        const result = await db.execute({ sql: `SELECT COUNT(*) as count FROM ${table}`, args: [] });
        stats[table] = Number(result.rows[0]?.count || 0);
      } catch {
        stats[table] = -1; // table doesn't exist
      }
    }

    // DB file size
    let dbSize = 'unknown';
    try {
      const { statSync } = await import('fs');
      const { join } = await import('path');
      const size = statSync(join(process.cwd(), 'nexanime.db')).size;
      dbSize = `${(size / 1024 / 1024).toFixed(1)}MB`;
    } catch {}

    return NextResponse.json({
      logs: getRecentLogs(100),
      providerHealth: getAllHealth(),
      dbStats: stats,
      dbSize,
      uptime: process.uptime(),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Diagnostics unavailable' }, { status: 500 });
  }
}
