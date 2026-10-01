/* =================================================================
   RealRoom — modèles fidèles : outils de sculpture

   Les meubles de la boutique sont refaits un par un d'après leurs
   photos (moteur/modeles/*.js). Ces outils donnent des volumes de
   tapissier plutôt que des boîtes : coussins bombés, boudins, tambours,
   panneaux aux arêtes douces, coques ; et des matières avec leur grain
   (velours, bouclette, cuir, chenille…) et leurs motifs.

   Les matières à grain ou à motif portent userData.uvMonde (taille d'un
   motif en mètres) : cuire() projette leurs UV à l'échelle réelle.

   Conventions (comme moteur/meubles.js) : mètres, origine au sol,
   centrée, face avant vers +z ; appliques : origine au mur ;
   suspensions : origine au plafond.
   ================================================================= */
import * as THREE from 'three';
import { M, mesh, place, groupe, alea, LUMINEUX, cyl, sphere, instances } from '../meubles.js';

export const TAU = Math.PI * 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export { THREE, M, mesh, place, groupe, alea, LUMINEUX };

/* ---------------------------------------------------------------
   Normales lissées : les sommets confondus (coutures d'une boîte
   subdivisée, pôles d'un boudin) partagent la même normale
   --------------------------------------------------------------- */
export function lisser(geo) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, seaux = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 4e3) + '|' + Math.round(p.getY(i) * 4e3) + '|' + Math.round(p.getZ(i) * 4e3);
    let s = seaux.get(k);
    if (!s) seaux.set(k, s = { x: 0, y: 0, z: 0, i: [] });
    s.x += n.getX(i); s.y += n.getY(i); s.z += n.getZ(i); s.i.push(i);
  }
  for (const s of seaux.values()) {
    if (s.i.length < 2) continue;
    const l = Math.hypot(s.x, s.y, s.z) || 1;
    for (const i of s.i) n.setXYZ(i, s.x / l, s.y / l, s.z / l);
  }
  n.needsUpdate = true;
  return geo;
}

/* ---------------------------------------------------------------
   Coussin : boîte subdivisée aux arêtes arrondies (rayon r) dont les
   faces se bombent au centre (b = [x, y, z], en mètres). C'est la
   brique de base des assises, dossiers, accoudoirs et matelas.
   --------------------------------------------------------------- */
export function geoCoussin(w, h, d, r, b = [0, 0, 0], seg = 10) {
  r = Math.max(.001, Math.min(r, w / 2 - .0005, h / 2 - .0005, d / 2 - .0005));
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg), p = g.attributes.position;
  const hx = w / 2, hy = h / 2, hz = d / 2;
  // plus de sommets près des arêtes : l'arrondi reste lisse
  const f = v => Math.sign(v) * (1 - Math.pow(1 - Math.min(1, Math.abs(v)), 1.4));
  for (let i = 0; i < p.count; i++) {
    const u = f(p.getX(i) * 2), v = f(p.getY(i) * 2), t = f(p.getZ(i) * 2);
    let x = u * hx, y = v * hy, z = t * hz;
    const ix = clamp(x, -hx + r, hx - r), iy = clamp(y, -hy + r, hy - r), iz = clamp(z, -hz + r, hz - r);
    const dx = x - ix, dy = y - iy, dz = z - iz, L = Math.hypot(dx, dy, dz);
    if (L > 1e-7) { x = ix + dx / L * r; y = iy + dy / L * r; z = iz + dz / L * r; }
    const cu = 1 - u * u, cv = 1 - v * v, ct = 1 - t * t;
    x += Math.sign(u) * b[0] * cv * ct;
    y += Math.sign(v) * b[1] * cu * ct;
    z += Math.sign(t) * b[2] * cu * cv;
    p.setXYZ(i, x, y, z);
  }
  return lisser(g);
}
// (x, y, z) = centre de la face inférieure ; o : r, b (bombé), seg, rx, ry, rz
export function coussin(parent, w, h, d, m, x = 0, y = 0, z = 0, o = {}) {
  const r = o.r ?? Math.min(w, h, d) * .32;
  const b = o.b ?? [Math.min(.015, w * .03), Math.min(.025, h * .12), Math.min(.015, d * .03)];
  const me = mesh(geoCoussin(w, h, d, r, b, o.seg || 10), m);
  if (o.ordre) me.rotation.order = o.ordre;
  return place(parent, me, x, y + h / 2, z, o.ry || 0, o.rx || 0, o.rz || 0);
}

/* ---------------------------------------------------------------
   Boudin : tube le long d'une courbe, section ronde ou ovale, bouts
   arrondis. r : rayon (nombre ou fonction de t ∈ [0, 1]).
   o.kv : aplatissement de la section (rayon « vertical » = r × kv),
   o.haut : direction de référence de la section (défaut : verticale
   pour une courbe à plat, o.plan), o.ferme : courbe fermée,
   o.bouts : false pour des bouts ouverts, o.kb : longueur des bouts.
   --------------------------------------------------------------- */
export function geoBoudin(pts, r, o = {}) {
  const ferme = !!o.ferme;
  const courbe = pts.isCurve ? pts : new THREE.CatmullRomCurve3(pts.map(q => V3(q[0], q[1], q[2])), ferme, o.tension != null ? 'catmullrom' : 'centripetal', o.tension ?? .5);
  const nS = o.seg || 64, nR = o.radial || 18, kv = o.kv || 1, kb = o.kb ?? 1;
  const rf = typeof r === 'function' ? r : () => r;
  const ref = o.haut ? V3(...o.haut).normalize() : o.plan ? V3(0, 1, 0) : null;
  const frames = ref ? null : courbe.computeFrenetFrames(nS, ferme);
  const anneaux = [];
  for (let i = 0; i <= (ferme ? nS - 1 : nS); i++) {
    const t = i / nS, c = courbe.getPointAt(t), T = courbe.getTangentAt(t).normalize();
    let S, U;
    if (ref) { S = V3().crossVectors(T, ref); if (S.lengthSq() < 1e-8) S = V3(1, 0, 0); S.normalize(); U = V3().crossVectors(S, T).normalize(); }
    else { S = frames.normals[i].clone(); U = frames.binormals[i].clone(); }
    // sens de rotation constant : normales vers l'extérieur
    if (V3().crossVectors(S, U).dot(T) > 0) U.negate();
    anneaux.push({ c, T, S, U, r: rf(t) });
  }
  const liste = [];
  const nb = o.bouts === false || ferme ? 0 : (o.nb || 7);
  if (nb) {
    const a = anneaux[0];
    for (let j = nb; j >= 1; j--) { const ph = j / nb * Math.PI / 2; liste.push({ c: a.c.clone().addScaledVector(a.T, -a.r * kb * Math.sin(ph)), S: a.S, U: a.U, r: a.r * Math.cos(ph) + 1e-5 }); }
  }
  liste.push(...anneaux);
  if (nb) {
    const a = anneaux[anneaux.length - 1];
    for (let j = 1; j <= nb; j++) { const ph = j / nb * Math.PI / 2; liste.push({ c: a.c.clone().addScaledVector(a.T, a.r * kb * Math.sin(ph)), S: a.S, U: a.U, r: a.r * Math.cos(ph) + 1e-5 }); }
  }
  const pos = new Float32Array(liste.length * nR * 3);
  liste.forEach((a, i) => {
    for (let k = 0; k < nR; k++) {
      const an = k / nR * TAU, cs = Math.cos(an) * a.r, sn = Math.sin(an) * a.r * kv, q = (i * nR + k) * 3;
      pos[q] = a.c.x + a.S.x * cs + a.U.x * sn; pos[q + 1] = a.c.y + a.S.y * cs + a.U.y * sn; pos[q + 2] = a.c.z + a.S.z * cs + a.U.z * sn;
    }
  });
  const idx = [], nA = liste.length, fin = ferme ? nA : nA - 1;
  for (let i = 0; i < fin; i++) {
    const i2 = (i + 1) % nA;
    for (let k = 0; k < nR; k++) {
      const a = i * nR + k, b = i * nR + (k + 1) % nR, c = i2 * nR + k, d = i2 * nR + (k + 1) % nR;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return lisser(g);
}
export function boudin(parent, pts, r, m, o = {}) {
  const me = mesh(geoBoudin(pts, r, o), m);
  parent.add(me);
  return me;
}

/* ---------------------------------------------------------------
   Tambour : cylindre rembourré (tour). Flanc bombé (b), arêtes
   arrondies (ah en haut, ab en bas), rayons rb (bas) et rt (haut),
   dessus légèrement bombé (dome). phi0/phiL : portion de tour.
   --------------------------------------------------------------- */
export function geoTambour(r, h, o = {}) {
  const rb = o.rb ?? r, rt = o.rt ?? r, b = o.b ?? 0, ah = Math.min(o.ah ?? r * .2, h * .5, rt), ab = Math.min(o.ab ?? .015, h * .3, rb), dome = o.dome ?? 0;
  const pts = [[0, 0]];
  for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + i / 4 * Math.PI / 2; pts.push([rb - ab + Math.cos(a) * ab, ab + Math.sin(a) * ab]); }
  const n = 14;
  for (let i = 1; i < n; i++) { const t = i / n; pts.push([lerp(rb, rt, t) + b * Math.sin(Math.PI * t), ab + t * (h - ah - ab)]); }
  for (let i = 0; i <= 7; i++) { const a = i / 7 * Math.PI / 2; pts.push([rt - ah + Math.cos(a) * ah, h - ah + Math.sin(a) * ah]); }
  for (let i = 1; i <= 5; i++) { const t = i / 5; pts.push([(rt - ah) * (1 - t), h + dome * Math.sin(t * Math.PI / 2)]); }
  return new THREE.LatheGeometry(pts.map(q => new THREE.Vector2(Math.max(0, q[0]), q[1])), o.seg || 48, o.phi0 || 0, o.phiL || TAU);
}
export function tambour(parent, r, h, m, x = 0, y = 0, z = 0, o = {}) {
  return place(parent, mesh(geoTambour(r, h, o), m), x, y, z, o.ry || 0);
}
// galette ovale : tambour étiré (demi-axes a en x, b en z), pour les assises des fauteuils ronds
export function galette(parent, a, b, h, m, x = 0, y = 0, z = 0, o = {}) {
  const r = Math.max(a, b), me = tambour(parent, r, h, m, x, y, z, o);
  me.scale.set(a / r, 1, b / r);
  return me;
}
// pièce tournée d'après un profil [[rayon, y], …] (vasques, pieds, globes)
export function tourne(parent, profil, m, x = 0, y = 0, z = 0, seg = 40, phi0 = 0, phiL = TAU) {
  const g = new THREE.LatheGeometry(profil.map(q => new THREE.Vector2(Math.max(0, q[0]), q[1])), seg, phi0, phiL);
  return place(parent, mesh(g, m), x, y, z);
}

/* ---------------------------------------------------------------
   Panneau : forme plane extrudée aux arêtes arrondies (le contour
   grossit de « a »). plan : 'face' (dans le plan x-y, épaisseur en z),
   'cote' (plan z-y : x de la forme vers l'avant, épaisseur en x),
   'sol' (plan x-z : y de la forme vers l'arrière, épaisseur vers le haut,
   posée sur y).
   --------------------------------------------------------------- */
export function geoPanneau(forme, ep, a = .02, courbes = 28) {
  a = Math.max(0, Math.min(a, ep / 2 - .0005));
  const g = new THREE.ExtrudeGeometry(forme, { depth: Math.max(.0005, ep - 2 * a), bevelEnabled: a > 0, bevelThickness: a, bevelSize: a, bevelSegments: a > 0 ? 5 : 1, curveSegments: courbes });
  g.translate(0, 0, -(ep - 2 * a) / 2);
  return g;
}
export function panneau(parent, forme, ep, m, plan = 'face', x = 0, y = 0, z = 0, o = {}) {
  const me = mesh(geoPanneau(forme, ep, o.a ?? .02, o.courbes), m);
  const g = groupe();
  if (plan === 'cote') me.rotation.y = -Math.PI / 2;
  else if (plan === 'sol') { me.rotation.x = -Math.PI / 2; me.position.y = ep / 2; }
  g.add(me);
  return place(parent, g, x, y, z, o.ry || 0, o.rx || 0, o.rz || 0);
}
// contours usuels
export function rectArrondi(w, h, r, cx = 0, cy = 0) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape(), x0 = cx - w / 2, y0 = cy - h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
// rectangle aux coins vraiment arrondis (arcs de cercle), rayons par coin [bg, bd, hd, hg]
export function rectCoins(w, h, rs, cx = 0, cy = 0) {
  const [r1, r2, r3, r4] = (Array.isArray(rs) ? rs : [rs, rs, rs, rs]).map(r => Math.min(r, w / 2, h / 2));
  const s = new THREE.Shape(), x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  s.moveTo(x0 + r1, y0); s.lineTo(x1 - r2, y0);
  if (r2) s.absarc(x1 - r2, y0 + r2, r2, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r3);
  if (r3) s.absarc(x1 - r3, y1 - r3, r3, 0, Math.PI / 2, false);
  s.lineTo(x0 + r4, y1);
  if (r4) s.absarc(x0 + r4, y1 - r4, r4, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r1);
  if (r1) s.absarc(x0 + r1, y0 + r1, r1, Math.PI, Math.PI * 1.5, false);
  return s;
}
// forme d'après une liste de points [[x, y], …] lissée (spline fermée)
export function formeLisse(pts, n = 64) {
  const c = new THREE.CatmullRomCurve3(pts.map(q => V3(q[0], q[1], 0)), true, 'centripetal');
  const s = new THREE.Shape(c.getSpacedPoints(n).slice(0, n).map(v => new THREE.Vector2(v.x, v.y)));
  return s;
}
// arc de couronne (plan x-y) : rayons ri..re, angles a0..a1
export function formeArc(ri, re, a0, a1) {
  const s = new THREE.Shape();
  s.absarc(0, 0, re, a0, a1, false);
  s.absarc(0, 0, ri, a1, a0, true);
  s.closePath();
  return s;
}
// coque en arc posée au sol : dossier enveloppant vu de dessus (centre de l'arc en (x, z)),
// ouverte vers l'avant ; span : angle couvert (rad), centré sur l'arrière
export function coqueArc(parent, ri, re, span, h, m, x = 0, y = 0, z = 0, a = .015) {
  return panneau(parent, formeArc(ri, re, Math.PI / 2 - span / 2, Math.PI / 2 + span / 2), h, m, 'sol', x, y, z, { a, courbes: 64 });
}

/* ---------------------------------------------------------------
   Déformations : bosses aléatoires (fourrure, bois noueux, pierre)
   --------------------------------------------------------------- */
export function bosseler(geo, amp, freq = 12, graine = 1) {
  const r = alea(graine), p = geo.attributes.position;
  const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU, r() * TAU, r() * TAU];
  const n = geo.attributes.normal || (geo.computeVertexNormals(), geo.attributes.normal);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const v = Math.sin(x * freq + ph[0]) * Math.sin(y * freq * 1.3 + ph[1]) * Math.sin(z * freq * .9 + ph[2])
      + .5 * Math.sin(x * freq * 2.7 + ph[3]) * Math.sin(y * freq * 2.1 + ph[4]) * Math.sin(z * freq * 3.1 + ph[5]);
    p.setXYZ(i, x + n.getX(i) * v * amp, y + n.getY(i) * v * amp, z + n.getZ(i) * v * amp);
  }
  return lisser(geo);
}

/* ---------------------------------------------------------------
   Bruit périodique (textures sans raccord)
   --------------------------------------------------------------- */
function bruitPeriodique(n, per, r) {
  const g = new Float32Array(per * per);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const y = j / n * per, y0 = Math.floor(y), fy = y - y0, sy = fy * fy * (3 - 2 * fy), ya = (y0 % per) * per, yb = ((y0 + 1) % per) * per;
    for (let i = 0; i < n; i++) {
      const x = i / n * per, x0 = Math.floor(x), fx = x - x0, sx = fx * fx * (3 - 2 * fx), xa = x0 % per, xb = (x0 + 1) % per;
      out[j * n + i] = lerp(lerp(g[ya + xa], g[ya + xb], sx), lerp(g[yb + xa], g[yb + xb], sx), sy);
    }
  }
  return out;
}
export function fbm(n, base, octaves, graine = 1, persist = .5) {
  const r = alea(graine), out = new Float32Array(n * n);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const b = bruitPeriodique(n, base << o, r);
    for (let i = 0; i < out.length; i++) out[i] += b[i] * amp;
    tot += amp; amp *= persist;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
// bruit déformé (domain warping) : volutes et marbrures organiques
export function fbmDeforme(n, base, octaves, graine = 1, k = .25, persist = .55) {
  const v = fbm(n, base, octaves, graine, persist), w1 = fbm(n, 3, 3, graine + 7), w2 = fbm(n, 3, 3, graine + 13), out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((Math.round(i + (w1[j * n + i] - .5) * k * n) % n) + n) % n, y = ((Math.round(j + (w2[j * n + i] - .5) * k * n) % n) + n) % n;
    out[j * n + i] = v[y * n + x];
  }
  return out;
}
// cellules (Worley) périodiques : distance au plus proche (f1) et au second (f2), en fraction de la tuile
function cellules(n, nb, graine = 1, jitter = 1) {
  const r = alea(graine), cote = Math.max(2, Math.round(Math.sqrt(nb))), pts = [];
  for (let j = 0; j < cote; j++) for (let i = 0; i < cote; i++) pts.push([(i + .5 + (r() - .5) * jitter) / cote, (j + .5 + (r() - .5) * jitter) / cote]);
  const f1 = new Float32Array(n * n), f2 = new Float32Array(n * n), id = new Int32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i / n, y = j / n, ci = Math.floor(x * cote), cj = Math.floor(y * cote);
    let d1 = 9, d2 = 9, k1 = 0;
    // seulement les cellules voisines (les points restent près de leur case)
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const k = ((cj + dj + cote) % cote) * cote + (ci + di + cote) % cote, p = pts[k];
      let dx = Math.abs(x - p[0]); dx = Math.min(dx, 1 - dx);
      let dy = Math.abs(y - p[1]); dy = Math.min(dy, 1 - dy);
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d;
    }
    f1[j * n + i] = Math.sqrt(d1) * cote; f2[j * n + i] = Math.sqrt(d2) * cote; id[j * n + i] = k1;
  }
  return { f1, f2, id, nb: pts.length, cote };
}

/* ---------------------------------------------------------------
   Cartes de normales d'après une hauteur (grain des matières)
   --------------------------------------------------------------- */
function canvas(n, m = n) { const c = document.createElement('canvas'); c.width = n; c.height = m; return c; }
function carteNormale(n, h, force) {
  const c = canvas(n), x = c.getContext('2d'), img = x.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dx = (h[j * n + (i + 1) % n] - h[j * n + (i - 1 + n) % n]) * force;
    const dy = (h[((j + 1) % n) * n + i] - h[((j - 1 + n) % n) * n + i]) * force;
    const l = Math.hypot(dx, dy, 1), k = (j * n + i) * 4;
    img.data[k] = (-dx / l * .5 + .5) * 255; img.data[k + 1] = (dy / l * .5 + .5) * 255; img.data[k + 2] = (1 / l * .5 + .5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const GRAINS = {}, HAUTEURS = {};
// reliefs de tapissier : en plus du grain, une ombre douce dans les creux (carte de couleur)
export const RELIEFS = new Set(['hexagones', 'croco', 'capiton', 'cannelure', 'lignes', 'matelasse', 'galets', 'carres', 'cotes']);
const OMBRE = { hexagones: .35, croco: .1, capiton: .5, cannelure: .38, lignes: .38, matelasse: .22, galets: .3, carres: .32, cotes: .18 };
// grain : hauteur générée une fois, partagée par toutes les couleurs
export function grain(nom) {
  if (GRAINS[nom]) return GRAINS[nom];
  const n = 256;
  let h, force = 3;
  switch (nom) {
    case 'capiton': {       // capitonnage chesterfield : boutons en losanges, coussinets bombés
      h = new Float32Array(n * n); const k = 4;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = i / n * k, y = j / n * k, q0 = Math.round(y / .5);
        let d = 9;
        for (let q = q0 - 1; q <= q0 + 1; q++) { const ox = (((q % 2) + 2) % 2) * .5, m0 = Math.round(x - ox); for (let m = m0 - 1; m <= m0 + 1; m++) d = Math.min(d, Math.hypot(x - (m + ox), y - q * .5)); }
        h[j * n + i] = Math.sqrt(Math.min(1, d / .5));
      }
      force = 9; break;
    }
    case 'croco': {         // écailles de crocodile : rangées de tuiles rectangulaires bombées
      h = new Float32Array(n * n); const r = alea(141), rangs = 10, bords = [];
      for (let q = 0; q < rangs; q++) { const b = [0]; while (b[b.length - 1] < 1) b.push(b[b.length - 1] + .06 + r() * .1); b[b.length - 1] = 1; bords.push(b); }
      for (let j = 0; j < n; j++) {
        const y = j / n * rangs, q = Math.floor(y), fy = y - q, b = bords[q];
        for (let i = 0; i < n; i++) {
          const x = i / n; let k = 0; while (b[k + 1] < x) k++;
          const dx = Math.min(x - b[k], b[k + 1] - x) / (b[k + 1] - b[k]), dy = Math.min(fy, 1 - fy);
          h[j * n + i] = Math.sqrt(Math.min(1, Math.min(dx * 3, dy * 3)));
        }
      }
      force = 6; break;
    }
    case 'hexagones': {     // matelassage en nid d'abeille
      h = new Float32Array(n * n); const k = 7, m = 8;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = i / n * k, y = j / n * m, q0 = Math.round(y);
        let d = 9;
        for (let q = q0 - 1; q <= q0 + 1; q++) { const ox = (((q % 2) + 2) % 2) * .5, c0 = Math.round(x - ox); for (let c = c0 - 1; c <= c0 + 1; c++) d = Math.min(d, Math.hypot(x - (c + ox), (y - q) * .866)); }
        h[j * n + i] = Math.sqrt(Math.max(0, 1 - Math.pow(d / .58, 2)));
      }
      force = 7; break;
    }
    case 'cannelure': { h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = Math.pow(Math.abs(Math.sin(i / n * Math.PI * 8)), .45); force = 7; break; }
    case 'lignes': { h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = Math.pow(Math.abs(Math.sin(j / n * Math.PI * 8)), .45); force = 7; break; }
    case 'carres': { h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = Math.pow(Math.abs(Math.sin(i / n * Math.PI * 5) * Math.sin(j / n * Math.PI * 5)), .35); force = 7; break; }
    case 'boucle': {        // petites boucles serrées
      h = new Float32Array(n * n);
      const r = alea(11), rb = 6.5;
      for (let k = 0; k < 2600; k++) {
        const cx = r() * n, cy = r() * n, a = .6 + r() * .4;
        for (let dy = -rb; dy <= rb; dy++) for (let dx = -rb; dx <= rb; dx++) {
          const d2 = (dx * dx + dy * dy) / (rb * rb);
          if (d2 >= 1) continue;
          const i = ((Math.round(cx + dx) % n) + n) % n, j = ((Math.round(cy + dy) % n) + n) % n;
          h[j * n + i] = Math.max(h[j * n + i], a * Math.sqrt(1 - d2));
        }
      }
      force = 5; break;
    }
    case 'velours': h = fbm(n, 4, 4, 21); force = 4; break;
    case 'chenille': { const b = fbm(n, 8, 3, 23); h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = .5 * Math.abs(Math.sin(j / n * Math.PI * 48)) + b[j * n + i] * .8; force = 4; break; }
    case 'cotes': { h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = Math.pow(Math.abs(Math.sin(i / n * Math.PI * 24)), .6); force = 4; break; }
    case 'cuir': { const c = cellules(n, 900, 31); const b = fbm(n, 16, 2, 32); h = new Float32Array(n * n); for (let i = 0; i < h.length; i++) h[i] = Math.min(1, c.f2[i] - c.f1[i]) * .6 + b[i] * .4; force = 2.2; break; }
    case 'tissage': { h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = Math.sin(i / n * TAU * 64), b = Math.sin(j / n * TAU * 64); h[j * n + i] = (a * (b > 0 ? 1 : -1) + b * (a > 0 ? -1 : 1)) * .25 + .5; } force = 1.5; break; }
    case 'galets': {       // capitonnage en galets (dossier d'Abbraccio) : petits dômes serrés
      const c = cellules(n, 49, 41, .7); h = new Float32Array(n * n);
      for (let i = 0; i < h.length; i++) { const q = c.f1[i] / (c.f1[i] + c.f2[i] + 1e-6); h[i] = Math.sqrt(Math.max(0, 1 - 4 * q * q)); }
      force = 7; break;
    }
    case 'fourrure': { const b = fbm(n, 6, 5, 51, .6); h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = b[j * n + i] + .3 * Math.sin((i + b[j * n + i] * 60) / n * TAU * 30); force = 6; break; }
    case 'matelasse': { h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const u = (i + j) / n * 4, v = (i - j + n) / n * 4; h[j * n + i] = Math.min(Math.sin((u % 1) * Math.PI), Math.sin((v % 1) * Math.PI)); } force = 5; break; }
    case 'bois': { const b = fbm(n, 4, 3, 61); h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = Math.sin((i / n * 18 + b[j * n + i] * 6) * Math.PI) * .2; force = 2; break; }
    case 'pierre': h = fbm(n, 8, 4, 71); force = 2; break;
    default: h = fbm(n, 6, 3, 1); force = 1;
  }
  HAUTEURS[nom] = h;
  GRAINS[nom] = carteNormale(n, h, force);
  return GRAINS[nom];
}
// ombre des reliefs : facteur de luminosité (creux plus sombres), 0..1 par pixel de la tuile
function facteurOmbre(nom) {
  grain(nom);
  const h = HAUTEURS[nom], f = new Float32Array(h.length);
  let mn = 1e9, mx = -1e9;
  for (const v of h) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  const k = OMBRE[nom] ?? .4;
  for (let i = 0; i < h.length; i++) f[i] = 1 - k + k * Math.pow((h[i] - mn) / (mx - mn || 1), .6);
  return f;
}
// carte de couleur : couleur unie ou motif, assombrie dans les creux du relief
function texteOmbree(nom, source) {
  const n = 256, f = facteurOmbre(nom), c = canvas(n), x = c.getContext('2d');
  if (source) x.drawImage(source, 0, 0, n, n); else { x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, n, n); }
  const img = x.getImageData(0, 0, n, n);
  for (let i = 0; i < n * n; i++) for (let k = 0; k < 3; k++) img.data[i * 4 + k] *= f[i];
  x.putImageData(img, 0, 0);
  return textureCouleur(c);
}

/* ---------------------------------------------------------------
   Motifs (couleurs) : imprimés, jacquards, marbrures, veinages
   --------------------------------------------------------------- */
const MOTIFS = {};
// couleur CSS → [r, g, b] 0..255 en sRGB (les pixels d'un canvas sont en sRGB, pas en linéaire)
const hexRgb = h => { const c = new THREE.Color(h), o = {}; c.getRGB(o, THREE.SRGBColorSpace); return [o.r * 255, o.g * 255, o.b * 255]; };
// dessine fn sur les 9 copies décalées de la tuile : motif raccordable
function partout(x, n, fn) { for (let dx = -n; dx <= n; dx += n) for (let dy = -n; dy <= n; dy += n) { x.save(); x.translate(dx, dy); fn(); x.restore(); } }
// tracés lissés passant par les milieux des segments (contour fermé, ou trait ouvert)
function courbeFermee(x, pts) {
  const k = pts.length, mi = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const d = mi(pts[k - 1], pts[0]);
  x.beginPath(); x.moveTo(d[0], d[1]);
  for (let i = 0; i < k; i++) { const p = pts[i], m = mi(p, pts[(i + 1) % k]); x.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  x.closePath();
}
function courbeOuverte(x, pts) {
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  const f = pts[pts.length - 1]; x.lineTo(f[0], f[1]);
}
function textureCouleur(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
// palette par seuils sur un bruit : [[seuil, couleur], …] du plus bas au plus haut
function seuils(n, v, palette, doux = .03) {
  const c = canvas(n), x = c.getContext('2d'), img = x.createImageData(n, n), cols = palette.map(p => hexRgb(p[1]));
  for (let i = 0; i < n * n; i++) {
    let k = 0;
    while (k < palette.length - 1 && v[i] > palette[k + 1][0]) k++;
    let rgb = cols[k];
    if (k < palette.length - 1 && doux) { const t = clamp((v[i] - palette[k + 1][0] + doux) / doux, 0, 1); if (t > 0) rgb = rgb.map((q, j) => lerp(q, cols[k + 1][j], t * .5)); }
    img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}
// seuils exprimés en proportions de surface (quantiles) plutôt qu'en valeurs de bruit
function quantiles(v, palette) {
  const tri = Float32Array.from(v).sort();
  return palette.map(([q, c]) => [q <= 0 ? -1 : tri[Math.min(tri.length - 1, Math.floor(q * tri.length))], c]);
}
export function motif(nom, couleurs = []) {
  const cle = nom + '|' + couleurs.join(',');
  if (MOTIFS[cle]) return MOTIFS[cle];
  let c;
  const n = 512;
  switch (nom) {
    case 'mineral': {      // velours marbré : nuages clairs mouchetés sur fond sombre
      const v = fbmDeforme(n, 5, 6, 81, .35, .62), d = fbm(n, 32, 2, 82);
      for (let i = 0; i < v.length; i++) v[i] += (d[i] - .5) * .06;
      const [fond = '#1D2030', mi = '#5D6476', clair = '#C2AE88', vif = '#E3D3AE'] = couleurs;
      c = seuils(n, v, quantiles(v, [[0, fond], [.54, mi], [.67, clair], [.87, vif]]), .012);
      break;
    }
    case 'albatre': {      // albâtre : blanc chaud, veines douces
      const v = fbm(n, 2, 6, 91, .6), w = fbm(n, 3, 4, 92);
      const [base = '#F4E6D2', veine = '#D9B48E'] = couleurs, a = hexRgb(base), b = hexRgb(veine);
      c = canvas(n); const x = c.getContext('2d'), img = x.createImageData(n, n);
      for (let i = 0; i < n * n; i++) {
        const t = clamp(1 - Math.abs(v[i] - .5) * 9, 0, 1) * .8 + w[i] * .25;
        for (let k = 0; k < 3; k++) img.data[i * 4 + k] = lerp(a[k], b[k], clamp(t, 0, 1));
        img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      break;
    }
    case 'bois': {         // placage : veines serrées le long de v
      const b = fbm(n, 4, 4, 101), [clair = '#7A5236', fonce = '#4A2E1C'] = couleurs, a = hexRgb(clair), d = hexRgb(fonce);
      c = canvas(n); const x = c.getContext('2d'), img = x.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const k = j * n + i, t = .5 + .5 * Math.sin((i / n * 22 + b[k] * 7) * Math.PI);
        const f = clamp(t * t * .9 + b[k] * .3, 0, 1);
        for (let q = 0; q < 3; q++) img.data[k * 4 + q] = lerp(a[q], d[q], f);
        img.data[k * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      break;
    }
    case 'chine': {        // tissu chiné : fond + mouchetures de couleurs
      const [fond = '#3B4C8E', ...autres] = couleurs, r = alea(151);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n);
      const cols = autres.length ? autres : ['#6A7BC0', '#22305E'];
      for (let i = 0; i < 14000; i++) { x.fillStyle = cols[i % cols.length]; x.globalAlpha = .35 + r() * .5; x.fillRect(r() * n, r() * n, 1 + r() * 3, 1 + r() * 1.5); }
      x.globalAlpha = 1;
      break;
    }
    case 'python': {       // peau de python : écailles cernées, taches plus sombres
      const [bord = '#132228', ...tons] = couleurs, cl = tons.length ? tons : ['#2E6B6E', '#345C7A', '#3F7A5E'];
      const cel = cellules(n, 900, 161, .55), tache = fbm(n, 4, 3, 162), r = alea(163), teintes = [];
      for (let k = 0; k < cel.nb; k++) teintes.push(hexRgb(cl[(r() * cl.length) | 0]).map(v => v * (.85 + r() * .3)));
      const b = hexRgb(bord);
      c = canvas(n); const x = c.getContext('2d'), img = x.createImageData(n, n);
      for (let i = 0; i < n * n; i++) {
        const e = clamp((cel.f2[i] - cel.f1[i]) * 6, 0, 1), t = teintes[cel.id[i]], sombre = tache[i] > .58 ? .55 : 1;
        for (let k = 0; k < 3; k++) img.data[i * 4 + k] = lerp(b[k], t[k] * sombre, e);
        img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      break;
    }
    case 'rayures': {      // rayures verticales régulières (couleurs alternées)
      const cl = couleurs.length > 1 ? couleurs : ['#1E1E22', '#ECE6D8'], k = 12;
      c = canvas(n); const x = c.getContext('2d');
      for (let i = 0; i < k; i++) { x.fillStyle = cl[i % cl.length]; x.fillRect(i * n / k, 0, n / k + 1, n); }
      break;
    }
    case 'floral': {       // grandes fleurs et feuillages sur fond uni
      const [fond = '#A9ABA6', f1 = '#2A4FA8', f2 = '#7FA0DE', feuille = '#B9C93A', coeur = '#F2E6B0'] = couleurs, r = alea(171);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n);
      const partout = (fn) => { for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n], [n, n], [-n, -n], [n, -n], [-n, n]]) { x.save(); x.translate(dx, dy); fn(); x.restore(); } };
      for (let i = 0; i < 26; i++) {
        const px = r() * n, py = r() * n, a = r() * TAU, l = 18 + r() * 30;
        partout(() => { x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = feuille; x.globalAlpha = .9; x.beginPath(); x.ellipse(0, 0, l, l * .32, 0, 0, TAU); x.fill(); x.restore(); });
      }
      for (let i = 0; i < 9; i++) {
        const px = r() * n, py = r() * n, rr = 30 + r() * 34, np = 8 + (r() * 6 | 0), a0 = r() * TAU;
        partout(() => {
          x.save(); x.translate(px, py);
          for (let k = 0; k < np; k++) { x.save(); x.rotate(a0 + k / np * TAU); x.fillStyle = k % 2 ? f1 : f2; x.globalAlpha = .95; x.beginPath(); x.ellipse(rr * .55, 0, rr * .5, rr * .2, 0, 0, TAU); x.fill(); x.restore(); }
          x.fillStyle = coeur; x.beginPath(); x.arc(0, 0, rr * .18, 0, TAU); x.fill(); x.restore();
        });
      }
      x.globalAlpha = 1;
      break;
    }
    case 'zebre': {        // rayures zébrées ondulantes : fond, rayure sombre, rayure claire
      const [fond = '#EFE4C8', sombre = '#18181B', clair = '#C99E2E'] = couleurs, w = fbm(n, 3, 3, 181), a = hexRgb(fond), b = hexRgb(sombre), cc = hexRgb(clair);
      c = canvas(n); const x = c.getContext('2d'), img = x.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const k = j * n + i, v = Math.sin(TAU * (i / n * 7 + (w[k] - .5) * 1.6));
        const col = v > .25 ? b : v < -.35 ? cc : a;
        img.data[k * 4] = col[0]; img.data[k * 4 + 1] = col[1]; img.data[k * 4 + 2] = col[2]; img.data[k * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      break;
    }
    case 'geometrique': {  // cercles concentriques et losanges façon op-art
      const [fond = '#1E2A55', ...anneaux] = couleurs, cl = anneaux.length ? anneaux : ['#E07AA0', '#3FA7B5', '#F2EFE9', '#1E2A55'];
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n);
      const k = 3, t = n / k;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
        const cx = (i + .5) * t, cy = (j + .5) * t;
        x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); x.fillStyle = cl[1 % cl.length]; x.fillRect(-t * .36, -t * .36, t * .72, t * .72); x.restore();
        for (let q = 0; q < 4; q++) { x.fillStyle = cl[q % cl.length]; x.beginPath(); x.arc(cx, cy, t * (.34 - q * .08), 0, TAU); x.fill(); }
      }
      break;
    }
    case 'pied-de-poule': { // pied-de-poule : damier à dents en escalier (16 motifs par tuile)
      const [clair = '#F1EEE7', fonce = '#1A1A1C'] = couleurs, a = hexRgb(clair), b = hexRgb(fonce), px = n / 16 / 8;
      c = canvas(n); const x = c.getContext('2d'), img = x.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const X = Math.floor(i / px) % 8, Y = Math.floor(j / px) % 8, bx = X >> 2, by = Y >> 2;
        const sombre = bx === by ? true : bx === 1 && by === 0 ? (X - 4) + Y >= 4 : X - (Y - 4) >= 1;
        const col = sombre ? b : a, k = (j * n + i) * 4;
        img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      break;
    }
    case 'pois': {         // pois réguliers en quinconce : fond, pois (k pois par tuile)
      const [fond = '#4E7A4A', point = '#EEF0E6'] = couleurs, k = 8, t = n / k;
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n); x.fillStyle = point;
      for (let j = 0; j <= k; j++) for (let i = 0; i <= k; i++) { x.beginPath(); x.arc((i + (j % 2) * .5) * t, j * t, t * .26, 0, TAU); x.fill(); }
      break;
    }
    case 'bambou': {       // tiges et feuilles de bambou noires sur fond clair
      const [fond = '#F1EFEA', encre = '#1C1C1E'] = couleurs, r = alea(191);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n); x.fillStyle = encre; x.strokeStyle = encre;
      for (let i = 0; i < 5; i++) {
        const px = (i + .2 + r() * .5) * n / 5, w = 6 + r() * 6;
        x.fillRect(px, 0, w, n);
        for (let y = r() * 60; y < n; y += 70 + r() * 40) { x.fillStyle = fond; x.fillRect(px - 1, y, w + 2, 3); x.fillStyle = encre; x.fillRect(px - 3, y + 3, w + 6, 2); }
      }
      for (let i = 0; i < 70; i++) {
        const px = r() * n, py = r() * n, a = (r() - .5) * 1.6 + (r() < .5 ? 0 : Math.PI), l = 30 + r() * 40;
        for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) { x.save(); x.translate(px + dx, py + dy); x.rotate(a); x.beginPath(); x.ellipse(l / 2, 0, l / 2, l * .12, 0, 0, TAU); x.fill(); x.restore(); }
      }
      break;
    }
    case 'pois-libres': {  // pois semés de tailles variées, cerclés : fond, pois, cerne
      const [fond = '#D9532A', point = '#18181A', cerne = '#E8C33A'] = couleurs, r = alea(201);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n);
      for (let i = 0; i < 26; i++) {
        const px = r() * n, py = r() * n, rr = 14 + r() * 30;
        for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) {
          x.fillStyle = cerne; x.beginPath(); x.ellipse(px + dx, py + dy, rr + 4, (rr + 4) * .85, 0, 0, TAU); x.fill();
          x.fillStyle = point; x.beginPath(); x.ellipse(px + dx, py + dy, rr, rr * .85, 0, 0, TAU); x.fill();
        }
      }
      break;
    }
    case 'vache': {        // peau de vache : grandes taches brunes sur blanc
      const v = fbmDeforme(n, 3, 4, 211, .3, .55), [blanc = '#F2EFE8', brun = '#5A3A24', roux = '#8A5A34'] = couleurs;
      c = seuils(n, v, quantiles(v, [[0, blanc], [.48, roux], [.54, brun]]), .01);
      break;
    }
    case 'papillons': {    // petits papillons semés sur fond clair
      const [fond = '#D9DFE2', a1 = '#2A3E6A', a2 = '#8A5A3A'] = couleurs, r = alea(231);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n);
      for (let i = 0; i < 40; i++) {
        const px = r() * n, py = r() * n, t = 8 + r() * 10, a = r() * TAU;
        x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = r() < .6 ? a1 : a2;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { x.beginPath(); x.ellipse(sx * t * .55, sy * t * .4, t * (sy < 0 ? .6 : .42), t * .32, sx * sy * .5, 0, TAU); x.fill(); });
        x.restore();
      }
      break;
    }
    case 'feuillage': {    // feuilles tropicales vertes et jaunes sur fond sombre
      const [fond = '#1C2A1E', ...vs] = couleurs, cl = vs.length ? vs : ['#3E7A3A', '#7FAE3A', '#C9C24A', '#2E5A2E'], r = alea(241);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n);
      for (let i = 0; i < 60; i++) {
        const px = r() * n, py = r() * n, a = r() * TAU, l = 30 + r() * 50;
        for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) { x.save(); x.translate(px + dx, py + dy); x.rotate(a); x.fillStyle = cl[(r() * cl.length) | 0]; x.beginPath(); x.ellipse(l / 2, 0, l / 2, l * .22, 0, 0, TAU); x.fill(); x.restore(); }
      }
      break;
    }
    case 'journal': {      // coupures de journal (blocs de lignes) et papillons bleus sur fond blanc
      const [fond = '#F1EFEA', encre = '#2A2A2C', bleu = '#4A7AB0'] = couleurs, r = alea(251);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n);
      for (let i = 0; i < 16; i++) {
        const px = r() * n, py = r() * n, w = 40 + r() * 60, h = 30 + r() * 60, a = (r() - .5) * .8;
        x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = '#FAF9F6'; x.fillRect(-w / 2, -h / 2, w, h); x.fillStyle = encre;
        for (let y = -h / 2 + 4; y < h / 2 - 3; y += 4) x.fillRect(-w / 2 + 3, y, (w - 6) * (.6 + r() * .4), 1.5);
        x.restore();
      }
      x.fillStyle = bleu;
      for (let i = 0; i < 10; i++) { const px = r() * n, py = r() * n, t = 7 + r() * 6; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { x.beginPath(); x.ellipse(px + sx * t * .5, py + sy * t * .35, t * .5, t * .3, sx * sy * .5, 0, TAU); x.fill(); }); }
      break;
    }
    case 'chevrons': {     // chevrons (zigzag) : couleurs alternées
      const cl = couleurs.length > 1 ? couleurs : ['#2A4EA0', '#F1EEE7'], k = 10;
      c = canvas(n); const x = c.getContext('2d'), img = x.createImageData(n, n);
      const rgb = cl.map(hexRgb);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const u = i / n * k, v = j / n * k, z = Math.abs((u % 2) - 1), band = Math.floor(v * 2 + z * 2) % rgb.length, col = rgb[(band + rgb.length) % rgb.length], q = (j * n + i) * 4;
        img.data[q] = col[0]; img.data[q + 1] = col[1]; img.data[q + 2] = col[2]; img.data[q + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      break;
    }
    case 'degrade': {      // dégradé arc-en-ciel le long de u (une seule tuile, à étirer avec l'échelle)
      const cl = (couleurs.length > 1 ? couleurs : ['#2A6FD9', '#3AB0E0', '#F2C230', '#E8642A', '#D94A8A']).map(hexRgb);
      c = canvas(n); const x = c.getContext('2d'), img = x.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const t = (i / n) * (cl.length - 1), k = Math.min(cl.length - 2, Math.floor(t)), f = t - k, q = (j * n + i) * 4;
        for (let ch = 0; ch < 3; ch++) img.data[q + ch] = lerp(cl[k][ch], cl[k + 1][ch], f);
        img.data[q + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      break;
    }
    case 'traits': {       // coups de pinceau noirs et gris sur fond clair (Bubble Art)
      const [fond = '#ECE9E2', noir = '#1E1E22', gris = '#7C7C80'] = couleurs, r = alea(111);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n); x.lineCap = 'round';
      for (let i = 0, nb = couleurs.length > 3 ? 130 : 46; i < nb; i++) {
        const px = r() * n, py = r() * n, l = 50 + r() * 90, a = (r() - .5) * .8 + (r() < .2 ? Math.PI / 2 : 0), w = 16 + r() * 22;
        const tons = couleurs.length > 3 ? couleurs.slice(1) : [noir, noir, gris];
        x.strokeStyle = couleurs.length > 3 ? tons[(r() * tons.length) | 0] : (r() < .55 ? noir : gris); x.lineWidth = w; x.globalAlpha = .75 + r() * .25;
        for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) {
          x.beginPath(); x.moveTo(px + dx, py + dy);
          x.quadraticCurveTo(px + dx + Math.cos(a) * l * .5 + (r() - .5) * 20, py + dy + Math.sin(a) * l * .5 + (r() - .5) * 20, px + dx + Math.cos(a) * l, py + dy + Math.sin(a) * l);
          x.stroke();
        }
      }
      x.globalAlpha = 1;
      break;
    }
    case 'graffiti': {     // tags noirs à la bombe, nuages de peinture, coulures, lettres bulles, sur toile blanche
      const [fond = '#EEEDE8', encre = '#18181A', ...nuages] = couleurs, cl = nuages.length ? nuages : ['#E8924A', '#F2B27A', '#A8A8A8'], r = alea(261);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n);
      // nuages de bombe (dégradés radiaux transparents sur les bords)
      for (let i = 0; i < 9; i++) {
        const px = r() * n, py = r() * n, rr = 30 + r() * 60, [cr, cg, cb] = hexRgb(cl[i % cl.length]).map(Math.round), a = .25 + r() * .3;
        partout(x, n, () => {
          const gr = x.createRadialGradient(px, py, 0, px, py, rr);
          gr.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); gr.addColorStop(.6, `rgba(${cr},${cg},${cb},${a * .55})`); gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          x.fillStyle = gr; x.fillRect(px - rr, py - rr, 2 * rr, 2 * rr);
        });
      }
      x.lineCap = 'round'; x.lineJoin = 'round';
      // lettres bulles : contours noirs, remplissage blanc ou orangé
      for (let i = 0; i < 6; i++) {
        const px = r() * n, py = r() * n, s = 20 + r() * 26, nl = 2 + (r() * 3 | 0), a = (r() - .5) * .5, formes = [];
        for (let k = 0; k < nl; k++) { const pts = []; for (let q = 0; q < 7; q++) { const an = q / 7 * TAU; pts.push([k * s * .85 + Math.cos(an) * s * (.36 + r() * .2), Math.sin(an) * s * (.55 + r() * .25)]); } formes.push({ pts, col: r() < .4 ? cl[0] : fond }); }
        partout(x, n, () => { x.save(); x.translate(px, py); x.rotate(a); formes.forEach(f => { courbeFermee(x, f.pts); x.fillStyle = f.col; x.fill(); x.strokeStyle = encre; x.lineWidth = 3.5; x.stroke(); }); x.restore(); });
      }
      // tags : lettres griffonnées d'un trait épais, soulignés, coulures
      x.strokeStyle = encre; x.fillStyle = encre;
      for (let i = 0; i < 30; i++) {
        const px = r() * n, py = r() * n, s = 16 + r() * 30, a = (r() - .5) * .6, nl = 3 + (r() * 5 | 0), ep = s * (.15 + r() * .16), lettres = [];
        for (let k = 0; k < nl; k++) { const pts = [], np = 3 + (r() * 3 | 0); for (let q = 0; q < np; q++) pts.push([k * s * .75 + (r() - .2) * s * .7, (r() - .5) * s * 1.5]); lettres.push(pts); }
        const souligne = r() < .5, coulures = [];
        for (let k = 0; k < 3; k++) if (r() < .45) coulures.push([r() * nl * s * .75, s * .6, 10 + r() * 40]);
        partout(x, n, () => {
          x.save(); x.translate(px, py); x.rotate(a); x.lineWidth = ep;
          lettres.forEach(pts => { courbeOuverte(x, pts); x.stroke(); });
          if (souligne) { x.lineWidth = ep * .7; x.beginPath(); x.moveTo(-s * .3, s * .95); x.quadraticCurveTo(nl * s * .4, s * 1.4, nl * s * .85, s * .7); x.stroke(); }
          x.lineWidth = Math.max(1.2, ep * .25);
          coulures.forEach(([cx, cy, l]) => { x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + 1, cy + l); x.stroke(); x.beginPath(); x.arc(cx + 1, cy + l, x.lineWidth * 1.3, 0, TAU); x.fill(); });
          x.restore();
        });
      }
      break;
    }
    case 'popart': {       // dessin au trait noir épais et grands aplats de couleur sur fond blanc (art moderne)
      const [fond = '#EEECE6', encre = '#1A1A1C', ...aplats] = couleurs, cl = aplats.length ? aplats : ['#D88A2A', '#C8282A', '#2A4AA8', '#E8A0A0'], r = alea(271);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n); x.lineCap = 'round'; x.lineJoin = 'round';
      const formes = [];
      for (let i = 0; i < 8; i++) {
        const px = r() * n, py = r() * n, R = n * (.1 + r() * .13), k = 6 + (r() * 4 | 0), a0 = r() * TAU, pts = [];
        for (let q = 0; q < k; q++) { const an = a0 + q / k * TAU + (r() - .5) * .3, rr = R * (.55 + r() * .7); pts.push([px + Math.cos(an) * rr * 1.2, py + Math.sin(an) * rr]); }
        formes.push({ pts, col: cl[i % cl.length], trait: r() < .85 });
      }
      formes.forEach(f => partout(x, n, () => { courbeFermee(x, f.pts); x.fillStyle = f.col; x.fill(); if (f.trait) { x.strokeStyle = encre; x.lineWidth = 9; x.stroke(); } }));
      // traits libres : contours, boucles, crochets
      const traits = [];
      for (let i = 0; i < 16; i++) {
        let px = r() * n, py = r() * n, a = r() * TAU; const pts = [[px, py]], k = 3 + (r() * 4 | 0);
        for (let q = 0; q < k; q++) { a += (r() - .5) * 2.2; const l = 25 + r() * 55; px += Math.cos(a) * l; py += Math.sin(a) * l; pts.push([px, py]); }
        traits.push({ pts, ep: 7 + r() * 5 });
      }
      traits.forEach(t => partout(x, n, () => { courbeOuverte(x, t.pts); x.strokeStyle = encre; x.lineWidth = t.ep; x.stroke(); }));
      const ronds = []; for (let i = 0; i < 8; i++) ronds.push([r() * n, r() * n, 6 + r() * 14, r() < .5]);
      ronds.forEach(([px, py, rr, plein]) => partout(x, n, () => { x.beginPath(); x.arc(px, py, rr, 0, TAU); if (plein) { x.fillStyle = encre; x.fill(); } else { x.lineWidth = 6; x.strokeStyle = encre; x.stroke(); } }));
      break;
    }
    case 'patchwork': {    // pavés tissés en rangées (ikat, patchwork), fil chiné
      const cl = couleurs.length > 1 ? couleurs : ['#B05A30', '#C8743A', '#6A7A88', '#3A6A6A', '#6A4030', '#C8B8A0'], r = alea(281);
      c = canvas(n); const x = c.getContext('2d');
      for (let y = 0; y < n;) {
        const h = Math.min(n - y, 18 + (r() * 30 | 0));
        for (let px = 0; px < n;) { const w = Math.min(n - px, 16 + (r() * 40 | 0)); x.fillStyle = cl[(r() * cl.length) | 0]; x.fillRect(px, y, w, h); px += w; }
        y += h;
      }
      for (let i = 0; i < 9000; i++) { x.fillStyle = r() < .5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.16)'; x.fillRect(r() * n, r() * n, 3 + r() * 8, 1); }
      break;
    }
    case 'pastilles': {    // feuilles rondes serrées (eucalyptus) : fond, verts
      const [fond = '#E4E2D0', ...vs] = couleurs, cl = vs.length ? vs : ['#6E8A4A', '#8AA45E', '#55703A', '#A8BC80'], r = alea(291);
      c = canvas(n); const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, n, n);
      const fs = []; for (let i = 0; i < 70; i++) fs.push([r() * n, r() * n, 20 + r() * 14, r() * TAU, cl[(r() * cl.length) | 0]]);
      fs.forEach(([px, py, rr, a, col]) => partout(x, n, () => {
        x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = col; x.beginPath(); x.ellipse(0, 0, rr, rr * .84, 0, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(236,236,220,.6)'; x.lineWidth = 2; x.stroke(); x.beginPath(); x.moveTo(-rr * .75, 0); x.lineTo(rr * .75, 0); x.stroke(); x.restore();
      }));
      break;
    }
    default: {
      c = canvas(8); const x = c.getContext('2d'); x.fillStyle = couleurs[0] || '#CCCCCC'; x.fillRect(0, 0, 8, 8);
    }
  }
  MOTIFS[cle] = textureCouleur(c);
  MOTIFS[cle].userData.canvas = c;
  return MOTIFS[cle];
}

/* ---------------------------------------------------------------
   Matières. type : velours, chenille, cotele, boucle, fourrure, cuir,
   tissu, laque, bois. o.motif (+ o.couleurs) remplace la couleur par un
   imprimé ; o.echelle : taille du motif (m) ; o.grain : autre grain.
   --------------------------------------------------------------- */
const MATIERES = {};
const REGLAGES = {
  velours: { grain: 'velours', uv: .4, ns: .3 },
  chenille: { grain: 'chenille', uv: .2, ns: .55 },
  cotele: { grain: 'cotes', uv: .12, ns: .7 },
  boucle: { grain: 'boucle', uv: .16, ns: 1 },
  fourrure: { grain: 'fourrure', uv: .3, ns: 1.4 },
  cuir: { grain: 'cuir', uv: .18, ns: .25 },
  tissu: { grain: 'tissage', uv: .06, ns: .35 },
  laque: { grain: null, uv: 0, ns: 0 },
  bois: { grain: 'bois', uv: .5, ns: .4 }
};
export function matiere(type, couleur, o = {}) {
  const cle = [type, couleur, o.motif || '', (o.couleurs || []).join(','), o.echelle || '', o.grain || '', o.rough ?? ''].join('|');
  if (MATIERES[cle]) return MATIERES[cle];
  const R = REGLAGES[type] || REGLAGES.tissu, gr = o.grain || R.grain;
  const base = o.motif ? '#FFFFFF' : couleur;
  const clair = new THREE.Color(couleur).lerp(new THREE.Color('#FFFFFF'), .28);
  let m;
  switch (type) {
    case 'velours': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .8, sheen: .8, sheenRoughness: .42, sheenColor: clair }); break;
    case 'chenille': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .92, sheen: .6, sheenRoughness: .55, sheenColor: clair }); break;
    case 'cotele': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .86, sheen: .8, sheenRoughness: .45, sheenColor: clair }); break;
    case 'cuir': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .48, clearcoat: .35, clearcoatRoughness: .42 }); break;
    case 'laque': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .25, clearcoat: 1, clearcoatRoughness: .12 }); break;
    case 'bois': m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: o.rough ?? .55, map: motif('bois', o.couleurs || [couleur, new THREE.Color(couleur).multiplyScalar(.62).getStyle()]) }); break;
    default: m = new THREE.MeshStandardMaterial({ color: base, roughness: o.rough ?? (type === 'boucle' || type === 'fourrure' ? 1 : .94) });
  }
  if (o.motif) m.map = motif(o.motif, o.couleurs || [couleur]);
  if (gr) { m.normalMap = grain(gr); const k = o.ns ?? R.ns; m.normalScale = new THREE.Vector2(k, k); }
  // relief de tapissier : creux ombrés (sur la couleur ou sur le motif)
  if (gr && RELIEFS.has(gr) && type !== 'bois') m.map = texteOmbree(gr, m.map ? m.map.userData.canvas : null);
  if (m.map || m.normalMap) m.userData.uvMonde = o.echelle || (m.map && type !== 'bois' ? .5 : R.uv || .3);
  m.name = 'modele:' + cle;
  MATIERES[cle] = m;
  return m;
}
// matière lumineuse à motif (albâtre, opalines veinées) : suit l'ambiance jour / soir
export function lumineux(nom, couleurs, emissive = '#FFC98E', jour = .35, soir = 2) {
  const cle = 'lum|' + nom + '|' + couleurs.join(',') + '|' + emissive;
  if (MATIERES[cle]) return MATIERES[cle];
  const t = motif(nom, couleurs);
  const m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: t, roughness: .55, emissive: new THREE.Color(emissive), emissiveMap: t, emissiveIntensity: jour });
  m.userData.uvMonde = .25;
  LUMINEUX.push({ m, jour, soir });
  MATIERES[cle] = m;
  return m;
}
// matière teintée sommet par sommet (dégradés peints) : f(x, y, z) → [r, g, b] sRGB 0..1,
// évaluée à la cuisson dans le repère du modèle. Une matière neuve par appel (f propre au modèle).
export function matiereCouleurs(type, f, o = {}) {
  const base = matiere(type, '#FFFFFF', o), m = base.clone();
  m.vertexColors = true;
  if (m.sheenColor) { m.sheen = .55; m.sheenColor = new THREE.Color('#A8A8A8'); }
  m.userData = { ...base.userData, couleurMonde: f };
  m.name = base.name + '|sommets';
  return m;
}
// rampe de couleurs : t ∈ [0, 1] → [r, g, b] sRGB 0..1 (interpolation entre les teintes)
export function rampe(cols) {
  const c = cols.map(h => { const k = new THREE.Color(h), o = {}; k.getRGB(o, THREE.SRGBColorSpace); return [o.r, o.g, o.b]; });
  return t => {
    t = clamp(t, 0, 1) * (c.length - 1);
    const k = Math.min(c.length - 2, Math.floor(t)), f = t - k;
    return [lerp(c[k][0], c[k + 1][0], f), lerp(c[k][1], c[k + 1][1], f), lerp(c[k][2], c[k + 1][2], f)];
  };
}

/* ---------------------------------------------------------------
   Ombre douce au sol (tache), comme les modèles génériques
   --------------------------------------------------------------- */
export { ombreSol, halo, literie, cable, rosace, geometrieSuspension, bloc, cyl, sphere, tore, tube, instances, teinte } from '../meubles.js';

/* ---------------------------------------------------------------
   Bande en arc aux bouts arrondis (vue de dessus) : assises et
   dossiers des canapés courbes. Centre de l'arc en (0, cz) du plan
   de la forme ; rayons ri..re ; angles a0..a1 (π/2 = vers l'arrière)
   --------------------------------------------------------------- */
export function formeBandeArc(ri, re, a0, a1, cz = 0, n = 48) {
  const s = new THREE.Shape(), e = (re - ri) / 2, rm = (ri + re) / 2;
  const pt = (a, r) => [Math.cos(a) * r, cz + Math.sin(a) * r];
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(pt(lerp(a0, a1, i / n), re));
  // bout arrondi en a1, de l'extérieur vers l'intérieur
  for (let i = 1; i < 12; i++) { const f = i / 12 * Math.PI, u = [Math.cos(a1), Math.sin(a1)], t = [-Math.sin(a1), Math.cos(a1)]; pts.push([u[0] * rm + (u[0] * Math.cos(f) + t[0] * Math.sin(f)) * e, cz + u[1] * rm + (u[1] * Math.cos(f) + t[1] * Math.sin(f)) * e]); }
  for (let i = 0; i <= n; i++) pts.push(pt(lerp(a1, a0, i / n), ri));
  for (let i = 1; i < 12; i++) { const f = i / 12 * Math.PI, u = [Math.cos(a0), Math.sin(a0)], t = [-Math.sin(a0), Math.cos(a0)]; pts.push([u[0] * rm - (u[0] * Math.cos(f) + t[0] * Math.sin(f)) * e, cz + u[1] * rm - (u[1] * Math.cos(f) + t[1] * Math.sin(f)) * e]); }
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}
// point d'un arc vu de dessus, en coordonnées du monde (centre de l'arc en z = zc, π/2 = arrière)
export const surArc = (a, r, y, zc) => [Math.cos(a) * r, y, zc - Math.sin(a) * r];

/* ---------------------------------------------------------------
   Coque paramétrique épaisse : f(u, t) → [x, y, z] décrit la face
   extérieure (u : autour, de 0 à 1 ; t : du bas vers le haut) ; la face
   intérieure est décalée de ep vers l'axe (cx, cz), les bords sont fermés
   et arrondis par le lissage. Coques de fauteuils, baignoires, vasques.
   --------------------------------------------------------------- */
export function geoCoqueParam(f, o = {}) {
  const nu = o.nu || 48, nt = o.nt || 18, ep = o.ep ?? .04, cx = o.cx || 0, cz = o.cz || 0, ferme = !!o.ferme;
  const cols = ferme ? nu : nu + 1, P = [];
  for (let j = 0; j <= nt; j++) for (let i = 0; i < cols; i++) P.push(V3(...f(i / nu, j / nt)));
  const at = (i, j) => P[j * cols + (ferme ? ((i % nu) + nu) % nu : clamp(i, 0, nu))];
  const N = P.map((p, k) => {
    const i = k % cols, j = (k / cols) | 0;
    const du = at(i + 1, j).clone().sub(at(i - 1, j)), dt = at(i, Math.min(nt, j + 1)).clone().sub(at(i, Math.max(0, j - 1)));
    const n = V3().crossVectors(dt, du);
    if (n.lengthSq() < 1e-12) n.set(p.x - cx, 0, p.z - cz);
    n.normalize();
    if (n.x * (p.x - cx) + n.z * (p.z - cz) < 0) n.negate();
    return n;
  });
  const Q = P.map((p, k) => p.clone().addScaledVector(N[k], -(typeof ep === 'function' ? ep((k % cols) / nu, ((k / cols) | 0) / nt) : ep)));
  const pos = [];
  P.concat(Q).forEach(v => pos.push(v.x, v.y, v.z));
  const nP = P.length, idx = [];
  const id = (i, j, dedans) => (dedans ? nP : 0) + j * cols + (ferme ? i % nu : i);
  // orientation : l'extérieur doit regarder vers N
  const a0 = at(0, 0), du0 = at(1, 0).clone().sub(a0), dt0 = at(0, 1).clone().sub(a0);
  const sens = V3().crossVectors(du0, dt0).dot(N[0]) > 0;
  const quad = (a, b, c, d, inv) => { if (sens !== inv) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); };
  const iu = ferme ? nu : nu;
  for (let j = 0; j < nt; j++) for (let i = 0; i < iu; i++) {
    quad(id(i, j), id(i + 1, j), id(i, j + 1), id(i + 1, j + 1), false);
    quad(id(i, j, 1), id(i + 1, j, 1), id(i, j + 1, 1), id(i + 1, j + 1, 1), true);
  }
  // bords : haut et bas, puis côtés si la coque est ouverte
  for (let i = 0; i < iu; i++) {
    quad(id(i, nt), id(i + 1, nt), id(i, nt, 1), id(i + 1, nt, 1), false);
    quad(id(i, 0), id(i + 1, 0), id(i, 0, 1), id(i + 1, 0, 1), true);
  }
  if (!ferme) for (let j = 0; j < nt; j++) {
    quad(id(0, j), id(0, j, 1), id(0, j + 1), id(0, j + 1, 1), false);
    quad(id(nu, j), id(nu, j, 1), id(nu, j + 1), id(nu, j + 1, 1), true);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function coqueParam(parent, f, m, o = {}) {
  const me = mesh(geoCoqueParam(f, o), m);
  parent.add(me);
  return me;
}
// contour en U vu de dessus (dossier + accoudoirs) : u de 0 (avant gauche) à 1 (avant droit)
// demi-largeur a, profondeur b (de l'axe vers l'arrière), avancée des bras av ; centre en z = zc
export function planU(u, a, b, av, zc = 0) {
  const s = u * 2 - 1, phi = s * (Math.PI / 2 + av);
  return [a * Math.sin(phi), zc - b * Math.cos(phi)];
}

/* ---------------------------------------------------------------
   Pieds et piètements
   --------------------------------------------------------------- */
// pieds aux positions [[x, z], …] ; type : fuseau, droit, carre, tourne, boule, compas, roulette, luge
export function pieds(g, pos, h, m, type = 'fuseau', o = {}) {
  const r = o.r || .016;
  pos.forEach(([x, z]) => {
    switch (type) {
      case 'droit': cyl(g, r, r, h, m, x, 0, z, 12); break;
      case 'carre': { const b = mesh(new THREE.BoxGeometry(r * 2, h, r * 2), m); place(g, b, x, h / 2, z); break; }
      case 'tourne': tourne(g, [[0, 0], [r * .7, 0], [r * .8, h * .1], [r * .6, h * .25], [r * 1.1, h * .5], [r * .7, h * .75], [r * .9, h * .9], [r * 1.1, h], [0, h]], m, x, 0, z, 14); break;
      case 'roulette': tourne(g, [[0, h * .2], [r * .8, h * .22], [r * 1.1, h * .5], [r * .8, h * .8], [r * 1.2, h], [0, h]], m, x, 0, z, 14); sphere(g, h * .11, M('laiton'), x, h * .11, z, 1, 1, 1, 10); break;
      case 'boule': sphere(g, Math.max(r * 1.8, h / 2), m, x, Math.max(r * 1.8, h / 2), z, 1, 1, 1, 14); break;
      case 'compas': {        // pied fuselé incliné vers l'extérieur
        const k = o.ecart ?? .12, l = Math.hypot(x, z) || 1, dx = x / l, dz = z / l;
        const p = tourne(g, [[0, 0], [r * .55, 0], [r, h], [0, h]], m, x + dx * h * k / 2, 0, z + dz * h * k / 2, 12);
        p.rotation.set(dz * k, 0, -dx * k);
        break;
      }
      default: tourne(g, [[0, 0], [r * .55, 0], [r, h], [0, h]], m, x, 0, z, 12);
    }
  });
}
// coins d'un rectangle (pour pieds) : demi-largeur a, demi-profondeur b
export const coins = (a, b) => [[-a, -b], [a, -b], [-a, b], [a, b]];
// piètement pivotant : disque, colonne (type 'disque') ou croix à branches ('etoile', n branches)
export function pivot(g, r, h, m, type = 'disque', n = 4) {
  if (type === 'etoile') {
    for (let i = 0; i < n; i++) { const a = i / n * TAU + Math.PI / n; boudin(g, [[0, .05, 0], [Math.cos(a) * r * .6, .035, Math.sin(a) * r * .6], [Math.cos(a) * r, .02, Math.sin(a) * r]], t => .022 - .008 * t, m, { seg: 12, radial: 8 }); }
    cyl(g, .035, .04, h, m, 0, .03, 0, 16);
  } else {
    tourne(g, [[0, 0], [r, 0], [r, .008], [r * .9, .022], [0, .026]], m, 0, 0, 0, 40);
    cyl(g, .03, .04, h, m, 0, .02, 0, 16);
  }
}
// boutons de capitonnage aux positions [[x, y, z], …]
export function boutons(g, pos, m, r = .012) {
  return instances(g, new THREE.SphereGeometry(r, 8, 6), m, pos.map(p => [p[0], p[1], p[2], 0, 0, 0, 1, 1, 1, .5]));
}
// bourrelet arrondi sur le bord haut d'une coque paramétrique (f, épaisseur ep, axe cx, cz)
export function bordCoque(parent, f, ep, m, o = {}) {
  const n = o.n || 40, cx = o.cx || 0, cz = o.cz || 0, pts = [];
  for (let i = 0; i <= n; i++) {
    const [x, y, z] = f(i / n, 1), l = Math.hypot(x - cx, z - cz) || 1;
    pts.push([x - (x - cx) / l * ep / 2, y, z - (z - cz) / l * ep / 2]);
  }
  return boudin(parent, pts, o.r || ep * .6, m, { plan: true, kv: o.kv || 1, seg: n * 3, radial: 14, kb: o.kb ?? .9 });
}

// matière ajourée : résine ou métal percé de cellules organiques (transparence par seuil)
const AJOURES = {};
export function matiereAjouree(couleur, echelle = .35, plein = .45, nb = 14) {
  const cle = couleur + echelle + plein + nb;
  if (AJOURES[cle]) return AJOURES[cle];
  const n = 256, cel = cellules(n, nb, 221, .9), c = canvas(n), x = c.getContext('2d'), img = x.createImageData(n, n), rgb = hexRgb(couleur);
  for (let i = 0; i < n * n; i++) {
    const bord = cel.f2[i] - cel.f1[i];
    img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = bord < plein * .5 ? 255 : 0;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: t, alphaTest: .5, side: THREE.DoubleSide, roughness: .4 });
  m.userData.uvMonde = echelle;
  AJOURES[cle] = m;
  return m;
}
