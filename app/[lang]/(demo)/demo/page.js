import PageDemo from '@/components/demo/PageDemo.js';
import { texte } from '@/lib/i18n.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  return { title: texte(lang).demo.badge + ' · ' + texte(lang).projets.titre };
}

export default async function Page({ params }) {
  const { lang } = await params;
  return <PageDemo lang={lang} t={texte(lang)} vue="projets" />;
}
