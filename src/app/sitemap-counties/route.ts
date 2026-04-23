import { NextResponse } from 'next/server';

const FLORIDA_COUNTIES = [
  'alachua','baker','bay','bradford','brevard','broward','calhoun',
  'charlotte','citrus','clay','collier','columbia','desoto','dixie',
  'duval','escambia','flagler','franklin','gadsden','gilchrist','glades',
  'gulf','hamilton','hardee','hendry','hernando','highlands','hillsborough',
  'holmes','indian-river','jackson','jefferson','lafayette','lake','lee',
  'leon','levy','liberty','madison','manatee','marion','martin','miami-dade',
  'monroe','nassau','okaloosa','okeechobee','orange','osceola','palm-beach',
  'pasco','pinellas','polk','putnam','saint-johns','saint-lucie','santa-rosa',
  'sarasota','seminole','sumter','suwannee','taylor','union','volusia',
  'wakulla','walton','washington',
];

export async function GET() {
  const baseUrl = 'https://flbusinesssearch.com';
  const now = new Date().toISOString();

  const urls = FLORIDA_COUNTIES.flatMap((slug) => [
    `<url><loc>${baseUrl}/county/${slug}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    `<url><loc>${baseUrl}/es/condado/${slug}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`,
  ]);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
