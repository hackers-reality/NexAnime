import { createClient, type Client, type InStatement } from '@libsql/client';
import path from 'path';

let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    const dbPath = path.join(process.cwd(), 'nexanime.db');
    _client = createClient({
      url: `file:${dbPath}`,
    });
  }
  return _client;
}

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    display_name TEXT,
    pronouns TEXT,
    about_me TEXT,
    avatar_char_id INTEGER,
    onboarded_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title_language TEXT DEFAULT 'romaji',
    hide_adult_content INTEGER DEFAULT 0,
    autoplay_trailers INTEGER DEFAULT 0,
    video_quality TEXT DEFAULT 'auto',
    auto_play INTEGER DEFAULT 1,
    auto_next INTEGER DEFAULT 0,
    auto_skip_intro_outro INTEGER DEFAULT 0,
    mini_player INTEGER DEFAULT 0,
    ambient_mode INTEGER DEFAULT 0,
    pause_history INTEGER DEFAULT 0,
    theme TEXT DEFAULT 'dark',
    notification_sound INTEGER DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS anime_cache (
    anilist_id INTEGER PRIMARY KEY,
    title_romaji TEXT,
    title_english TEXT,
    title_native TEXT,
    synonyms TEXT,
    synopsis TEXT,
    format TEXT,
    status TEXT,
    season TEXT,
    season_year INTEGER,
    average_score INTEGER,
    mean_score INTEGER,
    source TEXT,
    studios TEXT,
    genres TEXT,
    tags TEXT,
    cover_image TEXT,
    banner_image TEXT,
    episode_count INTEGER,
    next_airing_at DATETIME,
    cached_at DATETIME DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS episode_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anilist_id INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT,
    thumbnail TEXT,
    source_adapter TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    subtitle_url TEXT,
    resolved_at DATETIME DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anilist_id INTEGER NOT NULL UNIQUE,
    list_status TEXT NOT NULL DEFAULT 'planning',
    start_date DATE,
    end_date DATE,
    score INTEGER,
    episode_watched INTEGER DEFAULT 0,
    total_rewatches INTEGER DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS watch_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anilist_id INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    seconds_watched INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    last_watched_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(anilist_id, episode_number)
  )`,
  `CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    anilist_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anilist_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    anilist_id INTEGER PRIMARY KEY,
    subscribed_at DATETIME DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS home_cache (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    cached_at DATETIME DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at DATETIME DEFAULT (datetime('now')))`,
  `INSERT OR IGNORE INTO schema_version (version) VALUES (1)`,
  `CREATE INDEX IF NOT EXISTS idx_watchlist_status ON watchlist(list_status)`,
  `CREATE INDEX IF NOT EXISTS idx_watch_progress_anilist ON watch_progress(anilist_id)`,
  `CREATE INDEX IF NOT EXISTS idx_watch_progress_ep ON watch_progress(anilist_id, episode_number)`,
  `CREATE INDEX IF NOT EXISTS idx_episode_sources_lookup ON episode_sources(anilist_id, episode_number)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)`,
  `CREATE INDEX IF NOT EXISTS idx_anime_cache_status ON anime_cache(status)`,
  `INSERT OR IGNORE INTO profile (id) VALUES (1)`,
  `INSERT OR IGNORE INTO settings (id) VALUES (1)`,
];

export async function initializeDb(): Promise<void> {
  const db = getDb();
  const statements: InStatement[] = SCHEMA_STATEMENTS.map((sql) => ({ sql, args: [] }));
  await db.batch(statements, 'write');

  try { await db.execute('ALTER TABLE settings ADD COLUMN theme TEXT DEFAULT \'dark\''); } catch {}
  try { await db.execute('ALTER TABLE settings ADD COLUMN notification_sound INTEGER DEFAULT 1'); } catch {}
  try { await db.execute('ALTER TABLE profile ADD COLUMN avatar_url TEXT'); } catch {}
  try { await db.execute('ALTER TABLE anime_cache ADD COLUMN mal_id INTEGER'); } catch {}
  try { await db.execute('ALTER TABLE anime_cache ADD COLUMN streaming_episodes TEXT'); } catch {}
  try { await db.execute('ALTER TABLE anime_cache ADD COLUMN full_data TEXT'); } catch {}

  try {
    await db.execute(`DELETE FROM episode_sources WHERE source_adapter NOT IN ('rapidstream', 'zoko', 'gogoanime', 'animepahe')`);
  } catch {}
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  args: Record<string, unknown> | unknown[] = []
): Promise<T[]> {
  const db = getDb();
  const result = await db.execute({ sql, args: args as never });
  return result.rows as unknown as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  args: Record<string, unknown> | unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, args);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  args: Record<string, unknown> | unknown[] = []
): Promise<{ rowsAffected: number; lastInsertRowid: bigint | undefined }> {
  const db = getDb();
  const result = await db.execute({ sql, args: args as never });
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid,
  };
}

export async function batch(statements: InStatement[]): Promise<void> {
  const db = getDb();
  await db.batch(statements, 'write');
}
