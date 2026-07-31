import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { logImport } from '@/lib/logger';

const RESTORE_TABLES = ['settings', 'profile', 'watchlist', 'watch_progress', 'activity_log', 'notifications', 'subscriptions'];

export async function POST(req: NextRequest) {
  try {
    const backup = await req.json();

    if (!backup || typeof backup !== 'object') {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 });
    }

    if (backup.format !== 'nexanime-export') {
      return NextResponse.json({ error: 'Not a NexAnime export file (expected format: "nexanime-export")' }, { status: 400 });
    }

    if (!backup.version || backup.version !== 1) {
      return NextResponse.json({ error: `Unsupported export version: ${backup.version}` }, { status: 400 });
    }

    if (!backup.data || typeof backup.data !== 'object') {
      return NextResponse.json({ error: 'Backup file is missing data section' }, { status: 400 });
    }

    const db = getDb();

    // Create a pre-import backup before overwriting anything
    const preImportBackup: Record<string, unknown> = {};
    for (const table of RESTORE_TABLES) {
      const result = await db.execute({ sql: `SELECT * FROM ${table}`, args: [] });
      preImportBackup[table] = result.rows;
    }
    const backupsDir = join(process.cwd(), 'backups');
    await mkdir(backupsDir, { recursive: true });
    const preImportFile = `pre-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await writeFile(join(backupsDir, preImportFile), JSON.stringify({
      format: 'nexanime-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      preImport: true,
      data: preImportBackup,
    }, null, 2));

    // Restore tables from backup
    let restored = 0;
    for (const table of RESTORE_TABLES) {
      const rows = backup.data[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      await db.execute({ sql: `DELETE FROM ${table}`, args: [] });

      for (const row of rows) {
        const keys = Object.keys(row).filter(k => k !== 'id');
        if (keys.length === 0) continue;

        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => row[k]);

        try {
          await db.execute({
            sql: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
            args: values,
          });
          restored++;
        } catch (err) {
          console.error(`Restore failed for table ${table}:`, err);
        }
      }
    }

    await db.execute({
      sql: `UPDATE settings SET last_backup = datetime('now') WHERE id = 1`,
      args: [],
    });

    logImport(`Restored ${restored} records from backup`);
    return NextResponse.json({ success: true, restored, preImportBackup: preImportFile });
  } catch (err) {
    console.error('Restore failed:', err);
    return NextResponse.json({ error: 'Restore failed — backup may be corrupted' }, { status: 500 });
  }
}
