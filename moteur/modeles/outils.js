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
import { M, mesh, place, groupe, alea, LUMINEUX } from '../meubles.js';

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
const GRAINS = {};
// grain : hauteur générée une fois, partagée par toutes les couleurs
export function grain(nom) {
  if (GRAINS[nom]) return GRAINS[nom];
  const n = 256;
  let h, force = 3;
  switch (nom) {
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
  GRAINS[nom] = carteNormale(n, h, force);
  return GRAINS[nom];
}

/* ---------------------------------------------------------------
   Motifs (couleurs) : imprimés, jacquards, marbrures, veinages
   --------------------------------------------------------------- */
const MOTIFS = {};
const hexRgb = h => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
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
      c = seuils(n, v, quantiles(v, [[0, fond], [.5, mi], [.62, clair], [.84, vif]]), .012);
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
    default: {
      c = canvas(8); const x = c.getContext('2d'); x.fillStyle = couleurs[0] || '#CCCCCC'; x.fillRect(0, 0, 8, 8);
    }
  }
  MOTIFS[cle] = textureCouleur(c);
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
  const clair = new THREE.Color(couleur).lerp(new THREE.Color('#FFFFFF'), .35);
  let m;
  switch (type) {
    case 'velours': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .8, sheen: 1, sheenRoughness: .4, sheenColor: clair }); break;
    case 'chenille': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .92, sheen: .6, sheenRoughness: .55, sheenColor: clair }); break;
    case 'cotele': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .86, sheen: .8, sheenRoughness: .45, sheenColor: clair }); break;
    case 'cuir': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .48, clearcoat: .35, clearcoatRoughness: .42 }); break;
    case 'laque': m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.rough ?? .25, clearcoat: 1, clearcoatRoughness: .12 }); break;
    case 'bois': m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: o.rough ?? .55, map: motif('bois', o.couleurs || [couleur, new THREE.Color(couleur).multiplyScalar(.62).getStyle()]) }); break;
    default: m = new THREE.MeshStandardMaterial({ color: base, roughness: o.rough ?? (type === 'boucle' || type === 'fourrure' ? 1 : .94) });
  }
  if (o.motif) m.map = motif(o.motif, o.couleurs || [couleur]);
  if (gr) { m.normalMap = grain(gr); const k = o.ns ?? R.ns; m.normalScale = new THREE.Vector2(k, k); }
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
