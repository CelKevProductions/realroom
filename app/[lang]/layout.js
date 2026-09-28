import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './globals.css';
import { notFound } from 'next/navigation';
import { LANGUES, MARQUE, estLangue } from '@/lib/config.js';
import { texte } from '@/lib/i18n.js';

export function generateStaticParams() {
  return LANGUES.map(lang => ({ lang }));
}
// (pas de dynamicParams = false ici : il s'appliquerait aussi aux pages [id] de l'application)

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const t = texte(lang);
  return {
    metadataBase: new URL(MARQUE.site),
    title: { default: t.meta.titre, template: '%s · RealRoom' },
    description: t.meta.description,
    keywords: t.meta.motsCles,
    applicationName: MARQUE.nom,
    authors: [{ name: MARQUE.editeur }],
    creator: MARQUE.editeur,
    openGraph: { type: 'website', siteName: MARQUE.nom, locale: t.ogLocale, title: t.meta.titre, description: t.meta.description },
    twitter: { card: 'summary_large_image', title: t.meta.titre, description: t.meta.description },
    formatDetection: { telephone: false }
  };
}

export const viewport = { themeColor: '#F6F3EE', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function Racine({ children, params }) {
  const { lang } = await params;
  if (!estLangue(lang)) notFound();
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
