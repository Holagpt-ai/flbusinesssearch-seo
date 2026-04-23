import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const baseUrl = 'https://flbusinesssearch.com';
  const now = new Date().toISOString();
  const supabase = createServerClient();

  const { data: categories } = await supabase.from('categories').select('slug');

  const urls = (categories ?? []).flatMap((cat) => [
    `<url><loc>${baseUrl}/category/${cat.slug}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    `<url><loc>${baseUrl}/es/categoria/${cat.slug}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`,
  ]);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
