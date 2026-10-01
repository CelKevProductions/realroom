/* =================================================================
   RealRoom — modèles fidèles : fauteuils (d'après les photos produits)
   Origine au sol, centrée, face avant vers +z.
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, V3, clamp, lerp,
  coussin, boudin, tambour, galette, geoTambour, tourne, panneau, coqueArc, coqueParam, geoCoqueParam, bordCoque, planU, rectCoins, formeLisse, bosseler,
  matiere, matiereAjouree, ombreSol, cyl, sphere, pieds, coins, pivot, boutons
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
// pelage de mouton : coussin très bosselé (longs poils)
function toison(g, w, h, d, m, x, y, z, o = {}) {
  const c = coussin(g, w, h, d, m, x, y, z, Object.assign({ r: Math.min(w, h, d) * .45, seg: 14 }, o));
  bosseler(c.geometry, o.poils ?? .02, 38, 7);
  return c;
}
// œuf suspendu en résine ajourée sur potence (Galaxy, Cocoon Design)
function oeufSuspendu(p, couleur) {
  const g = groupe('fauteuil');
  const [W, D, H] = p.dim;
  const noir = M('noir'), res = matiereAjouree(couleur, .6, .62);
  tambour(g, .42, .04, noir, 0, 0, -.05, { ah: .01 });
  boudin(g, [[0, .03, -.45], [0, H * .5, -.62], [0, H - .1, -.4], [0, H, -.05]], .028, noir, { seg: 40, radial: 10 });
  cyl(g, .006, .006, .25, noir, 0, H - .25, -.02, 6);
  const yb = .28, he = H - .3 - yb;
  const forme = (u, t) => { const phi = u * TAU, r = Math.sin(Math.PI * (.05 + .9 * t)) * (W / 2 - .05) * (1 - .15 * t); return [r * Math.sin(phi), yb + t * he, -.05 - r * Math.cos(phi) * .8]; };
  coqueParam(g, forme, res, { ep: .02, nu: 48, nt: 18, ferme: true, cz: -.05 });
  galette(g, .3, .25, .1, matiere('tissu', '#5A5A5E'), 0, yb + .12, -.05, { ah: .04 });
  ombreSol(g, W + .3, D + .3);
  return g;
}
// lapin (Green Rabbit, Bunny Lounge) : coque pivotante en bouclette, deux grandes oreilles au dossier
function lapin(p, couleur) {
  const g = groupe('fauteuil');
  const [W, D, H] = p.dim;
  const m = matiere('fourrure', couleur, { ns: 1.4 });
  pivot(g, .3, .28, M('noir'));
  const forme = (u, t) => { const s = u * 2 - 1, phi = s * 1.8, r = W / 2 - .06; return [r * Math.sin(phi), .3 + t * (.9 - .32 * Math.pow(Math.abs(s), 1.6) - .3), .02 - r * Math.cos(phi) * .85]; };
  coqueParam(g, forme, m, { ep: .1, nu: 56, nt: 12, cz: .02 });
  bordCoque(g, forme, .1, m, { cz: .02, r: .055 });
  [-1, 1].forEach(k => boudin(g, [[k * .14, .82, -D / 2 + .16], [k * .2, 1.1, -D / 2 + .14], [k * .2, H - .1, -D / 2 + .16]], t => .1 * (1 - .4 * t), m, { haut: [0, 0, 1], kv: .45, seg: 24, kb: .9 }));
  galette(g, W / 2 - .14, D / 2 - .14, .12, m, 0, .32, .06, { ah: .05 });
  ombreSol(g, W + .3, D + .3);
  return g;
}
// bloc couvert de pétales hirsutes (Hortensia, Bloom Icon) : bras jusqu'au sol, assise creusée
function blocPetales(p, couleur, fonce) {
  const g = groupe('fauteuil');
  const [W, D, H] = p.dim;
  const m = matiere('fourrure', couleur, { ns: 2, rough: .6 });
  [-1, 1].forEach(k => coussin(g, .26, H - .08, D - .04, m, k * (W / 2 - .13), 0, 0, { r: .1, b: [.02, .02, .02] }));
  coussin(g, W - .04, H - .2, .26, m, 0, .2, -D / 2 + .13, { r: .1, b: [.02, .02, .02] });
  coussin(g, W - .48, .18, D - .26, m, 0, .26, .1, { r: .08, b: [.02, .03, .02] });
  coussin(g, W - .5, .24, D - .3, matiere('fourrure', fonce, { ns: 2 }), 0, .02, .1, { r: .06 });
  ombreSol(g, W + .3, D + .3);
  return g;
}
// fauteuil à lobes (Bear Paw, Bloom Lounge) : dossier et bras en gros lobes arrondis autour d'une galette
function lobes(p, m, o = {}) {
  const g = groupe('fauteuil');
  const [W, D, H] = p.dim;
  if (o.pivot !== false) pivot(g, .3, .12, M('noir'));
  galette(g, W / 2 - .06, D / 2 - .06, .3, m, 0, .1, .03, { ah: .1 });
  const n = o.n || 6;
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - .5) * Math.PI * 1.25, R = W / 2 - .2, x = Math.sin(a) * R, z = .02 - Math.cos(a) * R * .85;
    const bout = i === 0 || i === n - 1;
    const lobe = sphere(g, .2, m, x, bout ? .5 : H - .2, z, 1, 1.15, .7, 20);
    lobe.rotation.y = -a;
  }
  galette(g, W / 2 - .2, D / 2 - .2, .12, m, 0, .38, .06, { ah: .05 });
  ombreSol(g, W + .3, D + .3);
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
  hortensia: p => blocPetales(p, '#1E8EC4', '#14628A'),

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
  },
  /* Duo Fruit : coupe noire bombée et galette verte comme une pomme, petite queue */
  'duo-fruit'(p) {
    const g = groupe('fauteuil');
    const [W, D] = p.dim;
    const noir = matiere('laque', '#18181A'), vert = matiere('velours', '#3FA52A');
    const R = Math.min(W, D) / 2 - .02;
    tourne(g, [[0, 0], [R * .5, 0], [R * .85, .05], [R, .2], [R * .98, .36], [R * .9, .42], [R * .82, .4], [0, .34]], noir, 0, 0, 0, 48);
    tambour(g, R * .84, .12, vert, 0, .3, 0, { ah: .06, dome: .05 });
    boudin(g, [[0, .46, 0], [.005, .5, .01], [.02, .53, .02]], .008, matiere('bois', '#3A2A1C'), { seg: 8, radial: 6 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Dotty : forme voluptueuse en jersey orange à pois noirs cerclés de jaune */
  'fauteuil-lounge-jersey-pois-orange-dotty'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#D9532A', { motif: 'pois-libres', couleurs: ['#D2502A', '#18181A', '#E8C33A'], echelle: .7 });
    galette(g, W / 2 - .06, D / 2 - .06, .36, m, 0, 0, .04, { b: .05, ah: .14, ab: .06 });
    const forme = (u, t) => {
      const s = u * 2 - 1, phi = s * 1.8, R = W / 2 - .05, bosse = 1 + .12 * Math.sin(Math.PI * t) + .06 * Math.cos(s * 5) * t;
      const top = H - (H - .55) * Math.pow(Math.abs(s), 1.8) + .08 * Math.exp(-Math.pow((Math.abs(s) - .5) / .12, 2));
      return [R * bosse * Math.sin(phi), .25 + t * (top - .25), .04 - R * .9 * bosse * Math.cos(phi)];
    };
    coqueParam(g, forme, m, { ep: .12, nu: 64, nt: 14, cz: .04 });
    bordCoque(g, forme, .12, m, { cz: .04, r: .06 });
    galette(g, W / 2 - .2, D / 2 - .2, .12, m, 0, .34, .08, { ah: .05, dome: .02 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Face : résine laquée noire, dossier en visage percé de deux yeux, assise en bloc */
  face(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('laque', '#111113', { rough: .12 });
    coussin(g, W - .06, .42, D - .14, m, 0, 0, .05, { r: .08, b: [.01, .01, .01] });
    const v = new THREE.Shape(); v.absellipse(0, 0, W / 2 - .05, (H - .38) / 2 + .1, 0, TAU, false);
    [-1, 1].forEach(k => { const o = new THREE.Path(); o.absellipse(k * .12, .06, .06, .025, 0, TAU, true); v.holes.push(o); });
    panneau(g, v, .1, m, 'face', 0, H - (H - .38) / 2 - .1, -D / 2 + .1, { a: .04, rx: -.08 });
    boudin(g, [[0, H - .32, -D / 2 + .17], [0, H - .42, -D / 2 + .2]], .025, m, { seg: 6 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Organika : galet de bouclette blanche sur petits pieds noirs, dossier en boudin porté par une barre */
  organika(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#E9E6DE'), noir = M('noir');
    pieds(g, coins(.18, .16), .06, noir, 'droit', { r: .015 });
    galette(g, W / 2 - .04, D / 2 - .04, .38, m, 0, .05, .03, { b: .04, ah: .15, ab: .08, dome: .02 });
    boudin(g, [[0, .4, -D / 2 + .08], [0, .6, -D / 2 + .02], [0, H - .1, -D / 2 + .06]], .012, noir, { seg: 12, radial: 8 });
    boudin(g, [[-W / 2 + .1, H - .06, -D / 2 + .1], [0, H - .03, -D / 2 + .05], [W / 2 - .1, H - .06, -D / 2 + .1]], .075, m, { seg: 24, kb: .9 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Taupe Royal : tonneau pivotant en velours vert sauge, dossier sculpté, coussin */
  'taupe-royal'(p) {
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#7F8A74');
    const g = tonneau(p, { ext: m, hp: .05, bras: .62, tour: 1.9, evase: .04 });
    coussin(g, W - .44, .32, .13, m, 0, .4, -D / 2 + .2, { rx: -.15, r: .06, b: [.01, .02, .03] });
    return g;
  },

  /* Mouton Rouge : fauteuil à oreilles couvert de fourrure blanche à longs poils, pieds rouges */
  'mouton-rouge'(p) {
    const fur = matiere('fourrure', '#F0EEE8', { ns: 2.2 });
    const g = oreilles(p, { ext: fur, hp: .14, pieds: 'fuseau', mp: matiere('laque', '#A3262B'), hBras: .62 });
    g.traverse(o => { if (o.isMesh && o.material === fur && o.geometry.attributes.normal) bosseler(o.geometry, .012, 45, 5); });
    return g;
  },

  /* Tubo : cadre en tube chromé, assise, dossier et accoudoirs en sangles de cuir de vache */
  'fauteuil-cuir-vache-tubulaire-chrome-tubo'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const ch = M('chrome'), vache = matiere('cuir', '#F2EFE8', { motif: 'vache', couleurs: ['#F2EFE8', '#5A3A24', '#8A5A34'], echelle: .6 });
    const a = W / 2 - .03, b = D / 2 - .03, r = .011, o = { tension: 0, seg: 40, radial: 8 };
    [-1, 1].forEach(k => {
      boudin(g, [[k * a, .01, b], [k * a, .01, -b], [k * a, .42, -b + .05], [k * a, H, -b + .1]], r, ch, o);
      boudin(g, [[k * a, .01, b], [k * a, .4, b], [k * a, .58, b - .02], [k * a, .58, -b + .1]], r, ch, o);
      place(g, mesh(new THREE.BoxGeometry(.006, .09, D - .2), vache), k * (a - .005), .52, .02);
    });
    boudin(g, [[-a, .4, b - .02], [a, .4, b - .02]], r, ch, o);
    boudin(g, [[-a, .3, -b + .03], [a, .3, -b + .03]], r, ch, o);
    const assise = place(g, mesh(new THREE.BoxGeometry(W - .06, .006, D - .15), vache), 0, .36, .03); assise.rotation.x = .1;
    const dos = place(g, mesh(new THREE.BoxGeometry(W - .06, .24, .006), vache), 0, .56, -b + .1); dos.rotation.x = -.2;
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Cloud Pearl : haut dossier enveloppant en bouclette blanche, oreilles, assise, patins noirs incurvés */
  'cloud-pearl'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#ECEBE6'), noir = matiere('laque', '#1A1A1C');
    [-1, 1].forEach(k => boudin(g, [[k * .2, .02, D / 2 - .1], [k * .22, .05, 0], [k * .2, .14, -D / 2 + .12]], .025, noir, { haut: [1, 0, 0], kv: 1.6, seg: 20 }));
    boudin(g, [[-.2, .16, 0], [.2, .16, 0]], .018, M('chrome'), { seg: 6 });
    const forme = (u, t) => {
      const s = u * 2 - 1, phi = s * 1.75, a = W / 2 - .04, b = D / 2 - .1;
      const top = H - (H - .58) * Math.pow(Math.abs(s), 1.7);
      return [a * Math.sin(phi) * (1 - .1 * t), .18 + t * (top - .18), .02 - b * Math.cos(phi)];
    };
    coqueParam(g, forme, m, { ep: .1, nu: 56, nt: 14, cz: .02 });
    bordCoque(g, forme, .1, m, { cz: .02, r: .055 });
    galette(g, W / 2 - .12, D / 2 - .14, .22, m, 0, .2, .06, { ah: .08, dome: .02 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },
  /* Hexa : haute coque en velours terracotta matelassé en nid d'abeille, tablette ronde en bois, pieds noirs */
  'orange-hexa'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#A8401C', { grain: 'hexagones', echelle: .4, ns: .9 });
    pieds(g, coins(W / 2 - .14, D / 2 - .14), .16, M('noirMat'), 'compas', { r: .014, ecart: .1 });
    galette(g, W / 2 - .06, D / 2 - .06, .2, m, 0, .14, .04, { ah: .07 });
    const forme = (u, t) => {
      const s = u * 2 - 1, phi = s * 1.75, a = W / 2 - .04, b = D / 2 - .06;
      const top = H - (H - .55) * Math.pow(Math.abs(s), 1.4);
      return [a * Math.sin(phi) * (1 + .08 * t), .2 + t * (top - .2), .03 - b * Math.cos(phi)];
    };
    coqueParam(g, forme, m, { ep: .09, nu: 56, nt: 14, cz: .03 });
    bordCoque(g, forme, .09, m, { cz: .03, r: .05 });
    galette(g, W / 2 - .15, D / 2 - .16, .14, m, 0, .33, .07, { ah: .06, dome: .02 });
    cyl(g, .16, .16, .02, matiere('bois', '#5A3A24', { couleurs: ['#6A4630', '#3A2416'] }), -W / 2 - .1, .56, .12, 36);
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Black Cream : flancs en coque de cuir noir, gros coussins en tissu chiné vert d'eau */
  'black-cream'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const noir = matiere('cuir', '#1E1D21'), eau = matiere('tissu', '#AECBC4', { motif: 'chine', couleurs: ['#AFCBC4', '#C9DDD8', '#8FB1A8'], echelle: .2 });
    coussin(g, W - .2, .06, D - .2, M('laiton'), 0, 0, 0, { r: .015, b: [0, 0, 0] });
    const forme = (u, t) => { const s = u * 2 - 1, [x, z] = planU(u, W / 2 - .02, D * .52, .3, .06); return [x, .05 + t * (H - .2 - .1 * s * s - .05), z]; };
    coqueParam(g, forme, noir, { ep: .05, nu: 50, nt: 10, cz: .03 });
    bordCoque(g, forme, .05, noir, { cz: .03, r: .03 });
    coussin(g, W - .24, .34, D - .26, eau, 0, .06, .08, { r: .06 });
    coussin(g, W - .3, .42, .18, eau, 0, .38, -D / 2 + .22, { rx: -.12, r: .08, b: [.01, .02, .04] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Black & Blossom : tonneau évasé, simili cuir noir dehors, toile fleurie noir et blanc dedans */
  black(p) {
    const fleurs = matiere('tissu', '#F2F0EA', { motif: 'floral', couleurs: ['#F0EEE8', '#1C1C1E', '#4A4A4C', '#2A2A2C', '#F0EEE8'], echelle: .45 });
    return tonneau(p, { ext: matiere('cuir', '#1C1B1E'), int: fleurs, galette: fleurs, pieds: 'fuseau', mp: matiere('laque', '#1A1A1C'), hp: .12, bras: .62, evase: .18 });
  },

  /* Duo Flower : coque en deux pétales de bouclette sauge sur pied tulipe chromé */
  'duo-flower'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#B3B6AC');
    tourne(g, [[0, 0], [.24, 0], [.23, .015], [.06, .08], [.045, .36], [0, .36]], M('chrome'), 0, 0, 0, 40);
    galette(g, .27, .25, .08, m, 0, .36, .05, { ah: .035, dome: .01 });
    const forme = (u, t) => {
      const s = u * 2 - 1, phi = s * 1.9, r = .1 + (W / 2 - .1) * Math.sin(Math.PI / 2 * Math.min(1, t * 1.25));
      const lobe = .12 * Math.exp(-Math.pow((Math.abs(s) - .6) / .25, 2)) - .1 * Math.exp(-Math.pow(s / .2, 2));
      return [r * Math.sin(phi), .36 + t * (H - .36 + lobe - .15 * s * s), .03 - r * Math.cos(phi) * .9];
    };
    coqueParam(g, forme, m, { ep: .07, nu: 56, nt: 14, cz: .03 });
    bordCoque(g, forme, .07, m, { cz: .03, r: .04 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Marilyn : coque d'œuf laquée noire, intérieur en velours moutarde, pied disque pivotant */
  marilyn(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const noir = matiere('laque', '#121214', { rough: .12 }), jaune = matiere('velours', '#B48A14');
    pivot(g, .3, .3, M('noir'));
    const forme = d => (u, t) => {
      const s = u * 2 - 1, phi = s * 1.85, r = (W / 2 - .02 - d) * Math.sin(Math.PI * (.15 + .7 * t)) + .05;
      return [r * Math.sin(phi), .3 + t * (H - .3 - d * .5 - .25 * s * s), .02 - r * Math.cos(phi) * .95];
    };
    coqueParam(g, forme(0), noir, { ep: .03, nu: 56, nt: 14, cz: .02 });
    coqueParam(g, forme(.03), jaune, { ep: .05, nu: 56, nt: 14, cz: .02 });
    galette(g, W / 2 - .14, D / 2 - .14, .1, jaune, 0, .36, .06, { ah: .04 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Opera : cuir vert sauge, flancs pleins jusqu'au sol soulignés de laiton, coussins surpiqués */
  opera(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('cuir', '#7E8778'), lt = M('laiton');
    const ep = .13;
    [-1, 1].forEach(k => {
      coussin(g, ep, .6, D - .04, m, k * (W / 2 - ep / 2), 0, 0, { r: .04, b: [.005, .005, .005] });
      place(g, mesh(new THREE.BoxGeometry(.012, .5, .006), lt), k * (W / 2 - ep / 2), .3, D / 2 - .015);
    });
    coussin(g, W - .02, .62, .14, m, 0, 0, -D / 2 + .07, { r: .04 });
    coussin(g, W - 2 * ep, .28, D - .16, m, 0, .08, .06, { r: .04 });
    coussin(g, W - 2 * ep - .01, .12, D - .2, m, 0, .35, .07, { r: .04, b: [.005, .02, .01] });
    coussin(g, W - 2 * ep - .04, .38, .14, m, 0, .42, -D / 2 + .2, { rx: -.12, r: .05 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Sapin : cocon avachi en velours chenille vert de gris, gros bourrelet tout autour */
  sapin(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('chenille', '#59604F', { ns: .8 });
    galette(g, W / 2 - .04, D / 2 - .04, .3, m, 0, 0, .02, { b: .03, ah: .1, ab: .05 });
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, s = u * 2 - 1, [x, z] = planU(u, W / 2 - .17, D * .32, .45, .03); pts.push([x, .44 + .1 * (1 - s * s), z]); }
    boudin(g, pts, .17, m, { plan: true, kv: 1.3, seg: 72, radial: 20, kb: .9 });
    galette(g, W / 2 - .2, D / 2 - .2, .14, m, 0, .28, .08, { ah: .06, dome: .03 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Bambou : assise longue en bouclette imprimée bambou, dossier droit, pieds noirs */
  bambou(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#EDEBE5', { motif: 'bambou', couleurs: ['#ECEAE4', '#24372A'], echelle: .55 });
    pieds(g, coins(W / 2 - .06, D / 2 - .06), .1, M('noirMat'), 'carre', { r: .02 });
    coussin(g, W, .26, D, m, 0, .1, 0, { r: .05 });
    coussin(g, W - .04, .1, D - .2, m, 0, .35, .08, { r: .04, b: [.005, .02, .015] });
    coussin(g, W, H - .36, .16, m, 0, .36, -D / 2 + .08, { rx: -.08, r: .05 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Blue Wave : ruban de velours bleu ciel qui s'enroule en assise et dossier, sur pied évasé bronze */
  'blue-wave'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#5E9FCE');
    tourne(g, [[0, 0], [.3, 0], [.28, .03], [.1, .16], [.08, .3], [0, .3]], matiere('laque', '#5A3E2A', { rough: .4 }), 0, 0, 0, 40);
    boudin(g, [[0, .44, D / 2 - .08], [0, .36, .1], [0, .34, -.12], [0, .45, -D / 2 + .1], [0, H - .05, -D / 2 + .02], [0, H - .1, -D / 2 + .22], [0, .62, -D / 2 + .3]], .07, m,
      { haut: [1, 0, 0], kv: (W / 2 - .04) / .07, seg: 80, radial: 18, kb: .8 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* P40 : piètement croisé en métal laqué rouge, galette capitonnée en cuir vert, dossier en jonc rouge */
  p40(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const rouge = matiere('laque', '#B3202A'), vert = matiere('cuir', '#1F5A44', { grain: 'carres', echelle: .3 });
    [-1, 1].forEach(k => {
      boudin(g, [[k * .26, .01, D / 2 - .04], [k * .2, .2, .05], [k * .22, .38, -D / 2 + .1]], .012, rouge, { seg: 20, radial: 8 });
      boudin(g, [[k * .26, .01, -D / 2 + .04], [k * .2, .2, -.05], [k * .22, .38, D / 2 - .1]], .012, rouge, { seg: 20, radial: 8 });
    });
    coussin(g, W - .06, .1, D - .1, vert, 0, .38, .02, { r: .03, b: [.01, .015, .01] });
    boudin(g, [[-W / 2 + .06, .48, .05], [-W / 2 + .08, .7, -D / 2 + .12], [0, H - .02, -D / 2 + .04], [W / 2 - .08, .7, -D / 2 + .12], [W / 2 - .06, .48, .05]], .01, rouge, { seg: 50, radial: 8 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Houndstooth : large assise et dossier en pied-de-poule noir et blanc sur patins en métal noir */
  'houndstooth-sofa'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#888', { motif: 'pied-de-poule', couleurs: ['#ECE9E2', '#18181A'], echelle: .7 });
    [-1, 1].forEach(k => boudin(g, [[k * (W / 2 - .1), .01, D / 2 - .06], [k * (W / 2 - .1), .01, -D / 2 + .08], [k * (W / 2 - .1), .2, -D / 2 + .1]], .012, M('noir'), { tension: 0, seg: 20, radial: 8 }));
    coussin(g, W - .1, .26, D - .1, m, 0, .14, .03, { r: .06 });
    coussin(g, W - .12, .5, .2, m, 0, .3, -D / 2 + .12, { rx: -.15, r: .08, b: [.01, .02, .03] });
    [-1, 1].forEach(k => coussin(g, .1, .2, D - .2, m, k * (W / 2 - .07), .36, .02, { r: .04 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Root : tonneau en bouclette verte au dossier percé de ronds */
  root(p) {
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#5E8A60'), sombre = M('noirMat');
    const g = tonneau(p, { ext: m, hp: .1, pieds: 'droit', mp: sombre, bras: .58, tour: 1.85 });
    // perçages : pastilles sombres traversant la coque
    for (let i = 0; i < 14; i++) {
      const s = (i % 7) / 6 * 1.6 - .8, y = i < 7 ? .62 : .5, phi = s * 1.85, a = W / 2 - .04, b = D / 2 - .04, k = 1 + .06 * .8;
      const tr = cyl(g, .028, .028, .1, sombre, a * k * Math.sin(phi), y - .05, .04 - b * k * Math.cos(phi), 12);
      tr.rotation.set(Math.PI / 2, 0, 0); tr.rotation.order = 'YXZ'; tr.rotation.y = -phi;
    }
    return g;
  },

  /* Loop : assise en pompons de bouclette rouge sur fin piètement noir, dossier en arc */
  'fauteuil-arque-bouclette-rouge-loop'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('fourrure', '#B3141C', { ns: 2 }), noir = M('noir');
    const L = Math.min(W, 1.1);
    pieds(g, coins(L / 2 - .1, D / 2 - .1), .3, noir, 'droit', { r: .01 });
    for (let i = 0; i < 9; i++) { const x = -L / 2 + .1 + (i % 5) / 4 * (L - .2), z = i < 5 ? .07 : -.07; sphere(g, .11, m, x + (i < 5 ? 0 : (L - .2) / 8), .38, z, 1, .85, 1, 18); }
    boudin(g, [[-L / 2 + .02, .35, -D / 2 + .05], [-L / 2 + .1, H - .08, -D / 2 + .04], [0, H, -D / 2 + .02], [L / 2 - .1, H - .08, -D / 2 + .04], [L / 2 - .02, .35, -D / 2 + .05]], .065, m, { seg: 50 });
    ombreSol(g, L + .3, D + .3);
    return g;
  },

  /* Cage Galactique : cage dorée en barreaux et dôme, assise en peau de vache, coussins */
  'cage-galactique'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const or = M('laiton'), R = Math.min(W, D) / 2 - .02;
    tambour(g, R + .02, .08, or, 0, 0, 0, { ah: .01 });
    const n = 26, hb = H - R * .9;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - .5) * Math.PI * 1.5, x = Math.sin(a) * R, z = -Math.cos(a) * R;
      const pts = [[x, .08, z], [x, hb, z]];
      for (let k = 1; k <= 5; k++) { const t = k / 5 * Math.PI / 2; pts.push([x * Math.cos(t), hb + Math.sin(t) * R * .9, z * Math.cos(t)]); }
      boudin(g, pts, .006, or, { seg: 30, radial: 6, bouts: false });
    }
    [.35, hb].forEach(y => { const pts = []; for (let i = 0; i <= 30; i++) { const a = (i / 30 - .5) * Math.PI * 1.5; pts.push([Math.sin(a) * R, y, -Math.cos(a) * R]); } boudin(g, pts, .008, or, { seg: 60, radial: 6, bouts: false }); });
    coussin(g, W - .2, .26, D - .2, matiere('cuir', '#EFEBE3', { motif: 'vache', couleurs: ['#F0ECE4', '#2A2420', '#5A4A3A'], echelle: .5 }), 0, .08, .05, { r: .06 });
    [-.18, .18].forEach(x => coussin(g, .34, .32, .12, matiere('tissu', '#C49A5A', { motif: 'pois-libres', couleurs: ['#C9A06A', '#2A2018', '#8A6A3A'], echelle: .3 }), x, .34, -R + .2, { rx: -.3, r: .05 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Galaxy : œuf suspendu en résine ajourée rose corail, coussin, potence noire sur socle rond */
  'hamac-galaxy': p => oeufSuspendu(p, '#E8857C'),

  /* Green Rabbit : coque pivotante en bouclette vert gazon, deux grandes oreilles au dossier */
  'green-rabbit': p => lapin(p, '#7FBF2A'),
  /* Twist Cord : tonneau en corde tressée vert fluo, boucles de corde qui pendent du rebord */
  'twist-cord'(p) {
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#6AD02A', { grain: 'chenille', echelle: .12, ns: 1.2 });
    const g = tonneau(p, { ext: m, hp: .12, pieds: 'droit', mp: M('noirMat'), bras: .6, tour: 1.8 });
    for (let i = 0; i < 26; i++) {
      const s = i / 25 * 2 - 1, phi = s * 1.8, a = W / 2 - .02, b = D / 2 - .02, top = H - (H - .6) * Math.pow(Math.abs(s), 2.4);
      const x = a * 1.06 * Math.sin(phi), z = .04 - b * 1.06 * Math.cos(phi), l = .08 + (i % 3) * .04;
      boudin(g, [[x, top - .02, z], [x * 1.04, top - l, z * 1.04 + (z > 0 ? .01 : -.01)], [x * 1.01, top - .05, z * 1.01]], .011, m, { seg: 10, radial: 6 });
    }
    return g;
  },

  /* Dossier Haut : relax à oreilles, tissu chiné vert, flancs en suédine taupe, pied pivotant */
  'fauteuil-relax-dossier-haut-tissu-chine-vert'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const vert = matiere('tissu', '#4A6446', { motif: 'chine', couleurs: ['#4A6446', '#6A8462', '#33482F'], echelle: .2 }), taupe = matiere('velours', '#857868');
    pivot(g, .3, .1, M('noir'));
    coussin(g, W - .06, .3, D - .1, taupe, 0, .08, .02, { r: .08 });
    [-1, 1].forEach(k => coussin(g, .14, .3, D - .2, taupe, k * (W / 2 - .08), .36, .02, { r: .06 }));
    coussin(g, W - .3, .14, D - .26, vert, 0, .37, .08, { r: .06, b: [.01, .03, .02] });
    coussin(g, W - .2, .62, .2, vert, 0, .42, -D / 2 + .14, { rx: -.15, r: .09, b: [.01, .02, .04] });
    [-1, 1].forEach(k => coussin(g, .14, .36, .28, vert, k * (W / 2 - .12), .72, -D / 2 + .22, { ry: k * .35, rx: -.15, ordre: 'YXZ', r: .06 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Bloom Gold : transat haut en tube doré, coussins imprimés éclaboussures pêche sur marine */
  'bloom-gold'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const or = M('laiton'), m = matiere('tissu', '#1E2A4F', { motif: 'mineral', couleurs: ['#1C284C', '#24315A', '#E2B89E', '#F4D6C4'], echelle: .5 });
    const a = W / 2 - .03;
    [-1, 1].forEach(k => {
      boudin(g, [[k * a, .01, D / 2 - .05], [k * a, .34, D / 2 - .1], [k * a, .36, -D / 2 + .2], [k * a, H - .02, -D / 2 + .02]], .011, or, { tension: 0, seg: 40, radial: 8 });
      boudin(g, [[k * a, .01, -D / 2 + .12], [k * a, .34, -D / 2 + .2]], .011, or, { seg: 8, radial: 8 });
    });
    coussin(g, W - .1, .1, D - .3, m, 0, .34, .06, { r: .04, b: [.005, .02, .01] });
    const d = coussin(g, W - .1, H - .4, .1, m, 0, .38, -D / 2 + .16, { rx: -.42, r: .045 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Papillon : bergère à oreilles capitonnée, imprimé de papillons, pieds bois */
  papillon: p => oreilles(p, { ext: matiere('tissu', '#D7DDE1', { motif: 'papillons', couleurs: ['#D5DBDF', '#2A3E6A', '#7A5238'], echelle: .4 }),
    dossier: matiere('tissu', '#D7DDE1', { motif: 'papillons', couleurs: ['#D5DBDF', '#2A3E6A', '#7A5238'], echelle: .4, grain: 'capiton' }), pieds: 'tourne', mp: matiere('bois', '#5A3A24'), hBras: .66 }),

  /* Jungle Pop : coque basse en simili cuir noir tressé, coussins en velours jacquard jungle, étoile noire */
  'jungle-pop'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const noir = matiere('cuir', '#1C1B1E', { grain: 'tissage', echelle: .12, ns: .8 }), jungle = matiere('velours', '#2E5A2E', { motif: 'feuillage', couleurs: ['#1A281C', '#3E7A3A', '#8AB03A', '#D0C24A', '#2E5A2E'], echelle: .4 });
    pivot(g, .34, .26, M('noir'), 'etoile', 4);
    const forme = (u, t) => { const s = u * 2 - 1, phi = s * 1.85, r = W / 2 - .04; return [r * Math.sin(phi) * (1 + .1 * t), .28 + t * (H - .05 - (H - .5) * Math.pow(Math.abs(s), 1.6) - .28), .03 - r * .9 * Math.cos(phi)]; };
    coqueParam(g, forme, noir, { ep: .05, nu: 56, nt: 12, cz: .03 });
    bordCoque(g, forme, .05, noir, { cz: .03, r: .03 });
    galette(g, W / 2 - .1, D / 2 - .12, .15, jungle, 0, .3, .06, { ah: .06, dome: .02 });
    coussin(g, W - .36, .4, .14, jungle, 0, .42, -D / 2 + .2, { rx: -.25, r: .07, b: [.01, .02, .03] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Bear Paw : fausse fourrure vert sapin, dossier festonné en gros lobes, galette, pied pivotant */
  'bear-paw': p => lobes(p, matiere('fourrure', '#174A30', { ns: 2 })),

  /* Globe : boule de cuir moutarde capitonnée, dossier inclinable posé dessus */
  globe(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('cuir', '#B07818'), cap = matiere('cuir', '#B07818', { grain: 'capiton', echelle: .5 });
    tourne(g, [[0, 0], [.22, 0], [.36, .06], [.42, .22], [.4, .4], [.33, .5], [0, .52]], cap, 0, 0, 0, 48);
    galette(g, .3, .3, .06, m, 0, .48, .02, { ah: .03, dome: .02 });
    coussin(g, W - .3, .42, .16, m, 0, .5, -D / 2 + .16, { rx: -.35, r: .08, b: [.01, .03, .04] });
    ombreSol(g, W + .2, D + .2);
    return g;
  },

  /* Knitty : gros boudins de corde tricotée bleu ciel entrelacés en assise, dos et bras */
  knitty(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#8FB8D6', { grain: 'chenille', echelle: .1, ns: 1.2 }), r = .07;
    for (let i = 0; i < 5; i++) boudin(g, [[-W / 2 + .18 + i * (W - .36) / 4, .3, D / 2 - .06], [-W / 2 + .18 + i * (W - .36) / 4, .33, 0], [-W / 2 + .18 + i * (W - .36) / 4, .3, -D / 2 + .2]], r, m, { seg: 12 });
    for (let j = 0; j < 4; j++) boudin(g, [[-W / 2 + .08, .2 + j * .13, -D / 2 + .1], [0, .22 + j * .13, -D / 2 + .06], [W / 2 - .08, .2 + j * .13, -D / 2 + .1]], r, m, { seg: 12 });
    [-1, 1].forEach(k => { for (let j = 0; j < 3; j++) boudin(g, [[k * (W / 2 - .08), .14 + j * .13, D / 2 - .06], [k * (W / 2 - .09), .16 + j * .13, -D / 2 + .12]], r, m, { seg: 8 }); });
    [-.25, .25].forEach(x => boudin(g, [[x, .06, D / 2 - .1], [x, .42, D / 2 - .2], [x * 1.1, .4, 0], [x, .6, -D / 2 + .05]], r * .9, m, { seg: 24 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Mouton Bleu : coussins de fourrure longue bleu gris sur fin piètement noir */
  'mouton-bleu'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('fourrure', '#6E7A8C', { ns: 2.4 });
    pieds(g, coins(W / 2 - .1, D / 2 - .1), .32, M('noir'), 'droit', { r: .008 });
    toison(g, W, .22, D - .05, m, 0, .28, .02, { poils: .025 });
    toison(g, W - .04, H - .42, .2, m, 0, .44, -D / 2 + .1, { rx: -.12, poils: .025 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Mouton Blanc : même ligne en fourrure blanche bouclée */
  'mouton-blanc'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('fourrure', '#F0EEE8', { ns: 2.4 });
    pieds(g, coins(W / 2 - .1, D / 2 - .1), .3, M('noir'), 'droit', { r: .008 });
    toison(g, W, .2, D - .05, m, 0, .26, .02, { poils: .025 });
    toison(g, W - .04, H - .38, .18, m, 0, .4, -D / 2 + .09, { rx: -.12, poils: .025 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Column : chapiteau ionique en résine blanche, assise creusée entre deux volutes, fût cannelé */
  column(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('laque', '#EDEBE6', { rough: .7 }), fut = matiere('laque', '#EDEBE6', { rough: .7, grain: 'cannelure', echelle: .6, ns: 1 });
    tambour(g, .32, .36, fut, -W * .12, 0, 0, { ah: .02, ab: .01 });
    // assise creusée entre deux grosses volutes
    const fs = new THREE.Shape(), L = W / 2 - .26;
    fs.moveTo(-L, H - .22); fs.quadraticCurveTo(-L * .45, .42, 0, .44); fs.quadraticCurveTo(L * .45, .42, L, H - .22); fs.lineTo(L, .3); fs.lineTo(-L, .3); fs.closePath();
    panneau(g, fs, D - .12, m, 'face', 0, 0, 0, { a: .05 });
    [-1, 1].forEach(k => {
      const R = .26, cx = k * (W / 2 - R - .02), cy = H - R - .02;
      const disque = cyl(g, R, R, D - .1, m, cx, cy - (D - .1) / 2, 0, 40); disque.rotation.x = Math.PI / 2; disque.position.set(cx, cy, 0);
      [-1, 1].forEach(f => {
        const pts = []; for (let i = 0; i <= 50; i++) { const a = i / 50 * TAU * 2.2, rr = R * (1 - i / 62); pts.push([cx + k * Math.cos(a) * rr, cy + Math.sin(a) * rr, f * (D / 2 - .04)]); }
        boudin(g, pts, .016, m, { seg: 100, radial: 8 });
      });
    });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Fleur : grande fleur pivotante en velours côtelé rouge, pétales plissés en corolle */
  fleur(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('cotele', '#A8141E', { echelle: .15 });
    pivot(g, .3, .2, M('chrome'));
    // pétales dressés en coupe, penchés vers l'extérieur ; plus bas devant
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, R = W / 2 - .38, ux = Math.sin(a), uz = -Math.cos(a), devant = uz > .5;
      const pe = sphere(g, .36, m, ux * R, devant ? .36 : .56, uz * R * .9, 1.15, devant ? .7 : 1.05, .2, 22);
      pe.rotation.set(devant ? 1.1 : .55, Math.PI - a, 0, 'YXZ');
    }
    galette(g, .36, .34, .14, m, 0, .2, .04, { ah: .06, dome: .03 });
    ombreSol(g, W + .2, D + .2);
    return g;
  },

  /* Mouton Beige : à oreilles en peau de mouton beige, accoudoirs et pieds en bois courbé */
  'mouton-beige'(p) {
    const fur = matiere('fourrure', '#C9AE7E', { ns: 2.4 }), bois = matiere('bois', '#5A3A24', { couleurs: ['#6A4630', '#3A2416'] });
    const [W, D, H] = p.dim;
    const g = oreilles(p, { ext: fur, hp: .12, pieds: 'fuseau', mp: bois, hBras: .6 });
    [-1, 1].forEach(k => boudin(g, [[k * (W / 2 - .02), .6, -D / 2 + .25], [k * (W / 2 + .01), .63, .1], [k * (W / 2 - .01), .55, D / 2 - .04], [k * (W / 2 - .04), .14, D / 2 - .1]], .018, bois, { haut: [1, 0, 0], kv: 1.6, seg: 30 }));
    return g;
  },

  /* Milano Swivel : chenille bouclée vert d'eau, flancs en bois courbé, pied pivotant chromé */
  'milano-swivel'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#A9C2C0', { motif: 'chine', couleurs: ['#A9C2C0', '#D6E2E0', '#7E9896'], echelle: .15 }), bois = matiere('laque', '#4A2A1A', { rough: .35 });
    pivot(g, .3, .2, M('chrome'));
    coussin(g, W - .1, .16, D - .1, m, 0, .2, .02, { r: .06 });
    coussin(g, W - .14, .16, D - .2, m, 0, .34, .06, { r: .06, b: [.01, .03, .02] });
    coussin(g, W - .1, .42, .22, m, 0, .36, -D / 2 + .14, { rx: -.25, r: .09, b: [.01, .02, .04] });
    [-1, 1].forEach(k => boudin(g, [[k * (W / 2 - .02), .22, D / 2 - .06], [k * (W / 2), .5, D / 2 - .12], [k * (W / 2 + .01), .58, 0], [k * (W / 2), .62, -D / 2 + .08]], .02, bois, { haut: [1, 0, 0], kv: 2.5, seg: 30 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Fleur de Nuit : dossier festonné en bouclette jaune, assise texturée rose, accoudoirs bois */
  'fleur-de-nuit-jaune-et-rose'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const jaune = matiere('boucle', '#E2CE52'), rose = matiere('tissu', '#E3A8B2', { grain: 'carres', echelle: .2 }), bois = matiere('bois', '#4A2E1C', { couleurs: ['#5A3A24', '#3A2214'] });
    pieds(g, coins(W / 2 - .06, D / 2 - .06), .1, bois, 'carre', { r: .02 });
    coussin(g, W - .04, .34, D - .06, rose, 0, .1, .02, { r: .05 });
    const fs = new THREE.Shape(), l = W - .14, h0 = H - .4;
    fs.moveTo(-l / 2, 0); fs.lineTo(l / 2, 0); fs.lineTo(l / 2 + .04, h0 * .7);
    for (let i = 0; i <= 30; i++) { const u = i / 30, x = l / 2 + .04 - u * (l + .08); fs.lineTo(x, h0 * .78 + .1 * Math.abs(Math.sin(u * Math.PI * 2)) + .08 * Math.sin(u * Math.PI)); }
    fs.lineTo(-l / 2, 0);
    panneau(g, fs, .12, jaune, 'face', 0, .42, -D / 2 + .09, { a: .04, rx: -.08 });
    [-1, 1].forEach(k => boudin(g, [[k * (W / 2 - .03), .44, -D / 2 + .1], [k * (W / 2 - .02), .62, -.1], [k * (W / 2 - .03), .6, D / 2 - .05], [k * (W / 2 - .03), .44, D / 2 - .06]], .02, bois, { haut: [1, 0, 0], kv: 1.8, seg: 30 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Fleur de Nuit (noir) : pouf en velours noir en forme d'ours couché, museau clair */
  'fleur-de-nuit-noir'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#17171A'), museau = matiere('velours', '#E8E2D8');
    sphere(g, .28, m, -.08, .25, 0, 1.45, .85, .95, 28);
    sphere(g, .17, m, W / 2 - .2, .3, 0, 1, .95, .95, 24);
    sphere(g, .07, museau, W / 2 - .05, .26, 0, 1.3, .8, .9, 16);
    [-1, 1].forEach(k => { sphere(g, .05, m, W / 2 - .24, .45, k * .1, .6, 1, 1, 12); sphere(g, .06, m, .15, .05, k * .17, 1.4, .8, 1, 12); sphere(g, .06, m, -.32, .05, k * .17, 1.4, .8, 1, 12); });
    ombreSol(g, W + .2, D + .2);
    return g;
  },
  /* Curva : fauteuil de table, coque en noyer cintré, cuir bleu marine dedans, pieds fuselés en noyer */
  'em-350'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const noyer = matiere('bois', '#6A4630', { couleurs: ['#7A5238', '#4A2E1C'] }), cuir = matiere('cuir', '#1E2A4A');
    pieds(g, coins(W / 2 - .06, D / 2 - .06), .44, noyer, 'compas', { r: .018, ecart: .06 });
    coussin(g, W - .04, .08, D - .06, noyer, 0, .42, .02, { r: .02 });
    coussin(g, W - .08, .08, D - .1, cuir, 0, .48, .04, { r: .03, b: [.005, .015, .01] });
    const forme = d => (u, t) => { const s = u * 2 - 1, phi = s * 1.6, a = W / 2 - .02 - d, b = D / 2 - .04 - d; return [a * Math.sin(phi), .45 + t * (H - d * .3 - .08 * s * s - .45), .03 - b * Math.cos(phi)]; };
    coqueParam(g, forme(0), noyer, { ep: .015, nu: 40, nt: 8, cz: .03 });
    coqueParam(g, forme(.015), cuir, { ep: .03, nu: 40, nt: 8, cz: .03 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Fauteuil de salle à manger : housse de bouclette écrue jusqu'au sol, dossier haut droit */
  'ce-320'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#E9E3D4');
    coussin(g, W, .48, D, m, 0, 0, 0, { r: .03, b: [.004, .004, .004] });
    coussin(g, W, H - .42, .1, m, 0, .42, -D / 2 + .05, { rx: -.05, r: .04 });
    coussin(g, W - .04, .06, D - .14, m, 0, .47, .04, { r: .025 });
    ombreSol(g, W + .2, D + .2);
    return g;
  },

  /* Tressia : grosse corde tressée terracotta en fer à cheval, coussins de bouclette écrue, pieds bois foncé */
  'tl-420'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const corde = matiere('tissu', '#8A5233', { grain: 'chenille', echelle: .1, ns: 1 }), m = matiere('boucle', '#EDE7DA');
    pieds(g, coins(W / 2 - .14, D / 2 - .14), .18, matiere('bois', '#3A2416'), 'compas', { r: .016, ecart: .1 });
    coussin(g, W - .2, .14, D - .16, m, 0, .17, .03, { r: .06 });
    // trois brins torsadés autour d'un chemin en U, sur deux étages
    [.38, .54, .7].forEach((y, e) => {
      for (let b = 0; b < 3; b++) {
        const pts = [];
        for (let i = 0; i <= 60; i++) {
          const u = i / 60, s = u * 2 - 1, [x, z] = planU(u, W / 2 - .1, D * .36, .38, .03), a = u * TAU * 4.5 + b * TAU / 3, l = Math.hypot(x, z - .03) || 1;
          const yy = y - (e === 2 ? .12 * s * s : 0);
          pts.push([x + x / l * Math.cos(a) * .045, yy + Math.sin(a) * .045, z + (z - .03) / l * Math.cos(a) * .045]);
        }
        boudin(g, pts, .055, corde, { seg: 180, radial: 10 });
      }
    });
    coussin(g, W - .3, .16, D - .3, m, 0, .3, .08, { r: .07, b: [.01, .03, .02] });
    coussin(g, W - .4, .38, .16, m, 0, .4, -D / 2 + .22, { rx: -.15, r: .08, b: [.01, .02, .04] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Lounge beige : bâti en bois massif, montants à boules, barreaux, coussins rayés beige et écru */
  'flr-085'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const bois = matiere('bois', '#6E4A30', { couleurs: ['#7E5638', '#55361F'] }), ray = matiere('tissu', '#E8E0D0', { motif: 'rayures', couleurs: ['#D2C2A2', '#F1EDE4'], echelle: .55 });
    const a = W / 2 - .03, b = D / 2 - .03;
    [[-a, b, .62], [a, b, .62], [-a, -b, H - .04], [a, -b, H - .04]].forEach(([x, z, h]) => { cyl(g, .022, .02, h, bois, x, 0, z, 12); sphere(g, .035, bois, x, h + .02, z, 1, 1, 1, 14); });
    [-1, 1].forEach(k => {
      place(g, mesh(new THREE.BoxGeometry(.04, .04, D), bois), k * a, .26, 0);
      place(g, mesh(new THREE.BoxGeometry(.04, .04, D), bois), k * a, .58, 0);
      for (let i = 1; i < 7; i++) cyl(g, .009, .009, .32, bois, k * a, .26, -b + i * (2 * b) / 7, 8);
    });
    place(g, mesh(new THREE.BoxGeometry(W, .04, .04), bois), 0, .26, b);
    coussin(g, W - .1, .2, D - .1, ray, 0, .28, .03, { r: .07, b: [.01, .03, .02] });
    coussin(g, W - .12, .5, .2, ray, 0, .42, -D / 2 + .14, { rx: -.1, r: .08, b: [.01, .02, .04] });
    [-1, 1].forEach(k => coussin(g, .12, .3, D - .2, ray, k * (W / 2 - .1), .42, .02, { r: .05 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Fauteuil à bascule : patins pleins en bois laqué noir, galette de cuir noir patiné, coussin jacquard fleuri */
  'rr-03'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const noir = matiere('laque', '#18181A', { rough: .3 }), cuir = matiere('cuir', '#232226', { rough: .6 });
    const fleurs = matiere('tissu', '#2A2420', { motif: 'floral', couleurs: ['#221E1A', '#D9C6A0', '#B08A5A', '#5A4A3A', '#E8D8B8'], echelle: .4 });
    const fs = new THREE.Shape();
    fs.moveTo(D / 2, .06); fs.quadraticCurveTo(0, -.06, -D / 2, .1); fs.lineTo(-D / 2 + .08, .5); fs.lineTo(-D / 2 + .25, .42); fs.lineTo(D / 2 - .1, .36); fs.closePath();
    [-1, 1].forEach(k => panneau(g, fs, .06, noir, 'cote', k * (W / 2 - .03), .02, 0, { a: .02 }));
    coussin(g, W - .1, .12, D - .2, cuir, 0, .34, .04, { r: .05, rx: .06 });
    coussin(g, W - .14, .5, .14, cuir, 0, .44, -D / 2 + .16, { rx: -.35, r: .06 });
    coussin(g, W - .2, .42, .14, fleurs, 0, .5, -D / 2 + .3, { rx: -.35, r: .07, b: [.01, .02, .04] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Swivel Chic : tonneau pivotant en prince-de-galles noir et blanc, coussin, socle chromé */
  'sc-05'(p) {
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#8A8A8A', { motif: 'pied-de-poule', couleurs: ['#C9C9C5', '#6A6A6E'], echelle: .4 });
    const g = tonneau(p, { ext: m, hp: .06, bras: .6, tour: 1.9 });
    pivot(g, .3, .05, M('chrome'));
    coussin(g, W - .4, .32, .13, m, 0, .42, -D / 2 + .2, { rx: -.2, r: .06, b: [.01, .02, .03] });
    return g;
  },

  /* Pan Pan : bloc en bouclette crème, flancs et dos en toile matelassée noire */
  'ppc-0'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const creme = matiere('boucle', '#E8E2D2'), noir = matiere('tissu', '#1C1C1F', { grain: 'carres', echelle: .3 });
    [-1, 1].forEach(k => coussin(g, .16, .62, D, noir, k * (W / 2 - .08), 0, 0, { r: .04 }));
    coussin(g, W - .32, H, .18, creme, 0, 0, -D / 2 + .09, { r: .05 });
    coussin(g, W - .32, .4, D - .18, creme, 0, 0, .09, { r: .05, b: [.005, .02, .01] });
    [-1, 1].forEach(k => coussin(g, .14, .2, D - .2, creme, k * (W / 2 - .22), .4, .06, { r: .06 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Archi : bouclé chiné bordeaux, plans inclinés (assise, dossier) entre des accoudoirs cubiques */
  'alc-07'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#5E2622', { motif: 'chine', couleurs: ['#5E2622', '#8A4A3A', '#3A1612'], echelle: .15 });
    [-1, 1].forEach(k => coussin(g, .2, .6, D - .04, m, k * (W / 2 - .1), 0, 0, { r: .04, b: [.004, .004, .004] }));
    coussin(g, W - .4, .16, D - .1, m, 0, .2, .04, { r: .05, rx: .08 });
    coussin(g, W - .4, .2, D - .2, m, 0, 0, .06, { r: .03 });
    coussin(g, W - .4, H - .2, .18, m, 0, .22, -D / 2 + .14, { rx: -.3, r: .05 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Heritage Print : bergère à oreilles capitonnée, imprimé journal et papillons, tablette pivotante laiton */
  'hpa-03'(p) {
    const [W, D, H] = p.dim;
    const imp = { motif: 'journal', couleurs: ['#F0EEE8', '#2A2A2C', '#4A7AB0'], echelle: .5 };
    const g = oreilles(p, { ext: matiere('tissu', '#F0EEE8', imp), dossier: matiere('tissu', '#F0EEE8', Object.assign({ grain: 'capiton' }, imp)), pieds: 'tourne', mp: matiere('bois', '#2A1C14'), hBras: .66 });
    cyl(g, .008, .008, .62, M('laiton'), W / 2 + .1, 0, .1, 8);
    cyl(g, .14, .14, .015, M('laiton'), W / 2 + .1, .62, .1, 32);
    return g;
  },

  /* Rocking Soft : coussins moelleux imprimés d'oiseaux, patins de bascule et accoudoirs en métal noir */
  'rs-08'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#EEECE6', { motif: 'papillons', couleurs: ['#ECEAE4', '#2A2A2E', '#6A6A70'], echelle: .35 }), noir = M('noir');
    [-1, 1].forEach(k => {
      const pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16 - .5; pts.push([k * (W / 2 - .05), .03 + u * u * .4, u * D]); }
      boudin(g, pts, .012, noir, { seg: 40, radial: 8 });
      boudin(g, [[k * (W / 2 - .05), .1, D / 2 - .2], [k * (W / 2 - .03), .5, D / 2 - .15], [k * (W / 2 - .03), .55, -D / 2 + .25], [k * (W / 2 - .05), .1, -D / 2 + .25]], .01, noir, { seg: 40, radial: 8 });
    });
    coussin(g, W - .12, .24, D - .3, m, 0, .14, .06, { r: .1, b: [.02, .04, .03] });
    coussin(g, W - .14, .52, .22, m, 0, .34, -D / 2 + .22, { rx: -.3, r: .1, b: [.02, .03, .05] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Soft Nest : gros cocon avachi en chenille chinée noir et écru */
  'snc-02'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('chenille', '#7A7A78', { motif: 'zebre', couleurs: ['#E2DED4', '#1C1C1E', '#8A8A88'], echelle: .18 });
    coussin(g, W - .06, .3, D - .06, m, 0, 0, 0, { r: .12, b: [.03, .03, .03] });
    [-1, 1].forEach(k => coussin(g, .3, .36, D - .1, m, k * (W / 2 - .17), .24, .02, { r: .14, b: [.03, .03, .03], rz: k * .1 }));
    coussin(g, W - .2, .46, .32, m, 0, .26, -D / 2 + .17, { rx: -.1, r: .15, b: [.03, .03, .04] });
    coussin(g, W - .64, .16, D - .4, m, 0, .28, .1, { r: .07, b: [.01, .03, .02] });
    coussin(g, .5, .4, .14, matiere('boucle', '#ECE7DC'), 0, .4, -D / 2 + .38, { rx: -.3, r: .07 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Sculpt Chair : tambour en velours chenille olive, dossier courbe porté par une tige chromée, socle disque */
  'vsc-09'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('chenille', '#5E6A2A', { ns: .9 });
    pivot(g, .26, .04, M('chrome'));
    tambour(g, W / 2 - .02, .44, m, 0, .03, .03, { ah: .06, ab: .03 });
    boudin(g, [[0, .3, -D / 2 + .02], [0, .55, -D / 2 - .02], [0, H - .2, -D / 2 + .02]], .008, M('chrome'), { seg: 12, radial: 6 });
    coqueArc(g, W / 2 - .1, W / 2 - .02, 2.2, .22, m, 0, H - .26, .03, .04);
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Prismatic : lounge enveloppant en jacquard chevrons bleu et blanc */
  'pl-01': p => tonneau(p, { ext: matiere('tissu', '#2A4EA0', { motif: 'chevrons', couleurs: ['#24489A', '#F1EEE7'], echelle: .5 }), hp: .05, bras: .58, tour: 1.85, evase: .1 }),

  /* Prismatic Icon : forme sculpturale bombée à rayures multicolores */
  'pic-01'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#D93A3A', { motif: 'rayures', couleurs: ['#D93A3A', '#F2C230', '#3A6FD9', '#2E9E5A', '#ECE8E0', '#1E1E22', '#E07A2A'], echelle: .7 });
    galette(g, W / 2 - .04, D / 2 - .04, .36, m, 0, 0, .02, { b: .04, ah: .14, ab: .07 });
    const pts = []; for (let i = 0; i <= 22; i++) { const u = i / 22, s = u * 2 - 1, [x, z] = planU(u, W / 2 - .17, D * .33, .45, .03); pts.push([x, .5 + .14 * (1 - s * s), z]); }
    boudin(g, pts, .17, m, { plan: true, kv: 1.5, seg: 70, radial: 20, kb: .9 });
    galette(g, W / 2 - .2, D / 2 - .2, .12, m, 0, .34, .08, { ah: .05, dome: .02 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Tress : sangles matelassées magenta tressées, quelques sangles qui retombent devant, pieds noirs */
  'tlc-02'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#A01A72', { grain: 'carres', echelle: .45, ns: 1.2 });
    pieds(g, coins(W / 2 - .12, D / 2 - .12), .12, M('noirMat'), 'droit', { r: .012 });
    coussin(g, W - .02, .3, D - .04, m, 0, .1, 0, { r: .08, b: [.02, .02, .02] });
    [-1, 1].forEach(k => coussin(g, .2, .32, D - .06, m, k * (W / 2 - .1), .36, 0, { r: .08, b: [.02, .02, .02] }));
    coussin(g, W - .02, .4, .22, m, 0, .36, -D / 2 + .11, { r: .09, b: [.02, .02, .02] });
    for (let i = 0; i < 4; i++) coussin(g, .1, .26, .04, m, -W / 2 + .2 + i * (W - .4) / 3, .04, D / 2 + .01, { r: .02, rx: .1 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Tiger Fur Edition : peluche blanche rayée de noir, galette ronde, dossier en tête ronde à petites oreilles */
  'tlc-fe01'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('fourrure', '#EDEBE6', { motif: 'zebre', couleurs: ['#EEECE7', '#2A2A2E', '#EEECE7'], echelle: .9, ns: 1.6 });
    tambour(g, W / 2 - .04, .38, m, 0, 0, .03, { b: .04, ah: .12, ab: .06 });
    const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20, s = u * 2 - 1, [x, z] = planU(u, W / 2 - .15, D * .3, .4, .03); pts.push([x, .5 + .08 * (1 - s * s), z]); }
    boudin(g, pts, .14, m, { plan: true, kv: 1.1, seg: 60, radial: 18, kb: .9 });
    sphere(g, .22, m, 0, H - .22, -D / 2 + .2, 1.1, .95, .85, 24);
    [-1, 1].forEach(k => sphere(g, .06, m, k * .15, H - .04, -D / 2 + .2, 1, 1, .6, 12));
    ombreSol(g, W + .3, D + .3);
    return g;
  },
  /* Tonneau pivotant : jacquard ondulé bleu gris sur écru, galette, socle en bois massif */
  'cpl-02'(p) {
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#E6E0D0', { motif: 'chevrons', couleurs: ['#E6E0D0', '#E6E0D0', '#8496A6'], echelle: .3 });
    const g = tonneau(p, { ext: m, hp: .1, bras: .64, tour: 1.95, evase: .02 });
    tambour(g, .3, .1, matiere('bois', '#6A4630', { couleurs: ['#7A5238', '#4A2E1C'] }), 0, 0, 0, { ah: .01 });
    coussin(g, W - .4, .32, .13, m, 0, .42, -D / 2 + .2, { rx: -.2, r: .06, b: [.01, .02, .03] });
    return g;
  },

  /* Blob Pop : forme sculpturale en boucle, tissu imprimé pop art (rouge, bleu, jaune) */
  'fl-bp-art-03'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('tissu', '#F2EEE6', { motif: 'traits', couleurs: ['#F2EEE6', '#D92A2A', '#2A5AD9', '#F2C230', '#1E1E22', '#E8862A'], echelle: .6 });
    galette(g, W / 2 - .06, D / 2 - .06, .34, m, 0, 0, .03, { b: .05, ah: .13, ab: .06 });
    boudin(g, [[-W / 2 + .2, .4, .2], [-W / 2 + .12, .55, -.15], [0, H - .12, -D / 2 + .14], [W / 2 - .12, .55, -.15], [W / 2 - .18, .35, .2], [W / 2 - .3, .55, .25], [W / 2 - .25, .62, .0]], .14, m, { seg: 90, radial: 18, kb: .9 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Loop Art : tonneau en corde bouclée rouge hirsute sur fins pieds en acier écartés */
  'fa-la-des-04': p => tonneau(p, { ext: matiere('fourrure', '#B0141C', { ns: 2.2 }), hp: .2, pieds: 'compas', mp: M('chrome'), bras: .64, tour: 1.85 }),

  /* Bloom Icon : bloc couvert de pétales de tissu rose */
  'fl-blm-09': p => blocPetales(p, '#D8708E', '#9A3A58'),

  /* Bloom Lounge : chenille chinée brun terracotta, dossier et bras en gros pétales arrondis */
  'fl-blo-des-07': p => lobes(p, matiere('chenille', '#5A2A22', { motif: 'chine', couleurs: ['#5A2A22', '#7A4234', '#3A1812'], echelle: .15 }), { pivot: false, n: 5 }),

  /* Cloud Lounge : galettes épaisses en bouclette blanche sur socle bas en bois foncé */
  'fl-cl-set-09'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#EEEBE4'), bois = matiere('bois', '#3A2618', { couleurs: ['#4A3020', '#2A1A10'] });
    coussin(g, W - .14, .14, D - .14, bois, 0, 0, .02, { r: .02 });
    coussin(g, W, .22, D - .04, m, 0, .13, .02, { r: .1, b: [.02, .04, .03] });
    coussin(g, W - .04, .42, .26, m, 0, .3, -D / 2 + .16, { rx: -.35, r: .12, b: [.02, .03, .04] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Compas : bois massif foncé en compas, accoudoirs plats, coussins rayés vert olive et crème */
  'fl-hw-retro-11'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const bois = matiere('bois', '#5A3420', { couleurs: ['#6A4028', '#3E2414'] }), ray = matiere('chenille', '#7A8238', { motif: 'rayures', couleurs: ['#7A8238', '#C9C08A', '#6A7230', '#E8E2C8'], echelle: .5 });
    [-1, 1].forEach(k => {
      const x = k * (W / 2 - .03);
      boudin(g, [[x, .01, D / 2 - .05], [x, .62, -.05]], .02, bois, { haut: [1, 0, 0], kv: 1.3, seg: 6, tension: 0 });
      boudin(g, [[x, .01, -D / 2 + .08], [x, .45, .12]], .02, bois, { haut: [1, 0, 0], kv: 1.3, seg: 6, tension: 0 });
      place(g, mesh(new THREE.BoxGeometry(.07, .025, D - .02), bois), x, .6, 0);
    });
    coussin(g, W - .12, .14, D - .16, ray, 0, .3, .04, { r: .05, b: [.01, .03, .02] });
    coussin(g, W - .14, .44, .12, ray, 0, .4, -D / 2 + .12, { rx: -.25, r: .05 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Curve Graphic : flancs en coque de fibre de verre laquée blanche cerclée de noir, coussins chevrons noir et blanc */
  'fl-cvg-32'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const blanc = matiere('laque', '#F0EEEA', { rough: .15 }), noir = M('noirMat'), chev = matiere('tissu', '#888', { motif: 'chevrons', couleurs: ['#1C1C1E', '#ECEAE4'], echelle: .25 });
    const fs = new THREE.Shape();
    fs.moveTo(D / 2 - .04, 0); fs.quadraticCurveTo(D / 2 + .02, .4, D / 2 - .1, .55); fs.quadraticCurveTo(-.05, .62, -D / 2 + .02, H); fs.lineTo(-D / 2 - .02, H - .1);
    fs.quadraticCurveTo(-D / 2 - .06, .2, -D / 2 + .1, 0); fs.closePath();
    [-1, 1].forEach(k => { panneau(g, fs, .05, blanc, 'cote', k * (W / 2 - .03), 0, 0, { a: .02 }); });
    coussin(g, W - .1, .16, D - .16, chev, 0, .26, .04, { r: .05, b: [.01, .025, .02] });
    coussin(g, W - .1, .26, D - .2, noir, 0, 0, .04, { r: .04 });
    coussin(g, W - .12, .46, .14, chev, 0, .38, -D / 2 + .12, { rx: -.3, r: .06 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Bunny Lounge : même ligne que Green Rabbit, en bouclette vert mousse */
  'fl-bun-des-05': p => lapin(p, '#6B7F3A'),

  /* Scarlet Bloom : rose en velours rouge, larges pétales roulés autour de l'assise, pieds acier écartés */
  'fl-vel-nest-12'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#A8101E');
    pieds(g, coins(.2, .18), .22, M('chrome'), 'compas', { r: .012, ecart: .25 });
    galette(g, W / 2 - .12, D / 2 - .12, .2, m, 0, .2, .04, { ah: .08 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 5 - .5) * Math.PI * 1.35, R = W / 2 - .24, ux = Math.sin(a), uz = -Math.cos(a);
      const pe = sphere(g, .3, m, ux * R, .5 + .1 * Math.cos(a), uz * R * .85 + .04, 1.1, .95, .22, 22);
      pe.rotation.set(.45, Math.PI - a, 0, 'YXZ');
    }
    [-1, 1].forEach(k => boudin(g, [[k * (W / 2 - .2), .45, .2], [k * .05, .44, .3]], .07, m, { seg: 12, kb: .8 }));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Ribbon Bold : velours rouge, dossier en tubes verticaux, bras en arches tubulaires jusqu'au sol */
  'fl-rbd-14'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#B01420');
    for (let i = 0; i < 4; i++) coussin(g, .15, H - .02, .2, m, -.225 + i * .15, 0, -D / 2 + .1, { r: .074, b: [0, .005, .015] });
    coussin(g, .6, .32, D - .26, m, 0, .1, .06, { r: .07 });
    [-1, 1].forEach(k => [0, 1].forEach(j => boudin(g, [[k * (.32 + j * .1), .62 - j * .08, -D / 2 + .2], [k * (.4 + j * .12), .66 - j * .08, .05], [k * (.42 + j * .12), .5 - j * .08, D / 2 - .1], [k * (.4 + j * .12), .06, D / 2 - .08]], .065, m, { seg: 40, kb: .8 })));
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Velour Sculpt : club en chenille bordeaux, bras arrondis soulignés de laiton et noyer, coussin */
  'fl-vsc-58'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('chenille', '#5A1622', { ns: .7 }), lt = M('laiton'), noyer = matiere('bois', '#4A2E1C');
    coussin(g, W, .36, D, m, 0, 0, 0, { r: .08 });
    [-1, 1].forEach(k => {
      coussin(g, .2, .3, D - .02, m, k * (W / 2 - .1), .34, 0, { r: .09 });
      place(g, mesh(new THREE.BoxGeometry(.03, .6, .012), noyer), k * (W / 2 - .1), .3, D / 2 + .002);
      place(g, mesh(new THREE.BoxGeometry(.012, .6, .014), lt), k * (W / 2 - .1), .3, D / 2 + .004);
    });
    coussin(g, W - .02, H - .32, .2, m, 0, .32, -D / 2 + .1, { r: .09 });
    coussin(g, W - .44, .3, .13, m, 0, .42, -D / 2 + .24, { rx: -.2, r: .06 });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Majestic Lounge : dossier extra-haut matelassé crème à passepoil noir, assise lavande, coussin géométrique */
  'fl-maj-clas-08'(p) {
    const [W, D, H] = p.dim;
    const creme = matiere('cuir', '#E2DCCD', { grain: 'matelasse', echelle: .2, ns: .8 }), lav = matiere('cuir', '#A9AFC9');
    const g = oreilles(p, { ext: creme, int: lav, dossier: creme, pieds: 'fuseau', mp: matiere('bois', '#2A1C14'), hBras: .6, av: .05 });
    coussin(g, .4, .34, .12, matiere('tissu', '#8A8A8A', { motif: 'geometrique', couleurs: ['#5A5A62', '#E07A2A', '#C9C9C9', '#2A2A30'], echelle: .3 }), 0, .44, -.12, { rx: -.25, r: .05 });
    return g;
  },

  /* Retro Wood Lounge : bâti en noyer sculpté aux pieds écartés, coussins en bouclette grise */
  'fl-rwl-des-10'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const bois = matiere('bois', '#7A4A2A', { couleurs: ['#8A5A36', '#5A3420'] }), m = matiere('boucle', '#A9A9A6');
    [-1, 1].forEach(k => {
      const x = k * (W / 2 - .03);
      boudin(g, [[x, .01, D / 2 - .02], [x, .28, D / 2 - .12], [x, .56, D / 2 - .08], [x, .58, -D / 2 + .2], [x, .3, -D / 2 + .1], [x, .01, -D / 2 + .02]], .02, bois, { haut: [1, 0, 0], kv: 1.6, seg: 60 });
    });
    coussin(g, W - .1, .03, D - .2, bois, 0, .26, .02, { r: .01 });
    coussin(g, W - .12, .15, D - .2, m, 0, .28, .04, { r: .06, b: [.01, .03, .02] });
    coussin(g, W - .14, .5, .14, m, 0, .36, -D / 2 + .14, { rx: -.28, r: .07, b: [.01, .02, .03] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Cocoon Design : œuf suspendu en résine ajourée bleu cobalt */
  'fs-cd-art-06': p => oeufSuspendu(p, '#1F48A8'),

  /* Orbit Lounge : tonneau pivotant en chenille anthracite, dossier en boudins verticaux, flancs en bois teinté */
  'fl-orb-swivel-07'(p) {
    const [W, D, H] = p.dim;
    const m = matiere('chenille', '#3A3A3E', { ns: .8 }), cann = matiere('chenille', '#3A3A3E', { grain: 'cannelure', echelle: .9, ns: .9 });
    const g = tonneau(p, { ext: m, dossier: cann, hp: .06, bras: .58, tour: 1.85 });
    pivot(g, .3, .05, M('noir'));
    [-1, 1].forEach(k => coussin(g, .03, .4, .45, matiere('bois', '#4A2E1C'), k * (W / 2 + .005), .2, -.05, { r: .012, ry: k * .25 }));
    return g;
  }
};
