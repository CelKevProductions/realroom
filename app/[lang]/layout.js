import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
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

export const viewport = { themeColor: '#EDEAE4', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// avant le premier affichage : les animations d'entrée joueront (JavaScript actif, mouvement non réduit).
// Sans ce marqueur, rien n'est masqué en attendant GSAP.
const AMORCE = `(function(){try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.setAttribute('data-mvt','')}catch(_){}})();`;

export default async function Racine({ children, params }) {
  const { lang } = await params;
  if (!estLangue(lang)) notFound();
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: AMORCE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
