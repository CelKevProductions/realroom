import PageDemo from '@/components/demo/PageDemo.js';
import { texte } from '@/lib/i18n.js';
import { CREDITS } from '@/lib/config.js';

// parcours guidé de la démo : mêmes écrans que l'application, données dans le navigateur
export default async function Page({ params }) {
  const { lang, id } = await params;
  return <PageDemo lang={lang} t={texte(lang)} vue="parcours" id={id} approfondissement={{ actif: true, simulation: true, credits: CREDITS.approfondissement }} />;
}
