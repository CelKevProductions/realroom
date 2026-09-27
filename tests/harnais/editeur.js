// Banc d'essai de l'éditeur 3D (hors Next.js) : une pièce type, des meubles relevés et du catalogue.
import { creerEditeur } from '../../moteur/editeur.js';
import catalogue from '../../data/catalogue.json';

const modele = {
  dims: { largeur: 4.2, profondeur: 5.2, hauteur: 2.6 },
  murs: {
    fond: { couleur: '#EEE8DE', ouvertures: [{ type: 'fenetre', position: .3, largeur: 1.6, hauteur: 1.45, allege: .85 }] },
    gauche: { couleur: '#EEE8DE', ouvertures: [{ type: 'fenetre', position: -1.2, largeur: 1.1, hauteur: 1.35, allege: .9 }] },
    droite: { couleur: '#E4DCCF', ouvertures: [] },
    entree: { couleur: '#EEE8DE', ouvertures: [{ type: 'porte', position: 1.4, largeur: .9, hauteur: 2.1, allege: 0 }] }
  },
  sol: { matiere: 'parquet', couleur: '#B58B5E' },
  plafond: { couleur: '#F6F4EF' },
  vue: { x: 1.2, z: 2.35, y: 1.5, cx: -.3, cy: 1.0, cz: -2.6, fov: 58 }
};
const items = [
  { id: 'e1', origine: 'existant', p: { nom: 'Canapé 3 places gris', fam: 'canape', st: '', dim: [2.1, .9, .82], cols: ['#8C8C8A'], mat: 'tissu' }, x: -1.62, z: .2, rot: Math.PI / 2 },
  { id: 'e2', origine: 'existant', p: { nom: 'Table basse chêne', fam: 'table', st: 'basse', dim: [1.0, .6, .4], cols: ['#B08A5E'], mat: 'bois' }, x: -.55, z: .2, rot: Math.PI / 2 },
  { id: 'e3', origine: 'existant', p: { nom: 'Tapis beige', fam: 'tapis', dim: [2.2, 1.6, .01], cols: ['#D8CCB8'] }, x: -.75, z: .2, rot: Math.PI / 2 },
  { id: 'e4', origine: 'existant', p: { nom: 'Plante', fam: 'plante', dim: [.55, .55, 1.4], cols: ['#4F6B3A'] }, x: 1.7, z: -2.2, rot: 0 },
  { id: 'e5', origine: 'existant', garde: false, p: { nom: 'Vieille chaise', fam: 'chaise', dim: [.45, .5, .9], cols: ['#6B5B4B'], mat: 'bois' }, x: 1.5, z: .8, rot: -Math.PI / 2 },
  { id: 'c1', origine: 'catalogue', sku: 'terracotta', x: .9, z: -1.2, rot: -.7 },
  { id: 'c2', origine: 'catalogue', sku: 'sus-lnb-34', x: -.55, z: .2, rot: 0 },
  { id: 'c3', origine: 'catalogue', sku: 'wom-wall-2414', x: 2.1, z: -1.0, rot: -Math.PI / 2, y: 1.6, mur: 'droite' },
  { id: 'c4', origine: 'catalogue', sku: 'et-650', x: 1.86, z: .3, rot: -Math.PI / 2 }
];
const canvas = document.getElementById('c');
const ed = creerEditeur(canvas, {
  produits: catalogue.produits,
  surSelection: id => { window.__sel = id; },
  surDeplacement: d => { window.__depl = d; },
  dprMax: 1
});
ed.charger(modele, items);
window.__editeur = ed;
window.__pret = true;
