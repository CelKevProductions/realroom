import './essai.css';

// Essai privé d'un accueil en 3D : pas d'indexation, pas de lien depuis le reste du site.
export const metadata = { robots: { index: false, follow: false } };

export default function MiseEnPageEssai({ children }) {
  return children;
}
