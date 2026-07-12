import type { ScraperAdapter, ScraperSource } from './adapter';

export class MockAdapterBeta implements ScraperAdapter {
  id = 'mock-beta';
  name = 'Server Beta (Tears of Steel)';

  async resolveEpisodeSource(
    anilistId: number,
    episodeNumber: number
  ): Promise<ScraperSource | null> {
    // Simulate slight network delay
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
      adapterId: this.id,
      sourceName: this.name,
      // Public test HLS stream
      streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
      subtitleUrl: null,
    };
  }
}
