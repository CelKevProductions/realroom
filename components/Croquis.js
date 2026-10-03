// Croquis au trait d'une pièce ouverte (le sol et deux murs), pour les vignettes sans photo.
// trace : les lignes se dessinent en boucle (attente de l'analyse), le tapis rouille apparaît.
export default function Croquis({ trace = false, className }) {
  return (
    <svg className={(trace ? 'croquis croquis--trace' : 'croquis') + (className ? ' ' + className : '')} viewBox="0 0 64 64" aria-hidden="true">
      <path pathLength="1" d="M32 54 8 42 32 30 56 42Z" />
      <path pathLength="1" d="M8 42V18L32 6v24" />
      <path pathLength="1" d="M32 6l24 12v24" />
      {trace && <path className="croquis__tapis" d="m22 42 10 5 10-5-10-5z" />}
    </svg>
  );
}
