import { createServerClient } from '@/lib/supabase';
import { NextRequest } from 'next/server';

const BASE_URL = 'https://flbusinesssearch.com';
const PAGE_SIZE = 1000;

export async function GET(request: NextRequest, { params }: { params: { page: string } }) {
  const page = parseInt(params.page, 10);
  if (isNaN(page) || page < 1) {
    return new Response('Invalid page', { status: 400 });
  }

  const supabase = createServerClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: businesses } = await supabase
    .from('businesses')
    .select('slug, updated_at')
    .eq('status', 'Active')
    .not('slug', 'is', null)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (!businesses || businesses.length === 0) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      {
        headers: { 'Content-Type': 'application/xml' },
      },
    );
  }

  const urls = businesses
    .flatMap(
      (b) => {
        const lastmod = b.updated_at ? new Date(b.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        return [
`
 <url>
   <loc>${BASE_URL}/business/${b.slug}</loc>
   <lastmod>${lastmod}</lastmod>
   <changefreq>weekly</changefreq>
   <priority>0.6</priority>
 </url>`,
`
 <url>
   <loc>${BASE_URL}/es/negocio/${b.slug}</loc>
   <lastmod>${lastmod}</lastmod>
   <changefreq>weekly</changefreq>
   <priority>0.6</priority>
 </url>`,
        ];
      }
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

// Generate sitemap index page that lists all business sitemap pages
export async function generateStaticParams() {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active')
    .not('slug', 'is', null);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  return Array.from({ length: Math.max(totalPages, 1) }, (_, i) => ({
    page: String(i + 1),
  }));
}
