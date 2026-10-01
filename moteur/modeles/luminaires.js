/* =================================================================
   RealRoom — modèles fidèles : luminaires (d'après les photos produits)
   Suspensions et lustres : origine au plafond. Appliques : origine au
   mur, face vers +z. Lampadaires : origine au sol.
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, V3, clamp, lerp, alea,
  coussin, boudin, geoBoudin, tourne, panneau, rectCoins, rectArrondi, formeLisse, matiere, lumineux, bosseler,
  ombreSol, halo, cable, rosace, geometrieSuspension, cyl, sphere, tore, instances, LUMINEUX
} from './outils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- plumes d'autruche : rubans courbes, barbes en transparence ---------- */
let TEX_PLUME = null;
function texturePlume() {
  if (TEX_PLUME) return TEX_PLUME;
  const w = 128, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), r = alea(77);
  x.clearRect(0, 0, w, h);
  // barbes : de la tige vers les bords, inclinées vers la pointe (haut de l'image)
  for (let i = 0; i < 4200; i++) {
    const v = r(), y = h * (1 - v), cote = r() < .5 ? -1 : 1;
    const prof = Math.sin(Math.PI * Math.pow(v, .8)) * (.75 + r() * .3);
    const long = (w / 2) * prof * (.55 + r() * .5);
    const t = 230 + r() * 25 | 0;
    x.strokeStyle = `rgba(${t},${t - 6},${t - 18},${.5 + r() * .45})`;
    x.lineWidth = .6 + r() * 1.2;
    x.beginPath(); x.moveTo(w / 2, y);
    x.quadraticCurveTo(w / 2 + cote * long * .5, y - long * .15, w / 2 + cote * long, y - long * (.35 + r() * .3));
    x.stroke();
  }
  x.strokeStyle = 'rgba(225,215,195,.9)'; x.lineWidth = 2.2;
  x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, h * .03); x.stroke();
  TEX_PLUME = new THREE.CanvasTexture(c);
  TEX_PLUME.colorSpace = THREE.SRGBColorSpace; TEX_PLUME.anisotropy = 4;
  return TEX_PLUME;
}
const MAT_PLUMES = {};
function matPlume(couleur) {
  if (MAT_PLUMES[couleur]) return MAT_PLUMES[couleur];
  const m = new THREE.MeshStandardMaterial({ color: couleur, map: texturePlume(), alphaTest: .32, side: THREE.DoubleSide, roughness: 1, emissive: new THREE.Color('#FFD9A6'), emissiveMap: texturePlume(), emissiveIntensity: .1 });
  m.name = 'plume:' + couleur;
  LUMINEUX.push({ m, jour: .1, soir: .9 });
  MAT_PLUMES[couleur] = m;
  return m;
}
// une plume : part de o, monte vers dir puis retombe (chute en radians), largeur maxi w
function geoPlume(o, dir, long, w, chute, r) {
  const ns = 16, nw = 5, pos = [], uv = [], idx = [];
  const lat = V3().crossVectors(dir, V3(0, 1, 0)).normalize();
  if (lat.lengthSq() < .5) lat.set(1, 0, 0);
  let p = o.clone(), d = dir.clone().normalize();
  const axe = lat.clone(), pas = long / ns;
  for (let i = 0; i <= ns; i++) {
    const t = i / ns, larg = w * Math.sin(Math.PI * Math.min(1, Math.pow(t, .7) * .98 + .02)) * (t < .12 ? t / .12 : 1);
    const haut = V3().crossVectors(lat, d).normalize();
    for (let j = 0; j < nw; j++) {
      const u = j / (nw - 1), s = (u - .5) * larg, pli = (1 - Math.abs(u - .5) * 2) * larg * .12;
      pos.push(p.x + lat.x * s + haut.x * pli, p.y + lat.y * s + haut.y * pli, p.z + lat.z * s + haut.z * pli);
      uv.push(u, t);
    }
    // la plume ploie : la direction tourne vers le bas autour de l'axe latéral
    d.applyAxisAngle(axe, -chute / ns * (.4 + 1.2 * t)).normalize();
    p.addScaledVector(d, pas);
  }
  for (let i = 0; i < ns; i++) for (let j = 0; j < nw - 1; j++) { const a = i * nw + j, b = a + 1, c = a + nw, e = c + 1; idx.push(a, b, c, b, e, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* ---------- utilitaires des luminaires ---------- */
// lustres : hauteur du corps (limitée par la pièce), courte descente, emprise
function geometrieLustre(p, o) {
  const hMax = o.hMax || 2.2, H = clamp(Math.min(p.dim[2], hMax - .05), .3, 2.5);
  return { H, d: clamp(Math.min(o.h ?? .1, hMax - H), .02, .3), L: clamp(p.dim[0], .3, 3.2), P: clamp(p.dim[1], .3, 3.2) };
}
// surface mince d'après f(u, v) → [x, y, z] (abat-jour, voiles, rubans) : à poser avec une matière double face
function geoSurface(f, nu = 48, nv = 16) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const q = f(i / nu, j / nv); pos.push(q[0], q[1], q[2]); uv.push(i / nu, j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, e = c + 1; idx.push(a, b, c, b, e, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// tissu ou papier d'abat-jour : double face, éclairé de l'intérieur le soir
const ABATS = {};
function abat(couleur, lueur = '#FFD9A8', jour = .3, soir = 1.6) {
  const cle = couleur + lueur + jour + soir;
  if (ABATS[cle]) return ABATS[cle];
  const m = new THREE.MeshStandardMaterial({ color: couleur, roughness: .92, side: THREE.DoubleSide, emissive: new THREE.Color(lueur), emissiveIntensity: jour });
  m.name = 'abat:' + cle;
  LUMINEUX.push({ m, jour, soir });
  return (ABATS[cle] = m);
}
// voile de fils tendus (soie, cordelettes) : fils verticaux translucides, lueur plus forte en bas
const FILS = {};
function matFils(couleur, lueur = '#FF9A5A') {
  if (FILS[couleur]) return FILS[couleur];
  const w = 512, h = 256, a = document.createElement('canvas'), b = document.createElement('canvas');
  a.width = b.width = w; a.height = b.height = h;
  const x = a.getContext('2d'), y = b.getContext('2d'), r = alea(31);
  y.fillStyle = '#000'; y.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) {
    const px = r() * w, lw = .8 + r() * 1.4, al = .5 + r() * .5;
    x.fillStyle = `rgba(255,255,255,${al})`; x.fillRect(px, 0, lw, h);
    y.fillStyle = `rgba(255,255,255,${al})`; y.fillRect(px, 0, lw, h);
  }
  const gr = y.createLinearGradient(0, h, 0, 0);
  gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(.35, '#8A8A8A'); gr.addColorStop(1, '#3A3A3A');
  y.globalCompositeOperation = 'multiply'; y.fillStyle = gr; y.fillRect(0, 0, w, h);
  const ta = new THREE.CanvasTexture(a), tb = new THREE.CanvasTexture(b);
  ta.colorSpace = tb.colorSpace = THREE.SRGBColorSpace; ta.wrapS = tb.wrapS = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ color: couleur, map: ta, transparent: true, alphaTest: .04, depthWrite: false, side: THREE.DoubleSide, roughness: .8, emissive: new THREE.Color(lueur), emissiveMap: tb, emissiveIntensity: .45 });
  m.name = 'fils:' + couleur;
  LUMINEUX.push({ m, jour: .45, soir: 2.2 });
  return (FILS[couleur] = m);
}
// verre soufflé clair : reflets nets, un peu plus présent que la « bulle » des maquettes
let VERRE_CLAIR = null;
function verreClair() {
  if (VERRE_CLAIR) return VERRE_CLAIR;
  const m = new THREE.MeshPhysicalMaterial({ color: '#FDF8F0', roughness: .04, metalness: 0, transparent: true, opacity: .38, envMapIntensity: 3, clearcoat: 1, clearcoatRoughness: .05, depthWrite: false, side: THREE.DoubleSide, emissive: new THREE.Color('#FFE0B0'), emissiveIntensity: .08 });
  m.name = 'verreClair';
  LUMINEUX.push({ m, jour: .08, soir: .5 });
  return (VERRE_CLAIR = m);
}
// verre opalin : blanc laiteux nuancé (le jour on voit sa forme, le soir il s'allume)
const OPALINS = {};
function opalin(teinte = '#F2EDE6', lueur = '#FFE4BC') {
  const cle = teinte + lueur;
  if (OPALINS[cle]) return OPALINS[cle];
  const m = new THREE.MeshPhysicalMaterial({ color: teinte, roughness: .32, clearcoat: .6, clearcoatRoughness: .25, emissive: new THREE.Color(lueur), emissiveIntensity: .12 });
  m.name = 'opalin:' + cle;
  LUMINEUX.push({ m, jour: .12, soir: 1.9 });
  return (OPALINS[cle] = m);
}
// verre strié translucide (pétales, lames) et voile d'acrylique nervuré
const VERRES_STRIES = {};
let VOILE_STRIE = null;
function verreStrie(double = false) {
  if (VERRES_STRIES[double]) return VERRES_STRIES[double];
  const m = new THREE.MeshPhysicalMaterial({ color: '#F6F1E8', roughness: .22, transparent: true, opacity: .78, envMapIntensity: 1.8, clearcoat: 1, emissive: new THREE.Color('#FFE4BC'), emissiveIntensity: .22, side: double ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !double });
  m.name = 'verreStrie' + (double ? '2' : '');
  LUMINEUX.push({ m, jour: .22, soir: 1.3 });
  return (VERRES_STRIES[double] = m);
}
function voileStrie() {
  if (VOILE_STRIE) return VOILE_STRIE;
  const w = 64, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,1)';
  for (let y = 0; y < h; y += 6) x.fillRect(0, y, w, 2.2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 18);
  const m = new THREE.MeshStandardMaterial({ color: '#E8DCC6', map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: .3, metalness: .2, emissive: new THREE.Color('#FFE2B0'), emissiveMap: t, emissiveIntensity: .3 });
  m.name = 'voileStrie';
  LUMINEUX.push({ m, jour: .35, soir: 1.6 });
  return (VOILE_STRIE = m);
}
// feuille de verre nervuré : nervure centrale et nervures obliques, bords plus marqués
let FEUILLE = null;
function feuilleVerre() {
  if (FEUILLE) return FEUILLE;
  const w = 256, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), r = alea(68);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,1)'; x.lineCap = 'round';
  x.lineWidth = 5; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, 0); x.stroke();
  for (let y = 30; y < h - 20; y += 26) [-1, 1].forEach(s => {
    x.lineWidth = 2.2; x.beginPath(); x.moveTo(w / 2, h - y); x.quadraticCurveTo(w / 2 + s * w * .25, h - y - 30, w / 2 + s * w * .48, h - y - 60 - r() * 20); x.stroke();
    x.lineWidth = 1; for (let k = 0; k < 4; k++) { const t = .3 + r() * .6; x.beginPath(); x.moveTo(w / 2 + s * w * .48 * t, h - y - 50 * t); x.lineTo(w / 2 + s * w * (.48 * t + .08), h - y - 50 * t + 14); x.stroke(); }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ color: '#E2DACB', map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: .2, metalness: .15, emissive: new THREE.Color('#FFE6C0'), emissiveMap: t, emissiveIntensity: .22 });
  m.name = 'feuilleVerre';
  LUMINEUX.push({ m, jour: .3, soir: 1.5 });
  return (FEUILLE = m);
}
// verre soufflé ambré double face, cuivre poli, céramique blanche brillante
let AMBRE2 = null, CUIVRE = null, CERAMIQUE = null, GRILLE = null, TABLEAU = null;
function verreAmbre() {
  if (AMBRE2) return AMBRE2;
  const m = new THREE.MeshPhysicalMaterial({ color: '#D9A55C', roughness: .08, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 1.8, emissive: new THREE.Color('#FFB060'), emissiveIntensity: .25 });
  m.name = 'verreAmbre';
  LUMINEUX.push({ m, jour: .25, soir: 1.4 });
  return (AMBRE2 = m);
}
function cuivre() {
  if (CUIVRE) return CUIVRE;
  CUIVRE = new THREE.MeshStandardMaterial({ color: '#B8704E', roughness: .3, metalness: 1 });
  CUIVRE.name = 'cuivre';
  return CUIVRE;
}
function ceramique() {
  if (CERAMIQUE) return CERAMIQUE;
  CERAMIQUE = new THREE.MeshPhysicalMaterial({ color: '#F2F0EC', roughness: .18, clearcoat: 1, clearcoatRoughness: .08, emissive: new THREE.Color('#FFEFD8'), emissiveIntensity: .05 });
  CERAMIQUE.name = 'ceramique';
  LUMINEUX.push({ m: CERAMIQUE, jour: .05, soir: .6 });
  return CERAMIQUE;
}
// verre opalin d'une grille : demi-lune plus lumineuse à gauche de chaque carreau
function verreGrille() {
  if (GRILLE) return GRILLE;
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d');
  x.fillStyle = '#7A7672'; x.fillRect(0, 0, n, n);
  const gr = x.createRadialGradient(n * .05, n * .5, 0, n * .05, n * .5, n * .55);
  gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(.7, '#F2EEE8'); gr.addColorStop(1, '#7A7672');
  x.fillStyle = gr; x.beginPath(); x.arc(n * .05, n * .5, n * .42, -Math.PI / 2, Math.PI / 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  GRILLE = new THREE.MeshStandardMaterial({ color: '#C9C4BC', roughness: .5, side: THREE.DoubleSide, emissive: new THREE.Color('#FFF2E0'), emissiveMap: t, emissiveIntensity: .7 });
  GRILLE.name = 'verreGrille';
  LUMINEUX.push({ m: GRILLE, jour: .7, soir: 2.2 });
  return GRILLE;
}
// petit tableau générique : branche de fleurs blanches et vase sombre sur fond doré
function tableauFleurs() {
  if (TABLEAU) return TABLEAU;
  const w = 256, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), r = alea(606), gr = x.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, '#8C7A5A'); gr.addColorStop(1, '#5E523E');
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  x.fillStyle = '#2A2622'; x.beginPath(); x.ellipse(w * .62, h * .8, w * .1, h * .12, 0, 0, TAU); x.fill(); x.fillRect(w * .58, h * .62, w * .08, h * .1);
  x.strokeStyle = '#3A3428'; x.lineWidth = 3; x.beginPath(); x.moveTo(w * .62, h * .64); x.quadraticCurveTo(w * .5, h * .3, w * .25, h * .32); x.stroke();
  for (let i = 0; i < 9; i++) { const t = i / 8, px = w * (.6 - .36 * t) + (r() - .5) * 10, py = h * (.6 - .32 * Math.sin(t * 2.4)) + (r() - .5) * 10; x.fillStyle = '#F2EEE6'; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; x.beginPath(); x.ellipse(px + Math.cos(a) * 7, py + Math.sin(a) * 7, 6, 4, a, 0, TAU); x.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  TABLEAU = new THREE.MeshStandardMaterial({ map: t, roughness: .8 });
  TABLEAU.name = 'tableauFleurs';
  return TABLEAU;
}
// arêtes d'un pavé (cadre de laiton) : base posée en y, centrée en (x, z)
function cadre(g, w, h, d, e, m, x = 0, y = 0, z = 0) {
  [[w, e, e, 0, 0, d / 2], [w, e, e, 0, 0, -d / 2], [e, e, d, w / 2, 0, 0], [e, e, d, -w / 2, 0, 0]].forEach(([a, b, c, dx, , dz]) => {
    place(g, mesh(new THREE.BoxGeometry(a, b, c), m), x + dx, y + e / 2, z + dz);
    place(g, mesh(new THREE.BoxGeometry(a, b, c), m), x + dx, y + h - e / 2, z + dz);
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => place(g, mesh(new THREE.BoxGeometry(e, h, e), m), x + sx * w / 2, y + h / 2, z + sz * d / 2));
}
// coque tournée mince (cône, dôme, coupelle) : profil extérieur [[r, y], …] du haut (axe) vers le bord
function coqueTournee(g, prof, ep, m, x = 0, y = 0, z = 0, seg = 40) {
  const int = prof.map(([r, h]) => [Math.max(0, r - ep * .3), h - ep]);
  return tourne(g, [...int, ...prof.slice().reverse()], m, x, y, z, seg);
}
// petites sphères (ampoules, globes) en instances : liste [[x, y, z, r], …]
function billes(g, liste, m, seg = 16) {
  return instances(g, new THREE.SphereGeometry(1, seg, Math.max(8, seg * .7 | 0)), m, liste.map(([x, y, z, r]) => [x, y, z, 0, 0, 0, r]));
}
// répartition quasi uniforme de n points sur une sphère (spirale de Fibonacci)
function fibonacci(n) {
  const pts = [];
  for (let i = 0; i < n; i++) { const yy = 1 - (i + .5) / n * 2, rr = Math.sqrt(1 - yy * yy), a = i * 2.39996; pts.push([Math.cos(a) * rr, yy, Math.sin(a) * rr]); }
  return pts;
}
// points tirés dans un ellipsoïde (demi-axes a, b, c), espacés d'au moins dmin
function semis(n, a, b, c, dmin, graine = 1, coquille = 0) {
  const r = alea(graine), pts = [];
  for (let essai = 0; essai < n * 400 && pts.length < n; essai++) {
    const x = (r() * 2 - 1) * a, y = (r() * 2 - 1) * b, z = (r() * 2 - 1) * c, q = (x / a) ** 2 + (y / b) ** 2 + (z / c) ** 2;
    if (q > 1 || q < coquille) continue;
    if (pts.every(p => (p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2 >= dmin * dmin)) pts.push([x, y, z]);
  }
  return pts;
}

export const LUMINAIRES = {
  /* Luna Stack : tige noire, boîtier, trois coupelles d'albâtre empilées, pointe */
  'lst-min-03'(p, o = {}) {
    const g = groupe('suspension');
    const { d } = geometrieSuspension(p, o);
    const noir = M('noir'), alb = lumineux('albatre', ['#F8EFE4', '#E0C4A6'], '#FFD6A8', .28, 2);
    const r = clamp(p.dim[0] / 2, .06, .1), hc = r * .84;
    rosace(g, .04, noir);
    cable(g, d, noir);
    let y = -d;
    cyl(g, .016, .016, .1, noir, 0, y - .1, 0, 16); y -= .1;
    cyl(g, .005, .005, .045, noir, 0, y - .045, 0, 8); y -= .045;
    for (let k = 0; k < 3; k++) {
      // coupelle : dessus plat, fond en demi-sphère
      const prof = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; prof.push([Math.sin(a) * r, -Math.cos(a) * hc]); }
      prof.push([r * .985, -.002], [r * .9, 0], [0, 0]);
      tourne(g, prof, alb, 0, y, 0, 40);
      y -= hc + .012;
      cyl(g, .005, .005, .012, noir, 0, y, 0, 8);
    }
    cyl(g, .005, .005, .05, noir, 0, y - .05, 0, 8);
    tourne(g, [[0, -.035], [.006, -.012], [.008, 0], [0, .001]], noir, 0, y - .05, 0, 10);
    halo(g, .7, 0, -d - .25, 0);
    return g;
  },

  /* Luna Balance : moyeu noir, trois bras horizontaux de longueurs
     différentes, montants, coupelles noires cerclées de laiton et grands
     disques d'opaline plats ; câbles fins jusqu'au plafond */
  'sus-lnb-34'(p, o = {}) {
    const g = groupe('suspension');
    const { d } = geometrieSuspension(p, o);
    const noir = M('noir'), opale = M('opale:#FFE6C4');
    const yh = -d - .34, rd = clamp(p.dim[0] * .22, .13, .2);
    rosace(g, .05, noir);
    cyl(g, .045, .045, .028, noir, 0, yh, 0, 24);
    // câble d'alimentation du moyeu, en courbe lâche
    boudin(g, [[0, yh + .028, 0], [.05, yh + .12, .03], [-.02, yh + .25, .05], [.03, -d * .5, .02], [0, 0, 0]], .003, noir, { seg: 40, radial: 5, bouts: false });
    const bras = [[2.55, .27, .12], [-.1, .34, .2], [4.35, .24, .3]];   // angle, longueur, hauteur du montant
    bras.forEach(([an, lg, hm]) => {
      const dx = Math.cos(an), dz = Math.sin(an), x = dx * lg, z = dz * lg;
      const b = place(g, mesh(new THREE.BoxGeometry(lg, .012, .012), noir), dx * lg / 2, yh + .014, dz * lg / 2);
      b.rotation.y = -an;
      cyl(g, .006, .006, hm, noir, x, yh + .014, z, 8);
      const yc = yh + .014 + hm;
      cyl(g, .042, .036, .045, noir, x, yc, z, 24);
      tore(g, .042, .004, M('laiton'), x, yc + .045, z);
      cyl(g, .03, .03, .004, M('led:#FFE2B8'), x, yc + .043, z, 20);
      const yd = yc + .085;
      cyl(g, rd, rd, .008, opale, x, yd, z, 48);
      cyl(g, .009, .009, .035, noir, x, yd + .008, z, 10);
      cable(g, -(yd + .043), noir, x, z);
    });
    halo(g, 1.4, 0, yh + .2, 0);
    return g;
  },

  /* Wood Orb Duo : plaque ovale en noyer, globe opalin au centre, deux
     demi-sphères en métal noir au-dessus et au-dessous */
  'wom-wall-2414'(p) {
    const g = groupe('applique');
    const w = clamp(p.dim[0], .1, .2), h = clamp(p.dim[2], .25, .45), ep = .028;
    const bois = matiere('bois', '#6E4A33', { couleurs: ['#7A5338', '#4B2E1E'], echelle: .35 });
    panneau(g, rectCoins(w - .01, h - .01, (w - .01) / 2), ep, bois, 'face', 0, 0, ep / 2, { a: .005 });
    const rg = w * .39;
    sphere(g, rg, M('opale:#FFE0B5'), 0, 0, ep + rg * .82, 1, 1, 1, 28);
    cyl(g, .018, .02, .012, M('noir'), 0, 0, ep, 16).rotation.x = Math.PI / 2;
    [-1, 1].forEach(k => tourne(g, [[0, 0], [.02, 0], [.019, .006], [.014, .013], [.007, .017], [0, .018]], M('noir'), 0, k * h * .33, ep, 20).rotation.x = Math.PI / 2);
    halo(g, .8, 0, 0, .12);
    return g;
  },

  /* Feather Palm : tronc doré noueux sur pied griffu, couronne de plumes
     d'autruche ivoire et champagne */
  'fpf-lamp-7705'(p) {
    const g = groupe('lampadaire');
    const H = clamp(p.dim[2], 1.3, 2), or = M('or'), r = alea(7705);
    const yc = H - .38;
    // tronc légèrement sinueux, plus épais en bas, surface noueuse, fourche sous la couronne
    const tronc = geoBoudin([[0, .05, 0], [.015, H * .25, .01], [-.012, H * .5, -.01], [.02, H * .72, .015], [.005, yc, 0]], t => .036 - .014 * t, { seg: 60, radial: 12, kb: .4 });
    g.add(mesh(bosseler(tronc, .005, 40, 3), or));
    const fourche = geoBoudin([[.018, yc - .36, .012], [-.03, yc - .22, .02], [-.07, yc - .08, .03], [-.075, yc + .01, .03]], t => .02 - .007 * t, { seg: 24, radial: 10, kb: .5 });
    g.add(mesh(bosseler(fourche, .003, 50, 4), or));
    // pied griffu : quatre orteils qui s'étalent au sol
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + .5, c = Math.cos(a), s = Math.sin(a);
      boudin(g, [[0, .12, 0], [c * .07, .06, s * .07], [c * .16, .02, s * .16], [c * .25, .012, s * .25]], t => .028 - .018 * t, or, { seg: 20, radial: 8 });
    }
    // couronne : plumes en corolle, dressées puis retombantes
    const tons = ['#F0E7D6', '#E7D7B6', '#DCC6A0', '#F4EEE2'], n = 68;
    tons.forEach((ton, iT) => {
      for (let i = iT; i < n; i += tons.length) {
        const phi = i * 2.39996, el = .35 + (i % 7) / 7 * 1.05 + r() * .12;
        const dir = V3(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
        const base = V3((r() - .5) * .06 - .03, yc + r() * .04, (r() - .5) * .06 + .015);
        g.add(mesh(geoPlume(base.addScaledVector(dir, .02), dir, .52 + r() * .18, .27 + r() * .08, 1.7 + r() * .8, r), matPlume(ton), false));
      }
    });
    sphere(g, .04, M('opale:#FFE0B5'), 0, yc + .02, 0);
    halo(g, 1.2, 0, yc + .05, 0);
    ombreSol(g, .7, .7);
    return g;
  },

  /* Silk Cylinder Glow : haut cylindre de fils de soie terracotta tendus entre deux anneaux bruns,
     lueur chaude au pied, câble noir qui descend en boucle à l'intérieur */
  'scg-light-2421'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const r = clamp(p.dim[0] / 2, .12, .35), cadre = M('laque:#3A2B24'), yb = -d - hb;
    rosace(g, .035, M('noir'));
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + .5; cable(g, d, M('noir'), Math.cos(a) * r * .96, Math.sin(a) * r * .96); }
    boudin(g, [[0, 0, 0], [.02, -d * .6, .01], [-.03, -d - hb * .35, .03], [.04, yb + .1, -.02], [r * .6, yb + .02, -.08]], .0025, M('noir'), { seg: 50, radial: 5, bouts: false });
    place(g, mesh(new THREE.CylinderGeometry(r, r, hb - .016, 64, 1, true), matFils('#B5603A'), false), 0, yb + .008 + (hb - .016) / 2, 0);
    tore(g, r, .006, cadre, 0, -d, 0);
    tourne(g, [[r - .016, 0], [r + .005, 0], [r + .005, .012], [r - .016, .012], [r - .016, 0]], cadre, 0, yb, 0, 64);
    tore(g, r - .006, .003, M('led:#FFB070'), 0, yb + .013, 0);
    halo(g, 1.1, 0, yb + .12, 0);
    return g;
  },

  /* Arc Silk : long dôme en tissu plissé écru tendu sur des nervures brunes, bord noir, barre lumineuse
     en bois foncé en forme de pirogue dessous, deux tiges noires */
  'arc-slk-2203'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l, pr } = geometrieSuspension(p, o);
    const L = l, W = Math.max(pr, .3), hc = Math.min(.16, hb * .86), yr = -d - hc, yb = -d - hb - .03;
    const noir = M('noir'), brun = M('laque:#5A4636'), tissu = abat('#E2D2B6', '#FFD9A8', .32, 1.8);
    const k = s => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), 3)), 1 / 3);
    const f = (u, v) => { const s = u * 2 - 1, th = v * Math.PI, q = k(s); return [s * L / 2, yr + hc * q * Math.sin(th), W / 2 * q * Math.cos(th)]; };
    g.add(mesh(geoSurface(f, 72, 20), tissu, false));
    // nervures en travers et bord noir
    const n = 18;
    for (let i = 1; i < n; i++) {
      const u = i / n, pts = [];
      for (let j = 0; j <= 12; j++) { const [x, y, z] = f(u, j / 12); pts.push([x, yr + (y - yr) * 1.012, z * 1.012]); }
      boudin(g, pts, .0022, brun, { seg: 24, radial: 4, bouts: false });
    }
    const bord = [];
    for (let i = 0; i < 40; i++) bord.push(f(i / 40, 0));
    for (let i = 40; i > 0; i--) bord.push(f(i / 40, 1));
    boudin(g, bord, .005, noir, { ferme: true, seg: 160, radial: 6 });
    // pirogue en bois foncé et sa ligne lumineuse
    const a = L * .38, b = .04;
    panneau(g, formeLisse([[-a, 0], [-a * .75, b * .8], [0, b], [a * .75, b * .8], [a, 0], [a * .75, -b * .8], [0, -b], [-a * .75, -b * .8]]), .035, matiere('bois', '#3E2A20', { couleurs: ['#4A3226', '#2A1C14'] }), 'sol', 0, yb, 0, { a: .012 });
    place(g, mesh(new THREE.BoxGeometry(a * 1.5, .003, .014), M('led:#FFD9A8')), 0, yb - .001, 0);
    // deux tiges et leurs rosaces
    [-1, 1].forEach(s => { const x = s * L * .27; cyl(g, .005, .005, -(yb + .035), noir, x, yb + .035, 0, 8); cyl(g, .032, .032, .012, noir, x, -.012, 0, 20); });
    halo(g, 1.6, 0, yr + .03, 0);
    return g;
  },

  /* Cluster Halo : rosace conique et longue tige en laiton brossé, cône évasé, grappe de globes en verre givré dessous */
  'sus-clh-21'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const la = M('laiton'), R = clamp(p.dim[0] / 2, .14, .3), hcone = R * .55, rg = R * .27, yb = -d - hb;
    const yc = yb + rg * 3.5 + hcone;                       // sommet du cône
    tourne(g, [[0, -.07], [.01, -.068], [.06, -.006], [.06, 0], [0, 0]], la, 0, 0, 0, 28);
    cyl(g, .007, .007, -.07 - yc, la, 0, yc, 0, 10);
    coqueTournee(g, [[0, .004], [.02, 0], [R, -hcone]], .004, la, 0, yc, 0, 48);
    const globes = [], yg = yc - hcone;
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; globes.push([Math.cos(a) * R * .72, yg - rg * .75, Math.sin(a) * R * .72, rg]); }
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + .3; globes.push([Math.cos(a) * R * .4, yg - rg * 1.8, Math.sin(a) * R * .4, rg]); }
    globes.push([0, yg - rg * 2.5, 0, rg * .95]);
    billes(g, globes, opalin(), 20);
    halo(g, .9, 0, yg - rg, 0);
    return g;
  },

  /* Wave Line : deux tiges de laiton poli qui se recourbent en tubes ondulés entrelacés, petites ampoules opalines */
  'wave-line'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l } = geometrieSuspension(p, o);
    const or = M('or'), L = clamp(l, .5, 1.4), y0 = -d - hb + .05, xs = L * .28;
    // tube principal : des bouts vers les tiges, ondulant autour du centre
    const A = [[-L / 2, y0, 0], [-L * .4, y0 + .035, .03], [-xs, y0 + .06, 0], [-L * .14, y0 + .01, -.035], [0, y0 - .015, 0], [L * .14, y0 + .01, .035], [xs, y0 + .06, 0], [L * .4, y0 + .035, -.03], [L / 2, y0, 0]];
    const B = [[-L * .46, y0 - .005, .02], [-xs, y0 + .025, .045], [-L * .16, y0 - .025, 0], [0, y0 + .03, -.03], [L * .16, y0 - .025, 0], [xs, y0 + .025, -.045], [L * .46, y0 - .005, -.02]];
    boudin(g, A, .008, or, { seg: 120, radial: 10 });
    boudin(g, B, .007, or, { seg: 100, radial: 10 });
    // tiges : droites puis cintrées pour rejoindre le tube
    [-1, 1].forEach(s => {
      boudin(g, [[s * xs, 0, 0], [s * xs, y0 + .3, 0], [s * xs, y0 + .14, 0], [s * (xs + .035), y0 + .075, 0], [s * xs * .9, y0 + .06, 0]], .008, or, { seg: 40, radial: 10 });
      cyl(g, .03, .03, .01, or, s * xs, -.01, 0, 20);
    });
    billes(g, [[-L / 2 - .018, y0, 0, .022], [L / 2 + .018, y0, 0, .022], [-L * .16, y0 - .03, 0, .02], [L * .16, y0 - .03, 0, .02]], opalin(), 16);
    halo(g, 1.1, 0, y0, 0);
    return g;
  },

  /* Galaxy Bubble Cluster : sphère de bulles de verre clair autour d'une étoile chromée, une ampoule dans chaque bulle */
  'gbc-orbit-7734'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const R = clamp(Math.min(p.dim[0], hb) / 2, .18, .4), yc = -d - R, rb = R * .23;
    rosace(g, .05, M('noir'));
    cable(g, d - R * .5, M('noir'));
    const coeur = mesh(new THREE.IcosahedronGeometry(R * .42, 0), M('chrome'));
    place(g, coeur, 0, yc, 0);
    const pts = fibonacci(54).map(([x, y, z]) => [x * R * .8, yc + y * R * .8, z * R * .8]);
    billes(g, pts.map(q => [...q, rb]), verreClair(), 18);
    billes(g, pts.map(([x, y, z]) => [x * .92, yc + (y - yc) * .92, z * .92, .02]), M('led:#FFC98A'), 8);
    // douilles : petits cylindres entre l'étoile et chaque bulle
    pts.forEach(([x, y, z]) => boudin(g, [[x * .55, yc + (y - yc) * .55, z * .55], [x * .82, yc + (y - yc) * .82, z * .82]], .006, M('chrome'), { seg: 2, radial: 6, tension: 0 }));
    halo(g, 1.4, 0, yc, 0);
    return g;
  },

  /* Glass Bubble Cluster : platine chromée, deux tiges, nuage ovale de globes en verre fumé et verre clair strié */
  'gbc-light-2418'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l, pr } = geometrieSuspension(p, o);
    const a = clamp(l / 2, .3, .6), c = clamp(pr / 2, .12, .25), b = clamp(hb / 2, .1, .2), yc = -d - b, rg = .052;
    const ch = M('chrome');
    place(g, mesh(new THREE.BoxGeometry(a * 1.15, .02, .07), ch), 0, -.01, 0);
    [-1, 1].forEach(s => cyl(g, .006, .006, d - b * .4, ch, s * a * .45, -d + b * .4, 0, 8));
    place(g, mesh(new THREE.BoxGeometry(a * 1.5, .012, .02), ch), 0, yc, 0);
    const pts = semis(64, a, b, c, rg * 1.75, 2418, .25).map(([x, y, z]) => [x, yc + y, z]);
    billes(g, pts.filter((q, i) => i % 2 === 0).map(q => [...q, rg]), M('fume'), 18);
    billes(g, pts.filter((q, i) => i % 2 === 1).map(q => [...q, rg]), verreClair(), 18);
    billes(g, pts.map(([x, y, z]) => [x, y, z, .013]), M('led:#FFC98A'), 8);
    halo(g, 1.5, 0, yc, 0);
    return g;
  },

  /* Orbital Light : sphère ajourée de tubes LED blancs tressés en spirale, embouts chromés aux pôles */
  'ol-420'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const R = clamp(Math.min(p.dim[0], hb) / 2, .2, .45), yc = -d - R, led = M('led:#FFF4E4');
    rosace(g, .04, M('chrome'));
    cable(g, d - .02, M('noir'));
    for (let k = 0; k < 6; k++) {
      const sens = k % 2 ? 1 : -1, phi = k * TAU / 6, pts = [];
      for (let i = 0; i <= 28; i++) {
        const th = .12 + i / 28 * (Math.PI - .24), lam = phi + sens * 1.5 * (th - Math.PI / 2), rr = R * Math.sin(th);
        pts.push([Math.cos(lam) * rr, yc + R * Math.cos(th), Math.sin(lam) * rr]);
      }
      boudin(g, pts, .014, led, { seg: 90, radial: 8 });
    }
    [1, -1].forEach(s => cyl(g, .028, .02, .03, M('chrome'), 0, yc + s * R * .97 - .015, 0, 16));
    halo(g, 1.6, 0, yc, 0);
    return g;
  },

  /* Orbital Chrome Flow : barre chromée d'où jaillissent des fils chromés en boucles, globes en verre fumé au bout */
  'ocf-light-2422'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l, pr } = geometrieSuspension(p, o);
    const L = clamp(l, .8, 1.6), P = clamp(pr, .2, .4), yc = -d - hb * .5, ch = M('chrome'), r = alea(2422);
    [-1, 1].forEach(s => cable(g, d + hb * .5, ch, s * .12, 0));
    rosace(g, .05, ch);
    place(g, mesh(new THREE.CylinderGeometry(.012, .012, .34, 12), ch), 0, yc, 0, 0, 0, Math.PI / 2);
    const n = 11, globes = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = (t - .5) * L, z = (r() - .5) * P * .8, y = yc + (r() - .5) * hb * .55;
      const x0 = (t - .5) * .3, sens = r() < .5 ? -1 : 1;
      // fil : part de la barre, fait une boucle, rejoint le globe
      const pts = [[x0, yc, 0], [x0 + (x - x0) * .3, yc + .06 * sens, z * .2 + .05 * sens], [x0 + (x - x0) * .5, yc + .1 * sens, z * .6 - .04 * sens], [x0 + (x - x0) * .62, yc - .02 * sens, z * .9], [x0 + (x - x0) * .82, y + .05, z * 1.1], [x, y, z]];
      boudin(g, pts, .0035, ch, { seg: 60, radial: 5 });
      globes.push([x + Math.sign(x || 1) * .03, y, z, .045]);
    }
    billes(g, globes, M('fume'), 20);
    billes(g, globes.map(([x, y, z]) => [x, y, z, .012]), M('led:#FFD8A0'), 8);
    halo(g, 1.6, 0, yc, 0);
    return g;
  },

  /* Branch Crystal : deux pavés de verre givré façon glace, cerclés de laiton, branche de laiton posée dessus, deux tiges */
  'bcl-pend-4207'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l, pr } = geometrieSuspension(p, o);
    const L = clamp(l, .6, 1.4), P = clamp(pr, .1, .2), H = clamp(hb * .7, .08, .14), yb = -d - hb, yh = yb + H;
    const la = M('laiton'), glace = lumineux('albatre', ['#F4ECDF', '#D9C6A8'], '#FFD8A8', .4, 2.2), w = (L - .02) / 2;
    [-1, 1].forEach(s => {
      const x = s * (w / 2 + .01);
      place(g, mesh(new THREE.BoxGeometry(w - .01, H - .008, P - .008), glace), x, yb + H / 2, 0);
      cadre(g, w, H, P, .006, la, x, yb, 0);
      cyl(g, .005, .005, -yh, la, s * L * .22, yh, 0, 8);
      cyl(g, .03, .03, .01, la, s * L * .22, -.01, 0, 20);
    });
    // branche : tige noueuse et rameaux
    const r = alea(4207), yt = yh + .012;
    const tige = geoBoudin([[-L * .42, yt + .02, .01], [-L * .25, yt + .045, -.01], [-L * .05, yt + .015, .015], [L * .15, yt + .035, -.01], [L * .38, yt + .01, .01], [L * .47, yt + .025, 0]], t => .007 - .004 * t, { seg: 80, radial: 8 });
    g.add(mesh(bosseler(tige, .0015, 60, 4207), la));
    for (let i = 0; i < 7; i++) {
      const x = (r() - .5) * L * .8, s = r() < .5 ? -1 : 1;
      boudin(g, [[x, yt + .03, 0], [x + s * .03, yt + .05 + r() * .02, (r() - .5) * .03], [x + s * .07, yt + .045 + r() * .04, (r() - .5) * .04]], t => .004 - .0025 * t, la, { seg: 12, radial: 5 });
    }
    halo(g, 1.3, 0, yb + H / 2, 0);
    return g;
  },

  /* Orbit Halo Globe : deux anneaux de tube noir mat décalés, globes opalins posés dessus, tiges à rosaces coniques et fils fins */
  'ohg-pend-5602'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l, pr } = geometrieSuspension(p, o);
    const a = clamp(l / 2, .35, .7), b = clamp(Math.max(pr / 2, a * .7), .25, .6), y0 = -d - hb + .12, noir = M('noirMat');
    const anneau = (ax, bx, cx, y) => { const pts = []; for (let i = 0; i < 48; i++) { const t = i / 48 * TAU; pts.push([cx + Math.cos(t) * ax, y, Math.sin(t) * bx]); } boudin(g, pts, .009, noir, { ferme: true, seg: 160, radial: 8 }); };
    anneau(a, b, 0, y0);
    anneau(a * .76, b * .74, -a * .14, y0 - .04);
    const globes = [];
    [.2, .9, 1.6, 2.5, 3.3].forEach((t, i) => globes.push([Math.cos(t) * a, y0 + .055 - (i % 2) * .09, Math.sin(t) * b, .065 + (i % 3) * .008]));
    [.6, 2.0, 4.4].forEach((t, i) => globes.push([-a * .14 + Math.cos(t) * a * .76, y0 + .02 - (i % 2) * .09, Math.sin(t) * b * .74, .06]));
    billes(g, globes, opalin(), 20);
    // tiges noires sous rosaces coniques, et fils fins jusqu'aux anneaux
    [[.75, 1], [2.3, .76], [3.9, 1], [5.3, .76]].forEach(([t, k]) => {
      const x = (k < 1 ? -a * .14 : 0) + Math.cos(t) * a * k, z = Math.sin(t) * b * (k < 1 ? .74 : 1), yy = k < 1 ? y0 - .04 : y0;
      cyl(g, .005, .005, -yy, noir, x, yy, z, 8);
      tourne(g, [[0, -.06], [.006, -.058], [.045, -.004], [.045, 0], [0, 0]], noir, x, 0, z, 20);
    });
    [1.2, 2.9, 4.7, 5.9].forEach(t => cable(g, -y0, noir, Math.cos(t) * a, Math.sin(t) * b));
    halo(g, 1.6, 0, y0, 0);
    return g;
  },

  /* Linear Shelf : étagère ovale en métal laqué vert profond, montants verticaux, deux tubes LED, suspentes blanches plates */
  'lsl-pend-3101'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l, pr } = geometrieSuspension(p, o);
    const L = clamp(l, .8, 1.6), P = clamp(pr, .14, .3), H = clamp(hb, .3, .5), vert = M('laque:#1F4A42'), led = M('led:#FFF2DA');
    const ym = -d - H * .55, hm = H * .42;      // plan de l'étagère, demi-hauteur des montants
    panneau(g, formeLisse(Array.from({ length: 24 }, (_, i) => { const t = i / 24 * TAU; return [Math.cos(t) * L / 2, Math.sin(t) * P / 2]; }), 64), .008, vert, 'sol', 0, ym - .004, 0, { a: .002 });
    const montant = (x, y0, y1) => cyl(g, .014, .014, y1 - y0, vert, x, y0, 0, 14);
    const xg = -L * .47, xd = L * .45, xm = -L * .27, xb = L * .2;
    montant(xg, ym - hm, ym + hm); montant(xd, ym - hm, ym + hm);
    montant(xm, ym - .02, ym + hm * .8); montant(xb, ym - hm, ym + .03);
    const tubeLed = (x0, x1, y) => { place(g, mesh(new THREE.CylinderGeometry(.007, .007, x1 - x0 - .06, 10), led), (x0 + x1) / 2, y, 0, 0, 0, Math.PI / 2); [x0 + .022, x1 - .022].forEach(x => place(g, mesh(new THREE.CylinderGeometry(.01, .01, .03, 10), vert), x, y, 0, 0, 0, Math.PI / 2)); };
    tubeLed(xm, xd, ym + hm * .62);
    tubeLed(xg, xb, ym - hm * .72);
    // suspentes : rubans blancs vrillés
    [xg, xd].forEach((x, i) => boudin(g, [[x, 0, 0], [x + (i ? .01 : -.01), (ym + hm) * .5, 0], [x, ym + hm, 0]], .006, M('blanc'), { kv: .25, seg: 30, radial: 6, haut: [0, 0, 1] }));
    halo(g, 1.4, 0, ym, 0);
    return g;
  },

  /* Linear Gold Balance : longue barre noire fine tenue par une tige et un fil, cylindres dorés suspendus dessous et posés dessus */
  'lgb-light-2416'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l } = geometrieSuspension(p, o);
    const L = clamp(l, .8, 1.6), noir = M('noir'), or = M('or'), yb = -d - Math.min(hb, .3) + .12, xr = L * .22;
    place(g, mesh(new THREE.BoxGeometry(L, .012, .018), noir), 0, yb, 0);
    cyl(g, .006, .006, -yb, noir, xr, yb, 0, 8);
    cyl(g, .06, .06, .012, noir, xr, -.012, 0, 24);
    cable(g, -yb, noir, -L * .2, 0);
    cyl(g, .012, .012, .02, noir, -L * .2, -.02, 0, 10);
    place(g, mesh(new THREE.BoxGeometry(.04, .016, .022), or), xr, yb, 0);
    const cylOr = (x, y) => { cyl(g, .028, .028, .1, or, x, y, 0, 24); cyl(g, .022, .022, .002, M('led:#FFE2B0'), x, y - .001, 0, 16); };
    [-L * .4, -L * .27, -L * .14].forEach(x => { cyl(g, .003, .003, .015, noir, x, yb - .015, 0, 6); cylOr(x, yb - .115); });
    cyl(g, .005, .005, .05, noir, xr, yb - .05, 0, 8); cylOr(xr, yb - .15);
    cylOr(L * .4, yb + .006);
    halo(g, 1.3, 0, yb - .06, 0);
    return g;
  },

  /* Abstract Lines Gold : rosace ronde noire, deux tiges, trois longues barres noires croisées à des hauteurs différentes, cylindres dorés */
  'alg-light-2417'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l, pr } = geometrieSuspension(p, o);
    const L = clamp(l, .8, 1.5), P = clamp(pr, .4, 1), noir = M('noir'), or = M('or'), y0 = -d - .1;
    cyl(g, .07, .07, .014, noir, 0, -.014, 0, 28);
    [-.03, .03].forEach(x => cyl(g, .005, .005, -y0 + .08, noir, x, y0 - .08, 0, 8));
    const barres = [[-.5, -.3, .5, .32, 0], [-.48, .34, .46, -.28, -.05], [-.55, .05, .55, .12, -.1]];
    barres.forEach(([x0, z0, x1, z1, dy]) => {
      const A = V3(x0 * L, y0 + dy, z0 * P), B = V3(x1 * L, y0 + dy, z1 * P), m = A.clone().add(B).multiplyScalar(.5), lg = A.distanceTo(B);
      const bar = place(g, mesh(new THREE.CylinderGeometry(.005, .005, lg, 8), noir), m.x, m.y, m.z);
      bar.rotation.set(0, -Math.atan2(B.z - A.z, B.x - A.x), Math.PI / 2, 'YXZ');
      place(g, mesh(new THREE.BoxGeometry(.03, .012, .014), or), m.x, m.y, m.z, -Math.atan2(B.z - A.z, B.x - A.x));
      cable(g, -(y0 + dy), noir, A.x, A.z);
      [.18, .42, .8].forEach((t, i) => {
        const x = lerp(A.x, B.x, t), z = lerp(A.z, B.z, t), y = y0 + dy, haut = (i + barres.indexOf(barres.find(q => q[4] === dy))) % 3 === 0;
        cyl(g, .025, .025, .1, or, x, haut ? y + .005 : y - .105, z, 20);
      });
    });
    halo(g, 1.5, 0, y0 - .1, 0);
    return g;
  },

  /* Bloom Crystal Lotus : corolle de pétales de verre strié translucide, rayonnant d'un cœur doré, rosace chromée et trois filins */
  'bcl-crys-7712'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const R = clamp(p.dim[0] / 2, .25, .5), H = clamp(hb, .3, .55), yc = -d - H * .78;
    cyl(g, .1, .1, .03, M('chrome'), 0, -.03, 0, 32);
    [0, 1, 2].forEach(k => cable(g, -yc - .05, M('chrome'), Math.cos(k * TAU / 3) * .05, Math.sin(k * TAU / 3) * .05));
    sphere(g, .05, M('or'), 0, yc, 0, 1, .7, 1, 18);
    // pétale : fuseau tourné à côtes (stries de verre)
    const prof = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; prof.push([.03 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), .7) * (1 + .14 * Math.sin(t * 46)) + .0005, t]); }
    const geo = new THREE.LatheGeometry(prof.map(q => new THREE.Vector2(q[0], q[1])), 8);
    const liste = [], r = alea(7712);
    [[82, 9, .7], [68, 14, .8], [54, 19, .9], [40, 24, 1], [26, 28, 1], [12, 32, .95], [-2, 34, .9], [-14, 30, .8]].forEach(([el, n, k], j) => {
      for (let i = 0; i < n; i++) {
        const az = (i + (j % 2) * .5) / n * TAU + r() * .1, e = (el + (r() - .5) * 6) * Math.PI / 180;
        const dx = Math.cos(e) * Math.cos(az), dy = Math.sin(e), dz = Math.cos(e) * Math.sin(az), lg = R * .78 * k;
        liste.push([dx * .04, yc + dy * .03, dz * .04, 0, -az, -(Math.PI / 2 - e), 1, 1, lg, 1]);
      }
    });
    instances(g, geo, verreStrie(), liste);
    halo(g, 1.4, 0, yc + .1, 0);
    return g;
  },

  /* Ribbon Wave : grand ruban d'acrylique nervuré qui boucle dans l'espace, bords lumineux, trois filins */
  'rfg-wave-8821'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l, pr } = geometrieSuspension(p, o);
    const L = clamp(l, 1, 2.2), P = clamp(pr, .5, 1.2), H = clamp(hb, .3, .6), y0 = -d;
    const pts = [[-.48, -.45, .1], [-.32, -.25, .4], [-.08, -.35, .32], [.02, -.62, 0], [-.14, -.55, -.32], [.1, -.3, -.42], [.3, -.15, -.25], [.46, -.3, .08], [.32, -.55, .32], [.14, -.7, .15]].map(([x, y, z]) => V3(x * L, y0 + y * H, z * P));
    const C = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), w = .22, n = 240;
    const cadre = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, c = C.getPointAt(u), t = C.getTangentAt(u), haut = V3(0, 1, 0);
      const b = haut.clone().sub(t.clone().multiplyScalar(haut.dot(t))).normalize().applyAxisAngle(t, .9 * Math.sin(u * Math.PI * 3));
      cadre.push([c, b]);
    }
    const f = (u, v) => { const [c, b] = cadre[Math.round(u * n)]; const s = (v - .5) * w; return [c.x + b.x * s, c.y + b.y * s, c.z + b.z * s]; };
    g.add(mesh(geoSurface(f, n, 6), voileStrie(), false));
    [0, 1].forEach(v => boudin(g, cadre.filter((q, i) => i % 3 === 0).map((q, i) => f(i * 3 / n, v)), .006, M('led:#FFD9A0'), { seg: 200, radial: 5 }));
    [-.3, .05, .35].forEach(x => cable(g, d + H * .35, M('chrome'), x * L, (x > 0 ? -.2 : .2) * P));
    halo(g, 2, 0, y0 - H * .4, 0);
    return g;
  },

  /* Atomic Pop : sputnik en laiton, dix-huit bras terminés par des cônes laqués de couleurs et des ampoules globe */
  'spp-18c'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const R = clamp(p.dim[0] / 2, .3, .5), yc = -d - Math.min(hb, R * 1.6) / 2, la = M('laiton');
    cyl(g, .045, .045, .015, la, 0, -.015, 0, 20);
    cyl(g, .007, .007, -yc - .03, la, 0, yc + .03, 0, 10);
    sphere(g, .04, la, 0, yc, 0, 1, 1, 1, 18);
    const tons = ['#C8362A', '#E8B030', '#3E7A4A', '#6A7078', '#2A2A2E', '#F0EEE8', '#5A6A8A'];
    const dirs = fibonacci(22).filter(([x, y]) => y < .82).slice(0, 18);
    const cone = new THREE.CylinderGeometry(.03, .012, .09, 16, 1, true), bras = new THREE.CylinderGeometry(.0045, .0045, 1, 8);
    const parTon = tons.map(() => []), brasL = [], ampoules = [];
    dirs.forEach(([x, y, z], i) => {
      const e = Math.asin(y), az = Math.atan2(z, x), rot = [0, -az, -(Math.PI / 2 - e)], lg = R - .1;
      brasL.push([x * lg / 2, yc + y * lg / 2, z * lg / 2, ...rot, 1, 1, lg, 1]);
      parTon[i % tons.length].push([x * (lg + .04), yc + y * (lg + .04), z * (lg + .04), ...rot]);
      ampoules.push([x * (lg + .1), yc + y * (lg + .1), z * (lg + .1), .026]);
    });
    instances(g, bras, la, brasL);
    tons.forEach((t, k) => parTon[k].length && instances(g, cone, M('laque:' + t), parTon[k]));
    billes(g, ampoules, opalin(), 14);
    halo(g, 1.6, 0, yc, 0);
    return g;
  },

  /* Cloud Cluster : faisceau de cordons noirs tombant d'une rosace et s'écartant en couronne, deux rangs de globes opalins cerclés de noir */
  'ccl-orb-24'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const R = clamp(p.dim[0] / 2, .22, .45), rg = R * .17, yA = -d - hb + rg * 2.6, noir = M('noir');
    rosace(g, .07, noir);
    const globes = [];
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU; globes.push([Math.cos(a) * R * .86, yA, Math.sin(a) * R * .86]); }
    for (let i = 0; i < 11; i++) { const a = (i + .5) / 11 * TAU; globes.push([Math.cos(a) * R * .68, yA - rg * 1.3, Math.sin(a) * R * .68]); }
    globes.forEach(([x, y, z], i) => {
      const k = .06 + (i % 5) * .012;
      boudin(g, [[x * k * .5, -.03, z * k * .5], [x * .1, -d * .75, z * .1], [x * .45, y + rg * 4, z * .45], [x * .9, y + rg * 1.9, z * .9], [x, y + rg * 1.02, z]], .0022, noir, { seg: 40, radial: 5, bouts: false });
      tore(g, rg * 1.02, .0035, noir, x, y, z);
    });
    billes(g, globes.map(q => [...q, rg]), opalin(), 20);
    halo(g, 1.5, 0, yA, 0);
    return g;
  },

  /* Atomic Grid : faisceau de fines tiges chromées rayonnant d'un moyeu, trois couronnes étagées de petits cylindres lumineux */
  'agc-struct-9186'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const R = clamp(p.dim[0] / 2, .25, .5), H = clamp(hb, .3, .6), yh = -d, ch = M('chrome');
    rosace(g, .04, ch);
    cable(g, d, ch);
    tore(g, .06, .004, ch, 0, yh, 0); tore(g, .06, .003, ch, 0, yh - H * .32, 0);
    const tiges = [], leds = [], tige = new THREE.CylinderGeometry(.0013, .0013, 1, 5);
    [[.58, .6], [.8, .74], [1, .88]].forEach(([kr, kh], t) => {
      const r = R * kr, y = yh - H * kh, n = 14 + t * 4;
      tore(g, r, .0025, ch, 0, y, 0, Math.PI / 2, TAU, 96);
      for (let i = 0; i < n; i++) {
        const a = (i + t * .33) / n * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r;
        [[V3(Math.cos(a) * .06, yh - H * .32, Math.sin(a) * .06), V3(x, y, z)], [V3(Math.cos(a) * .06, yh, Math.sin(a) * .06), V3(Math.cos(a) * .06, yh - H * .32, Math.sin(a) * .06)]].forEach(([A, B]) => {
          const dir = B.clone().sub(A), lg = dir.length(); dir.normalize();
          const e = Math.asin(dir.y), az = Math.atan2(dir.z, dir.x), m = A.clone().add(B).multiplyScalar(.5);
          tiges.push([m.x, m.y, m.z, 0, -az, -(Math.PI / 2 - e), 1, 1, lg, 1]);
        });
        leds.push([x, y + .028, z]);
      }
    });
    instances(g, tige, ch, tiges);
    instances(g, new THREE.CylinderGeometry(.013, .013, .06, 10), M('led:#FFEACC'), leds);
    halo(g, 1.6, 0, yh - H * .7, 0);
    return g;
  },

  /* Loop Tube Linear : barre chromée horizontale, cinq tubes laqués grège pliés en U par-dessus, une ampoule au bout de chaque jambe */
  'ltl-arc-5592'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l } = geometrieSuspension(p, o);
    const L = clamp(l, .6, 1.4), ch = M('chrome'), greige = M('laque:#BDB6AA'), yb = -d - hb + .17;
    place(g, mesh(new THREE.CylinderGeometry(.011, .011, L, 14), ch), 0, yb, 0, 0, 0, Math.PI / 2);
    [-1, 1].forEach(s => { cyl(g, .0015, .0015, -yb - .08, ch, s * L * .3, yb + .08, 0, 5); cyl(g, .006, .006, .08, ch, s * L * .3, yb, 0, 8); });
    const ampoules = [], n = 5, a = .042, phi = Math.PI / 2 - .7, ux = Math.cos(phi), uz = Math.sin(phi);
    for (let i = 0; i < n; i++) {
      const x0 = (i / (n - 1) - .5) * L * .86, h1 = .1 + (i % 2) * .02, h2 = .14 - (i % 2) * .02, pts = [];
      pts.push([-a, -h1]);
      for (let k = 0; k <= 8; k++) { const t = Math.PI - k / 8 * Math.PI; pts.push([Math.cos(t) * a, Math.sin(t) * a]); }
      pts.push([a, -h2]);
      boudin(g, pts.map(([u, y]) => [x0 + u * ux, yb + y, u * uz]), .017, greige, { seg: 50, radial: 12, tension: .3 });
      ampoules.push([x0 - a * ux, yb - h1 - .03, -a * uz, .026], [x0 + a * ux, yb - h2 - .03, a * uz, .026]);
    }
    billes(g, ampoules, opalin(), 16);
    halo(g, 1.4, 0, yb - .1, 0);
    return g;
  },

  /* Halo Layers : quatre anneaux étagés de plus en plus petits, cerclés de laiton rosé et habillés de plaquettes d'acrylique givré */
  'hl-led-4587'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const R = clamp(p.dim[0] / 2, .3, .6), H = clamp(hb, .3, .6), y0 = -d, rose = M('bronze'), acryl = abat('#F3EDE3', '#FFE6C2', .35, 2.2);
    const r = alea(4587), plaques = [];
    [1, .8, .62, .46].forEach((k, j) => {
      const rr = R * k, y = y0 - .03 - j * H / 4;
      tore(g, rr, .005, rose, 0, y, 0, Math.PI / 2, TAU, 120);
      const n = Math.round(TAU * rr / .13);
      for (let i = 0; i < n; i++) {
        const a = (i + r() * .4) / n * TAU, lg = .07 + r() * .12, h = .035 + r() * .03, dy = (r() - .5) * .025;
        plaques.push([Math.cos(a) * (rr + .008), y + dy, Math.sin(a) * (rr + .008), 0, -a + Math.PI / 2, 0, 1, lg, h, .006]);
      }
      for (let i = 0; i < 3; i++) { const a = (i + j * .33) / 3 * TAU; cyl(g, .0015, .0015, -y, M('noir'), Math.cos(a) * rr, y, Math.sin(a) * rr, 5); }
    });
    instances(g, new THREE.BoxGeometry(1, 1, 1), acryl, plaques);
    halo(g, 1.7, 0, y0 - H * .4, 0);
    return g;
  },

  /* Spiral Crystal : grand disque noir au plafond, deux rubans de cristal strié qui s'enroulent en double hélice en se resserrant */
  'spc-lux-xl'(p, o = {}) {
    const g = groupe('suspension');
    const { hb } = geometrieSuspension(p, o);
    const R = clamp(p.dim[0] / 2, .2, .4), H = clamp(hb, .5, 1.2);
    cyl(g, R * .85, R * .85, .03, M('noir'), 0, -.03, 0, 48);
    tore(g, R * .85, .004, M('or'), 0, -.03, 0, Math.PI / 2, TAU, 96);
    [0, Math.PI].forEach(a0 => {
      const n = 160, cadre = [];
      const C = t => { const th = a0 + t * TAU * 1.7, rr = R * (.72 - .58 * t); return V3(Math.cos(th) * rr, -.04 - t * H, Math.sin(th) * rr); };
      for (let i = 0; i <= n; i++) {
        const t = i / n, c = C(t), tg = C(Math.min(1, t + .002)).sub(C(Math.max(0, t - .002))).normalize(), haut = V3(0, 1, 0);
        const b = haut.clone().sub(tg.clone().multiplyScalar(haut.dot(tg))).normalize().applyAxisAngle(tg, 1.1 + t * 4);
        cadre.push([c, b, .07 * (1 - .45 * t)]);
      }
      const f = (u, v) => { const [c, b, w] = cadre[Math.round(u * n)], s = (v - .5) * w; return [c.x + b.x * s, c.y + b.y * s, c.z + b.z * s]; };
      g.add(mesh(geoSurface(f, n, 4), verreStrie(true), false));
      [0, 1].forEach(v => boudin(g, Array.from({ length: 41 }, (_, i) => f(i / 40, v)), .0035, M('led:#FFE6BC'), { seg: 160, radial: 4 }));
    });
    halo(g, 1.6, 0, -H * .45, 0);
    return g;
  },

  /* Leaf Crystal Bloom : bouquet de grandes feuilles de verre nervuré translucide autour d'un cœur doré à ampoules */
  'lcb-pend-6812'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const R = clamp(p.dim[0] / 2, .25, .45), yc = -d - Math.min(hb, R * 1.2) * .55, or = M('or');
    cyl(g, .045, .045, .015, or, 0, -.015, 0, 20);
    cyl(g, .008, .008, -yc - .03, or, 0, yc + .03, 0, 10);
    sphere(g, .055, or, 0, yc, 0, 1, .9, 1, 20);
    const lg = R * .82, w = lg * .42, r = alea(6812), geos = [], ampoules = [];
    const base = geoSurface((u, v) => { const s = (u - .5) * 2, larg = w / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.04)), .75); return [s * larg, v * lg, .06 * lg * v * v + .12 * w * s * s]; }, 8, 24);
    fibonacci(17).forEach(([x, y, z], i) => {
      const dir = V3(x, y * .8 - .1, z).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), r() * TAU));
      const m = new THREE.Matrix4().compose(V3(dir.x * .05, yc + dir.y * .05, dir.z * .05), q, V3(1, .85 + r() * .3, 1));
      geos.push(base.clone().applyMatrix4(m));
      if (i % 2 === 0) ampoules.push([dir.x * .075, yc + dir.y * .075, dir.z * .075, .022]);
    });
    g.add(mesh(mergeGeometries(geos), feuilleVerre(), false));
    billes(g, ampoules, opalin(), 14);
    halo(g, 1.5, 0, yc, 0);
    return g;
  },

  /* Ribbon Cloud : long fuseau de feuilles d'acrylique blanc enroulées et torsadées autour d'un axe, lumière diffuse */
  'sus-rcl-27'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l, pr } = geometrieSuspension(p, o);
    const L = clamp(l, .8, 1.8), R = clamp(Math.max(pr, hb) / 2, .1, .18), yc = -d - R, r = alea(27), blanc = abat('#F4F1EB', '#FFF0D8', .42, 2.4);
    [-1, 1].forEach(s => cable(g, d + R * .3, M('alu'), s * L * .3, 0));
    for (let i = 0; i < 13; i++) {
      const xm = (i / 12 - .5) * L * .9, lx = L * (.12 + r() * .1), a0 = r() * TAU, span = 3.6 + r() * 1.6, tw = (r() - .5) * 2.2, k = Math.sin(Math.PI * clamp((xm + L / 2) / L, .05, .95));
      const rr = R * (.45 + .55 * k) * (.85 + r() * .3);
      g.add(mesh(geoSurface((u, v) => { const x = xm + (u - .5) * lx, a = a0 + v * span + tw * u, q = rr * (1 + .08 * v) * (1 - .25 * Math.pow(2 * u - 1, 2)); return [x, yc + Math.cos(a) * q, Math.sin(a) * q]; }, 10, 24), blanc, false));
    }
    halo(g, 1.6, 0, yc, 0);
    return g;
  },

  /* Énergie Filaire : tubes d'aluminium blanc mat suspendus à des hauteurs différentes, un câble rouge serpente entre eux */
  'sef-cont-18'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const A = clamp(p.dim[0] / 2, .2, .45), H = clamp(hb, .3, .7), r = alea(18), blanc = M('laque:#EEECE8'), tops = [];
    for (let i = 0; i < 13; i++) {
      const x = (r() * 2 - 1) * A, z = (r() * 2 - 1) * A * .8, lt = .14 + r() * .18, yt = -d - r() * (H - lt) * .7;
      cyl(g, .0015, .0015, -yt, M('laque:#D6D6D2'), x, yt, z, 5);
      cyl(g, .018, .018, lt, blanc, x, yt - lt, z, 16);
      cyl(g, .014, .014, .002, M('led:#FFF2DC'), x, yt - lt - .001, z, 12);
      tops.push([x, yt, z]);
    }
    // câble rouge : passe d'un tube à l'autre en boucles lâches
    const pts = [[0, 0, 0], [0, -d * .7, 0]];
    tops.slice().sort((a, b) => Math.atan2(a[2], a[0]) - Math.atan2(b[2], b[0])).forEach(([x, y, z]) => {
      pts.push([x + (r() - .5) * .12, -d + .06 + (r() - .5) * .08, z + (r() - .5) * .12]);
      pts.push([x, y + .015, z]);
    });
    boudin(g, pts, .003, M('laque:#B8322A'), { seg: 400, radial: 5 });
    halo(g, 1.3, 0, -d - H * .5, 0);
    return g;
  },

  /* Ribbon Flow : rubans de métal doré satiné tombant de deux fentes lumineuses du plafond, boucles imbriquées */
  'sus-rib-09'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const H = clamp(d + hb, .6, 2.6), xa = clamp(p.dim[0] / 4, .1, .2), or = M('laiton');
    [-1, 1].forEach(s => { place(g, mesh(new THREE.BoxGeometry(.07, .012, .03), M('noir')), s * xa, -.006, 0); place(g, mesh(new THREE.BoxGeometry(.06, .002, .02), M('led:#FFE2B0')), s * xa, -.013, 0); });
    [[.48, .25, 1.2], [.74, -.35, 1.05], [1, .12, .9]].forEach(([k, rot, ouv]) => {
      const n = V3(Math.sin(rot), 0, Math.cos(rot)), u = V3(Math.cos(rot), 0, -Math.sin(rot)), pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, a = (t - .5) * Math.PI, x = Math.sin(a) * xa * ouv * (1 + .35 * Math.cos(a)), y = -H * k * Math.pow(Math.cos(a), .9) - .012;
        pts.push([u.x * x, Math.min(-.012, y), u.z * x]);
      }
      boudin(g, pts, .0025, or, { haut: [n.x, 0, n.z], kv: 12, seg: 120, radial: 10 });
    });
    halo(g, 1, 0, -.1, 0);
    return g;
  },

  /* Spirale Cristal : deux pales de verre craquelé enroulées en hélice autour d'un axe, bords en métal sombre, rayons fins au centre */
  'spc-art-07'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const R = clamp(p.dim[0] / 2, .12, .3), H = clamp(hb, .3, .8), yh = -d, bord = M('bronze');
    cable(g, d, M('noir'));
    cyl(g, .004, .004, H, M('noir'), 0, yh - H, 0, 6);
    [0, Math.PI].forEach(a0 => {
      const rr = u => R * Math.pow(Math.sin(Math.PI * clamp(u, .02, .98)), .75), th = u => a0 + u * TAU * 1.25;
      const f = (u, v) => { const a = th(u), r = rr(u) * (.08 + .92 * v); return [Math.cos(a) * r, yh - u * H, Math.sin(a) * r]; };
      g.add(mesh(geoSurface(f, 90, 6), verreStrie(true), false));
      boudin(g, Array.from({ length: 61 }, (_, i) => f(i / 60, 1)), .003, bord, { seg: 180, radial: 5 });
    });
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, y = yh - H * .5; boudin(g, [[0, y, 0], [Math.cos(a) * R * .8, y + .01, Math.sin(a) * R * .8]], .0008, M('chrome'), { seg: 2, radial: 4, tension: 0 }); }
    halo(g, 1.2, 0, yh - H / 2, 0);
    return g;
  },

  /* Orbit Halo : grand disque blanc sous le plafond, tige centrale et deux anneaux plats décentrés à LED */
  'sus-orb-08'(p, o = {}) {
    const g = groupe('suspension');
    const { hb } = geometrieSuspension(p, o);
    const R = clamp(p.dim[0] / 2, .18, .35), H = clamp(hb, .22, .5), blanc = M('laque:#E8E5DE'), led = M('led:#FFF0D8');
    cyl(g, .045, .045, .05, blanc, 0, -.05, 0, 24);
    cyl(g, R, R * .985, .008, blanc, 0, -.07, 0, 64);
    cyl(g, R * .9, R * .9, .001, M('opale:#FFF0DC'), 0, -.0715, 0, 48);
    cyl(g, .006, .006, H - .07, blanc, 0, -H, 0, 10);
    [[-.42, .55, 0], [-.78, -.5, 1.9]].forEach(([k, dx, a]) => {
      const y = -H * -k, re = R * .38, ri = re * .58, cx = Math.cos(a) * dx * re * .75, cz = Math.sin(a) * dx * re * .75;
      tourne(g, [[ri, 0], [re, 0], [re, .016], [ri, .016], [ri, 0]], blanc, cx, y, cz, 48);
      tourne(g, [[ri + .006, .0165], [re - .006, .0165], [re - .006, .017], [ri + .006, .017]], led, cx, y, cz, 48);
    });
    halo(g, 1.1, 0, -H * .5, 0);
    return g;
  },

  /* Orbit Beads : trois tiges de laiton, œuf opalin entre deux croissants opalins, rotules et colonnes de perles de laiton */
  'sus-orb-12'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const H = clamp(hb, .3, .5), la = M('laiton'), op = opalin('#F4EEE4'), yj = -d - H * .3, rb = .028, xs = .1;
    cyl(g, .05, .05, .012, la, 0, -.012, 0, 20);
    [-xs, 0, xs].forEach((x, i) => {
      const ybas = i === 1 ? yj - .13 : yj;
      cyl(g, .006, .006, -ybas, la, x, ybas, 0, 10);
      if (i !== 1) sphere(g, .03, la, x, yj, 0, 1, 1, 1, 16);
      for (let k = 0; k < 3; k++) sphere(g, rb, la, x, yj - .16 - k * rb * 1.95 - (i === 1 ? .03 : 0), 0, 1, 1, 1, 16);
      cyl(g, .004, .004, .2, la, x, yj - .22, 0, 6);
    });
    sphere(g, .052, op, 0, yj - .055, 0, 1, 1.45, 1, 24);
    [-1, 1].forEach(s => {
      const c = place(g, mesh(new THREE.TorusGeometry(.058, .03, 14, 28, Math.PI * 1.15), op), s * (xs + .01), yj - .07, 0);
      c.rotation.z = s > 0 ? -Math.PI * .575 : Math.PI * .425;
      c.scale.set(1, 1.15, .8);
    });
    halo(g, 1, 0, yj - .06, 0);
    return g;
  },

  /* Libellule Arc : barre chromée au plafond, deux filins, longue tige chromée en arc recourbé portant des ailes de verre texturé */
  'lba-des-12'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d, l } = geometrieSuspension(p, o);
    const L = clamp(l, .8, 1.6), H = clamp(hb, .3, .9), y0 = -d - H * .55, ch = M('chrome');
    place(g, mesh(new THREE.BoxGeometry(L * .65, .035, .05), ch), 0, -.0175, 0);
    place(g, mesh(new THREE.BoxGeometry(L * .6, .002, .03), M('led:#FFF2DC')), 0, -.036, 0);
    const C = new THREE.CatmullRomCurve3([[-.47, .12, 0], [-.3, .03, .04], [-.05, -.02, .05], [.18, 0, .03], [.36, .07, -.02], [.42, .17, -.03], [.36, .25, .01], [.26, .22, .03]].map(([x, y, z]) => V3(x * L, y0 + y * H, z * L)));
    boudin(g, C.getPoints(80).map(v => [v.x, v.y, v.z]), .0045, ch, { seg: 160, radial: 6 });
    [-.25, .28].forEach(x => cable(g, -(y0 + .02), ch, x * L, 0));
    const r = alea(12), ailes = [];
    for (let i = 0; i < 17; i++) {
      const v = C.getPointAt(.04 + i / 17 * .92), t = C.getTangentAt(.04 + i / 17 * .92);
      ailes.push([v.x, v.y + .012, v.z, (r() - .5) * 1.2, Math.atan2(-t.z, t.x) + (r() - .5) * .8, Math.PI / 2 + (r() - .5) * .9, 1, .034 + r() * .012, .004, .05 + r() * .02]);
    }
    instances(g, new THREE.CylinderGeometry(1, 1, 1, 18), verreStrie(), ailes);
    halo(g, 1.4, 0, y0, 0);
    return g;
  },

  /* Nuage Floral : grand nuage aplati de pétales de PVC translucide blanc pliés, lumière diffuse au cœur */
  'snf-des-21'(p, o = {}) {
    const g = groupe('suspension');
    const { hb, d } = geometrieSuspension(p, o);
    const A = clamp(p.dim[0] / 2, .3, .55), B = clamp(hb / 2, .12, .25), yc = -d - B, r = alea(21);
    [-1, 1].forEach(s => cable(g, d + B * .3, M('alu'), s * A * .35, 0));
    const lp = A * .32, wp = lp * .62;
    const base = geoSurface((u, v) => { const s = (u - .5) * 2, larg = wp / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.02)), .6); return [s * larg, v * lp, .22 * wp * s * s - .1 * lp * v * v + .05 * lp * Math.sin(v * 7 + s * 2)]; }, 8, 12);
    const geos = [];
    fibonacci(150).forEach(([x, y, z]) => {
      const pos = V3(x * A * .8, yc + y * B * .85, z * A * .8), nrm = V3(x / A, y / B, z / A).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), nrm).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), r() * TAU));
      geos.push(base.clone().applyMatrix4(new THREE.Matrix4().compose(pos, q, V3(1, 1, 1).multiplyScalar(.85 + r() * .35))));
    });
    g.add(mesh(mergeGeometries(geos), abat('#F7F5F1', '#FFF4E4', .45, 2.4), false));
    sphere(g, B * .6, M('opale:#FFF0DC'), 0, yc, 0, A / B, 1, A / B, 24);
    halo(g, 1.8, 0, yc, 0);
    return g;
  },

  /* Spiral Crystal Grand : grande platine chromée, tambours de pampilles de cristal cerclés de chrome, empilés en spirale (fins en haut et en bas) */
  'scg-light-2409'(p, o = {}) {
    const g = groupe('lustre');
    const { H, d, L } = geometrieLustre(p, o);
    const R = clamp(L / 2, .3, .7), ch = M('chrome'), fils = matFils('#EEF1F6', '#FFF4E2'), n = 8, ht = H / n * .78;
    cyl(g, R * .95, R * .95, .035, ch, 0, -.035, 0, 64);
    for (let k = 0; k < n; k++) {
      const t = (k + .5) / n, r = R * (.32 + .68 * Math.pow(Math.sin(Math.PI * clamp(t * 1.25, .08, 1)), .8)), a = k * 1.1, ox = Math.cos(a) * R * .08, oz = Math.sin(a) * R * .08;
      const yh = -d - .05 - k * H / n;
      place(g, mesh(new THREE.CylinderGeometry(r, r, ht, 56, 1, true), fils, false), ox, yh - ht / 2, oz);
      tore(g, r, .006, ch, ox, yh, oz, Math.PI / 2, TAU, 96);
      tore(g, r * .98, .004, ch, ox, yh - ht, oz, Math.PI / 2, TAU, 96);
      [0, 1, 2].forEach(q => { const b = q * TAU / 3 + k; cyl(g, .0012, .0012, -yh - .035, ch, ox + Math.cos(b) * r, yh, oz + Math.sin(b) * r, 4); });
    }
    halo(g, 2.2, 0, -d - H * .4, 0);
    return g;
  },

  /* Floral Cascade : grande platine blanche à spots, couronne de fleurs de verre opalin sur anneau de laiton, pluie de pétales de verre clair et dorés */
  'fgc-light-2420'(p, o = {}) {
    const g = groupe('lustre');
    const { H, d, L } = geometrieLustre(p, o);
    const R = clamp(L / 2, .3, .6), la = M('laiton'), blanc = abat('#E6E2DA', '#FFF2E0', .14, 2.2), r = alea(2420), yc = -d - H * .3;
    cyl(g, R, R, .05, M('blanc'), 0, -.05, 0, 64);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; cyl(g, .025, .025, .002, M('led:#FFF2DC'), Math.cos(a) * R * .55, -.052, Math.sin(a) * R * .55, 12); }
    tore(g, R * .8, .007, la, 0, yc, 0, Math.PI / 2, TAU, 96);
    tore(g, R * .62, .006, la, 0, yc - .03, 0, Math.PI / 2, TAU, 96);
    [0, 1, 2, 3].forEach(k => { const a = k * TAU / 4 + .4; cyl(g, .0012, .0012, -yc - .05, M('alu'), Math.cos(a) * R * .8, yc, Math.sin(a) * R * .8, 4); });
    // fleurs : cinq pétales en coupe autour d'une ampoule
    const petale = geoSurface((u, v) => { const s = (u - .5) * 2, larg = .055 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05)), .6); return [s * larg, v * .11, .03 * s * s + .03 * v * v]; }, 8, 10);
    const geos = [], fleurs = [];
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + r() * .1, rr = R * (i % 2 ? .8 : .66), y = yc + (i % 2 ? .015 : -.02) + (r() - .5) * .03; fleurs.push([Math.cos(a) * rr, y, Math.sin(a) * rr]); }
    fleurs.forEach(([x, y, z]) => {
      const axe = V3((r() - .5) * .6, 1, (r() - .5) * .6).normalize();
      for (let k = 0; k < 5; k++) {
        const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(0, .35, 1).normalize());
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), k / 5 * TAU + r() * .3));
        q.premultiply(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), axe));
        geos.push(petale.clone().applyMatrix4(new THREE.Matrix4().compose(V3(x, y, z), q, V3(1, 1, 1))));
      }
    });
    g.add(mesh(mergeGeometries(geos), blanc, false));
    billes(g, fleurs.map(([x, y, z]) => [x, y + .02, z, .018]), M('led:#FFE8C8'), 10);
    // pluie de pétales : verre clair et feuilles d'or sur fils invisibles
    const clairs = [], ors = [];
    for (let i = 0; i < 64; i++) {
      const a = r() * TAU, rr = Math.sqrt(r()) * R * .7, y = yc - .08 - r() * (H * .7 - .08);
      (i % 3 ? clairs : ors).push([Math.cos(a) * rr, y, Math.sin(a) * rr, r() * 3, r() * 3, r() * 3, 1, .035, .006, .02]);
    }
    instances(g, new THREE.SphereGeometry(1, 10, 8), verreStrie(), clairs);
    instances(g, new THREE.SphereGeometry(1, 10, 8), M('or'), ors);
    halo(g, 2, 0, yc, 0);
    return g;
  },

  /* Crystal Rings Prestige : rosace dorée, quatre anneaux ouverts de prismes de cristal sertis d'or, étagés et légèrement inclinés */
  'crp-light-2408'(p, o = {}) {
    const g = groupe('lustre');
    const { H, d, L } = geometrieLustre(p, o);
    const R = clamp(L / 2, .25, .6), or = M('or'), r = alea(2408), n = 4;
    cyl(g, .12, .12, .03, or, 0, -.03, 0, 32);
    for (let k = 0; k < n; k++) {
      const rr = R * (1 - k * .17), y = -d - .15 - k * (H - .2) / (n - .5), anneau = groupe(), ouv = .55, a0 = r() * TAU;
      anneau.position.set((r() - .5) * .06, y, (r() - .5) * .06); anneau.rotation.set((r() - .5) * .16, 0, (r() - .5) * .16); g.add(anneau);
      [.03, -.03].forEach(dy => { const t = tore(anneau, rr, .006, or, 0, dy, 0, Math.PI / 2, TAU - ouv, 96); t.rotation.z = a0; });
      const prismes = [], m = Math.round((TAU - ouv) * rr / .028);
      for (let i = 0; i < m; i++) { const a = a0 + (i + .5) / m * (TAU - ouv); prismes.push([Math.cos(a) * rr, 0, Math.sin(a) * rr, 0, -a, 0, 1, .02, .055, .022]); }
      instances(anneau, new THREE.BoxGeometry(1, 1, 1), M('cristal'), prismes);
      [0, 1, 2].forEach(q => { const a = q * TAU / 3 + k * .5; cyl(g, .001, .001, -y - .03, M('alu'), Math.cos(a) * rr * .98, y, Math.sin(a) * rr * .98, 4); });
    }
    halo(g, 1.8, 0, -d - H * .45, 0);
    return g;
  },

  /* Crystal Matrix Cube : plafonnier monumental, damier de filins portant des plaques de verre gravé et des cubes opalins, plus long au centre */
  'cmc-light-2413'(p, o = {}) {
    const g = groupe('lustre');
    const { H, d, L, P } = geometrieLustre(p, o);
    const n = 7, pas = L / n, r = alea(2413), plaquesH = [], plaquesV = [], cubes = [], fils = [];
    place(g, mesh(new THREE.BoxGeometry(L, .04, P), M('chrome')), 0, -.02, 0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (i + .5) * pas - L / 2, z = ((j + .5) / n - .5) * P, k = 1 - Math.max(Math.abs(x) / (L / 2), Math.abs(z) / (P / 2)), lg = (.25 + .75 * k) * (H - d) * (.75 + r() * .25);
      fils.push([x, -.04 - lg / 2, z, 0, 0, 0, 1, 1, lg, 1]);
      for (let y = -.1 - r() * .1; y > -lg; y -= .14 + r() * .1) {
        const q = r();
        if (q < .45) plaquesH.push([x, y, z, 0, r() * .3, 0, 1, pas * .82, .004, pas * .82]);
        else if (q < .8) plaquesV.push([x, y, z, 0, r() < .5 ? 0 : Math.PI / 2, 0, 1, pas * .8, pas * .7, .004]);
        else cubes.push([x, y, z, r(), r(), 0, 1, .045, .045, .045]);
      }
    }
    const boite = new THREE.BoxGeometry(1, 1, 1);
    instances(g, new THREE.CylinderGeometry(.001, .001, 1, 3), M('alu'), fils);
    instances(g, boite, M('cristal'), plaquesH);
    instances(g, boite, M('cristal'), plaquesV);
    instances(g, boite, opalin(), cubes);
    halo(g, 2.4, 0, -H * .4, 0);
    return g;
  },

  /* Ondes Signature : grandes boucles ondulantes en bandeau d'aluminium beige à LED, de plus en plus petites vers le bas, en entonnoir */
  'ols-arch-30'(p, o = {}) {
    const g = groupe('lustre');
    const { H, d, L } = geometrieLustre(p, o);
    const R = clamp(L / 2, .5, 1.6), n = 8, r = alea(30), bande = abat('#E4D8C4', '#FFF0D8', .25, 1.2), led = M('led:#FFF4E6');
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1), rk = R * (1 - .72 * t), y = -d - .06 - Math.pow(t, 1.3) * (H - .2), cx = Math.sin(k * .9) * R * .08 * t, cz = Math.cos(k * .7) * R * .06 * t, ph = r() * TAU, ps = r() * TAU, hb = .07;
      const rayon = a => rk * (1 + .1 * Math.sin(3 * a + ph) + .06 * Math.sin(5 * a + ps) + .03 * Math.sin(8 * a + ph * 2));
      const f = (u, v) => { const a = u * TAU, rr = rayon(a); return [cx + Math.cos(a) * rr, y + (v - 1) * hb, cz + Math.sin(a) * rr]; };
      g.add(mesh(geoSurface(f, 160, 2), bande, false));
      boudin(g, Array.from({ length: 120 }, (_, i) => f(i / 120, 0)), .008, led, { ferme: true, seg: 360, radial: 6 });
      for (let i = 0; i < 4; i++) { const [x, , z] = f(i / 4 + .1, 1); cyl(g, .0012, .0012, -y, M('alu'), x, y, z, 4); }
    }
    halo(g, 3, 0, -d - H * .4, 0);
    return g;
  },

  /* Infinity Spiral Rings : grands anneaux inclinés qui s'enchaînent en spirale, les uns hérissés d'ailettes lumineuses, les autres semés de points LED */
  'isr-light-2411'(p, o = {}) {
    const g = groupe('lustre');
    const { H, d, L } = geometrieLustre(p, o);
    const R = clamp(L / 2, .4, 1), r = alea(2411);
    const anneaux = [[.95, .1, .0, .35, .2, 1], [.7, -.35, .15, .1, 1.1, 0], [.62, .3, -.1, 1.2, .3, 1], [.5, -.1, .2, .5, 1.4, 1], [.4, .15, -.05, 1.3, .7, 0], [.34, 0, .1, .2, .4, 1]];
    anneaux.forEach(([k, ox, oz, rx, rz, ailettes], j) => {
      const rr = R * k, y = -d - rr - j * (H - 2 * R * .3) / anneaux.length * .9, a = groupe();
      a.position.set(ox * R, y, oz * R); a.rotation.set(rx, r() * TAU, rz); g.add(a);
      tore(a, rr, .008, ailettes ? M('alu') : M('noir'), 0, 0, 0, Math.PI / 2, TAU, 120);
      const n = Math.round(TAU * rr / (ailettes ? .035 : .07)), liste = [];
      for (let i = 0; i < n; i++) {
        const t = i / n * TAU;
        liste.push(ailettes ? [Math.cos(t) * (rr + .03), 0, Math.sin(t) * (rr + .03), 0, -t, 0, 1, .07, .06, .006] : [Math.cos(t) * rr, -.012, Math.sin(t) * rr, 0, 0, 0, .016]);
      }
      if (ailettes) instances(a, new THREE.BoxGeometry(1, 1, 1), abat('#E8E6E2', '#FFF6EA', .18, 2.6), liste);
      else billes(a, liste.map(([x, y, z, , , , s]) => [x, y, z, s]), M('led:#FFF2DC'), 8);
      cyl(g, .0012, .0012, -y, M('alu'), ox * R, y, oz * R, 4);
    });
    halo(g, 2.6, 0, -d - H * .45, 0);
    return g;
  },

  /* Skyline Geometric Light : plafonnier de panneaux blancs suspendus à différentes hauteurs, arêtes basses lumineuses */
  'sgl-light-2412'(p, o = {}) {
    const g = groupe('lustre');
    const { H, d, L, P } = geometrieLustre(p, o);
    const r = alea(2412), panneaux = [], leds = [], n = 7;
    place(g, mesh(new THREE.BoxGeometry(L, .02, P), M('blanc')), 0, -.01, 0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (r() < .25) continue;
      const x = ((i + .5) / n - .5) * L, z = ((j + .5) / n - .5) * P, k = 1 - Math.max(Math.abs(x) / (L / 2), Math.abs(z) / (P / 2)) * .6;
      const h = (.1 + r() * .3) * k * H / .9 * .9, w = L / n * (.8 + r() * .9), sens = r() < .5, y0 = -.02 - r() * (H - h - .05) * .5 * k;
      panneaux.push([x, y0 - h / 2, z, 0, sens ? 0 : Math.PI / 2, 0, 1, w, h, .02]);
      leds.push([x, y0 - h - .003, z, 0, sens ? 0 : Math.PI / 2, 0, 1, w * .96, .006, .022]);
    }
    const boite = new THREE.BoxGeometry(1, 1, 1);
    instances(g, boite, M('laque:#DAD6CE'), panneaux);
    instances(g, boite, M('led:#FFF4E2'), leds);
    halo(g, 2.2, 0, -H * .4, 0);
    return g;
  },

  /* Crystal Palace Cascade : plafonnier rectangulaire à gradins, rideaux de baguettes de cristal festonnés, corbeille de pampilles ambrées */
  'cpc-light-2410'(p, o = {}) {
    const g = groupe('lustre');
    const { H, d, L, P } = geometrieLustre(p, o);
    const or = M('or'), r = alea(2410), baguettes = [], perles = [];
    place(g, mesh(new THREE.BoxGeometry(L, .03, P), or), 0, -.015, 0);
    const tiers = [[1, 1, .3], [.86, .8, .28], [.72, .6, .24]];
    let y = -.03;
    tiers.forEach(([kl, kp, hk]) => {
      const l = L * kl, pp = P * kp, h = H * hk, per = 2 * (l + pp), n = Math.round(per / .022);
      for (let i = 0; i < n; i++) {
        const s = i / n * per, [x, z] = s < l ? [s - l / 2, pp / 2] : s < l + pp ? [l / 2, pp / 2 - (s - l)] : s < 2 * l + pp ? [l / 2 - (s - l - pp), -pp / 2] : [-l / 2, -pp / 2 + (s - 2 * l - pp)];
        const feston = .035 * Math.abs(Math.sin(s / .12 * Math.PI)), lg = h - feston;
        baguettes.push([x, y - lg / 2, z, 0, 0, 0, 1, 1, lg, 1]);
      }
      place(g, mesh(new THREE.BoxGeometry(l, .012, pp), or), 0, y - .006, 0);
      y -= h * .92;
    });
    // corbeille : rangs de pampilles ambrées en demi-ellipsoïde sous le dernier gradin
    const a = L * .36, c = P * .3, hb = H * .22;
    for (let k = 0; k < 6; k++) {
      const t = k / 6, ak = a * Math.cos(t * Math.PI / 2.2), ck = c * Math.cos(t * Math.PI / 2.2), yk = y - hb * Math.sin(t * Math.PI / 2.2), m = Math.round(TAU * Math.sqrt((ak * ak + ck * ck) / 2) / .03);
      for (let i = 0; i < m; i++) { const th = i / m * TAU; perles.push([Math.cos(th) * ak, yk, Math.sin(th) * ck, 0, 0, 0, 1, .009, .03, .009]); }
    }
    instances(g, new THREE.CylinderGeometry(.005, .005, 1, 6), M('cristal'), baguettes);
    instances(g, new THREE.SphereGeometry(1, 10, 8), M('ambre'), perles);
    halo(g, 2, 0, -H * .5, 0);
    return g;
  },

  /* Orbit Halo Grand : couronne XXL en métal noir à double cerclage, bougies opalines dressées à l'extérieur, globes à l'intérieur, tiges noires */
  'ohg-ring-2400'(p, o = {}) {
    const g = groupe('lustre');
    const { H, d, L } = geometrieLustre(p, o);
    const R = clamp(L / 2, .5, 1), noir = M('noir'), y0 = -d - Math.max(.3, H * .55), n = 28, ri = R * .86;
    [[R, y0], [R, y0 - .11], [ri, y0], [ri, y0 - .11]].forEach(([rr, y]) => tore(g, rr, .006, noir, 0, y, 0, Math.PI / 2, TAU, 140));
    const bougies = [], globes = [], tiges = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, c = Math.cos(a), s = Math.sin(a);
      tiges.push([c * R, y0 - .055, s * R, 0, 0, 0, 1, 1, .11, 1], [c * ri, y0 - .055, s * ri, 0, 0, 0, 1, 1, .11, 1], [c * (R + ri) / 2, y0, s * (R + ri) / 2, 0, -a, Math.PI / 2, 1, 1, R - ri, 1]);
      bougies.push([c * (R + .03), y0 + .06, s * (R + .03), 0, 0, 0, 1, .026, .12, .026]);
      globes.push([c * (ri - .03), y0 + .03, s * (ri - .03), 0, 0, 0, .024]);
      if (i % 2 === 0) cyl(g, .006, .006, -y0, noir, c * ri * .97, y0, s * ri * .97, 6);
    }
    instances(g, new THREE.CylinderGeometry(.005, .005, 1, 6), noir, tiges);
    instances(g, new THREE.CylinderGeometry(1, 1, 1, 18), opalin(), bougies);
    billes(g, globes.map(([x, y, z, , , , s]) => [x, y, z, s]), opalin(), 14);
    halo(g, 2.6, 0, y0, 0);
    return g;
  },

  /* Molten Capsule : coupe de verre soufflé ambré en forme d'os, tube de laiton brossé lumineux devant */
  'mc-wall-3347'(p) {
    const g = groupe('applique');
    const W = clamp(p.dim[0], .1, .2), h = clamp(p.dim[2], .25, .5), la = M('laiton');
    const f = (u, v) => {
      const s = u * 2 - 1, t = v, env = Math.pow(Math.max(0, 1 - Math.pow(2 * t - 1, 6)), 1 / 6), larg = W / 2 * (.74 + .26 * Math.cos(TAU * t)) * env;
      return [s * larg, (t - .5) * h, .065 - .04 * (1 - s * s) * env];
    };
    g.add(mesh(geoSurface(f, 16, 40), verreAmbre(), false));
    boudin(g, Array.from({ length: 41 }, (_, i) => f(0, i / 40)).concat(Array.from({ length: 41 }, (_, i) => f(1, 1 - i / 40))), .003, verreAmbre(), { ferme: true, seg: 160, radial: 5 });
    cyl(g, .028, .028, .012, la, 0, -.006, 0, 20).rotation.x = Math.PI / 2;
    boudin(g, [[0, 0, .008], [0, 0, .05]], .01, la, { seg: 2, radial: 10, tension: 0 });
    boudin(g, [[0, -h * .36, .055], [0, h * .36, .055]], .016, la, { seg: 4, radial: 16, tension: 0 });
    halo(g, .8, 0, 0, .1);
    return g;
  },

  /* Soft Stone Layers : barre de laiton, trois galets d'albâtre plats à pastille de laiton centrale */
  'ssl-wall-2423'(p) {
    const g = groupe('applique');
    const h = clamp(p.dim[2], .4, .9), W = clamp(p.dim[0], .12, .25), la = M('laiton'), alb = lumineux('albatre', ['#F6F0E6', '#DCCBB4'], '#FFE2BC', .3, 2);
    place(g, mesh(new THREE.BoxGeometry(.035, h * .86, .012), la), 0, 0, .006);
    [[h * .32, .72, .2], [0, 1, -.15], [-h * .32, .72, .3]].forEach(([y, k, rot]) => {
      const a = W * .5 * k, b = W * .46 * k;
      panneau(g, formeLisse([[-a, -b * .8], [-a * .3, -b], [a * .85, -b * .85], [a, b * .6], [a * .4, b], [-a * .9, b * .9]]), .02, alb, 'face', 0, y, .03, { a: .006, rz: rot });
      cyl(g, .022, .022, .006, la, 0, y, .04, 24).rotation.x = Math.PI / 2;
    });
    halo(g, 1, 0, 0, .1);
    return g;
  },

  /* Dual Tube : deux tubes reliés en arceau en haut, laiton brossé et résine ivoire lumineuse en bas */
  'dte-wall-2419'(p) {
    const g = groupe('applique');
    const h = clamp(p.dim[2], .35, .7), la = M('laiton'), res = opalin('#EFE6D6', '#FFE2B8'), e = .024, z = .05, r = .016, yh = h * .26;
    boudin(g, Array.from({ length: 13 }, (_, i) => { const a = Math.PI - i / 12 * Math.PI; return [Math.cos(a) * e, yh + Math.sin(a) * e, z]; }), r, la, { seg: 30, radial: 14, bouts: false });
    place(g, mesh(new THREE.BoxGeometry(.06, .07, .012), la), 0, yh - .02, .006);
    boudin(g, [[0, yh - .02, .012], [0, yh - .02, z - r]], .012, la, { seg: 2, radial: 10, tension: 0 });
    [-1, 1].forEach(s => {
      const x = s * e, seg = [[yh, -h * .08, la], [-h * .08, -h * .25, res], [-h * .25, -h * .29, la], [-h * .29, -h * .5, res]];
      seg.forEach(([y0, y1, m]) => cyl(g, r, r, y0 - y1, m, x, y1, z, 18));
    });
    halo(g, .9, 0, -h * .3, .1);
    return g;
  },

  /* Crystal Blade : deux longues lames de verre strié pliées en chevron, sur un boîtier métallique */
  'cbl-wall-2424'(p) {
    const g = groupe('applique');
    const h = clamp(p.dim[2], .5, 1), W = clamp(p.dim[0], .15, .3), l = h / 2, a = .12, zm = .09, w = W * .24;
    place(g, mesh(new THREE.BoxGeometry(W * .35, h * .25, .07), M('laque:#B8B7B2')), 0, 0, .035);
    const lame = formeLisse([[-w / 2, -l / 2 + .03], [0, -l / 2], [w / 2, -l / 2 + .03], [w / 2, l / 2 - .03], [0, l / 2], [-w / 2, l / 2 - .03]], 24);
    [-1, 1].forEach(sx => [-1, 1].forEach(sy => {
      const x = sx * W * .17, y = sy * l / 2 * Math.cos(a), z = zm - l / 2 * Math.sin(a);
      panneau(g, lame, .008, verreStrie(), 'face', x, y, z, { a: .002, rx: sy > 0 ? -a : a });
      boudin(g, [[x - w / 2, sy * l * .98 * Math.cos(a), zm - l * .98 * Math.sin(a) + .004], [x - w / 2, sy * .01, zm + .004]], .0018, M('chrome'), { seg: 2, radial: 4, tension: 0 });
      boudin(g, [[x + w / 2, sy * l * .98 * Math.cos(a), zm - l * .98 * Math.sin(a) + .004], [x + w / 2, sy * .01, zm + .004]], .0018, M('chrome'), { seg: 2, radial: 4, tension: 0 });
    }));
    [-1, 1].forEach(sx => place(g, mesh(new THREE.BoxGeometry(w, .012, .02), M('chrome')), sx * W * .17, 0, zm));
    halo(g, 1.1, 0, 0, .12);
    return g;
  },

  /* Grid Glass : six panneaux de verre opalin bombé en grille 2 × 3, demi-lunes lumineuses, raccords métalliques gris */
  'mgg-wall-3314'(p) {
    const g = groupe('applique');
    const W = clamp(p.dim[0], .4, .8), h = clamp(p.dim[2], .6, 1.1), pw = W / 2 - .02, ph = h / 3 - .02, gris = M('laque:#8E8A84');
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const cx = (i - .5) * (pw + .02), cy = (j - 1) * (ph + .02);
      g.add(mesh(geoSurface((u, v) => [cx + (u - .5) * pw, cy + (v - .5) * ph, .035 + .012 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)], 10, 10), verreGrille(), false));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => cyl(g, .012, .012, .03, gris, cx + sx * pw / 2, cy + sy * ph / 2, .02, 10).rotation.x = Math.PI / 2);
    }
    [-1.5, -.5, .5, 1.5].forEach(j => place(g, mesh(new THREE.BoxGeometry(W - .02, .008, .01), gris), 0, j * (ph + .02), .02));
    halo(g, 1.6, 0, 0, .12);
    return g;
  },

  /* Dual Beam : platine étroite en métal noir, cylindre dans un fourreau de verre clair au-dessus, petit spot orientable dessous */
  'dbm-wall-02'(p) {
    const g = groupe('applique');
    const h = clamp(p.dim[2], .3, .6), noir = M('noir'), z = .045;
    place(g, mesh(new THREE.BoxGeometry(.034, h * .55, .012), noir), 0, -h * .08, .006);
    cyl(g, .026, .026, h * .42, noir, 0, -.01, z, 24);
    cyl(g, .032, .032, h * .3, M('verre'), 0, h * .11, z, 24, true);
    cyl(g, .022, .022, .002, M('led:#FFE6C0'), 0, h * .41 - .01, z, 16);
    const spot = groupe(); spot.position.set(0, -h * .3, z); spot.rotation.x = .55; g.add(spot);
    boudin(spot, [[0, .03, 0], [0, -.045, 0]], .026, noir, { seg: 2, radial: 18, tension: 0, kb: .4 });
    cyl(spot, .02, .02, .002, M('led:#FFD9A0'), 0, -.072, 0, 16);
    halo(g, .9, 0, 0, .1);
    return g;
  },

  /* Marble Stack : platine ovale et bras en cuivre, trois coupes d'albâtre veiné empilées sur la tige, fleuron en goutte */
  'msk-wall-3'(p) {
    const g = groupe('applique');
    const h = clamp(p.dim[2], .45, .8), R = clamp(p.dim[0] / 2, .07, .12), cu = cuivre(), alb = lumineux('albatre', ['#F6F1E8', '#C8B08E'], '#FFE2BC', .3, 2), z = .1;
    const yb = -h * .42;
    sphere(g, .05, cu, 0, yb, .012, 1, 1.35, .3, 24);
    boudin(g, [[0, yb, .02], [0, yb + .03, .06], [0, yb + .08, z], [0, yb + .12, z]], .009, cu, { seg: 30, radial: 10 });
    cyl(g, .006, .006, h * .78, cu, 0, yb + .1, z, 10);
    const hc = R * .78, ep = .012;
    [-.12, .08, .27].forEach(k => {
      const y = k * h, prof = [[0, -hc]];
      for (let i = 1; i <= 10; i++) { const a = i / 10 * Math.PI / 2; prof.push([Math.sin(a) * R, -Math.cos(a) * hc]); }
      prof.push([R - ep, 0]);
      for (let i = 10; i >= 1; i--) { const a = i / 10 * Math.PI / 2; prof.push([Math.sin(a) * (R - ep), -Math.cos(a) * (hc - ep)]); }
      prof.push([0, -hc + ep]);
      tourne(g, prof, alb, 0, y, z, 40);
      cyl(g, .012, .012, .02, cu, 0, y - hc - .01, z, 12);
    });
    tourne(g, [[0, 0], [.012, .006], [.018, .03], [.01, .05], [0, .058]], cu, 0, .3 * h, z, 16);
    halo(g, 1, 0, 0, .12);
    return g;
  },

  /* Chinoiserie : cadre-support en baguettes de laiton débordantes, tableau encadré de noir (fleurs blanches sur fond doré), réglette lumineuse en haut */
  'acl-gal-06'(p) {
    const g = groupe('applique');
    const W = clamp(p.dim[0], .4, .7), h = clamp(p.dim[2], .5, .8), la = M('laiton'), z = .04;
    place(g, mesh(new THREE.BoxGeometry(W * .74, h * .64, .03), M('noirMat')), 0, -h * .03, z);
    place(g, mesh(new THREE.PlaneGeometry(W * .58, h * .5), tableauFleurs()), 0, -h * .03, z + .0155);
    [-1, 1].forEach(s => {
      boudin(g, [[s * W * .41, -h * .48, z + .02], [s * W * .41, h * .5, z + .02]], .005, la, { seg: 2, radial: 8, tension: 0 });
      boudin(g, [[-W * .5, s * h * .42 - h * .03, z + .025], [W * .5, s * h * .42 - h * .03, z + .025]], .005, la, { seg: 2, radial: 8, tension: 0 });
      [-1, 1].forEach(t => place(g, mesh(new THREE.BoxGeometry(.03, .03, .02), la), s * W * .41, t * h * .42 - h * .03, z + .022));
      boudin(g, [[s * W * .41, h * .44, .002], [s * W * .41, h * .44, z + .02]], .006, la, { seg: 2, radial: 8, tension: 0 });
    });
    boudin(g, [[-W * .34, h * .44, z + .06], [W * .34, h * .44, z + .06]], .012, la, { seg: 2, radial: 14, tension: 0 });
    place(g, mesh(new THREE.BoxGeometry(W * .6, .003, .014), M('led:#FFE8C4')), 0, h * .44 - .013, z + .06);
    [-1, 1].forEach(s => boudin(g, [[s * W * .3, h * .44, z + .025], [s * W * .3, h * .44, z + .055]], .004, la, { seg: 2, radial: 6, tension: 0 }));
    halo(g, 1.2, 0, h * .3, .12);
    return g;
  },

  /* Luna Perla : platine ronde et rotule en bronze, abat-jour en croissant de céramique blanche brillante, tige et trois perles de bronze */
  'apl-lun-07'(p) {
    const g = groupe('applique');
    const h = clamp(p.dim[2], .3, .6), br = M('bronze'), yj = h * .22;
    cyl(g, .065, .065, .012, br, 0, yj, .006, 32).rotation.x = Math.PI / 2;
    sphere(g, .024, br, 0, yj, .035, 1, 1, 1, 18);
    boudin(g, [[0, yj + .01, .045], [0, yj + .05, .09], [0, yj + .02, .15], [0, yj - .07, .16], [0, yj - .14, .1]], t => .036 * Math.pow(Math.sin(Math.PI * clamp(t, .03, .97)), .55), ceramique(), { seg: 60, radial: 20 });
    cyl(g, .0022, .0022, .2, br, 0, yj - .2, .035, 6);
    [0, 1, 2].forEach(k => sphere(g, .022, br, 0, yj - .2 - .022 - k * .043, .035, 1, 1, 1, 16));
    halo(g, .8, 0, yj - .05, .14);
    return g;
  },

  /* Wood Orb : disque de noyer plaqué au plafond, dôme de verre opalin au centre, deux vis noires */
  'plafonnier-wood-orb'(p) {
    const g = groupe('plafonnier');
    const R = clamp(p.dim[0] / 2, .12, .3), bois = matiere('bois', '#5A3A28', { couleurs: ['#6A4632', '#3E281A'], echelle: .3 });
    tourne(g, [[0, -.032], [R - .01, -.032], [R, -.026], [R, -.004], [R - .004, 0], [0, 0]], bois, 0, 0, 0, 64);
    sphere(g, R * .46, opalin('#F3EAD8', '#FFE2B6'), 0, -.032, 0, 1, .55, 1, 32);
    [-1, 1].forEach(s => sphere(g, .007, M('noir'), 0, -.033, s * R * .62, 1, .6, 1, 10));
    halo(g, 1.2, 0, -.1, 0);
    return g;
  }
};
