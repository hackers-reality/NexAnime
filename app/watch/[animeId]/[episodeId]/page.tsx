import { notFound } from 'next/navigation';
import { getAnimeDetail } from '@/lib/anilist';
import { findAnimetsuIdByAnilistId, animetsuGetInfo, animetsuInfoToMedia } from '@/lib/animetsu';
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
            <WatchClient media={media} episodeNumber={epNumber} />
          </div>
        );
      }
    }
  }

  // Fallback to AniList
  const media = await getAnimeDetail(anilistId);

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
