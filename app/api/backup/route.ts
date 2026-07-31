import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { logBackup } from '@/lib/logger';

const BACKUP_TABLES = ['settings', 'profile', 'watchlist', 'watch_progress', 'activity_log', 'notifications', 'subscriptions'];

export async function GET() {
  try {
    const db = getDb();
    const data: Record<string, unknown> = {};

    for (const table of BACKUP_TABLES) {
      const result = await db.execute({ sql: `SELECT * FROM ${table}`, args: [] });
      data[table] = result.rows;
    }

    const exportPayload = {
      format: 'nexanime-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };

    return NextResponse.json(exportPayload, {
      headers: {
        'Content-Disposition': `attachment; filename="nexanime-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error('Backup failed:', err);
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 });
  }
}

let lastAutoBackup = 0;
const AUTO_BACKUP_COOLDOWN_MS = 5 * 60 * 1000;

export async function POST() {
  try {
    const now = Date.now();
    if (now - lastAutoBackup < AUTO_BACKUP_COOLDOWN_MS) {
      return NextResponse.json({ success: true, skipped: true });
    }
    lastAutoBackup = now;

    const db = getDb();
    const data: Record<string, unknown> = {};

    for (const table of BACKUP_TABLES) {
      const result = await db.execute({ sql: `SELECT * FROM ${table}`, args: [] });
      data[table] = result.rows;
    }

    const exportPayload = {
      format: 'nexanime-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      auto: true,
      data,
    };

    const backupsDir = join(process.cwd(), 'backups');
    await mkdir(backupsDir, { recursive: true });
    const filename = `auto-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await writeFile(join(backupsDir, filename), JSON.stringify(exportPayload, null, 2));

    await db.execute({
      sql: `UPDATE settings SET last_backup = datetime('now') WHERE id = 1`,
      args: [],
    });

    const { readdir, unlink } = await import('fs/promises');
    const files = (await readdir(backupsDir))
      .filter(f => f.startsWith('auto-backup-'))
      .sort()
      .reverse();
    for (const old of files.slice(10)) {
      await unlink(join(backupsDir, old)).catch(() => {});
    }

    logBackup(`Auto-backup created: ${filename}`);
    return NextResponse.json({ success: true, filename });
  } catch (err) {
    console.error('Auto-backup failed:', err);
    return NextResponse.json({ error: 'Auto-backup failed' }, { status: 500 });
  }
}
