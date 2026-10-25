import PageDemo from '@/components/demo/PageDemo.js';
import { texte } from '@/lib/i18n.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  return { title: texte(lang).demo.badge + ' · ' + texte(lang).projets.nouveau };
}

// nouveau projet guidé de la démo ; « ?projet=… » ajoute une pièce à un projet existant
export default async function Page({ params, searchParams }) {
  const { lang } = await params;
  const { projet } = await searchParams;
  return <PageDemo lang={lang} t={texte(lang)} vue="nouveau" id={typeof projet === 'string' ? projet : null} />;
}
