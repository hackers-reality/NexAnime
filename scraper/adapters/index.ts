import { NovaAdapter } from './hianime';
import { GogoanimeAdapter } from './gogoanime';
import { AnimepaheAdapter } from './animepahe';
import type { ScraperAdapter } from './adapter';

export * from './adapter';

export const ADAPTERS: ScraperAdapter[] = [
  new NovaAdapter(),
  new GogoanimeAdapter(),
  new AnimepaheAdapter(),
];
