import { redirect } from "next/navigation";

export default function LocaleHomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  // /es proxied from flbusinesssearch.com/es via vercel.json rewrite
  // Redirecting back to flbusinesssearch.com/es causes an infinite loop
  // Send Spanish users to the Spanish search page instead
  // Send English users to the main homepage
  if (locale === "es") {
    redirect("https://flbusinesssearch.com/es/buscar");
  }
  redirect("https://flbusinesssearch.com");
}
