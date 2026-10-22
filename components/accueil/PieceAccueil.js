'use client';
// Scène 3D de l'accueil : un petit immeuble s'assemble, puis l'histoire suit les chapitres de la méthode
// (l'étage s'ouvre, deux lapins entrent, les meubles changent sous leurs pieds, ils disent merci).
// Événements (document) : écoute rr:piece-intro (sinon l'intro part 3 s après le montage) et
// rr:piece-chapitre (detail.chapitre 0 à 3) ; émet rr:piece-prete à la première image.
// three.js n'est chargé qu'après l'affichage (piece3d/scene.js). Sans WebGL : une image fixe ;
// mouvement réduit : la pièce finale, immobile.
import { useEffect, useRef, useState } from 'react';

const IMAGE = '/images/chambre-maquette-1200.jpg';
const ATTENTE_INTRO = 3000;   // ms
const DESCRIPTION = {
  fr: 'Un petit immeuble pastel de trois étages sur une île, posé étage par étage. La caméra monte jusqu’au deuxième, qui s’ouvre comme une maison de poupée : on y voit un séjour de 5 m sur 4 m et son plan qui se trace. Deux lapins blancs entrent. Les meubles changent de place sous leurs pieds : l’un tombe à la renverse, le fauteuil boude. Puis ils adorent leur nouvel appartement : l’un regarde la télé depuis le canapé, l’autre arrose la plante, et tous deux disent merci.',
  en: 'A small three-storey pastel building on an island, assembled floor by floor. The camera climbs to the second floor, which opens like a doll’s house: a 5 m by 4 m living room whose plan draws itself. Two white bunnies walk in. The furniture moves under their feet: one falls over, the armchair sulks. Then they love their new home: one watches TV from the sofa, the other waters the plant, and both say thank you.'
};
const MERCI = { fr: 'Merci ! On adore notre nouvel appart.', en: 'Thank you! We love our new home.' };
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
  const bulle = useRef(null);
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
          toile: toile.current, boite: el, bulle: bulle.current, lang, chapitre,
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
      {!secours && <p ref={bulle} className="acc-bulle" aria-hidden="true"><span>{MERCI[lang] || MERCI.fr}</span></p>}
      <noscript><img src={IMAGE} alt="" aria-hidden="true" style={STYLES.image} /></noscript>
      <p className="visuel-masque" style={STYLES.masque}>{DESCRIPTION[lang] || DESCRIPTION.fr}</p>
    </div>
  );
}
