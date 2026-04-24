import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { createServerClient } from "@/lib/supabase";
import type { Business } from "@/types";

// Generate static params for top businesses.
// In production this can be expanded to all known slugs.
// For now generate the first 1000 most recently updated.
export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("businesses")
    .select("slug")
    .eq("status", "Active")
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1000);

  return (data ?? []).map((business) => ({ slug: business.slug as string }));
}

// App Router equivalent to fallback: "blocking"
// Known paths are statically generated, unknown slugs render on demand.
export const dynamicParams = true;

// Enable ISR — revalidate every 24 hours.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: { slug: string; locale: string };
}): Promise<Metadata> {
  const supabase = createServerClient();
  const isEs = params.locale === "es";
  const profilePath = isEs ? `/es/negocio/${params.slug}` : `/business/${params.slug}`;
  const canonical = `https://flbusinesssearch.com${profilePath}`;

  const { data: business } = await supabase
    .from("businesses")
    .select("name, county, entity_type")
    .eq("slug", params.slug)
    .single();

  if (!business) {
    return {
      title: "Business Not Found | FLBusinessSearch",
    };
  }

  const title = `${business.name} | Florida Business Record | FLBusinessSearch`;
  const description = `View the full Florida business record for ${business.name}. ${
    business.entity_type || "Business"
  } in ${business.county || "Florida"} County. Filing date, status, owner, registered agent — sourced from Sunbiz.org.`;

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
        en: `https://flbusinesssearch.com/business/${params.slug}`,
        es: `https://flbusinesssearch.com/es/negocio/${params.slug}`,
      },
    },
  };
}

export default async function BusinessProfilePage({
  params,
}: {
  params: { slug: string; locale: string };
}) {
  setRequestLocale(params.locale);
  const supabase = createServerClient();
  const tBusiness = await getTranslations({ locale: params.locale, namespace: "business" });
  const tCommon = await getTranslations({ locale: params.locale, namespace: "common" });
  const tFooter = await getTranslations({ locale: params.locale, namespace: "county" });
  const t = tBusiness;
  const isEs = params.locale === "es";

  const searchPath = isEs ? "/es/buscar" : "/search";
  const profilePath = (slug: string) =>
    isEs ? `/es/negocio/${slug}` : `/business/${slug}`;
  const currentProfilePath = isEs ? `/es/negocio/${params.slug}` : `/business/${params.slug}`;
  const countyPath = (countySlug: string | null) =>
    countySlug ? `/county/${countySlug}` : "/search";
  const similarSearchPath = (countySlug: string | null) =>
    countySlug ? `${searchPath}?county=${countySlug}` : searchPath;

  const { data: businessData } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!businessData) notFound();

  const business = businessData as Business;

  const isHotLead = business.hot_lead === true;
  const isActive = business.status === "Active";
  const hasWebsite = business.website_detected === true;
  const hasGBP = business.gbp_detected === true;

  const dateLocale = isEs ? "es-ES" : "en-US";
  const filingDate = business.filing_date
    ? new Date(business.filing_date).toLocaleDateString(dateLocale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const lastVerified = business.updated_at
    ? new Date(business.updated_at).toLocaleDateString(dateLocale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const { data: similarBusinesses } = await supabase
    .from("businesses")
    .select("name, slug, entity_type, filing_date, hot_lead")
    .eq("county", business.county ?? "")
    .eq("status", "Active")
    .neq("slug", params.slug)
    .order("updated_at", { ascending: false })
    .limit(4);

  const schemaType = (() => {
    const et = (business.entity_type ?? "").toLowerCase();
    if (et.includes("corp") || et.includes("inc")) return "Corporation";
    if (et.includes("llc") || et.includes("limited liability")) return "LimitedLiabilityCompany";
    if (et.includes("non profit") || et.includes("nonprofit")) return "NGO";
    return "Organization";
  })();

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
            ← {tBusiness("searchBusinesses")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <nav className="mb-6 flex items-center gap-2 text-xs text-[#9B9B9B]">
          <Link href="/" className="hover:text-[#1A1A1A]">
            {tBusiness("floridaBusinesses")}
          </Link>
          <span>›</span>
          {business.county && (
            <>
              {business.county_slug ? (
                <Link
                  href={countyPath(business.county_slug)}
                  className="hover:text-[#1A1A1A]"
                >
                  {business.county}
                </Link>
              ) : (
                <span className="text-[#1A1A1A]">{business.county}</span>
              )}
              <span>›</span>
            </>
          )}
          <span className="text-[#1A1A1A]">{business.name}</span>
        </nav>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isActive
                    ? "bg-[#EBF5F3] text-[#2A7F6F]"
                    : "bg-[#FDF0EE] text-[#E85A4A]"
                }`}
              >
                {isActive ? tCommon("active") : tCommon("inactive")}
              </span>
              {isHotLead && (
                <span className="rounded-full bg-[#FDF0E8] px-2.5 py-1 text-xs font-medium text-[#E8824A]">
                  🔥 {tCommon("hotLead")}
                </span>
              )}
            </div>
            <h1 className="font-display text-[32px] leading-tight text-[#1A1A1A] md:text-[40px]">
              {business.name}
            </h1>
            <p className="mt-2 text-sm text-[#6B6B6B]">
              {business.entity_type || "Business"} · {business.county || "Florida"}, Florida
              {filingDate && ` · ${t("filed")} ${filingDate}`}
            </p>
          </div>
          <a
            href="https://flbusinesssearch.com/file-llc"
            className="whitespace-nowrap rounded-full bg-[#E8824A] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#D4713A]"
          >
            {t("startLLC")}
          </a>
        </div>

        <section className="mb-8">
          <h2 className="mb-4 font-display text-xl text-[#1A1A1A]">{tBusiness("information")}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { label: t("fieldBusinessName"), value: business.name },
              { label: t("fieldEntityType"), value: business.entity_type },
              { label: t("fieldStatus"), value: isActive ? tCommon("active") : tCommon("inactive") },
              { label: t("fieldFilingDate"), value: filingDate },
              {
                label: t("fieldCounty"),
                value: business.county ? `${business.county}, Florida` : null,
              },
              { label: t("fieldOwner"), value: business.owner_name },
              { label: t("fieldRegisteredAgent"), value: business.registered_agent },
              { label: t("fieldOwnerAddress"), value: business.owner_address },
            ].map((field) => (
              <div
                key={field.label}
                className="rounded-xl border border-[#E8E4DC] bg-white p-4"
              >
                <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9B9B9B]">
                  {field.label}
                </p>
                <p className="text-sm font-medium text-[#1A1A1A]">
                  {field.value || tCommon("notAvailable")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 font-display text-xl text-[#1A1A1A]">
            {tBusiness("digitalPresence")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#E8E4DC] bg-white p-5">
              <p className="mb-2 text-xs uppercase tracking-widest text-[#9B9B9B]">
                {t("fieldWebsite")}
              </p>
              {hasWebsite && business.website_url ? (
                <a
                  href={business.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-[#2A7F6F] hover:underline"
                >
                  {business.website_url}
                </a>
              ) : (
                <p className="text-sm text-[#9B9B9B]">● {tCommon("noWebsite")}</p>
              )}
              {!hasWebsite && (
                <p className="mt-2 text-xs text-[#E8824A]">
                  {t("noWebsiteDesigner")}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[#E8E4DC] bg-white p-5">
              <p className="mb-2 text-xs uppercase tracking-widest text-[#9B9B9B]">
                {t("fieldGoogleProfile")}
              </p>
              {hasGBP ? (
                <p className="text-sm text-[#2A7F6F]">● GBP found</p>
              ) : (
                <p className="text-sm text-[#9B9B9B]">● {tCommon("noGBP")}</p>
              )}
            </div>
          </div>
        </section>

        {isHotLead && (
          <section className="mb-8 rounded-2xl border border-[#E8824A]/20 bg-[#FDF0E8] p-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#E8824A]">
              {t("vendorCtaLabel")}
            </p>
            <h3 className="mb-2 font-display text-lg text-[#1A1A1A]">
              {t("vendorCtaHeading")}
            </h3>
            <p className="mb-4 text-sm text-[#6B6B6B]">
              {t("vendorCtaSubtext")}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://flbusinesssearch.com/alerts"
                className="rounded-full bg-[#E8824A] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#D4713A]"
              >
                {tBusiness("getLeadAlerts")}
              </a>
              <Link
                href={similarSearchPath(business.county_slug)}
                className="rounded-full border border-[#E8824A] px-5 py-2.5 text-sm font-medium text-[#E8824A] transition-colors hover:bg-[#FDF0E8]"
              >
                {tBusiness("seeSimilar")}
              </Link>
            </div>
          </section>
        )}

        {similarBusinesses && similarBusinesses.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 font-display text-xl text-[#1A1A1A]">
              {tBusiness("similarBusinesses", { county: business.county || "Florida" })}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {similarBusinesses.map((biz) => (
                <Link
                  key={biz.slug}
                  href={profilePath(biz.slug)}
                  className="rounded-xl border border-[#E8E4DC] bg-white p-4 transition-colors hover:border-[#E8824A]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{biz.name}</p>
                      <p className="mt-1 text-xs text-[#9B9B9B]">
                        {biz.entity_type}
                        {biz.filing_date &&
                          ` · ${new Date(biz.filing_date).toLocaleDateString(dateLocale, {
                            month: "short",
                            year: "numeric",
                          })}`}
                      </p>
                    </div>
                    {biz.hot_lead && (
                      <span className="flex-shrink-0 rounded-full bg-[#FDF0E8] px-2 py-0.5 text-xs text-[#E8824A]">
                        🔥 Hot
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="border-t border-[#E8E4DC] pt-6 text-xs text-[#9B9B9B]">
          <p>
            <a
              href="https://dos.fl.gov/sunbiz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9B9B9B] transition-colors hover:text-[#1A1A1A] hover:underline"
            >
              {tBusiness("dataSource")}
            </a>
            {lastVerified ? ` · ${tBusiness("lastVerified", { date: lastVerified })}` : ""}
          </p>
          <p className="mt-1">
            {t("notAffiliatedFull")}
          </p>
        </div>
      </main>

      <footer className="mt-16 bg-[#1A1A1A] px-6 py-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs text-[#6B6B6B]">{tFooter("footerCopy")}</p>
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
            "@type": schemaType,
            name: business.name,
            address: {
              "@type": "PostalAddress",
              addressLocality: business.county,
              addressRegion: "FL",
              addressCountry: "US",
            },
            ...(business.website_url ? { url: business.website_url } : {}),
            ...(business.owner_name ? { founder: business.owner_name } : {}),
            description: `${
              business.entity_type || "Business"
            } registered in ${business.county || "Florida"}, Florida. Filing date: ${
              filingDate || "N/A"
            }. Status: ${business.status || "N/A"}.`,
            dateModified: new Date().toISOString().split("T")[0],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Florida Businesses",
                item: "https://flbusinesssearch.com",
              },
              ...(business.county
                ? [
                    {
                      "@type": "ListItem",
                      position: 2,
                      name: `${business.county} County`,
                      item: `https://flbusinesssearch.com/county/${
                        business.county_slug || business.county?.toLowerCase().replace(/\s+/g, "-")
                      }`,
                    },
                  ]
                : []),
              {
                "@type": "ListItem",
                position: business.county ? 3 : 2,
                name: business.name,
                item: `https://flbusinesssearch.com${currentProfilePath}`,
              },
            ],
          }),
        }}
      />
    </div>
  );
}
