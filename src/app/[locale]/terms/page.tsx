import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

const SECTION_KEYS = [
  "eligibility",
  "license",
  "publicData",
  "noLegalAdvice",
  "thirdParty",
  "acceptableUse",
  "disclaimer",
  "limitation",
  "indemnity",
  "governingLaw",
  "changes",
  "contact",
] as const;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "terms" });
  const isEs = params.locale === "es";
  const path = isEs ? "/es/terms" : "/terms";
  const canonical = `https://flbusinesssearch.com${path}`;
  const title = t("title");
  const description = t("description");

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
        en: "https://flbusinesssearch.com/terms",
        es: "https://flbusinesssearch.com/es/terms",
      },
    },
  };
}

export default async function TermsPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "terms" });
  const tNav = await getTranslations({ locale: params.locale, namespace: "nav" });
  const isEs = params.locale === "es";
  const searchPath = isEs ? "/es/buscar" : "/search";
  const sections = t.raw("sections") as Record<
    (typeof SECTION_KEYS)[number],
    { title: string; body: string }
  >;

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
            {tNav("search")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <nav className="mb-6 flex items-center gap-2 text-xs text-[#9B9B9B]">
          <Link href="/" className="hover:text-[#1A1A1A]">
            {t("breadcrumbHome")}
          </Link>
          <span>›</span>
          <span className="text-[#1A1A1A]">{t("heading")}</span>
        </nav>

        <h1 className="font-display text-[32px] leading-tight text-[#1A1A1A] md:text-[40px]">
          {t("heading")}
        </h1>
        <p className="mt-2 text-sm text-[#9B9B9B]">{t("updated")}</p>
        <p className="mt-6 text-base leading-relaxed text-[#6B6B6B]">{t("intro")}</p>

        <div className="mt-10 space-y-10">
          {SECTION_KEYS.map((key) => (
            <section key={key}>
              <h2 className="font-display text-xl text-[#1A1A1A]">{sections[key].title}</h2>
              <p className="mt-3 text-base leading-relaxed text-[#6B6B6B]">{sections[key].body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
