'use client';
// Scène 3D de l'accueil : un petit immeuble de quatre appartements (deux petits bonhommes dans chacun)
// s'assemble, puis l'histoire suit les chapitres de la méthode : la façade s'ouvre sur des pièces vides,
// les meubles arrivent, Shuffle les change de place sous leurs pieds, puis on visite chaque appartement
// et tout le monde dit merci. On joue avec les habitants : clic, caresse, on les attrape, on les secoue.
// Événements (document) : écoute rr:piece-intro (sinon l'intro part 3 s après le montage) et
// rr:piece-chapitre (detail.chapitre 0 à 3, detail.visite : l'étape d'Aménager ou de Visiter) et
// rr:piece-shuffle (on reclique sur Shuffle : une autre idée) ; émet
// rr:piece-prete à la première image. three.js n'est chargé qu'après l'affichage (piece3d/scene.js).
// Sans WebGL : une image fixe ; mouvement réduit : l'état de chaque chapitre, immobile.
import { useEffect, useRef, useState } from 'react';

const IMAGE = '/images/chambre-maquette-1200.jpg';
const ATTENTE_INTRO = 3000;   // ms
const DESCRIPTION = {
  fr: 'Un petit immeuble sur une île, posé étage par étage. Sa façade s’ouvre comme une maison de poupée : quatre appartements vides, que de petits habitants relèvent avec leur téléphone pendant que le plan de chaque pièce se trace. Puis les meubles arrivent, et Shuffle les change de place sous leurs pieds : l’un tombe à la renverse, les autres sursautent, le fauteuil boude. Ensuite, chacun profite de son appartement : console, partie d’échecs, lecture avec un thé, série sous un plaid dans le noir. À la fin, tout le monde est content. On peut cliquer sur un habitant, l’attraper et le secouer : tout bouge dans la pièce.',
  en: 'A small building on an island, assembled floor by floor. Its front opens like a doll’s house: four empty flats that little residents scan with their phones while the plan of each room draws itself. Then the furniture arrives, and Shuffle moves it under their feet: one falls over, the others jump, the armchair sulks. Then everyone enjoys their home: video games, chess, reading with a cup of tea, a show under a blanket in the dark. In the end, everyone is happy. You can click a resident, grab it and shake it: everything in the room moves.'
};
// ce que disent les habitants (bulle) : une phrase par visite, merci, Shuffle, et selon l'espèce : au clic,
// quand on les attrape, quand on les secoue, à l'atterrissage, quand on les caresse
const TEXTES = {
  fr: {
    merci: 'Merci ! On adore nos nouveaux apparts.',
    coucou: 'Attrape-moi !',
    shuffle: 'Shuffle !',
    visites: ['Encore une partie ?', 'Échec et mat.', 'Chut, c’est le meilleur chapitre.', 'Pas de spoiler, c’est la fin !'],
    clic: { bonhomme: ['Bonjour !', 'On aménage ?', 'Encore une partie ?', 'Chut, je lis.', 'Pas de spoiler !', 'Joli canapé, non ?'] },
    saisie: { bonhomme: 'Oh, plus haut !' },
    secoue: { bonhomme: 'Ça tourne…' },
    atterrit: { bonhomme: 'Encore !' },
    caresse: { bonhomme: 'Hé, ça chatouille.' }
  },
  en: {
    merci: 'Thank you! We love our new homes.',
    coucou: 'Grab me!',
    shuffle: 'Shuffle!',
    visites: ['One more game?', 'Checkmate.', 'Shh, best chapter ever.', 'No spoilers, it’s the end!'],
    clic: { bonhomme: ['Hello!', 'Shall we decorate?', 'One more game?', 'Shh, I’m reading.', 'No spoilers!', 'Nice sofa, right?'] },
    saisie: { bonhomme: 'Oh, higher!' },
    secoue: { bonhomme: 'Everything’s spinning…' },
    atterrit: { bonhomme: 'Again!' },
    caresse: { bonhomme: 'Hey, that tickles.' }
  }
};
const STYLES = {
  boite: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  toile: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'auto' },
  cache: { display: 'none' },
  image: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  masque: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }
};

// three.js demande WebGL 2 : on le vérifie sans charger la bibliothèque (aussi pour le pied de page)
export function webgl2() {
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
    let vivant = true, piece = null, introVoulue = false, chapitre = 0, visite = 0;
    el.dataset.etat = 'chargement';
    // les événements peuvent arriver avant three.js : on les retient
    const lancer = () => { introVoulue = true; piece?.intro(); };
    const surChapitre = e => {
      const n = Number(e?.detail?.chapitre);
      if (!Number.isInteger(n) || n < 0 || n > 3) return;
      const k = Number(e.detail.visite);
      chapitre = n;
      visite = Number.isInteger(k) && k >= 0 ? k : 0;
      piece?.chapitre(n, visite);
    };
    const panne = () => {
      if (!vivant) return;
      piece?.detruire();
      piece = null;
      el.dataset.etat = 'secours';
      setSecours(true);
    };
    const surShuffle = () => piece?.encore();
    document.addEventListener('rr:piece-intro', lancer);
    document.addEventListener('rr:piece-chapitre', surChapitre);
    document.addEventListener('rr:piece-shuffle', surShuffle);
    const minuteur = setTimeout(lancer, ATTENTE_INTRO);

    if (!webgl2()) panne();
    else {
      import('./piece3d/scene.js').then(({ creerPiece }) => {
        if (!vivant) return;
        piece = creerPiece({
          toile: toile.current, boite: el, bulle: bulle.current, textes: TEXTES[lang] || TEXTES.fr, chapitre, visite,
          surPrete: () => { el.dataset.etat = 'prete'; annoncer({ secours: false }); },
          surPanne: panne
        });
        // déjà plus bas dans la page : l'intro s'achève vite et la pièce rejoint le chapitre
        if (chapitre !== 0) piece.chapitre(chapitre, visite);
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
      document.removeEventListener('rr:piece-shuffle', surShuffle);
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
      {!secours && <p ref={bulle} className="acc-bulle" aria-hidden="true"><span>{(TEXTES[lang] || TEXTES.fr).merci}</span></p>}
      <noscript><img src={IMAGE} alt="" aria-hidden="true" style={STYLES.image} /></noscript>
      <p className="visuel-masque" style={STYLES.masque}>{DESCRIPTION[lang] || DESCRIPTION.fr}</p>
    </div>
  );
}
