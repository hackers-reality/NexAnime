// NexAnime — Random Anime API
// Returns a random anime from AniList for the "feeling lucky" feature

import { NextResponse } from 'next/server';
import { searchAnime } from '@/lib/anilist';

export async function GET() {
  try {
    // Pick a random page from the top ~500 most popular anime
    const randomPage = Math.floor(Math.random() * 5) + 1;
    const result = await searchAnime({ page: randomPage, perPage: 25, sort: ['FAVOURITES_DESC'] });

    if (result.media.length === 0) {
      return NextResponse.json({ error: 'No anime found' }, { status: 404 });
    }

    const randomIndex = Math.floor(Math.random() * result.media.length);
    const anime = result.media[randomIndex];

    return NextResponse.json({
      id: anime.id,
      title: anime.title,
      coverImage: anime.coverImage,
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
