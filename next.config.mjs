import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ttbdzjrzifansqbzxlux.supabase.co",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
