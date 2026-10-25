// Atelier de maquettes de l'accueil (« Maison douce ») : volumes arrondis aux arêtes légères, ombres de
// contact dessinées, et le catalogue des meubles en pâte à modeler. Tout est construit en code (aucune
// texture externe) ; les pièces d'un même meuble sont fusionnées : une géométrie par matière, une pour
// les arêtes. Chaque appartement a sa palette (matieresMeubles) : un même meuble change de couleur.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const C = {
  encre: '#26232B', signal: '#F2613F', clair: '#FFFBF6', fonce: '#5E5864', ecran: '#2E2A33',
  beurre: '#FFE49A', menthe: '#9ECDA9', peche: '#FFD3BD', lilas: '#DCD5F6'
};
const Y_OMBRE = .015;

// ---------- matières d'un appartement : canapé (gris), tapis, coussins et bois clair, accents
export function matieresMeubles(p = {}) {
  const decale = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  const plein = color => new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: 0, ...decale });
  return {
    gris: plein(p.canape || '#BFDCC5'), clair: plein(p.clair || C.clair), fonce: plein(p.fonce || C.fonce),
    signal: plein(p.accent || C.signal), tapis: plein(p.tapis || '#FFCFB6'), beurre: plein(p.beurre || C.beurre),
    menthe: plein(p.plante || C.menthe), ecran: plein(C.ecran), bois: plein(p.bois || '#E9C9A6'),
    arete: new THREE.LineBasicMaterial({ color: C.encre, transparent: true, opacity: .12, depthWrite: false })
  };
}

// ---------- géométries
const _m = new THREE.Matrix4();
// sans index ni UV (rien n'est texturé), sans groupes : prête à fusionner
export function preparer(g) {
  const n = g.index ? g.toNonIndexed() : g;
  if (n !== g) g.dispose();
  if (n.attributes.uv) n.deleteAttribute('uv');
  n.clearGroups();
  return n;
}
function placer(g, a, x, y, z, ry) {
  _m.makeRotationY(ry).setPosition(x, y, z);
  const p = preparer(g);
  p.applyMatrix4(_m);
  a?.applyMatrix4(_m);
  return { g: p, a };
}
// pavé arrondi posé à y0 ; ses arêtes sont celles d'un pavé rentré jusqu'au milieu de l'arrondi
export function bloc(w, h, d, r, x, y0, z, ry = 0) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const k = r * (2 - Math.SQRT2);
  const b = new THREE.BoxGeometry(w - k, h - k, d - k);
  const a = new THREE.EdgesGeometry(b);
  b.dispose();
  return placer(g, a, x, y0 + h / 2, z, ry);
}
export function cyl(rh, rb, h, x, y0, z, n = 18, seuil = 30) {
  const g = new THREE.CylinderGeometry(rh, rb, h, n);
  return placer(g, new THREE.EdgesGeometry(g, seuil), x, y0 + h / 2, z, 0);
}
// anneau couché (bord d'un panier, d'un bol), sans arêtes
export function tore(R, r, x, y, z, n = 28) {
  return placer(new THREE.TorusGeometry(R, r, 10, n).rotateX(Math.PI / 2), null, x, y, z, 0);
}
// volume à facettes (feuillage stylisé) : toutes ses arêtes dessinées
export function facettes(r, x, y, z) {
  const g = new THREE.IcosahedronGeometry(r, 0);
  return placer(g, new THREE.EdgesGeometry(g, 1), x, y, z, 0);
}
export function traits(liste) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(liste.flat(), 3));
  return { a: g };
}
const rectangle = (w, d, y) => traits([
  [-w / 2, y, -d / 2, w / 2, y, -d / 2], [w / 2, y, -d / 2, w / 2, y, d / 2],
  [w / 2, y, d / 2, -w / 2, y, d / 2], [-w / 2, y, d / 2, -w / 2, y, -d / 2]
]);
export function fusion(liste) {
  if (liste.length === 1) return liste[0];
  const f = mergeGeometries(liste, false);
  liste.forEach(g => g.dispose());
  return f;
}
const pieds = (cle, dx, dz, h, c = .05) => [-1, 1].flatMap(sx => [-1, 1].map(sz => [cle, bloc(c, h, c, 0, sx * dx, 0, sz * dz)]));
// rangée de livres posée sur une tablette
function livres(x, y0, z, liste) {
  return liste.map(([w, h, cle]) => { const p = [cle, bloc(w, h, .22, .004, x + w / 2, y0, z)]; x += w + .006; return p; });
}
// ajoute des pièces [matière, { g, a }] à un objet : une géométrie par matière, une pour les arêtes
export function assembler(objet, parties, m, arete = m.arete) {
  const pleins = {}, aretes = [];
  for (const [cle, p] of parties) {
    if (p.g) (pleins[cle] ||= []).push(p.g);
    if (p.a) aretes.push(p.a);
  }
  for (const cle in pleins) objet.add(new THREE.Mesh(fusion(pleins[cle]), m[cle]));
  if (aretes.length) objet.add(new THREE.LineSegments(fusion(aretes), arete));
  return objet;
}

// ---------- ombres de contact (canevas partagés par taille)
function texOmbre(lx, lz, marge) {
  const ech = 64, w = Math.ceil((lx + 2 * marge) * ech), h = Math.ceil((lz + 2 * marge) * ech);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const hors = w + 40, retrait = .03 * ech;
  x.shadowColor = 'rgba(80,50,40,1)';
  x.shadowBlur = .16 * ech;
  x.shadowOffsetX = hors;
  x.fillStyle = '#000';
  x.beginPath();
  if (x.roundRect) x.roundRect(marge * ech + retrait - hors, marge * ech + retrait, lx * ech - 2 * retrait, lz * ech - 2 * retrait, .06 * ech);
  else x.rect(marge * ech + retrait - hors, marge * ech + retrait, lx * ech - 2 * retrait, lz * ech - 2 * retrait);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function atelierOmbres() {
  const cache = new Map();
  return {
    texture(lx, lz) {
      const cle = lx.toFixed(2) + 'x' + lz.toFixed(2);
      if (!cache.has(cle)) cache.set(cle, texOmbre(lx, lz, .24));
      return cache.get(cle);
    },
    liberer() { cache.forEach(t => t.dispose()); cache.clear(); }
  };
}

// ---------- meubles (repère local : posé à y = 0, face avant vers +z) ; pied : emprise de l'ombre
export const MEUBLES = {
  tapis: { parties: () => [['tapis', bloc(2.4, .012, 1.7, 0, 0, 0, 0)], ['trait', rectangle(2.16, 1.46, .0125)]] },
  tapisRond: { parties: () => [['tapis', cyl(.85, .85, .012, 0, 0, 0, 40, 80)]] },
  canape: {
    pied: [2.1, .9], ombre: .55,
    parties: () => [
      ['gris', bloc(2.1, .34, .9, .05, 0, .06, 0)],
      ['gris', bloc(2.1, .46, .2, .06, 0, .38, -.35)],
      ['gris', bloc(.2, .24, .9, .06, -.95, .38, 0)],
      ['gris', bloc(.2, .24, .9, .06, .95, .38, 0)],
      ['clair', bloc(.84, .13, .68, .05, -.425, .4, .09)],
      ['clair', bloc(.84, .13, .68, .05, .425, .4, .09)],
      ['clair', bloc(.82, .32, .14, .06, -.425, .5, -.18)],
      ['clair', bloc(.82, .32, .14, .06, .425, .5, -.18)],
      ...pieds('fonce', .97, .37, .06)
    ]
  },
  table: {
    pied: [1, .55], ombre: .35,
    parties: () => [
      ['beurre', bloc(1, .045, .55, .018, 0, .315, 0)],
      ...[-1, 1].flatMap(sx => [-1, 1].map(sz => ['fonce', cyl(.016, .016, .315, sx * .44, 0, sz * .22, 10, 50)]))
    ]
  },
  // petite table carrée (échecs, thé)
  gueridon: {
    pied: [.62, .62], ombre: .35,
    parties: () => [
      ['bois', bloc(.62, .04, .62, .02, 0, .5, 0)],
      ['fonce', cyl(.03, .03, .5, 0, 0, 0, 10, 50)],
      ['fonce', cyl(.2, .2, .02, 0, 0, 0, 20)]
    ]
  },
  pouf: { pied: [.46, .46], ombre: .4, parties: () => [['signal', cyl(.23, .23, .32, 0, 0, 0, 24)], ['clair', cyl(.2, .22, .04, 0, .32, 0, 24)]] },
  fauteuil: {
    pied: [.8, .78], ombre: .5,
    parties: () => [
      ['signal', bloc(.8, .3, .78, .07, 0, .07, 0)],
      ['signal', bloc(.8, .42, .18, .08, 0, .37, -.3)],
      ['signal', bloc(.15, .2, .78, .07, -.325, .37, 0)],
      ['signal', bloc(.15, .2, .78, .07, .325, .37, 0)],
      ['signal', bloc(.5, .11, .58, .05, 0, .37, .08)],
      ...pieds('fonce', .32, .3, .07)
    ]
  },
  lampadaire: {
    pied: [.34, .34], ombre: .4,
    parties: () => [
      ['fonce', cyl(.15, .15, .025, 0, 0, 0, 24)],
      ['fonce', cyl(.011, .011, 1.4, 0, .025, 0, 8, 50)],
      ['beurre', cyl(.13, .19, .3, 0, 1.38, 0, 24)]
    ]
  },
  etagere: {
    pied: [1, .34], ombre: .45,
    parties: () => [
      ['clair', bloc(.03, 1.9, .34, 0, -.485, 0, 0)],
      ['clair', bloc(.03, 1.9, .34, 0, .485, 0, 0)],
      ...[.06, .5, .94, 1.38, 1.875].map(y => ['clair', bloc(.94, .025, .34, 0, 0, y, 0)]),
      ...livres(-.44, .085, -.02, [[.04, .28, 'gris'], [.05, .31, 'signal'], [.035, .26, 'fonce'], [.045, .29, 'gris'], [.04, .27, 'beurre']]),
      ['gris', bloc(.3, .2, .26, .02, .25, .085, 0)],
      ...livres(.1, .525, -.02, [[.04, .3, 'beurre'], [.05, .27, 'gris'], [.04, .32, 'signal']]),
      ['menthe', cyl(.06, .05, .2, -.28, .525, 0, 16)],
      ...livres(-.4, .965, -.02, [[.05, .3, 'gris'], [.04, .26, 'fonce'], [.045, .28, 'signal'], [.05, .31, 'gris'], [.04, .27, 'beurre'], [.045, .29, 'gris']]),
      ['gris', bloc(.24, .16, .24, .02, .22, 1.405, 0)],
      ...livres(-.3, 1.405, -.02, [[.05, .28, 'signal'], [.04, .3, 'gris']])
    ]
  },
  plante: {
    pied: [.4, .4], ombre: .45,
    parties: () => [
      ['signal', cyl(.19, .15, .36, 0, 0, 0, 20)],
      ['fonce', cyl(.012, .012, .5, 0, .36, 0, 6, 50)],
      ['menthe', facettes(.27, .02, .98, .02)],
      ['menthe', facettes(.21, -.14, 1.24, -.05)],
      ['menthe', facettes(.17, .13, 1.2, .1)]
    ]
  },
  meubleTV: {
    pied: [1.6, .44], ombre: .5,
    parties: () => [
      ['fonce', bloc(1.5, .07, .36, 0, 0, 0, 0)],
      ['clair', bloc(1.6, .38, .44, .02, 0, .07, 0)],
      ['trait', traits([[-.27, .09, .2215, -.27, .43, .2215], [.27, .09, .2215, .27, .43, .2215]])],
      ['fonce', bloc(.34, .022, .2, 0, 0, .45, -.06)],
      ['fonce', bloc(.06, .12, .04, 0, 0, .47, -.08)],
      ['ecran', bloc(1.16, .68, .035, .01, 0, .56, -.07)],
      // console de jeux (blanche, bouton corail)
      ['clair', bloc(.3, .06, .2, .02, .5, .45, .06)],
      ['signal', cyl(.018, .018, .01, .58, .51, .12, 10)]
    ]
  },
  // panier de chien : un coussin dans un anneau
  panier: {
    pied: [.9, .9], ombre: .45,
    parties: () => [['signal', cyl(.45, .45, .06, 0, 0, 0, 32)], ['signal', tore(.4, .085, 0, .1, 0)], ['clair', cyl(.36, .36, .08, 0, .05, 0, 28)]]
  },
  // griffoir de chat : un poteau, deux plateaux
  griffoir: {
    pied: [.5, .5], ombre: .45,
    parties: () => [
      ['beurre', bloc(.5, .05, .5, .02, 0, 0, 0)], ['bois', cyl(.07, .07, 1.05, 0, .05, 0, 14)],
      ['beurre', bloc(.42, .05, .42, .02, 0, .55, 0)], ['beurre', bloc(.46, .05, .46, .02, 0, 1.1, 0)]
    ]
  }
};

// Construit un meuble du catalogue avec les matières d'un appartement ; ombres : atelierOmbres()
export function construireMeuble(id, m, ombres) {
  const def = MEUBLES[id];
  const objet = assembler(new THREE.Group(), def.parties(), m);
  objet.name = id;
  let ombre = null;
  if (def.pied) {
    const [lx, lz] = def.pied, marge = .24;
    ombre = new THREE.Mesh(new THREE.PlaneGeometry(lx + 2 * marge, lz + 2 * marge).rotateX(-Math.PI / 2).translate(0, Y_OMBRE, 0),
      new THREE.MeshBasicMaterial({ map: ombres.texture(lx, lz), transparent: true, opacity: def.ombre, depthWrite: false }));
    ombre.userData.base = def.ombre;
    ombre.renderOrder = 1;
    objet.add(ombre);
  }
  return { objet, ombre };
}
