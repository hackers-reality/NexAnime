import { AnimePlayAdapter, ZokoAdapter } from './hianime';
import { GogoanimeAdapter } from './gogoanime';
import { AnimepaheAdapter } from './animepahe';
import type { ScraperAdapter } from './adapter';

export * from './adapter';

export const ADAPTERS: ScraperAdapter[] = [
  new AnimePlayAdapter(),
  new ZokoAdapter(),
  new GogoanimeAdapter(),
  new AnimepaheAdapter(),
];
