import { notFound } from 'next/navigation';
import { getAnimeDetail } from '@/lib/anilist';
import Header from '@/components/shared/Header';
import AnimeDetailClient from './AnimeDetailClient';

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
