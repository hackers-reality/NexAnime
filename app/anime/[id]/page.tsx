import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { queryOne } from '@/lib/db';
import { findAnimetsuIdByAnilistId, animetsuGetInfo, animetsuInfoToMedia } from '@/lib/animetsu';
import { getAnimeDetail } from '@/lib/anilist';
import Header from '@/components/shared/Header';
import AnimeDetailClient from './AnimeDetailClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const anilistId = parseInt(id);
  if (isNaN(anilistId)) return {};

  // Try DB cache first
  const cached = await queryOne<{
    title_romaji: string | null;
    title_english: string | null;
    synopsis: string | null;
    cover_image: string | null;
  }>(
    'SELECT title_romaji, title_english, synopsis, cover_image FROM anime_cache WHERE anilist_id = ?',
    [anilistId]
  );

  if (cached) {
    const title = cached.title_english || cached.title_romaji || 'Anime';
    const description = cached.synopsis?.replace(/<[^>]*>/g, '').slice(0, 160) || '';
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: cached.cover_image ? [{ url: cached.cover_image, width: 230, height: 325 }] : [],
        type: 'website',
      },
    };
  }

  // Try animetsu (covers 90% of cases)
  const animetsuId = await findAnimetsuIdByAnilistId(anilistId);
  if (animetsuId) {
    const info = await animetsuGetInfo(animetsuId);
    if (info) {
      const media = animetsuInfoToMedia(info);
      if (media) {
        const title = media.title.english || media.title.romaji || 'Anime';
        const description = (media.description || '').replace(/<[^>]*>/g, '').slice(0, 160);
        const image = media.coverImage?.large || media.coverImage?.medium || '';
        return {
          title,
          description,
          openGraph: { title, description, images: image ? [{ url: image, width: 230, height: 325 }] : [], type: 'website' },
        };
      }
    }
  }

  // Fallback to AniList API
  const media = await getAnimeDetail(anilistId);
  if (!media) return {};

  const title = media.title.english || media.title.romaji || 'Anime';
  const description = media.description?.replace(/<[^>]*>/g, '').slice(0, 160) || '';
  const image = media.coverImage?.large || media.coverImage?.medium || '';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image, width: 230, height: 325 }] : [],
      type: 'website',
    },
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const anilistId = parseInt(id);

  if (isNaN(anilistId)) {
    return notFound();
  }

  // Try animetsu first
  const animetsuId = await findAnimetsuIdByAnilistId(anilistId);
  if (animetsuId) {
    const info = await animetsuGetInfo(animetsuId);
    if (info) {
      const media = animetsuInfoToMedia(info);
      if (media) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            <AnimeDetailClient media={media} />
          </div>
        );
      }
    }
  }

  // Fallback to AniList API
  const media = await getAnimeDetail(anilistId);

  if (!media) {
    return notFound();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <AnimeDetailClient media={media} />
    </div>
  );
}
