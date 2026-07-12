// NexAnime — Scraper database connection
// Shares the same nexanime.db file as the Next.js app
// This module is imported by the standalone scraper process

import { createClient, type Client, type InStatement } from '@libsql/client';
import path from 'path';

let _client: Client | null = null;

export function getScraperDb(): Client {
  if (!_client) {
    // Resolve the DB path relative to the project root
    // The scraper runs from the project root: node scraper/index.ts
    const dbPath = path.join(process.cwd(), 'nexanime.db');
    _client = createClient({
      url: `file:${dbPath}`,
    });
  }
  return _client;
}

/**
 * Execute a single SQL query and return rows.
 */
export async function scraperQuery<T = Record<string, unknown>>(
  sql: string,
  args: Record<string, unknown> | unknown[] = []
): Promise<T[]> {
  const db = getScraperDb();
  const result = await db.execute({ sql, args: args as never });
  return result.rows as unknown as T[];
}

/**
 * Execute a write statement (INSERT/UPDATE/DELETE).
 */
export async function scraperExecute(
  sql: string,
  args: Record<string, unknown> | unknown[] = []
): Promise<{ rowsAffected: number; lastInsertRowid: bigint | undefined }> {
  const db = getScraperDb();
  const result = await db.execute({ sql, args: args as never });
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid,
  };
}

/**
 * Execute multiple statements in a batch/transaction.
 */
export async function scraperBatch(statements: InStatement[]): Promise<void> {
  const db = getScraperDb();
  await db.batch(statements, 'write');
}
