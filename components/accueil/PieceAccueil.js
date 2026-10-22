'use client';
// Pièce 3D de l'accueil (« Plan vivant ») : le plan se trace vu de dessus, les murs montent, les meubles
// tombent à leur place, puis la pièce suit les chapitres de la méthode.
// Événements (document) : écoute rr:piece-intro (sinon l'intro part 3 s après le montage) et
// rr:piece-chapitre (detail.chapitre 0 à 3) ; émet rr:piece-prete à la première image.
// three.js n'est chargé qu'après l'affichage (piece3d/scene.js). Sans WebGL : une image fixe ;
// mouvement réduit : la pièce finale, immobile.
import { useEffect, useRef, useState } from 'react';

const IMAGE = '/images/chambre-maquette-1200.jpg';
const ATTENTE_INTRO = 3000;   // ms
const DESCRIPTION = {
  fr: 'Maquette 3D d’un séjour de 5 m sur 4 m : deux murs blancs coupés comme une maquette d’architecte, avec une porte et une fenêtre, un tapis, un canapé, une table basse, un fauteuil orange, un lampadaire, une étagère, une plante et un meuble TV. Le plan se dessine au sol, les murs montent, puis les meubles se posent un à un.',
  en: '3D model of a 5 m by 4 m living room: two white walls cut like an architect’s model, with a door and a window, a rug, a sofa, a coffee table, an orange armchair, a floor lamp, a shelf, a plant and a TV unit. The floor plan draws itself, the walls rise, then the furniture settles in one piece at a time.'
};
const STYLES = {
  boite: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  toile: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' },
  cache: { display: 'none' },
  image: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  masque: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }
};

// three.js demande WebGL 2 : on le vérifie sans charger la bibliothèque
function webgl2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch (_) { return false; }
}
const annoncer = detail => document.dispatchEvent(new CustomEvent('rr:piece-prete', { detail }));

export default function PieceAccueil({ lang = 'fr' }) {
  const boite = useRef(null);
  const toile = useRef(null);
  const [secours, setSecours] = useState(false);

  useEffect(() => {
    const el = boite.current;
    let vivant = true, piece = null, introVoulue = false, chapitre = 0;
    el.dataset.etat = 'chargement';
    // les événements peuvent arriver avant three.js : on les retient
    const lancer = () => { introVoulue = true; piece?.intro(); };
    const surChapitre = e => {
      const n = Number(e?.detail?.chapitre);
      if (!Number.isInteger(n) || n < 0 || n > 3) return;
      chapitre = n;
      piece?.chapitre(n);
    };
    const panne = () => {
      if (!vivant) return;
      piece?.detruire();
      piece = null;
      el.dataset.etat = 'secours';
      setSecours(true);
    };
    document.addEventListener('rr:piece-intro', lancer);
    document.addEventListener('rr:piece-chapitre', surChapitre);
    const minuteur = setTimeout(lancer, ATTENTE_INTRO);

    if (!webgl2()) panne();
    else {
      import('./piece3d/scene.js').then(({ creerPiece }) => {
        if (!vivant) return;
        piece = creerPiece({
          toile: toile.current, boite: el, lang, chapitre,
          surPrete: () => { el.dataset.etat = 'prete'; annoncer({ secours: false }); },
          surPanne: panne
        });
        // déjà plus bas dans la page : l'intro s'achève vite et la pièce rejoint le chapitre
        if (chapitre !== 0) piece.chapitre(chapitre);
        if (introVoulue) piece.intro();
      }).catch(err => {
        if (!vivant) return;
        console.error(err);
        panne();
      });
    }
    return () => {
      vivant = false;
      clearTimeout(minuteur);
      document.removeEventListener('rr:piece-intro', lancer);
      document.removeEventListener('rr:piece-chapitre', surChapitre);
      piece?.detruire();
      piece = null;
    };
  }, [lang]);

  // l'image de secours tient lieu de première image
  useEffect(() => { if (secours) annoncer({ secours: true }); }, [secours]);

  return (
    <div ref={boite} className="piece-accueil" style={STYLES.boite}>
      <canvas ref={toile} aria-hidden="true" style={secours ? STYLES.cache : STYLES.toile} />
      {secours && <img src={IMAGE} alt="" aria-hidden="true" decoding="async" style={STYLES.image} />}
      <noscript><img src={IMAGE} alt="" aria-hidden="true" style={STYLES.image} /></noscript>
      <p className="visuel-masque" style={STYLES.masque}>{DESCRIPTION[lang] || DESCRIPTION.fr}</p>
    </div>
  );
}
