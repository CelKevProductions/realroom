// Réponses simulées de Claude (sans clé d'API, et pour la démo sans compte) : une pièce type
// (salon ou chambre) et un aménagement simple tiré des candidats du catalogue. Aucune dépendance
// serveur : ce module sert aussi dans le navigateur.
import { emplacementDe } from './budget.js';
import { usageDe } from './usages.js';

// demo : textes pour la démo publique (sinon, ceux du mode développement sans clé)
export function simulerAnalyse({ dims, fonction, langue, demo = false }) {
  const L = dims?.largeur || 4.2, P = dims?.profondeur || 5, H = dims?.hauteur || 2.55;
  const en = langue === 'en';
  const chambre = fonction === 'chambre' || fonction === 'chambre_enfant';
  return {
    usage: null,
    analyse: {
      dimensions: { largeur: L, profondeur: P, hauteur: H, estimees: !dims?.largeur },
      murs: {
        fond: { couleur: '#EEE8DF', ouvertures: [{ type: 'fenetre', position: .2, largeur: 1.5, hauteur: 1.4, allege: .9 }] },
        gauche: { couleur: '#EEE8DF', ouvertures: [] },
        droite: { couleur: '#E6DED2', ouvertures: [{ type: 'fenetre', position: P * .6, largeur: 1.1, hauteur: 1.3, allege: .95 }] },
        entree: { couleur: '#EEE8DF', ouvertures: [{ type: 'porte', position: L / 2 - .7, largeur: .9, hauteur: 2.04, allege: 0 }] }
      },
      sol: { matiere: 'parquet', couleur: '#B08D66' },
      plafond: { couleur: '#F5F3EE' },
      style: en ? 'contemporary, simple' : 'contemporain, simple',
      ambiance: en ? 'Bright room, daylight from the far window.' : 'Pièce lumineuse, jour venant de la fenêtre du fond.',
      meubles: chambre ? [
        { nom: en ? 'Double bed' : 'Lit double', famille: 'lit', style: '', largeur: 1.6, profondeur: 2.05, hauteur: .95, couleurs: ['#E9E4DA'], matiere: 'tissu', x: 0, p: P - 1.05, oriente_vers: 'entree', contre_mur: 'fond', hauteur_pose: null, confiance: .8 },
        { nom: en ? 'Bedside table' : 'Table de chevet', famille: 'table', style: 'chevet', largeur: .45, profondeur: .4, hauteur: .5, couleurs: ['#B08A5E'], matiere: 'bois', x: -1.1, p: P - .22, oriente_vers: 'entree', contre_mur: 'fond', hauteur_pose: null, confiance: .7 },
        { nom: en ? 'Bedside table' : 'Table de chevet', famille: 'table', style: 'chevet', largeur: .45, profondeur: .4, hauteur: .5, couleurs: ['#B08A5E'], matiere: 'bois', x: 1.1, p: P - .22, oriente_vers: 'entree', contre_mur: 'fond', hauteur_pose: null, confiance: .7 },
        { nom: en ? 'Bedside lamp' : 'Lampe de chevet', famille: 'lampe', style: '', largeur: .25, profondeur: .25, hauteur: .45, couleurs: ['#F2EEE6'], matiere: 'autre', x: -1.1, p: P - .22, oriente_vers: 'entree', contre_mur: null, hauteur_pose: null, confiance: .6 },
        { nom: en ? 'White wardrobe' : 'Armoire blanche', famille: 'armoire', style: '', largeur: 1.2, profondeur: .6, hauteur: 2.1, couleurs: ['#F2F0EA'], matiere: 'bois', x: L / 2 - .3, p: P * .3, oriente_vers: 'gauche', contre_mur: 'droite', hauteur_pose: null, confiance: .7 },
        { nom: en ? 'Beige rug' : 'Tapis beige', famille: 'tapis', style: '', largeur: 2, profondeur: 1.4, hauteur: .01, couleurs: ['#D8CCB8'], matiere: 'tissu', x: 0, p: P - 2, oriente_vers: 'entree', contre_mur: null, hauteur_pose: null, confiance: .6 }
      ] : [
        { nom: en ? 'Grey 3-seat sofa' : 'Canapé 3 places gris', famille: 'canape', style: '', largeur: 2.1, profondeur: .9, hauteur: .82, couleurs: ['#8C8C8A'], matiere: 'tissu', x: -L / 2 + .46, p: P * .5, oriente_vers: 'droite', contre_mur: 'gauche', hauteur_pose: null, confiance: .8 },
        { nom: en ? 'Oak coffee table' : 'Table basse en chêne', famille: 'table', style: 'basse', largeur: 1, profondeur: .55, hauteur: .4, couleurs: ['#B08A5E'], matiere: 'bois', x: -L / 2 + 1.45, p: P * .5, oriente_vers: 'droite', contre_mur: null, hauteur_pose: null, confiance: .7 },
        { nom: en ? 'Beige rug' : 'Tapis beige', famille: 'tapis', style: '', largeur: 2, profondeur: 1.4, hauteur: .01, couleurs: ['#D8CCB8'], matiere: 'tissu', x: -L / 2 + 1.3, p: P * .5, oriente_vers: 'droite', contre_mur: null, hauteur_pose: null, confiance: .6 },
        { nom: en ? 'Low TV unit' : 'Meuble TV bas', famille: 'meuble', style: '', largeur: 1.6, profondeur: .42, hauteur: .5, couleurs: ['#F2F0EA'], matiere: 'bois', x: L / 2 - .22, p: P * .45, oriente_vers: 'gauche', contre_mur: 'droite', hauteur_pose: null, confiance: .7 },
        { nom: 'TV', famille: 'tv', style: '', largeur: 1.25, profondeur: .06, hauteur: .72, couleurs: ['#111111'], matiere: 'plastique', x: L / 2 - .25, p: P * .45, oriente_vers: 'gauche', contre_mur: 'droite', hauteur_pose: null, confiance: .7 },
        { nom: en ? 'Large plant' : 'Grande plante', famille: 'plante', style: '', largeur: .55, profondeur: .55, hauteur: 1.4, couleurs: ['#4F6B3A'], matiere: 'autre', x: L / 2 - .45, p: P - .45, oriente_vers: 'entree', contre_mur: null, hauteur_pose: null, confiance: .6 }
      ],
      vue_principale: { x: L / 2 - .7, p: .2, hauteur: 1.5, vise_x: -.3, vise_p: P, champ_vertical: 50 },
      remarques: [demo ? (en ? 'Demo: this model is an example. In the app, it is built from your own photos.' : 'Démo : cette maquette est un exemple. Dans l’application, elle est tirée de vos photos.') : (en ? 'Simulated analysis (no API key).' : 'Analyse simulée (pas de clé d’API).')]
    }
  };
}
export function simulerAmenagement({ piece, mode, aRemplacer = [], candidats, envies = '', garder = [], langue, demo = false }) {
  const en = langue === 'en';
  const { largeur: L, profondeur: P } = piece.dimensions;
  // pièces sobres d'abord : la démo ne doit pas tomber sur un motif voyant
  // (et, pour le canapé, un modèle qui tient contre le mur de gauche, devant la table basse gardée)
  const VOYANT = /multicolore|arc-en-ciel|rainbow|fluo|marbre|graffiti|pop art|l[ée]opard|jungle|imprim[ée]|motif|jacquard|graphique|color[ée]|z[èe]br/i;
  const prendre = (fam, tient = () => true) => {
    const l = candidats[fam] || [];
    return l.find(q => !VOYANT.test([q.nom, q.titre].join(' ')) && tient(q)) || l.find(q => !VOYANT.test([q.nom, q.titre].join(' '))) || l[0];
  };
  const meubles = [];
  const ajouter = (p, zone, raison) => {
    if (!p) return;
    const fams = { couchage: ['lit'], chevet: ['table','chevet'], rangement: ['meuble','commode','armoire'], salon: ['canape', 'table'], lecture: ['fauteuil'], eclairage: ['lampe', 'lampadaire', 'suspension', 'lustre', 'applique'], decoration: ['tapis'] };
    if (mode === 'partiel' && !(piece.meubles || []).some(m => aRemplacer.includes(m.id) && (fams[zone] || [p.fam]).includes(m.famille))
      && !(zone === 'eclairage' && /lumiere|lampe|eclairage|light/i.test(envies))) return;
    const alternatives = (candidats[p.fam] || []).filter(q => q.id !== p.id && emplacementDe(q) === emplacementDe(p))
      .sort((a, b) => (a.prix || Infinity) - (b.prix || Infinity)).slice(0, 3).map(q => q.id);
    meubles.push({ produit: p.id, alternatives, zone, raison });
  };
  const canape = prendre('canape', q => q.dim[1] <= 1.1 && q.dim[0] <= P * .62 && q.dim[2] >= .6), fauteuil = prendre('fauteuil'), susp = prendre('suspension') || prendre('lustre'), lit = prendre('lit'), baignoire = prendre('baignoire');
  if (lit) ajouter(lit, 'couchage', en ? 'Main sleeping area.' : 'Zone principale de couchage.');
  else if (canape) ajouter(canape, 'salon', en ? 'Seating around the focal point.' : 'Assise autour du point focal.');
  else if (baignoire) ajouter(baignoire, 'decoration', en ? 'Bathing area.' : 'Zone de bain.');
  if (lit && !lit.chevets) {
    const chevet = (candidats.table || []).find(p => usageDe(p)==='chevet' && p.dim[0]<=.65 && p.dim[1]<=.6 && p.dim[2]<=.75);
    ajouter(chevet, 'chevet', en ? 'Bedside surface within reach.' : 'Une surface de chevet à portée du lit.');
    ajouter(chevet, 'chevet', en ? 'Second bedside surface, if circulation allows.' : 'Un second chevet si les passages le permettent.');
  }
  const rangement = (candidats.meuble || []).find(p => usageDe(p)==='rangement' && p.dim[0]<=L*.5 && p.dim[1]<=.6 && !VOYANT.test([p.nom,p.titre].join(' ')));
  ajouter(rangement, 'rangement', en ? 'Storage matched to the available space.' : 'Un rangement adapté à la place disponible.');
  ajouter(fauteuil, 'lecture', en ? 'A reading seat.' : 'Une assise pour lire.');
  ajouter(susp, 'eclairage', en ? 'Main light for the activity area.' : 'Éclairage principal de la zone de vie.');
  // quelques pièces d'accompagnement quand le catalogue en propose
  const tableBasse = (candidats.table || []).find(q => q.dim[2] <= .55 && q.dim[0] <= L * .4);
  if (canape && !lit && tableBasse) ajouter(tableBasse, 'salon', en ? 'Coffee table within reach of the sofa.' : 'Table basse à portée du canapé.');
  const lampadaire = prendre('lampadaire');
  ajouter(lampadaire, 'eclairage', en ? 'Reading light.' : 'Lumière de lecture.');
  const applique = prendre('applique');
  ajouter(applique, 'eclairage', en ? 'Secondary wall light.' : 'Éclairage mural secondaire.');
  const existants = (piece.meubles || []).filter(m => m.origine === 'existant');
  const retirer = (mode === 'partiel' ? aRemplacer : existants.filter(m => ['canape', 'fauteuil', 'lit', 'table', 'tapis', 'lampe'].includes(m.famille)).map(m => m.id)).filter(id => !garder.includes(id));
  return {
    usage: null,
    proposition: {
      concept: demo
        ? (en ? 'Demo layout: one statement piece per use, chosen from the Maison Corleone catalogue, with room left to breathe.' : 'Aménagement de démonstration : une pièce forte par usage, choisie dans le catalogue Maison Corleone, et de l’air autour.')
        : (en ? 'Simulated layout: warm tones, one statement piece per function, room left to breathe.' : 'Aménagement simulé : tons chauds, une pièce forte par usage, de l’air autour.'),
      retirer,
      meubles,
      conseils: [demo
        ? (en ? 'In the demo, the layout follows a simple pattern. In the app, Claude designs it from your photos, your wishes and your budget.' : 'Dans la démo, la proposition suit un modèle simple. Dans l’application, Claude la compose d’après vos photos, vos envies et votre budget.')
        : (en ? 'Simulation mode: add an Anthropic key for real suggestions.' : 'Mode simulation : ajoutez une clé Anthropic pour de vraies propositions.')]
    }
  };
}
