// L'immeuble jouet de l'accueil : un hall au rez-de-chaussée, deux étages de deux appartements, un toit
// jardin, posés sur une île d'herbe avec ses arbres et ses nuages. La façade avant s'ouvre comme les
// portes d'une maison de poupée (deux battants) et laisse voir les quatre appartements.
// Repères (m) : le sol du hall est à y = 0 ; un appartement mesure AL × AP (x, z), AH de haut.
// Appartements : 0 chiens (1er, gauche), 1 chats (1er, droite), 2 tortues (2e, gauche), 3 lapins (2e, droite).
// Chacun a son groupe (repère local : sol à y = 0, centre de la pièce), ses couleurs et un mode nuit.
import * as THREE from 'three';
import { bloc, cyl, facettes, assembler, C } from './maquette.js';

export const AL = 4.4, AP = 3.6, AH = 2.45, EP = .12;
export const W = 2 * AL + 3 * EP, D = AP + 2 * EP;      // emprise extérieure (9,16 × 3,84 m)
const RDC = 2.5;                                          // hauteur du hall
export const SOLS = [2.6, 5.3];                           // dessus du sol de chaque étage
export const TOIT = 7.95;
export const CENTRES = [-(AL + EP) / 2, (AL + EP) / 2];   // x du centre des appartements (gauche, droite)
const FENETRE = { l: .9, h: 1.1, bas: .9 };
const PAS_TRACE = .06;                                    // longueur d'un brin du relevé (il se trace brin par brin)

export const APPARTEMENTS = [
  { nom: 'chiens', etage: 0, cote: 0, mur: '#FFE3D3', sol: '#F4DDC6', meubles: { canape: '#BFDCC5', tapis: '#FFCFB6', accent: '#F2613F', bois: '#E9C9A6' } },
  { nom: 'chats', etage: 0, cote: 1, mur: '#E7E0FA', sol: '#F3E7DA', meubles: { canape: '#F8CDB9', tapis: '#D5ECD9', accent: '#B4A3EA', bois: '#E9C9A6' } },
  { nom: 'tortues', etage: 1, cote: 0, mur: '#DDEFDF', sol: '#F2E5D2', meubles: { canape: '#FFD9A6', tapis: '#FFE9A6', accent: '#F2613F', bois: '#DDBB98' } },
  { nom: 'lapins', etage: 1, cote: 1, mur: '#FFF1C6', sol: '#F5E2CE', meubles: { canape: '#CFC6EE', tapis: '#FFCFB6', accent: '#F2613F', bois: '#E9C9A6' } }
];
const COULEURS = {
  peche: '#FFD8C2', menthe: '#D2EAD6', lilas: '#E2DBF8', beurre: '#FFEBB5', clair: '#FFFBF6', corail: '#F2613F',
  vitre: '#CFE2F4', allumee: '#FFE6A0', herbe: '#C4E3C9', ile: '#F6D9C4', chemin: '#FFF0C8', feuillage: '#9ECDA9',
  tronc: '#8A6F62', nuage: '#FFFFFF', platre: '#FBF4EC', boite: '#9ECDA9'
};
const NUIT = new THREE.Color('#2B2A4A');

function matieres() {
  const plein = c => new THREE.MeshLambertMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const m = {};
  for (const [k, c] of Object.entries(COULEURS)) m[k] = plein(c);
  m.arete = new THREE.LineBasicMaterial({ color: C.encre, transparent: true, opacity: .16, depthWrite: false });
  return m;
}

// fenêtre sur une face : avant (normale +z, nu à z = nu) ou côté (normale ±x, nu à x = nu)
function fenetre(face, u, y0, nu, { allumee = false, l = FENETRE.l, h = FENETRE.h, jardiniere = false } = {}) {
  const p = [], c = .055, e = .05, s = face === 'gauche' ? -1 : 1;
  const pose = (w, hh, d, du, v0, dn, cle, r = .012) => {
    if (face === 'avant') p.push([cle, bloc(w, hh, d, r, u + du, v0, nu + dn)]);
    else p.push([cle, bloc(w, hh, d, r, nu + s * dn, v0, u + du, Math.PI / 2)]);
  };
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
      const x = face === 'avant' ? u + k * l : nu + s * .14, z = face === 'avant' ? nu + .14 : u + k * l;
      p.push(['feuillage', facettes(.09 + Math.abs(k) * .05, x, y0 - c - .02, z)]);
    }
  }
  return p;
}

// le hall : façade pêche, porte corail sous un auvent, boîtes aux lettres, deux vitrines
function hall() {
  const p = [['peche', bloc(W, RDC, D, .06, 0, 0, 0)], ['clair', bloc(W + .16, .12, D + .16, .04, 0, RDC - .04, 0)]];
  p.push(['corail', bloc(1.1, 2.05, .08, .03, 0, 0, D / 2 + .02)]);
  p.push(['beurre', cyl(.04, .04, .04, .36, 1, D / 2 + .08, 10)]);
  p.push(['clair', bloc(1.7, .1, .55, .03, 0, -.1, D / 2 + .27)]);
  [-2.7, 2.7].forEach((u, i) => p.push(...fenetre('avant', u, .65, D / 2, { l: 1.5, h: 1.3, allumee: i === 1 })));
  // boîtes aux lettres à côté de la porte
  for (const [x, y] of [[-1.05, 1.15], [-.82, 1.15], [-1.05, .92], [-.82, .92]]) p.push(['boite', bloc(.2, .18, .1, .02, x, y, D / 2 + .04)]);
  [-1, 1].forEach(u => p.push(...fenetre('droite', u, .75, W / 2, {})));
  return p;
}

// un étage vu de l'extérieur : murs du fond et des côtés (avec leurs fenêtres), dalle et corniche
function etage(base, couleur) {
  const p = [];
  p.push([couleur, bloc(W, AH + .25, EP, .03, 0, base - .1, -D / 2 + EP / 2)]);
  for (const s of [-1, 1]) {
    p.push([couleur, bloc(EP, AH + .25, D, .03, s * (W / 2 - EP / 2), base - .1, 0)]);
    [-.9, .9].forEach(u => p.push(...fenetre(s < 0 ? 'gauche' : 'droite', u, base + FENETRE.bas, s * W / 2, { jardiniere: s > 0 && u > 0 })));
  }
  // dalle (sol de l'étage, 2 cm sous le parquet des appartements : deux faces à la même hauteur
  // scintilleraient) et mur mitoyen
  p.push(['platre', bloc(W - 2 * EP, .08, D - EP, 0, 0, base - .1, EP / 2)]);
  p.push(['platre', bloc(EP, AH + .02, D - EP, 0, 0, base - .02, EP / 2)]);
  // plafond et corniche en façade
  p.push(['platre', bloc(W - 2 * EP, .15, D - EP, 0, 0, base + AH, EP / 2)]);
  p.push(['clair', bloc(W + .16, .1, D + .16, .04, 0, base + AH + .05, 0)]);
  return p;
}

function toit() {
  const p = [], b = TOIT;
  p.push(['clair', bloc(W + .16, .12, D + .16, .04, 0, b - .12, 0)]);
  for (const [w, d, x, z] of [[W + .16, .14, 0, -D / 2 - .01], [W + .16, .14, 0, D / 2 + .01], [.14, D + .16, -W / 2 - .01, 0], [.14, D + .16, W / 2 + .01, 0]]) p.push(['clair', bloc(w, .3, d, .05, x, b, z)]);
  p.push(['corail', bloc(.5, 1, .5, .08, -3.2, b, -1.05)]);
  p.push(['clair', bloc(.64, .1, .64, .04, -3.2, b + 1, -1.05)]);
  p.push(['tronc', cyl(.016, .016, .9, 3.6, b, -1.25, 6, 50)]);
  p.push(['beurre', cyl(.07, .07, .05, 3.6, b + .9, -1.25, 12)]);
  p.push(['corail', bloc(1.8, .22, .4, .06, 1.2, b, 1.3)]);
  for (const k of [.6, 1.1, 1.6]) p.push(['feuillage', facettes(.17 + (k === 1.1 ? .05 : 0), k, b + .32, 1.3)]);
  p.push(['feuillage', facettes(.34, -1.5, b + .28, 1.05)]);
  p.push(['beurre', cyl(.36, .36, .04, -.2, b, -.6, 24)]);   // petite table de jardin
  return p;
}

function ile() {
  const b = 0, p = [['ile', bloc(13.6, .5, 8.4, .25, 0, b - .5, .3)], ['herbe', bloc(13.3, .07, 8.1, .03, 0, b - .03, .3)], ['chemin', bloc(1.2, .02, 2, .01, 0, b + .04, D / 2 + 1.1)]];
  const arbre = (x, z, k = 1) => {
    p.push(['tronc', cyl(.06 * k, .085 * k, .8 * k, x, b + .04, z, 8)]);
    p.push(['feuillage', facettes(.55 * k, x, b + .04 + 1.15 * k, z)]);
    p.push(['feuillage', facettes(.36 * k, x + .25 * k, b + .04 + 1.55 * k, z - .1 * k)]);
  };
  arbre(-5.6, 2.9, 1); arbre(5.7, -2.6, 1.1); arbre(5.5, 3.1, .85); arbre(-5.8, -2.4, .9);
  for (const [x, z, r] of [[-1.7, 3.3, .26], [1.8, 3.4, .3], [-3.6, 3.8, .22], [3.6, 3.9, .24]]) p.push(['feuillage', facettes(r, x, b + .04 + r * .6, z)]);
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

// un battant de la façade (les deux étages) : pivot à son bord extérieur, il s'ouvre vers l'avant
function battant(m, cote) {
  const s = cote ? -1 : 1, w = W / 2, pivot = new THREE.Group();
  const p = [];
  const cx = s * w / 2;   // centre du battant dans le repère du pivot
  SOLS.forEach((base, i) => {
    const couleur = i ? 'lilas' : 'menthe';
    p.push([couleur, bloc(w, AH + .25, EP, .02, cx, base - .1, -EP / 2)]);
    p.push(['clair', bloc(w + (cote ? 0 : .08), .1, .16, .03, cx, base + AH + .05, 0)]);
    // deux fenêtres par appartement, centrées sur lui
    const centre = s * (w - (AL / 2 + EP));
    [-1.05, 1.05].forEach((u, j) => p.push(...fenetre('avant', centre + u, base + FENETRE.bas, 0, { allumee: (i + j + cote) % 3 === 0, jardiniere: (i + j + cote) % 2 === 1 })));
  });
  // face intérieure : plâtre clair (visible quand le battant est ouvert)
  const dedans = bloc(w - .04, TOIT - SOLS[0] - .2, .02, 0, cx, SOLS[0] - .05, -EP - .012);
  p.push(['platre', dedans]);
  assembler(pivot, p, m);
  pivot.position.set(-s * W / 2, 0, D / 2);
  return pivot;
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
  // la fenêtre du fond, en double trait
  ligne(-.55, -q + .08, .55, -q + .08);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.translate(0, .03, 0);
  const lignes = new THREE.LineSegments(g, mat);
  lignes.userData.n = p.length / 6;
  lignes.renderOrder = 2;
  return lignes;
}

// l'intérieur d'un appartement (repère local) : sol, murs peints, plinthes, fenêtre sur le ciel,
// suspension, tracé du relevé. Ses matières sont à lui (mode nuit).
function interieur(def) {
  const plein = c => new THREE.MeshLambertMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const m = {
    mur: plein(def.mur), sol: plein(def.sol), clair: plein(COULEURS.clair), ciel: plein('#CFE6F7'), corail: plein(COULEURS.corail),
    beurre: plein('#FFE49A'), arete: new THREE.LineBasicMaterial({ color: C.encre, transparent: true, opacity: .14, depthWrite: false })
  };
  const l = AL / 2, q = AP / 2, p = [];
  p.push(['sol', bloc(AL, .02, AP, 0, 0, -.02, 0)]);
  p.push(['mur', bloc(AL, AH, .03, 0, 0, 0, -q + .015)]);
  p.push(['mur', bloc(.03, AH, AP, 0, -l + .015, 0, 0)]);
  p.push(['mur', bloc(.03, AH, AP, 0, l - .015, 0, 0)]);
  // plinthes
  p.push(['clair', bloc(AL - .06, .08, .025, 0, 0, 0, -q + .045)]);
  for (const s of [-1, 1]) p.push(['clair', bloc(.025, .08, AP - .06, 0, s * (l - .045), 0, 0)]);
  // fenêtre du fond : ciel, cadre, croisillon, appui
  const fy = 1, fh = 1.05, fl = 1.1, z = -q + .04;
  p.push(['ciel', bloc(fl, fh, .02, 0, 0, fy, z)]);
  for (const [w, h, x, y] of [[fl + .1, .05, 0, fy + fh], [fl + .1, .05, 0, fy - .05], [.05, fh, -(fl + .05) / 2, fy], [.05, fh, (fl + .05) / 2, fy], [.03, fh, 0, fy], [fl, .03, 0, fy + fh * .55]]) p.push(['clair', bloc(w, h, .04, .01, x, y, z + .01)]);
  p.push(['clair', bloc(fl + .24, .05, .16, .02, 0, fy - .1, z + .07)]);
  // suspension
  p.push(['clair', cyl(.006, .006, .55, .3, AH - .55, .1, 6, 50)]);
  p.push(['beurre', cyl(.12, .22, .2, .3, AH - .72, .1, 20)]);
  const groupe = assembler(new THREE.Group(), p, m);
  // lune et étoile, visibles la nuit derrière la vitre
  const lune = new THREE.Mesh(new THREE.CircleGeometry(.11, 20), new THREE.MeshBasicMaterial({ color: '#FFF4C8', transparent: true, opacity: 0 }));
  lune.position.set(.28, fy + fh * .76, z + .022);
  groupe.add(lune);
  const relevé = trace(new THREE.LineBasicMaterial({ color: COULEURS.corail, transparent: true, opacity: .9, depthWrite: false }));
  groupe.add(relevé);
  return { groupe, m, lune, releve: relevé };
}

export function construireImmeuble() {
  const m = matieres();
  const groupe = new THREE.Group();
  const socle = assembler(new THREE.Group(), ile(), m);
  const rdc = assembler(new THREE.Group(), hall(), m);
  rdc.add(new THREE.Mesh(new THREE.CylinderGeometry(.66, .66, 1.5, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, .7, 1).translate(0, 2.2, D / 2 + .05), m.corail));
  const etages = SOLS.map((base, i) => assembler(new THREE.Group(), etage(base, i ? 'lilas' : 'menthe'), m));
  const sommet = assembler(new THREE.Group(), toit(), m);
  const battants = [battant(m, 0), battant(m, 1)];
  const facade = new THREE.Group();
  facade.add(...battants);

  // les quatre appartements, chacun dans son groupe posé à son étage
  const appartements = APPARTEMENTS.map(def => {
    const it = interieur(def);
    it.groupe.position.set(CENTRES[def.cote], SOLS[def.etage], 0);
    it.def = def;
    // couleurs de jour, pour le mode nuit
    it.jour = Object.fromEntries(Object.entries(it.m).filter(([, x]) => x.color).map(([k, x]) => [k, x.color.clone()]));
    etages[def.etage].add(it.groupe);
    return it;
  });

  const nuages = new THREE.Group();
  nuages.add(nuage(m, -7.4, 6.6, -1.5, 1), nuage(m, 7.6, 4.2, .8, .85), nuage(m, -6.8, 1.8, 2.8, .7), nuage(m, 6.2, 9.4, -2.6, .9));
  groupe.add(socle, rdc, ...etages, sommet, facade, nuages);

  const _c = new THREE.Color();
  return {
    groupe, socle, rdc, etages, sommet, battants, facade, nuages, appartements,
    // ouverture de la façade (0 fermée, 1 grande ouverte) ; un petit rebond est porté par la valeur
    ouvrir(k) {
      const a = k * 2.2;
      battants[0].rotation.y = -a;
      battants[1].rotation.y = a;
    },
    // mode nuit d'un appartement (0 jour, 1 nuit : couleurs assombries, lune derrière la vitre)
    nuit(i, k) {
      const it = appartements[i];
      for (const [cle, base] of Object.entries(it.jour)) it.m[cle].color.copy(base).lerp(_c.copy(NUIT), k * (cle === 'ciel' ? .85 : .62));
      it.lune.material.opacity = k;
    },
    // tracé du relevé (0 à 1) de chaque appartement
    tracer(f) {
      for (const it of appartements) {
        const r = it.releve;
        r.visible = f > 0 && f < 1.999;
        r.geometry.setDrawRange(0, Math.round(Math.min(1, f) * r.userData.n) * 2);
        r.material.opacity = .9 * Math.min(1, 2 - f);
      }
    },
    vivre(t) {
      nuages.children.forEach((n, i) => {
        const b = n.userData.base;
        n.position.set(b.x + Math.sin(t * .12 + i * 2) * .6, b.y + Math.sin(t * .5 + i) * .14, b.z);
      });
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
