// Images de la page d'accueil : le même salon avant (meubles relevés) et après (meubles Maison Corleone),
// en vue de dessus et sous l'angle de la photo. Rendu par le moteur de l'application.
import { creerEditeur } from '../../moteur/editeur.js';
import catalogue from '../../data/catalogue.json';

const modele = {
  dims: { largeur: 4.8, profondeur: 5.6, hauteur: 2.7 },
  murs: {
    fond: { couleur: '#EFE9DF', ouvertures: [{ type: 'fenetre', position: .6, largeur: 2.2, hauteur: 1.7, allege: .6 }] },
    gauche: { couleur: '#E9E1D4', ouvertures: [{ type: 'fenetre', position: -.9, largeur: 1.2, hauteur: 1.5, allege: .8 }] },
    droite: { couleur: '#EFE9DF', ouvertures: [] },
    entree: { couleur: '#EFE9DF', ouvertures: [{ type: 'porte', position: 1.6, largeur: .9, hauteur: 2.1, allege: 0 }] }
  },
  sol: { matiere: 'parquet', couleur: '#C29A6B' },
  plafond: { couleur: '#F7F5F0' },
  // appareil photo dans l'angle de l'entrée, côté droit, qui regarde vers le fond gauche
  vue: { x: 1.7, z: 2.6, y: 1.45, cx: -1.1, cy: 1.0, cz: -2.8, fov: 62 }
};
const base = [
  { id: 'plante', origine: 'existant', p: { nom: 'Plante', fam: 'plante', dim: [.6, .6, 1.5], cols: ['#4F6B3A'] }, x: 1.95, z: -2.35, rot: 0 }
];
const avant = [
  ...base,
  { id: 'tapis0', origine: 'existant', p: { nom: 'Tapis', fam: 'tapis', dim: [2.2, 1.6, .01], cols: ['#B9B3A8'] }, x: -.5, z: .1, rot: Math.PI / 2 },
  { id: 'canape0', origine: 'existant', p: { nom: 'Canapé gris', fam: 'canape', dim: [2.1, .92, .82], cols: ['#8C8C8A'], mat: 'tissu' }, x: -1.9, z: .1, rot: Math.PI / 2 },
  { id: 'table0', origine: 'existant', p: { nom: 'Table basse', fam: 'table', st: 'basse', dim: [1.0, .55, .42], cols: ['#6E5A48'], mat: 'bois' }, x: -.7, z: .1, rot: Math.PI / 2 },
  { id: 'meuble0', origine: 'existant', p: { nom: 'Meuble TV', fam: 'meuble', dim: [1.6, .42, .5], cols: ['#F2F0EA'], mat: 'bois' }, x: 2.18, z: .1, rot: -Math.PI / 2 },
  { id: 'tv0', origine: 'existant', p: { nom: 'TV', fam: 'tv', dim: [1.25, .06, .72], cols: ['#111111'] }, x: 2.2, z: .1, rot: -Math.PI / 2 },
  { id: 'chaise0', origine: 'existant', p: { nom: 'Chaise', fam: 'chaise', dim: [.46, .5, .88], cols: ['#3E3A35'], mat: 'bois' }, x: .9, z: -1.4, rot: -2.4 }
];
const apres = [
  ...base,
  { id: 'tapis', origine: 'existant', p: { nom: 'Tapis', fam: 'tapis', dim: [2.6, 1.9, .01], cols: ['#D9CDB9'] }, x: -.35, z: .1, rot: Math.PI / 2 },
  { id: 'canape', origine: 'catalogue', sku: 'mcs-01', x: -1.88, z: .1, rot: Math.PI / 2 },
  { id: 'table', origine: 'existant', p: { nom: 'Table basse', fam: 'table', st: 'basse', dim: [1.1, .6, .38], cols: ['#8A6446'], mat: 'bois' }, x: -.55, z: .1, rot: Math.PI / 2 },
  { id: 'fauteuil', origine: 'catalogue', sku: 'terracotta', x: .75, z: -.75, rot: -2.2 },
  { id: 'fauteuil2', origine: 'catalogue', sku: 'abbraccio', x: .8, z: .95, rot: -1.1 },
  { id: 'susp', origine: 'catalogue', sku: 'sus-lnb-34', x: -.5, z: .1, rot: 0 },
  { id: 'lampadaire', origine: 'catalogue', sku: 'fpf-lamp-7705', x: -1.95, z: -2.3, rot: 0 },
  { id: 'buffet', origine: 'catalogue', sku: 'ha-650', x: 2.18, z: .1, rot: -Math.PI / 2 },
  { id: 'applique', origine: 'catalogue', sku: 'wom-wall-2414', x: 2.4, z: -1.2, rot: -Math.PI / 2, y: 1.6, mur: 'droite' }
];
const ed = creerEditeur(document.getElementById('c'), { produits: catalogue.produits, dprMax: 2, fond: '#EEEBE5' });
ed.charger(modele, apres);
window.__ed = ed;
window.__poser = nom => ed.majItems(nom === 'avant' ? avant : apres);
window.__pret = true;
