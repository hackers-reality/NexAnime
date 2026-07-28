import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAnimeRecommendations } from '@/lib/anilist';
import { getMediaDetail } from '@/lib/data-api';
import type { AniListMedia } from '@/types';
import Header from '@/components/shared/Header';
import WatchClient from './WatchClient';

interface PageProps {
  params: Promise<{ animeId: string; episodeId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { animeId, episodeId } = await params;
  const anilistId = parseInt(animeId);
  const epNumber = parseInt(episodeId);
  if (isNaN(anilistId) || isNaN(epNumber)) return {};

  let media: AniListMedia | null = null;
  try { media = await getMediaDetail(anilistId); } catch {}

  if (!media) return {};

  const title = media.title?.english || media.title?.romaji || 'Anime';
  const epTitle = `Episode ${epNumber}`;
  const description = media.description?.replace(/<[^>]*>/g, '').slice(0, 160) || '';
  const image = media.coverImage?.extraLarge || media.coverImage?.large || '';

  return {
    title: `${title} ${epTitle}`,
    description,
    openGraph: {
      title: `${title} ${epTitle}`,
      description,
      images: image ? [{ url: image, width: 230, height: 325 }] : [],
      type: 'video.episode',
    },
  };
}

export default async function WatchPage({ params }: PageProps) {
  const { animeId, episodeId } = await params;
  const anilistId = parseInt(animeId);
  const epNumber = parseInt(episodeId);

  if (isNaN(anilistId) || isNaN(epNumber)) {
    return notFound();
  }

  let media: AniListMedia | null = null;
  try {
    media = await getMediaDetail(anilistId);
  } catch {}

  if (media) {
    try {
      const recs = await getAnimeRecommendations(anilistId);
      if (recs) media.recommendations = recs;
    } catch {}
  }

  if (!media) {
    return notFound();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <WatchClient media={media} episodeNumber={epNumber} />
    </div>
  );
}