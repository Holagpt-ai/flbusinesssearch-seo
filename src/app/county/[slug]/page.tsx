import type { Metadata } from 'next';
import CountyPageLocale, {
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams as generateLocalizedStaticParams,
  revalidate,
} from '@/app/[locale]/county/[slug]/page';

export { revalidate };

export async function generateStaticParams() {
  return generateLocalizedStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  return generateLocalizedMetadata({ params: { slug: params.slug, locale: 'en' } });
}

export default function CountyPageEn({ params }: { params: { slug: string } }) {
  return <CountyPageLocale params={{ slug: params.slug, locale: 'en' }} />;
}
