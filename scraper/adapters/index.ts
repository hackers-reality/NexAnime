import { MockAdapterAlpha } from './mockAlpha';
import { MockAdapterBeta } from './mockBeta';
import type { ScraperAdapter } from './adapter';

export * from './adapter';

export const ADAPTERS: ScraperAdapter[] = [
  new MockAdapterAlpha(),
  new MockAdapterBeta(),
];
