import { NextRequest, NextResponse } from 'next/server';
import { getDb, execute, queryOne } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { displayName, pronouns, aboutMe, avatarCharId } = body;

    if (!displayName) {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
    }

    // Update the local single profile
    await execute(
      `UPDATE profile
       SET display_name = ?,
           pronouns = ?,
           about_me = ?,
           avatar_char_id = ?,
           onboarded_at = datetime('now')
       WHERE id = 1`,
      [displayName, pronouns || null, aboutMe || null, avatarCharId || null]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save profile:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const profile = await queryOne(
      'SELECT id, display_name, pronouns, about_me, avatar_char_id, onboarded_at FROM profile WHERE id = 1'
    );
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('Failed to get profile:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const db = getDb();
    
    // Batch delete statements to reset local user data
    await db.batch([
      { sql: 'DELETE FROM watchlist', args: [] },
      { sql: 'DELETE FROM watch_progress', args: [] },
      { sql: 'DELETE FROM activity_log', args: [] },
      { sql: 'DELETE FROM notifications', args: [] },
      { sql: 'DELETE FROM subscriptions', args: [] },
      { sql: 'DELETE FROM anime_cache', args: [] },
      { sql: 'DELETE FROM episode_sources', args: [] },
      // Reset profile table back to seed defaults
      { sql: 'DELETE FROM profile', args: [] },
      { sql: 'INSERT INTO profile (id) VALUES (1)', args: [] },
      // Reset settings
      { sql: 'DELETE FROM settings', args: [] },
      { sql: 'INSERT INTO settings (id) VALUES (1)', args: [] }
    ], 'write');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to reset profile:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

