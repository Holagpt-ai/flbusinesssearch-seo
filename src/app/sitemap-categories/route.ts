import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Canonical 20-category slug list — must stay in sync with:
//   enrichment-agent/index.ts (classifyCategory)
//   supabase/migrations/20260428000001_categories_20_canonical.sql
//   src/app/[locale]/category/[slug]/page.tsx (CATEGORY_SLUGS)
const FALLBACK_SLUGS = [
  "legal-services",
  "healthcare",
  "insurance",
  "real-estate",
  "construction",
  "landscaping",
  "home-services",
  "automotive",
  "transportation",
  "food-beverage",
  "cleaning-services",
  "beauty-wellness",
  "technology",
  "marketing-advertising",
  "accounting-finance",
  "education",
  "retail",
  "professional-services",
  "nonprofit-religious",
  "general-business",
];

export async function GET() {
  const baseUrl = 'https://flbusinesssearch.com';
  const now = new Date().toISOString();

  // Try DB first; fall back to hardcoded slugs if the call fails or returns empty
  let slugs: string[] = FALLBACK_SLUGS;
  try {
    const supabase = createServerClient();
    const { data: categories } = await supabase.from('categories').select('slug');
    if (categories && categories.length > 0) {
      slugs = categories.map((c) => c.slug);
    }
  } catch {
    // DB unavailable — use fallback so the sitemap is never empty
  }

  const urls = slugs.flatMap((slug) => [
    `<url><loc>${baseUrl}/category/${slug}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    `<url><loc>${baseUrl}/es/categoria/${slug}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`,
  ]);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
