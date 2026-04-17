import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { createServerClient } from "@/lib/supabase";

const FLORIDA_COUNTIES = [
  "alachua",
  "baker",
  "bay",
  "bradford",
  "brevard",
  "broward",
  "calhoun",
  "charlotte",
  "citrus",
  "clay",
  "collier",
  "columbia",
  "desoto",
  "dixie",
  "duval",
  "escambia",
  "flagler",
  "franklin",
  "gadsden",
  "gilchrist",
  "glades",
  "gulf",
  "hamilton",
  "hardee",
  "hendry",
  "hernando",
  "highlands",
  "hillsborough",
  "holmes",
  "indian-river",
  "jackson",
  "jefferson",
  "lafayette",
  "lake",
  "lee",
  "leon",
  "levy",
  "liberty",
  "madison",
  "manatee",
  "marion",
  "martin",
  "miami-dade",
  "monroe",
  "nassau",
  "okaloosa",
  "okeechobee",
  "orange",
  "osceola",
  "palm-beach",
  "pasco",
  "pinellas",
  "polk",
  "putnam",
  "saint-johns",
  "saint-lucie",
  "santa-rosa",
  "sarasota",
  "seminole",
  "sumter",
  "suwannee",
  "taylor",
  "union",
  "volusia",
  "wakulla",
  "walton",
  "washington",
];

export async function generateStaticParams() {
  return FLORIDA_COUNTIES.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; locale: string };
}): Promise<Metadata> {
  const supabase = createServerClient();

  const { data: county } = await supabase
    .from("counties")
    .select("name, business_count")
    .eq("slug", params.slug)
    .single();

  let countyName = county?.name ?? null;
  let businessCount = county?.business_count ?? null;

  // Fallback when county summary rows are missing or incomplete.
  if (!countyName) {
    const { data: countyFallback } = await supabase
      .from("businesses")
      .select("county")
      .eq("county_slug", params.slug)
      .not("county", "is", null)
      .limit(1)
      .maybeSingle();

    countyName = countyFallback?.county ?? null;
  }

  if (businessCount == null && countyName) {
    const { count } = await supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })
      .eq("county_slug", params.slug)
      .eq("status", "Active");

    businessCount = count ?? null;
  }

  if (!countyName) {
    return { title: "County Not Found | FLBusinessSearch" };
  }

  const isEs = params.locale === "es";
  const localPath = isEs ? `/es/condado/${params.slug}` : `/county/${params.slug}`;
  const canonical = `https://flbusinesssearch.com${localPath}`;
  const title = `${countyName} County Florida Businesses | FLBusinessSearch`;
  const description = `Browse ${businessCount?.toLocaleString() ?? ""}+ registered businesses in ${countyName} County, Florida. Search by category, find new filings, and get lead alerts. Updated daily from Sunbiz.org.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
    alternates: {
      canonical,
      languages: {
        en: `https://flbusinesssearch.com/county/${params.slug}`,
        es: `https://flbusinesssearch.com/es/condado/${params.slug}`,
      },
    },
  };
}

export default async function CountyPage({
  params,
}: {
  params: { slug: string; locale: string };
}) {
  setRequestLocale(params.locale);
  const supabase = createServerClient();
  const t = await getTranslations({ locale: params.locale, namespace: "county" });
  const tCommon = await getTranslations({ locale: params.locale, namespace: "common" });
  const isEs = params.locale === "es";

  const countyPath = (slug: string) => (isEs ? `/es/condado/${slug}` : `/county/${slug}`);
  const businessPath = (slug: string) => (isEs ? `/es/negocio/${slug}` : `/business/${slug}`);
  const searchPath = isEs ? "/es/buscar" : "/search";

  const { data: county } = await supabase
    .from("counties")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!county) notFound();

  const { data: recentFilings } = await supabase
    .from("businesses")
    .select("name, slug, entity_type, filing_date, hot_lead, website_detected")
    .eq("county_slug", params.slug)
    .eq("status", "Active")
    .order("filing_date", { ascending: false })
    .limit(10);

  const { data: hotLeads } = await supabase
    .from("businesses")
    .select("name, slug, entity_type, filing_date")
    .eq("county_slug", params.slug)
    .eq("hot_lead", true)
    .eq("status", "Active")
    .order("filing_date", { ascending: false })
    .limit(6);

  const { data: categoryData } = await supabase
    .from("businesses")
    .select("category")
    .eq("county_slug", params.slug)
    .eq("status", "Active")
    .not("category", "is", null);

  const categoryCounts: Record<string, number> = {};
  categoryData?.forEach((business) => {
    if (business.category) {
      categoryCounts[business.category] = (categoryCounts[business.category] || 0) + 1;
    }
  });

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const { count: newThisMonth } = await supabase
    .from("businesses")
    .select("*", { count: "exact", head: true })
    .eq("county_slug", params.slug)
    .eq("status", "Active")
    .gte("filing_date", thisMonthStart.toISOString().split("T")[0]);

  let totalBusinesses = county.business_count;
  if (totalBusinesses == null) {
    const { count } = await supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })
      .eq("county_slug", params.slug)
      .eq("status", "Active");
    totalBusinesses = count;
  }

  const dateLocale = isEs ? "es-ES" : "en-US";

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-[#E8E4DC] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold text-[#E8824A]">
            FLBusinessSearch
          </Link>
          <Link
            href={searchPath}
            className="text-sm text-[#6B6B6B] transition-colors hover:text-[#1A1A1A]"
          >
            Search businesses
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <nav className="mb-6 flex items-center gap-2 text-xs text-[#9B9B9B]">
          <Link href="/" className="hover:text-[#1A1A1A]">
            Florida Businesses
          </Link>
          <span>›</span>
          <span className="text-[#1A1A1A]">{county.name} County</span>
        </nav>

        <div className="mb-10">
          <h1 className="font-display text-[36px] leading-tight text-[#1A1A1A] md:text-[48px]">
            {county.name} County <span className="text-[#E8824A]">Businesses</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[#6B6B6B]">
            Browse registered businesses in {county.name} County, Florida. Updated daily from the
            Florida Division of Corporations.
          </p>
        </div>

        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { value: totalBusinesses?.toLocaleString() ?? "—", label: t("totalBusinesses") },
            { value: newThisMonth?.toLocaleString() ?? "0", label: t("newThisMonth") },
            { value: topCategories.length.toString(), label: t("topCategories") },
            { value: "Daily", label: tCommon("updatedDaily").split(" ")[0] },
          ].map((stat, index) => (
            <div key={index} className="rounded-xl border border-[#E8E4DC] bg-white p-5 text-center">
              <p className="font-display text-[28px] text-[#E8824A]">{stat.value}</p>
              <p className="mt-1 text-xs text-[#9B9B9B]">{stat.label}</p>
            </div>
          ))}
        </div>

        {hotLeads && hotLeads.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-[#1A1A1A]">🔥 Hot Leads in {county.name} County</h2>
              <a href="https://flbusinesssearch.com/alerts" className="text-sm text-[#E8824A] hover:underline">
                Get alerts →
              </a>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {hotLeads.map((biz) => (
                <Link
                  key={biz.slug}
                  href={businessPath(biz.slug)}
                  className="rounded-xl border border-[#E8824A]/20 bg-[#FDF0E8] p-4 transition-colors hover:border-[#E8824A]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{biz.name}</p>
                      <p className="mt-1 text-xs text-[#9B9B9B]">
                        {biz.entity_type}
                        {biz.filing_date &&
                          ` · Filed ${new Date(biz.filing_date).toLocaleDateString(dateLocale, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-full border border-[#E8824A]/30 bg-[#FDF0E8] px-2 py-0.5 text-xs text-[#E8824A]">
                      🔥 Hot
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {recentFilings && recentFilings.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 font-display text-xl text-[#1A1A1A]">
              {t("recentFilings")} in {county.name} County
            </h2>
            <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white">
              {recentFilings.map((biz, index) => (
                <Link
                  key={biz.slug}
                  href={businessPath(biz.slug)}
                  className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-cream ${
                    index < recentFilings.length - 1 ? "border-b border-[#E8E4DC]" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">{biz.name}</p>
                    <p className="mt-0.5 text-xs text-[#9B9B9B]">
                      {biz.entity_type}
                      {biz.filing_date &&
                        ` · ${new Date(biz.filing_date).toLocaleDateString(dateLocale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {!biz.website_detected && (
                      <span className="text-xs text-[#9B9B9B]">No website</span>
                    )}
                    {biz.hot_lead && (
                      <span className="rounded-full bg-[#FDF0E8] px-2 py-0.5 text-xs text-[#E8824A]">
                        🔥
                      </span>
                    )}
                    <span className="text-sm text-[#E8824A]">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {topCategories.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 font-display text-xl text-[#1A1A1A]">
              {t("topCategories")} in {county.name} County
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {topCategories.map(([category, count]) => (
                <a
                  key={category}
                  href={`${searchPath}?county=${params.slug}&category=${encodeURIComponent(category)}`}
                  className="rounded-xl border border-[#E8E4DC] bg-white p-4 transition-colors hover:border-[#E8824A]"
                >
                  <p className="text-sm font-medium text-[#1A1A1A]">{category}</p>
                  <p className="mt-1 text-xs text-[#9B9B9B]">{count} businesses</p>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="mb-10 rounded-2xl bg-[#1A1A1A] p-8 text-center">
          <h2 className="mb-3 font-display text-[24px] text-white">
            Get leads from new {county.name} County businesses
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-[#9B9B9B]">
            New businesses file in {county.name} County every day with no website. Get alerted the
            same day they register.
          </p>
          <a
            href="https://flbusinesssearch.com/alerts"
            className="rounded-full bg-[#E8824A] px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#D4713A]"
          >
            Get lead alerts — $10/mo
          </a>
        </section>

        <div className="border-t border-[#E8E4DC] pt-6 text-xs text-[#9B9B9B]">
          <p>Data sourced from Sunbiz.org — Florida Division of Corporations · Updated daily</p>
          <p className="mt-1">
            FLBusinessSearch is not affiliated with the Florida Division of Corporations or
            Sunbiz.org.
          </p>
        </div>
      </main>

      <footer className="mt-16 bg-[#1A1A1A] px-6 py-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs text-[#6B6B6B]">
            © 2026 FLBusinessSearch · Data sourced from Florida Division of Corporations · Updated
            daily · Not affiliated with Sunbiz.org
          </p>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `${county.name} County Florida Businesses`,
            description: `Browse registered businesses in ${county.name} County, Florida. Updated daily from Sunbiz.org.`,
            url: `https://flbusinesssearch.com${countyPath(params.slug)}`,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Florida Businesses",
                  item: "https://flbusinesssearch.com",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: `${county.name} County`,
                  item: `https://flbusinesssearch.com${countyPath(params.slug)}`,
                },
              ],
            },
          }),
        }}
      />
    </div>
  );
}

export const revalidate = 86400;
