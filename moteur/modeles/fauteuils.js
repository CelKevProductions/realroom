/* =================================================================
   RealRoom — modèles fidèles : fauteuils (d'après les photos produits)
   Origine au sol, centrée, face avant vers +z.
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, V3, clamp, lerp,
  coussin, boudin, tambour, galette, geoTambour, tourne, panneau, coqueArc, coqueParam, geoCoqueParam, bordCoque, planU, rectCoins, formeLisse, bosseler,
  matiere, ombreSol, cyl, sphere, pieds, coins, pivot, boutons
} from './outils.js';

const lisse = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// coussin tourné vers le centre (x, z) → (cx, cz), incliné en arrière de rx
const versCentre = (x, z, cx = 0, cz = 0) => Math.atan2(cx - x, cz - z);

// fauteuil « pince » (Crab, Taupe Drop) : bras épais qui partent du dos et retombent jusqu'au
// sol en pointe vers l'avant, dossier droit rapporté au centre, galette ; dessous sombre
function pince(p, coque, dossier, dedans) {
  const g = groupe('fauteuil');
  const [W, D, H] = p.dim;
  coussin(g, W - .4, .26, D - .3, dedans, 0, 0, .02, { r: .05 });
  coussin(g, W - .34, .14, D - .28, coque, 0, .25, .06, { r: .06, b: [.01, .03, .02] });
  [-1, 1].forEach(k => boudin(g, [[0, .5, -D / 2 + .16], [k * (W / 2 - .22), .53, -D / 2 + .17], [k * (W / 2 - .12), .46, -.05], [k * (W / 2 - .1), .3, D / 2 - .2], [k * (W / 2 - .14), .05, D / 2 - .07]],
    t => .13 - .07 * t * t, coque, { seg: 60, radial: 18, kb: .6 }));
  coussin(g, W * .42, H - .3, .14, dossier, 0, .3, -D / 2 + .17, { rx: -.16, r: .07, b: [.01, .02, .03] });
  ombreSol(g, W + .3, D + .3);
  return g;
}

// pieds galbés (cabriole) dorés : courbe en S, petit sabot
function piedsGalbes(g, pos, h, m, r = .022) {
  pos.forEach(([x, z]) => {
    const kx = Math.sign(x) || 1, kz = Math.sign(z) || 1;
    boudin(g, [[x, h, z], [x + kx * .025, h * .62, z + kz * .03], [x - kx * .005, h * .3, z - kz * .005], [x + kx * .03, .03, z + kz * .035]], t => r * (1 - .45 * t), m, { seg: 24, radial: 10, kb: .5 });
    sphere(g, r * .75, m, x + kx * .032, r * .7, z + kz * .038, 1.2, .8, 1.2, 10);
  });
}
// coquillage (Arc-en-Ciel, Coquille Royale) : pétales en boudins qui rayonnent derrière une galette ronde
function coquillage(p, couleurs, o = {}) {
  const g = groupe('fauteuil');
  const [W, D, H] = p.dim;
  const n = o.n || 11, R = W / 2 - .1, mats = couleurs.map(c => matiere('velours', c));
  if (o.socle) tourne(g, [[0, 0], [.26, 0], [.25, .03], [.1, .1], [.08, .26], [0, .26]], o.socle, 0, 0, 0, 40);
  else pivot(g, .28, .24, M('chrome'));
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - .5) * Math.PI * 1.08, sx = Math.sin(a), cz = Math.cos(a);
    const rr = o.large ? .12 : .085;
    boudin(g, [[sx * .12, .34, -cz * .08 + .02], [sx * R * .55, .5, -cz * R * .55 * .8], [sx * R * .92, H - .2 * (1 - cz), -cz * R * .8], [sx * R * .95, H - .05 - .22 * (1 - cz), -cz * R * .6]],
      t => rr * (.7 + .5 * Math.sin(Math.PI * Math.min(1, t * 1.1))), mats[i % mats.length], { seg: 28, radial: 14, kb: .9 });
  }
  galette(g, W / 2 - .2, D / 2 - .16, .16, mats[o.siege ?? 0], 0, .26, .1, { ah: .07, dome: .02 });
  ombreSol(g, W + .3, D + .3);
  return g;
}
// beignet (Torus, Boa) : anneau rembourré posé au sol
function beignet(p, m) {
  const g = groupe('fauteuil');
  const [W, D, H] = p.dim;
  const r = H / 2 / 1.15, R = Math.min(W, D) / 2 - r * .95, pts = [];
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; pts.push([Math.cos(a) * R, H / 2, Math.sin(a) * R]); }
  boudin(g, pts, r, m, { ferme: true, plan: true, kv: 1.15, seg: 80, radial: 24 });
  ombreSol(g, W + .2, D + .2);
  return g;
}
// fauteuil à oreilles : caisse, assise, coque haute en U (dehors / dedans), accoudoirs roulés
function oreilles(p, o) {
  const g = groupe('fauteuil');
  const [W, D, H] = p.dim;
  const ext = o.ext, int = o.int || o.ext, hp = o.hp ?? .17;
  if (o.pieds === 'galbes') piedsGalbes(g, coins(W / 2 - .1, D / 2 - .1), hp + .02, o.mp || M('or'));
  else pieds(g, coins(W / 2 - .1, D / 2 - .1), hp + .01, o.mp || M('laiton'), o.pieds || 'compas', { r: .014, ecart: .12 });
  coussin(g, W - .08, .2, D - .1, ext, 0, hp, .03, { r: .06 });
  coussin(g, W - .28, .12, D - .28, int, 0, hp + .19, .08, { r: .05, b: [.01, .025, .015] });
  const forme = d => (u, t) => {
    const s = u * 2 - 1, [x, z] = planU(u, W / 2 - .05 + .03 * t - d, D * .36 - d, o.av ?? .12, -.02);
    const top = lerp(o.hBras || .64, H - d * .4, Math.pow(lisse(0, .75, 1 - Math.abs(s)), .7));
    return [x, hp + .15 + t * (top - hp - .15), z];
  };
  coqueParam(g, forme(0), ext, { ep: .05, nu: 44, nt: 14, cz: -.02 });
  coqueParam(g, forme(.05), o.dossier || int, { ep: .06, nu: 44, nt: 14, cz: -.02 });
  bordCoque(g, forme(.025), .02, ext, { cz: -.02, r: .035 });
  [-1, 1].forEach(k => {
    coussin(g, .11, .33, D * .62, ext, k * (W / 2 - .07), hp + .15, .08, { r: .05 });
    boudin(g, [[k * (W / 2 - .07), .63, -.08], [k * (W / 2 - .065), .63, D / 2 - .1], [k * (W / 2 - .045), .6, D / 2 - .05]], .062, int, { seg: 16, kb: .5 });
  });
  ombreSol(g, W + .3, D + .3);
  return g;
}
// tonneau : coque en U (dehors / dedans), caisse et galette ; o.bras : hauteur des bras devant
function tonneau(p, o) {
  const g = groupe('fauteuil');
  const [W, D, H] = p.dim;
  const ext = o.ext, int = o.int || o.ext, hp = o.hp ?? .14;
  if (o.pieds === 'galbes') piedsGalbes(g, coins(W / 2 - .1, D / 2 - .1), hp + .02, o.mp || M('or'));
  else if (o.pieds) pieds(g, coins(W / 2 - .1, D / 2 - .1), hp + .02, o.mp || M('laiton'), o.pieds, { r: .018 });
  const forme = d => (u, t) => {
    const s = u * 2 - 1, phi = s * (o.tour || 1.85), a = W / 2 - .02 - d, b = D / 2 - .02 - d, k = 1 + (o.evase ?? .06) * t;
    const top = H - d * .3 - (H - (o.bras || H - .1)) * Math.pow(Math.abs(s), 2.4);
    return [a * k * Math.sin(phi), hp + t * (top - hp), .04 - b * k * Math.cos(phi)];
  };
  coqueParam(g, forme(0), ext, { ep: .04, nu: 60, nt: 12, cz: .04 });
  coqueParam(g, forme(.04), o.dossier || int, { ep: .05, nu: 60, nt: 12, cz: .04 });
  bordCoque(g, forme(.03), .02, ext, { cz: .04, r: .03 });
  // assise inscrite dans la coque (galettes ovales : rien ne la traverse)
  const a = W / 2 - .03, b = D / 2 - .03;
  galette(g, a * .97, b * .95, .17, ext, 0, hp, .04, { ah: .05, ab: .02 });
  galette(g, a * .86, b * .82, .13, o.galette || int, 0, hp + .16, .07, { ah: .06, dome: .015 });
  ombreSol(g, W + .3, D + .3);
  return g;
}

export const FAUTEUILS = {
  /* Terracotta : velours rouille, dossier de trois bourrelets empilés en
     fer à cheval qui deviennent les accoudoirs, grosse assise, socle noir */
  terracotta(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#9C3F17');
    coussin(g, W * .72, .055, D * .6, M('noirMat'), 0, 0, -.03, { r: .02, b: [0, 0, 0] });
    const n = 3, y0 = .05, rv = (H - y0) / (2 * n) * 1.02, rh = .118;
    const a = W / 2 - rh, zb = -D / 2 + rh, zc = -.04, bz = zc - zb, zf = D / 2 - rh * .95;
    for (let k = 0; k < n; k++) {
      const y = y0 + rv * (1 + 2 * k) * .97, pts = [];
      // bras gauche (de l'avant vers l'arrière), dos en demi-ellipse, bras droit
      for (let i = 0; i <= 4; i++) pts.push([-a, y, lerp(zf, zc, i / 4)]);
      for (let i = 1; i < 16; i++) { const t = Math.PI + i / 16 * Math.PI; pts.push([a * Math.cos(t), y, zc + bz * Math.sin(t)]); }
      for (let i = 0; i <= 4; i++) pts.push([a, y, lerp(zc, zf, i / 4)]);
      boudin(g, pts, rh, m, { plan: true, kv: rv / rh, seg: 90, radial: 22, kb: .55 });
    }
    // bouts des accoudoirs : un seul volume vertical arrondi, du sol au sommet
    [-1, 1].forEach(k => coussin(g, rh * 2, H - .045, .2, m, k * a, .03, zf - .035, { r: .095, b: [.01, .01, .02] }));
    // assise : un gros coussin entre les bras, glissé sous le dossier
    const li = 2 * (a - rh) + .03, zA = zb + rh * .4, zF = D / 2 - .035;
    coussin(g, li, .4, zF - zA, m, 0, y0, (zA + zF) / 2, { r: .09, b: [.008, .035, .03] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Abbraccio : assise tambour en cuir vert sauge pâle, coque de dossier
     à trois couches (cuir dedans, liseré laiton, galets beige dehors),
     coussin lombaire */
  abbraccio(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#A0A395'), galets = matiere('cuir', '#ADA28C', { grain: 'galets', echelle: .26, ns: 1.2 });
    const r = Math.min(W, D) / 2 - .04, hs = .46, zc = .035;
    tambour(g, r, hs, cuir, 0, 0, zc, { b: .028, ah: .085, ab: .035, dome: .012, seg: 56 });
    const R0 = r + .014, span = 3.25;
    coqueArc(g, R0, R0 + .026, span, H - .01, cuir, 0, 0, zc, .011);
    coqueArc(g, R0 + .026, R0 + .033, span + .004, H - .002, M('laiton'), 0, 0, zc, .003);
    coqueArc(g, R0 + .033, R0 + .066, span - .01, H - .006, galets, 0, 0, zc, .014);
    coussin(g, .44, .27, .12, cuir, 0, hs + .03, zc - R0 + .11, { rx: -.2, r: .05, b: [.008, .02, .028] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Terra : velours framboise, flancs pleins jusqu'au sol, assise
     suspendue entre les flancs, coussins d'assise et de dossier à liseré sombre */
  'fauteuil-velours-terracotta-pietement-plein-terra'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#86302C'), lis = matiere('velours', '#5A1A17');
    const ep = .1, hb = .62, zd = -D / 2 + .1;
    // flancs : dalles épaisses arrondies, posées au sol
    // légèrement ouverts vers l'avant, le dessus roulé
    [-1, 1].forEach(k => coussin(g, ep, hb, D - .04, m, k * (W / 2 - ep / 2 - .015), 0, 0, { r: .048, b: [.012, .012, .006], ry: -k * .07 }));
    // dos : rejoint les flancs (fer à cheval vu de dessus)
    coussin(g, W - .02, hb - .2, .13, m, 0, .2, zd, { r: .05, b: [.004, .01, .012] });
    // caisse d'assise flottante et coussins
    const li = W - 2 * ep;
    coussin(g, li + .01, .13, D - .2, m, 0, .2, .04, { r: .04 });
    const ya = .33, za = .05, da = D - .24;
    coussin(g, li - .02, .12, da, m, 0, ya, za, { r: .045, b: [.006, .02, .01] });
    passepoil(g, [[-li / 2 + .02, ya + .118, za + da / 2 - .005], [li / 2 - .02, ya + .118, za + da / 2 - .005]], lis);
    passepoil(g, [[-li / 2 + .02, ya + .005, za + da / 2 - .005], [li / 2 - .02, ya + .005, za + da / 2 - .005]], lis);
    const cd = coussin(g, li - .05, .43, .14, m, 0, ya + .1, zd + .14, { rx: -.13, r: .06, b: [.008, .02, .03] });
    // liseré tout autour du coussin de dossier (dans son repère)
    const s = groupe(); s.position.copy(cd.position); s.rotation.copy(cd.rotation); g.add(s);
    const lw = (li - .05) / 2 - .03, lh = .43 / 2 - .03;
    passepoil(s, [[-lw, -lh, .075], [lw, -lh, .075], [lw + .025, 0, .075], [lw, lh, .075], [-lw, lh, .075], [-lw - .025, 0, .075], [-lw, -lh, .075]], lis);
    ombreSol(g, W + .3, D + .3);
    return g;
  },
  /* Bubble Art : nid rond en bouclette imprimée de coups de pinceau noirs,
     bourrelet tout autour (plus haut derrière), coussins libres, tablette ronde */
  'bubble-art'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#ECE9E2', { motif: 'traits', couleurs: ['#E4E2DC', '#2A2A2E', '#86868A'], echelle: .75 });
    const R = Math.min(W, D) / 2 - .02;
    tambour(g, R * .7, .06, M('noirMat'), 0, 0, 0, { ah: .01, ab: .004 });
    tambour(g, R - .05, .36, m, 0, .05, 0, { b: .04, ah: .12, ab: .06 });
    const pts = [];
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, k = .5 + .5 * Math.cos(a); pts.push([(R - .15) * Math.sin(a), lerp(.42, H - .16, k), -(R - .15) * Math.cos(a)]); }
    boudin(g, pts, .16, m, { ferme: true, plan: true, seg: 96, radial: 20 });
    tambour(g, R - .24, .1, m, 0, .36, .04, { ah: .05, dome: .02 });
    [-.95, -.35, .3, .9].forEach((a, i) => {
      const x = Math.sin(a) * (R - .36), z = -Math.cos(a) * (R - .36);
      coussin(g, .44, .42, .15, m, x, .44, z, { rx: -.35, ry: versCentre(x, z), ordre: 'YXZ', r: .07, b: [.01, .02, .035] });
    });
    // tablette ronde sur tige noire, à gauche
    cyl(g, .17, .17, .022, matiere('bois', '#3A2A20', { couleurs: ['#46322A', '#2A1C16'] }), -R - .08, .55, .18, 40);
    boudin(g, [[-R - .08, .55, .18], [-R - .06, .42, .15], [-R + .02, .3, .1], [-R + .12, .25, .06]], .012, M('noir'), { seg: 20, radial: 8 });
    ombreSol(g, W + .4, D + .4);
    return g;
  },

  /* Classica : bouclette écrue, flancs en bois cintré laqué noir formant
     une boucle (patin, montant avant, accoudoir), haut dossier incliné */
  classica(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#E8E4D8'), bois = matiere('laque', '#1C1A1D', { rough: .35 });
    const x0 = W / 2 - .035;
    [-1, 1].forEach(k => boudin(g, [[k * x0, .022, D / 2 - .16], [k * x0, .05, D / 2 - .05], [k * x0, .3, D / 2 - .03], [k * x0, .55, D / 2 - .12], [k * x0, .58, -.02], [k * x0, .5, -D / 2 + .2], [k * x0, .26, -D / 2 + .08], [k * x0, .03, -D / 2 + .12]],
      .014, bois, { haut: [1, 0, 0], kv: 2.3, ferme: true, seg: 90, radial: 10 }));
    coussin(g, W - .12, .045, D - .26, bois, 0, .24, .02, { r: .012, b: [0, 0, 0] });
    coussin(g, W - .1, .17, D - .2, m, 0, .27, .05, { r: .07, b: [.008, .025, .015] });
    coussin(g, W - .1, .64, .17, m, 0, .36, -D / 2 + .16, { rx: -.22, r: .08, b: [.008, .015, .03] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Prusse : velours bleu roi, dossier à oreilles capitonné en losanges,
     accoudoirs roulés, assise épaisse, fins pieds dorés écartés */
  prusse(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#15296A'), cap = matiere('velours', '#15296A', { grain: 'capiton', echelle: .44, ns: 1 });
    const hp = .17;
    pieds(g, coins(W / 2 - .1, D / 2 - .1), hp + .01, M('laiton'), 'compas', { r: .014, ecart: .12 });
    coussin(g, W - .08, .2, D - .1, m, 0, hp, .03, { r: .06 });
    coussin(g, W - .28, .12, D - .28, m, 0, hp + .19, .08, { r: .05, b: [.01, .025, .015] });
    // dossier : coque en U, haute au centre, oreilles qui descendent vers les bras
    coqueParam(g, (u, t) => {
      const s = u * 2 - 1, [x, z] = planU(u, W / 2 - .05 + .03 * t, D * .36, .12, -.02);
      const top = lerp(.64, H, Math.pow(lisse(0, .75, 1 - Math.abs(s)), .7));
      return [x, hp + .15 + t * (top - hp - .15), z];
    }, { ep: .1, nu: 40, nt: 14, cz: -.02 }).material = cap;
    // accoudoirs roulés
    [-1, 1].forEach(k => {
      coussin(g, .11, .33, D * .62, m, k * (W / 2 - .07), hp + .15, .08, { r: .05 });
      boudin(g, [[k * (W / 2 - .07), .63, -.08], [k * (W / 2 - .065), .63, D / 2 - .1], [k * (W / 2 - .045), .6, D / 2 - .05]], .062, m, { seg: 16, kb: .5 });
    });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Diamond Cream : cuir crème matelassé en losanges, coque haute aux
     oreilles relevées, assise ronde, pied pivotant chromé */
  'diamond-cream'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#C4C6BC', { grain: 'matelasse', echelle: .22, ns: .7 });
    pivot(g, .3, .19, M('chrome'));
    tambour(g, .38, .17, cuir, 0, .2, .04, { b: .015, ah: .06, ab: .03, dome: .01 });
    coqueParam(g, (u, t) => {
      const s = u * 2 - 1, phi = s * 1.75, r = .37 + .1 * t * t;
      const top = .45 + .37 * lisse(0, .45, 1 - Math.abs(s)) + .1 * Math.exp(-Math.pow((Math.abs(s) - .55) / .22, 2));
      return [r * Math.sin(phi), .3 + t * (top - .3), -.02 - r * Math.cos(phi)];
    }, { ep: .085, nu: 56, nt: 16, cz: -.02 }).material = cuir;
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Cognac Shell : coque en fer à cheval en cuir cognac lisse dehors,
     cannelé dedans, bras jusqu'au sol, coussin d'assise */
  'cognac-shell'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#9A5521'), cann = matiere('cuir', '#9A5521', { grain: 'cannelure', echelle: .42, ns: 1 });
    coussin(g, W * .66, .045, D * .55, M('noirMat'), 0, 0, 0, { r: .02, b: [0, 0, 0] });
    const forme = (d, ht) => (u, t) => {
      const s = u * 2 - 1, phi = s * 1.92, a = W / 2 - .04 - d, b = D * .5 - d, k = 1 + .09 * t;
      const top = ht - .16 * Math.pow(Math.abs(s), 2.5);
      return [a * k * Math.sin(phi), .035 + t * (top - .035), .04 - b * k * Math.cos(phi)];
    };
    coqueParam(g, forme(0, H), cuir, { ep: .045, nu: 64, nt: 14, cz: .04 });
    coqueParam(g, forme(.045, H - .012), cann, { ep: .05, nu: 64, nt: 14, cz: .04 });
    coussin(g, W - .3, .27, D - .3, cuir, 0, .04, .08, { r: .05 });
    coussin(g, W - .32, .13, D - .32, cuir, 0, .3, .09, { r: .05, b: [.01, .025, .02] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Cigar 1919 : chesterfield à oreilles en cuir cognac brillant,
     capitonné, accoudoirs roulés, pieds tournés à roulettes */
  'cigar-1919'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#86431A', { rough: .36 }), cap = matiere('cuir', '#86431A', { grain: 'capiton', echelle: .4, ns: 1, rough: .36 });
    const hp = .1;
    pieds(g, coins(W / 2 - .09, D / 2 - .1), hp, matiere('bois', '#3B2416', { couleurs: ['#4A2E1C', '#2C1A10'] }), 'roulette', { r: .022 });
    coussin(g, W - .04, .3, D - .1, cuir, 0, hp, .02, { r: .05 });
    coussin(g, W - .3, .14, D - .3, cuir, 0, hp + .29, .09, { r: .05, b: [.01, .03, .02] });
    [-1, 1].forEach(k => {
      coussin(g, .13, .34, D - .14, cap, k * (W / 2 - .075), hp + .22, .03, { r: .05 });
      boudin(g, [[k * (W / 2 - .07), hp + .56, -D / 2 + .3], [k * (W / 2 - .06), hp + .57, D / 2 - .08]], .075, cuir, { seg: 12, kb: .35 });
    });
    coussin(g, W - .12, .72, .2, cap, 0, hp + .24, -D / 2 + .12, { rx: -.08, r: .08 });
    [-1, 1].forEach(k => coussin(g, .14, .54, .4, cap, k * (W / 2 - .08), hp + .47, -D / 2 + .28, { ry: k * .22, r: .06 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },
  /* Coeur : laine bouclette rouge, cône posé sur sa pointe, dossier en
     cœur à deux lobes, galette d'assise ronde, croix chromée à 4 branches */
  coeur(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#A3141B', { ns: .6 });
    pivot(g, .34, .26, M('chrome'), 'etoile', 4);
    tourne(g, [[0, .24], [.07, .25], [.24, .37], [.38, .47], [.42, .5], [.39, .53], [0, .54]], m, 0, 0, 0, 48);
    tambour(g, .3, .08, m, 0, .5, .04, { ah: .035, dome: .01 });
    const R = Math.min(W / 2, .44);
    coqueParam(g, (u, t) => {
      const s = u * 2 - 1, phi = s * 1.45;
      const top = .54 + (H - .54) * Math.sqrt(Math.max(0, 1 - Math.pow((Math.abs(s) - .47) / .53, 2)));
      const bas = .3 + .16 * Math.abs(s);
      return [R * Math.sin(phi), bas + t * (top - bas), .02 - R * .82 * Math.cos(phi)];
    }, { ep: .07, nu: 64, nt: 14, cz: .02 }).material = m;
    ombreSol(g, W + .2, D + .2);
    return g;
  },

  /* Cubo : coussins en velours émeraude tenus dans une cage de tubes chromés */
  'fauteuil-velours-emeraude-tubulaire-chrome-cubo'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#1E8574'), ch = M('chrome');
    const a = W / 2 - .02, b = D / 2 - .02, yb = .13, yh = H - .06, r = .011;
    // cage : cadre bas, montants, cadre haut autour des bras et du dos
    boudin(g, [[-a, yb, b], [a, yb, b], [a, yb, -b], [-a, yb, -b]], r, ch, { ferme: true, tension: 0, seg: 80, radial: 8 });
    coins(a, b).forEach(([x, z]) => cyl(g, r, r, yh, ch, x, 0, z, 10));
    boudin(g, [[-a, yh, b], [-a, yh, -b], [a, yh, -b], [a, yh, b]], r, ch, { tension: 0, seg: 80, radial: 8, bouts: false });
    // coussins : bras, dos, assise
    [-1, 1].forEach(k => coussin(g, .19, yh - yb - .02, D - .06, m, k * (a - .1), yb + .01, 0, { r: .05, b: [.012, .012, .01] }));
    coussin(g, W - .06, yh - yb - .02, .2, m, 0, yb + .01, -b + .11, { r: .05, b: [.01, .012, .015] });
    coussin(g, W - .44, .22, D - .26, m, 0, yb + .02, .1, { r: .06, b: [.01, .03, .02] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Structura : nacelle en cuir brun garnie de coussins en tissu chiné bleu,
     sur un châssis droit en laiton */
  structura(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const bleu = matiere('tissu', '#2E3B78', { motif: 'chine', couleurs: ['#2C3A76', '#5465A8', '#7A3E6C', '#1A2450'], echelle: .25 });
    const cuir = matiere('cuir', '#4A3528'), lt = matiere('laque', '#A88A55', { rough: .3 });
    const a = W / 2 - .03, b = D / 2 - .06, hc = .36, r = .012;
    coins(a, b).forEach(([x, z]) => cyl(g, r, r, hc, lt, x, 0, z, 10));
    boudin(g, [[-a, hc, b], [a, hc, b], [a, hc, -b], [-a, hc, -b]], r, lt, { ferme: true, tension: 0, seg: 80, radial: 8 });
    // nacelle : coque en U de cuir, posée sur le châssis
    coqueParam(g, (u, t) => {
      const s = u * 2 - 1, [x, z] = planU(u, a - .06, D * .42, .25, .02);
      const top = lerp(.62, H, Math.pow(1 - Math.abs(s), .5));
      return [x, .3 + t * (top - .3), z];
    }, { ep: .05, nu: 48, nt: 10, cz: .02 }).material = cuir;
    coussin(g, W - .2, .1, D - .2, cuir, 0, .3, .03, { r: .04 });
    coussin(g, W - .34, .15, D - .3, bleu, 0, .38, .06, { r: .06, b: [.01, .03, .02] });
    coussin(g, W - .34, .36, .18, bleu, 0, .44, -D / 2 + .18, { rx: -.2, r: .08, b: [.01, .02, .04] });
    [-1, 1].forEach(k => coussin(g, .2, .3, D - .3, bleu, k * (W / 2 - .15), .42, .04, { rz: k * .2, r: .09, b: [.03, .03, .02] }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Nutwood Relax : relax en cuir camel aux volumes bombés, appui-tête,
     accoudoirs en noyer courbé qui flottent sur les flancs */
  'nutwood-relax'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#9C6A35'), noyer = matiere('bois', '#5C3B26', { couleurs: ['#6B4630', '#3E2618'] });
    tambour(g, .26, .05, M('noirMat'), 0, 0, 0, { ah: .01 });
    coussin(g, W - .08, .4, D - .12, cuir, 0, .04, .02, { r: .12, b: [.02, .02, .02] });
    coussin(g, W - .26, .14, D - .3, cuir, 0, .4, .08, { r: .06, b: [.01, .03, .02] });
    coussin(g, W - .22, .58, .22, cuir, 0, .42, -D / 2 + .15, { rx: -.2, r: .1, b: [.01, .02, .04] });
    coussin(g, W - .3, .16, .16, cuir, 0, .98, -D / 2 + .05, { rx: -.2, r: .07 });
    [-1, 1].forEach(k => {
      coussin(g, .15, .36, D - .2, cuir, k * (W / 2 - .09), .36, .02, { r: .07, b: [.02, .015, .01] });
      boudin(g, [[k * (W / 2 - .02), .74, -D / 2 + .12], [k * (W / 2), .64, -.05], [k * (W / 2 - .01), .58, D / 2 - .14], [k * (W / 2 - .02), .44, D / 2 - .04], [k * (W / 2 - .04), .3, D / 2 - .06]], .016, noyer, { haut: [1, 0, 0], kv: 2.6, seg: 40, radial: 10 });
    });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Serpent Royal : cuir bleu gris capitonné dedans, imprimé python bleu
     vert dehors, pieds dorés fuselés */
  'serpent-royal'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const py = matiere('cuir', '#2E6B6E', { motif: 'python', couleurs: ['#1C3236', '#3E8A8A', '#4A7FA0', '#5A9A78', '#3A6A86'], echelle: .3 });
    const bleu = matiere('cuir', '#4A5868'), cap = matiere('cuir', '#4A5868', { grain: 'capiton', echelle: .36 });
    const hp = .12;
    pieds(g, coins(W / 2 - .08, D / 2 - .08), hp, M('laiton'), 'fuseau', { r: .016 });
    coussin(g, W, .3, D, py, 0, hp, 0, { r: .04 });
    [-1, 1].forEach(k => coussin(g, .15, .34, D - .04, py, k * (W / 2 - .075), hp + .28, .01, { r: .05 }));
    coussin(g, W - .02, .5, .16, py, 0, hp + .28, -D / 2 + .08, { r: .05 });
    coussin(g, W - .3, .13, D - .3, bleu, 0, hp + .29, .08, { r: .05, b: [.01, .025, .02] });
    coussin(g, W - .32, .52, .13, cap, 0, hp + .38, -D / 2 + .2, { rx: -.1, r: .06 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Mytho : trône en simili croco blanc, dossier haut capitonné à
     sommet festonné, larges accoudoirs à têtes de bélier dorées, pieds dorés */
  mytho(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const croco = matiere('cuir', '#E8E8E4', { grain: 'croco', echelle: .5, ns: .35 }), cap = matiere('cuir', '#E8E8E4', { grain: 'capiton', echelle: .36 });
    const or = M('or'), hp = .12;
    pieds(g, coins(W / 2 - .12, D / 2 - .1), hp, or, 'fuseau', { r: .016 });
    coussin(g, W - .1, .3, D - .06, croco, 0, hp, .02, { r: .06, b: [.015, .01, .015] });
    coussin(g, W - .38, .13, D - .28, croco, 0, hp + .29, .08, { r: .05, b: [.01, .025, .02] });
    // dossier : panneau haut au sommet en vagues
    const fs = new THREE.Shape(), lw = W - .3, h0 = H - hp - .28;
    fs.moveTo(-lw / 2, 0); fs.lineTo(lw / 2, 0); fs.lineTo(lw / 2, h0 * .82);
    for (let i = 0; i <= 24; i++) { const u = i / 24, x = lw / 2 - u * lw; fs.lineTo(x, h0 * .86 + .06 * Math.abs(Math.sin(u * Math.PI * 3)) + .05 * Math.sin(u * Math.PI)); }
    fs.lineTo(-lw / 2, 0);
    panneau(g, fs, .14, cap, 'face', 0, hp + .28, -D / 2 + .12, { a: .04, rx: -.08 });
    [-1, 1].forEach(k => {
      coussin(g, .2, .42, D - .1, croco, k * (W / 2 - .1), hp + .2, .02, { r: .06, rz: k * .06 });
      // tête de bélier : corne enroulée dorée
      const pts = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * TAU * 1.3, rr = .055 * (1 - i / 45); pts.push([k * (W / 2 - .1 + Math.cos(a) * rr * .4), hp + .62 + Math.sin(a) * rr, D / 2 - .05 + Math.cos(a) * rr]); }
      boudin(g, pts, t => .018 - .01 * t, or, { seg: 60, radial: 10 });
    });
    ombreSol(g, W + .3, D + .3);
    return g;
  },
  /* Archibald : cuir grainé noir, grande coque au rebord drapé roulé vers
     l'extérieur, grosse assise bombée, quatre pieds fins laqués rouges */
  archibald(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#1C1B1E', { rough: .45 }), rouge = matiere('laque', '#A3262B');
    pieds(g, coins(W / 2 - .14, D / 2 - .12), .2, rouge, 'compas', { r: .013, ecart: .1 });
    coussin(g, W - .14, .2, D - .12, cuir, 0, .18, .02, { r: .08, b: [.02, .02, .03] });
    coussin(g, W - .36, .17, D - .22, cuir, 0, .33, .09, { r: .08, b: [.015, .04, .05] });
    // dos et bras : un gros volume en U, rebord drapé roulé vers l'extérieur
    const pts = [], col = [];
    for (let i = 0; i <= 22; i++) {
      const u = i / 22, s = u * 2 - 1, [x, z] = planU(u, W / 2 - .16, D * .36, .3, .03), y = .5 + .06 * (1 - s * s);
      pts.push([x, y, z]);
      const l = Math.hypot(x, z - .03) || 1; col.push([x + x / l * .1, y + .2, z + (z - .03) / l * .1]);
    }
    boudin(g, pts, .13, cuir, { plan: true, kv: 1.9, seg: 70, radial: 20, kb: .7 });
    boudin(g, col, .07, cuir, { plan: true, kv: .75, seg: 70, kb: .7 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Sculptural : tonneau à rayures noir et écru, intérieur et rebord
     drapé en cuir cognac, assise cognac */
  sculptural(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const ray = matiere('tissu', '#ECE6D8', { motif: 'rayures', couleurs: ['#1E1E22', '#E6E0D2'], echelle: .3 }), cuir = matiere('cuir', '#8A4A22');
    const forme = (d, ht) => (u, t) => {
      const s = u * 2 - 1, phi = s * 2.35, a = W / 2 - .02 - d, b = D / 2 - .02 - d;
      const top = ht - .18 * Math.pow(Math.abs(s), 2.2);
      return [a * Math.sin(phi), .02 + t * (top - .02), .03 - b * Math.cos(phi)];
    };
    coqueParam(g, forme(0, H - .03), ray, { ep: .05, nu: 64, nt: 12, cz: .03 });
    coqueParam(g, forme(.05, H - .04), cuir, { ep: .04, nu: 64, nt: 12, cz: .03 });
    const pts = []; for (let i = 0; i <= 30; i++) { const [x, y, z] = forme(.025, H - .03)(i / 30, 1); pts.push([x, y, z]); }
    boudin(g, pts, .05, cuir, { plan: true, kv: .75, seg: 70, kb: .7 });
    tambour(g, Math.min(W, D) / 2 - .1, .3, ray, 0, 0, .05, { ah: .03 });
    coussin(g, W - .26, .14, D - .26, cuir, 0, .3, .07, { r: .06, b: [.01, .03, .02] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Jersey : cuir noir capitonné en bandes, flancs en bois massif clair
     (montants, patin, accoudoir), grosses galettes */
  jersey(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#232226'), lig = matiere('cuir', '#232226', { grain: 'lignes', echelle: .5 }), bois = matiere('bois', '#C89A62', { couleurs: ['#CDA06A', '#A57A48'] });
    const x0 = W / 2 - .03, e = .05;
    [-1, 1].forEach(k => {
      const x = k * x0;
      [[D / 2 - .06], [-D / 2 + .08]].forEach(([z]) => place(g, mesh(new THREE.BoxGeometry(e, .52, e), bois), x, .26, z));
      place(g, mesh(new THREE.BoxGeometry(e, e, D - .06), bois), x, .025, 0);
      place(g, mesh(new THREE.BoxGeometry(e * 1.3, e, D - .02), bois), x, .54, 0);
      coussin(g, .12, .07, D - .2, cuir, x - k * .015, .55, 0, { r: .03 });
    });
    coussin(g, W - .14, .2, D - .1, cuir, 0, .12, .02, { r: .06 });
    coussin(g, W - .16, .16, D - .2, lig, 0, .3, .06, { r: .06, b: [.01, .03, .03] });
    coussin(g, W - .18, .5, .2, lig, 0, .4, -D / 2 + .14, { rx: -.18, r: .08, b: [.01, .02, .04] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Classica (club bicolore) : tonneau, cannelé taupe dedans, cuir
     ocre dehors, galette taupe, pieds noirs fuselés */
  'fauteuil-club-cuir-bicolore-taupe-cognac'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const ocre = matiere('cuir', '#A8661F'), taupe = matiere('cuir', '#76665A'), cann = matiere('cuir', '#76665A', { grain: 'cannelure', echelle: .4 });
    const hp = .16;
    pieds(g, coins(W / 2 - .1, D / 2 - .1), hp + .02, matiere('laque', '#1A1A1C'), 'fuseau', { r: .02 });
    const forme = (d, ht) => (u, t) => {
      const s = u * 2 - 1, phi = s * 1.85, a = W / 2 - .02 - d, b = D / 2 - .02 - d, k = 1 + .06 * t;
      const top = ht - .1 * Math.pow(Math.abs(s), 2.4);
      return [a * k * Math.sin(phi), hp + t * (top - hp), .04 - b * k * Math.cos(phi)];
    };
    coqueParam(g, forme(0, H), ocre, { ep: .04, nu: 60, nt: 12, cz: .04 });
    coqueParam(g, forme(.04, H - .012), cann, { ep: .05, nu: 60, nt: 12, cz: .04 });
    coussin(g, W - .2, .16, D - .14, ocre, 0, hp, .03, { r: .06 });
    coussin(g, W - .24, .13, D - .24, taupe, 0, hp + .15, .08, { r: .05, b: [.01, .03, .02] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Floral Couture : tonneau évasé, cuir gris taupe capitonné dedans,
     tissu fleuri bleu dehors, pieds gris aux bagues dorées */
  'floral-couture'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const fleurs = matiere('tissu', '#A9ABA6', { motif: 'floral', couleurs: ['#A6A8A3', '#22479E', '#6E8FD6', '#B8C536', '#F0E4B0'], echelle: .55 });
    const gris = matiere('cuir', '#8D8A82'), cap = matiere('cuir', '#8D8A82', { grain: 'capiton', echelle: .4 });
    const hp = .14;
    pieds(g, coins(W / 2 - .16, D / 2 - .12), hp + .02, matiere('laque', '#5E5E60'), 'fuseau', { r: .022 });
    const forme = (d, ht) => (u, t) => {
      const s = u * 2 - 1, phi = s * 1.8, a = W / 2 - .1 - d, b = D / 2 - .04 - d, k = 1 + .2 * t * t;
      const top = ht - .14 * Math.pow(Math.abs(s), 2);
      return [a * k * Math.sin(phi), hp + .1 + t * (top - hp - .1), .02 - b * Math.cos(phi)];
    };
    coqueParam(g, forme(0, H), fleurs, { ep: .05, nu: 60, nt: 12, cz: .02 });
    coqueParam(g, forme(.05, H - .015), cap, { ep: .05, nu: 60, nt: 12, cz: .02 });
    coussin(g, W - .2, .22, D - .12, fleurs, 0, hp, .03, { r: .06 });
    coussin(g, W - .4, .13, D - .3, gris, 0, hp + .21, .08, { r: .05, b: [.01, .03, .02] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Black Wing : cuir noir surpiqué, accoudoirs en ailes de papillon
     qui s'étirent et remontent vers l'extérieur, pieds métal écartés */
  'black-wing'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#1B1A1D', { grain: 'lignes', echelle: .35, ns: .6 }), lisse = matiere('cuir', '#1B1A1D');
    pieds(g, coins(.26, D / 2 - .14), .22, M('chrome'), 'compas', { r: .012, ecart: .2 });
    coussin(g, .66, .14, D - .16, lisse, 0, .2, .02, { r: .05 });
    coussin(g, .62, .12, D - .26, cuir, 0, .32, .06, { r: .05, b: [.01, .025, .02] });
    coussin(g, .64, .48, .14, cuir, 0, .33, -D / 2 + .14, { rx: -.32, r: .06 });
    // ailes : profil effilé qui remonte vers la pointe
    [-1, 1].forEach(k => {
      // forme dessinée directement du bon côté (pas d'échelle négative : la cuisson inverserait les faces)
      const fs = new THREE.Shape(), L = W / 2 - .3, X = v => k * v;
      fs.moveTo(0, -.3); fs.quadraticCurveTo(X(L * .6), -.22, X(L), .12); fs.quadraticCurveTo(X(L * .7), .02, X(L * .35), .18); fs.quadraticCurveTo(X(L * .15), .26, 0, .28); fs.closePath();
      const aile = panneau(g, fs, .05, cuir, 'sol', k * .3, .5, .02, { a: .02 });
      aile.rotation.z = k * .22;
    });
    ombreSol(g, W + .2, D + .3);
    return g;
  },
  /* Modulo : enveloppe matelassée et froncée en velours émeraude brillant,
     dos et bras d'un seul boudin, grosse galette, châssis noir à quatre pieds */
  'fauteuil-lounge-velours-cotele-emeraude-modulo'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#0F6B3C', { grain: 'cannelure', echelle: .7, ns: .45, rough: .55 }), noir = M('noirMat');
    const a = W / 2 - .12, b = D / 2 - .1;
    coins(a, b).forEach(([x, z]) => cyl(g, .014, .014, .36, noir, x, 0, z, 10));
    boudin(g, [[-a, .34, b], [a, .34, b], [a, .34, -b], [-a, .34, -b]], .013, noir, { ferme: true, tension: 0, seg: 60, radial: 8 });
    coussin(g, W - .2, .14, D - .16, m, 0, .3, .02, { r: .06 });
    const pts = []; for (let i = 0; i <= 20; i++) { const [x, z] = planU(i / 20, W / 2 - .15, D * .38, .42, .04); pts.push([x, .56, z]); }
    boudin(g, pts, .15, m, { plan: true, kv: 1.15, seg: 70, radial: 20, kb: .8 });
    coussin(g, W - .46, .18, D - .3, m, 0, .4, .1, { r: .08, b: [.015, .04, .03] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Crab : tissu framboise, bras en pinces qui retombent jusqu'au sol, dossier plus clair */
  crab: p => pince(p, matiere('velours', '#A51F33'), matiere('velours', '#BF2F43'), matiere('velours', '#3A1016')),

  /* Taupe Drop : même ligne en cuir taupe olive, dedans sombre */
  'taupe-drop': p => pince(p, matiere('cuir', '#5E5B46'), matiere('cuir', '#6A6650'), matiere('cuir', '#1E1D1A')),

  /* Ovale Royal : cocon en velours moutarde, coque ronde au dossier plissé
     en éventail, galette ronde à passepoil, socle sombre */
  'ovale-royal'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#B08317'), pli = matiere('velours', '#B08317', { grain: 'cannelure', echelle: 1.1, ns: .5 });
    tambour(g, Math.min(W, D) * .32, .06, M('noirMat'), 0, 0, 0, { ah: .01 });
    const forme = (u, t) => {
      const s = u * 2 - 1, phi = s * 2.05, R = Math.min(W, D) / 2 - .05, bulbe = 1 + .14 * Math.sin(Math.PI * t * .9);
      const top = H - .05 - (H - .5) * Math.pow(Math.abs(s), 2.4);
      return [R * bulbe * Math.sin(phi), .05 + t * (top - .05), .03 - R * bulbe * Math.cos(phi) * .95];
    };
    coqueParam(g, forme, pli, { ep: .12, nu: 64, nt: 14, cz: .03 });
    bordCoque(g, forme, .12, m, { cz: .03, r: .07 });
    tambour(g, Math.min(W, D) / 2 - .16, .3, m, 0, .05, .06, { b: .02, ah: .05 });
    tambour(g, Math.min(W, D) / 2 - .17, .13, m, 0, .34, .07, { ah: .05, dome: .015 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Structura (cuir) : ruban de cuir gris clair matelassé en bandes, assise
     longue posée au sol qui s'enroule en dossier */
  'structura-cuir'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#ABA79C', { grain: 'carres', echelle: .5, ns: .6 });
    coussin(g, W * .7, .32, D - .02, cuir, W * .14, 0, 0, { r: .1, b: [.02, .02, .02] });
    boudin(g, [[-W * .1, .26, 0], [-W * .32, .36, 0], [-W * .44, .6, 0], [-W * .38, H - .1, 0], [-W * .24, H - .14, 0], [-W * .2, .66, 0], [-W * .28, .5, 0]], .085, cuir, { haut: [0, 0, 1], kv: (D / 2 - .02) / .085, seg: 60, radial: 14, kb: .9 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Boxing Glove : chaise longue en cuir camel aux flancs froncés, gros
     gant arrondi au dossier, laçage sur le dessus */
  'boxing-glove'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#A56D2E'), fr = matiere('cuir', '#A56D2E', { grain: 'cannelure', echelle: .35, ns: .9 });
    coussin(g, W, .36, D - .05, fr, 0, 0, .02, { r: .14, b: [.03, .03, .02] });
    coussin(g, W - .1, .1, D - .45, cuir, 0, .34, .2, { r: .05, b: [.01, .02, .02] });
    coussin(g, W + .02, H - .3, .5, fr, 0, .3, -D / 2 + .26, { r: .2, b: [.04, .05, .04] });
    boudin(g, [[-W / 2 + .1, H - .05, -D / 2 + .2], [0, H + .02, -D / 2 + .32], [W / 2 - .1, H - .05, -D / 2 + .2]], .1, cuir, { seg: 20, kb: .8 });
    const lac = []; for (let i = 0; i <= 16; i++) lac.push([(i % 2 ? .05 : -.05), .455, -D / 2 + .55 + i * .05]);
    boudin(g, lac, .004, M('noirMat'), { seg: 64, radial: 5, tension: 0 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },
  /* Ala : à oreilles, velours moutarde dedans, gris anthracite dehors, pieds dorés fins */
  'fauteuil-bicolore-velours-gris-jaune-ala': p => oreilles(p, { ext: matiere('velours', '#3F4044'), int: matiere('velours', '#8E7A14'), hBras: .62 }),

  /* Baroque : à oreilles haut en tissu op-art (cercles roses et bleus sur marine), pieds galbés dorés */
  baroque: p => oreilles(p, { ext: matiere('tissu', '#1E2A55', { motif: 'geometrique', couleurs: ['#1C2752', '#E07AA0', '#3FA7B5', '#F2EFE9', '#22305E'], echelle: .42 }), pieds: 'galbes', mp: M('or'), hBras: .66 }),

  /* Or Baroque : tonneau en velours safran, têtes de lion dorées au bout des bras, pieds galbés */
  'or-baroque'(p) {
    const [W, D, H] = p.dim;
    const g = tonneau(p, { ext: matiere('velours', '#9A5A1C'), pieds: 'galbes', mp: M('or'), bras: H - .1, tour: 1.75 });
    const or = M('or');
    [-1, 1].forEach(k => {
      const x = k * (W / 2 - .05), z = D / 2 - .1;
      coussin(g, .07, .3, .05, or, x, .36, z, { r: .02, b: [.005, .005, .01] });
      sphere(g, .045, or, x, .68, z + .01, 1, 1, .8, 16);
    });
    coussin(g, .4, .4, .12, matiere('velours', '#17181B'), 0, .38, -.12, { rx: -.3, r: .06 });
    return g;
  },

  /* Zebra Or : à oreilles, dedans imprimé zébré noir, or et crème, dehors velours moutarde */
  'zebra-or': p => oreilles(p, { ext: matiere('velours', '#A88A16'), int: matiere('velours', '#E9DFC4', { motif: 'zebre', couleurs: ['#EADFC2', '#17171A', '#C49A2A'], echelle: .55 }), hBras: .6, av: .05 }),

  /* Chester Moon : gros fauteuil bleu électrique matelassé, volumes bombés */
  'chester-moon'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#1E3FB0', { grain: 'matelasse', echelle: .25, ns: .9 });
    coussin(g, W, .38, D, m, 0, .02, 0, { r: .16, b: [.03, .03, .03] });
    [-1, 1].forEach(k => coussin(g, .26, .36, D - .04, m, k * (W / 2 - .13), .3, .01, { r: .12, b: [.03, .03, .02] }));
    coussin(g, W - .1, H - .3, .3, m, 0, .3, -D / 2 + .15, { r: .13, b: [.02, .03, .03] });
    coussin(g, W - .5, .16, D - .36, m, 0, .37, .1, { r: .07, b: [.01, .03, .02] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Loveuse rouge : velours côtelé rouge, silhouette bulbeuse en gros boudins, sans pied visible */
  'loveuse-rouge'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('cotele', '#B0141C', { echelle: .2 });
    const R = Math.min(W, D) / 2;
    tambour(g, R - .04, .22, m, 0, 0, .03, { b: .05, ah: .1, ab: .06 });
    tambour(g, R - .08, .17, m, 0, .2, .05, { b: .04, ah: .08, dome: .02 });
    const pts = []; for (let i = 0; i <= 22; i++) { const [x, z] = planU(i / 22, R - .14, R - .12, .45, .04); pts.push([x, .48 + .08 * Math.cos((i / 22 * 2 - 1) * Math.PI / 2), z]); }
    boudin(g, pts, .15, m, { plan: true, kv: 1.15, seg: 70, radial: 20, kb: .9 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },
  /* Pilou : peluche blanche, haut dossier arrondi et appui-tête rond,
     bras en gros boudins, deux bourrelets ronds à l'avant de l'assise */
  'fauteuil-boucle-blanc-effet-peluche-pilou'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('fourrure', '#EDEBE6', { ns: .9 });
    coussin(g, W - .2, .3, D - .2, m, 0, 0, 0, { r: .14, b: [.03, .03, .03] });
    coussin(g, W - .3, .62, .34, m, 0, .2, -D / 2 + .2, { rx: -.12, r: .16, b: [.03, .04, .05] });
    sphere(g, .16, m, 0, H - .14, -D / 2 + .16, 1.1, .95, .9, 24);
    [-1, 1].forEach(k => {
      boudin(g, [[k * (W / 2 - .14), .62, -D / 2 + .24], [k * (W / 2 - .07), .5, -.05], [k * (W / 2 - .1), .34, D / 2 - .22]], .11, m, { seg: 24, kb: .9 });
      sphere(g, .17, m, k * .18, .17, D / 2 - .14, 1, .95, 1.1, 24);
    });
    coussin(g, W - .44, .12, D - .36, m, 0, .28, .06, { r: .05, b: [.01, .03, .02] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Marble Green Cone : coque en chenille marbrée vert et blanc, galette,
     pied conique noir pivotant */
  'marble-green-cone'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('chenille', '#8FB3A5', { motif: 'mineral', couleurs: ['#E6EEEA', '#B9CEC5', '#6F978A', '#3E6E62'], echelle: .45 });
    tourne(g, [[0, 0], [.24, 0], [.23, .02], [.12, .1], [.07, .3], [.09, .34], [0, .34]], M('noirMat'), 0, 0, 0, 40);
    tambour(g, W / 2 - .05, .14, m, 0, .32, .03, { ah: .05, dome: .01 });
    const forme = (u, t) => {
      const s = u * 2 - 1, phi = s * 1.75, r = W / 2 - .05 + .06 * t;
      const top = H - (H - .55) * Math.pow(Math.abs(s), 2) + .03 * Math.cos(s * 6);
      return [r * Math.sin(phi), .36 + t * (top - .36), .02 - r * Math.cos(phi)];
    };
    coqueParam(g, forme, m, { ep: .06, nu: 50, nt: 12, cz: .02 });
    bordCoque(g, forme, .06, m, { cz: .02, r: .035 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Vert : bouclette vert anis, dos et bras d'un seul volume rond, grosse galette */
  vert(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#8DA92E');
    coussin(g, W * .62, .05, D * .5, M('noirMat'), 0, 0, 0, { r: .02 });
    coussin(g, W - .06, .3, D - .06, m, 0, .04, 0, { r: .12, b: [.03, .02, .03] });
    const pts = []; for (let i = 0; i <= 22; i++) { const u = i / 22, s = u * 2 - 1, [x, z] = planU(u, W / 2 - .17, D * .33, .4, .02); pts.push([x, .52 + .1 * (1 - s * s), z]); }
    boudin(g, pts, .16, m, { plan: true, kv: 1.5, seg: 70, radial: 20, kb: .9 });
    coussin(g, W - .4, .15, D - .3, m, 0, .32, .08, { r: .07, b: [.01, .035, .025] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Sabot : assise basse drapée en chenille bleu marine sur patins en laiton */
  sabot(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('chenille', '#1E2A52'), lt = M('laiton');
    [-1, 1].forEach(k => boudin(g, [[k * (W / 2 - .12), .012, D / 2 - .06], [k * (W / 2 - .12), .012, -D / 2 + .06]], .012, lt, { seg: 6, radial: 8 }));
    coussin(g, W - .1, .16, D - .1, m, 0, H - .17, 0, { r: .07, b: [.02, .03, .02] });
    [-1, 1].forEach(k => coussin(g, .1, H - .14, D - .12, m, k * (W / 2 - .1), .02, 0, { rz: -k * .18, r: .05 }));
    coussin(g, W - .3, .1, D - .2, m, 0, H - .06, .02, { r: .045, b: [.01, .02, .02] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Petal : coque conique en simili cuir vert d'eau à pétales surpiqués,
     inclinée vers l'arrière, sur piètement noir à quatre pieds écartés */
  petal(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('cuir', '#2A9473'), couture = matiere('cuir', '#1D6E55'), noir = matiere('laque', '#1C1A1C');
    pieds(g, coins(.2, .18), .42, noir, 'compas', { r: .016, ecart: .2 });
    // coque conique basculée vers l'arrière, ouverte vers l'avant
    const c = groupe(); c.position.set(0, .4, -.05); c.rotation.x = .62; g.add(c);
    const R = W / 2 - .04, forme = (u, t) => { const phi = u * TAU, r = .06 + R * t; return [r * Math.sin(phi), t * .32, -r * Math.cos(phi)]; };
    coqueParam(c, forme, m, { ep: .03, nu: 72, nt: 10, ferme: true });
    bordCoque(c, forme, .03, m, { r: .02, n: 72 });
    for (let k = 0; k < 8; k++) { const u = k / 8, pts = [.08, .5, 1].map(t => forme(u, t)); boudin(c, pts.map(q => [q[0] * .995, q[1] + .004, q[2] * .995]), .006, couture, { seg: 12, radial: 6, bouts: false }); }
    coussin(g, .5, .07, .4, m, 0, .45, .02, { r: .03 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Ensemble : velours côtelé vert de gris, ruban enveloppant dos et flancs
     jusqu'au sol, sans accoudoirs */
  ensemble(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('cotele', '#4B5A52', { echelle: .12 });
    // flancs : bandes inclinées qui descendent du haut du dos jusqu'au sol à l'avant
    const fs = new THREE.Shape();
    fs.moveTo(-D / 2 + .02, H); fs.lineTo(-D / 2 + .3, H); fs.quadraticCurveTo(.05, .42, D / 2 - .02, .06); fs.lineTo(D / 2 - .04, 0);
    fs.lineTo(D / 2 - .28, 0); fs.quadraticCurveTo(-.12, .3, -D / 2 + .02, H - .3); fs.closePath();
    [-1, 1].forEach(k => panneau(g, fs, .1, m, 'cote', k * (W / 2 - .05), 0, 0, { a: .035 }));
    coussin(g, W - .04, H - .26, .1, m, 0, .26, -D / 2 + .08, { rx: -.1, r: .04 });
    coussin(g, W - .16, .14, D - .22, m, 0, .32, .04, { r: .05, b: [.01, .025, .02] });
    coussin(g, W - .16, .2, D - .32, m, 0, .12, .0, { r: .04 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Graphic : velours gris perle, volume cubique arrondi, dossier percé d'un rond */
  graphic(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#B4B4B1');
    const dos = rectCoins(W, H - .02, [.04, .04, .16, .16], 0, (H - .02) / 2), trou = new THREE.Path();
    trou.absarc(0, H * .64, .06, 0, TAU, true); dos.holes.push(trou);
    panneau(g, dos, .1, m, 'face', 0, 0, -D / 2 + .05, { a: .03 });
    [-1, 1].forEach(k => panneau(g, rectCoins(D - .1, .58, [.04, .04, .12, .04], 0, .29), .1, m, 'cote', k * (W / 2 - .05), 0, .04, { a: .03 }));
    coussin(g, W - .2, .42, D - .16, m, 0, 0, .05, { r: .05, b: [.005, .02, .015] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Arché : tissu gris côtelé, gros tube en arche qui part du sol à gauche,
     passe derrière le dos et redescend à droite, galette ronde épaisse */
  arch(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('cotele', '#858585', { echelle: .1 });
    const r = .15, a = W / 2 - r - .02, b = D / 2 - r - .02;
    boudin(g, [[-a, r, b * .55], [-a, .5, b * .1], [-a * .8, H - r, -b * .65], [0, H - r + .01, -b], [a * .8, H - r, -b * .65], [a, .5, b * .1], [a, r, b * .55]], r, m, { seg: 90, radial: 20, kb: .9 });
    tambour(g, Math.min(W, D) / 2 - .2, .44, m, 0, 0, .04, { b: .03, ah: .1, ab: .03 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },
  /* Noeud : bouclette écrue en gros tubes entrelacés : pieds, bras en boucles, dossier noué */
  noeud(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#E9E6DE'), r = .055, a = W / 2 - r - .02, b = D / 2 - r - .02;
    [-1, 1].forEach(k => {
      boudin(g, [[k * a, r, b], [k * a, .42, b - .02], [k * (a + .02), .58, b * .2], [k * (a - .04), .62, -b * .5], [k * a * .7, .5, -b], [k * a * .9, r, -b * .8]], r, m, { seg: 60, radial: 14 });
      boudin(g, [[k * a * .9, .62, -b * .9], [k * a * .5, H - r, -b * 1.02], [k * a * .1, .55, -b * .8], [-k * a * .3, H - .08, -b * .95]], r, m, { seg: 40, radial: 14 });
    });
    coussin(g, W - .2, .14, D - .2, m, 0, .32, .02, { r: .06, b: [.01, .03, .02] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Bubble : bouclette moutarde, grosse galette ronde entre deux arceaux
     en tubes épais reliés par une barre de dossier */
  bubble(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#AE8810'), r = .09, a = W / 2 - r, b = D / 2 - r;
    [-1, 1].forEach(k => boudin(g, [[k * a, r * .9, b - .02], [k * a, H - r - .05, b - .08], [k * a, H - r, -b * .3], [k * a, H - r - .04, -b + .02], [k * a, r * .9, -b + .04]], r, m, { seg: 50, radial: 16, kb: .9 }));
    boudin(g, [[-a, H - r - .02, -b + .06], [0, H - r + .02, -b - .01], [a, H - r - .02, -b + .06]], r * .95, m, { seg: 30, radial: 16, bouts: false });
    tambour(g, Math.min(W - 2 * r, D) / 2 + .02, .34, m, 0, .04, .05, { b: .04, ah: .12, ab: .08, dome: .02 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Forêt : bouclé turquoise texturé, assise en galets bombés, dossier
     de tiges coiffées de chapeaux ronds comme des champignons */
  foret(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#1E9E92', { ns: 1.2 });
    [[-.22, .26, .1, .3], [.22, .26, .1, .3], [0, .24, -.12, .32], [-.3, .22, -.2, .24], [.3, .22, -.2, .24]].forEach(([x, y, z, r]) => sphere(g, r, m, x, y, z, 1.1, .85, 1, 24));
    [[-.38, 1.05, -.3, .13], [-.15, 1.3, -.36, .16], [.12, 1.42, -.34, .17], [.36, 1.15, -.3, .14], [.42, .85, -.15, .11], [-.45, .8, -.12, .1]].forEach(([x, y, z, rc], i) => {
      boudin(g, [[x * .6, .4, z * .7], [x * .85, (y + .4) / 2, z], [x, y - rc * .5, z]], t => .045 - .015 * t, m, { seg: 20, radial: 12 });
      sphere(g, rc, m, x, y, z, 1.2, .55, 1.2, 22);
    });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Tango : coque haute en simili cuir noir, dos en bouclette kaki, grosse
     galette orange, pieds métal fins */
  tango(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const noir = matiere('cuir', '#222125'), kaki = matiere('boucle', '#9C9364'), orange = matiere('boucle', '#B45A28');
    pieds(g, coins(W / 2 - .12, D / 2 - .12), .16, M('chrome'), 'droit', { r: .01 });
    const forme = d => (u, t) => {
      const s = u * 2 - 1, phi = s * 1.75, a = W / 2 - .03 - d, b = D / 2 - .04 - d;
      const top = H - d * .3 - (H - .5) * Math.pow(Math.abs(s), 1.6);
      return [a * Math.sin(phi), .16 + t * (top - .16), .03 - b * Math.cos(phi)];
    };
    coqueParam(g, forme(0), noir, { ep: .035, nu: 60, nt: 12, cz: .03 });
    coqueParam(g, forme(.035), kaki, { ep: .05, nu: 60, nt: 12, cz: .03 });
    galette(g, W / 2 - .05, D / 2 - .06, .13, noir, 0, .15, .04, { ah: .04 });
    galette(g, W / 2 - .08, D / 2 - .1, .18, orange, 0, .27, .07, { ah: .08, dome: .02 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Dual : coque basse en cuir cognac dehors, coussins en tissu tissé gris vert, pieds noirs */
  dual(p) {
    const [W, D, H] = p.dim;
    const gris = matiere('tissu', '#B3B6AE', { grain: 'chenille', echelle: .2 });
    const g = tonneau(p, { ext: matiere('cuir', '#7A4120'), int: gris, galette: gris, pieds: 'fuseau', mp: matiere('laque', '#1C1A1C'), bras: .58, tour: 1.7, hp: .16 });
    coussin(g, W - .36, .34, .16, gris, 0, .4, -D / 2 + .22, { rx: -.2, r: .07, b: [.01, .02, .03] });
    [-1, 1].forEach(k => coussin(g, .13, .12, D * .55, gris, k * (W / 2 - .17), .44, .04, { r: .05 }));
    return g;
  },

  /* Duo : tambour bleu marine, coque de dossier en cuir crème qui forme
     les bras, coussin marine */
  'duo-cream'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const marine = matiere('cuir', '#232E4A'), creme = matiere('cuir', '#E2DACB');
    const R = Math.min(W, D) / 2 - .04;
    tambour(g, R, .44, marine, 0, 0, .05, { b: .03, ah: .09, ab: .03 });
    // dos marine en arc, flancs crème en panneaux arrondis qui forment les bras
    const forme = (u, t) => { const s = u * 2 - 1, phi = s * 1.25; return [(R + .02) * Math.sin(phi), .3 + t * (H - .3), .05 - (R + .02) * Math.cos(phi)]; };
    coqueParam(g, forme, marine, { ep: .1, nu: 40, nt: 10, cz: .05 });
    bordCoque(g, forme, .1, marine, { cz: .05, r: .05 });
    [-1, 1].forEach(k => coussin(g, .12, H - .04, D * .62, creme, k * (W / 2 - .07), 0, -.04, { r: .055, ry: k * .25, b: [.01, .01, .01] }));
    coussin(g, W - .4, .38, .14, marine, 0, .46, -D / 2 + .22, { rx: -.15, r: .06, b: [.01, .02, .03] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Scandi : bois cintré, coussins en bouclette grise, tablette sur l'accoudoir droit */
  scandi(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const bois = matiere('bois', '#8A5A34', { couleurs: ['#9A6840', '#6A4024'] }), m = matiere('boucle', '#A9A9A6');
    const x0 = W / 2 - .03;
    [-1, 1].forEach(k => {
      boudin(g, [[k * x0, .02, D / 2 - .1], [k * x0, .3, D / 2 - .12], [k * x0, .56, D / 2 - .06]], .018, bois, { haut: [1, 0, 0], kv: 1.4, seg: 12 });
      boudin(g, [[k * x0, .02, -D / 2 + .12], [k * x0, .3, -D / 2 + .1], [k * x0, .56, -D / 2 + .14]], .018, bois, { haut: [1, 0, 0], kv: 1.4, seg: 12 });
      boudin(g, [[k * x0, .56, -D / 2 + .1], [k * x0, .58, 0], [k * x0, .56, D / 2 - .03]], .02, bois, { haut: [1, 0, 0], kv: 2.2, seg: 16 });
    });
    place(g, mesh(new THREE.BoxGeometry(.22, .02, .3), bois), x0 + .07, .58, .12);
    coussin(g, W - .12, .03, D - .2, bois, 0, .28, 0, { r: .01 });
    coussin(g, W - .14, .15, D - .2, m, 0, .3, .03, { r: .06, b: [.01, .03, .02] });
    coussin(g, W - .16, .5, .14, m, 0, .38, -D / 2 + .14, { rx: -.22, r: .07, b: [.01, .02, .03] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Pied-de-poule or : coque haute grise, coussins pied-de-poule noir et
     blanc, coussin rond, socle en laiton */
  'pied-de-poule-or'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const gris = matiere('tissu', '#4A4C52'), pdp = matiere('tissu', '#888888', { motif: 'pied-de-poule', couleurs: ['#ECE9E2', '#18181A'], echelle: .25 });
    coussin(g, W - .2, .06, D - .2, M('laiton'), 0, 0, 0, { r: .015, b: [0, 0, 0] });
    const forme = d => (u, t) => {
      const s = u * 2 - 1, phi = s * 1.7, a = W / 2 - .03 - d, b = D / 2 - .04 - d;
      const top = H - d * .3 - (H - .58) * Math.pow(Math.abs(s), 1.8);
      return [a * Math.sin(phi), .06 + t * (top - .06), .04 - b * Math.cos(phi)];
    };
    coqueParam(g, forme(0), gris, { ep: .06, nu: 60, nt: 12, cz: .04 });
    bordCoque(g, forme(.03), .03, gris, { cz: .04, r: .035 });
    galette(g, W / 2 - .05, D / 2 - .06, .3, gris, 0, .06, .05, { ah: .05 });
    galette(g, W / 2 - .09, D / 2 - .12, .15, pdp, 0, .35, .07, { ah: .06, dome: .015 });
    coussin(g, W - .34, .5, .14, pdp, 0, .48, -D / 2 + .19, { rx: -.12, r: .07, b: [.01, .02, .03] });
    boudin(g, [[-.14, .6, -D / 2 + .36], [.14, .6, -D / 2 + .36]], .075, pdp, { seg: 8, kb: .5 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },
  /* Détente : châssis carré en tube laqué rouge, coussins de bouclette blanche
     posés et drapés sur les accoudoirs */
  'd-tente'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const rouge = matiere('laque', '#B3202A'), m = matiere('boucle', '#EEEBE4');
    const a = W / 2 - .05, b = D / 2 - .05, hb = .5, r = .016;
    coins(a, b).forEach(([x, z]) => place(g, mesh(new THREE.BoxGeometry(r * 2, hb, r * 2), rouge), x, hb / 2, z));
    [[.14], [hb]].forEach(([y]) => {
      [-1, 1].forEach(k => place(g, mesh(new THREE.BoxGeometry(r * 2, r * 2, D - .1), rouge), k * a, y, 0));
      place(g, mesh(new THREE.BoxGeometry(W - .1, r * 2, r * 2), rouge), 0, y, b);
      place(g, mesh(new THREE.BoxGeometry(W - .1, r * 2, r * 2), rouge), 0, y, -b);
    });
    coussin(g, W - .2, .14, D - .16, m, 0, .26, .03, { r: .06, b: [.01, .03, .02] });
    coussin(g, W - .22, .5, .16, m, 0, .32, -D / 2 + .14, { rx: -.22, r: .07, b: [.01, .02, .03] });
    [-1, 1].forEach(k => coussin(g, .18, .14, D - .12, m, k * (a - .02), hb - .03, 0, { r: .06, rz: k * .15 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Vision : coussins de cuir noir capitonnés sur coques en noyer cintré,
     appui-tête, accoudoirs, piètement étoile pivotant */
  'fauteuil-lounge-noyer-cuir-noir-vision'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const noyer = matiere('bois', '#5C3B26', { couleurs: ['#6B4630', '#3A2416'] }), cuir = matiere('cuir', '#1B1A1D', { grain: 'lignes', echelle: .4, ns: .8 });
    pivot(g, .36, .24, M('noir'), 'etoile', 5);
    const s = groupe(); s.position.set(0, .3, .02); s.rotation.x = -.12; g.add(s);
    coussin(s, W - .08, .05, D - .2, noyer, 0, 0, 0, { r: .02 });
    coussin(s, W - .16, .15, D - .26, cuir, 0, .04, .02, { r: .06, b: [.01, .03, .02] });
    const d = groupe(); d.position.set(0, .36, -D / 2 + .12); d.rotation.x = -.28; g.add(d);
    coussin(d, W - .1, .5, .05, noyer, 0, 0, 0, { r: .02 });
    coussin(d, W - .18, .46, .14, cuir, 0, .02, .08, { r: .06, b: [.01, .02, .03] });
    coussin(d, W - .2, .26, .05, noyer, 0, .54, 0, { r: .02 });
    coussin(d, W - .26, .24, .13, cuir, 0, .55, .08, { r: .06, b: [.01, .02, .03] });
    [-1, 1].forEach(k => { coussin(g, .1, .05, D * .55, cuir, k * (W / 2 - .05), .52, .02, { r: .025 }); cyl(g, .01, .01, .14, M('noir'), k * (W / 2 - .05), .38, .1, 8); });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Swan : coque pivotante à ailes, bouclé chiné anthracite dehors, gris clair dedans, étoile noire */
  swan(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const fonce = matiere('boucle', '#3B3B3F', { motif: 'chine', couleurs: ['#3B3B3F', '#5A5A5E', '#26262A'], echelle: .2 }), clair = matiere('boucle', '#C6C6C2');
    pivot(g, .34, .3, M('noir'), 'etoile', 4);
    const forme = d => (u, t) => {
      const s = u * 2 - 1, phi = s * 1.8, a = W / 2 - .03 - d, b = D / 2 - .05 - d;
      const top = H - d * .4 - (H - .55) * Math.pow(Math.abs(s), 1.5) + .08 * Math.exp(-Math.pow((Math.abs(s) - .55) / .15, 2));
      const k = 1 + .25 * t * t * (1 - Math.abs(s) * .3);
      return [a * k * Math.sin(phi), .32 + t * (top - .32), .02 - b * Math.cos(phi) * (1 + .1 * t)];
    };
    coqueParam(g, forme(0), fonce, { ep: .04, nu: 60, nt: 14, cz: .02 });
    coqueParam(g, forme(.04), matiere('boucle', '#55565A'), { ep: .04, nu: 60, nt: 14, cz: .02 });
    galette(g, W / 2 - .1, D / 2 - .12, .12, clair, 0, .32, .06, { ah: .05, dome: .01 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Cloud : bouclette écrue, volumes ronds empilés (galette, bras, dos,
     boudin d'appui-tête) sur socle rond noir pivotant */
  cloud(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#E8E2D4');
    tambour(g, .26, .1, M('noirMat'), 0, 0, 0, { ah: .02 });
    galette(g, W / 2 - .05, D / 2 - .05, .22, m, 0, .09, .02, { b: .02, ah: .08, ab: .05 });
    galette(g, W / 2 - .14, D / 2 - .14, .14, m, 0, .29, .06, { ah: .06, dome: .02 });
    const pts = []; for (let i = 0; i <= 20; i++) { const [x, z] = planU(i / 20, W / 2 - .13, D * .3, .38, .02); pts.push([x, .44 + .06 * (1 - Math.abs(i / 10 - 1)), z]); }
    boudin(g, pts, .12, m, { plan: true, kv: 1.2, seg: 60, radial: 18, kb: .9 });
    coussin(g, W - .34, .3, .2, m, 0, .5, -D / 2 + .16, { rx: -.15, r: .09 });
    boudin(g, [[-W / 2 + .2, H - .1, -D / 2 + .16], [W / 2 - .2, H - .1, -D / 2 + .16]], .1, m, { seg: 8, kb: .7 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Atlas : coque basse en bois verni cognac, gros coussins en tissu chiné gris, pivotant */
  atlas(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const bois = matiere('laque', '#8A4E22', { rough: .3 }), gris = matiere('tissu', '#A9ACA8', { motif: 'chine', couleurs: ['#AEB1AD', '#C9CCC8', '#8C8F8B'], echelle: .2 });
    pivot(g, .3, .12, M('chrome'));
    const forme = (u, t) => { const s = u * 2 - 1, [x, z] = planU(u, W / 2 - .04, D * .4, .25, .03); return [x, .14 + t * (.55 - .1 * s * s - .14), z]; };
    coqueParam(g, forme, bois, { ep: .03, nu: 50, nt: 8, cz: .03 });
    galette(g, W / 2 - .1, D / 2 - .1, .2, gris, 0, .14, .04, { ah: .07 });
    coussin(g, W - .2, .42, .2, gris, 0, .32, -D / 2 + .16, { rx: -.15, r: .09, b: [.02, .03, .04] });
    [-1, 1].forEach(k => coussin(g, .18, .26, D - .3, gris, k * (W / 2 - .13), .32, .05, { r: .08, b: [.02, .02, .02] }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Envol : coque enveloppante en tissu gris chiné aux bras inclinés, galette, coussin, patins */
  envol(p) {
    const gris = matiere('tissu', '#8E8F93', { motif: 'chine', couleurs: ['#8E8F93', '#A9AAAE', '#6E6F73'], echelle: .2 });
    const [W, D, H] = p.dim;
    const g = tonneau(p, { ext: gris, hp: .1, bras: .45, tour: 1.65, evase: .12 });
    [-1, 1].forEach(k => boudin(g, [[k * (W / 2 - .12), .02, D / 2 - .12], [k * (W / 2 - .12), .02, -D / 2 + .12]], .02, gris, { seg: 4, haut: [0, 1, 0], kv: 2 }));
    coussin(g, W - .4, .36, .14, gris, 0, .42, -D / 2 + .2, { rx: -.2, r: .07, b: [.01, .02, .03] });
    return g;
  },

  /* Crema Swing : tonneau rond en bouclette crème, pivotant */
  'crema-swing': p => tonneau(p, { ext: matiere('boucle', '#D3DCD0'), hp: .06, bras: .62, tour: 1.95 }),

  /* Pétale Royal : tonneau aux bras en arche couvert de pétales de satin fuchsia */
  'p-tale-royal': p => tonneau(p, { ext: matiere('fourrure', '#AE1F69', { ns: 1.8, rough: .5 }), hp: .03, bras: .62, tour: 1.85, evase: .1 }),
  /* Hortensia : pétales de tissu bleu turquoise sur un bloc en arche (bras jusqu'au sol), assise creusée */
  hortensia(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('fourrure', '#1E8EC4', { ns: 2, rough: .6 });
    [-1, 1].forEach(k => coussin(g, .26, H - .08, D - .04, m, k * (W / 2 - .13), 0, 0, { r: .1, b: [.02, .02, .02] }));
    coussin(g, W - .04, H - .2, .26, m, 0, .2, -D / 2 + .13, { r: .1, b: [.02, .02, .02] });
    coussin(g, W - .48, .18, D - .26, m, 0, .26, .1, { r: .08, b: [.02, .03, .02] });
    coussin(g, W - .5, .24, D - .3, matiere('fourrure', '#14628A', { ns: 2 }), 0, .02, .1, { r: .06 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Arc-en-Ciel : coquillage pivotant en boudins de velours multicolores */
  'arc-en-ciel': p => coquillage(p, ['#2A6BC8', '#E08AB8', '#5FC2E8', '#7B4FB0', '#1E9E9A', '#F2A07A'], { n: 11 }),

  /* Coquille Royale : coquillage en larges pétales de velours rouge sur pied tulipe rouge */
  'coquille-royale': p => coquillage(p, ['#B4141E'], { n: 9, large: true, socle: matiere('velours', '#B4141E') }),

  /* Torus : pouf en anneau, tissu chiné bleu violet */
  torus: p => beignet(p, matiere('tissu', '#5B4A8E', { motif: 'chine', couleurs: ['#54468A', '#7F5EA0', '#3E5FA8', '#2E2A5E'], echelle: .18 })),

  /* Boa : grand pouf en anneau rouge */
  boa: p => beignet(p, matiere('tissu', '#B01E22', { grain: 'chenille', echelle: .25 })),

  /* Bamboo : cocon profond en toile imprimée bambou sur fins pieds en acier noir */
  bamboo(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#F1EFEA', { motif: 'bambou', couleurs: ['#EFEDE8', '#1C1C1E'], echelle: .55 });
    pieds(g, coins(W / 2 - .14, D / 2 - .14), .3, M('noir'), 'compas', { r: .01, ecart: .2 });
    const c = groupe(); c.position.set(0, .28, .02); c.rotation.x = -.35; g.add(c);
    const forme = (u, t) => { const s = u * 2 - 1, phi = s * 1.9, r = .12 + (W / 2 - .12) * Math.sin(Math.PI / 2 * Math.min(1, t * 1.3)); return [r * Math.sin(phi), t * (H - .3) * (1 - .25 * Math.abs(s)), -r * Math.cos(phi) * .85]; };
    coqueParam(c, forme, m, { ep: .05, nu: 56, nt: 14 });
    bordCoque(c, forme, .05, m, { r: .03 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Pois Vert : tonneau pivotant en jacquard vert à pois blancs */
  'pois-vert'(p) {
    const m = matiere('tissu', '#4A8A3A', { motif: 'pois', couleurs: ['#4C8A3C', '#E8EEDF'], echelle: .3 });
    const g = tonneau(p, { ext: m, hp: .08, bras: .55, tour: 1.9 });
    pivot(g, .28, .06, M('noirMat'));
    return g;
  },

  /* Bloom XXL : grande fleur de pétales en velours bleu et vert, base bleu ciel */
  'bloom-xxl'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const bleu = matiere('velours', '#1E44B0'), vert = matiere('velours', '#14705A'), ciel = matiere('velours', '#5CB8D6');
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; sphere(g, .38, ciel, Math.cos(a) * (W / 2 - .38), .1, Math.sin(a) * (D / 2 - .38), 1, .3, 1, 22); }
    sphere(g, .48, bleu, 0, .3, .1, 1.1, .3, 1, 26);
    [[-.5, .16, 1, 0], [.5, .16, 1, 0], [-.42, -.35, 0, 1], [0, -.48, 1, 1], [.42, -.35, 0, 1], [-.62, .05, 0, 1], [.62, .05, 0, 1]].forEach(([x, z, c, haut]) => {
      const a = Math.atan2(x, -z), pe = sphere(g, .34, c ? bleu : vert, x * (W / 1.6), haut ? .52 : .36, z * (D / 1.6), 1.1, .34, 1, 24);
      pe.rotation.set(haut ? -.7 : -.2, a, 0, 'YXZ');
    });
    ombreSol(g, W + .3, D + .3);
    return g;
  }
};
