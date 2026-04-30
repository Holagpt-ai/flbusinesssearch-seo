import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { createServerClient } from "@/lib/supabase";
import { Footer } from "@/components/Footer";

const PAGE_SIZE = 20;

const FLORIDA_COUNTIES = [
  "Alachua","Baker","Bay","Bradford","Brevard","Broward","Calhoun","Charlotte",
  "Citrus","Clay","Collier","Columbia","DeSoto","Dixie","Duval","Escambia",
  "Flagler","Franklin","Gadsden","Gilchrist","Glades","Gulf","Hamilton","Hardee",
  "Hendry","Hernando","Highlands","Hillsborough","Holmes","Indian River","Jackson",
  "Jefferson","Lafayette","Lake","Lee","Leon","Levy","Liberty","Madison","Manatee",
  "Marion","Martin","Miami-Dade","Monroe","Nassau","Okaloosa","Okeechobee","Orange",
  "Osceola","Palm Beach","Pasco","Pinellas","Polk","Putnam","Santa Rosa","Sarasota",
  "Seminole","St. Johns","St. Lucie","Sumter","Suwannee","Taylor","Union","Volusia",
  "Wakulla","Walton","Washington",
];

const SORT_OPTIONS = [
  { value: "newest", field: "filing_date", asc: false },
  { value: "oldest", field: "filing_date", asc: true },
  { value: "nameAZ", field: "name", asc: true },
  { value: "nameZA", field: "name", asc: false },
  { value: "hot", field: "hot_lead", asc: false },
];

interface SearchPageProps {
  params: { locale: string };
  searchParams: {
    q?: string;
    county?: string;
    category?: string;
    status?: string;
    sort?: string;
    page?: string;
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const q = searchParams.q || "";
  const county = searchParams.county || "";
  const isEs = params.locale === "es";
  const canonical = isEs
    ? "https://search.flbusinesssearch.com/es/buscar"
    : "https://search.flbusinesssearch.com/search";

  const title = q
    ? `Search results for "${q}"${county ? ` in ${county}` : ""} | FLBusinessSearch`
    : "Browse Florida's Business Database | FLBusinessSearch";

  const description = q
    ? `Search results for "${q}" in Florida's business database. Browse active LLCs, corporations, and registered businesses${county ? ` in ${county} County` : ""}. Updated daily from Sunbiz.org.`
    : "Browse 3.5M+ registered Florida businesses. Filter by county, industry, and lead status. Free, updated daily from Sunbiz.org.";

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: "https://flbusinesssearch.com/og-image.png", width: 1200, height: 630 }],
      siteName: "FLBusinessSearch",
    },
    alternates: {
      canonical,
      languages: {
        en: "https://search.flbusinesssearch.com/search",
        es: "https://search.flbusinesssearch.com/es/buscar",
      },
    },
  };
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function buildSearchUrl(
  locale: string,
  params: Record<string, string | undefined>
): string {
  const base = locale === "es" ? "/es/buscar" : "/search";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all") sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  setRequestLocale(params.locale);

  const t = await getTranslations({ locale: params.locale, namespace: "search" });
  const tCommon = await getTranslations({ locale: params.locale, namespace: "common" });
  const tFooter = await getTranslations({ locale: params.locale, namespace: "county" });
  const isEs = params.locale === "es";

  const q = searchParams.q || "";
  const county = searchParams.county || "";
  const category = searchParams.category || "";
  const status = searchParams.status || "";
  const sort = searchParams.sort || "newest";
  const page = Math.max(0, parseInt(searchParams.page || "0", 10));

  const supabase = createServerClient();

  // Fetch categories for filter dropdown
  const { data: categories } = await supabase
    .from("categories")
    .select("name, slug")
    .order("name", { ascending: true });

  // Build query
  let query = supabase.from("businesses").select("*", { count: "exact" });

  if (q) {
    query = query.ilike("name_normalized", `%${normalizeName(q)}%`);
  }
  if (county && county !== "all") {
    query = query.eq("county", county);
  }
  if (category && category !== "all") {
    query = query.eq("category_slug", category);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const sortOpt = SORT_OPTIONS.find((s) => s.value === sort) || SORT_OPTIONS[0];
  query = query.order(sortOpt.field, { ascending: sortOpt.asc });

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: results, count, error } = await query.range(from, to);

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const dateLocale = isEs ? "es-ES" : "en-US";

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString(dateLocale, { month: "short", year: "numeric" });
  };

  const profilePath = (slug: string) =>
    isEs ? `/es/negocio/${slug}` : `/business/${slug}`;

  // Pagination helpers
  const pageNumbers: number[] = [];
  const start = Math.max(0, page - 2);
  const end = Math.min(totalPages - 1, start + 4);
  for (let i = start; i <= end; i++) pageNumbers.push(i);

  const makePageUrl = (p: number) =>
    buildSearchUrl(params.locale, { q, county, category, status, sort, page: String(p) });

  // Schema markup
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: q
      ? `Florida business search results for "${q}"`
      : "Florida Business Database",
    description: `Browse registered Florida businesses${county ? ` in ${county} County` : ""}. Updated daily from Sunbiz.org.`,
    numberOfItems: totalCount,
    itemListElement: (results || []).slice(0, 10).map((biz, i) => ({
      "@type": "ListItem",
      position: from + i + 1,
      url: `https://search.flbusinesssearch.com${profilePath(biz.slug)}`,
      name: biz.name,
    })),
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-[#E8E4DC] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <a
            href="https://flbusinesssearch.com"
            className="font-display text-xl font-bold text-[#E8824A]"
          >
            FLBusinessSearch
          </a>
          <a
            href="https://flbusinesssearch.com"
            className="text-sm text-[#6B6B6B] transition-colors hover:text-[#1A1A1A]"
          >
            ← {t("backToHome")}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">

        {/* Hero block */}
        <div className="mb-8">
          <h1 className="font-display text-[32px] leading-tight text-[#1A1A1A] md:text-[40px]">
            {t("heading")}
          </h1>
          <p className="mt-2 text-base text-[#6B6B6B]">
            {t("subheading")}
          </p>

          {/* Audience callouts */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-6">
            <div className="flex items-start gap-2 rounded-xl border border-[#E8E4DC] bg-white px-4 py-3 text-sm text-[#1A1A1A]">
              <span className="text-base">🔍</span>
              <div>
                <span className="font-medium">{t("calloutResearchTitle")}</span>{" "}
                <span className="text-[#6B6B6B]">{t("calloutResearchSub")}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-[#E8E4DC] bg-white px-4 py-3 text-sm text-[#1A1A1A]">
              <span className="text-base">🔥</span>
              <div>
                <span className="font-medium">{t("calloutHuntTitle")}</span>{" "}
                <span className="text-[#6B6B6B]">{t("calloutHuntSub")}</span>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <form
            method="GET"
            action={isEs ? "/es/buscar" : "/search"}
            className="mt-6 flex gap-2"
          >
            {/* Preserve other filters when re-searching */}
            {county && <input type="hidden" name="county" value={county} />}
            {category && <input type="hidden" name="category" value={category} />}
            {status && <input type="hidden" name="status" value={status} />}
            {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder={t("searchPlaceholder")}
              className="flex-1 rounded-xl border border-[#D4CFC6] bg-white px-4 py-3 text-sm text-[#1A1A1A] outline-none placeholder:text-[#9B9B9B] focus:border-[#E8824A]"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#E8824A] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#D4713A]"
            >
              {t("searchBtn")}
            </button>
          </form>
        </div>

        {/* Filter bar */}
        <form method="GET" action={isEs ? "/es/buscar" : "/search"}>
          {q && <input type="hidden" name="q" value={q} />}
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#E8E4DC] bg-white p-4">
            {/* County */}
            <div className="flex flex-col">
              <span className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9B9B9B]">
                {t("countyFilter")}
              </span>
              <select
                name="county"
                defaultValue={county || "all"}
                className="rounded-lg border border-[#D4CFC6] bg-white px-3 py-2 text-xs text-[#1A1A1A] outline-none"
              >
                <option value="all">{t("allCounties")}</option>
                {FLORIDA_COUNTIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="flex flex-col">
              <span className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9B9B9B]">
                {t("categoryFilter")}
              </span>
              <select
                name="category"
                defaultValue={category || "all"}
                className="rounded-lg border border-[#D4CFC6] bg-white px-3 py-2 text-xs text-[#1A1A1A] outline-none"
              >
                <option value="all">{t("allCategories")}</option>
                {(categories || []).map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="flex flex-col">
              <span className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9B9B9B]">
                {t("statusFilter")}
              </span>
              <select
                name="status"
                defaultValue={status || "all"}
                className="rounded-lg border border-[#D4CFC6] bg-white px-3 py-2 text-xs text-[#1A1A1A] outline-none"
              >
                <option value="all">{t("allStatuses")}</option>
                <option value="Active">{tCommon("active")}</option>
                <option value="Inactive">{tCommon("inactive")}</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex flex-col">
              <span className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9B9B9B]">
                {t("sortFilter")}
              </span>
              <select
                name="sort"
                defaultValue={sort}
                className="rounded-lg border border-[#D4CFC6] bg-white px-3 py-2 text-xs text-[#1A1A1A] outline-none"
              >
                <option value="newest">{t("newestFirst")}</option>
                <option value="oldest">{t("oldestFirst")}</option>
                <option value="nameAZ">{t("nameAZ")}</option>
                <option value="nameZA">{t("nameZA")}</option>
                <option value="hot">{t("hotLeadsFirst")}</option>
              </select>
            </div>

            <button
              type="submit"
              className="rounded-lg border border-[#E8824A] px-4 py-2 text-xs font-medium text-[#E8824A] transition-colors hover:bg-[#FDF0E8]"
            >
              {t("applyFilters")}
            </button>

            <div className="ml-auto">
              <span className="rounded-full border border-[#E8E4DC] bg-cream px-3 py-1 text-xs font-medium text-[#1A1A1A]">
                {totalCount.toLocaleString()} {t("resultsFound")}
              </span>
            </div>
          </div>
          <p className="mb-4 text-[11px] text-[#9B9B9B]">
            {t("dataSource")}
          </p>
        </form>

        {/* Results */}
        {error ? (
          <div className="rounded-xl border border-[#E8E4DC] bg-white py-16 text-center">
            <p className="text-sm font-medium text-[#E85A4A]">{t("errorTitle")}</p>
            <p className="mt-1 text-sm text-[#6B6B6B]">{t("errorSub")}</p>
          </div>
        ) : !results || results.length === 0 ? (
          <div className="rounded-xl border border-[#E8E4DC] bg-white py-16 text-center">
            <p className="text-2xl">🔍</p>
            <h2 className="mt-4 font-display text-xl text-[#1A1A1A]">
              {q ? `${t("noResults")} "${q}"` : t("noResultsGeneric")}
            </h2>
            <p className="mt-2 text-sm text-[#6B6B6B]">{t("noResultsSub")}</p>
            <a
              href={isEs ? "/es/buscar" : "/search"}
              className="mt-5 inline-block rounded-full bg-[#E8824A] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#D4713A]"
            >
              {t("clearSearch")}
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {results.map((biz) => {
              const isHot = biz.hot_lead === true;
              const isWarm = biz.hot_lead !== true && biz.website_detected === false;
              const isActive = biz.status === "Active";

              return (
                <Link
                  key={biz.id}
                  href={profilePath(biz.slug)}
                  className="block rounded-xl border border-[#E8E4DC] bg-white p-5 transition-colors hover:border-[#E8824A]"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    {/* Left: business info */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                          isActive ? "bg-[#22C55E]" : "bg-[#9B9B9B]"
                        }`}
                      />
                      <div>
                        <h2 className="font-display text-[17px] font-medium text-[#1A1A1A]">
                          {biz.name}
                        </h2>
                        <p className="mt-1 text-xs text-[#6B6B6B]">
                          {biz.entity_type}
                          {biz.county && ` · ${biz.county}`}
                          {biz.filing_date && ` · ${t("filed")} ${formatDate(biz.filing_date)}`}
                        </p>
                        {biz.owner_name && (
                          <p className="mt-1 text-[11px] text-[#9B9B9B]">
                            {t("owner")}: {biz.owner_name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: lead badge + view profile */}
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      {isHot && (
                        <div className="rounded-lg border border-[#E85A4A]/25 bg-[#FDF0EE] p-2 min-w-[128px]">
                          <p className="text-[11px] font-medium text-[#E85A4A]">🔥 {tCommon("hotLead")}</p>
                          <p className="text-[10px] text-[#2A7F6F]">✓ {tCommon("noWebsite")}</p>
                          <p className="text-[10px] text-[#2A7F6F]">✓ {tCommon("noGBP")}</p>
                        </div>
                      )}
                      {isWarm && (
                        <div className="rounded-lg border border-[#E8824A]/25 bg-[#FDF0E8] p-2 min-w-[128px]">
                          <p className="text-[11px] font-medium text-[#E8824A]">🟡 {tCommon("warmLead")}</p>
                          <p className="text-[10px] text-[#2A7F6F]">✓ {tCommon("noWebsite")}</p>
                        </div>
                      )}
                      <span className="text-xs font-medium text-[#2A7F6F] hover:underline">
                        {tCommon("viewProfile")} →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {page > 0 && (
              <Link
                href={makePageUrl(page - 1)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[#6B6B6B] transition-colors hover:text-[#E8824A]"
              >
                ← {t("previous")}
              </Link>
            )}
            {pageNumbers.map((p) => (
              <Link
                key={p}
                href={makePageUrl(p)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  p === page
                    ? "bg-[#E8824A] text-white"
                    : "bg-cream text-[#6B6B6B] hover:text-[#E8824A]"
                }`}
              >
                {p + 1}
              </Link>
            ))}
            {page < totalPages - 1 && (
              <Link
                href={makePageUrl(page + 1)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[#6B6B6B] transition-colors hover:text-[#E8824A]"
              >
                {t("next")} →
              </Link>
            )}
          </div>
        )}

        {/* CTA strip */}
        <div className="mt-12 rounded-2xl border border-[#E8824A]/20 bg-[#FDF0E8] p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#E8824A]">
            {t("ctaLabel")}
          </p>
          <h3 className="mt-2 font-display text-xl text-[#1A1A1A]">
            {t("ctaHeading")}
          </h3>
          <p className="mt-1 text-sm text-[#6B6B6B]">{t("ctaSub")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href="https://flbusinesssearch.com/alerts"
              className="rounded-full bg-[#E8824A] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#D4713A]"
            >
              {t("ctaAlerts")}
            </a>
            <a
              href="https://flbusinesssearch.com/file-llc"
              className="rounded-full border border-[#E8824A] px-5 py-2.5 text-sm font-medium text-[#E8824A] transition-colors hover:bg-[#FDF0E8]"
            >
              {t("ctaLLC")}
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-[#E8E4DC] pt-6 text-xs text-[#9B9B9B]">
          <p>
            <a
              href="https://dos.fl.gov/sunbiz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1A1A1A] hover:underline"
            >
              {t("dataSourceFull")}
            </a>
          </p>
          <p className="mt-1">{t("notAffiliated")}</p>
        </div>
      </main>

      <Footer footerCopy={tFooter("footerCopy")} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
    </div>
  );
}
