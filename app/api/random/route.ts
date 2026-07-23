import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
  'Supernatural', 'Thriller', 'Mecha', 'Psychological',
];

export async function GET() {
  try {
    // Try DB cache first - pick a random anime from the cache
    const cached = await query<{ anilist_id: number }>(
      'SELECT anilist_id FROM anime_cache ORDER BY RANDOM() LIMIT 1'
    );

    if (cached && cached.length > 0) {
      return NextResponse.json({ id: cached[0].anilist_id });
    }

    // Fallback: random AniList query with random genre and sort
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
    const sortOptions = ['SCORE_DESC', 'POPULARITY_DESC', 'START_DATE_DESC', 'FAVOURITES_DESC'];
    const sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];

    const gqlQuery = `query ($genre: String, $sort: [MediaSort]) {
      Page(perPage: 1, page: ${Math.floor(Math.random() * 10) + 1}) {
        media(genre: $genre, sort: $sort, type: ANIME) {
          id
        }
      }
    }`;

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gqlQuery, variables: { genre, sort } }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch random anime' }, { status: 500 });
    }

    const data = await res.json();
    const media = data.data?.Page?.media?.[0];

    if (!media?.id) {
      return NextResponse.json({ error: 'No random anime found' }, { status: 404 });
    }

    return NextResponse.json({ id: media.id });
  } catch (err) {
    console.error('[Random] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
