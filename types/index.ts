// NexAnime — Core TypeScript type definitions

// ─── Anime ───────────────────────────────────────────────

export interface Anime {
  anilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  synonyms: string[];
  synopsis: string | null;
  format: AnimeFormat | null;
  status: AnimeStatus | null;
  season: AnimeSeason | null;
  seasonYear: number | null;
  averageScore: number | null;
  meanScore: number | null;
  source: string | null;
  studios: string[];
  genres: string[];
  tags: AnimeTag[];
  coverImage: string | null;
  bannerImage: string | null;
  episodeCount: number | null;
  nextAiringAt: string | null;
  cachedAt: string | null;
}

export type AnimeFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC';
export type AnimeStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export interface AnimeTag {
  name: string;
  rank: number;
  isAdult: boolean;
}

// ─── Episodes ────────────────────────────────────────────

export interface EpisodeSource {
  id: number;
  anilistId: number;
  episodeNumber: number;
  title: string | null;
  thumbnail: string | null;
  sourceAdapter: string;
  streamUrl: string;
  subtitleUrl: string | null;
  resolvedAt: string | null;
}

// ─── Watchlist ───────────────────────────────────────────

export type ListStatus =
  | 'planning'
  | 'watching'
  | 'on_hold'
  | 'dropped'
  | 'finished'
  | 'rewatching';

export interface WatchlistEntry {
  id: number;
  anilistId: number;
  listStatus: ListStatus;
  startDate: string | null;
  endDate: string | null;
  score: number | null;
  episodeWatched: number;
  totalRewatches: number;
  notes: string | null;
  updatedAt: string | null;
}

// ─── Watch Progress ──────────────────────────────────────

export interface WatchProgress {
  id: number;
  anilistId: number;
  episodeNumber: number;
  secondsWatched: number;
  durationSeconds: number;
  lastWatchedAt: string | null;
}

// ─── Activity Log ────────────────────────────────────────

export type ActivityType = 'status_change' | 'episode_watched' | 'score_updated';

export interface ActivityLogEntry {
  id: number;
  type: ActivityType;
  anilistId: number;
  message: string;
  createdAt: string;
}

// ─── Notifications ───────────────────────────────────────

export type NotificationType = 'new_episode' | 'airing_soon';

export interface Notification {
  id: number;
  anilistId: number;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
}

// ─── Profile ─────────────────────────────────────────────

export interface Profile {
  id: 1;
  displayName: string | null;
  pronouns: string | null;
  aboutMe: string | null;
  avatarCharId: number | null;
  onboardedAt: string | null;
  createdAt: string | null;
}

// ─── Settings ────────────────────────────────────────────

export type TitleLanguage = 'romaji' | 'english' | 'native';
export type VideoQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';

export interface Settings {
  id: 1;
  titleLanguage: TitleLanguage;
  hideAdultContent: boolean;
  autoplayTrailers: boolean;
  videoQuality: VideoQuality;
  autoPlay: boolean;
  autoNext: boolean;
  autoSkipIntroOutro: boolean;
  miniPlayer: boolean;
  ambientMode: boolean;
  pauseHistory: boolean;
}

// ─── Subscriptions ───────────────────────────────────────

export interface Subscription {
  anilistId: number;
  subscribedAt: string;
}

// ─── AniList API response types ──────────────────────────

export interface AniListMedia {
  id: number;
  idMal?: number | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  synonyms: string[];
  description: string | null;
  format: AnimeFormat | null;
  status: AnimeStatus | null;
  season: AnimeSeason | null;
  seasonYear: number | null;
  averageScore: number | null;
  meanScore: number | null;
  source: string | null;
  studios: {
    nodes: Array<{ name: string; isAnimationStudio: boolean }>;
  };
  genres: string[];
  tags: Array<{ name: string; rank: number; isAdult: boolean }>;
  coverImage: {
    extraLarge: string | null;
    large: string | null;
    medium: string | null;
  };
  bannerImage: string | null;
  episodes: number | null;
  lastEpisode?: number | null;
  streamingEpisodes?: Array<{ title: string; thumbnail?: string; url?: string; site?: string }> | null;
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
  } | null;
  trailer: {
    id: string;
    site: string;
  } | null;
  popularity: number | null;
  favourites: number | null;
  stats: {
    scoreDistribution: Array<{ score: number; amount: number }> | null;
  } | null;
  relations: {
    edges: Array<{
      relationType: string;
      node: AniListMedia;
    }>;
  };
  recommendations: {
    nodes: Array<{
      mediaRecommendation: AniListMedia | null;
    }>;
  };
  characters: {
    edges: Array<{
      role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
      node: {
        id: number;
        name: { full: string };
        image: { large: string | null };
      };
      voiceActors: Array<{
        id: number;
        name: { full: string };
        image: { large: string | null };
        languageV2: string;
      }>;
    }>;
  };
  staff?: {
    edges: Array<{
      role: string;
      node: {
        id: number;
        name: { full: string };
        image: { large: string | null };
      };
    }>;
  };
  rating?: string | null;
  duration?: number | null;
  subbed?: number | null;
  dubbed?: number | null;
  trending?: number | null;
  artworks?: string[];
  externalLinks?: Array<{ id: number; site: string; url: string; type?: string; language?: string }>;
  startDate?: { year: number; month: number; day: number } | null;
  endDate?: { year: number; month: number; day: number } | null;
  countryOfOrigin?: string | null;
  hashtag?: string | null;
  isLicensed?: boolean | null;
  canWatch?: boolean | null;
}

export interface AniListPageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  perPage: number;
}

export interface AniListSearchResult {
  Page: {
    pageInfo: AniListPageInfo;
    media: AniListMedia[];
  };
}

export interface AniListAiringSchedule {
  id: number;
  airingAt: number;
  episode: number;
  mediaId: number;
  media: AniListMedia;
}

export interface BrowseFilters {
  search?: string;
  genres?: string[];
  format?: AnimeFormat;
  seasonYear?: number;
  season?: AnimeSeason;
  status?: AnimeStatus;
  sort?: string[];
  countryOfOrigin?: string;
  source?: string;
  tags?: string[];
  isAdult?: boolean;
  page?: number;
  perPage?: number;
}

// ─── Jikan API types ──────────────────────────────────────

export interface JikanCharacter {
  mal_id: number;
  url: string;
  images: {
    jpg: { image_url: string; small_image_url?: string };
    webp: { image_url: string; small_image_url?: string };
  };
  name: string;
  name_kanji?: string;
}

export interface JikanVoiceActor {
  person: {
    mal_id: number;
    url: string;
    images: { jpg: { image_url: string } };
    name: string;
  };
  language: string;
}

export interface JikanCharacterEntry {
  character: JikanCharacter;
  role: string;
  favorites: number;
  voice_actors: JikanVoiceActor[];
}

export interface JikanStaffEntry {
  person: {
    mal_id: number;
    url: string;
    images: { jpg: { image_url: string } };
    name: string;
  };
  positions: string[];
}

export interface JikanEpisode {
  mal_id: number;
  url: string;
  title: string;
  title_english: string | null;
  title_japanese: string;
  aired: string | null;
  score: number | null;
  filler: boolean;
  recap: boolean;
  forum_url: string | null;
  synopsis: string | null;
}

export interface CharacterWithVA {
  id: number;
  malId: number;
  name: string;
  image: string | null;
  role: string;
  voiceActors: Array<{
    id: number;
    name: string;
    image: string | null;
    language: string;
  }>;
}

export interface StaffEntry {
  id: number;
  name: string;
  image: string | null;
  roles: string[];
}

// ─── Extended Anime types for rich detail ─────────────────

export interface ExtendedAnime extends Anime {
  malId: number | null;
  duration: number | null;
  popularity: number | null;
  trending: number | null;
  favourites: number | null;
  rating: string | null;
  isAdult: boolean;
  countryOfOrigin: string | null;
  hashtag: string | null;
  trailer: { id: string; site: string; thumbnail?: string } | null;
  nextAiringEpisode: { airingAt: number; episode: number; timeUntilAiring?: number } | null;
  scoreDistribution: Array<{ score: number; amount: number }> | null;
  statusDistribution: Array<{ status: string; amount: number }> | null;
  relations: Array<{
    id: number;
    titleRomaji: string | null;
    titleEnglish: string | null;
    format: string | null;
    status: string | null;
    coverImage: string | null;
    relationType: string;
  }> | null;
  recommendations: Array<{
    id: number;
    titleRomaji: string | null;
    titleEnglish: string | null;
    format: string | null;
    status: string | null;
    coverImage: string | null;
    score: number | null;
  }> | null;
  episodes: Array<{
    number: number;
    title: string | null;
    thumbnail: string | null;
    aired: string | null;
    filler: boolean;
    recap: boolean;
  }> | null;
  characters: CharacterWithVA[] | null;
  staff: StaffEntry[] | null;
}

// ─── Component prop types ────────────────────────────────

export interface AnimeCardProps {
  id: number;
  poster: string | null;
  title: string;
  format: AnimeFormat | null;
  year: number | null;
  status: AnimeStatus | null;
  score: number | null;
}

export interface ContinueWatchingCardProps {
  anilistId: number;
  poster: string | null;
  title: string;
  subtitle: string | null;
  progressPercent: number;
  durationLabel: string;
}
