// NexAnime — Database layer using @libsql/client (async API)
// Single SQLite file: nexanime.db in project root

import { createClient, type Client, type InStatement } from '@libsql/client';
import path from 'path';

// ─── Singleton client ────────────────────────────────────

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

// ─── Schema initialization ──────────────────────────────

const SCHEMA_STATEMENTS: string[] = [
  // Single-row profile — one local user, no user_id FKs anywhere
  `CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    display_name TEXT,
    pronouns TEXT,
    about_me TEXT,
    avatar_char_id INTEGER,
    onboarded_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
  )`,

  // Single-row settings
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

  // Cached anime metadata from AniList
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

  // Episode stream sources resolved by scraper adapters
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

  // User's watchlist entries
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

  // Per-episode watch progress (seconds watched, duration)
  `CREATE TABLE IF NOT EXISTS watch_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anilist_id INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    seconds_watched INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    last_watched_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(anilist_id, episode_number)
  )`,

  // Activity log — personal history feed
  `CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    anilist_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
  )`,

  // Notifications from scraper schedule-check
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anilist_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now'))
  )`,

  // Subscriptions — anime the user wants notifications for
  `CREATE TABLE IF NOT EXISTS subscriptions (
    anilist_id INTEGER PRIMARY KEY,
    subscribed_at DATETIME DEFAULT (datetime('now'))
  )`,

  // Animetsu ID cache — bridges AniList IDs to animetsu MongoDB IDs
  `CREATE TABLE IF NOT EXISTS animetsu_id_cache (
    anilist_id INTEGER PRIMARY KEY,
    animetsu_id TEXT NOT NULL,
    cached_at DATETIME DEFAULT (datetime('now'))
  )`,

  // Schema version tracking
  `CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at DATETIME DEFAULT (datetime('now')))`,
  `INSERT OR IGNORE INTO schema_version (version) VALUES (1)`,

  // Indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_watchlist_status ON watchlist(list_status)`,
  `CREATE INDEX IF NOT EXISTS idx_watch_progress_anilist ON watch_progress(anilist_id)`,
  `CREATE INDEX IF NOT EXISTS idx_watch_progress_ep ON watch_progress(anilist_id, episode_number)`,
  `CREATE INDEX IF NOT EXISTS idx_episode_sources_lookup ON episode_sources(anilist_id, episode_number)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)`,
  `CREATE INDEX IF NOT EXISTS idx_anime_cache_status ON anime_cache(status)`,
  `CREATE INDEX IF NOT EXISTS idx_animetsu_cache_anilist ON animetsu_id_cache(anilist_id)`,

  // Seed default profile row if empty
  `INSERT OR IGNORE INTO profile (id) VALUES (1)`,

  // Seed default settings row if empty
  `INSERT OR IGNORE INTO settings (id) VALUES (1)`,
];

/**
 * Initialize the database schema. Safe to call multiple times —
 * all statements use IF NOT EXISTS / INSERT OR IGNORE.
 */
export async function initializeDb(): Promise<void> {
  const db = getDb();
  const statements: InStatement[] = SCHEMA_STATEMENTS.map((sql) => ({ sql, args: [] }));
  await db.batch(statements, 'write');

  // Run migrations that may fail if column already exists
  try {
    await db.execute('ALTER TABLE settings ADD COLUMN theme TEXT DEFAULT \'dark\'');
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute('ALTER TABLE settings ADD COLUMN notification_sound INTEGER DEFAULT 1');
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute('ALTER TABLE profile ADD COLUMN avatar_url TEXT');
  } catch {
    // Column already exists — ignore
  }
}

// ─── Query helpers ──────────────────────────────────────

/**
 * Execute a single SQL statement and return all rows.
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  args: Record<string, unknown> | unknown[] = []
): Promise<T[]> {
  const db = getDb();
  const result = await db.execute({ sql, args: args as never });
  return result.rows as unknown as T[];
}

/**
 * Execute a single SQL statement and return the first row (or null).
 */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  args: Record<string, unknown> | unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, args);
  return rows[0] ?? null;
}

/**
 * Execute a write statement (INSERT/UPDATE/DELETE).
 * Returns the number of rows affected and last insert rowid.
 */
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

/**
 * Execute multiple statements in a batch/transaction.
 */
export async function batch(statements: InStatement[]): Promise<void> {
  const db = getDb();
  await db.batch(statements, 'write');
}
