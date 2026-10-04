import localFont from 'next/font/local';
import './maison.css';

// Édition Maison Corleone (« Chez vous ») : polices de la visite privée, couleurs de la boutique.
// Polices servies par next/font : préchargées dans l'en-tête de la page, donc prêtes quand le
// préchargement anime ses lettres. Les deux polices d'affichage attendent d'être là plutôt que de
// s'afficher d'abord dans une police de secours (display: block) : pas de lettres qui sautent.
const serif = localFont({
  src: '../../../node_modules/@fontsource/oranienbaum/files/oranienbaum-latin-400-normal.woff2',
  weight: '400', display: 'block', variable: '--police-serif', adjustFontFallback: 'Times New Roman'
});
const script = localFont({
  src: '../../../node_modules/@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff2',
  weight: '400', display: 'block', variable: '--police-script', adjustFontFallback: 'Times New Roman'
});
const sans = localFont({
  src: '../../../node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2',
  weight: '100 900', display: 'swap', variable: '--police-sans'
});

// Pas d'indexation tant que l'édition vit sur l'adresse de RealRoom.
export const metadata = { robots: { index: false, follow: false } };
export const viewport = { themeColor: '#332817' };

export default function MiseEnPageMaison({ children }) {
  return <div className={`${serif.variable} ${script.variable} ${sans.variable}`} style={{ display: 'contents' }}>{children}</div>;
}
