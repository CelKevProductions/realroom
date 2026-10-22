// L'immeuble jouet de l'accueil, autour de la pièce (piece3d/maquette.js) : la pièce est le 3e niveau
// d'un petit immeuble pastel posé sur une île d'herbe, avec ses arbres et ses nuages. Construit en code,
// comme la pièce (volumes arrondis, arêtes légères, pièces d'une même matière fusionnées).
// Repères : le sol de la pièce est à y = 0 ; un niveau fait 2,7 m.
//   dessous : rez-de-chaussée et 1er étage (y < 0), l'île ;
//   coque : les deux façades de la pièce (devant, droite), qui tombent comme celles d'une maison de poupée ;
//   dessus : le plafond de la pièce, le dernier étage et le toit, qui se soulèvent à la découpe.
import * as THREE from 'three';
import { bloc, cyl, facettes, fusion, L, P, H, EP } from './maquette.js';

export const ETAGE = 2.7;
const W = L + 2 * EP, D = P + 2 * EP;           // emprise extérieure (5,24 × 4,24 m)
const FENETRE = { l: .86, h: 1.12, bas: .86 };
const COULEURS = {
  peche: '#FFD8C2', menthe: '#D2EAD6', beurre: '#FFEBB5', lilas: '#E2DBF8', clair: '#FFFBF6', corail: '#F2613F',
  vitre: '#CFE2F4', allumee: '#FFE6A0', herbe: '#C4E3C9', ile: '#F6D9C4', chemin: '#FFF0C8', feuillage: '#9ECDA9',
  tronc: '#8A6F62', nuage: '#FFFFFF'
};

function matieres() {
  const plein = c => new THREE.MeshLambertMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const m = {};
  for (const [k, c] of Object.entries(COULEURS)) m[k] = plein(c);
  m.coupe = new THREE.MeshBasicMaterial({ color: COULEURS.corail, transparent: true, opacity: 0, depthWrite: false });
  return m;
}

// ajoute des pièces [matière, { g, a }] à un objet : une géométrie par matière, une pour les arêtes
function assembler(objet, parties, m, arete) {
  const pleins = {}, traits = [];
  for (const [cle, p] of parties) {
    if (p.g) (pleins[cle] ||= []).push(p.g);
    if (p.a) traits.push(p.a);
  }
  for (const cle in pleins) objet.add(new THREE.Mesh(fusion(pleins[cle]), m[cle]));
  if (traits.length) objet.add(new THREE.LineSegments(fusion(traits), arete));
  return objet;
}

// fenêtre sur la façade avant (normale +z, nu à z) ou droite (normale +x, nu à x)
function fenetre(face, u, y0, nu, { allumee = false, l = FENETRE.l, h = FENETRE.h, jardiniere = false } = {}) {
  const p = [], c = .055, e = .05;
  // en repère de façade : u le long, v en hauteur, n vers l'extérieur
  const pose = (w, hh, d, du, v0, dn, cle, r = .012) => {
    const ry = face === 'avant' ? 0 : Math.PI / 2;
    const x = face === 'avant' ? u + du : nu + dn, z = face === 'avant' ? nu + dn : u + du;
    p.push([cle, face === 'avant' ? bloc(w, hh, d, r, x, v0, z) : bloc(w, hh, d, r, x, v0, z, ry)]);
  };
  // vitre, cadre (quatre barres), croisillon, appui
  pose(l, h, .03, 0, y0, .01, allumee ? 'allumee' : 'vitre', .005);
  pose(l + 2 * c, c, e, 0, y0 + h, .025, 'clair');
  pose(l + 2 * c, c, e, 0, y0 - c, .025, 'clair');
  pose(c, h, e, -(l + c) / 2, y0, .025, 'clair');
  pose(c, h, e, (l + c) / 2, y0, .025, 'clair');
  pose(.03, h, .03, 0, y0, .03, 'clair', .006);
  pose(l, .03, .03, 0, y0 + h * .58, .03, 'clair', .006);
  pose(l + .2, .05, .14, 0, y0 - c - .05, .07, 'clair');
  if (jardiniere) {
    pose(l * .9, .14, .16, 0, y0 - c - .2, .13, 'corail', .04);
    for (const k of [-.3, 0, .3]) {
      const x = face === 'avant' ? u + k * l : nu + .14, z = face === 'avant' ? nu + .14 : u + k * l;
      p.push(['feuillage', facettes(.09 + Math.abs(k) * .05, x, y0 - c - .02, z)]);
    }
  }
  return p;
}

// un niveau plein (hors de la pièce) : façade, corniche, fenêtres
function niveau(base, couleur, options = {}) {
  const { allumees = [], jardinieres = [], rdc = false } = options;
  const p = [['' + couleur, bloc(W, ETAGE - .1, D, .06, 0, base - .1, 0)], ['clair', bloc(W + .16, .1, D + .16, .04, 0, base + H, 0)]];
  const y0 = base + FENETRE.bas;
  const avant = rdc ? [] : [-1.35, 1.35], droite = [-1, 1];
  avant.forEach((u, i) => p.push(...fenetre('avant', u, y0, D / 2, { allumee: allumees.includes('a' + i), jardiniere: jardinieres.includes('a' + i) })));
  droite.forEach((u, i) => p.push(...fenetre('droite', u, y0, W / 2, { allumee: allumees.includes('d' + i), jardiniere: jardinieres.includes('d' + i) })));
  if (rdc) {
    // porte corail sous un auvent, deux vitrines
    p.push(['corail', bloc(1, 2, .08, .03, 0, base, D / 2 + .02)]);
    p.push(['beurre', cyl(.04, .04, .04, .32, base + 1, D / 2 + .08, 10)]);
    p.push(['clair', bloc(1.5, .1, .5, .03, 0, base - .1, D / 2 + .25)]);
    [-1.6, 1.6].forEach(u => p.push(...fenetre('avant', u, base + .7, D / 2, { l: 1.15, h: 1.35, allumee: u > 0 })));
  }
  return p;
}

// auvent rayé au-dessus de la porte
function auvent(base) {
  const g = new THREE.CylinderGeometry(.62, .62, 1.4, 18, 1, false, 0, Math.PI);
  // axe le long de la façade, moitié haute (un dôme) ; aplati, puis posé au-dessus de la porte
  g.rotateZ(Math.PI / 2);
  g.scale(1, .7, 1);
  g.translate(0, base + 2.15, D / 2 + .05);
  return { g, a: null };
}

// le balcon du 1er étage
function balcon(base) {
  const p = [], x = 1.35, z = D / 2 + .3, y = base + .78;
  p.push(['clair', bloc(1.4, .08, .62, .03, x, y, z)]);
  for (const k of [-.62, -.2, .2, .62]) p.push(['clair', bloc(.04, .5, .04, .015, x + k, y + .08, z + .27)]);
  for (const k of [-.66, .66]) p.push(['clair', bloc(.04, .5, .56, .015, x + k, y + .08, z)]);
  p.push(['clair', bloc(1.4, .05, .06, .02, x, y + .56, z + .27)]);
  p.push(['corail', cyl(.12, .09, .22, x - .42, y + .08, z - .05, 14)]);
  p.push(['feuillage', facettes(.2, x - .42, y + .44, z - .05)]);
  return p;
}

function toit(base) {
  const p = [];
  // acrotère, cheminée, antenne, petit jardin
  for (const [w, d, x, z] of [[W + .16, .14, 0, -D / 2 - .01], [W + .16, .14, 0, D / 2 + .01], [.14, D + .16, -W / 2 - .01, 0], [.14, D + .16, W / 2 + .01, 0]]) p.push(['clair', bloc(w, .3, d, .05, x, base, z)]);
  p.push(['corail', bloc(.46, .95, .46, .08, -1.5, base, -1.05)]);
  p.push(['clair', bloc(.6, .1, .6, .04, -1.5, base + .95, -1.05)]);
  p.push(['tronc', cyl(.016, .016, .9, 1.7, base, -1.25, 6, 50)]);
  p.push(['beurre', cyl(.07, .07, .05, 1.7, base + .9, -1.25, 12)]);
  p.push(['corail', bloc(1.3, .2, .36, .06, .7, base, 1.35)]);
  for (const k of [.3, .7, 1.1]) p.push(['feuillage', facettes(.16 + (k === .7 ? .05 : 0), k, base + .3, 1.35)]);
  p.push(['feuillage', facettes(.3, -1.7, base + .25, 1.1)]);
  return p;
}

function ile(base) {
  const p = [['ile', bloc(8.6, .5, 7.6, .22, 0, base - .5, 0)], ['herbe', bloc(8.3, .07, 7.3, .03, 0, base - .03, 0)], ['chemin', bloc(1.1, .02, 1.5, .01, 0, base + .04, D / 2 + .75)]];
  const arbre = (x, z, k = 1) => {
    p.push(['tronc', cyl(.06 * k, .085 * k, .8 * k, x, base + .04, z, 8)]);
    p.push(['feuillage', facettes(.55 * k, x, base + .04 + 1.15 * k, z)]);
    p.push(['feuillage', facettes(.36 * k, x + .25 * k, base + .04 + 1.55 * k, z - .1 * k)]);
  };
  arbre(-3.35, 2.55, .9); arbre(3.45, -2.4, 1.05); arbre(3.3, 2.75, .8); arbre(-3.4, -2.3, .85);
  for (const [x, z, r] of [[-1.45, 2.85, .26], [1.55, 2.9, .3], [-2.2, -3.1, .26], [2.3, 3.25, .2]]) p.push(['feuillage', facettes(r, x, base + .04 + r * .6, z)]);
  return p;
}

function nuage(m, x, y, z, k = 1) {
  const g = new THREE.Group();
  for (const [dx, dy, r] of [[0, 0, .55], [-.6, -.12, .4], [.62, -.1, .42], [.25, .25, .38]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r * k, 16, 12), m.nuage);
    b.position.set(dx * k, dy * k, 0); b.scale.set(1, .8, .85);
    g.add(b);
  }
  g.position.set(x, y, z);
  g.userData.base = new THREE.Vector3(x, y, z);
  return g;
}

export function construireImmeuble({ arete }) {
  const m = matieres();
  const groupe = new THREE.Group();

  // dessous : l'île, le rez-de-chaussée, le 1er étage
  const dessous = new THREE.Group();
  const socle = assembler(new THREE.Group(), ile(-2 * ETAGE - .1), m, arete);
  const rdc = assembler(new THREE.Group(), niveau(-2 * ETAGE, 'peche', { rdc: true, allumees: ['d1'] }), m, arete);
  rdc.add(new THREE.Mesh(auvent(-2 * ETAGE).g, m.corail));
  const premier = assembler(new THREE.Group(), [...niveau(-ETAGE, 'menthe', { allumees: ['a0'], jardinieres: ['d0'] }), ...balcon(-ETAGE)], m, arete);
  dessous.add(socle, rdc, premier);

  // coque : les deux façades de la pièce, chacune sur un pivot à son pied (elle tombe vers l'extérieur)
  const facade = (face) => {
    const pivot = new THREE.Group();
    const parties = face === 'avant'
      ? [['lilas', bloc(W, H, EP, .03, 0, 0, -EP / 2)], ...[-1.35, 1.35].flatMap((u, i) => fenetre('avant', u, FENETRE.bas, 0, { allumee: i === 1, jardiniere: i === 0 }))]
      : [['lilas', bloc(EP, H, D - EP, .03, -EP / 2, 0, -EP / 2)], ...[-1, 1].flatMap(u => fenetre('droite', u, FENETRE.bas, 0, {}))];
    assembler(pivot, parties, m, arete);
    if (face === 'avant') pivot.position.set(0, 0, D / 2); else pivot.position.set(W / 2, 0, 0);
    return pivot;
  };
  const coque = { avant: facade('avant'), droite: facade('droite') };
  const groupeCoque = new THREE.Group();
  groupeCoque.add(coque.avant, coque.droite);

  // dessus : plafond de la pièce, dernier étage, toit
  const dessus = new THREE.Group();
  const dernier = assembler(new THREE.Group(), [['clair', bloc(W + .16, .1, D + .16, .04, 0, H, 0)], ...niveau(ETAGE, 'beurre', { allumees: ['a1', 'd0'], jardinieres: ['a0', 'd1'] })], m, arete);
  const sommet = assembler(new THREE.Group(), toit(2 * ETAGE - .1), m, arete);
  dessus.add(dernier, sommet);

  // trait de découpe corail, autour de l'immeuble sous le plafond de la pièce
  const trait = new THREE.Group();
  for (const [w, d, x, z] of [[W + .5, .05, 0, D / 2 + .25], [W + .5, .05, 0, -D / 2 - .25], [.05, D + .5, W / 2 + .25, 0], [.05, D + .5, -W / 2 - .25, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, .05, d), m.coupe);
    b.position.set(x, H + .05, z);
    trait.add(b);
  }
  trait.visible = false;

  const nuages = new THREE.Group();
  nuages.add(nuage(m, -4.6, 4.4, -1.5, .9), nuage(m, 4.8, 2.4, .8, .75), nuage(m, -4.2, -1, 2.6, .65), nuage(m, 3.8, 6.4, -2.6, .8));

  groupe.add(dessous, groupeCoque, dessus, trait, nuages);

  return {
    groupe, dessous, socle, rdc, premier, coque, groupeCoque, dessus, dernier, sommet, trait, nuages, matCoupe: m.coupe,
    // nuages qui flottent
    vivre(t) {
      nuages.children.forEach((n, i) => {
        const b = n.userData.base;
        n.position.set(b.x + Math.sin(t * .12 + i * 2) * .5, b.y + Math.sin(t * .5 + i) * .12, b.z);
      });
    },
    liberer() {
      groupe.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      Object.values(m).forEach(x => x.dispose());
    }
  };
}
