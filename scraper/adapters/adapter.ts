// NexAnime — Video source scraper adapter interface
// Every streaming source scraper must implement this interface

export interface ScraperSource {
  adapterId: string;
  sourceName: string;
  streamUrl: string;
  subtitleUrl: string | null;
}

export interface ScraperAdapter {
  id: string; // Unique identifier for the adapter, e.g. 'mock-alpha'
  name: string; // Human readable name for the server selection UI, e.g. 'Server Alpha'

  /**
   * Resolves the video stream and subtitles for a specific anime episode.
   * @param anilistId The AniList ID of the anime
   * @param episodeNumber The episode number
   * @returns Resolved stream details, or null if not found/error
   */
  resolveEpisodeSource(
    anilistId: number,
    episodeNumber: number
  ): Promise<ScraperSource | null>;
}
