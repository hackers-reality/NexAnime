import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const notifications = await query(
      'SELECT id, anilist_id, type, message, read, created_at FROM notifications ORDER BY created_at DESC'
    );
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error('Failed to get notifications:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, markAll } = body;

    if (markAll) {
      await execute('UPDATE notifications SET read = 1');
    } else if (id) {
      await execute('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
    } else {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update notifications:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
