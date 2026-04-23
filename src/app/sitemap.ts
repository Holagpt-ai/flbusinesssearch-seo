import { MetadataRoute } from 'next';
import { createServerClient } from '@/lib/supabase';

const BASE_URL = 'https://flbusinesssearch.com';

export const revalidate = 86400; // Regenerate once per day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerClient();

  // ─── STATIC PAGES ─────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/file-llc`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/shield`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/alerts`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // ─── SPANISH STATIC PAGES ─────────────────────────────────────
  const spanishStaticPages: MetadataRoute.Sitemap = staticPages.map((page) => ({
    ...page,
    url: page.url.replace(BASE_URL, `${BASE_URL}/es`),
    priority: (page.priority ?? 0.5) - 0.1,
  }));

  // ─── COUNTY PAGES ─────────────────────────────────────────────
  let countyPages: MetadataRoute.Sitemap = [];
  try {
    const { data: counties } = await supabase
      .from('counties')
      .select('slug, name')
      .not('slug', 'is', null);

    if (counties) {
      countyPages = counties.flatMap((county) => [
        {
          url: `${BASE_URL}/county/${county.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        },
        {
          url: `${BASE_URL}/es/county/${county.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        },
      ]);
    }
  } catch {
    // Silent fail — never break sitemap for missing data
  }

  // ─── CATEGORY PAGES ───────────────────────────────────────────
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const { data: categories } = await supabase
      .from('categories')
      .select('slug, slug_es')
      .not('slug', 'is', null);

    if (categories) {
      categoryPages = categories.flatMap((category) => [
        {
          url: `${BASE_URL}/category/${category.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        },
        {
          url: `${BASE_URL}/es/category/${category.slug_es || category.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        },
      ]);
    }
  } catch {
    // Silent fail — never break sitemap for missing data
  }

  // ─── BUSINESS PROFILE PAGES ───────────────────────────────────
  // Limit to 45,000 to stay safely under Next.js 50,000 URL limit per sitemap
  // Sprint 5 will split into sitemap index for full 3.5M coverage
  let businessPages: MetadataRoute.Sitemap = [];
  try {
    const { data: businesses } = await supabase
      .from('businesses')
      .select('slug, updated_at')
      .eq('status', 'Active')
      .not('slug', 'is', null)
      .order('filing_date', { ascending: false })
      .limit(45000);

    if (businesses) {
      businessPages = businesses.flatMap((biz) => [
        {
          url: `${BASE_URL}/business/${biz.slug}`,
          lastModified: biz.updated_at ? new Date(biz.updated_at) : new Date(),
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        },
        {
          url: `${BASE_URL}/es/negocio/${biz.slug}`,
          lastModified: biz.updated_at ? new Date(biz.updated_at) : new Date(),
          changeFrequency: 'monthly' as const,
          priority: 0.5,
        },
      ]);
    }
  } catch {
    // Silent fail — never break sitemap for missing data
  }

  return [
    ...staticPages,
    ...spanishStaticPages,
    ...countyPages,
    ...categoryPages,
    ...businessPages,
  ];
}
