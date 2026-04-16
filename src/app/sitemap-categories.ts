import { MetadataRoute } from 'next';
import { createServerClient } from '@/lib/supabase';

export default async function sitemapCategories(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://flbusinesssearch.com';
  const supabase = createServerClient();

  const { data: categories } = await supabase.from('categories').select('slug, updated_at');

  return (categories ?? []).flatMap((cat) => [
    {
      url: `${baseUrl}/category/${cat.slug}`,
      lastModified: cat.updated_at ? new Date(cat.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/es/categoria/${cat.slug}`,
      lastModified: cat.updated_at ? new Date(cat.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
  ]);
}
