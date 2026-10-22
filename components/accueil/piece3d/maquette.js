// Maquette de la pièce d'accueil (« Maison douce ») : socle pêche, deux murs lilas coupés comme une
// maquette (porte et fenêtre en découpe), tracé du plan au sol avec ses cotes, meubles en volumes simples
// aux arrondis doux, couleurs pastel façon pâte à modeler. Tout est construit en code (aucune texture externe) ; les pièces d'un même meuble
// sont fusionnées : une géométrie par matière et une pour les arêtes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// pièce (m) : x ∈ [-L/2, L/2], z ∈ [-P/2, P/2] ; murs hauts au fond (z−) et à gauche (x−),
// les deux autres coupés au ras du sol (la caméra regarde depuis l'angle avant droit)
export const L = 5, P = 4;
const H = 2.5, EP = .12, BAS = .07;
const PORTE = { z0: .8, z1: 1.7, h: 2.1 };                 // mur de gauche
const FENETRE = { x0: -1.8, x1: -.4, y0: .9, y1: 2.15 };   // mur du fond
const ECART = .42;   // lignes de cote : écart au nu extérieur des murs
const TROU = .52;    // demi-coupure de la ligne de cote où se pose le chiffre
const PAS = .05;     // longueur d'un brin : le tracé avance brin par brin
// hauteurs des calques posés au sol (au-dessus du tapis pour les ombres et le balayage)
const Y = { grille: .0015, plan: .002, ao: .0035, etiquette: .003, ombre: .015, balayage: .017 };

const C = {
  encre: '#26232B', signal: '#F2613F', sol: '#FFE6D2', socle: '#F6D9C4', mur: '#E2DBF8',
  clair: '#FFFBF6', gris: '#BFDCC5', fonce: '#5E5864', ecran: '#2E2A33', tapis: '#FFCFB6',
  beurre: '#FFE49A', menthe: '#9ECDA9'
};

// deux agencements : A (héros, relevé), B (aménagé, visite) ; [x, z, rotation y]
export const DISPOSITIONS = {
  A: {
    tapis: [1.1, -.25, 0], meubleTV: [1.2, -1.78, 0], etagere: [-2.33, -.2, Math.PI / 2],
    canape: [1.2, .6, Math.PI], table: [1.2, -.55, 0], lampadaire: [-1.35, -1.05, 0],
    plante: [-2.08, -1.6, 0], fauteuil: [-.7, -.35, 1.28]
  },
  B: {
    tapis: [-.85, -.35, Math.PI / 2], meubleTV: [-2.28, -.35, Math.PI / 2], etagere: [1.7, -1.83, 0],
    canape: [.35, -.35, -Math.PI / 2], table: [-.95, -.35, Math.PI / 2], lampadaire: [-.5, -1.72, 0],
    plante: [2.1, 1.55, 0], fauteuil: [-1.35, -1.52, .2]
  }
};
// ordre d'arrivée (le fauteuil corail en dernier)
export const ORDRE = ['tapis', 'meubleTV', 'etagere', 'canape', 'table', 'lampadaire', 'plante', 'fauteuil'];

const COTES = { fr: ['5,00 m', '4,00 m'], en: ['5.00 m', '4.00 m'] };
const POLICE = '600 88px "DM Sans Variable", "DM Sans", system-ui, sans-serif';

// ---------- matières
function matieres() {
  const decale = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  const plein = (color, o) => new THREE.MeshLambertMaterial({ color, ...decale, ...o });
  const trait = opacity => new THREE.LineBasicMaterial({ color: C.encre, transparent: true, opacity, depthWrite: false });
  return {
    sol: new THREE.MeshBasicMaterial({ color: C.sol, transparent: true, opacity: 0, ...decale }),
    socle: plein(C.socle, { transparent: true, opacity: 0 }),
    mur: plein(C.mur, { transparent: true }),
    clair: plein(C.clair), gris: plein(C.gris), fonce: plein(C.fonce), ecran: plein(C.ecran),
    signal: plein(C.signal), tapis: plein(C.tapis), beurre: plein(C.beurre), menthe: plein(C.menthe),
    arete: trait(.16), areteMur: trait(.14), areteSocle: trait(0),
    contour: trait(.7), ouverture: trait(.6), cote: trait(0), grille: trait(0)
  };
}

// ---------- géométries
const _m = new THREE.Matrix4();
// sans index ni UV (rien n'est texturé), sans groupes : prête à fusionner
function preparer(g) {
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
  a.applyMatrix4(_m);
  return { g: p, a };
}
// pavé arrondi posé à y0 ; ses arêtes sont celles d'un pavé rentré jusqu'au milieu de l'arrondi
// (une seule ligne par arête, qui court sur la surface)
function bloc(w, h, d, r, x, y0, z, ry = 0) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const k = r * (2 - Math.SQRT2);
  const b = new THREE.BoxGeometry(w - k, h - k, d - k);
  const a = new THREE.EdgesGeometry(b);
  b.dispose();
  return placer(g, a, x, y0 + h / 2, z, ry);
}
function cyl(rh, rb, h, x, y0, z, n = 18, seuil = 30) {
  const g = new THREE.CylinderGeometry(rh, rb, h, n);
  return placer(g, new THREE.EdgesGeometry(g, seuil), x, y0 + h / 2, z, 0);
}
// volume à facettes (feuillage stylisé) : toutes ses arêtes dessinées
function facettes(r, x, y, z) {
  const g = new THREE.IcosahedronGeometry(r, 0);
  return placer(g, new THREE.EdgesGeometry(g, 1), x, y, z, 0);
}
function traits(liste) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(liste.flat(), 3));
  return { a: g };
}
const rectangle = (w, d, y) => traits([
  [-w / 2, y, -d / 2, w / 2, y, -d / 2], [w / 2, y, -d / 2, w / 2, y, d / 2],
  [w / 2, y, d / 2, -w / 2, y, d / 2], [-w / 2, y, d / 2, -w / 2, y, -d / 2]
]);
function fusion(liste) {
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

// ---------- meubles (repère local : posé à y = 0, face avant vers +z) ; pied : emprise de l'ombre
const MEUBLES = {
  tapis: { parties: () => [['tapis', bloc(2.6, .012, 1.9, 0, 0, 0, 0)], ['trait', rectangle(2.36, 1.66, .0125)]] },
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
      ...[-1, 1].flatMap(sx => [-1, 1].map(sz => ['fonce', cyl(.016, .016, .315, sx * .44, 0, sz * .22, 10, 50)])),
      ['gris', bloc(.26, .035, .19, .008, .18, .36, .04, .2)],
      ['gris', bloc(.2, .03, .15, .008, .19, .395, .03, -.15)]
    ]
  },
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
      ...livres(-.44, .085, -.02, [[.04, .28, 'gris'], [.05, .31, 'gris'], [.035, .26, 'fonce'], [.045, .29, 'gris'], [.04, .27, 'gris']]),
      ['gris', bloc(.3, .2, .26, .02, .25, .085, 0)],
      ...livres(.1, .525, -.02, [[.04, .3, 'gris'], [.05, .27, 'gris'], [.04, .32, 'gris']]),
      ['gris', cyl(.06, .05, .2, -.28, .525, 0, 16)],
      ...livres(-.4, .965, -.02, [[.05, .3, 'gris'], [.04, .26, 'fonce'], [.045, .28, 'gris'], [.05, .31, 'gris'], [.04, .27, 'gris'], [.045, .29, 'gris']]),
      ['gris', bloc(.24, .16, .24, .02, .22, 1.405, 0)],
      ...livres(-.3, 1.405, -.02, [[.05, .28, 'gris'], [.04, .3, 'gris']])
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
    pied: [1.8, .44], ombre: .5,
    parties: () => [
      ['fonce', bloc(1.7, .07, .36, 0, 0, 0, 0)],
      ['clair', bloc(1.8, .38, .44, .02, 0, .07, 0)],
      ['trait', traits([[-.3, .09, .2215, -.3, .43, .2215], [.3, .09, .2215, .3, .43, .2215]])],
      ['fonce', bloc(.34, .022, .2, 0, 0, .45, -.06)],
      ['fonce', bloc(.06, .12, .04, 0, 0, .47, -.08)],
      ['ecran', bloc(1.24, .72, .035, .01, 0, .56, -.07)]
    ]
  }
};

// ---------- textures dessinées (canevas)
function canevas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function texture(c, anisotropie = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropie;
  return t;
}
function arrondi(x, a, b, w, h, r) {
  x.beginPath();
  if (x.roundRect) x.roundRect(a, b, w, h, r); else x.rect(a, b, w, h);
}
// ombre de contact : l'emprise du meuble, floutée (l'ombre seule est dessinée, la forme reste hors du canevas)
function texOmbre(lx, lz, marge) {
  const ech = 64, w = Math.ceil((lx + 2 * marge) * ech), h = Math.ceil((lz + 2 * marge) * ech);
  const c = canevas(w, h), x = c.getContext('2d');
  const hors = w + 40, retrait = .03 * ech;
  x.shadowColor = 'rgba(80,50,40,1)';
  x.shadowBlur = .16 * ech;
  x.shadowOffsetX = hors;
  x.fillStyle = '#000';
  arrondi(x, marge * ech + retrait - hors, marge * ech + retrait, lx * ech - 2 * retrait, lz * ech - 2 * retrait, .06 * ech);
  x.fill();
  return texture(c);
}
// pied de mur : un léger assombrissement du sol le long des murs hauts
function texPiedDeMur() {
  const c = canevas(4, 64), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(110,60,40,.16)');
  g.addColorStop(.35, 'rgba(110,60,40,.06)');
  g.addColorStop(1, 'rgba(110,60,40,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 64);
  return texture(c);
}
// traînée du balayage (la tête, vers +z, est en bas du canevas)
function texBalayage() {
  const c = canevas(4, 128), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(242,97,63,0)');
  g.addColorStop(.7, 'rgba(242,97,63,.08)');
  g.addColorStop(1, 'rgba(242,97,63,.3)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 128);
  return texture(c);
}
function dessinerCote(c, texte) {
  const x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  x.font = POLICE;
  if ('letterSpacing' in x) x.letterSpacing = '4px';
  x.fillStyle = C.encre;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(texte, c.width / 2, c.height / 2 + 4);
}

// ---------- tracé du plan
function brins() {
  const p = [];
  const api = {
    p,
    seg(x0, z0, x1, z1) { p.push(x0, 0, z0, x1, 0, z1); return api; },
    ligne(x0, z0, x1, z1) {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / PAS));
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n;
        api.seg(x0 + (x1 - x0) * a, z0 + (z1 - z0) * a, x0 + (x1 - x0) * b, z0 + (z1 - z0) * b);
      }
      return api;
    }
  };
  return api;
}
function lignes(p, y, matiere) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.translate(0, y, 0);
  const l = new THREE.LineSegments(g, matiere);
  l.userData.n = p.length / 6;
  return l;
}
// part d'un brin du mur de gauche hors de la baie de porte (un brin ne croise qu'un bord)
function horsPorte(a, b) {
  const bas = Math.min(a, b), haut = Math.max(a, b);
  if (haut <= PORTE.z0 || bas >= PORTE.z1) return [a, b];
  if (bas >= PORTE.z0 && haut <= PORTE.z1) return [a, a];
  const bord = bas < PORTE.z0 ? PORTE.z0 : PORTE.z1;
  const garde = bas < PORTE.z0 ? bas : haut;
  return a === garde ? [a, bord] : [bord, b];
}
// nus intérieur et extérieur des quatre murs, tracés ensemble (un brin de chaque à tour de rôle)
function contours() {
  const p = [], l = L / 2, q = P / 2, e = EP;
  const cotesMurs = [
    [[-l, -q, l, -q], [-l - e, -q - e, l + e, -q - e], false],
    [[l, -q, l, q], [l + e, -q - e, l + e, q + e], false],
    [[l, q, -l, q], [l + e, q + e, -l - e, q + e], false],
    [[-l, q, -l, -q], [-l - e, q + e, -l - e, -q - e], true]
  ];
  for (const [int, ext, porte] of cotesMurs) {
    const n = Math.round(Math.hypot(int[2] - int[0], int[3] - int[1]) / PAS);
    for (let i = 0; i < n; i++) {
      for (const [x0, z0, x1, z1] of [int, ext]) {
        const xa = x0 + (x1 - x0) * i / n, xb = x0 + (x1 - x0) * (i + 1) / n;
        let za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n;
        if (porte) [za, zb] = horsPorte(za, zb);
        p.push(xa, 0, za, xb, 0, zb);
      }
    }
  }
  return p;
}
function ouvertures() {
  const t = brins(), l = L / 2, q = P / 2, R = PORTE.z1 - PORTE.z0;
  // porte : tableaux, vantail ouvert, arc de débattement
  t.ligne(-l - EP, PORTE.z0, -l, PORTE.z0).ligne(-l - EP, PORTE.z1, -l, PORTE.z1);
  t.ligne(-l, PORTE.z0, -l + R, PORTE.z0);
  for (let i = 0, n = 28; i < n; i++) {
    const a = i / n * Math.PI / 2, b = (i + 1) / n * Math.PI / 2;
    t.seg(-l + R * Math.cos(a), PORTE.z0 + R * Math.sin(a), -l + R * Math.cos(b), PORTE.z0 + R * Math.sin(b));
  }
  // fenêtre : tableaux et double trait du vitrage
  t.ligne(FENETRE.x0, -q - EP, FENETRE.x0, -q).ligne(FENETRE.x1, -q - EP, FENETRE.x1, -q);
  t.ligne(FENETRE.x0, -q - EP * .35, FENETRE.x1, -q - EP * .35).ligne(FENETRE.x0, -q - EP * .65, FENETRE.x1, -q - EP * .65);
  return t.p;
}
function cotes(zc, xc) {
  const t = brins(), l = L / 2, q = P / 2;
  const coche = (x, z) => t.seg(x - .07, z + .07, x + .07, z - .07);
  // largeur, devant la pièce
  t.ligne(-l, q + EP + .08, -l, zc + .1).ligne(l, q + EP + .08, l, zc + .1);
  t.ligne(-l, zc, -TROU, zc).ligne(TROU, zc, l, zc);
  coche(-l, zc); coche(l, zc);
  // profondeur, à droite (lue de bas en haut)
  t.ligne(l + EP + .08, q, xc + .1, q).ligne(l + EP + .08, -q, xc + .1, -q);
  t.ligne(xc, q, xc, TROU).ligne(xc, -TROU, xc, -q);
  coche(xc, q); coche(xc, -q);
  return t.p;
}
function grille() {
  const t = brins();
  for (let x = -2; x <= 2.001; x += .5) t.seg(x, -P / 2, x, P / 2);
  for (let z = -1.5; z <= 1.501; z += .5) t.seg(-L / 2, z, L / 2, z);
  return t.p;
}

// ---------- murs : fond (fenêtre) et gauche (porte) en hauteur, devant et droite coupés au ras du sol
function murs() {
  const l = L / 2, q = P / 2, ext = { depth: EP, bevelEnabled: false, curveSegments: 1 };
  const fond = new THREE.Shape();
  fond.moveTo(-l - EP, 0); fond.lineTo(l + EP, 0); fond.lineTo(l + EP, H); fond.lineTo(-l - EP, H); fond.closePath();
  const baie = new THREE.Path();
  baie.moveTo(FENETRE.x0, FENETRE.y0); baie.lineTo(FENETRE.x1, FENETRE.y0); baie.lineTo(FENETRE.x1, FENETRE.y1); baie.lineTo(FENETRE.x0, FENETRE.y1); baie.closePath();
  fond.holes.push(baie);
  const gFond = new THREE.ExtrudeGeometry(fond, ext);
  gFond.translate(0, 0, -q - EP);
  // mur de gauche dessiné dans son plan (x local = z du monde), puis tourné
  const gauche = new THREE.Shape();
  gauche.moveTo(-q, 0); gauche.lineTo(PORTE.z0, 0); gauche.lineTo(PORTE.z0, PORTE.h); gauche.lineTo(PORTE.z1, PORTE.h);
  gauche.lineTo(PORTE.z1, 0); gauche.lineTo(q + EP, 0); gauche.lineTo(q + EP, H); gauche.lineTo(-q, H); gauche.closePath();
  const gGauche = new THREE.ExtrudeGeometry(gauche, ext);
  gGauche.rotateY(-Math.PI / 2);
  gGauche.translate(-l, 0, 0);
  const gDevant = new THREE.BoxGeometry(L + EP, BAS, EP).translate(EP / 2, BAS / 2, q + EP / 2);
  const gDroite = new THREE.BoxGeometry(EP, BAS, P).translate(l + EP / 2, BAS / 2, 0);
  const sources = [gFond, gGauche, gDevant, gDroite];
  const aretes = fusion(sources.map(g => new THREE.EdgesGeometry(g, 20)));
  const plein = fusion(sources.map(preparer));
  return { plein, aretes };
}

export function construirePiece({ lang = 'fr', anisotropie = 1 } = {}) {
  const m = matieres();
  const textures = [];
  const groupe = new THREE.Group();

  // socle : dessus couleur papier (sans éclairage), chants ombrés
  const gSocle = new THREE.BoxGeometry(L + 2 * EP, .1, P + 2 * EP).translate(0, -.05, 0);
  const socle = new THREE.Group();
  const dalle = new THREE.Mesh(gSocle, [m.socle, m.socle, m.sol, m.socle, m.socle, m.socle]);
  dalle.renderOrder = -3;
  socle.add(dalle, new THREE.LineSegments(new THREE.EdgesGeometry(gSocle), m.areteSocle));
  groupe.add(socle);

  // pied des murs hauts
  const tAo = texPiedDeMur();
  textures.push(tAo);
  m.ao = new THREE.MeshBasicMaterial({ map: tAo, transparent: true, opacity: 0, depthWrite: false });
  const aoFond = new THREE.Mesh(new THREE.PlaneGeometry(L, .45).rotateX(-Math.PI / 2).translate(0, Y.ao, -P / 2 + .225), m.ao);
  const aoGauche = new THREE.Mesh(new THREE.PlaneGeometry(P, .45).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(-L / 2 + .225, Y.ao, 0), m.ao);
  aoFond.renderOrder = aoGauche.renderOrder = -2;
  groupe.add(aoFond, aoGauche);

  // tracé du plan
  const lGrille = lignes(grille(), Y.grille, m.grille);
  lGrille.renderOrder = -1;
  const zc = P / 2 + EP + ECART, xc = L / 2 + EP + ECART;
  const lContours = lignes(contours(), Y.plan, m.contour);
  const lOuvertures = lignes(ouvertures(), Y.plan, m.ouverture);
  const lCotes = lignes(cotes(zc, xc), Y.plan, m.cote);
  groupe.add(lGrille, lContours, lOuvertures, lCotes);

  // chiffres des cotes, imprimés au sol
  const libelles = COTES[lang] || COTES.fr;
  const etiquettes = libelles.map((texte, i) => {
    const c = canevas(512, 128);
    dessinerCote(c, texte);
    const t = texture(c, anisotropie);
    textures.push(t);
    const g = new THREE.PlaneGeometry(1.2, .3).rotateX(-Math.PI / 2);
    if (i === 1) g.rotateY(Math.PI / 2);
    g.translate(i === 0 ? 0 : xc, Y.etiquette, i === 0 ? zc : 0);
    const e = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false }));
    e.userData = { c, texte, t };
    return e;
  });
  groupe.add(...etiquettes);

  // murs (montés par mise à l'échelle verticale du groupe)
  const { plein, aretes } = murs();
  const groupeMurs = new THREE.Group();
  const mMurs = new THREE.Mesh(plein, m.mur);
  mMurs.renderOrder = 3;
  groupeMurs.add(mMurs, new THREE.LineSegments(aretes, m.areteMur));
  groupe.add(groupeMurs);

  // balayage du relevé : une ligne orange signal et sa traînée
  const tBal = texBalayage();
  textures.push(tBal);
  const trainee = new THREE.Mesh(new THREE.PlaneGeometry(L, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tBal, transparent: true, opacity: 0, depthWrite: false }));
  const ligne = new THREE.Mesh(new THREE.PlaneGeometry(L, .025).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: C.signal, transparent: true, opacity: 0, depthWrite: false }));
  const balayage = new THREE.Group();
  balayage.add(trainee, ligne);
  balayage.position.y = Y.balayage;
  balayage.visible = false;
  trainee.renderOrder = ligne.renderOrder = 2;
  groupe.add(balayage);

  // meubles
  const meubles = {};
  for (const id of ORDRE) {
    const def = MEUBLES[id];
    const objet = new THREE.Group();
    objet.name = id;
    const pleins = {}, traitsMeuble = [];
    for (const [cle, p] of def.parties()) {
      if (p.g) (pleins[cle] ||= []).push(p.g);
      if (p.a) traitsMeuble.push(p.a);
    }
    for (const cle in pleins) objet.add(new THREE.Mesh(fusion(pleins[cle]), m[cle]));
    objet.add(new THREE.LineSegments(fusion(traitsMeuble), m.arete));
    let ombre = null;
    if (def.pied) {
      const [lx, lz] = def.pied, marge = .24;
      const t = texOmbre(lx, lz, marge);
      textures.push(t);
      ombre = new THREE.Mesh(new THREE.PlaneGeometry(lx + 2 * marge, lz + 2 * marge).rotateX(-Math.PI / 2).translate(0, Y.ombre, 0),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: def.ombre, depthWrite: false }));
      ombre.userData.base = def.ombre;
      ombre.renderOrder = 1;
      objet.add(ombre);
    }
    groupe.add(objet);
    meubles[id] = { objet, ombre };
  }

  return {
    groupe, m, meubles, etiquettes, balayage, trainee, ligne,
    socle, murs: groupeMurs, contours: lContours, ouvertures: lOuvertures, cotes: lCotes,
    // la police mono arrive parfois après la construction : on réimprime les chiffres
    redessiner() {
      etiquettes.forEach(e => { dessinerCote(e.userData.c, e.userData.texte); e.userData.t.needsUpdate = true; });
    },
    liberer() {
      const vues = new Set(Object.values(m));
      groupe.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => vues.add(x));
      });
      vues.forEach(x => x.dispose());
      textures.forEach(t => t.dispose());
    }
  };
}
