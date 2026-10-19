// Textes de la page d'essai « accueil en 3D » (privée) : le récit de l'intro, puis la présentation
// du logiciel, reprise de la page d'accueil (lib/i18n.js) pour ne rien affirmer de nouveau.
import { texte } from '@/lib/i18n.js';

const FR = {
  marque: 'RealRoom',
  chargement: 'Maquette en cours',
  passer: 'Passer l’intro',
  defiler: 'Faites défiler',
  suite: 'Découvrir RealRoom',
  recits: [
    {
      label: 'Aménagement automatique',
      lignes: ['Votre intérieur,', 'aménagé en un geste.'],
      texte: 'Un plan, quelques mesures : RealRoom monte la pièce, la meuble avec de vrais meubles et vous la montre en 3D.',
      bouton: 'Créer mon premier projet',
      note: '3 rendus offerts · sans carte bancaire'
    },
    {
      label: 'Le plan',
      lignes: ['La décoration', 'devient simple.'],
      texte: 'Tracez votre plan ou partez de vos photos. RealRoom le lit et dresse les murs pour vous.'
    },
    {
      label: 'La maison',
      lignes: ['On ouvre', 'la maison.'],
      texte: 'La maquette se découpe pour montrer l’intérieur, avec vos meubles actuels.'
    },
    {
      label: 'L’aménagement',
      lignes: ['Les meubles', 'se placent seuls.'],
      texte: 'De vrais meubles du catalogue, à leurs vraies dimensions, posés en respectant les passages, les fenêtres et les portes.'
    },
    {
      label: 'Le résultat',
      lignes: ['Voyez-la', 'pour de vrai.'],
      texte: 'Un rendu photo réaliste de votre vraie pièce, puis une visite en 3D. Chaque meuble a son prix et son lien d’achat.'
    },
    {
      label: 'RealRoom',
      lignes: ['À vous', 'de jouer.'],
      texte: 'Photos, maquette 3D et aménagement sont gratuits.',
      bouton: 'Créer mon premier projet',
      note: 'Ou faites défiler pour tout savoir'
    }
  ]
};

const EN = {
  marque: 'RealRoom',
  chargement: 'Building the model',
  passer: 'Skip intro',
  defiler: 'Scroll',
  suite: 'Discover RealRoom',
  recits: [
    {
      label: 'Automatic layout',
      lignes: ['Your home,', 'furnished in one go.'],
      texte: 'A plan and a few measurements: RealRoom builds the room, furnishes it with real furniture and shows it to you in 3D.',
      bouton: 'Create my first project',
      note: '3 free renders · no credit card'
    },
    {
      label: 'The plan',
      lignes: ['Interior design', 'made simple.'],
      texte: 'Draw your plan or start from your photos. RealRoom reads it and puts up the walls for you.'
    },
    {
      label: 'The house',
      lignes: ['We open', 'the house.'],
      texte: 'The model is cut away to show the inside, with your current furniture.'
    },
    {
      label: 'The layout',
      lignes: ['The furniture', 'places itself.'],
      texte: 'Real catalogue pieces, at their real size, placed around walkways, windows and doors.'
    },
    {
      label: 'The result',
      lignes: ['See it', 'for real.'],
      texte: 'A realistic photo of your actual room, then a 3D tour. Every piece has its price and a link to buy it.'
    },
    {
      label: 'RealRoom',
      lignes: ['Your turn', 'to play.'],
      texte: 'Photos, 3D model and layout are free.',
      bouton: 'Create my first project',
      note: 'Or scroll to learn more'
    }
  ]
};

export function textesEssai(lang) {
  const a = texte(lang).accueil;
  return { ...(lang === 'en' ? EN : FR), presentation: { titre: a.titre, intro: a.intro, etapesTitre: a.etapesTitre, etapes: a.etapes, pointsTitre: a.pointsTitre, points: a.points, tarifsTitre: a.tarifsTitre, tarifsTexte: a.tarifsTexte, finTitre: a.finTitre, finTexte: a.finTexte } };
}
