import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { createServerClient } from "@/lib/supabase";

const CATEGORY_SLUGS = [
  "construction",
  "insurance",
  "retail",
  "food-beverage",
  "professional-services",
  "technology",
  "healthcare",
  "real-estate",
  "transportation",
  "other",
];

const formatCategoryNameFromSlug = (slug: string) =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data } = await supabase.from("categories").select("slug");

  const dbSlugs = (data ?? []).map((category) => category.slug);
  const allSlugs = Array.from(new Set([...CATEGORY_SLUGS, ...dbSlugs]));

  return allSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; locale: string };
}): Promise<Metadata> {
  const supabase = createServerClient();

  const { data: category } = await supabase
    .from("categories")
    .select("name, business_count")
    .eq("slug", params.slug)
    .single();

  let categoryName = category?.name ?? null;
  let businessCount = category?.business_count ?? null;

  if (!categoryName) {
    const { data: fallbackCategory } = await supabase
      .from("businesses")
      .select("category")
      .eq("category_slug", params.slug)
      .not("category", "is", null)
      .limit(1)
      .maybeSingle();

    categoryName = fallbackCategory?.category ?? formatCategoryNameFromSlug(params.slug);
  }

  if (businessCount == null) {
    const { count } = await supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })
      .eq("category_slug", params.slug)
      .eq("status", "Active");

    businessCount = count ?? null;
  }

  if (!categoryName || (businessCount ?? 0) === 0) {
    return { title: "Category Not Found | FLBusinessSearch" };
  }

  const isEs = params.locale === "es";
  const localPath = isEs ? `/es/categoria/${params.slug}` : `/category/${params.slug}`;
  const canonical = `https://flbusinesssearch.com${localPath}`;
  const title = `${categoryName} Businesses in Florida | FLBusinessSearch`;
  const description = `Find ${categoryName} businesses registered in Florida. Browse ${
    businessCount?.toLocaleString() ?? ""
  }+ records updated daily from Sunbiz.org.`;

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
        en: `https://flbusinesssearch.com/category/${params.slug}`,
        es: `https://flbusinesssearch.com/es/categoria/${params.slug}`,
      },
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: { slug: string; locale: string };
}) {
  setRequestLocale(params.locale);
  const supabase = createServerClient();
  const t = await getTranslations({ locale: params.locale, namespace: "category" });

  const isEs = params.locale === "es";
  const businessPath = (slug: string) => (isEs ? `/es/negocio/${slug}` : `/business/${slug}`);
  const countyPath = (slug: string) => (isEs ? `/es/condado/${slug}` : `/county/${slug}`);
  const searchPath = isEs ? "/es/buscar" : "/search";

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", params.slug)
    .single();

  let categoryName = category?.name ?? null;
  let businessCount = category?.business_count ?? null;

  if (!categoryName) {
    const { data: fallbackCategory } = await supabase
      .from("businesses")
      .select("category")
      .eq("category_slug", params.slug)
      .not("category", "is", null)
      .limit(1)
      .maybeSingle();

    categoryName = fallbackCategory?.category ?? null;
  }

  if (businessCount == null) {
    const { count } = await supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })
      .eq("category_slug", params.slug)
      .eq("status", "Active");

    businessCount = count ?? null;
  }

  if (!categoryName || (businessCount ?? 0) === 0) notFound();

  const { data: hotLeads } = await supabase
    .from("businesses")
    .select("name, slug, entity_type, filing_date, county, website_detected")
    .eq("category_slug", params.slug)
    .eq("hot_lead", true)
    .eq("status", "Active")
    .order("filing_date", { ascending: false })
    .limit(6);

  const { data: recentBusinesses } = await supabase
    .from("businesses")
    .select("name, slug, entity_type, filing_date, county, hot_lead, website_detected")
    .eq("category_slug", params.slug)
    .eq("status", "Active")
    .order("filing_date", { ascending: false })
    .limit(12);

  const { data: countyData } = await supabase
    .from("businesses")
    .select("county, county_slug")
    .eq("category_slug", params.slug)
    .eq("status", "Active")
    .not("county", "is", null);

  const countyCounts: Record<string, { name: string; slug: string; count: number }> = {};
  countyData?.forEach((business) => {
    if (business.county && business.county_slug) {
      if (!countyCounts[business.county_slug]) {
        countyCounts[business.county_slug] = {
          name: business.county,
          slug: business.county_slug,
          count: 0,
        };
      }
      countyCounts[business.county_slug].count++;
    }
  });

  const topCounties = Object.values(countyCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

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
            {t("searchBusinesses")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <nav className="mb-6 flex items-center gap-2 text-xs text-[#9B9B9B]">
          <Link href="/" className="hover:text-[#1A1A1A]">
            {t("floridaBusinesses")}
          </Link>
          <span>›</span>
          <span className="text-[#1A1A1A]">{categoryName}</span>
        </nav>

        <div className="mb-10">
          <h1 className="font-display text-[36px] leading-tight text-[#1A1A1A] md:text-[48px]">
            {t("heading", { category: categoryName })}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[#6B6B6B]">
            {t("browseIntro", { category: categoryName.toLowerCase() })}
          </p>
        </div>

        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            { value: businessCount?.toLocaleString() ?? "—", label: t("totalBusinesses") },
            { value: topCounties.length.toString(), label: t("countiesActive") },
            { value: t("daily"), label: t("dataUpdated") },
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
              <h2 className="font-display text-xl text-[#1A1A1A]">
                {t("hotLeadsHeading", { category: categoryName })}
              </h2>
              <a href="https://flbusinesssearch.com/alerts" className="text-sm text-[#E8824A] hover:underline">
                {t("getAlerts")}
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
                        {biz.county && `${biz.county} ${t("county")}`}
                        {biz.filing_date &&
                          ` · ${t("filed")} ${new Date(biz.filing_date).toLocaleDateString(dateLocale, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-full border border-[#E8824A]/30 bg-white px-2 py-0.5 text-xs text-[#E8824A]">
                      🔥 {t("hot")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {recentBusinesses && recentBusinesses.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 font-display text-xl text-[#1A1A1A]">
              {t("recentHeading", { category: categoryName })}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white">
              {recentBusinesses.map((biz, index) => (
                <Link
                  key={biz.slug}
                  href={businessPath(biz.slug)}
                  className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-cream ${
                    index < recentBusinesses.length - 1 ? "border-b border-[#E8E4DC]" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">{biz.name}</p>
                    <p className="mt-0.5 text-xs text-[#9B9B9B]">
                      {biz.county && `${biz.county} ${t("county")}`}
                      {biz.entity_type && ` · ${biz.entity_type}`}
                      {biz.filing_date &&
                        ` · ${new Date(biz.filing_date).toLocaleDateString(dateLocale, {
                          month: "short",
                          year: "numeric",
                        })}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {!biz.website_detected && (
                      <span className="text-xs text-[#9B9B9B]">{t("noWebsite")}</span>
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

        {topCounties.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 font-display text-xl text-[#1A1A1A]">
              {t("byCountyHeading", { category: categoryName })}
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {topCounties.map((county) => (
                <Link
                  key={county.slug}
                  href={countyPath(county.slug)}
                  className="rounded-xl border border-[#E8E4DC] bg-white p-4 transition-colors hover:border-[#E8824A]"
                >
                  <p className="text-sm font-medium text-[#1A1A1A]">{county.name}</p>
                  <p className="mt-1 text-xs text-[#9B9B9B]">
                    {county.count} {t("businesses")}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mb-10 rounded-2xl bg-[#1A1A1A] p-8 text-center">
          <h2 className="mb-3 font-display text-[24px] text-white">
            {t("ctaHeading", { category: categoryName })}
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-[#9B9B9B]">
            {t("ctaSubtext", { category: categoryName.toLowerCase() })}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://flbusinesssearch.com/alerts"
              className="rounded-full bg-[#E8824A] px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#D4713A]"
            >
              {t("ctaButton")}
            </a>
            <a
              href={`https://flbusinesssearch.com/search?category=${encodeURIComponent(categoryName)}`}
              className="rounded-full border border-white px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              {t("ctaSearch", { category: categoryName })}
            </a>
          </div>
        </section>

        <div className="border-t border-[#E8E4DC] pt-6 text-xs text-[#9B9B9B]">
          <p>{t("dataSource")}</p>
          <p className="mt-1">{t("notAffiliated")}</p>
        </div>
      </main>

      <footer className="mt-16 bg-[#1A1A1A] px-6 py-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs text-[#6B6B6B]">{t("footerCopy")}</p>
          <div className="mt-3 flex justify-center gap-4">
            <a href="/privacy" className="text-xs text-[#6B6B6B] transition-colors hover:text-white">
              Privacy Policy
            </a>
            <a href="/terms" className="text-xs text-[#6B6B6B] transition-colors hover:text-white">
              Terms of Service
            </a>
            <a
              href="https://dos.fl.gov/sunbiz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#6B6B6B] transition-colors hover:text-white"
            >
              Data: Florida DOS
            </a>
          </div>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `${categoryName} Businesses in Florida`,
            description: `Browse registered ${categoryName.toLowerCase()} businesses across Florida. Updated daily from Sunbiz.org.`,
            url: `https://flbusinesssearch.com/category/${params.slug}`,
            dateModified: new Date().toISOString().split("T")[0],
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: t("floridaBusinesses"),
                  item: "https://flbusinesssearch.com",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: `${categoryName} Businesses`,
                  item: `https://flbusinesssearch.com/category/${params.slug}`,
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
