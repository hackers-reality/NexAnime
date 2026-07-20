// NexAnime — Random Anime API
// Returns a random anime from reanime.to search for the "feeling lucky" feature

import { NextResponse } from 'next/server';
import { searchReanime } from '@/lib/reanime';

export async function GET() {
  try {
    const randomPage = Math.floor(Math.random() * 5) + 1;
    const result = await searchReanime({ sort: 'score', limit: 25, offset: (randomPage - 1) * 25 });

    if (!result?.results?.length) {
      return NextResponse.json({ error: 'No anime found' }, { status: 404 });
    }

    const randomIndex = Math.floor(Math.random() * result.results.length);
    const anime = result.results[randomIndex];

    return NextResponse.json({
      id: anime.anilist_id,
      title: anime.title?.romaji || anime.title?.english || 'Unknown',
      coverImage: anime.cover_image?.extra_large || anime.cover_image?.large,
      format: anime.format,
      status: anime.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get random anime' },
      { status: 500 }
    );
  }
}
