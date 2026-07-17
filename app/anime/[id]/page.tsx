import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAnimeDetail } from '@/lib/anilist';
import Header from '@/components/shared/Header';
import AnimeDetailClient from './AnimeDetailClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const anilistId = parseInt(id);
  if (isNaN(anilistId)) return {};

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

  // Fetch detail data from AniList API (server-side)
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
