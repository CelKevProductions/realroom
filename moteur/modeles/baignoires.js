/* =================================================================
   RealRoom — modèles fidèles : baignoires (d'après les photos produits)
   Origine au sol, centrée, axe long selon x, face avant vers +z.
   Deux familles : baignoires îlot (coque moulée d'un seul tenant :
   évasement, lèvre, bouts relevés, cannelures, matelassé, pieds griffes)
   et baignoires encastrées ou balnéo (caisson à tablier, bassin creusé
   dans la plage, vitres, jets, appuie-têtes, robinetterie).
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, V3, clamp, lerp, alea,
  coussin, boudin, panneau, matiere, ombreSol, cyl, sphere, instances
} from './outils.js';

/* ---------- matières ---------- */
const MATS = {};
function acrylique(c = '#F4F3EF', mat = false) {
  const k = c + mat;
  if (MATS[k]) return MATS[k];
  const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: mat ? .5 : .16, clearcoat: mat ? .1 : 1, clearcoatRoughness: mat ? .6 : .08 });
  m.name = 'acrylique:' + k;
  return (MATS[k] = m);
}
function verreBain(teinte = '#BFDCE4', opacite = .55) {
  const k = 'verre' + teinte + opacite;
  if (MATS[k]) return MATS[k];
  const m = new THREE.MeshPhysicalMaterial({ color: teinte, roughness: .05, transparent: true, opacity: opacite, clearcoat: 1, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
  m.name = k;
  return (MATS[k] = m);
}
const chrome = () => M('chrome');

/* ---------- contours en plan (x, z) parcourus dans le sens x → z ---------- */
// superellipse (n = 2 : ovale, n grand : rectangle), dos plat (côté −z), œuf (un bout plus large)
function contourIlot(a, b, o = {}) {
  const n = o.n || 2, nd = o.dos ? 14 : n, oeuf = o.oeuf || 0;
  return th => {
    const c = Math.cos(th), s = Math.sin(th), e = s < 0 ? nd : n;
    const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / e), z = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / e);
    return [x, z * (1 + oeuf * x / a)];
  };
}
// rectangle aux coins arrondis, rayons [arrière gauche, arrière droit, avant droit, avant gauche]
function rectR(L, P, r) {
  const [rbl, rbr, rfr, rfl] = r.map(v => Math.min(v, L, P)), pts = [];
  const arc = (cx, cz, rr, a0) => { for (let i = 0; i <= 16; i++) { const a = a0 + i / 16 * Math.PI / 2; pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); } };
  arc(L / 2 - rbr, -P / 2 + rbr, rbr, -Math.PI / 2);         // arrière droit
  arc(L / 2 - rfr, P / 2 - rfr, rfr, 0);                     // avant droit
  arc(-L / 2 + rfl, P / 2 - rfl, rfl, Math.PI / 2);          // avant gauche
  arc(-L / 2 + rbl, -P / 2 + rbl, rbl, Math.PI);             // arrière gauche
  return pts;
}
// polyligne fermée rééchantillonnée à pas constant ; normales sortantes
function regulier(pts, nu) {
  const n = pts.length, cum = [0];
  for (let i = 1; i <= n; i++) { const A = pts[i - 1], B = pts[i % n]; cum.push(cum[i - 1] + Math.hypot(B[0] - A[0], B[1] - A[1])); }
  const tot = cum[n], P = [];
  let k = 0;
  for (let i = 0; i < nu; i++) {
    const s = i / nu * tot;
    while (cum[k + 1] < s) k++;
    const A = pts[k], B = pts[(k + 1) % n], t = (s - cum[k]) / Math.max(1e-9, cum[k + 1] - cum[k]);
    P.push([lerp(A[0], B[0], t), lerp(A[1], B[1], t)]);
  }
  // orientation x → z (aire positive), sinon on inverse
  let aire = 0;
  for (let i = 0; i < nu; i++) { const A = P[i], B = P[(i + 1) % nu]; aire += A[0] * B[1] - B[0] * A[1]; }
  if (aire < 0) P.reverse();
  const N = P.map((_, i) => { const A = P[(i - 1 + nu) % nu], B = P[(i + 1) % nu], tx = B[0] - A[0], tz = B[1] - A[1], l = Math.hypot(tx, tz) || 1; return [tz / l, -tx / l]; });
  return { P, N, long: tot, nu };
}
const echantillonner = (f, nu) => regulier(Array.from({ length: 2000 }, (_, i) => f(i / 2000 * TAU)), nu);
// retrait vers l'intérieur (contour convexe)
const retrait = (C, d) => C.P.map(([x, z], i) => [x - C.N[i][0] * d, z - C.N[i][1] * d]);
// coupe d'un polygone par un demi-plan f(p) ≥ 0 (Sutherland–Hodgman)
function couper(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B);
    if (fa >= 0) out.push(A);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([lerp(A[0], B[0], t), lerp(A[1], B[1], t)]); }
  }
  return out;
}
// forme THREE (plan x, −z) pour panneau 'sol'
const forme = (pts, trous = []) => {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  trous.forEach(t => s.holes.push(new THREE.Path(t.map(([x, z]) => new THREE.Vector2(x, -z)))));
  return s;
};
// surface en anneau fermé : f(i, j) → [x, y, z], i bouclé sur nu
function anneau(nu, nv, f) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i < nu; i++) pos.push(...f(i, j));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * nu + i, b = j * nu + (i + 1) % nu, c = a + nu, d = b + nu; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// plaque plane horizontale (fond de bassin) : vers le haut, ou vers le bas (dessous)
function plaque(g, pts, y, m, dessous = false) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, dessous ? z : -z)));
  const me = mesh(new THREE.ShapeGeometry(s, 4), m);
  me.rotation.x = dessous ? Math.PI / 2 : -Math.PI / 2; me.position.y = y;
  g.add(me);
  return me;
}
// rotation (x, y, z) qui amène l'axe +y sur la direction d
function versDir(dx, dy, dz) {
  const l = Math.hypot(dx, dy, dz) || 1, e = Math.asin(clamp(dy / l, -1, 1)), az = Math.atan2(dz, dx);
  return [0, -az, -(Math.PI / 2 - e)];
}

/* ---------- accessoires ---------- */
// robinetterie de plage : bec, deux manettes, douchette sur support (ry : orientation de la rangée)
function robinetterie(g, x, y, z, ry = 0, o = {}) {
  const m = o.m || chrome(), c = groupe(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
  const pas = o.pas || .085, n = o.n || 4;
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * pas;
    cyl(c, .018, .02, .012, m, dx, 0, 0, 14);
    if (i === 1) boudin(c, [[dx, .01, 0], [dx, .12, 0], [dx, .16, .03], [dx, .15, .1]], .011, m, { seg: 24, radial: 10 });   // bec
    else if (i === n - 1) { cyl(c, .016, .016, .05, m, dx, .01, 0, 12); boudin(c, [[dx, .06, 0], [dx, .2, 0]], .014, m, { seg: 2, radial: 10, tension: 0 }); }   // douchette
    else { cyl(c, .012, .012, .04, m, dx, .01, 0, 12); boudin(c, [[dx, .05, 0], [dx, .06, .05]], .006, m, { seg: 6, radial: 6 }); }
  }
  return c;
}
// appuie-tête moulé : coussin bombé, incliné vers le bassin (ry : direction vers l'intérieur)
function appuieTete(g, x, y, z, ry, m = M('noirMat'), l = .3) {
  const c = groupe(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
  coussin(c, l, .06, .11, m, 0, -.01, 0, { r: .03, rx: .55, b: [.004, .012, .006] });
  return c;
}
// pied griffe : boule au sol, trois griffes, jambe galbée qui s'évase sous la coque
function piedGriffe(g, x, z, h, m) {
  const l = Math.hypot(x, z) || 1, sx = x / l, sz = z / l;
  sphere(g, .03, m, x, .03, z, 1, .85, 1, 14);
  for (let k = -1; k <= 1; k++) {
    const a = Math.atan2(sz, sx) + k * .6;
    boudin(g, [[x, .05, z], [x + Math.cos(a) * .035, .042, z + Math.sin(a) * .035], [x + Math.cos(a) * .05, .008, z + Math.sin(a) * .05]], t => .013 - .009 * t, m, { seg: 10, radial: 6 });
  }
  boudin(g, [[x, .045, z], [x - sx * .014, h * .45, z - sz * .014], [x + sx * .008, h * .8, z + sz * .008], [x + sx * .03, h + .03, z + sz * .03]], t => .02 + .024 * t * t, m, { seg: 20, radial: 10 });
  sphere(g, .026, m, x + sx * .02, h * .72, z + sz * .02, .8, 1.4, .8, 12);
}
// disque chromé posé sur une paroi : position et normale (jets, trop-plein, bonde)
function pastilles(g, liste, r = .018, ep = .008, m = chrome()) {
  instances(g, new THREE.CylinderGeometry(1, 1, 1, 16), m, liste.map(([x, y, z, nx, ny, nz]) => [x + nx * ep / 2, y + ny * ep / 2, z + nz * ep / 2, ...versDir(nx, ny, nz), 1, r, ep, r]));
}

/* =================================================================
   Baignoire îlot : coque moulée
   o.n, o.oeuf, o.dos : contour ; o.F : évasement (retrait du pied) ;
   o.rb : arrondi du pied ; o.levre / o.levreH : largeur et épaisseur de
   la lèvre ; o.roule : bord roulé débordant ; o.double / o.dossier :
   bouts relevés (m) ; o.sens : côté du dossier (+1 : x > 0) ;
   o.ext / o.int : matières ; o.cannelures, o.matelasse : reliefs ;
   o.griffes : matière des pieds ; o.socle : plinthe en retrait ;
   o.plage : 'bout' | 'dos' | 'coin' (robinetterie) ; o.jets : balnéo
   ================================================================= */
function ilot(p, o = {}) {
  const g = groupe('baignoire');
  const L = clamp(p.dim[0], 1.1, 2.1), P = clamp(p.dim[1], .6, 1.3), H0 = clamp(p.dim[2], .45, 1);
  const hp = o.griffes ? (o.hp ?? .14) : 0, mont = (o.double || 0) + (o.dossier || 0), Hb = H0 - hp - mont;
  const a = L / 2 - .005, b = P / 2 - .005, sens = o.sens || 1;
  const ext = o.ext || acrylique(), int = o.int || acrylique();
  const F = o.F ?? .08, rb = o.rb ?? .05, lw = o.levre ?? .025, lh = o.levreH ?? lw * .45, gam = o.gamma ?? 1;
  const yf = o.fond ?? .1, dIn = o.dIn ?? .09, rf = o.rf ?? .12, ov = o.roule ? .014 : 0;
  const nu = o.cannelures ? 4 * Math.round((TAU * Math.sqrt((a * a + b * b) / 2)) / .032) : o.matelasse ? 320 : 180;
  const C = echantillonner(contourIlot(a, b, o), nu);
  const hRim = x => { const u = x / a; return Hb + (o.double || 0) * Math.pow(Math.abs(u), 2.6) + (o.dossier || 0) * Math.pow(clamp((u * sens + .15) / 1.15, 0, 1), 2.2); };
  const yRef = yf + rf;
  // profils : [retrait d, hauteur y, part du mur (0..1) pour les reliefs]
  const pe = [], pi = [];
  const sh = o.socle ? o.socle[0] : 0, sd = o.socle ? o.socle[1] : 0;
  if (sh) { pe.push([F + rb + sd, 0, -1, 0], [F + rb + sd, sh * .9, -1, 0], [F + rb + sd * .5, sh, -1, 0]); }
  for (let k = 0; k <= 6; k++) { const ph = k / 6 * Math.PI / 2; pe.push([F + rb - rb * Math.sin(ph), sh + rb - rb * Math.cos(ph), -1, 0]); }
  const ym = Hb - lh, nm = 18;
  for (let k = 1; k <= nm; k++) { const t = k / nm; pe.push([F * Math.pow(1 - t, gam) - ov * Math.pow(t, 6), sh + rb + t * (ym - sh - rb), t, t]); }
  // lèvre : demi-ellipse de l'extérieur vers l'intérieur (sommet = jonction des deux matières)
  const lev = [];
  for (let k = 1; k <= 8; k++) { const ps = k / 8 * Math.PI; lev.push([-ov + (lw + ov) / 2 * (1 - Math.cos(ps)), ym + (lh + ov * .6) * Math.sin(ps), -1, 1]); }
  pe.push(...lev.slice(0, 4));
  pi.push(lev[3], ...lev.slice(4));
  // la paroi intérieure reste à 3 cm au moins de la paroi extérieure (coque à double peau)
  const dExt = y => { let best = pe[0][0]; for (const q of pe) if (q[1] <= y) best = q[0]; return Math.max(0, best); };
  const ni = 16;
  for (let k = 1; k <= ni; k++) { const t = k / ni, y = ym - t * (ym - yRef); pi.push([Math.max(lw + (dIn - rf * .5) * Math.pow(t, 1.6), dExt(y) + .03 * t), y, -1, 1 - t]); }
  const dBas = pi[pi.length - 1][0], dFond = Math.max(dBas + rf * .5, dExt(yf) + .035);
  for (let k = 1; k <= 6; k++) { const ph = k / 6 * Math.PI / 2; pi.push([lerp(dBas, dFond, Math.sin(ph)), yf + rf - rf * Math.sin(ph), -1, 0]); }
  // reliefs du mur extérieur
  const relief = (i, w) => {
    if (w < 0) return 0;
    const fade = Math.pow(Math.sin(Math.PI * clamp(w * 1.04, 0, 1)), .35);
    if (o.cannelures) return .0055 * (1 - Math.cos(TAU * (i / nu) * (nu / 4))) / 2 * fade;
    if (o.matelasse) { const U = i / nu * C.long / .17, V = w * (ym - rb) / .13, pp = U + V, qq = U - V; return -.009 * (1 - Math.cos(TAU * pp)) * (1 - Math.cos(TAU * qq)) / 4 * fade; }
    return 0;
  };
  const point = (i, d, y, w = -1, lam = 0) => {
    const [x, z] = C.P[i], [nx, nz] = C.N[i], hr = hRim(x);
    const yy = y <= yRef ? y : yRef + (y - yRef) * (hr - yRef) / (Hb - yRef);
    const dd = d + relief(i, w) - (hr - Hb) * .3 * lam;          // les bouts relevés penchent vers l'extérieur
    return [x - nx * dd, hp + yy, z - nz * dd];
  };
  g.add(mesh(anneau(nu, pe.length - 1, (i, j) => point(i, ...pe[j])), ext));
  g.add(mesh(anneau(nu, pi.length - 1, (i, j) => point(i, ...pi[j])), int));
  plaque(g, retrait(C, dFond), hp + yf, int);
  plaque(g, retrait(C, F + rb + sd), hp + .001, ext, true);
  // trop-plein et bonde, côté pieds (opposé au dossier)
  const i0 = sens > 0 ? Math.round(nu / 2) : 0, [x0, z0] = C.P[i0], [nx0, nz0] = C.N[i0];
  const dParoi = t => { const y = ym - t * (ym - yRef); return [Math.max(lw + (dIn - rf * .5) * Math.pow(t, 1.6), dExt(y) + .03 * t), y]; };
  const pt = point(i0, ...dParoi(.15), -1, .85);
  pastilles(g, [[...pt, -nx0, 0, -nz0]], .026, .008);
  pastilles(g, [[x0 - nx0 * (dFond + .1), hp + yf + .001, z0 - nz0 * (dFond + .1), 0, 1, 0]], .03, .004);
  // plage de robinetterie
  if (o.plage) {
    const bord = retrait(C, lw * .4);
    let poly, rx, rz, ry;
    if (o.plage === 'bout') { const xx = -sens * (a - .2); poly = couper(bord, q => -sens * (q[0] - xx)); rx = -sens * (a - .11); rz = 0; ry = Math.PI / 2; }
    else if (o.plage === 'dos') { poly = couper(bord, q => -(q[1] + b - .16)); rx = 0; rz = -b + .085; ry = 0; }
    else { poly = couper(couper(bord, q => q[0] - (a - .3)), q => -(q[1] + b - .3)); rx = a - .16; rz = -b + .16; ry = -Math.PI / 4; }
    const yp = hp + hRim(rx) - .028;
    panneau(g, forme(poly), .03, int, 'sol', 0, yp, 0, { a: .008 });
    robinetterie(g, rx, yp + .03, rz, ry, { n: o.robinets || 4 });
  }
  if (o.jets) {
    const liste = [];
    for (let k = 0; k < o.jets; k++) {
      const i = Math.round((k + .5) / o.jets * nu) % nu, q = point(i, ...dParoi(.55), -1, .45), [nx, nz] = C.N[i];
      liste.push([...q, -nx, 0, -nz]);
    }
    pastilles(g, liste, .016, .006);
  }
  if (o.griffes) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => piedGriffe(g, sx * a * .58, sz * b * .5, hp, o.griffes));
  ombreSol(g, L + .5, P + .5);
  return g;
}

/* =================================================================
   Baignoire encastrée ou balnéo : caisson à tablier et plage, bassin
   o.plan : contour (rectR) ; o.bassin : { n, a, b, cx, cz } ou { marge } ;
   o.tablier : 'cadres' | 'vague' ; o.vitre : [x0, x1, y0, y1] sur la face
   avant ; o.vitreCourbe : [u0, u1] le long de l'avant ; o.fumes ; o.led ;
   o.appuis : [[x, z, ry, noir]] ; o.jets ; o.robinets : [x, z, ry] ;
   o.commande : [x, z] ; o.bois : [x0, x1] ; o.poignees : [[x, z, ry]] ;
   o.ext : matière du tablier
   ================================================================= */
function encastree(p, o = {}) {
  const g = groupe('baignoire');
  const L = clamp(p.dim[0], 1, 2.1), P = clamp(p.dim[1], .6, 1.6), H = clamp(p.dim[2], .45, .8);
  const blanc = acrylique(), ext = o.ext || blanc, gris = acrylique('#DCD9D2', true);
  const plan = o.plan || rectR(L, P, [.03, .03, .03, .03]);
  const Cp = regulier(plan, 240);
  // ouverture du bassin
  let Co;
  if (o.bassin && o.bassin.n) { const B = o.bassin; Co = echantillonner(th => { const [x, z] = contourIlot(B.a, B.b, { n: B.n })(th); return [x + (B.cx || 0), z + (B.cz || 0)]; }, 200); }
  else Co = regulier(retrait(Cp, (o.bassin && o.bassin.marge) || .11), 200);
  const yh = H - .012, yf = .14, dIn = .07, rf = .1, sh = .05;
  // caisson : plinthe en retrait, corps percé de l'ouverture, arêtes arrondies
  panneau(g, forme(retrait(Cp, .018)), sh, gris, 'sol', 0, 0, 0, { a: .004 });
  panneau(g, forme(Cp.P, [retrait(Co, -.01)]), H - sh, ext === blanc ? blanc : ext, 'sol', 0, sh, 0, { a: .012 });
  if (ext !== blanc) panneau(g, forme(retrait(Cp, -.004), [retrait(Co, -.01)]), .03, blanc, 'sol', 0, H - .03, 0, { a: .008 });
  // bassin : paroi inclinée de l'ouverture au fond, fond plat
  const prof = [];
  for (let k = 0; k <= 14; k++) { const t = k / 14; prof.push([dIn * .6 * Math.pow(t, 1.5), yh - t * (yh - yf - rf)]); }
  for (let k = 1; k <= 5; k++) { const ph = k / 5 * Math.PI / 2; prof.push([dIn * .6 + rf * .4 * Math.sin(ph), yf + rf - rf * Math.sin(ph)]); }
  const bp = (i, d, y) => [Co.P[i][0] - Co.N[i][0] * d, y, Co.P[i][1] - Co.N[i][1] * d];
  g.add(mesh(anneau(Co.nu, prof.length - 1, (i, j) => bp(i, ...prof[j])), blanc));
  plaque(g, retrait(Co, dIn * .6 + rf * .4), yf, blanc);
  // jets sur la paroi du bassin
  if (o.jets) {
    const liste = [];
    for (let k = 0; k < o.jets; k++) { const i = Math.round((k + .5) / o.jets * Co.nu) % Co.nu; liste.push([...bp(i, dIn * .25, yh - (yh - yf) * .45), -Co.N[i][0], 0, -Co.N[i][1]]); }
    pastilles(g, liste, .017, .007);
  }
  // bonde et trop-plein
  const i0 = Math.round(Co.nu / 2);
  pastilles(g, [[...bp(i0, .02, yh - .07), -Co.N[i0][0], 0, -Co.N[i0][1]], [Co.P[i0][0] - Co.N[i0][0] * .2, yf + .001, Co.P[i0][1] - Co.N[i0][1] * .2, 0, 1, 0]], .026, .006);
  // tablier : moulures, vitres, LED
  const zf = P / 2 + .016;
  if (o.tablier === 'cadres') {
    const rails = [], xs = o.cadres || [[-L / 2 + .08, L / 2 - .08]];
    xs.forEach(([x0, x1]) => {
      [[x0, x1, .12], [x0, x1, H - .1]].forEach(([u0, u1, y]) => rails.push([(u0 + u1) / 2, y, zf, 0, 0, 0, 1, u1 - u0, .008, .004]));
      [x0, x1].forEach(x => rails.push([x, (H - .1 + .12) / 2, zf, 0, 0, 0, 1, .008, H - .22, .004]));
    });
    instances(g, new THREE.BoxGeometry(1, 1, 1), acrylique('#C9C6BF', true), rails);
  }
  if (o.tablier === 'vague') {
    const av = Cp.P.map((q, i) => [q, Cp.N[i]]).filter(([, n]) => n[1] > .35), pts = [];
    av.forEach(([[x, z], [nx, nz]], k) => { const t = k / Math.max(1, av.length - 1); pts.push([x + nx * .013, sh + .1 + (H - sh - .22) * (.5 + .45 * Math.sin(t * Math.PI * 1.6 - .6)), z + nz * .013]); });
    if (pts.length > 3) boudin(g, pts, .005, acrylique('#D2CFC8'), { seg: 120, radial: 6 });
  }
  if (o.vitre) {
    const [x0, x1, y0, y1] = o.vitre;
    place(g, mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, .01), verreBain('#A9D3E0', .8)), (x0 + x1) / 2, (y0 + y1) / 2, P / 2 + .02);
    place(g, mesh(new THREE.BoxGeometry(x1 - x0 + .03, .022, .03), M('noirMat')), (x0 + x1) / 2, H + .004, P / 2 - .005);
  }
  if (o.vitreCourbe) {
    const [x0, x1] = o.vitreCourbe, y0 = sh + .08, y1 = H - .02;
    const av = Cp.P.map((q, i) => [q, Cp.N[i]]).filter(([[x], [, nz]]) => nz > .12 && x >= x0 && x <= x1);
    const pick = t => av[Math.min(av.length - 1, Math.round(t * (av.length - 1)))];
    const geo = new THREE.BufferGeometry(), pos = [], idx = [], n = Math.max(2, Math.min(60, av.length - 1));
    for (let i = 0; i <= n; i++) { const [[x, z], [nx, nz]] = pick(i / n); pos.push(x + nx * .02, y0, z + nz * .02, x + nx * .02, y1, z + nz * .02); if (i < n) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    g.add(mesh(geo, verreBain('#A9D3E0', .75), false));
    boudin(g, Array.from({ length: n + 1 }, (_, i) => { const [[x, z], [nx, nz]] = pick(i / n); return [x + nx * .016, H + .004, z + nz * .016]; }), .01, o.cadreVitre || M('noirMat'), { seg: 80, radial: 6, kv: .8 });
  }
  if (o.fumes) o.fumes.forEach(([x0, x1, cote]) => {
    place(g, mesh(new THREE.BoxGeometry(x1 - x0, .1, .01), verreBain('#3C3E44', .85)), (x0 + x1) / 2, H - .06, cote * (P / 2 + .02));
    place(g, mesh(new THREE.BoxGeometry(x1 - x0 + .02, .018, .028), M('noirMat')), (x0 + x1) / 2, H + .004, cote * (P / 2 - .006));
  });
  if (o.led) {
    const av = Cp.P.map((q, i) => [q, Cp.N[i]]).filter(([, n]) => n[1] > .5);
    if (av.length > 2) boudin(g, av.map(([[x, z], [nx, nz]]) => [x + nx * .014, sh + .09, z + nz * .014]), .004, M('led:' + (o.led === true ? '#7FCBFF' : o.led)), { seg: 100, radial: 5 });
  }
  // plage : appuie-têtes, robinetterie, commande, tablette, poignées
  (o.appuis || []).forEach(([x, z, ry, noir = true]) => appuieTete(g, x, H + .012, z, ry, noir ? M('noirMat') : blanc));
  if (o.robinets) robinetterie(g, o.robinets[0], H, o.robinets[1], o.robinets[2] || 0, { n: o.robinets[3] || 4, m: o.robinetsNoirs ? M('noir') : chrome() });
  if (o.commande) place(g, mesh(new THREE.BoxGeometry(.12, .01, .06), M('noir')), o.commande[0], H + .005, o.commande[1]);
  if (o.bois) { const [x0, x1] = o.bois; place(g, mesh(new THREE.BoxGeometry(x1 - x0, .025, P - .06), matiere('bois', '#B0784A', { couleurs: ['#BE875A', '#94603A'] })), (x0 + x1) / 2, H + .0125, 0); }
  (o.poignees || []).forEach(([x, z, ry]) => { const c = groupe(); c.position.set(x, H, z); c.rotation.y = ry; g.add(c); boudin(c, [[-.14, 0, 0], [-.11, .05, 0], [.11, .05, 0], [.14, 0, 0]], .009, chrome(), { seg: 30, radial: 8 }); });
  if (o.cascade) place(g, mesh(new THREE.BoxGeometry(.16, .015, .05), chrome()), o.cascade[0], H + .008, o.cascade[1]);
  ombreSol(g, L + .5, P + .5);
  return g;
}

/* ---------- raccourcis ---------- */
const noirMat = () => acrylique('#232226', true), noirBrillant = () => acrylique('#1E1D21'), blancMat = () => acrylique('#F2F1EC', true);
const quart = (L, P) => rectR(L, P, [.03, .03, Math.min(L, P) * .98, .03]);

export const BAIGNOIRES = {
  /* Bicolore Bologna : œuf ovale très évasé, extérieur noir mat, intérieur et lèvre blancs */
  'wa5043': p => ilot(p, { n: 2, oeuf: .1, F: .13, rb: .1, levre: .016, double: .04, ext: noirMat(), gamma: .8 }),
  /* Baignoire griffe rétro : slipper à bord roulé, pieds griffes dorés */
  'wa908': p => ilot(p, { n: 2.3, F: .07, rb: .12, levre: .03, roule: true, dossier: .16, griffes: M('or'), hp: .15 }),
  /* WA5052 Stripe : cannelures verticales, blanc mat, bouts légèrement relevés */
  'wa5052-stripe': p => ilot(p, { n: 3.2, F: .1, rb: .05, levre: .016, double: .05, ext: blancMat(), cannelures: true }),
  /* WA5002 : ovale double, lèvre épaisse arrondie */
  'wa5002': p => ilot(p, { n: 3, F: .05, rb: .06, levre: .036, levreH: .02, double: .03 }),
  /* WA5023 : noire cannelée, double slipper très relevée, forte évasure */
  'wa5023': p => ilot(p, { n: 3, F: .14, rb: .05, levre: .015, double: .17, ext: noirBrillant(), cannelures: true }),
  /* WA5009 : ovale à plage de robinetterie en bout */
  'wa5009': p => ilot(p, { n: 2.6, F: .07, rb: .07, levre: .03, plage: 'bout', sens: -1 }),
  /* WA5006 : ovale profond, parois presque droites, plage en bout */
  'wa5006': p => ilot(p, { n: 2.8, F: .03, rb: .06, levre: .04, levreH: .02, plage: 'bout', sens: -1 }),
  /* WA5012 : ovale double, lèvre fine, parois évasées */
  'wa5012': p => ilot(p, { n: 2.6, F: .1, rb: .06, levre: .02, double: .04 }),
  /* WA5018 : ovale à dossier relevé d'un côté */
  'wa5018': p => ilot(p, { n: 2.6, F: .09, rb: .06, levre: .018, dossier: .1 }),
  /* WA5024 : ovale double, lèvre épaisse */
  'wa5024': p => ilot(p, { n: 2.8, F: .07, rb: .06, levre: .035, levreH: .018, double: .03 }),
  /* WA5019 : ovale double, lèvre épaisse, bouts évasés */
  'wa5019': p => ilot(p, { n: 2.6, F: .1, rb: .07, levre: .03, double: .04 }),
  /* WA5011 : rectangulaire, parois droites, plage d'angle avec robinetterie */
  'wa5011': p => ilot(p, { n: 10, F: .012, rb: .03, levre: .02, plage: 'coin', rf: .08 }),
  /* WA5035 : rectangle aux angles arrondis, parois très évasées */
  'wa5035': p => ilot(p, { n: 6, F: .11, rb: .04, levre: .02, dossier: .03 }),
  /* WA5004 : rectangulaire, parois évasées, bord plat */
  'wa5004': p => ilot(p, { n: 7, F: .08, rb: .04, levre: .02 }),
  /* WA5015 : silhouette galbée, plage de robinetterie le long du dos */
  'wa5015': p => ilot(p, { n: 2.6, F: .09, rb: .1, levre: .03, gamma: .65, plage: 'dos' }),
  /* WA5022 : rectangulaire profonde, parois évasées */
  'wa5022': p => ilot(p, { n: 8, F: .07, rb: .04, levre: .02 }),
  /* WA5028 : dos plat contre le mur, avant ovale, dossier ergonomique */
  'wa5028': p => ilot(p, { n: 2.4, dos: true, F: .05, rb: .06, levre: .03, dIn: .12 }),
  /* WA5030 : façade arrière rectangulaire, avant arrondi */
  'wa5030': p => ilot(p, { n: 2.6, dos: true, F: .04, rb: .05, levre: .03 }),
  /* WA5005 : nacelle à dossier haut incliné d'un côté, plinthe en retrait */
  'wa5005': p => ilot(p, { n: 2.4, F: .08, rb: .06, levre: .02, dossier: .17, socle: [.045, .03] }),
  /* WA5029 : ovale à dossier relevé */
  'wa5029': p => ilot(p, { n: 2.4, F: .12, rb: .06, levre: .02, dossier: .12 }),
  /* WA5040 : slipper élancée, dossier très haut */
  'wa5040': p => ilot(p, { n: 2.3, F: .12, rb: .07, levre: .018, dossier: .25 }),
  /* WA5054 : ovale à extérieur matelassé en losanges */
  'wa5054': p => ilot(p, { n: 2.6, F: .06, rb: .06, levre: .03, double: .03, matelasse: true }),
  /* Stripe : striée, contour presque rectangulaire, bord plat */
  'wa5053-stripe': p => ilot(p, { n: 4, F: .1, rb: .04, levre: .02, cannelures: true }),
  /* WA5023 Stripe : cannelée blanche, double slipper haute */
  'wa5023-stripe': p => ilot(p, { n: 3, F: .14, rb: .05, levre: .016, double: .28, cannelures: true }),
  /* Style Slipper : ovale à deux bouts relevés */
  'wa5016': p => ilot(p, { n: 2.6, F: .1, rb: .06, levre: .018, double: .12 }),
  /* Modèle Slipper : bord roulé, dossier relevé, pieds griffes chromés */
  'wa911': p => ilot(p, { n: 2.3, F: .07, rb: .12, levre: .03, roule: true, dossier: .15, griffes: M('chrome'), hp: .14 }),
  /* WA5015M : ovale galbée balnéo, plage au dos, jets */
  'wa5015m': p => ilot(p, { n: 2.6, F: .09, rb: .1, levre: .03, gamma: .65, plage: 'dos', jets: 6 }),

  /* WA1044 : avant gauche arrondi habillé d'une vitre courbe, appuie-tête noir, jets */
  'wa1044'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: rectR(L, P, [.03, .03, .03, P * .7]), bassin: { marge: .1 }, vitreCourbe: [-L / 2, L * .12], cadreVitre: acrylique(), appuis: [[L / 2 - .14, 0, -Math.PI / 2]], jets: 8, robinets: [-L / 2 + .3, -P / 2 + .05, 0, 4], commande: [L / 2 - .25, -P / 2 + .05] });
  },
  /* WA1048 : grand rectangle, vitre en façade, deux appuie-têtes noirs, jets */
  'wa1048'(p) {
    const [L, P, H] = p.dim;
    return encastree(p, { bassin: { n: 5, a: L / 2 - .13, b: P / 2 - .14, cz: .02 }, vitre: [-L * .38, L * .32, .16, H - .04], appuis: [[-L / 2 + .14, 0, Math.PI / 2], [L / 2 - .14, 0, -Math.PI / 2]], jets: 14, robinets: [L * .2, -P / 2 + .07, 0, 5] });
  },
  /* WA1047 : deux places, bandeaux de verre fumé devant et derrière, deux appuie-têtes */
  'wa1047'(p) {
    const [L, P] = p.dim;
    return encastree(p, { bassin: { n: 5, a: L / 2 - .12, b: P / 2 - .13 }, fumes: [[-L * .4, L * .4, 1], [-L * .4, L * .4, -1]], appuis: [[L * .05, -P / 2 + .14, 0], [L * .28, -P / 2 + .14, 0]], jets: 16, robinets: [-L / 2 + .07, 0, Math.PI / 2, 4] });
  },
  /* WA1043 : avant gauche arrondi, cascade et ligne LED, appuie-tête blanc */
  'wa1043'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: rectR(L, P, [.03, .03, .03, P * .8]), bassin: { marge: .1 }, led: true, appuis: [[L / 2 - .14, 0, -Math.PI / 2, false]], jets: 8, robinets: [-L / 2 + .3, -P / 2 + .05, 0, 4], cascade: [0, -P / 2 + .05] });
  },
  /* WA1050 : avant gauche arrondi, ligne LED bleue, appuie-tête blanc */
  'wa1050'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: rectR(L, P, [.03, .03, .03, P * .55]), bassin: { marge: .1 }, led: true, appuis: [[-L / 2 + .16, 0, Math.PI / 2, false]], jets: 8, robinets: [L / 2 - .25, -P / 2 + .05, 0, 4] });
  },
  /* WA5036 : quart de cercle, hublot de verre courbe en façade, deux appuie-têtes noirs */
  'wa5036'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: quart(L, P), bassin: { marge: .13 }, vitreCourbe: [-L * .22, L * .28], appuis: [[L * .18, -P / 2 + .14, 0], [-L / 2 + .14, P * .18, Math.PI / 2]], jets: 10, robinets: [-L / 2 + .2, -P / 2 + .2, -Math.PI / 4, 4] });
  },
  /* WA5037 : rectangle, bandeau de verre fumé en façade, robinetterie et commande noires */
  'wa5037'(p) {
    const [L, P] = p.dim;
    return encastree(p, { bassin: { n: 6, a: L / 2 - .1, b: P / 2 - .11 }, fumes: [[-L * .38, L * .38, 1]], jets: 10, robinets: [-L / 2 + .35, -P / 2 + .05, 0, 4], robinetsNoirs: true, commande: [L / 2 - .3, -P / 2 + .05] });
  },
  /* WA5020 : rectangle simple, jets, robinetterie au dos */
  'wa5020'(p) {
    const [L, P] = p.dim;
    return encastree(p, { bassin: { n: 6, a: L / 2 - .09, b: P / 2 - .1 }, jets: 8, robinets: [-L / 2 + .45, -P / 2 + .05, 0, 5] });
  },
  /* WA5004M : rectangle à tablier bleu marine, plage blanche, jets */
  'wa5004m'(p) {
    const [L, P] = p.dim;
    return encastree(p, { ext: acrylique('#1F2D4D'), bassin: { n: 6, a: L / 2 - .07, b: P / 2 - .08 }, jets: 8, robinets: [-L / 2 + .3, -P / 2 + .04, 0, 4] });
  },
  /* WA5007 : asymétrique, grand arrondi avant gauche, jets, commande */
  'wa5007'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: rectR(L, P, [.03, .03, .03, P * .9]), bassin: { marge: .1 }, jets: 8, robinets: [L * .05, -P / 2 + .05, 0, 4], commande: [-L / 2 + .3, -P / 2 + .05] });
  },
  /* WA6013M : tablier à panneau mouluré, appuie-tête noir, jets */
  'wa6013m'(p) {
    const [L, P] = p.dim;
    return encastree(p, { bassin: { n: 4, a: L / 2 - .12, b: P / 2 - .12 }, tablier: 'cadres', appuis: [[-L / 2 + .16, 0, Math.PI / 2]], jets: 6, robinets: [L * .1, -P / 2 + .05, 0, 5] });
  },
  /* WA6018M : angle asymétrique à façade courbe moulurée en vague, appuie-tête, commande */
  'wa6018m'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: quart(L, P), bassin: { marge: .12 }, tablier: 'vague', appuis: [[-L / 2 + .2, P * .05, Math.PI / 2]], jets: 6, robinets: [L * .05, -P / 2 + .05, 0, 4], commande: [L * .2, P * .05] });
  },
  /* WA1042 : tablier mouluré, tablette en bois massif, appuie-tête noir */
  'wa1042'(p) {
    const [L, P] = p.dim;
    return encastree(p, { bassin: { n: 5, a: L / 2 - .2, b: P / 2 - .11, cx: .06 }, tablier: 'cadres', cadres: [[-L / 2 + .08, -.1], [-.06, L / 2 - .08]], bois: [-L / 2 + .02, -L / 2 + .3], appuis: [[L / 2 - .16, 0, -Math.PI / 2]], jets: 8, robinets: [-L * .05, -P / 2 + .05, 0, 4] });
  },
  /* Onda : petite asymétrique, façade courbe à vague moulurée, appuie-tête noir */
  'wa1041'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: rectR(L, P, [.03, .03, .03, P * .85]), bassin: { marge: .1 }, tablier: 'vague', appuis: [[-L / 2 + .2, P * .05, Math.PI / 2]], jets: 5, robinets: [L * .1, -P / 2 + .05, 0, 4] });
  },
  /* WA6016 : quart de cercle, deux appuie-têtes noirs, jets */
  'wa6016'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: quart(L, P), bassin: { marge: .14 }, tablier: 'vague', appuis: [[L * .15, -P / 2 + .15, 0], [-L / 2 + .15, P * .15, Math.PI / 2]], jets: 6, robinets: [-L / 2 + .22, -P / 2 + .22, -Math.PI / 4, 4] });
  },
  /* WA1045 : asymétrique, grand arrondi avant droit, deux appuie-têtes, poignées */
  'wa1045'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: rectR(L, P, [.03, .03, P * .85, .03]), bassin: { marge: .12 }, tablier: 'vague', appuis: [[-L / 2 + .15, -P * .1, Math.PI / 2], [-L * .15, -P / 2 + .14, 0]], poignees: [[-L * .15, P / 2 - .07, 0]], jets: 8, robinets: [L * .15, -P / 2 + .05, 0, 4] });
  },
  /* WA6017 : quart de cercle, assise et appuie-tête moulés dans l'angle */
  'wa6017'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: quart(L, P), bassin: { marge: .13 }, tablier: 'vague', appuis: [[-L / 2 + .22, -P / 2 + .22, Math.PI / 4, false]], jets: 4, robinets: [L * .2, -P / 2 + .05, 0, 3] });
  },
  /* WA1046 : grand rectangle, tablier mouluré, deux appuie-têtes noirs */
  'wa1046'(p) {
    const [L, P] = p.dim;
    return encastree(p, { bassin: { n: 5, a: L / 2 - .12, b: P / 2 - .13 }, tablier: 'cadres', cadres: [[-L / 2 + .08, -.06], [.06, L / 2 - .08]], appuis: [[L * .12, P / 2 - .14, Math.PI], [L * .32, P / 2 - .14, Math.PI]], jets: 10, robinets: [-L * .25, -P / 2 + .06, 0, 4] });
  },
  /* WA1030M : tablier mouluré, deux appuie-têtes noirs, poignées chromées */
  'wa1030m'(p) {
    const [L, P] = p.dim;
    return encastree(p, { bassin: { n: 4, a: L / 2 - .14, b: P / 2 - .12 }, tablier: 'cadres', cadres: [[-L / 2 + .08, -.08], [-.04, L / 2 - .08]], appuis: [[-L / 2 + .17, 0, Math.PI / 2], [L / 2 - .17, 0, -Math.PI / 2]], poignees: [[-L * .2, P / 2 - .06, 0], [L * .2, P / 2 - .06, 0]], jets: 8, robinets: [-L * .2, -P / 2 + .05, 0, 4] });
  },
  /* WA1040 : asymétrique à vague moulurée, appuie-tête noir et poignée chromée */
  'wa1040'(p) {
    const [L, P] = p.dim;
    return encastree(p, { plan: rectR(L, P, [.03, .03, P * .5, .03]), bassin: { marge: .11 }, tablier: 'vague', appuis: [[-L / 2 + .17, 0, Math.PI / 2]], poignees: [[0, P / 2 - .06, 0]], jets: 8, robinets: [L * .1, -P / 2 + .05, 0, 4] });
  }
};
