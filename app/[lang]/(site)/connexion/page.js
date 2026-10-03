import { Suspense } from 'react';
import Connexion from '@/components/Connexion.js';
import { texte } from '@/lib/i18n.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  return { title: texte(lang).connexion.titre, robots: { index: false }, alternates: { canonical: `/${lang}/connexion` } };
}

export default async function PageConnexion({ params }) {
  const { lang } = await params;
  const t = texte(lang);
  return (
    <Suspense>
      <Connexion lang={lang} t={t.connexion} liens={{ cgv: `/${lang}/legal/cgv`, confidentialite: `/${lang}/legal/confidentialite` }} />
    </Suspense>
  );
}
