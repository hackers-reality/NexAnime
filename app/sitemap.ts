import type { MetadataRoute } from 'next';
import { query } from '@/lib/db';

interface AnimeCacheRow {
  anilist_id: number;
  title_romaji: string;
  title_english: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/browse`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
  ];

  let animePages: MetadataRoute.Sitemap = [];
  try {
    const rows = await query<AnimeCacheRow>(
      'SELECT anilist_id, title_romaji, title_english FROM anime_cache ORDER BY average_score DESC NULLS LAST, anilist_id ASC LIMIT 100'
    );
    animePages = rows.map((row) => ({
      url: `${baseUrl}/anime/${row.anilist_id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.error('[sitemap] Failed to query anime_cache:', err);
  }

  return [...staticPages, ...animePages];
}
