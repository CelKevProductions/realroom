// Page d'accueil : son propre habillage (polices, styles, animations), sans l'en-tête des autres pages
import './accueil.css';

// avant le premier affichage : animations possibles (JavaScript actif), préchargement une fois par session.
// __rrAccT : instant du premier affichage, d'où se compte la durée maximale du préchargement (6,5 s).
const AMORCE = `(function(){var d=document.documentElement,e=['js'];try{window.__rrAccT=performance.now();if(!matchMedia('(prefers-reduced-motion: reduce)').matches){e.push('mouvement');if(!sessionStorage.getItem('rr-accueil'))e.push('ouverture');}}catch(_){}d.setAttribute('data-acc',e.join(' '));})();`;

export default function MiseEnPageAccueil({ children }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: AMORCE }} />
      {children}
    </>
  );
}
