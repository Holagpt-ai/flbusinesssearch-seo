import { createServerClient } from '@/lib/supabase';

const BASE_URL = 'https://flbusinesssearch.com';
const PAGE_SIZE = 1000;

export async function GET() {
  const supabase = createServerClient();

  const { count } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active')
    .not('slug', 'is', null);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const today = new Date().toISOString().split('T')[0];

  const businessSitemaps = Array.from({ length: Math.max(totalPages, 1) }, (_, i) =>
    `  <sitemap>
   <loc>${BASE_URL}/sitemap-businesses/${i + 1}</loc>
   <lastmod>${today}</lastmod>
 </sitemap>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 <sitemap>
   <loc>${BASE_URL}/sitemap.xml</loc>
   <lastmod>${today}</lastmod>
 </sitemap>
 <sitemap>
   <loc>${BASE_URL}/sitemap-counties</loc>
   <lastmod>${today}</lastmod>
 </sitemap>
 <sitemap>
   <loc>${BASE_URL}/sitemap-categories</loc>
   <lastmod>${today}</lastmod>
 </sitemap>
${businessSitemaps}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
