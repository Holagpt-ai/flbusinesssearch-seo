import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Hardcoded fallback — matches the 10 categories in the DB
// If the DB call fails, GSC always gets valid URLs instead of an empty urlset
const FALLBACK_SLUGS = [
  'construction',
  'landscaping',
  'cleaning-services',
  'restaurants-and-food',
  'web-design-and-marketing',
  'insurance',
  'accounting-and-bookkeeping',
  'home-services',
  'retail',
  'professional-services',
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
