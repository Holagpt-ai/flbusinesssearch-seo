import { getRequestConfig } from "next-intl/server";

const locales = ["en", "es"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as (typeof locales)[number])) {
    locale = "en";
  }
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
