/* =================================================================
   RealRoom — modèles fidèles : canapés (d'après les photos produits)
   Origine au sol, centrée, face avant vers +z.
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, V3, clamp, lerp,
  coussin, boudin, tambour, galette, tourne, panneau, formeBandeArc, formeLisse, surArc, rectCoins, matiere, ombreSol, cyl, sphere, pieds, coins,
  matiereCouleurs, rampe
} from './outils.js';

// géométrie d'un canapé en arc : rayons et angles pour une largeur l et une profondeur p
function arcCanape(l, p, e) {
  // rayon moyen choisi pour que la flèche + l'épaisseur donnent la profondeur
  let rm = 2.4;
  for (let i = 0; i < 30; i++) {
    const re = rm + e / 2, a = Math.asin(Math.min(.98, (l / 2 - e / 2) / rm)), ri = rm - e / 2;
    const prof = re - ri * Math.cos(a) + e / 2 * (1 - Math.cos(a));
    rm *= prof > p ? 1.06 : .97;
  }
  const re = rm + e / 2, ri = rm - e / 2, a = Math.asin(Math.min(.98, (l / 2 - e / 2) / rm));
  const zc = (re + ri * Math.cos(a)) / 2;
  return { rm, re, ri, a0: Math.PI / 2 - a, a1: Math.PI / 2 + a, zc };
}

// canapé en arc (Mineral Cloud, Royal Arc…) : socle, accoudoirs pleins, galette, boudin de dossier, coussins
function canapeArc(p, m, o = {}) {
  const g = groupe('canape');
  const [L, D, H] = p.dim;
  const e = Math.min(D, o.e || .95), { re, ri, a0, a1, zc } = arcCanape(L, D, e), rm = (re + ri) / 2, mDos = o.dos || m, mAssise = o.assise || m;
  panneau(g, formeBandeArc(ri + .06, re - .06, a0, a1, -zc), .27, m, 'sol', 0, 0, 0, { a: .09 });
  panneau(g, formeBandeArc(re - .3, re - .05, a0 + .02, a1 - .02, -zc), .3, mDos, 'sol', 0, .2, 0, { a: .05 });
  const da = .27 / rm;
  if (o.bras !== false) {
    panneau(g, formeBandeArc(ri + .06, re - .06, a0, a0 + da, -zc), .46, m, 'sol', 0, 0, 0, { a: .07 });
    panneau(g, formeBandeArc(ri + .06, re - .06, a1 - da, a1, -zc), .46, m, 'sol', 0, 0, 0, { a: .07 });
  }
  const dd = o.bras !== false ? da : .02;
  panneau(g, formeBandeArc(ri + .04, re - .26, a0 + dd, a1 - dd, -zc), .18, mAssise, 'sol', 0, .25, 0, { a: .07 });
  const rA = ri + .11, rD = re - .14, yA = .47, yD = H - .17, pts = [];
  if (o.bras !== false) for (let i = 0; i <= 3; i++) pts.push(surArc(a0 + .06 / rm, lerp(rA, rD - .05, i / 3), yA + (yD - yA) * (i / 3) * .35, zc));
  for (let i = 1; i < 18; i++) { const t = i / 18; pts.push(surArc(lerp(a0, a1, t), rD, yA + (yD - yA) * (.35 + .65 * Math.sin(Math.PI * t)), zc)); }
  if (o.bras !== false) for (let i = 3; i >= 0; i--) pts.push(surArc(a1 - .06 / rm, lerp(rA, rD - .05, i / 3), yA + (yD - yA) * (i / 3) * .35, zc));
  boudin(g, pts, t => .13 + .025 * Math.sin(Math.PI * t), mDos, { plan: true, kv: 1.45, seg: 120, radial: 22, kb: .8 });
  const nc = o.coussins ?? 3;
  for (let i = 0; i < nc; i++) {
    const k = nc > 1 ? (i / (nc - 1) - .5) * 1.04 : 0, an = Math.PI / 2 + k * (a1 - a0) / 2, [x, , z] = surArc(an, rD - .19, 0, zc);
    coussin(g, .44, .4, .16, o.mCoussin || mDos, x, .4, z, { rx: -.3, ry: Math.atan2(-Math.cos(an), Math.sin(an)), ordre: 'YXZ', r: .07, b: [.01, .02, .035] });
  }
  ombreSol(g, L + .4, D + .5);
  return g;
}
// canapé droit : socle, galettes, dossiers, accoudoirs (bras : 'roule', 'plein', 'aucun')
function canapeDroit(p, m, o = {}) {
  const g = groupe('canape');
  const [L, D, H] = p.dim;
  const d = Math.min(D, o.d || 1), hp = o.hp ?? 0, ba = o.bras === 'aucun' ? 0 : (o.lb || .22), sh = o.sh || .44;
  if (o.pieds) pieds(g, coins(L / 2 - .1, d / 2 - .1), hp, o.pieds.m || M('noir'), o.pieds.type || 'droit', { r: .016 });
  coussin(g, L, sh - hp - .13, d, m, 0, hp, 0, { r: o.r ?? .06 });
  const n = o.places || Math.max(2, Math.round((L - 2 * ba) / .8)), l0 = (L - 2 * ba) / n;
  for (let i = 0; i < n; i++) coussin(g, l0 - .02, .15, d - .26, o.assise || m, -L / 2 + ba + l0 * (i + .5), sh - .14, .1, { r: .06, b: [.01, .03, .02] });
  coussin(g, L, H - sh + .1, .22, o.dos || m, 0, sh - .12, -d / 2 + .11, { r: .08 });
  if (o.coussinsDos !== false) for (let i = 0; i < n; i++) coussin(g, l0 - .06, (H - sh) * .8, .15, o.dos || m, -L / 2 + ba + l0 * (i + .5), sh - .02, -d / 2 + .3, { rx: -.18, r: .07, b: [.01, .02, .03] });
  if (ba) [-1, 1].forEach(k => {
    if (o.bras === 'roule') boudin(g, [[k * (L / 2 - ba / 2), sh + .02, -d / 2 + .12], [k * (L / 2 - ba / 2), sh + .04, d / 2 - .12]], ba / 2 + .02, m, { seg: 12, kb: .8 });
    coussin(g, ba, sh + (o.bras === 'roule' ? 0 : .14) - hp, d, m, k * (L / 2 - ba / 2), hp, 0, { r: .07 });
  });
  ombreSol(g, L + .4, d + .4);
  return g;
}
// module matelassé façon Camaleonda : assise carrée bombée en caissons, boudins de dos et d'accoudoir
function moduleMatelasse(g, w, d, m, x, z, o = {}) {
  const h = o.h || .42;
  coussin(g, w - .01, h, d - .01, m, x, 0, z, { r: .1, b: [.02, .04, .02] });
  if (o.dos) boudin(g, [[x - w / 2 + .12, h + .12, z - d / 2 + .13], [x + w / 2 - .12, h + .12, z - d / 2 + .13]], .13, m, { seg: 8, kb: .8 });
  if (o.bras) boudin(g, [[x + o.bras * (w / 2 - .12), h + .08, z - d / 2 + .16], [x + o.bras * (w / 2 - .12), h + .08, z + d / 2 - .1]], .1, m, { seg: 8, kb: .8 });
}

export const CANAPES = {
  /* Mineral Cloud : canapé courbe sans pieds, velours marbré noir, bleu
     et sable ; gros boudin de dossier qui descend en accoudoirs ronds,
     assise épaisse, trois coussins */
  'mcs-01'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('velours', '#2A2C38', { motif: 'mineral', couleurs: ['#15171E', '#383E4E', '#8C7F67', '#BDB094'], echelle: .5 });
    const e = Math.min(D, .95), A = arcCanape(L, D, e);
    const { re, ri, a0, a1, zc } = A, rm = (re + ri) / 2;
    // socle (assise) : bande en arc aux bouts ronds, arêtes très douces
    const bas = .06;
    panneau(g, formeBandeArc(ri + bas, re - bas, a0, a1, -zc), .27, m, 'sol', 0, 0, 0, { a: .09 });
    // remplissage sous le dossier
    panneau(g, formeBandeArc(re - .3, re - .05, a0 + .02, a1 - .02, -zc), .3, m, 'sol', 0, .2, 0, { a: .05 });
    // accoudoirs : pleins jusqu'au sol, bouts ronds
    const da = .27 / rm;
    panneau(g, formeBandeArc(ri + .06, re - .06, a0, a0 + da, -zc), .46, m, 'sol', 0, 0, 0, { a: .07 });
    panneau(g, formeBandeArc(ri + .06, re - .06, a1 - da, a1, -zc), .46, m, 'sol', 0, 0, 0, { a: .07 });
    // coussin d'assise d'un seul tenant entre les accoudoirs
    panneau(g, formeBandeArc(ri + .04, re - .26, a0 + da, a1 - da, -zc), .18, m, 'sol', 0, .25, 0, { a: .07 });
    // boudin du dossier : accoudoir gauche, dos, accoudoir droit
    const rA = ri + .11, rD = re - .14, yA = .47, yD = .63, pts = [];
    for (let i = 0; i <= 3; i++) pts.push(surArc(a0 + .06 / rm, lerp(rA, rD - .05, i / 3), yA + (yD - yA) * (i / 3) * .35, zc));
    for (let i = 1; i < 18; i++) { const t = i / 18; pts.push(surArc(lerp(a0, a1, t), rD, yA + (yD - yA) * (.35 + .65 * Math.sin(Math.PI * t)), zc)); }
    for (let i = 3; i >= 0; i--) pts.push(surArc(a1 - .06 / rm, lerp(rA, rD - .05, i / 3), yA + (yD - yA) * (i / 3) * .35, zc));
    boudin(g, pts, t => .13 + .025 * Math.sin(Math.PI * t), m, { plan: true, kv: 1.45, seg: 120, radial: 22, kb: .8 });
    // trois coussins de dossier, tournés vers le centre de l'arc
    [-.52, 0, .52].forEach((k, i) => {
      const an = Math.PI / 2 + k * (a1 - a0) / 2, [x, , z] = surArc(an, rD - .19, 0, zc);
      coussin(g, .44, .4, .16, m, x, .4, z, { rx: -.3, ry: Math.atan2(-Math.cos(an), Math.sin(an)), ordre: 'YXZ', r: .07, b: [.01, .02, .035] });
    });
    ombreSol(g, L + .4, D + .5);
    return g;
  },
  /* Siena : chenille rouille, long canapé aux dos et accoudoirs en gros boudins galbés, méridienne, coussins blancs */
  'sofa-220'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('chenille', '#9A4A22', { ns: .8 }), d = 1, zb = -D / 2 + d / 2;
    coussin(g, L, .32, d, m, 0, 0, zb, { r: .1, b: [.02, .03, .02] });
    coussin(g, 1, .32, D - d + .1, m, L / 2 - .5, 0, zb + d / 2 + (D - d) / 2 - .05, { r: .12, b: [.02, .03, .02] });
    for (let i = 0; i < 3; i++) coussin(g, (L - .5) / 3 - .02, .17, d - .32, m, -L / 2 + .25 + (L - .5) / 3 * (i + .5), .3, zb + .13, { r: .08, b: [.01, .035, .02] });
    for (let i = 0; i < 3; i++) boudin(g, [[-L / 2 + .3 + (L - .6) / 3 * i + .06, .6, zb - d / 2 + .18], [-L / 2 + .3 + (L - .6) / 3 * (i + 1) - .06, .6, zb - d / 2 + .18]], .19, m, { seg: 10, kb: .9 });
    boudin(g, [[-L / 2 + .17, .48, zb - d / 2 + .22], [-L / 2 + .16, .5, zb + d / 2 - .14]], .18, m, { seg: 10, kb: .9 });
    [-.9, -.2, .5].forEach((x, i) => coussin(g, .42, .4, .13, matiere('boucle', i % 2 ? '#ECE7DC' : '#A85428'), x, .44, zb - .15, { rx: -.3, r: .06 }));
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Cloud Modular : galets de bouclette écrue posés en courbe, dossiers en galets brun foncé */
  'cm-950'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const creme = matiere('boucle', '#E4DCCD'), brun = matiere('boucle', '#4A3428');
    const mods = [[-1.1, .25, .2, 1.0, .8], [-.05, -.1, -.1, 1.15, .85], [1.05, .1, .25, 1.0, .82]];
    mods.forEach(([x, z, a, l, d], i) => {
      const fs = formeLisse([[-l / 2, -d * .3], [-l * .3, -d / 2], [l * .25, -d / 2 + .04], [l / 2, -d * .2], [l / 2 - .04, d * .3], [l * .1, d / 2], [-l * .4, d / 2 - .05]]);
      panneau(g, fs, .4, creme, 'sol', x, 0, z, { a: .12, ry: a });
      const dz = z - Math.cos(a) * d * .3, dx = x - Math.sin(a) * d * .3;
      const b = sphere(g, .36, i === 1 ? creme : brun, dx, .62, dz, 1.15, .72, .42, 22); b.rotation.set(-.25, a, 0, 'YXZ');
    });
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Bouclé Noyer : bouclette écrue, assise longue arrondie, dos bas galbé, coussins, tablette en noyer, pouf rond */
  'com-600'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('boucle', '#E8E0CE'), d = .95, zb = -D / 2 + d / 2;
    coussin(g, L - .3, .32, d, m, .1, 0, zb, { r: .14, b: [.02, .03, .02] });
    coussin(g, L - .5, .14, d - .3, m, .15, .3, zb + .12, { r: .07, b: [.01, .03, .02] });
    boudin(g, [[-L / 2 + .4, .5, zb - d / 2 + .16], [0, .55, zb - d / 2 + .14], [L / 2 - .2, .5, zb - d / 2 + .2]], .16, m, { seg: 30, kb: .9 });
    [-.6, 0, .6].forEach(x => coussin(g, .4, .38, .12, m, x, .44, zb - .15, { rx: -.3, r: .06 }));
    coussin(g, .34, .04, d - .1, matiere('bois', '#5A3A24', { couleurs: ['#6A4630', '#3E2618'] }), -L / 2 + .2, .44, zb, { r: .015 });
    galette(g, .3, .3, .4, matiere('boucle', '#8A7A6C'), L / 2 - .5, 0, D / 2 - .3, { ah: .1 });
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Jungle Edition : grand salon circulaire en velours imprimé jungle autour d'une table ronde noire */
  'cls-je88'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('velours', '#1E2E22', { motif: 'feuillage', couleurs: ['#16241A', '#2E5A2E', '#6A8A3A', '#C04A2A', '#D9A23A', '#3A6A4A'], echelle: .55 });
    const R = Math.min(L, D) / 2 - .05;
    for (let i = 0; i < 3; i++) {
      const a0 = Math.PI / 2 - 1.75 + i * 1.18, a1 = a0 + 1.12;
      panneau(g, formeBandeArc(R - .85, R - .02, a0, a1, 0), .42, m, 'sol', 0, 0, 0, { a: .07 });
      panneau(g, formeBandeArc(R - .26, R, a0, a1, 0), H, m, 'sol', 0, 0, 0, { a: .08 });
    }
    cyl(g, .5, .5, .34, M('noirMat'), 0, 0, .1, 40);
    ombreSol(g, L + .3, D + .3);
    return g;
  },

  /* Modulo : trois modules matelassés, suédine terracotta aux extrémités, crème au centre */
  'canape-modulable-suedine-terracotta-creme'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const t = matiere('velours', '#A85428', { grain: 'carres', echelle: .5, ns: .9 }), c = matiere('velours', '#E2D8C4', { grain: 'carres', echelle: .5, ns: .9 }), w = L / 3;
    moduleMatelasse(g, w, D, t, -w, 0, { dos: true, bras: -1 });
    moduleMatelasse(g, w, D, c, 0, 0, {});
    moduleMatelasse(g, w, D, t, w, 0, { dos: true, bras: 1 });
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Opulence Tactile (vert) : modules matelassés en velours vert sapin et vert d'eau, en L */
  'canap-modulable-vert-collection-opulence-tactile'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const f = matiere('velours', '#1E4A38', { grain: 'carres', echelle: .5, ns: .9 }), c = matiere('velours', '#5E9A82', { grain: 'carres', echelle: .5, ns: .9 }), w = L / 3.4;
    for (let i = 0; i < 3; i++) moduleMatelasse(g, w, w, i === 1 ? c : f, -L / 2 + w * (i + .5), -D / 2 + w / 2, { dos: true, bras: i === 0 ? -1 : 0 });
    moduleMatelasse(g, w, w, c, -L / 2 + w * 3.5, -D / 2 + w / 2, { dos: true, bras: 1 });
    moduleMatelasse(g, w, w, f, -L / 2 + w * 3.5, -D / 2 + w * 1.5, { bras: 1 });
    moduleMatelasse(g, w, w, c, -L / 2 + w * 3.5, -D / 2 + w * 2.5, { bras: 1 });
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Opulence Tactile (pastel) : modules arrondis en bouclette blanche, menthe et anis, dossiers cylindriques */
  'canap-modulable-pastel-collection-opulence-tactile'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const tons = ['#E8E6E0', '#BFD8C8', '#B4C24A', '#CFCFCB'], n = 4, w = L / n;
    tons.forEach((c, i) => {
      const m = matiere('boucle', c), x = -L / 2 + w * (i + .5), z = (i % 2 ? .04 : -.02);
      coussin(g, w - .02, .4, D - .1, m, x, 0, z, { r: .16, b: [.02, .04, .02] });
      boudin(g, [[x - w / 2 + .16, .54, z - D / 2 + .18], [x + w / 2 - .16, .54, z - D / 2 + .18]], .14, matiere('boucle', tons[(i + 1) % n]), { seg: 8, kb: .9 });
    });
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Opulence Discrète : canapé d'angle bas en bouclette écrue, flancs côtelés, coussins carrés */
  'canape-angle-boucle-ecru-opulence-discrete'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('boucle', '#E8E2D4'), cot = matiere('boucle', '#E8E2D4', { grain: 'cannelure', echelle: .25 }), d = 1;
    coussin(g, L, .3, d, cot, 0, 0, -D / 2 + d / 2, { r: .04 });
    coussin(g, 1, .3, D - d, cot, L / 2 - .5, 0, -D / 2 + d + (D - d) / 2, { r: .04 });
    coussin(g, L - .1, .12, d - .25, m, 0, .3, -D / 2 + d / 2 + .1, { r: .05 });
    coussin(g, .9, .12, D - d, m, L / 2 - .5, .3, -D / 2 + d + (D - d) / 2 - .04, { r: .05 });
    coussin(g, L, .38, .2, cot, 0, .3, -D / 2 + .1, { r: .05 });
    coussin(g, .2, .2, d, cot, -L / 2 + .1, .3, -D / 2 + d / 2, { r: .05 });
    [-1.2, -.6, 0, .6].forEach(x => coussin(g, .5, .45, .16, m, x, .4, -D / 2 + .3, { rx: -.22, r: .06 }));
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Dune : long canapé modulable en arc, chenille anthracite, dossiers bas et coussins */
  'smo-210'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('chenille', '#3E3E42', { ns: .9 }), n = 5, R = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - .5) * (L / R) * .9, x = Math.sin(a) * R, z = R - Math.cos(a) * R - D / 2 + .5;
      coussin(g, L / n + .02, .4, D - .05, m, x, 0, z, { r: .1, ry: -a, b: [.02, .03, .02] });
      if (i !== 0) coussin(g, L / n - .05, .26, .22, m, x - Math.sin(a) * .0, .4, z - (D / 2 - .14), { ry: -a, r: .1 });
      coussin(g, .42, .36, .13, m, x + .1, .48, z - D / 2 + .32, { rx: -.3, ry: -a, ordre: 'YXZ', r: .06 });
    }
    ombreSol(g, L + .4, D + .6);
    return g;
  },

  /* Soft Touch : deux places enveloppant en bouclette crème, gros accoudoirs roulés, dos en boudins */
  'lcp-220': p => canapeDroit(p, matiere('boucle', '#ECE6D8'), { bras: 'roule', lb: .26, places: 2, coussinsDos: true }),

  /* Onda : banc bas en cuir chocolat de sept vagues arrondies */
  'cmb-310'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('cuir', '#4B2F21'), n = 7, w = L / n;
    for (let i = 0; i < n; i++) coussin(g, w + .015, H - .02, D, m, -L / 2 + w * (i + .5), .02, 0, { r: Math.min(w * .45, .1), b: [.012, .015, .01] });
    ombreSol(g, L + .3, D + .3);
    return g;
  },

  /* Canapé d'angle arrondi : velours beige sable en arc profond, coussins */
  'bmc-180': p => canapeArc(p, matiere('velours', '#C2AC86'), { e: 1, coussins: 4 }),

  /* Canapé d'angle courbe : assise en jacquard feuillage bleu, dossier rayé */
  'cap-420': p => canapeArc(p, matiere('tissu', '#ECE6DA', { motif: 'floral', couleurs: ['#EAE4D8', '#2E4E8A', '#5E7EB8', '#3A5A3A', '#EAE4D8'], echelle: .5 }),
    { dos: matiere('tissu', '#8A96A8', { motif: 'rayures', couleurs: ['#3E5C8A', '#C9CED6', '#7E8EA8'], echelle: .3 }), coussins: 3 }),

  /* Canapé courbe organique : tissu écru, coussins imprimés */
  'cof-510': p => canapeArc(p, matiere('boucle', '#E6DECE'), { coussins: 3, mCoussin: matiere('tissu', '#E6DECE', { motif: 'floral', couleurs: ['#E6DECE', '#2A2A2C', '#6A6A6A', '#8A7A5A', '#E6DECE'], echelle: .4 }) }),

  /* Canapé modulable bas : banquette arrière incurvée en bouclette écrue et ses traversins,
     galet avant en velours noir moucheté, pouf rectangulaire écru et son coussin moucheté */
  'com-700'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const ecru = matiere('boucle', '#ECE6DA'), tache = matiere('velours', '#1C1C1E', { motif: 'pois-libres', couleurs: ['#1C1C1E', '#E8E6E0', '#8A8A88'], echelle: .4 }), noir = matiere('velours', '#161618');
    const kx = L / 2.4, kz = D / 1.4, P = pts => pts.map(([x, z]) => [x * kx, -z * kz]), Q = (x, y, z) => [x * kx, y, z * kz];
    // banquette arrière : bande incurvée le long du fond
    panneau(g, formeLisse(P([[-1.15, -.1], [-1.0, -.45], [-.55, -.64], [.1, -.7], [.75, -.69], [1.13, -.6], [1.1, -.38], [.6, -.37], [0, -.33], [-.5, -.27], [-.85, -.18], [-1.08, -.04]])), .3, ecru, 'sol', 0, 0, 0, { a: .1 });
    // galet moucheté devant, à gauche
    panneau(g, formeLisse(P([[-1.15, .1], [-.95, -.18], [-.5, -.26], [-.1, -.15], [-.03, .2], [-.2, .55], [-.65, .66], [-1.05, .48]])), .33, tache, 'sol', 0, 0, 0, { a: .11 });
    // pouf rectangulaire écru et son coussin moucheté
    coussin(g, 1.1 * kx, .3, .72 * kz, ecru, .59 * kx, 0, .3 * kz, { r: .14, ry: -.06, b: [.015, .02, .015] });
    coussin(g, .74 * kx, .2, .44 * kz, tache, .6 * kx, .29, .3 * kz, { r: .1, ry: -.06, b: [.02, .04, .02] });
    // traversins : noir sur le galet, écru et noir sur la banquette
    boudin(g, [Q(-.92, .45, -.02), Q(-.38, .47, -.12)], .12, noir, { seg: 8, kb: .9 });
    boudin(g, [Q(-1.03, .42, -.27), Q(-.8, .42, -.5)], .12, ecru, { seg: 8, kb: .9 });
    boudin(g, [Q(-.55, .41, -.5), Q(-.12, .41, -.56)], .11, noir, { seg: 8, kb: .9 });
    ombreSol(g, L + .3, D + .3);
    return g;
  },


  /* Urban Graffiti : grand canapé en U de modules à dossiers arrondis, toile blanche couverte de tags noirs et de nuages orangés */
  'ug-01'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('tissu', '#EEEDE8', { motif: 'graffiti', couleurs: ['#EEEDE8', '#18181A', '#E8924A', '#F4B886', '#9A9A9A'], echelle: 2 }), d = .95, hs = .4, hd = H - hs + .02, ea = .24;
    // rangée de modules le long de x local, dossier à l'arrière (−z local)
    const rang = (x0, z0, ry, long) => {
      const c = groupe(); c.position.set(x0, 0, z0); c.rotation.y = ry; g.add(c);
      const n = Math.max(1, Math.round(long / .9)), w = long / n;
      for (let i = 0; i < n; i++) {
        const x = -long / 2 + w * (i + .5);
        coussin(c, w - .015, hs, d, m, x, 0, 0, { r: .09, b: [.01, .02, .015] });
        coussin(c, w - .015, hd, .24, m, x, hs - .02, -d / 2 + .12, { r: .11, b: [.01, .015, .02] });
      }
    };
    rang(0, -D / 2 + d / 2, 0, L);                                   // fond du U
    const ls = D - d - ea, zm = -D / 2 + d + ls / 2;                  // branches
    rang(-L / 2 + d / 2, zm, Math.PI / 2, ls);
    rang(L / 2 - d / 2, zm, -Math.PI / 2, ls);
    // dossiers des angles et accoudoirs arrondis au bout des branches
    [-1, 1].forEach(k => {
      coussin(g, .24, hd, d - .24, m, k * (L / 2 - .12), hs - .02, -D / 2 + .24 + (d - .24) / 2, { r: .11 });
      coussin(g, d, H - .06, ea, m, k * (L / 2 - d / 2), 0, D / 2 - ea / 2, { r: .11, b: [.01, .02, .015] });
    });
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Cloud Lounge : île de détente en fourrure blanche, dossier en nuage de gros galets */
  'cl-04'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('fourrure', '#EEEDE8', { ns: 2.2 });
    coussin(g, L, .34, D, m, 0, 0, 0, { r: .16, b: [.03, .04, .03] });
    [[-.9, -.55, .34], [-.35, -.65, .4], [.25, -.6, .36], [.8, -.5, .3], [1.1, -.15, .26]].forEach(([x, z, r]) => sphere(g, r, m, x * L / 2.8, .34 + r * .55, z * D / 1.9, 1.1, .8, .9, 20));
    ombreSol(g, L + .3, D + .3);
    return g;
  },

  /* Wave Slim : assise fine sur piètement chromé, accoudoirs en vagues dont l'un remonte en méridienne, coussins rayés */
  'sws-19'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('velours', '#1E7E70'), ray = matiere('tissu', '#888', { motif: 'zebre', couleurs: ['#E8E4DC', '#2A2A2E', '#8A8A88'], echelle: .25 });
    [-1, 1].forEach(k => boudin(g, [[k * (L / 2 - .2), .01, D / 2 - .15], [k * (L / 2 - .2), .2, D / 2 - .15], [k * (L / 2 - .2), .2, -D / 2 + .15], [k * (L / 2 - .2), .01, -D / 2 + .15]], .012, M('chrome'), { tension: 0, seg: 30, radial: 8 }));
    coussin(g, L - .3, .14, D - .1, m, 0, .2, .02, { r: .05 });
    coussin(g, L - .4, .3, .14, m, 0, .32, -D / 2 + .1, { rx: -.15, r: .06 });
    boudin(g, [[-L / 2 + .02, .55, .2], [-L / 2 + .18, .4, .1], [-L / 2 + .3, .36, 0]], .08, m, { haut: [0, 0, 1], kv: 3, seg: 20 });
    boudin(g, [[L / 2 - .02, .72, .1], [L / 2 - .2, .48, 0], [L / 2 - .32, .38, -.05]], .08, m, { haut: [0, 0, 1], kv: 3, seg: 20 });
    [-.5, 0, .5].forEach(x => coussin(g, .45, .4, .13, ray, x, .36, -D / 2 + .25, { rx: -.3, r: .06 }));
    ombreSol(g, L + .3, D + .3);
    return g;
  },


  /* Rainbow Curve : longue assise incurvée en velours peint en dégradé (bleu devant, rouge, rose et
     anis vers le dossier), dossier-coussin en pilule, haut accoudoir arrondi à gauche, accoudoir rose à droite */
  'rcs-12'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const kx = L / 2.6, kz = D, P = pts => pts.map(([x, z]) => [x * kx, -z * kz]);
    const bleu = rampe(['#2C72D8', '#3F9FE6', '#6CC2EE']), chaud = rampe(['#D6A658', '#E0522E', '#E2466C', '#EC82B2', '#D4DA50', '#E8C64A']);
    const rouge = rampe(['#D23A3A', '#DE4896', '#8A52D4', '#2E6ADC']), rose = rampe(['#D8509A', '#EA8ABE']);
    const siege = matiereCouleurs('velours', (x, y, z) => {
      const u = x / kx, b = bleu((u + 1.25) / 2.3), w = chaud((u + .7) / 1.6);
      const t = clamp((-z / kz - .05) / .3, 0, 1) * clamp((u + .5) / .7, 0, 1) * clamp((y - .22) / .2, 0, 1);
      return b.map((v, i) => lerp(v, w[i], t));
    });
    const dos = matiereCouleurs('velours', x => chaud((x / kx + .7) / 1.6));
    const brasG = matiereCouleurs('velours', (x, y) => { const c = rouge((x / kx + 1.3) / .36), h = clamp((y - .5) / .3, 0, 1); return c.map((v, i) => lerp(v, [.86, .3, .22][i], h * .35)); });
    const brasD = matiereCouleurs('velours', (x, y) => rose(y / .6));
    // assise : bande incurvée épaisse sur petits pieds noirs
    panneau(g, formeLisse(P([[-1.27, .1], [-1.12, .36], [-.7, .47], [0, .43], [.5, .33], [.92, .2], [1.0, -.1], [.88, -.36], [.4, -.42], [-.25, -.42], [-.85, -.36], [-1.2, -.2]])), .34, siege, 'sol', 0, .08, 0, { a: .1 });
    [[-1, .25], [-.25, .3], [.55, .15], [.8, -.25], [-.6, -.25], [.15, -.3]].forEach(([x, z]) => cyl(g, .022, .022, .08, M('noirMat'), x * kx, 0, z * kz, 10));
    // dossier en pilule le long du fond
    coussin(g, 1.42 * kx, .36, .24, dos, .08 * kx, .4, -.33 * kz, { r: .12, rx: -.1, b: [.01, .02, .03] });
    // haut accoudoir-dossier gauche (profil en pierre tombale) et accoudoir rose à droite
    panneau(g, rectCoins(.62 * kz, .78, [.04, .04, .3, .3]), .32 * kx, brasG, 'cote', -1.12 * kx, .06 + .39, -.1 * kz, { a: .07 });
    coussin(g, .3 * kx, .52, .56 * kz, brasD, 1.12 * kx, .06, -.08 * kz, { r: .14, b: [.01, .02, .01] });
    ombreSol(g, L + .3, D + .3);
    return g;
  },


  /* Art Line : canapé d'angle modulaire en bouclé blanc dessiné au trait noir, quelques aplats rouges, ocre et bleus,
     méridienne à gauche, retour à droite, pouf carré */
  'als-02'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('boucle', '#EEECE6', { motif: 'popart', couleurs: ['#EEECE6', '#1A1A1C', '#EEECE6', '#EEECE6', '#C8302A', '#EEECE6', '#D89A4A', '#EEECE6', '#E8B840'], echelle: 1 }), d = 1, hs = .4;
    const n = 3, w = L / n;
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + w * (i + .5);
      coussin(g, w - .02, hs, d, m, x, 0, -D / 2 + d / 2, { r: .1, b: [.01, .02, .015] });
      coussin(g, w - .02, H - hs + .02, .26, m, x, hs - .02, -D / 2 + .13, { r: .12, b: [.01, .015, .02] });
    }
    coussin(g, w - .02, hs, D - d - .02, m, -L / 2 + w / 2, 0, -D / 2 + d + (D - d) / 2 - .1, { r: .1, b: [.01, .02, .015] });     // méridienne
    coussin(g, w - .02, hs, D - d - .02, m, L / 2 - w / 2, 0, -D / 2 + d + (D - d) / 2 - .1, { r: .1, b: [.01, .02, .015] });      // retour
    coussin(g, .26, H - hs + .02, D - .28, m, L / 2 - .13, hs - .02, -D / 2 + .26 + (D - .28) / 2 - .1, { r: .12 });                  // dossier du retour
    coussin(g, .72, .38, .72, m, -.05, 0, D / 2 - .38, { r: .14, ry: .12, b: [.02, .04, .02] });                                     // pouf
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Cocoon : grands modules en fausse fourrure grise côtelée, coussins */
  'tfe-11'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('fourrure', '#8E8E8C', { grain: 'lignes', echelle: .5, ns: 1.4 }), d = 1.1;
    coussin(g, L, .38, d, m, 0, 0, -D / 2 + d / 2, { r: .12 });
    coussin(g, d, .38, D - d, m, L / 2 - d / 2, 0, -D / 2 + d + (D - d) / 2, { r: .12 });
    coussin(g, L, .32, .3, m, 0, .36, -D / 2 + .15, { r: .13 });
    [-1, -.3, .4].forEach(x => coussin(g, .6, .45, .18, m, x, .42, -D / 2 + .38, { rx: -.3, r: .08 }));
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Botanica : modules en bouclette vert olive en L, dossiers bas, pouf imprimé floral surmonté d'une boule */
  'bml-01'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('boucle', '#6A7438'), fl = matiere('tissu', '#5A6A4A', { motif: 'feuillage', couleurs: ['#3A4A3A', '#8A9A6A', '#D8D2C0', '#6A7A5A', '#B0A88A'], echelle: .4 }), d = 1;
    coussin(g, L, .42, d, m, 0, 0, -D / 2 + d / 2, { r: .08 });
    coussin(g, d, .42, D - d, m, L / 2 - d / 2, 0, -D / 2 + d + (D - d) / 2, { r: .08 });
    coussin(g, L - d, .26, .22, m, -d / 2, .4, -D / 2 + .11, { r: .08 });
    coussin(g, .22, .26, D, m, L / 2 - .11, .4, 0, { r: .08 });
    coussin(g, .7, .36, .7, fl, -.6, 0, D / 2 - .4, { r: .14, b: [.02, .04, .02] });
    sphere(g, .14, matiere('boucle', '#EEEAE0'), -.6, .44, D / 2 - .4);
    ombreSol(g, L + .4, D + .4);
    return g;
  },


  /* Prismatic : modules bas en bouclé blanc peint de grands dessins au trait noir et d'aplats ocre, rouges,
     bleus et roses ; rouleaux de dossier, deux méridiennes (vue de dessus en « F ») */
  'pma-01'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('boucle', '#EEECE6', { motif: 'popart', couleurs: ['#EEECE6', '#1A1A1C', '#D88A2A', '#C8282A', '#EEECE6', '#2A4AA8', '#E8A0A0', '#EEECE6'], echelle: .9 });
    const kx = L / 3.2, kz = D / 2.22, hs = .4;
    const bloc = (x0, x1, z0, z1, h, r) => coussin(g, (x1 - x0) * kx - .015, h, (z1 - z0) * kz - .015, m, (x0 + x1) / 2 * kx, 0, (z0 + z1) / 2 * kz, { r, b: [.012, .02, .012] });
    // rouleaux de dossier, posés au sol derrière les assises
    [[-1.6, -.88], [-.86, -.1], [-.06, .7], [.7, 1.6]].forEach(([x0, x1]) => bloc(x0, x1, -1.11, -.8, H, .13));
    bloc(-1.6, -.88, -.8, .53, hs, .1);            // méridienne gauche
    bloc(-.86, -.1, -.8, -.12, hs, .1);            // assises
    bloc(-.06, .7, -.8, -.12, hs, .1);
    bloc(.7, 1.6, -.8, 1.11, hs, .1);              // méridienne droite
    ombreSol(g, L + .4, D + .4);
    return g;
  },

  /* Canapé outdoor teck et corde : bâti en teck, flancs et dos en corde tressée vert de gris, coussins gris */
  'canape-3-places-outdoor-en-teck-et-tissage-corde'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const teck = matiere('bois', '#9C6B42', { couleurs: ['#A87850', '#7A4E2E'] }), corde = matiere('tissu', '#5E665C', { grain: 'chenille', echelle: .08, ns: 1.2 }), gris = matiere('tissu', '#A3A198');
    coins(L / 2 - .05, D / 2 - .06).forEach(([x, z]) => place(g, mesh(new THREE.BoxGeometry(.05, .62, .05), teck), x, .31, z));
    [-1, 1].forEach(k => { place(g, mesh(new THREE.BoxGeometry(.07, .03, D), teck), k * (L / 2 - .05), .62, 0); coussin(g, .04, .34, D - .14, corde, k * (L / 2 - .05), .26, 0, { r: .015 }); });
    place(g, mesh(new THREE.BoxGeometry(L - .1, .05, D - .1), teck), 0, .2, 0);
    coussin(g, L - .1, .4, .04, corde, 0, .3, -D / 2 + .06, { rx: -.1, r: .015 });
    coussin(g, L - .14, .14, D - .16, gris, 0, .23, .04, { r: .05 });
    [-.6, 0, .6].forEach((x, i) => coussin(g, .55, .44, .14, i === 1 ? matiere('tissu', '#9AA4B8') : matiere('tissu', '#D8A8A8'), x, .36, -D / 2 + .16, { rx: -.2, r: .06 }));
    ombreSol(g, L + .4, D + .4);
    return g;
  },


  /* Canapé 9733 : trois modules en tissu chiné beige (socles, assises, coussins de dos), coussin central et
     accoudoirs drapés en patchwork tissé rouille, bleu canard et gris, pieds en coin brun foncé */
  'canape-3-places-outdoor-contemporain-tissu-chine-et-motifs-geometriques-9733'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const beige = matiere('tissu', '#D4CBB8', { motif: 'chine', couleurs: ['#D4CBB8', '#ECE6DA', '#A89E8A', '#8A8272'], echelle: .15 });
    const patch = matiere('tissu', '#8A5A3A', { motif: 'patchwork', couleurs: ['#A8552E', '#C8743A', '#6A7A88', '#3E6A6E', '#6A4030', '#C8B8A0', '#8A3A2A'], echelle: .5 });
    const brun = matiere('cuir', '#3A2A20'), lb = .26, ls = L - 2 * lb, n = 3, w = ls / n;
    coussin(g, ls, .52, .2, beige, 0, .08, -D / 2 + .1, { r: .06 });                                   // dossier fixe
    for (let i = 0; i < n; i++) {
      const x = -ls / 2 + w * (i + .5);
      coussin(g, w - .01, .2, D - .08, beige, x, .06, .03, { r: .05, b: [.005, .01, .005] });           // socle
      coussin(g, w - .02, .17, D - .3, beige, x, .26, .1, { r: .07, b: [.01, .03, .02] });            // assise
      coussin(g, w * .64, .48, .17, i === 1 ? patch : beige, x, .4, -D / 2 + .3, { rx: -.22, r: .07, b: [.01, .02, .035] });
      [-1, 1].forEach(k => place(g, mesh(new THREE.BoxGeometry(.12, .06, .12), brun), x + k * (w / 2 - .16), .03, D / 2 - .16));
    }
    [-1, 1].forEach(k => {
      const x = k * (L / 2 - lb / 2);
      coussin(g, lb, .6, D, patch, x, .05, 0, { r: .12, b: [.01, .02, .012] });                        // accoudoir drapé
      place(g, mesh(new THREE.BoxGeometry(lb - .04, .05, D - .1), brun), x, .025, 0);
      [-1, 1].forEach(s => panneau(g, formeLisse([[-.08, 0], [.08, 0], [.012, .27], [-.012, .27]], 24), .03, brun, 'face', x, .02, s * (D / 2 + .004), { a: .006 }));
    });
    ombreSol(g, L + .4, D + .4);
    return g;
  },


  /* Canapé modulaire multicolore : module en velours côtelé blanc à accoudoir, module imprimé tropical sur fond crème,
     module en velours côtelé moutarde à accoudoir ; coussins et traversin rayé bleu */
  'canape-3-places-modulaire-multicolore-et-tissu-texture'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const blanc = matiere('cotele', '#E6E3DA', { echelle: .2 }), moutarde = matiere('cotele', '#B8862A', { echelle: .15 });
    const tropical = matiere('tissu', '#D6D2C8', { motif: 'feuillage', couleurs: ['#D6D2C8', '#2A3A4E', '#6E8094', '#94704E', '#1E2632', '#BFAE8E', '#4E5E52', '#2A3A4E'], echelle: .9 });
    const mats = [blanc, tropical, moutarde], w = L / 3;
    mats.forEach((m, i) => {
      const x = -L / 2 + w * (i + .5);
      coussin(g, w - .01, .24, D, m, x, 0, 0, { r: .06 });                                            // socle
      coussin(g, w - .03, .2, D - .26, m, x, .23, .1, { r: .08, b: [.01, .035, .02] });               // assise
      coussin(g, w - .03, H - .2, .26, m, x, .2, -D / 2 + .13, { rx: -.06, r: .12 });                 // dossier
      if (i !== 1) { const k = i ? 1 : -1; coussin(g, .26, .34, D - .06, m, x + k * (w / 2 - .13), .22, .02, { r: .11 }); }
    });
    coussin(g, .45, .42, .14, moutarde, -L / 2 + w * .62, .42, -D / 2 + .36, { rx: -.3, r: .06 });
    coussin(g, .6, .26, .2, blanc, -L / 2 + w * .32, .42, -D / 2 + .42, { rx: -.35, ry: .25, ordre: 'YXZ', r: .09 });
    coussin(g, .42, .4, .13, matiere('tissu', '#ECEAE4'), L / 2 - w * .55, .42, -D / 2 + .34, { rx: -.3, r: .06 });
    boudin(g, [[L / 2 - .2, .64, -.18], [L / 2 - .2, .64, .28]], .085, matiere('tissu', '#3050A0', { motif: 'rayures', couleurs: ['#2A4AA8', '#F0EEE8'], echelle: .25 }), { seg: 8 });
    ombreSol(g, L + .4, D + .4);
    return g;
  },


  /* Canapé d'angle 2603 : méridienne à gauche et coussins en tissu à feuilles rondes vertes, assises et hauts
     coussins de dos en bouclette blanche, accoudoirs bas en cuir vert olive */
  'canape-dangle-modulaire-design-2603-avec-meridienne-et-tissu-boucle'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const blanc = matiere('boucle', '#E8E4DA'), olive = matiere('cuir', '#4A5230');
    const fl = matiere('tissu', '#8A9A6A', { motif: 'pastilles', couleurs: ['#E2E0CE', '#6E8A4A', '#8AA45E', '#55703A', '#A8BC80'], echelle: .6 });
    const d = Math.min(1, D - .55), la = .3, lm = .95, x0 = -L / 2 + la, x1 = x0 + lm, zb = -D / 2 + d / 2;
    coussin(g, la, .58, d, olive, -L / 2 + la / 2, 0, zb, { r: .12, b: [.01, .02, .01] });            // accoudoir gauche
    coussin(g, la, .58, d, olive, L / 2 - la / 2, 0, zb, { r: .12, b: [.01, .02, .01] });             // accoudoir droit
    coussin(g, L - 2 * la, .32, .22, blanc, 0, .4, -D / 2 + .11, { r: .08 });                          // dossier bas
    coussin(g, lm - .01, .42, D, fl, (x0 + x1) / 2, 0, 0, { r: .08, b: [.01, .03, .015] });             // méridienne
    coussin(g, lm - .08, .5, .2, fl, (x0 + x1) / 2, .42, -D / 2 + .3, { rx: -.16, r: .1, b: [.01, .02, .03] });
    const n = 2, w = (L / 2 - la - x1) / n;
    for (let i = 0; i < n; i++) {
      const x = x1 + w * (i + .5);
      coussin(g, w - .01, .42, d, blanc, x, 0, zb, { r: .08, b: [.01, .03, .015] });
      coussin(g, w - .06, .52, .2, blanc, x, .42, -D / 2 + .3, { rx: -.16, r: .1, b: [.01, .02, .03] });
      coussin(g, .44, .4, .13, fl, x + (i ? .25 : -.3), .44, -D / 2 + .44, { rx: -.3, r: .06 });
    }
    ombreSol(g, L + .4, D + .4);
    return g;
  }
};
