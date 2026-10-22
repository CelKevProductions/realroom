'use client';
// Scène 3D de l'accueil : un petit immeuble de quatre appartements (chiens, chats, tortues, lapins)
// s'assemble, puis l'histoire suit les chapitres de la méthode : la façade s'ouvre sur des pièces vides,
// les meubles arrivent, Shuffle les change de place sous leurs pattes, puis on visite chaque appartement
// et tout le monde dit merci. On joue avec les animaux : clic, caresse, on les attrape, on les secoue.
// Événements (document) : écoute rr:piece-intro (sinon l'intro part 3 s après le montage) et
// rr:piece-chapitre (detail.chapitre 0 à 3, detail.visite : l'étape d'Aménager ou de Visiter) et
// rr:piece-shuffle (on reclique sur Shuffle : une autre idée) ; émet
// rr:piece-prete à la première image. three.js n'est chargé qu'après l'affichage (piece3d/scene.js).
// Sans WebGL : une image fixe ; mouvement réduit : l'état de chaque chapitre, immobile.
import { useEffect, useRef, useState } from 'react';

const IMAGE = '/images/chambre-maquette-1200.jpg';
const ATTENTE_INTRO = 3000;   // ms
const DESCRIPTION = {
  fr: 'Un petit immeuble pastel sur une île, posé étage par étage. Sa façade s’ouvre comme une maison de poupée : quatre appartements vides, où des chiens, des chats, des tortues et des lapins vivent leur vie. Le plan de chaque pièce se trace, puis les meubles arrivent, et Shuffle les change de place sous leurs pattes : un lapin tombe à la renverse, les tortues rentrent dans leur carapace, le fauteuil boude. Ensuite, chacun profite de son appartement : les chiens jouent à la console, les chats aux échecs, les tortues lisent en buvant du thé, les lapins regardent une série sous un plaid, dans le noir. À la fin, tout le monde est heureux. On peut cliquer sur un animal, le caresser, l’attraper et le secouer : tout bouge dans la pièce.',
  en: 'A small pastel building on an island, assembled floor by floor. Its front opens like a doll’s house: four empty flats where dogs, cats, turtles and bunnies live their lives. The plan of each room draws itself, then the furniture arrives, and Shuffle moves it under their paws: a bunny falls over, the turtles hide in their shells, the armchair sulks. Then everyone enjoys their home: the dogs play video games, the cats play chess, the turtles read with a cup of tea, the bunnies watch a show under a blanket, in the dark. In the end, everyone is happy. You can click an animal, pet it, grab it and shake it: everything in the room moves.'
};
// ce que disent les animaux (bulle) : une phrase par visite, merci, Shuffle, et selon l'espèce : au clic,
// quand on les attrape, quand on les secoue, à l'atterrissage, quand on les caresse
const TEXTES = {
  fr: {
    merci: 'Merci ! On adore nos nouveaux apparts.',
    coucou: 'Attrape-moi !',
    shuffle: 'Shuffle !',
    visites: ['Ouaf ! Encore une partie ?', 'Échec et… miaou.', 'Chut, c’est le meilleur chapitre.', 'Pas de spoiler, c’est la fin !'],
    clic: {
      chien: ['Ouaf ! Tu joues avec nous ?', 'Lance la balle !', 'Encore une partie ?'],
      chat: ['Miaou ?', 'Échec et miaou.', 'Chut, je réfléchis.'],
      tortue: ['Doucement…', 'Chut, je lis.', 'Un peu de thé ?'],
      lapin: ['Pas de spoiler !', 'Tu as une carotte ?', 'Viens sous le plaid !']
    },
    saisie: { chien: 'Wouhou, plus haut !', chat: 'Repose-moi tout de suite.', tortue: 'Oh là, doucement…', lapin: 'Wiii !' },
    secoue: { chien: 'Ça tourne, ça tourne…', chat: 'Mes moustaches !', tortue: 'Ma carapace…', lapin: 'Je vois des carottes partout…' },
    atterrit: { chien: 'Encore !', chat: 'Je l’ai fait exprès.', tortue: 'Ouf.', lapin: 'Encore, encore !' },
    caresse: { chien: 'Encore des caresses !', chat: 'Rrrrr…', tortue: 'Ça chatouille.', lapin: 'Hihi !' }
  },
  en: {
    merci: 'Thank you! We love our new homes.',
    coucou: 'Grab me!',
    shuffle: 'Shuffle!',
    visites: ['Woof! One more game?', 'Check… meowte.', 'Shh, best chapter ever.', 'No spoilers, it’s the end!'],
    clic: {
      chien: ['Woof! Want to play?', 'Throw the ball!', 'One more game?'],
      chat: ['Meow?', 'Checkmeowte.', 'Shh, I’m thinking.'],
      tortue: ['Slowly…', 'Shh, I’m reading.', 'Some tea?'],
      lapin: ['No spoilers!', 'Got a carrot?', 'Come under the blanket!']
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
