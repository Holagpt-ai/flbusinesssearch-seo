import type { Metadata } from 'next';
import CategoryPageLocale, {
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams as generateLocalizedStaticParams,
  revalidate,
} from '@/app/[locale]/category/[slug]/page';

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

export default async function CategoryPageEn({ params }: { params: { slug: string } }) {
  return <CategoryPageLocale params={{ slug: params.slug, locale: 'en' }} />;
}
