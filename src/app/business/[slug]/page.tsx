import type { Metadata } from "next";

import BusinessProfilePage, {
  dynamicParams,
  generateMetadata as generateLocalizedMetadata,
  revalidate,
} from "@/app/[locale]/business/[slug]/page";

export { dynamicParams, revalidate };

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  return generateLocalizedMetadata({
    params: { slug: params.slug, locale: "en" },
  });
}

export default function BusinessProfilePageEn({
  params,
}: {
  params: { slug: string };
}) {
  return <BusinessProfilePage params={{ slug: params.slug, locale: "en" }} />;
}
