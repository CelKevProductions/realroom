// La tour de l'accueil, comme une maquette d'architecte : un hall vitré au rez-de-chaussée, quatre étages
// d'un appartement chacun, un toit terrasse, le tout posé sur un socle de pierre avec quelques arbres.
// On la remonte étage par étage : chaque étage est une étape de RealRoom (relevé, aménagement, Shuffle,
// rendu photo). La façade de chaque étage est fermée par un store, qui remonte quand on y arrive.
// Repères (m) : le sol du hall est à y = 0 ; un appartement mesure AL × AP (x, z), AH de haut.
// Chacun a son groupe (repère local : sol à y = 0, centre de la pièce) et ses matières.
import * as THREE from 'three';
import { bloc, cyl, assembler, C } from './maquette.js';

export const AL = 4.4, AP = 3.6, AH = 2.45, EP = .12;
export const W = AL + 2 * EP, D = AP + 2 * EP;            // emprise extérieure (4,64 × 3,84 m)
const RDC = 2.5;                                          // hauteur du hall
const PAS = 2.7;                                          // d'un étage au suivant
export const SOLS = [2.6, 2.6 + PAS, 2.6 + 2 * PAS, 2.6 + 3 * PAS];   // dessus du sol de chaque étage
export const TOIT = SOLS[3] + AH + .2;
const FENETRE = { l: .8, h: 1.2, bas: .85 };
const PAS_TRACE = .06;                                    // longueur d'un brin du relevé (il se trace brin par brin)

// un étage par étape : le relevé (pièce brute, vide), l'aménagement, Shuffle, le rendu photo
export const ETAGES = [
  { nom: 'releve', mur: '#ECE7E0', sol: '#D5CEC4', meubles: {} },
  { nom: 'amenager', mur: '#F2E6DA', sol: '#DDBC97', meubles: { canape: '#B8C5B2', tapis: '#E8D5C2', accent: '#C8714F', bois: '#D8B48D', beurre: '#E6D2A2', plante: '#8FA787' } },
  { nom: 'shuffle', mur: '#E2E5EA', sol: '#E0C3A1', meubles: { canape: '#D7B8A5', tapis: '#C8D2C3', accent: '#8E9AB0', bois: '#D8B48D', beurre: '#E6D2A2', plante: '#8FA787' } },
  { nom: 'rendu', mur: '#ECE3D6', sol: '#CFA87F', meubles: { canape: '#D6CAB4', tapis: '#C9B89D', accent: '#B5643F', bois: '#C99E72', beurre: '#E6D2A2', plante: '#8FA787' } }
];
const COULEURS = {
  enduit: '#EEE7DD', pierre: '#D9CDBF', cadre: '#3E3934', vitre: '#B9CAD3', allumee: '#F0E2C6', store: '#DCD3C8',
  socle: '#E3DBCF', bordure: '#D2C8BA', herbe: '#B9C5A8', allee: '#EEE8DE', feuillage: '#9AAD8A', feuillage2: '#879B7A',
  tronc: '#7C6C60', accent: '#C8714F', plafond: '#F6F1EA', banc: '#B89874'
};

function matieres() {
  const plein = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });
  const m = {};
  for (const [k, c] of Object.entries(COULEURS)) m[k] = plein(c);
  m.vitre = plein(COULEURS.vitre, { roughness: .12, metalness: .25 });
  m.cadre = plein(COULEURS.cadre, { roughness: .45, metalness: .4 });
  m.allumee = plein(COULEURS.allumee, { roughness: .3, emissive: '#E8C48C', emissiveIntensity: .3 });
  m.arete = new THREE.LineBasicMaterial({ color: C.encre, transparent: true, opacity: .12, depthWrite: false });
  return m;
}

// fenêtre sur une face : avant (normale +z, nu à z = nu) ou côté (normale ±x, nu à x = nu) ; cadre fin et
// sombre, vitre légèrement réfléchissante
function fenetre(face, u, y0, nu, { allumee = false, l = FENETRE.l, h = FENETRE.h } = {}) {
  const p = [], c = .04, e = .05, s = face === 'gauche' ? -1 : 1;
  const pose = (w, hh, d, du, v0, dn, cle, r = .006) => {
    if (face === 'avant') p.push([cle, bloc(w, hh, d, r, u + du, v0, nu + dn)]);
    else p.push([cle, bloc(w, hh, d, r, nu + s * dn, v0, u + du, Math.PI / 2)]);
  };
  pose(l, h, .02, 0, y0, -.01, allumee ? 'allumee' : 'vitre', .002);
  pose(l + 2 * c, c, e, 0, y0 + h, .0, 'cadre');
  pose(l + 2 * c, c, e, 0, y0 - c, .0, 'cadre');
  pose(c, h, e, -(l + c) / 2, y0, .0, 'cadre');
  pose(c, h, e, (l + c) / 2, y0, .0, 'cadre');
  pose(.02, h, .03, 0, y0, .0, 'cadre', .004);
  pose(l + .12, .04, .12, 0, y0 - c - .04, .04, 'pierre', .01);
  return p;
}

// le hall : grande vitrine allumée, porte, auvent sombre, bandeau de pierre
function hall() {
  const p = [['enduit', bloc(W, RDC, D, .03, 0, 0, 0)], ['pierre', bloc(W + .12, .14, D + .12, .02, 0, RDC - .06, 0)]];
  p.push(['pierre', bloc(W + .04, .3, D + .04, .02, 0, 0, 0)]);   // soubassement
  // vitrine : trois travées, la porte au milieu
  const z = D / 2 + .005, hv = 1.85, y0 = .3;
  for (const [u, l, allumee] of [[-1.45, 1.3, true], [1.45, 1.3, true]]) p.push(...fenetre('avant', u, y0 + .05, z, { l, h: hv - .1, allumee }));
  p.push(['cadre', bloc(1.1, hv + .1, .05, .01, 0, y0 - .05, z)]);
  p.push(['allumee', bloc(.42, hv - .15, .03, .004, -.22, y0, z + .02)]);
  p.push(['allumee', bloc(.42, hv - .15, .03, .004, .22, y0, z + .02)]);
  p.push(['pierre', cyl(.012, .012, .5, .06, y0 + .7, z + .06, 8)]);
  // auvent
  p.push(['cadre', bloc(1.7, .06, .7, .01, 0, y0 + hv + .12, z + .32)]);
  p.push(['accent', bloc(1.7, .02, .02, .004, 0, y0 + hv + .1, z + .67)]);
  // côtés : deux fenêtres
  for (const s of ['gauche', 'droite']) [-.8, .8].forEach(u => p.push(...fenetre(s, u, .9, (s === 'gauche' ? -1 : 1) * W / 2, {})));
  return p;
}

// un étage vu de l'extérieur : murs du fond et des côtés (avec leurs fenêtres), dalle, nez de dalle en
// pierre et caisson du store en façade
function etage(base) {
  const p = [];
  p.push(['enduit', bloc(W, AH + .25, EP, .02, 0, base - .1, -D / 2 + EP / 2)]);
  for (const s of [-1, 1]) {
    p.push(['enduit', bloc(EP, AH + .25, D, .02, s * (W / 2 - EP / 2), base - .1, 0)]);
    [-.85, .85].forEach(u => p.push(...fenetre(s < 0 ? 'gauche' : 'droite', u, base + FENETRE.bas, s * W / 2, {})));
  }
  // dalle (2 cm sous le sol des appartements : deux faces à la même hauteur scintilleraient)
  p.push(['pierre', bloc(W - 2 * EP, .08, D - EP, 0, 0, base - .1, EP / 2)]);
  p.push(['plafond', bloc(W - 2 * EP, .15, D - EP, 0, 0, base + AH, EP / 2)]);
  p.push(['pierre', bloc(W + .1, .12, D + .1, .02, 0, base + AH + .03, 0)]);
  p.push(['pierre', bloc(W + .1, .1, .1, .02, 0, base - .12, D / 2)]);
  p.push(['cadre', bloc(W - .1, .14, .14, .02, 0, base + AH - .1, D / 2 + .02)]);
  return p;
}

// store de façade : des lames horizontales, roulées dans le caisson du haut quand on l'ouvre
// (pivot au caisson ; ouvert, scale.y → presque 0)
function store(m, base) {
  const pivot = new THREE.Group(), h = AH - .1, w = W - .16;
  const p = [['store', bloc(w, h, .025, 0, 0, -h, 0)]];
  const lignes = [];
  for (let y = -h + .11; y < -.02; y += .11) lignes.push([-w / 2, y, .014, w / 2, y, .014]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(lignes.flat(), 3));
  assembler(pivot, p, m);
  pivot.add(new THREE.LineSegments(g, m.arete));
  pivot.position.set(0, base + AH - .1, D / 2 + .02);
  return pivot;
}

function toit() {
  const p = [], b = TOIT;
  p.push(['pierre', bloc(W + .1, .14, D + .1, .02, 0, b - .14, 0)]);
  for (const [w, d, x, z] of [[W + .1, .1, 0, -D / 2], [W + .1, .1, 0, D / 2], [.1, D + .1, -W / 2, 0], [.1, D + .1, W / 2, 0]]) p.push(['enduit', bloc(w, .5, d, .02, x, b, z)]);
  // édicule de l'escalier et jardinière
  p.push(['enduit', bloc(1.2, 1, 1, .02, -1.4, b, -1.1)]);
  p.push(['pierre', bloc(1.28, .08, 1.08, .02, -1.4, b + 1, -1.1)]);
  p.push(['cadre', bloc(1.6, .4, .4, .02, 1.1, b, 1.2)]);
  p.push(['feuillage', bloc(1.5, .22, .3, .1, 1.1, b + .4, 1.2)]);
  p.push(['banc', bloc(1.1, .05, .45, .02, .9, b + .38, -.6)]);
  for (const [x, z] of [[.4, -.42], [1.4, -.42], [.4, -.78], [1.4, -.78]]) p.push(['cadre', bloc(.04, .38, .04, 0, x, b, z)]);
  return p;
}

// le socle : une dalle de pierre, une pelouse de chaque côté, l'allée jusqu'à la porte, des arbres
// sculptés, un banc et deux bornes lumineuses
function socle() {
  const p = [['bordure', bloc(12, .34, 7.6, .06, 0, -.34, .4)], ['socle', bloc(11.8, .04, 7.4, .01, 0, -.02, .4)]];
  p.push(['herbe', bloc(3.2, .05, 5.6, .02, -4, 0, .3)], ['herbe', bloc(3.2, .05, 5.6, .02, 4, 0, .3)]);
  p.push(['allee', bloc(1.6, .015, 2.2, .005, 0, .005, D / 2 + 1.1)]);
  const arbre = (x, z, k = 1, cle = 'feuillage') => {
    p.push(['tronc', cyl(.04 * k, .06 * k, 1.1 * k, x, .04, z, 10)]);
    p.push([cle, { ...feuillage(.62 * k, x, .04 + 1.55 * k, z) }]);
  };
  arbre(-4.4, 2.1, 1.05); arbre(-3.7, -1.4, .85, 'feuillage2'); arbre(4.2, -1.6, 1.15, 'feuillage2'); arbre(3.9, 2.3, .9);
  p.push(['banc', bloc(1.2, .06, .4, .02, -3.1, .42, 1)], ['cadre', bloc(1.1, .42, .34, .02, -3.1, 0, 1)]);
  for (const x of [-1.1, 1.1]) p.push(['cadre', cyl(.05, .05, .5, x, 0, D / 2 + 1.9, 12)], ['allumee', cyl(.05, .05, .08, x, .5, D / 2 + 1.9, 12)]);
  return p;
}
// feuillage d'arbre : une boule un peu facettée, aplatie
function feuillage(r, x, y, z) {
  const n = new THREE.IcosahedronGeometry(r, 1).scale(1, 1.15, 1);
  n.deleteAttribute('uv');
  n.translate(x, y, z);
  n.computeVertexNormals();
  return { g: n };
}

// le tracé du relevé, au sol d'un appartement : nus intérieurs des murs, fenêtre, ouverture avant
function trace(mat) {
  const p = [], l = AL / 2 - .06, q = AP / 2 - .06;
  const ligne = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / PAS_TRACE));
    for (let i = 0; i < n; i++) p.push(x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n, x0 + (x1 - x0) * (i + 1) / n, 0, z0 + (z1 - z0) * (i + 1) / n);
  };
  ligne(-l, q, -l, -q); ligne(-l, -q, l, -q); ligne(l, -q, l, q);
  ligne(-l, q, -l + .5, q); ligne(l, q, l - .5, q);
  ligne(-.55, -q + .08, .55, -q + .08);
  // cotes : deux traits fins le long des murs
  ligne(-l + .25, q - .25, l - .25, q - .25);
  ligne(-l + .25, -q + .3, -l + .25, q - .3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.translate(0, .02, 0);
  const lignes = new THREE.LineSegments(g, mat);
  lignes.userData.n = p.length / 6;
  lignes.renderOrder = 2;
  return lignes;
}

// l'intérieur d'un appartement (repère local) : sol, murs peints, plinthes, fenêtre sur le ciel,
// suspension (et, au premier étage, le tracé du relevé). Ses matières sont à lui.
function interieur(def, f) {
  const plein = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });
  const m = {
    mur: plein(def.mur), sol: plein(def.sol), clair: plein('#F7F3EE'), ciel: plein('#CFE0EA', { emissive: '#CFE0EA', emissiveIntensity: .35 }),
    cadre: plein(COULEURS.cadre, { roughness: .45, metalness: .4 }), lampe: plein('#E9D8AE', { emissive: '#F2CF8A', emissiveIntensity: .45 }),
    arete: new THREE.LineBasicMaterial({ color: C.encre, transparent: true, opacity: .1, depthWrite: false })
  };
  const l = AL / 2, q = AP / 2, p = [];
  p.push(['sol', bloc(AL, .02, AP, 0, 0, -.02, 0)]);
  p.push(['mur', bloc(AL, AH, .03, 0, 0, 0, -q + .015)]);
  p.push(['mur', bloc(.03, AH, AP, 0, -l + .015, 0, 0)]);
  p.push(['mur', bloc(.03, AH, AP, 0, l - .015, 0, 0)]);
  p.push(['clair', bloc(AL - .06, .07, .02, 0, 0, 0, -q + .04)]);
  for (const s of [-1, 1]) p.push(['clair', bloc(.02, .07, AP - .06, 0, s * (l - .04), 0, 0)]);
  // fenêtre du fond : ciel, cadre fin, appui
  const fy = .95, fh = 1.15, fl = 1.2, z = -q + .04;
  p.push(['ciel', bloc(fl, fh, .02, 0, 0, fy, z)]);
  for (const [w, h, x, y] of [[fl + .08, .04, 0, fy + fh], [fl + .08, .04, 0, fy - .04], [.04, fh, -(fl + .04) / 2, fy], [.04, fh, (fl + .04) / 2, fy], [.025, fh, 0, fy]]) p.push(['cadre', bloc(w, h, .04, .004, x, y, z + .01)]);
  p.push(['clair', bloc(fl + .16, .04, .12, .01, 0, fy - .08, z + .05)]);
  // suspension (pas dans la pièce brute du relevé)
  if (f > 0) {
    p.push(['cadre', cyl(.004, .004, .6, .3, AH - .6, .1, 6, 50)]);
    p.push(['lampe', cyl(.06, .2, .16, .3, AH - .76, .1, 24)]);
  }
  const groupe = assembler(new THREE.Group(), p, m);
  const releve = f === 0 ? trace(new THREE.LineBasicMaterial({ color: COULEURS.accent, transparent: true, opacity: .95, depthWrite: false })) : null;
  if (releve) groupe.add(releve);
  return { groupe, m, releve };
}

export function construireImmeuble() {
  const m = matieres();
  const groupe = new THREE.Group();
  const base = assembler(new THREE.Group(), socle(), m);
  const rdc = assembler(new THREE.Group(), hall(), m);
  const etages = SOLS.map(b => assembler(new THREE.Group(), etage(b), m));
  const stores = SOLS.map((b, f) => { const s = store(m, b); etages[f].add(s); return s; });
  const sommet = assembler(new THREE.Group(), toit(), m);

  const appartements = ETAGES.map((def, f) => {
    const it = interieur(def, f);
    it.groupe.position.set(0, SOLS[f], 0);
    it.def = def;
    etages[f].add(it.groupe);
    return it;
  });
  groupe.add(base, rdc, ...etages, sommet);

  return {
    groupe, socle: base, rdc, etages, stores, sommet, appartements,
    // store de l'étage f (0 fermé, 1 roulé dans son caisson)
    ouvrir(f, k) {
      const s = stores[f];
      s.scale.y = Math.max(.02, 1 - k);
      s.visible = k < .995;
    },
    // tracé du relevé (0 à 1 : il se dessine ; 1 à 2 : il reste, puis pâlit un peu)
    tracer(k) {
      const r = appartements[0].releve;
      r.visible = k > 0;
      r.geometry.setDrawRange(0, Math.round(Math.min(1, k) * r.userData.n) * 2);
      r.material.opacity = .95 - .45 * borne(k - 1);
    },
    liberer() {
      const vues = new Set(Object.values(m));
      groupe.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => vues.add(x));
      });
      vues.forEach(x => x.dispose());
    }
  };
}
const borne = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
