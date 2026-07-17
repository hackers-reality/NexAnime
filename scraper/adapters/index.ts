import { NovaAdapter } from './hianime';
import { GogoanimeAdapter } from './gogoanime';
import { AnimepaheAdapter } from './animepahe';
import { AnimetsuAdapter } from './animetsu';
import type { ScraperAdapter } from './adapter';

export * from './adapter';

export const ADAPTERS: ScraperAdapter[] = [
  new AnimetsuAdapter(),
  new NovaAdapter(),
  new GogoanimeAdapter(),
  new AnimepaheAdapter(),
];
