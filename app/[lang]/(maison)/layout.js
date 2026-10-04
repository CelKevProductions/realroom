import '@fontsource/oranienbaum/400.css';
import '@fontsource/pinyon-script/400.css';
import '@fontsource-variable/jost/wght.css';
import './maison.css';

// Édition Maison Corleone (« Chez vous ») : polices de la visite privée, couleurs de la boutique.
// Pas d'indexation tant que l'édition vit sur l'adresse de RealRoom.
export const metadata = { robots: { index: false, follow: false } };
export const viewport = { themeColor: '#332817' };

export default function MiseEnPageMaison({ children }) {
  return children;
}
