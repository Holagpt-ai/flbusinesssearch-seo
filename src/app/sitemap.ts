import { MetadataRoute } from 'next';
import { createServerClient } from '@/lib/supabase';

const BASE_URL = 'https://flbusinesssearch.com';

const FLORIDA_COUNTIES = [
  'alachua', 'baker', 'bay', 'bradford', 'brevard', 'broward', 'calhoun',
  'charlotte', 'citrus', 'clay', 'collier', 'columbia', 'desoto', 'dixie',
  'duval', 'escambia', 'flagler', 'franklin', 'gadsden', 'gilchrist', 'glades',
  'gulf', 'hamilton', 'hardee', 'hendry', 'hernando', 'highlands', 'hillsborough',
  'holmes', 'indian-river', 'jackson', 'jefferson', 'lafayette', 'lake', 'lee',
  'leon', 'levy', 'liberty', 'madison', 'manatee', 'marion', 'martin',
  'miami-dade', 'monroe', 'nassau', 'okaloosa', 'okeechobee', 'orange', 'osceola',
  'palm-beach', 'pasco', 'pinellas', 'polk', 'putnam', 'saint-johns', 'saint-lucie',
  'santa-rosa', 'sarasota', 'seminole', 'sumter', 'suwannee', 'taylor', 'union',
  'volusia', 'wakulla', 'walton', 'washington',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date();

  // 1. Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`,               lastModified: today, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/search`,         lastModified: today, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/get-started`,    lastModified: today, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/file-llc`,       lastModified: today, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/pricing`,        lastModified: today, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/alerts`,         lastModified: today, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/shield`,         lastModified: today, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/about`,          lastModified: today, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/contact`,        lastModified: today, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/privacy-policy`, lastModified: today, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/terms-of-service`, lastModified: today, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // 2. County pages — EN + ES (static list, all 67 Florida counties)
  const countyPages: MetadataRoute.Sitemap = FLORIDA_COUNTIES.flatMap((slug) => [
    { url: `${BASE_URL}/county/${slug}`,       lastModified: today, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/es/condado/${slug}`,   lastModified: today, changeFrequency: 'daily', priority: 0.8 },
  ]);

  // 3. Category pages — EN + ES (dynamic from database)
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServerClient();
    const { data: categories } = await supabase
      .from('categories')
      .select('slug, updated_at');

    categoryPages = (categories ?? []).flatMap((cat) => [
      {
        url: `${BASE_URL}/category/${cat.slug}`,
        lastModified: cat.updated_at ? new Date(cat.updated_at) : today,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      },
      {
        url: `${BASE_URL}/es/categoria/${cat.slug}`,
        lastModified: cat.updated_at ? new Date(cat.updated_at) : today,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      },
    ]);
  } catch {
    // If DB is unreachable, sitemap still returns static + county pages
  }

  return [...staticPages, ...countyPages, ...categoryPages];
}
