import type { ScraperAdapter, ScraperSource } from './adapter';

export class MockAdapterAlpha implements ScraperAdapter {
  id = 'mock-alpha';
  name = 'Server Alpha (Sintel)';

  async resolveEpisodeSource(
    anilistId: number,
    episodeNumber: number
  ): Promise<ScraperSource | null> {
    // Simulate slight network delay
    await new Promise((resolve) => setTimeout(resolve, 350));

    return {
      adapterId: this.id,
      sourceName: this.name,
      // Public test HLS stream
      streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
      subtitleUrl: null,
    };
  }
}
