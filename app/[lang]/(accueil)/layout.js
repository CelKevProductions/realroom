// Page d'accueil : son propre habillage (polices, styles, animations), sans l'en-tête des autres pages
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './accueil.css';

// avant le premier affichage : animations possibles (JavaScript actif), écran d'ouverture une fois par session
const AMORCE = `(function(){var d=document.documentElement,e=['js'];try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){e.push('mouvement');if(!sessionStorage.getItem('rr-accueil'))e.push('ouverture');}}catch(_){}d.setAttribute('data-acc',e.join(' '));})();`;

export default function MiseEnPageAccueil({ children }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: AMORCE }} />
      {children}
    </>
  );
}
