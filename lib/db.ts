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

// SQLite maintenance: WAL mode + busy timeout (called once on startup)
let _maintenanceDone = false;
export async function runMaintenance(): Promise<void> {
  if (_maintenanceDone) return;
  _maintenanceDone = true;
  const db = getDb();
  try { await db.execute('PRAGMA journal_mode = WAL'); } catch {}
  try { await db.execute('PRAGMA busy_timeout = 5000'); } catch {}
  try { await db.execute('PRAGMA synchronous = NORMAL'); } catch {}
  // Occasional VACUUM — only if DB is over 50MB
  try {
    const sizeResult = await db.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");
    const size = Number(sizeResult.rows[0]?.size || 0);
    if (size > 50 * 1024 * 1024) {
      await db.execute('VACUUM');
    }
  } catch {}
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
    is_dub INTEGER DEFAULT 0,
    title TEXT,
    thumbnail TEXT,
    source_adapter TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    subtitle_url TEXT,
    resolved_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(anilist_id, episode_number, source_adapter, is_dub)
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
  `CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_id TEXT NOT NULL UNIQUE,
    applied_at DATETIME DEFAULT (datetime('now'))
  )`,
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
  await runMaintenance();
  const db = getDb();
  const statements: InStatement[] = SCHEMA_STATEMENTS.map((sql) => ({ sql, args: [] }));
  await db.batch(statements, 'write');

  // Run migrations in order — each runs exactly once
  await runMigrations(db);

  // Cache maintenance: evict stale entries on startup
  await runCacheMaintenance(db);
}

// ── Migration system ─────────────────────────────────────
// Each migration has an id (must be unique), a description, and a SQL statement.
// Migrations are tracked in schema_version table and never rerun.

interface Migration {
  id: string;
  description: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  { id: '001', description: 'Add theme column to settings', sql: "ALTER TABLE settings ADD COLUMN theme TEXT DEFAULT 'dark'" },
  { id: '002', description: 'Add notification_sound to settings', sql: 'ALTER TABLE settings ADD COLUMN notification_sound INTEGER DEFAULT 1' },
  { id: '003', description: 'Add avatar_url to profile', sql: 'ALTER TABLE profile ADD COLUMN avatar_url TEXT' },
  { id: '004', description: 'Add mal_id to anime_cache', sql: 'ALTER TABLE anime_cache ADD COLUMN mal_id INTEGER' },
  { id: '005', description: 'Add streaming_episodes to anime_cache', sql: 'ALTER TABLE anime_cache ADD COLUMN streaming_episodes TEXT' },
  { id: '006', description: 'Add full_data to anime_cache', sql: 'ALTER TABLE anime_cache ADD COLUMN full_data TEXT' },
  { id: '007', description: 'Add episodes_data to anime_cache', sql: 'ALTER TABLE anime_cache ADD COLUMN episodes_data TEXT' },
  { id: '008', description: 'Clean deprecated episode_sources adapters', sql: "DELETE FROM episode_sources WHERE source_adapter NOT IN ('rapidstream', 'nova', 'megaplay', 'gogoanime', 'animepahe')" },
  { id: '009', description: 'Add last_backup to settings', sql: 'ALTER TABLE settings ADD COLUMN last_backup DATETIME' },
  { id: '010', description: 'Add is_dub to episode_sources', sql: 'ALTER TABLE episode_sources ADD COLUMN is_dub INTEGER DEFAULT 0' },
  { id: '010b', description: 'Deduplicate episode_sources before unique index', sql: "DELETE FROM episode_sources WHERE id NOT IN (SELECT MIN(id) FROM episode_sources GROUP BY anilist_id, episode_number, source_adapter, is_dub)" },
  { id: '011', description: 'Add unique index on episode_sources', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_episode_sources_unique ON episode_sources(anilist_id, episode_number, source_adapter, is_dub)' },
];

async function runMigrations(db: Client): Promise<void> {
  // Ensure schema_version table exists with the new migration tracking schema.
  // If the old schema exists (version INTEGER), migrate it.
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_id TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT (datetime('now'))
      )
    `);
  } catch {}
  // If old schema_version table has 'version' column but no 'migration_id', recreate it
  try {
    const cols = await db.execute("PRAGMA table_info(schema_version)");
    const hasVersion = cols.rows.some(c => c.name === 'version');
    const hasMigrationId = cols.rows.some(c => c.name === 'migration_id');
    if (hasVersion && !hasMigrationId) {
      await db.execute('DROP TABLE schema_version');
      await db.execute(`
        CREATE TABLE schema_version (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          migration_id TEXT NOT NULL UNIQUE,
          applied_at DATETIME DEFAULT (datetime('now'))
        )
      `);
    }
  } catch {}

  // Get already-applied migration IDs
  const applied = new Set<string>();
  try {
    const result = await db.execute('SELECT migration_id FROM schema_version');
    for (const row of result.rows) {
      applied.add(String(row.migration_id));
    }
  } catch {}

  // Run pending migrations in order
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    try {
      await db.execute(m.sql);
      await db.execute({
        sql: 'INSERT INTO schema_version (migration_id) VALUES (?)',
        args: [m.id],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        console.error(`[DB] Migration ${m.id} (${m.description}) failed: ${msg}`);
      }
      try {
        await db.execute({
          sql: 'INSERT OR IGNORE INTO schema_version (migration_id) VALUES (?)',
          args: [m.id],
        });
      } catch {}
    }
  }
}

// ── Cache maintenance (runs once on startup) ─────────────
async function runCacheMaintenance(db: Client): Promise<void> {
  try {
    await db.execute(`DELETE FROM episode_sources WHERE resolved_at < datetime('now', '-48 hours')`);
  } catch {}
  try {
    await db.execute(`
      DELETE FROM anime_cache WHERE anilist_id NOT IN (
        SELECT anilist_id FROM anime_cache ORDER BY cached_at DESC LIMIT 500
      )
    `);
  } catch {}
  try {
    await db.execute(`DROP TABLE IF EXISTS home_cache`);
  } catch {}
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  args: Record<string, unknown> | unknown[] = []
): Promise<T[]> {
  const db = getDb();
  const result = Array.isArray(args) && args.length > 0
    ? await db.execute({ sql, args: args as never })
    : await db.execute(sql);
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
  const result = Array.isArray(args) && args.length > 0
    ? await db.execute({ sql, args: args as never })
    : await db.execute(sql);
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid,
  };
}

export async function batch(statements: InStatement[]): Promise<void> {
  const db = getDb();
  await db.batch(statements, 'write');
}
