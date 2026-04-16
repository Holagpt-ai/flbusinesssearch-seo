import { redirect } from "next/navigation";

export default function LocaleHomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  // The main homepage lives on the React app
  // This Next.js app handles SEO pages only
  // Redirect to main site
  redirect(`https://flbusinesssearch.com${locale === "es" ? "/es" : ""}`);
}
