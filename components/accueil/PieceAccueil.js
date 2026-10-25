'use client';
// Scène 3D de l'accueil : une tour en maquette, un appartement par étage, qu'on remonte en faisant
// défiler la page ; chaque étage est une étape de RealRoom : le relevé au téléphone, les meubles qui
// arrivent, Shuffle, le rendu photo IA ; à la fin, toute la tour, et tout le monde dit merci. On joue avec
// les habitants : clic, caresse, on les attrape, on les secoue.
// Événements (document) : écoute rr:piece-intro (sinon l'intro part 3 s après le montage) et
// rr:piece-chapitre (detail.chapitre 0 à 4, detail.visite : au 4, 1 = toute la tour) et
// rr:piece-shuffle (on reclique sur Shuffle : une autre idée) ; émet
// rr:piece-prete à la première image. three.js n'est chargé qu'après l'affichage (piece3d/scene.js).
// Sans WebGL : une image fixe ; mouvement réduit : l'état de chaque chapitre, immobile.
import { useEffect, useRef, useState } from 'react';

const IMAGE = '/images/chambre-maquette-1200.jpg';
const ATTENTE_INTRO = 3000;   // ms
const DESCRIPTION = {
  fr: 'Une tour en maquette, posée étage par étage, qu’on remonte en faisant défiler la page. Au 1er étage, deux lapins scannent une pièce vide avec leur téléphone pendant que son plan se trace au sol. Au 2e, les meubles d’une première proposition arrivent chez deux chiens. Au 3e, Shuffle change les meubles de place chez deux chats, et le fauteuil boude. Au 4e, une lame de lumière traverse le salon de deux tortues et la maquette devient une photo réaliste. Pour finir, on voit toute la tour et tout le monde salue. On peut cliquer sur un habitant, le caresser, l’attraper et le secouer.',
  en: 'A model tower, assembled floor by floor, that you climb as you scroll. On the 1st floor, two bunnies scan an empty room with their phones while its plan draws itself on the floor. On the 2nd, the furniture of a first proposal arrives at two dogs’ place. On the 3rd, Shuffle moves the furniture around two cats, and the armchair sulks. On the 4th, a blade of light sweeps through two turtles’ living room and the model turns into a realistic photo. Finally, you see the whole tower and everyone waves. You can click a resident, pet it, grab it and shake it.'
};
// ce que disent les habitants (bulle) : une phrase par étage (relevé, meubles, rendu), merci, Shuffle, et
// selon l'espèce : au clic, quand on les attrape, quand on les secoue, à l'atterrissage, quand on les caresse
const TEXTES = {
  fr: {
    merci: 'Merci ! On s’y voit déjà.',
    coucou: 'Attrape-moi !',
    shuffle: 'Shuffle !',
    etapes: ['On relève la pièce…', 'Ça, c’est une proposition !', '', 'Clic ! Voilà la photo.'],
    clic: {
      chien: ['Ouaf ! Tu aimes le canapé ?', 'Ouaf, ouaf !', 'On a tout gardé.'],
      chat: ['Miaou ?', 'Encore un Shuffle ?', 'Chut, je réfléchis.'],
      tortue: ['Doucement…', 'Chut, je lis.', 'Souris, c’est pour la photo.'],
      lapin: ['Trois mètres quarante !', 'Ne bouge pas, je scanne.', 'Tu as une carotte ?']
    },
    saisie: { chien: 'Wouhou, plus haut !', chat: 'Repose-moi tout de suite.', tortue: 'Oh là, doucement…', lapin: 'Wiii !' },
    secoue: { chien: 'Ça tourne, ça tourne…', chat: 'Mes moustaches !', tortue: 'Ma carapace…', lapin: 'Je vois des carottes partout…' },
    atterrit: { chien: 'Encore !', chat: 'Je l’ai fait exprès.', tortue: 'Ouf.', lapin: 'Encore, encore !' },
    caresse: { chien: 'Encore des caresses !', chat: 'Rrrrr…', tortue: 'Ça chatouille.', lapin: 'Hihi !' }
  },
  en: {
    merci: 'Thank you! We can see ourselves there already.',
    coucou: 'Grab me!',
    shuffle: 'Shuffle!',
    etapes: ['Scanning the room…', 'Now that’s a proposal!', '', 'Click! Here’s the photo.'],
    clic: {
      chien: ['Woof! Like the sofa?', 'Woof woof!', 'We kept everything.'],
      chat: ['Meow?', 'Another Shuffle?', 'Shh, I’m thinking.'],
      tortue: ['Slowly…', 'Shh, I’m reading.', 'Smile, it’s for the photo.'],
      lapin: ['Eleven feet two!', 'Hold still, I’m scanning.', 'Got a carrot?']
    },
    saisie: { chien: 'Woohoo, higher!', chat: 'Put me down right now.', tortue: 'Whoa, gently…', lapin: 'Wheee!' },
    secoue: { chien: 'Everything’s spinning…', chat: 'My whiskers!', tortue: 'My shell…', lapin: 'I see carrots everywhere…' },
    atterrit: { chien: 'Again!', chat: 'I meant to do that.', tortue: 'Phew.', lapin: 'Again, again!' },
    caresse: { chien: 'More pets!', chat: 'Purrrr…', tortue: 'That tickles.', lapin: 'Hehe!' }
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
      if (!Number.isInteger(n) || n < 0 || n > 4) return;
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
