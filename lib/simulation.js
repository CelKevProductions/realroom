// Réponses simulées de Claude (sans clé d'API, et pour la démo sans compte) : une pièce type
// (salon ou chambre) et un aménagement simple tiré des candidats du catalogue. Aucune dépendance
// serveur : ce module sert aussi dans le navigateur.

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
export function simulerAmenagement({ piece, mode, aRemplacer, candidats, langue, demo = false }) {
  const en = langue === 'en';
  const { largeur: L, profondeur: P } = piece.dimensions;
  const prendre = fam => (candidats[fam] || [])[0];
  const meubles = [];
  const canape = prendre('canape'), fauteuil = prendre('fauteuil'), susp = prendre('suspension') || prendre('lustre'), lit = prendre('lit'), baignoire = prendre('baignoire');
  if (lit) meubles.push({ produit: lit.id, x: 0, p: P - lit.dim[1] / 2 - .05, oriente_vers: 'entree', mur: null, hauteur_pose: null, raison: en ? 'Headboard against the far wall.' : 'Tête de lit contre le mur du fond.' });
  else if (canape) meubles.push({ produit: canape.id, x: -L / 2 + canape.dim[1] / 2 + .05, p: P * .5, oriente_vers: 'droite', mur: null, hauteur_pose: null, raison: en ? 'Back to the left wall, facing the TV.' : 'Dos au mur de gauche, face à la télévision.' });
  else if (baignoire) meubles.push({ produit: baignoire.id, x: 0, p: P - baignoire.dim[1] / 2 - .1, oriente_vers: 'entree', mur: null, hauteur_pose: null, raison: en ? 'In front of the window.' : 'Face à la fenêtre.' });
  if (fauteuil) meubles.push({ produit: fauteuil.id, x: L * .15, p: P * .72, oriente_vers: 'gauche', mur: null, hauteur_pose: null, raison: en ? 'Reading corner near the window.' : 'Coin lecture près de la fenêtre.' });
  if (susp) meubles.push({ produit: susp.id, x: lit ? 0 : -L * .15, p: lit ? P * .45 : P * .5, oriente_vers: 'entree', mur: null, hauteur_pose: null, raison: en ? 'Soft light above the seating area.' : 'Lumière douce au-dessus du coin salon.' });
  // quelques pièces d'accompagnement quand le catalogue en propose
  const tableBasse = (candidats.table || []).find(q => q.dim[2] <= .55 && q.dim[0] <= L * .4);
  if (canape && !lit && tableBasse) meubles.push({ produit: tableBasse.id, x: -L / 2 + .05 + canape.dim[1] + .45 + tableBasse.dim[1] / 2, p: P * .5, oriente_vers: 'droite', mur: null, hauteur_pose: null, raison: en ? 'Coffee table within reach of the sofa.' : 'Table basse à portée du canapé.' });
  const lampadaire = prendre('lampadaire');
  if (lampadaire) meubles.push({ produit: lampadaire.id, x: -L / 2 + .3, p: Math.min(P - .3, P * .5 + (canape ? canape.dim[0] / 2 : .6) + .3), oriente_vers: 'entree', mur: null, hauteur_pose: null, raison: en ? 'Reading light in the corner.' : 'Lumière de lecture dans l’angle.' });
  const applique = prendre('applique');
  if (applique) meubles.push({ produit: applique.id, x: -L / 4, p: P, oriente_vers: 'entree', mur: 'fond', hauteur_pose: 1.6, raison: en ? 'Warm wall light on the far wall.' : 'Applique chaleureuse sur le mur du fond.' });
  const existants = (piece.meubles || []).filter(m => m.origine === 'existant');
  const retirer = mode === 'partiel' ? aRemplacer : existants.filter(m => ['canape', 'fauteuil', 'lit', 'table', 'tapis', 'lampe'].includes(m.famille)).map(m => m.id);
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
