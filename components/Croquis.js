// Croquis au trait d'une pièce ouverte (le sol et deux murs), pour les vignettes sans photo.
// trace : les lignes se dessinent en boucle (attente de l'analyse), le tapis rouille apparaît ;
// l'animation passe par GSAP (components/mouvement/Attente.js).
import { CroquisAnime } from '@/components/mouvement/Attente.js';

export default function Croquis({ trace = false, className }) {
  if (trace) return <CroquisAnime className={className} />;
  return (
    <svg className={'croquis' + (className ? ' ' + className : '')} viewBox="0 0 64 64" aria-hidden="true">
      <path pathLength="1" d="M32 54 8 42 32 30 56 42Z" />
      <path pathLength="1" d="M8 42V18L32 6v24" />
      <path pathLength="1" d="M32 6l24 12v24" />
    </svg>
  );
}
