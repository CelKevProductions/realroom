// Collection procédurale (revêtements, éléments d'architecture, meubles) : un seul point d'entrée.
// Les fichiers voisins viennent tels quels de la collection livrée ; ce module les réunit et
// ramène chaque objet aux conventions de l'éditeur (lib/agencement.js) :
//   au sol      : origine au sol, centrée ;
//   mural       : origine sur le mur, au milieu de la hauteur (familles murales) ;
//   suspendu    : origine au plafond (familles suspendues).
// Un objet posé contre un mur mais d'une famille au sol (meuble haut, vasque, radiateur…) est
// recentré en profondeur et monte de item.y (hauteur de son bas) ; un objet de plafond d'une
// famille au sol (hotte d'îlot, poutres) monte jusqu'au plafond.
import * as THREE from 'three';
import { estMural, estSuspendu } from '../../lib/agencement.js';
import { REVETEMENTS, materiauRevetement, listeRevetements } from './revetements.js';
import * as cuisineBain from './elements-cuisine-bain.js';
import * as architecture from './elements-architecture.js';
import * as assises from './meubles-assises.js';
import * as tablesLits from './meubles-tables-lits.js';
import * as rangements from './meubles-rangements.js';
import * as luminaires from './luminaires.js';
import * as decoration from './decoration-exterieur.js';

export { REVETEMENTS, materiauRevetement, listeRevetements, estMural };

export const GROUPES = [
  ['assises', 'Canapés et assises', assises], ['tables-lits', 'Tables et lits', tablesLits],
  ['rangements', 'Rangements', rangements], ['luminaires', 'Luminaires', luminaires],
  ['decoration', 'Décoration et extérieur', decoration], ['cuisine-bain', 'Cuisine et salle de bain', cuisineBain],
  ['architecture', 'Architecture', architecture]
].map(([id, nom, module]) => ({ id, nom, module, ids: Object.keys(module.ELEMENTS) }));

const MODULE = new Map(GROUPES.flatMap(g => g.ids.map(id => [id, g.module])));
export const ELEMENTS = Object.freeze(Object.fromEntries(GROUPES.flatMap(g => Object.entries(g.module.ELEMENTS))));

// Produit au format de l'éditeur pour un élément de la collection.
export function produitCollection(id, { variante, coloris, dim } = {}) {
  const f = ELEMENTS[id];
  if (!f) return null;
  const v = f.variantes.find(x => x.id === variante) || f.variantes[0];
  const c = v.coloris.find(x => x.id === coloris) || v.coloris[0];
  return { nom: f.nom, fam: f.fam, dim: [...(dim || f.dim)], cols: c.couleurs.slice(), collection: { id, variante: v.id, coloris: c.id } };
}

// p : produit de l'éditeur portant p.collection ; item : sa pose (item.y = hauteur du bas d'un
// objet mural d'une famille au sol) ; hauteur : hauteur sous plafond.
export function construireCollection(p, item = {}, hauteur = 2.5) {
  const { id, variante, coloris } = p.collection, module = MODULE.get(id), f = ELEMENTS[id];
  if (!module) throw Error('Élément inconnu : ' + id);
  const dim = p.dim.map((v, i) => Math.min(f.dimMax[i], Math.max(f.dimMin[i], v)));
  const objet = module.construireElement({ ...f, dim, variante, coloris });
  const g = new THREE.Group();
  g.add(objet);
  const [, d, h] = dim;
  if (f.pose === 'mur' || f.pose === 'lineaire') {
    if (estMural(p.fam)) objet.position.y -= h / 2;
    else { objet.position.z -= d / 2; objet.position.y += Number.isFinite(item.y) ? item.y : 0; }
  } else if (f.pose === 'plafond' && !estSuspendu(p.fam)) objet.position.y += hauteur;
  else if (f.pose === 'sol' && estMural(p.fam)) objet.position.y -= Number.isFinite(item.y) ? item.y : 1.55;   // l'éditeur pose un objet mural à item.y (1,55 m par défaut)
  g.userData.collection = true;
  return g;
}

// Matériau d'un revêtement choisi pour un mur, le sol ou le plafond ({ id, variante, coloris, couleur }).
export function materiauChoisi(r) {
  if (!r?.id || !REVETEMENTS[r.id]) return null;
  const f = REVETEMENTS[r.id];
  return materiauRevetement(r.id, {
    variante: f.variantes.some(v => v.id === r.variante) ? r.variante : undefined,
    coloris: f.coloris.some(c => c.id === r.coloris) ? r.coloris : undefined,
    couleur: f.teintable && /^#[0-9A-Fa-f]{6}$/.test(r.couleur || '') ? r.couleur : undefined
  });
}
