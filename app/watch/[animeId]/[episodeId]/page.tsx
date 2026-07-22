import { notFound } from 'next/navigation';
import { getAnimeRecommendations } from '@/lib/anilist';
import { getMediaDetail } from '@/lib/data-api';
import Header from '@/components/shared/Header';
import WatchClient from './WatchClient';

interface PageProps {
  params: Promise<{ animeId: string; episodeId: string }>;
}

export default async function WatchPage({ params }: PageProps) {
  const { animeId, episodeId } = await params;
  const anilistId = parseInt(animeId);
  const epNumber = parseInt(episodeId);

  if (isNaN(anilistId) || isNaN(epNumber)) {
    return notFound();
  }

  // getMediaDetail handles reanime→mapAnimeDetail→AniList fallback automatically
  let media: any = null;
  try {
    media = await getMediaDetail(anilistId);
  } catch {}

  // Fetch recommendations in parallel (5s timeout, won't block page load)
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
