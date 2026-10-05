// Cas annoté à la main d'après le problème signalé : fenêtre/radiateur au fond,
// lit à droite, commode/TV à gauche, coiffeuse à droite au premier plan.
// Les dimensions sont FICTIVES pour les tests, pas des mesures extraites de la photo.
const objet = (nom, famille, dim, x, p, oriente_vers = 'entree', contre_mur = null, hauteur_pose = null) => ({
  nom, famille, largeur: dim[0], profondeur: dim[1], hauteur: dim[2], x, p, oriente_vers,
  contre_mur, hauteur_pose, confiance: .8, couleurs: ['#ECE6DF'], style: '', matiere: 'bois'
});
export const chambreFenetre = {
  dimensions: { largeur: 4, profondeur: 5, hauteur: 2.55, estimees: true },
  murs: {
    fond: { observe: true, couleur: '#D5BEB3', ouvertures: [{ type: 'fenetre', position: 0, largeur: 2, hauteur: 1.35, allege: .85, confiance: .9 }] },
    gauche: { observe: true, ouvertures: [] }, droite: { observe: true, ouvertures: [] },
    entree: { observe: false, ouvertures: [] }
  },
  meubles: [
    objet('Lit double', 'lit', [1.6, 2.1, 1.1], .93, 3.2, 'gauche', 'droite'),
    objet('Radiateur sous la fenêtre', 'radiateur', [1.8, .12, .65], 0, 4.92, 'entree', 'fond'),
    objet('Commode blanche', 'commode', [1.2, .45, 1.05], -1.75, 3.1, 'droite', 'gauche'),
    objet('TV murale', 'tv-murale', [1.1, .06, .65], -1.98, 3.1, 'droite', 'gauche', 1.65),
    objet('Coiffeuse', 'bureau', [1.1, .45, .75], 1.75, 1, 'gauche', 'droite')
  ],
  remarques: ['Mur derrière la prise de vue non observé ; dimensions à confirmer.']
};
