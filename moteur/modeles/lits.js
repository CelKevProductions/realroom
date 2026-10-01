/* =================================================================
   RealRoom — modèles fidèles : lits (d'après les photos produits)
   Origine au sol, centrée, tête de lit vers -z, pied vers +z.
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, V3, clamp, lerp,
  coussin, boudin, tambour, galette, tourne, panneau, coqueParam, bordCoque, planU, rectCoins, formeLisse,
  matiere, ombreSol, literie, cyl, sphere, pieds, coins, halo
} from './outils.js';

// literie (matelas, couette, oreillers) centrée en (0, y, z) pour un couchage w × l
function draps(g, w, l, y, z, accent) {
  const s = groupe(); s.position.z = z; g.add(s);
  literie(s, w, l, y, accent);
  return s;
}

/* ---------------------------------------------------------------
   Lit type : cadre (sommier tapissé), pieds, literie, tête de lit
   et chevets fournis par le modèle. o :
     base (matière du cadre), hb (hauteur du cadre), yb (hauteur des pieds),
     cadre (surlargeur du cadre autour du couchage), pieds ({ type, m, r }),
     led (bandeau lumineux sous le cadre), tete(g, c) et chevets(g, c),
     c = { W, D, H, zt (dos de la tête), et (épaisseur), Wb, Lb, zc, cw, cl, ytop }
   --------------------------------------------------------------- */
function lit(p, o) {
  const g = groupe('lit');
  const [W, D, H] = p.dim;
  const cw = (p.couchage && p.couchage[0]) || o.couchage || clamp(W - (o.chevets ? 1 : .3), 1.4, 1.8);
  const cl = (p.couchage && p.couchage[1]) || 2;
  const et = o.et ?? .14, zt = -D / 2;
  const Wb = Math.min(W, cw + (o.cadre ?? .16)), Lb = Math.min(D - et, cl + (o.pied ?? .14)), zc = zt + et + Lb / 2;
  const yb = o.yb ?? (o.pieds ? .1 : .02), hb = o.hb ?? .3, mb = o.base;
  if (o.socle) coussin(g, Wb - .3, yb + .01, Lb - .3, o.socle, 0, 0, zc, { r: .01, b: [0, 0, 0] });
  coussin(g, Wb, hb, Lb, mb, 0, yb, zc, { r: o.rBase ?? .05, b: o.bBase || [.006, .01, .006] });
  if (o.pieds) pieds(g, coins(Wb / 2 - .08, Lb / 2 - .08).map(([x, z]) => [x, z + zc]), yb, o.pieds.m || M('noir'), o.pieds.type || 'droit', { r: o.pieds.r || .016 });
  if (o.led) {
    const l = coussin(g, Wb - .14, .01, Lb - .14, M('led:#FFB45E'), 0, Math.max(.005, yb - .015), zc, { r: .004, b: [0, 0, 0] });
    l.castShadow = false;
    const hl = new THREE.Mesh(new THREE.PlaneGeometry(Wb + .9, Lb + .9), M('halo'));
    hl.rotation.x = -Math.PI / 2; hl.position.set(0, .006, zc); hl.userData.nonCuit = true; g.add(hl);
  }
  const ytop = yb + hb;
  draps(g, cw - .02, Math.min(cl, Lb - .06), ytop - (o.enfonce ?? .1), zc + .02, o.accent === undefined ? null : o.accent);
  const c = { W, D, H, zt, et, Wb, Lb, zc, cw, cl, ytop, yb };
  if (o.tete) o.tete(g, c);
  if (o.chevets) o.chevets(g, c);
  ombreSol(g, W + .4, D + .4);
  return g;
}
// cadre en bulles : segments rembourrés tout autour du couchage (pied et côtés), pour les lits « bulles »
function cadreBulles(g, c, m, o = {}) {
  const ep = o.ep || .24, hb = o.h || .36, pas = o.pas || .33, Wf = c.Wb, zp = c.zt + c.et + c.Lb - ep / 2;
  const nP = Math.max(3, Math.round(Wf / pas)), wp = Wf / nP;
  for (let i = 0; i < nP; i++) coussin(g, wp - .006, hb, ep, m, -Wf / 2 + wp * (i + .5), 0, zp, { r: Math.min(.11, wp * .4), b: [.016, .018, .02], seg: 8 });
  const z0 = c.zt + c.et, z1 = zp - ep / 2, nC = Math.max(3, Math.round((z1 - z0) / pas)), lc = (z1 - z0) / nC;
  [-1, 1].forEach(k => { for (let i = 0; i < nC; i++) coussin(g, ep, hb, lc - .006, m, k * (Wf / 2 - ep / 2), 0, z0 + lc * (i + .5), { r: Math.min(.11, lc * .4), b: [.02, .018, .016], seg: 8 }); });
}
// tête de lit en grille de coussins bombés (lignes × colonnes)
function teteGrille(g, c, m, lignes, cols, o = {}) {
  const w = o.w || c.Wb, y0 = o.y0 ?? .1, h = (c.H - y0) / lignes, l = w / cols;
  for (let j = 0; j < lignes; j++) for (let i = 0; i < cols; i++) coussin(g, l - .008, h - .008, o.ep || .2, m, -w / 2 + l * (i + .5), y0 + j * h, c.zt + (o.ep || .2) / 2, { r: Math.min(l, h) * .42, b: [.01, .01, .03], seg: 8 });
}
// panneau de tête de lit posé au sol contre le mur (dos en zt), forme dans le plan x-y
const tete = (g, forme, ep, m, zt, o = {}) => panneau(g, forme, ep, m, 'face', 0, o.y || 0, zt + ep / 2, { a: o.a ?? .03, rx: o.rx || 0 });
// chevets carrés posés de part et d'autre (x = ±xc)
function chevetsBoites(g, c, m, o = {}) {
  const w = o.w || .45, h = o.h || .45, d = o.d || .4, xc = o.xc ?? (c.Wb / 2 + w / 2 + .03);
  [-1, 1].forEach(k => {
    coussin(g, w, h, d, m, k * xc, o.y || 0, c.zt + c.et + d / 2 + (o.dz || 0), { r: o.r ?? .015, b: [0, 0, 0] });
    if (o.lampe) { cyl(g, .012, .012, .3, M('laiton'), k * xc, (o.y || 0) + h, c.zt + c.et + d / 2, 8); tourne(g, [[.04, 0], [.11, 0], [.08, .16], [.04, .16]], M('opale:#FFE6C4'), k * xc, (o.y || 0) + h + .26, c.zt + c.et + d / 2, 24); }
  });
}

export const LITS = {
  /* Cloud Bubble : bouclette ivoire ; tête de lit large en tubes verticaux
     qui accueille deux chevets ronds, cadre en « bulles » sur trois côtés */
  'cbb-03'(p, o = {}) {
    const g = groupe('lit');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#ECE5D4');
    const ep = .25, Wf = clamp(W - .9, 1.6, 2.2), zt = -D / 2, et = .24;
    // tête de lit : tubes verticaux jointifs sur toute la largeur
    const n = Math.max(7, Math.round(W / .27)), wc = W / n;
    for (let i = 0; i < n; i++) coussin(g, wc - .004, H, et, m, -W / 2 + wc * (i + .5), 0, zt + et / 2, { r: wc * .47, b: [0, .004, .022], seg: 8 });
    // cadre en bulles : pied, puis les deux côtés
    const hb = .36, zp = D / 2 - ep / 2, nP = Math.max(4, Math.round(Wf / .33)), wp = Wf / nP;
    for (let i = 0; i < nP; i++) coussin(g, wp - .006, hb, ep, m, -Wf / 2 + wp * (i + .5), 0, zp, { r: .11, b: [.016, .018, .02], seg: 8 });
    const z0 = zt + et - .02, z1 = D / 2 - ep, nC = Math.max(3, Math.round((z1 - z0) / .33)), lc = (z1 - z0) / nC;
    [-1, 1].forEach(k => { for (let i = 0; i < nC; i++) coussin(g, ep, hb, lc - .006, m, k * (Wf / 2 - ep / 2), 0, z0 + lc * (i + .5), { r: .11, b: [.02, .018, .016], seg: 8 }); });
    // sommier sombre et literie
    coussin(g, Wf - 2 * ep + .02, .12, z1 - z0, M('noirMat'), 0, .1, (z0 + z1) / 2, { r: .01, b: [0, 0, 0] });
    draps(g, Wf - 2 * ep - .02, Math.min(2.02, z1 - z0 - .02), .22, (z0 + z1) / 2, o.accent === undefined ? null : o.accent);
    // chevets ronds devant les ailes de la tête de lit
    const rc = clamp((W - Wf) / 2 / 2 - .01, .17, .25);
    [-1, 1].forEach(k => tambour(g, rc, .5, m, k * (W / 2 - (W - Wf) / 4), 0, zt + et + rc + .03, { b: .012, ah: .06, ab: .02, dome: .006 }));
    ombreSol(g, W + .4, D + .4);
    return g;
  },
  /* Royal Curve Edition : grande tête en cuir orange au sommet ondulé qui s'étire sur les chevets
     intégrés beige, deux coussins beige, cadre orange sur socle central doré */
  'rce-05': p => lit(p, {
    base: matiere('cuir', '#B85A22'), hb: .26, yb: .14, socle: M('laiton'), couchage: 1.8, chevets: true,
    tete(g, c) {
      const orange = matiere('cuir', '#B85A22'), beige = matiere('cuir', '#D9CCB6'), fs = new THREE.Shape(), L = c.W / 2;
      fs.moveTo(-L, 0); fs.lineTo(L, 0); fs.lineTo(L, .55);
      for (let i = 0; i <= 40; i++) { const u = i / 40, x = L - u * 2 * L, yy = .62 + (c.H - .7) * Math.pow(Math.sin(Math.PI * u), 1.6) + .06 * Math.sin(u * Math.PI * 5); fs.lineTo(x, yy); }
      fs.closePath();
      tete(g, fs, .12, orange, c.zt, { a: .04 });
      [-1, 1].forEach(k => coussin(g, .82, .5, .1, beige, k * .43, c.ytop + .02, c.zt + .17, { rx: -.1, r: .05 }));
    },
    chevets: (g, c) => chevetsBoites(g, c, matiere('laque', '#D9CCB6'), { w: .45, h: .4, y: .12, d: .42 })
  }),

  /* Essential Comfort : tête de lit en un seul panneau de simili cuir taupe évasé, bandeau LED sous le cadre */
  'ec-01': p => lit(p, {
    base: matiere('cuir', '#7C6D61'), hb: .26, yb: .12, led: true, cadre: .12,
    tete(g, c) {
      const fs = new THREE.Shape(), L = c.Wb / 2;
      fs.moveTo(-L + .05, .3); fs.lineTo(L - .05, .3); fs.lineTo(L + .06, c.H - .05); fs.quadraticCurveTo(0, c.H + .04, -L - .06, c.H - .05); fs.closePath();
      tete(g, fs, .1, matiere('cuir', '#8A7A6C'), c.zt, { a: .04, rx: -.06 });
    }
  }),

  /* Lumea : velours beige, tête enveloppante cannelée aux joues arrondies, liseuses, pieds dorés */
  'bed-410': p => lit(p, {
    base: matiere('velours', '#CDB997'), hb: .32, yb: .06, pieds: { type: 'boule', m: M('laiton'), r: .02 }, cadre: .2, rBase: .1,
    tete(g, c) {
      const m = matiere('velours', '#D5C2A2', { grain: 'cannelure', echelle: .5, ns: .8 });
      const forme = (u, t) => { const s = u * 2 - 1, phi = s * 1.2, a = c.Wb / 2 + .02, b = .45; return [a * Math.sin(phi) / Math.sin(1.2), .06 + t * (c.H - .06 - .3 * Math.pow(Math.abs(s), 3)), c.zt + .1 + b * (1 - Math.cos(phi)) * .6]; };
      coqueParam(g, forme, m, { ep: .14, nu: 48, nt: 10, cz: c.zt + 1.2 });
      bordCoque(g, forme, .14, matiere('velours', '#D5C2A2'), { cz: c.zt + 1.2, r: .075 });
      [-1, 1].forEach(k => { cyl(g, .008, .008, .2, M('laiton'), k * (c.Wb / 2 - .1), .95, c.zt + .22, 8); sphere(g, .03, M('opale:#FFE6C4'), k * (c.Wb / 2 - .1), 1.15, c.zt + .26); });
    }
  }),

  /* Nordic Duo : cadre et tête en velours taupe, panneau rembourré beige, fins pieds noirs */
  'nd-01': p => lit(p, {
    base: matiere('velours', '#7F6F61'), hb: .22, yb: .16, pieds: { type: 'droit', m: M('noirMat'), r: .014 }, cadre: .1,
    tete(g, c) {
      coussin(g, c.Wb, c.H - .14, .1, matiere('velours', '#7F6F61'), 0, .14, c.zt + .05, { r: .04 });
      coussin(g, c.Wb - .16, c.H - .5, .08, matiere('velours', '#D2C3A8'), 0, .44, c.zt + .12, { r: .04, b: [.005, .01, .02] });
    }
  }),

  /* Royal Curve : velours côtelé beige, tête en arche cannelée, cadre cannelé, LED sous le cadre */
  'rcb-05': p => lit(p, {
    base: matiere('cotele', '#CDB997', { grain: 'cannelure', echelle: .5 }), hb: .3, yb: .1, led: true, cadre: .2,
    tete(g, c) {
      const R = c.Wb / 2 + .02, fs = new THREE.Shape(), hb = c.H - R * .55;
      fs.moveTo(-R, 0); fs.lineTo(R, 0); fs.lineTo(R, hb * .6);
      fs.absellipse(0, hb * .6, R, c.H - hb * .6, 0, Math.PI, false);
      fs.closePath();
      tete(g, fs, .14, matiere('cotele', '#D8C6A6', { grain: 'cannelure', echelle: .5 }), c.zt, { a: .05 });
    }
  }),

  /* Hotel Signature : très grande tête en cuir beige matelassée en carrés, chevets suspendus et lampes, cadre sur pieds métal */
  'lhs-15': p => lit(p, {
    base: matiere('cuir', '#CDB794'), hb: .22, yb: .14, pieds: { type: 'droit', m: M('chrome'), r: .014 }, cadre: .1, couchage: 2, chevets: true,
    tete(g, c) { coussin(g, c.W, c.H - .3, .12, matiere('cuir', '#D2BE9C', { grain: 'carres', echelle: .9, ns: 1 }), 0, .3, c.zt + .06, { r: .03 }); },
    chevets: (g, c) => chevetsBoites(g, c, matiere('bois', '#4A2E1C'), { w: .42, h: .12, d: .36, y: .42, xc: c.Wb / 2 + .26, lampe: true })
  }),

  /* Executive Comfort : grande tête matelassée en carrés gris taupe, chevets suspendus marbre et noyer */
  'ecp-12': p => lit(p, {
    base: matiere('tissu', '#A69C90'), hb: .26, yb: .1, cadre: .12, chevets: true,
    tete(g, c) { coussin(g, Math.max(c.W, c.Wb + 1), c.H - .1, .14, matiere('tissu', '#A69C90', { grain: 'carres', echelle: .8, ns: 1.1 }), 0, .1, c.zt + .07, { r: .03 }); },
    chevets(g, c) {
      [-1, 1].forEach(k => { const x = k * (c.Wb / 2 + .28); coussin(g, .45, .03, .4, M('marbreBlanc'), x, .52, c.zt + .36, { r: .005, b: [0, 0, 0] }); coussin(g, .4, .12, .36, matiere('bois', '#5E3F2B'), x, .4, c.zt + .36, { r: .01, b: [0, 0, 0] }); });
    }
  }),

  /* Royal : chesterfield en velours cognac, haute tête capitonnée à ailerons, cadre capitonné */
  'cr-06': p => lit(p, {
    base: matiere('velours', '#7A4422', { grain: 'capiton', echelle: .45 }), hb: .34, yb: .06, cadre: .24,
    tete(g, c) {
      const m = matiere('velours', '#84491F', { grain: 'capiton', echelle: .45, ns: 1 });
      coussin(g, c.Wb, c.H - .06, .18, m, 0, .06, c.zt + .09, { r: .06 });
      [-1, 1].forEach(k => coussin(g, .2, c.H - .2, .5, m, k * (c.Wb / 2 + .02), .06, c.zt + .28, { ry: k * .45, r: .07 }));
    }
  }),
  /* Opulence Tactile (beige) : tête basse en simili cuir beige, boudin roulé au sommet, cadre épais */
  'lit-capitonne-simili-cuir-beige-opulence-tactile': p => lit(p, {
    base: matiere('cuir', '#CDBB9C'), hb: .34, yb: .03, cadre: .22, rBase: .08,
    tete(g, c) {
      const m = matiere('cuir', '#D2C1A3');
      coussin(g, c.Wb, c.H - .2, .16, m, 0, .03, c.zt + .08, { r: .05 });
      boudin(g, [[-c.Wb / 2 + .06, c.H - .1, c.zt + .12], [c.Wb / 2 - .06, c.H - .1, c.zt + .12]], .1, m, { seg: 8, kb: .7 });
    }
  }),

  /* Opulence Tactile (terracotta) : même ligne en bouclette terracotta */
  'lit-capitonne-bouclette-terracotta-opulence-tactile': p => lit(p, {
    base: matiere('boucle', '#7A2E22'), hb: .34, yb: .03, cadre: .22, rBase: .08,
    tete(g, c) {
      const m = matiere('boucle', '#7E3024');
      coussin(g, c.Wb, c.H - .22, .16, m, 0, .03, c.zt + .08, { r: .05 });
      boudin(g, [[-c.Wb / 2 + .07, c.H - .12, c.zt + .13], [c.Wb / 2 - .07, c.H - .12, c.zt + .13]], .12, m, { seg: 8, kb: .7 });
    }
  }),

  /* Vasto : cuir beige, tête matelassée en losanges, ailes enveloppantes qui descendent en longerons courbes */
  'lcm-180': p => lit(p, {
    base: matiere('cuir', '#CDBB9C'), hb: .24, yb: .04, cadre: .26,
    tete(g, c) {
      const m = matiere('cuir', '#D2C1A3', { grain: 'matelasse', echelle: .4, ns: .9 }), lisse = matiere('cuir', '#D2C1A3');
      coussin(g, c.Wb - .2, c.H - .26, .14, m, 0, .26, c.zt + .1, { r: .05, rx: -.08 });
      [-1, 1].forEach(k => boudin(g, [[k * (c.Wb / 2 - .06), c.H - .1, c.zt + .1], [k * (c.Wb / 2 - .02), .55, c.zt + .45], [k * (c.Wb / 2), .32, c.zt + 1.1], [k * (c.Wb / 2 - .02), .28, c.zt + c.et + c.Lb - .1]], .07, lisse, { haut: [1, 0, 0], kv: 1.2, seg: 50 }));
    }
  }),

  /* Bubble : bouclette rose poudré, tête en grille de coussins bombés, cadre en bulles */
  'com-800': p => lit(p, {
    base: matiere('boucle', '#E2B4B8'), hb: .2, yb: .03, cadre: .44,
    tete: (g, c) => { const m = matiere('boucle', '#E3B5BC'); teteGrille(g, c, m, 3, 7, { y0: .3, ep: .18 }); cadreBulles(g, c, m, { ep: .2, h: .34, pas: .36 }); }
  }),

  /* Éclisse Royal : cuir noir à caissons bombés : tête en boudins horizontaux, cadre en bulles */
  'bed-200': p => {
    const m = matiere('cuir', '#1E1D21', { rough: .4 });
    return lit(p, { base: matiere('cuir', '#1E1D21'), hb: .2, yb: .02, cadre: .5, couchage: 1.8,
      tete(g, c) { for (let j = 0; j < 3; j++) boudin(g, [[-c.Wb / 2 + .1, .4 + j * .2, c.zt + .1], [c.Wb / 2 - .1, .4 + j * .2, c.zt + .1]], .1, m, { seg: 8, kb: .8 }); coussin(g, c.Wb, .42, .18, m, 0, 0, c.zt + .09, { r: .06 }); cadreBulles(g, c, m, { ep: .24, h: .34, pas: .3 }); } });
  },

  /* Nuvola Black : même ligne en simili cuir noir */
  'lit-capitonne-simili-cuir-noir-nuvola-black': p => {
    const m = matiere('cuir', '#1E1D21', { rough: .4 });
    return lit(p, { base: m, hb: .2, yb: .02, cadre: .5, couchage: 1.6,
      tete(g, c) { for (let j = 0; j < 3; j++) boudin(g, [[-c.Wb / 2 + .1, .45 + j * .22, c.zt + .1], [c.Wb / 2 - .1, .45 + j * .22, c.zt + .1]], .11, m, { seg: 8, kb: .8 }); coussin(g, c.Wb, .45, .18, m, 0, 0, c.zt + .09, { r: .06 }); cadreBulles(g, c, m, { ep: .24, h: .36, pas: .3 }); } });
  },

  /* Nova Sand : velours sable, tête asymétrique qui monte d'un côté, pieds sculptés en bois foncé */
  'bed-520': p => lit(p, {
    base: matiere('velours', '#C9B48E'), hb: .26, yb: .08, cadre: .16,
    tete(g, c) {
      const fs = new THREE.Shape(), L = c.Wb / 2 + .02;
      fs.moveTo(-L, 0); fs.lineTo(L, 0); fs.lineTo(L, .62);
      fs.bezierCurveTo(L * .3, .66, -L * .2, c.H + .05, -L, c.H - .02); fs.closePath();
      tete(g, fs, .16, matiere('velours', '#D5C19C'), c.zt, { a: .07 });
      [-1, 1].forEach(k => [c.zt + .5, c.zt + c.et + c.Lb - .3].forEach(z => coussin(g, .1, .1, .22, matiere('bois', '#3A2416'), k * (c.Wb / 2 - .06), 0, z, { r: .04 })));
    }
  }),

  /* Ubble Lux : bouclette rose pâle, tête en bulles sur deux rangs, cadre en bulles tout autour */
  'ble-04': p => {
    const m = matiere('boucle', '#E2C3BE');
    return lit(p, { base: matiere('boucle', '#D9B6B0'), hb: .2, yb: .02, cadre: .5, couchage: 1.6,
      tete: (g, c) => { teteGrille(g, c, m, 2, 7, { y0: .36, ep: .22 }); cadreBulles(g, c, m, { ep: .24, h: .38 }); } });
  },
  /* Imperial Art : tête cannelée blanche encadrée d'ailes imprimées porcelaine bleue, cadre imprimé, chevets intégrés */
  'iae-07': p => {
    const porc = matiere('tissu', '#F2F2EE', { motif: 'floral', couleurs: ['#F0F0EC', '#2A4FA8', '#5E7FC8', '#2A4FA8', '#F0F0EC'], echelle: .6 });
    return lit(p, { base: porc, hb: .32, yb: .04, couchage: 1.8, chevets: true,
      tete(g, c) {
        coussin(g, c.Wb, c.H - .1, .16, matiere('velours', '#EEEEEA', { grain: 'cannelure', echelle: .4 }), 0, .1, c.zt + .08, { r: .05 });
        [-1, 1].forEach(k => coussin(g, (c.W - c.Wb) / 2, c.H - .4, .14, porc, k * (c.Wb / 2 + (c.W - c.Wb) / 4), .1, c.zt + .07, { r: .05 }));
      },
      chevets: (g, c) => chevetsBoites(g, c, matiere('laque', '#3A3A40'), { w: .38, h: .3, d: .38, y: .2, xc: c.Wb / 2 + .24 }) });
  },

  /* Soft Cloud Pink : bouclette rose, tête en lobes arrondis de hauteurs variées, cadre bas */
  'scp-03': p => lit(p, {
    base: matiere('boucle', '#C9707E'), hb: .22, yb: .03, cadre: .3, rBase: .1,
    tete(g, c) {
      const m = matiere('boucle', '#D07A88'), n = 5, l = (c.Wb + .1) / n;
      for (let i = 0; i < n; i++) { const h = c.H - .12 * Math.abs(i - 2) - (i % 2) * .05; coussin(g, l + .04, h, .16, m, -(c.Wb + .1) / 2 + l * (i + .5), 0, c.zt + .1 - (i % 2) * .02, { r: l * .5, b: [.01, .01, .03] }); }
    }
  }),

  /* Classic Heritage : cadre de tête en bois foncé arrondi, panneau de bouclette rayée écrue, cadre noir flottant */
  'ch-08': p => lit(p, {
    base: matiere('laque', '#1C1C1E'), hb: .24, yb: .14, pieds: { type: 'carre', m: matiere('bois', '#4A2E1C'), r: .025 }, cadre: .1,
    tete(g, c) {
      const bois = matiere('bois', '#3E2416', { couleurs: ['#4A2E1C', '#2A180E'] });
      tete(g, rectCoins(c.Wb + .08, c.H - .3, [.02, .02, .12, .12], 0, .3 + (c.H - .3) / 2), .07, bois, c.zt, { a: .02 });
      coussin(g, c.Wb - .12, c.H - .48, .06, matiere('boucle', '#E8E0CE', { motif: 'rayures', couleurs: ['#E6DCC8', '#F2EDE3'], echelle: .25 }), 0, .4, c.zt + .09, { r: .03 });
    }
  }),

  /* Aurea Light : cuir beige, tête capitonnée à visière arrondie liserée de bois, cadre à caissons, LED */
  'bed-610': p => lit(p, {
    base: matiere('cuir', '#CDB794'), hb: .12, yb: .05, cadre: .5, led: true,
    tete(g, c) {
      const m = matiere('cuir', '#D2BE9C'), cap = matiere('cuir', '#D2BE9C', { grain: 'capiton', echelle: .45 });
      coussin(g, c.Wb - .1, c.H - .3, .14, cap, 0, .3, c.zt + .08, { r: .05 });
      boudin(g, [[-c.Wb / 2 + .08, c.H - .08, c.zt + .16], [c.Wb / 2 - .08, c.H - .08, c.zt + .16]], .1, m, { haut: [0, 1, 0], kv: .8, seg: 8, kb: .8 });
      cadreBulles(g, c, m, { ep: .22, h: .32, pas: .45 });
    }
  }),

  /* Lux Storage : coffre en simili cuir ivoire, tête capitonnée à boutons couronnée d'un bandeau LED */
  'lsp-01': p => lit(p, {
    base: matiere('cuir', '#E6DCC6'), hb: .36, yb: .03, cadre: .12,
    tete(g, c) {
      coussin(g, c.Wb, c.H - .03, .14, matiere('cuir', '#E6DCC6', { grain: 'capiton', echelle: .5 }), 0, .03, c.zt + .07, { r: .04 });
      coussin(g, c.Wb - .16, .03, .06, M('led:#FFC27A'), 0, c.H - .1, c.zt + .15, { r: .01, b: [0, 0, 0] });
    }
  }),

  /* Cocoon : très large tête en velours taupe aux coins arrondis, deux coussins, chevets flottants blancs */
  'vdp-02': p => lit(p, {
    base: matiere('velours', '#7E6E62'), hb: .3, yb: .04, couchage: 1.8, chevets: true,
    tete(g, c) {
      const m = matiere('velours', '#86766A');
      tete(g, rectCoins(c.W, c.H, [.02, .02, .22, .22], 0, c.H / 2), .14, m, c.zt, { a: .05 });
      [-1, 1].forEach(k => coussin(g, c.cw / 2 - .02, .5, .12, m, k * c.cw / 4, c.ytop - .02, c.zt + .2, { rx: -.1, r: .05 }));
    },
    chevets: (g, c) => chevetsBoites(g, c, matiere('laque', '#ECE8E0'), { w: .42, h: .18, d: .38, y: .4, xc: c.Wb / 2 + .26 })
  }),

  /* Minimalist Suite : lit bas en bouclette écrue, tête basse, plateaux de chevet en noyer intégrés */
  'ms-10': p => lit(p, {
    base: matiere('boucle', '#E2D9C6'), hb: .2, yb: .03, cadre: .3, couchage: 1.8, chevets: true,
    tete: (g, c) => coussin(g, c.Wb, c.H - .03, .16, matiere('boucle', '#E2D9C6'), 0, .03, c.zt + .08, { r: .06 }),
    chevets: (g, c) => chevetsBoites(g, c, matiere('bois', '#5A3A24', { couleurs: ['#6A4630', '#3E2618'] }), { w: .4, h: .06, d: .5, y: .16, xc: c.Wb / 2 + .2 })
  }),

  /* Urban Prestige : haute tête capitonnée en bouclette écrue avec deux tours latérales, liseuses */
  'up-01': p => lit(p, {
    base: matiere('boucle', '#E6DECB'), hb: .32, yb: .04, cadre: .16, couchage: 1.8,
    tete(g, c) {
      const cap = matiere('boucle', '#E8E0CE', { grain: 'capiton', echelle: .45 });
      coussin(g, c.cw + .06, c.H - .35, .16, cap, 0, .2, c.zt + .08, { r: .05 });
      [-1, 1].forEach(k => { coussin(g, .22, c.H, .26, cap, k * (c.cw / 2 + .14), 0, c.zt + .13, { r: .06 }); sphere(g, .03, M('opale:#FFE6C4'), k * (c.cw / 2 + .03), 1.05, c.zt + .24); });
    }
  }),

  /* Cloud Bubble (modules) : tête en tubes verticaux et cadre en bulles de bouclette */
  'cb-01': p => {
    const m = matiere('boucle', '#ECE5D4');
    return lit(p, { base: m, hb: .2, yb: .02, cadre: .5, couchage: 1.6,
      tete(g, c) {
        const n = Math.round(c.Wb / .2), wc = c.Wb / n;
        for (let i = 0; i < n; i++) coussin(g, wc - .004, c.H, .22, m, -c.Wb / 2 + wc * (i + .5), 0, c.zt + .11, { r: wc * .47, b: [0, .004, .02], seg: 8 });
        cadreBulles(g, c, m, { ep: .24, h: .36 });
      } });
  },

  /* Soft Panel : tête en panneau écru à médaillons ronds en relief, cadre fin clair */
  'sp-01': p => lit(p, {
    base: matiere('tissu', '#E2DACB'), hb: .26, yb: .08, cadre: .14,
    tete: (g, c) => coussin(g, c.W, c.H - .2, .12, matiere('tissu', '#ECE4D3', { grain: 'galets', echelle: .7, ns: .9 }), 0, .2, c.zt + .06, { r: .04 })
  }),

  /* Urban Soft : velours bleu, cadre épais arrondi, tête en deux panneaux matelassés, bandeau LED */
  'us-01': p => lit(p, {
    base: matiere('velours', '#24427A'), hb: .3, yb: .03, cadre: .26, rBase: .1,
    tete(g, c) {
      const m = matiere('velours', '#2A4A86');
      coussin(g, c.Wb, c.H - .3, .14, m, 0, .3, c.zt + .07, { r: .05 });
      [-1, 1].forEach(k => coussin(g, c.cw / 2 - .04, .42, .1, m, k * c.cw / 4, c.ytop, c.zt + .17, { rx: -.08, r: .04 }));
      coussin(g, .3, .02, .02, M('led:#FFC27A'), 0, c.H - .2, c.zt + .15, { r: .005, b: [0, 0, 0] });
    }
  }),

  /* Aura Light : cuir beige, cadre sculpté arrondi éclairé dessous, tête capitonnée au sommet roulé */
  'al-01': p => lit(p, {
    base: matiere('cuir', '#C9B08E'), hb: .3, yb: .1, cadre: .3, rBase: .12, led: true,
    tete(g, c) {
      const m = matiere('cuir', '#D2BC98'), cap = matiere('cuir', '#D2BC98', { grain: 'capiton', echelle: .4 });
      coussin(g, c.Wb, c.H - .35, .14, cap, 0, .35, c.zt + .1, { r: .05, rx: -.1 });
      boudin(g, [[-c.Wb / 2 + .06, c.H - .05, c.zt + .13], [c.Wb / 2 - .06, c.H - .05, c.zt + .13]], .08, m, { seg: 8, kb: .7 });
    }
  }),

  /* Smart Luxe : simili cuir blanc écru, tête à niches et étagères, banquette coffre au pied, finitions dorées */
  'slp-01': p => lit(p, {
    base: matiere('cuir', '#ECE4D3'), hb: .34, yb: .03, cadre: .3,
    tete(g, c) {
      const m = matiere('cuir', '#ECE4D3');
      coussin(g, c.Wb, c.H - .03, .22, m, 0, .03, c.zt + .11, { r: .04 });
      coussin(g, c.Wb - .5, .3, .08, matiere('cuir', '#ECE4D3', { grain: 'capiton', echelle: .4 }), 0, .62, c.zt + .24, { r: .04 });
      [-1, 1].forEach(k => place(g, mesh(new THREE.BoxGeometry(.2, .01, .2), M('or')), k * (c.Wb / 2 - .15), .75, c.zt + .24));
      coussin(g, c.Wb, .3, .36, m, 0, .03, c.zt + c.et + c.Lb + .16, { r: .05 });
    }
  }),

  /* Royal Soft : velours rose poudré, tête panoramique capitonnée très large à ailes, cadre matelassé */
  'rs-01': p => lit(p, {
    base: matiere('velours', '#D8A4A0', { grain: 'matelasse', echelle: .3 }), hb: .34, yb: .03, cadre: .2,
    tete(g, c) {
      const cap = matiere('velours', '#DCAAA6', { grain: 'capiton', echelle: .4 });
      coussin(g, c.Wb + .1, c.H - .03, .16, cap, 0, .03, c.zt + .08, { r: .05 });
      [-1, 1].forEach(k => coussin(g, .5, c.H - .2, .14, cap, k * (c.Wb / 2 + .26), .03, c.zt + .2, { ry: k * .5, r: .05 }));
    }
  }),

  /* Moon Love : lit rond en cuir végétal rose poudré, bande dorée, tête en ailes de papillon */
  'ml-01'(p) {
    const g = groupe('lit');
    const [W, D, H] = p.dim;
    const m = matiere('cuir', '#D9AFA8'), R = Math.min(W, D) / 2 - .02;
    tambour(g, R, .42, m, 0, 0, .05, { b: .02, ah: .08, ab: .03 });
    tambour(g, R + .002, .03, M('or'), 0, .2, .05, { ah: .005, ab: .005 });
    tambour(g, R - .12, .2, M('drap'), 0, .4, .05, { ah: .05 });
    tambour(g, R - .1, .06, matiere('tissu', '#EFEBE3'), 0, .58, .25, { ah: .03 }).scale.z = .75;
    // tête en papillon : deux grandes ailes rondes et deux petites, jointives au centre
    const aile = matiere('cuir', '#E2BAB2', { grain: 'cannelure', echelle: .3, ns: .6 });
    [-1, 1].forEach(k => {
      [[.4, .74, .46, .28, .55], [.22, .32, .22, .15, .7]].forEach(([cx, cy, rx, ry, rot]) => {
        const fs = new THREE.Shape(); fs.absellipse(0, 0, rx, ry, 0, TAU, false, 0);
        const pn = panneau(g, fs, .08, aile, 'face', k * cx, .2 + cy, -R + .12, { a: .03 });
        pn.rotation.z = k * rot;
      });
    });
    [-.3, .3].forEach(x => { const o = coussin(g, .55, .16, .36, M('drap'), x, .6, -R * .45, { r: .07 }); o.rotation.x = -.35; });
    ombreSol(g, W + .4, D + .4);
    return g;
  },

  /* Soft Loop : bouclette écrue, gros cadre arrondi, tête en boudin d'arche asymétrique */
  'sl-01': p => lit(p, {
    base: matiere('boucle', '#E4DBC8'), hb: .32, yb: .02, cadre: .4, rBase: .16,
    tete(g, c) {
      const m = matiere('boucle', '#E8E0CE');
      boudin(g, [[-c.Wb / 2 + .14, .3, c.zt + .45], [-c.Wb / 2 + .14, .7, c.zt + .16], [-c.Wb * .2, c.H - .14, c.zt + .14], [c.Wb * .25, .62, c.zt + .14], [c.Wb / 2 - .14, .5, c.zt + .14], [c.Wb / 2 - .14, .3, c.zt + .4]], .14, m, { seg: 70, kb: .9 });
    }
  }),

  /* Royal Wing : coffre en tissu beige, haute tête capitonnée flanquée de grandes ailes inclinées */
  'rw-01': p => lit(p, {
    base: matiere('tissu', '#C9B597'), hb: .36, yb: .03, cadre: .16,
    tete(g, c) {
      const cap = matiere('tissu', '#D2BE9E', { grain: 'capiton', echelle: .42 });
      coussin(g, c.Wb, c.H - .03, .16, cap, 0, .03, c.zt + .08, { r: .05 });
      [-1, 1].forEach(k => coussin(g, .16, c.H - .1, .6, cap, k * (c.Wb / 2 + .12), .03, c.zt + .32, { ry: k * .6, r: .06 }));
    }
  })
};
