import { NextRequest, NextResponse } from 'next/server';
import { getDb, execute, queryOne } from '@/lib/db';

export async function GET() {
  try {
    const settings = await queryOne(
      'SELECT title_language, hide_adult_content, autoplay_trailers, video_quality, auto_play, auto_next, auto_skip_intro_outro, mini_player, ambient_mode, pause_history FROM settings WHERE id = 1'
    );
    return NextResponse.json({ settings });
  } catch (err) {
    console.error('Failed to get settings:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      titleLanguage,
      hideAdultContent,
      autoplayTrailers,
      videoQuality,
      autoPlay,
      autoNext,
      autoSkipIntroOutro,
      miniPlayer,
      ambientMode,
      pauseHistory
    } = body;

    // Build SQLite update command
    await execute(
      `UPDATE settings
       SET title_language = COALESCE(?, title_language),
           hide_adult_content = COALESCE(?, hide_adult_content),
           autoplay_trailers = COALESCE(?, autoplay_trailers),
           video_quality = COALESCE(?, video_quality),
           auto_play = COALESCE(?, auto_play),
           auto_next = COALESCE(?, auto_next),
           auto_skip_intro_outro = COALESCE(?, auto_skip_intro_outro),
           mini_player = COALESCE(?, mini_player),
           ambient_mode = COALESCE(?, ambient_mode),
           pause_history = COALESCE(?, pause_history)
       WHERE id = 1`,
      [
        titleLanguage ?? null,
        hideAdultContent !== undefined ? (hideAdultContent ? 1 : 0) : null,
        autoplayTrailers !== undefined ? (autoplayTrailers ? 1 : 0) : null,
        videoQuality ?? null,
        autoPlay !== undefined ? (autoPlay ? 1 : 0) : null,
        autoNext !== undefined ? (autoNext ? 1 : 0) : null,
        autoSkipIntroOutro !== undefined ? (autoSkipIntroOutro ? 1 : 0) : null,
        miniPlayer !== undefined ? (miniPlayer ? 1 : 0) : null,
        ambientMode !== undefined ? (ambientMode ? 1 : 0) : null,
        pauseHistory !== undefined ? (pauseHistory ? 1 : 0) : null
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save settings:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
