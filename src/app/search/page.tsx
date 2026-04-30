import type { Metadata } from "next";
import SearchPageLocale, {
  generateMetadata as generateLocalizedMetadata,
} from "@/app/[locale]/search/page";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: {
    q?: string;
    county?: string;
    category?: string;
    status?: string;
    sort?: string;
    page?: string;
  };
}): Promise<Metadata> {
  return generateLocalizedMetadata({
    params: { locale: "en" },
    searchParams,
  });
}

export default async function SearchPageEn({
  searchParams,
}: {
  searchParams: {
    q?: string;
    county?: string;
    category?: string;
    status?: string;
    sort?: string;
    page?: string;
  };
}) {
  return <SearchPageLocale params={{ locale: "en" }} searchParams={searchParams} />;
}
