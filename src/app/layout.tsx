import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLBusinessSearch | Florida Business Name Search & LLC Filing",
  description:
    "Search 3.5M+ Florida businesses free. Check name availability, file your LLC, get lead alerts & protect your annual report. Updated daily from Sunbiz.org.",
  metadataBase: new URL("https://flbusinesssearch.com"),
  openGraph: {
    title: "FLBusinessSearch | Florida Business Name Search & LLC Filing",
    description: "Search 3.5M+ Florida businesses free. Updated daily from Sunbiz.org.",
    url: "https://flbusinesssearch.com",
    siteName: "FLBusinessSearch",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@FLBizSearch",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://flbusinesssearch.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
