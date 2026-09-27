/* =================================================================

   RealRoom — constructeurs 3D des meubles

   Repris de la visite Maison Corleone (scripts/moteur.mjs), maintenus ici.

   Conventions : mètres, origine au sol, centrée, face avant vers +z ;

   appliques : origine au mur ; suspensions : origine au plafond.

   ================================================================= */

/* =================================================================
   Visite 3D — socle : rendu, outils de modélisation, matériaux, textures
   Maquettes génériques en attendant la 3D réelle des chambres (Marble).
   ================================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// produits connus des constructeurs (catalogue et meubles relevés sur les photos)
let DATA = { PRODUITS: {} };
function definirProduits(P) { DATA = { PRODUITS: P }; }
const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------------------------------------------------------
   Aléatoire reproductible (même maquette à chaque visite)
   --------------------------------------------------------------- */
function alea(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let R = alea(7);
// graine du hasard des maquettes : même meuble, même maquette
function graine(n) { R = alea(n); }

/* ---------------------------------------------------------------
   Outils de modélisation : chaque objet a son origine au sol,
   centré, face avant vers +z
   --------------------------------------------------------------- */
function mesh(geo, m, ombre = true) {
  const me = new THREE.Mesh(geo, m);
  me.castShadow = ombre;
  me.receiveShadow = true;
  return me;
}
function place(parent, obj, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  obj.position.set(x, y, z);
  if (ry || rx || rz) obj.rotation.set(rx, ry, rz);
  parent.add(obj);
  return obj;
}
// Boîte posée : (x, y, z) = centre de la face inférieure
function bloc(parent, w, h, d, m, x = 0, y = 0, z = 0, r = 0, ry = 0) {
  const rr = Math.min(r, Math.min(w, h, d) / 2 - 0.0005);
  const g = rr > 0.002 ? new RoundedBoxGeometry(w, h, d, 3, rr) : new THREE.BoxGeometry(w, h, d);
  return place(parent, mesh(g, m), x, y + h / 2, z, ry);
}
function cyl(parent, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 24, ouvert = false) {
  return place(parent, mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, ouvert), m), x, y + h / 2, z);
}
function sphere(parent, r, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 20) {
  const s = place(parent, mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.6 | 0)), m), x, y, z);
  s.scale.set(sx, sy, sz);
  return s;
}
function tore(parent, R0, r, m, x = 0, y = 0, z = 0, rx = Math.PI / 2, arc = TAU, seg = 48) {
  return place(parent, mesh(new THREE.TorusGeometry(R0, r, 8, seg, arc), m), x, y, z, 0, rx);
}
function tour(parent, pts, m, x = 0, y = 0, z = 0, seg = 40) {
  return place(parent, mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), m), x, y, z);
}
function tube(parent, points, r, m, ferme = false, seg = 64, radial = 8) {
  const courbe = new THREE.CatmullRomCurve3(points.map(p => V3(p[0], p[1], p[2])), ferme, 'catmullrom', 0.5);
  return place(parent, mesh(new THREE.TubeGeometry(courbe, seg, r, radial, ferme), m));
}
function extrude(parent, shape, prof, m, biseau = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: prof, bevelEnabled: biseau > 0, bevelThickness: biseau, bevelSize: biseau, bevelSegments: 3, curveSegments: 24 });
  return place(parent, mesh(g, m));
}
// Arc de couronne (plateau courbe) : rayons ri..re, angle a0..a1, extrudé sur h (vers le haut)
function arcPlein(ri, re, a0, a1) {
  const s = new THREE.Shape();
  s.absarc(0, 0, re, a0, a1, false);
  s.absarc(0, 0, ri, a1, a0, true);
  s.closePath();
  return s;
}
function couronne(parent, ri, re, a0, a1, h, m, y = 0, biseau = 0.02) {
  const me = extrude(parent, arcPlein(ri, re, a0, a1), h, m, biseau);
  me.rotation.x = -Math.PI / 2;
  me.position.y = y;
  return me;
}
function groupe(nom) { const g = new THREE.Group(); if (nom) g.name = nom; return g; }
// Instances (boutons de capitonnage, lattes, cristaux...)
function instances(parent, geo, m, liste, ombre = false) {
  const im = new THREE.InstancedMesh(geo, m, liste.length);
  const o = new THREE.Object3D();
  liste.forEach((t, i) => {
    o.position.set(t[0], t[1], t[2]);
    o.rotation.set(t[3] || 0, t[4] || 0, t[5] || 0);
    const s = t[6] || 1;
    o.scale.set(t[7] !== undefined ? t[7] : s, t[8] !== undefined ? t[8] : s, t[9] !== undefined ? t[9] : s);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.castShadow = ombre;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}

/* ---------------------------------------------------------------
   Textures procédurales (canvas)
   --------------------------------------------------------------- */
function canvasTex(w, h, dessin, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  dessin(x, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.couleur !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (opts.rep) t.repeat.set(opts.rep[0], opts.rep[1]);
  return t;
}
const TEX = {};
function tex(nom) {
  if (TEX[nom]) return TEX[nom];
  const r = alea(nom.length * 131 + 17);
  const f = {
    moquette: () => canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#5E4F47'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = r();
        x.fillStyle = v < .5 ? 'rgba(40,30,26,.35)' : v < .85 ? 'rgba(128,110,98,.28)' : 'rgba(170,150,132,.22)';
        x.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2);
      }
      x.strokeStyle = 'rgba(150,130,112,.18)'; x.lineWidth = 2;
      for (let i = 0; i < 90; i++) { const px = r() * w, py = r() * h, s = 6 + r() * 14; x.strokeRect(px, py, s, s * .6); }
    }),
    parquet: () => canvasTex(512, 512, (x, w, h) => {
      const lames = 6, lh = h / lames;
      for (let i = 0; i < lames; i++) {
        let off = r() * w;
        for (let k = -1; k < 3; k++) {
          const l = w * (.55 + r() * .4);
          const t = 185 + r() * 25 | 0;
          x.fillStyle = `rgb(${t},${t - 38 | 0},${t - 82 | 0})`;
          x.fillRect(off + k * w * .7, i * lh, l, lh);
          x.strokeStyle = 'rgba(80,50,25,.35)'; x.lineWidth = 1.5;
          x.strokeRect(off + k * w * .7, i * lh, l, lh);
        }
        for (let g = 0; g < 26; g++) {
          x.strokeStyle = `rgba(110,72,38,${.05 + r() * .09})`; x.lineWidth = 1;
          x.beginPath(); const yy = i * lh + r() * lh; x.moveTo(0, yy); x.bezierCurveTo(w * .3, yy + r() * 6 - 3, w * .6, yy + r() * 6 - 3, w, yy); x.stroke();
        }
      }
    }),
    marbre: () => canvasTex(1024, 1024, (x, w, h) => {
      x.fillStyle = '#EEEAE3'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) {
        x.strokeStyle = `rgba(${120 + r() * 40},${115 + r() * 30},${110 + r() * 30},${.15 + r() * .3})`;
        x.lineWidth = .6 + r() * 2.4;
        x.beginPath(); let px = r() * w, py = -20; x.moveTo(px, py);
        for (let s = 0; s < 8; s++) { const nx = px + (r() - .4) * 260, ny = py + 150 + r() * 60; x.quadraticCurveTo(px + (r() - .5) * 200, (py + ny) / 2, nx, ny); px = nx; py = ny; }
        x.stroke();
      }
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3;
      for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); }
    }),
    pierre: () => canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#D8CFBF'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${r() < .5 ? '120,105,85' : '250,245,235'},${.05 + r() * .08})`; x.fillRect(r() * w, r() * h, 2, 2); }
      x.strokeStyle = 'rgba(120,108,90,.5)'; x.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke(); }
      for (let i = 0; i < 4; i++) for (let k = 0; k <= 2; k++) { const xx = (k * w / 2 + (i % 2) * w / 4) % w; x.beginPath(); x.moveTo(xx, i * h / 4); x.lineTo(xx, (i + 1) * h / 4); x.stroke(); }
    }),
    dallage: () => canvasTex(512, 512, (x, w, h) => {
      for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) {
        const t = (i + k) % 2 ? 226 : 236;
        x.fillStyle = `rgb(${t},${t - 6},${t - 14})`; x.fillRect(i * w / 2, k * h / 2, w / 2, h / 2);
      }
      for (let i = 0; i < 12; i++) { x.strokeStyle = `rgba(150,140,125,${.1 + r() * .15})`; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(r() * w, r() * h); x.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h); x.stroke(); }
      x.strokeStyle = 'rgba(160,150,135,.6)'; x.lineWidth = 2; x.strokeRect(1, 1, w / 2 - 2, h / 2 - 2); x.strokeRect(w / 2 + 1, h / 2 + 1, w / 2 - 2, h / 2 - 2); x.strokeRect(w / 2 + 1, 1, w / 2 - 2, h / 2 - 2); x.strokeRect(1, h / 2 + 1, w / 2 - 2, h / 2 - 2);
    }),
    pelouse: () => canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#7E9660'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16000; i++) { const g = r(); x.fillStyle = g < .5 ? 'rgba(70,95,45,.3)' : 'rgba(170,190,120,.22)'; x.fillRect(r() * w, r() * h, 1, 2 + r() * 3); }
    }),
    terrasse: () => canvasTex(512, 512, (x, w, h) => {
      const n = 8, lw = w / n;
      for (let i = 0; i < n; i++) { const t = 150 + r() * 25 | 0; x.fillStyle = `rgb(${t},${t - 30 | 0},${t - 60 | 0})`; x.fillRect(i * lw, 0, lw - 3, h); }
      x.fillStyle = 'rgba(40,25,15,.6)'; for (let i = 0; i < n; i++) x.fillRect(i * lw + lw - 3, 0, 3, h);
    }),
    tache: () => canvasTex(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.55, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }, { clamp: true, couleur: false }),
    halo: () => canvasTex(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,236,205,1)'); g.addColorStop(.25, 'rgba(255,200,140,.45)'); g.addColorStop(1, 'rgba(255,170,90,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }, { clamp: true }),
    ciel: () => canvasTex(512, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#CFE0EA'); g.addColorStop(.55, '#EDE7DA'); g.addColorStop(1, '#D9CDBB');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(150,150,150,.25)';
      for (let i = 0; i < 40; i++) { const bw = 10 + r() * 40, bh = 20 + r() * 60; x.fillRect(r() * w, h * .72 - bh, bw, bh + h); }
    }, { clamp: true }),
    eau: () => {
      const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
      const x = c.getContext('2d'), img = x.createImageData(n, n), hgt = new Float32Array(n * n);
      const ondes = []; for (let i = 0; i < 14; i++) ondes.push([1 + (r() * 6 | 0), 1 + (r() * 6 | 0), r() * TAU, .3 + r() * .7]);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let v = 0; for (const o of ondes) v += Math.sin((i / n * o[0] + j / n * o[1]) * TAU + o[2]) * o[3]; hgt[j * n + i] = v; }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const dx = hgt[j * n + (i + 1) % n] - hgt[j * n + (i - 1 + n) % n], dy = hgt[((j + 1) % n) * n + i] - hgt[((j - 1 + n) % n) * n + i];
        const nx = -dx * .9, ny = -dy * .9, nz = 1, l = Math.hypot(nx, ny, nz), k = (j * n + i) * 4;
        img.data[k] = (nx / l * .5 + .5) * 255; img.data[k + 1] = (ny / l * .5 + .5) * 255; img.data[k + 2] = (nz / l * .5 + .5) * 255; img.data[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    },
    ruissellement: () => canvasTex(64, 256, (x, w, h) => {
      x.fillStyle = 'rgba(255,255,255,0)'; x.clearRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(235,245,250,${.15 + r() * .45})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 20 + r() * 90); }
    }, { couleur: false }),
    jungle: () => canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#16201A'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const px = r() * w, py = r() * h, s = 10 + r() * 28;
        x.save(); x.translate(px, py); x.rotate(r() * TAU);
        x.fillStyle = ['#2F6B3A', '#3E8A47', '#1F4C2B', '#5E9B4C'][r() * 4 | 0];
        x.beginPath(); x.ellipse(0, 0, s, s * .38, 0, 0, TAU); x.fill(); x.restore();
      }
      for (let i = 0; i < 40; i++) { x.fillStyle = ['#C98A3A', '#E0B04F', '#B4532F'][r() * 3 | 0]; x.beginPath(); x.arc(r() * w, r() * h, 2 + r() * 4, 0, TAU); x.fill(); }
    }),
    mineral: () => canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#3C3936'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        x.fillStyle = ['rgba(214,200,178,.55)', 'rgba(150,145,140,.45)', 'rgba(25,24,24,.5)'][r() * 3 | 0];
        x.beginPath(); const px = r() * w, py = r() * h; x.moveTo(px, py);
        for (let s = 0; s < 5; s++) x.quadraticCurveTo(px + (r() - .5) * 160, py + (r() - .5) * 90, px + (r() - .5) * 120, py + (r() - .5) * 70);
        x.fill();
      }
    }),
    pinceau: () => canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#ECE4D6'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) {
        x.strokeStyle = r() < .6 ? 'rgba(28,27,32,.8)' : 'rgba(120,118,115,.6)'; x.lineWidth = 3 + r() * 9; x.lineCap = 'round';
        x.beginPath(); const px = r() * w, py = r() * h; x.moveTo(px, py); x.bezierCurveTo(px + r() * 80, py - r() * 50, px + r() * 120, py + r() * 50, px + 60 + r() * 100, py + (r() - .5) * 40); x.stroke();
      }
    }),
    corde: () => canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#C8B89A'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(120,100,70,.35)' : 'rgba(250,240,220,.3)'; x.fillRect(0, i * 8, w, 4); x.fillRect(i * 8, 0, 3, h); }
    }),
    cuirTopo: () => canvasTex(256, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#8C6AA6'); g.addColorStop(1, '#4E3464'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(30,15,45,${.15 + r() * .2})`; x.lineWidth = 1 + r() * 2; x.beginPath(); const yy = r() * h; x.moveTo(0, yy); x.bezierCurveTo(w * .3, yy + (r() - .5) * 40, w * .7, yy + (r() - .5) * 40, w, yy + (r() - .5) * 20); x.stroke(); }
    }),
    fibres: () => canvasTex(128, 256, (x, w, h) => {
      x.fillStyle = '#F1EBDF'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 64; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.5)' : 'rgba(170,150,120,.25)'; x.fillRect(i * 2, 0, 1, h); }
    }),
    oeuvre: () => canvasTex(256, 340, (x, w, h) => {
      x.fillStyle = '#EFE8DD'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#B4532F'; x.beginPath(); x.moveTo(w * .2, h * .2); x.lineTo(w * .8, h * .35); x.lineTo(w * .55, h * .75); x.closePath(); x.fill();
      x.fillStyle = '#1C1B20'; x.beginPath(); x.moveTo(w * .5, h * .3); x.lineTo(w * .78, h * .82); x.lineTo(w * .3, h * .7); x.closePath(); x.fill();
      x.fillStyle = '#D9C3A0'; x.fillRect(w * .15, h * .55, w * .3, h * .2);
    }, { clamp: true })
  };
  TEX[nom] = f[nom]();
  return TEX[nom];
}

/* ---------------------------------------------------------------
   Matériaux (cache par clé) + registre des matériaux lumineux
   --------------------------------------------------------------- */
const MATS = {};
const LUMINEUX = [];   // { m, jour, soir, champ } : intensité selon l'ambiance
function std(couleur, rough = .8, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(couleur), roughness: rough, metalness: metal }, extra));
}
function M(cle) {
  if (MATS[cle]) return MATS[cle];
  const [type, arg] = cle.split(':');
  let m;
  switch (type) {
    case 'mur': m = std('#F3EFE7', .92); break;
    case 'murChaud': m = std('#EDE3D3', .9); break;
    case 'poche': m = std('#2A2226', .7); break;
    // socle et table : légèrement repoussés en profondeur, les sols posés dessus passent toujours devant
    case 'socle': m = std('#EAE4D8', .95); m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; break;
    case 'sol': m = std('#E6E0D3', 1); m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; break;
    case 'plafond': m = std('#F7F4EE', .95); break;
    case 'noir': m = std('#1D1B1F', .45, .6); break;
    case 'noirMat': m = std('#232126', .85); break;
    case 'laiton': m = std('#C8A15A', .32, 1); break;
    case 'or': m = std('#D4AF62', .25, 1); break;
    case 'bronze': m = std('#7A5530', .45, .85); break;
    case 'chrome': m = std('#DCDDE0', .12, 1); break;
    case 'alu': m = std('#2B2A2E', .4, .8); break;
    case 'chene': m = std('#C9A57A', .6); break;
    case 'noyer': m = std('#5E3F2B', .55); break;
    case 'travertin': m = std('#DCCDB4', .7); break;
    case 'marbreBlanc': m = std('#F0ECE5', .35); break;
    case 'blanc': m = std('#F6F4EF', .55); break;
    case 'drap': m = std('#F4F1EA', .9); break;
    case 'laque': m = std(arg || '#D9CCB6', .35); break;
    case 'cuir': m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(arg), roughness: .45, clearcoat: .25, clearcoatRoughness: .5 }); break;
    case 'velours': m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(arg), roughness: .85, sheen: 1, sheenRoughness: .45, sheenColor: new THREE.Color(arg).lerp(new THREE.Color('#ffffff'), .35) }); break;
    case 'boucle': m = std(arg, .98); break;
    case 'tissu': m = std(arg, .92); break;
    case 'plante': m = std(arg || '#4F6B3A', .85); break;
    case 'verre': m = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: .04, metalness: 0, transparent: true, opacity: .16, envMapIntensity: 1.6, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }); break;
    case 'bulle': m = new THREE.MeshPhysicalMaterial({ color: '#F4FAFF', roughness: .02, metalness: 0, transparent: true, opacity: .1, envMapIntensity: 2.2, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, emissive: new THREE.Color('#FFC27A'), emissiveIntensity: 0 }); LUMINEUX.push({ m, jour: 0, soir: .55 }); LUMINEUX.push({ m, jour: .1, soir: .19, champ: 'opacite' }); break;
    case 'fume': m = new THREE.MeshPhysicalMaterial({ color: '#5A5550', roughness: .08, transparent: true, opacity: .55, envMapIntensity: 1.4, clearcoat: 1 }); break;
    case 'cristal': m = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: .02, metalness: .1, transparent: true, opacity: .55, envMapIntensity: 2.4, clearcoat: 1, emissive: new THREE.Color('#FFE9C8'), emissiveIntensity: .12 }); LUMINEUX.push({ m, jour: .12, soir: .9 }); break;
    case 'opale': m = std('#FFFFFF', .6, 0, { emissive: new THREE.Color(arg || '#FFE3BC'), emissiveIntensity: .35 }); LUMINEUX.push({ m, jour: .35, soir: 2.2 }); break;
    case 'ambre': m = new THREE.MeshPhysicalMaterial({ color: '#D98A3A', roughness: .1, transparent: true, opacity: .8, emissive: new THREE.Color('#FF9A3C'), emissiveIntensity: .3, clearcoat: 1 }); LUMINEUX.push({ m, jour: .3, soir: 2 }); break;
    case 'led': m = new THREE.MeshBasicMaterial({ color: new THREE.Color(arg || '#FFB45E') }); m.userData.base = m.color.clone(); LUMINEUX.push({ m, jour: .9, soir: 3.2, champ: 'couleur' }); break;
    case 'fenetre': m = new THREE.MeshBasicMaterial({ map: tex('ciel'), toneMapped: true }); m.userData.base = new THREE.Color(1, 1, 1); LUMINEUX.push({ m, jour: 1.05, soir: .22, champ: 'couleur' }); break;
    case 'voilage': m = std('#FBF8F2', .95, 0, { transparent: true, opacity: .62, side: THREE.DoubleSide, emissive: new THREE.Color('#FFF6E6'), emissiveIntensity: .18 }); LUMINEUX.push({ m, jour: .35, soir: .05 }); break;
    case 'moquette': m = std('#FFFFFF', 1, 0, { map: tex('moquette') }); break;
    case 'parquet': m = std('#FFFFFF', .7, 0, { map: tex('parquet') }); break;
    case 'marbre': m = std('#FFFFFF', .28, 0, { map: tex('marbre') }); break;
    case 'dallage': m = std('#FFFFFF', .4, 0, { map: tex('dallage') }); break;
    case 'pierre': m = std('#FFFFFF', .9, 0, { map: tex('pierre') }); break;
    case 'pelouse': m = std('#FFFFFF', 1, 0, { map: tex('pelouse') }); m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; break;
    case 'terrasse': m = std('#FFFFFF', .85, 0, { map: tex('terrasse') }); break;
    case 'jungle': m = new THREE.MeshPhysicalMaterial({ map: tex('jungle'), roughness: .8, sheen: 1, sheenRoughness: .5, sheenColor: new THREE.Color('#5E7A5A') }); break;
    case 'mineral': m = new THREE.MeshPhysicalMaterial({ map: tex('mineral'), roughness: .75, sheen: 1, sheenRoughness: .4, sheenColor: new THREE.Color('#C9BFB0') }); break;
    case 'pinceau': m = std('#FFFFFF', .98, 0, { map: tex('pinceau') }); break;
    case 'corde': m = std('#FFFFFF', .95, 0, { map: tex('corde') }); break;
    case 'topo': m = std('#FFFFFF', .9, 0, { map: tex('cuirTopo') }); break;
    case 'oeuvre': m = std('#FFFFFF', .9, 0, { map: tex('oeuvre') }); break;
    case 'fibres': m = std('#FFFFFF', .9, 0, { map: tex('fibres'), emissive: new THREE.Color('#FFE2B0'), emissiveIntensity: .25, emissiveMap: tex('fibres') }); LUMINEUX.push({ m, jour: .25, soir: 1.6 }); break;
    case 'soie': m = std(arg || '#B7603B', .9, 0, { emissive: new THREE.Color(arg || '#B7603B'), emissiveIntensity: .25 }); LUMINEUX.push({ m, jour: .25, soir: 1.4 }); break;
    case 'plumes': m = std('#F1E8D8', .95, 0, { side: THREE.DoubleSide, emissive: new THREE.Color('#FFD9A6'), emissiveIntensity: .12 }); LUMINEUX.push({ m, jour: .12, soir: 1 }); break;
    case 'eau': {
      const n = tex('eau');
      m = new THREE.MeshPhysicalMaterial({ color: '#8DB4B8', roughness: .06, metalness: 0, transparent: true, opacity: .82, normalMap: n, normalScale: new THREE.Vector2(.35, .35), envMapIntensity: 1.8, clearcoat: 1 });
      break;
    }
    case 'cascade': m = new THREE.MeshBasicMaterial({ map: tex('ruissellement'), transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide, color: '#DDEFF4' }); break;
    case 'tache': m = new THREE.MeshBasicMaterial({ map: tex('tache'), transparent: true, depthWrite: false, opacity: .9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); break;
    case 'halo': m = new THREE.MeshBasicMaterial({ map: tex('halo'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .25, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); m.userData.halo = true; LUMINEUX.push({ m, jour: .18, soir: .95, champ: 'opacite' }); break;
    case 'flamme': m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FF9A3C'), transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }); m.userData.base = m.color.clone(); LUMINEUX.push({ m, jour: .7, soir: 2.4, champ: 'couleur' }); break;
    case 'fantome': m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .9, transparent: true, opacity: .28, depthWrite: false }); break;
    default: m = std(arg || '#cccccc');
  }
  m.name = cle;
  MATS[cle] = m;
  return m;
}

/* ---------------------------------------------------------------
   Ombres de contact : tache douce sous un objet (effet maquette)
   --------------------------------------------------------------- */
function ombreSol(parent, w, d, x = 0, z = 0, y = 0.004, force = 1) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M('tache'));
  p.rotation.x = -Math.PI / 2;
  p.position.set(x, y, z);
  p.renderOrder = 1;
  if (force !== 1) { p.material = M('tache').clone(); p.material.opacity = .9 * force; }
  p.userData.nonCuit = true;
  parent.add(p);
  return p;
}
function halo(parent, taille, x, y, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('halo'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .2 }));
  s.scale.set(taille, taille, 1);
  s.position.set(x, y, z);
  s.userData.nonCuit = true;
  s.userData.halo = true;
  LUMINEUX.push({ m: s.material, jour: .12, soir: .8, champ: 'opacite' });
  parent.add(s);
  return s;
}

/* ---------------------------------------------------------------
   Cuisson : fusionne les maillages statiques d'un groupe par matériau
   (beaucoup moins d'appels de dessin, surtout sur mobile)
   --------------------------------------------------------------- */
function cuire(racine) {
  racine.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(racine.matrixWorld).invert();
  const seaux = new Map();
  const aRetirer = [];
  racine.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.nonCuit || o.material.transparent || Array.isArray(o.material)) return;
    let p = o.parent, bloque = false;
    while (p && p !== racine) { if (p.userData.nonCuit) { bloque = true; break; } p = p.parent; }
    if (bloque) return;
    const cle = o.material.uuid + (o.castShadow ? 'c' : 'n');
    if (!seaux.has(cle)) seaux.set(cle, { m: o.material, ombre: o.castShadow, geos: [] });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    seaux.get(cle).geos.push(g);
    aRetirer.push(o);
  });
  aRetirer.forEach(o => o.parent && o.parent.remove(o));
  for (const s of seaux.values()) {
    const fusion = mergeGeometries(s.geos, false);
    if (!fusion) continue;
    const me = new THREE.Mesh(fusion, s.m);
    me.castShadow = s.ombre;
    me.receiveShadow = true;
    racine.add(me);
  }
}

/* =================================================================
   Visite 3D — objets : un modèle générique par produit du catalogue
   Origine au sol, centrée, face avant vers +z.
   Objets muraux : origine sur le mur. Suspensions : origine au plafond.
   ================================================================= */

const ANIMS = [];   // fonctions (t, dt) appelées à chaque image (eau, flammes...)

/* ---------- petits utilitaires de forme ---------- */
// Arc de tore horizontal centré vers l'arrière (-z) : dossiers enveloppants
function arcDos(parent, Rr, r, arc, m, y, z = 0, x = 0) {
  const g = new THREE.Group();
  const t = mesh(new THREE.TorusGeometry(Rr, r, 12, 40, arc), m);
  t.rotation.z = Math.PI / 2 - arc / 2;
  g.add(t);
  g.rotation.x = -Math.PI / 2;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
// Forme plane extrudée vers le haut (plan x-z) : assises courbes
function plat(parent, shape, h, m, y = 0, biseau = .03) {
  const me = extrude(parent, shape, h, m, biseau);
  me.rotation.x = -Math.PI / 2;
  me.position.y = y + biseau;
  return me;
}
// Coquille ouverte à l'avant (tour partiel) : fauteuils enveloppants
function coque(parent, profil, m, ouverture = .5, seg = 36) {
  const phiL = TAU * (1 - ouverture / 2);
  const g = new THREE.LatheGeometry(profil.map(p => new THREE.Vector2(p[0], p[1])), seg, Math.PI * ouverture / 2 + 0.0001, phiL);
  const mm = m.clone(); mm.side = THREE.DoubleSide;
  const me = mesh(g, mm);
  parent.add(me);
  return me;
}
function capsule(parent, r, long, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  return place(parent, mesh(new THREE.CapsuleGeometry(r, long, 6, 14), m), x, y, z, ry, rx, rz);
}
function pied(parent, r, h, m, x, z, y = 0) { return cyl(parent, r, r, h, m, x, y, z, 10); }
function tissu(look, mat) {
  const c = look.tete || look.couleur;
  return M((mat || 'velours') + ':' + c);
}

/* =================================================================
   LITS
   ================================================================= */
function literie(g, W, L, yMat, accent) {
  const zt = -L / 2;
  bloc(g, W - .04, .22, L - .1, M('drap'), 0, yMat, .02, .06);
  const yh = yMat + .22;
  // couette et retombées
  const lc = L * .66;
  bloc(g, W + .06, .07, lc, M('tissu:#EFEBE3'), 0, yh - .01, L / 2 - lc / 2 - .02, .03);
  bloc(g, .025, .3, lc, M('tissu:#EDE9E1'), -(W / 2 + .04), yh - .28, L / 2 - lc / 2 - .02, .01);
  bloc(g, .025, .3, lc, M('tissu:#EDE9E1'), W / 2 + .04, yh - .28, L / 2 - lc / 2 - .02, .01);
  bloc(g, W + .08, .3, .025, M('tissu:#EDE9E1'), 0, yh - .28, L / 2 - .03, .01);
  // plaid au pied du lit
  if (accent) bloc(g, W + .1, .075, .42, M('tissu:' + accent), 0, yh + .02, L / 2 - .38, .03);
  // oreillers
  const n = W > 1.9 ? 3 : 2, ow = (W - .16) / n;
  for (let i = 0; i < n; i++) {
    const o = bloc(g, ow - .04, .16, .4, M('drap'), -W / 2 + .08 + ow * (i + .5), yh, zt + .34, .07);
    o.rotation.x = -.35;
  }
  // coussins déco
  if (accent) {
    [-.28, .28].forEach(x => { const c = bloc(g, .46, .44, .13, M('velours:' + accent), x * (W / 1.8), yh + .02, zt + .6, .06); c.rotation.x = -.42; });
    const c = bloc(g, .4, .28, .1, M('velours:#D9CCB6'), 0, yh + .02, zt + .74, .05); c.rotation.x = -.35;
  }
  return yh;
}
function lit(look, o = {}) {
  const g = groupe('lit');
  const W = o.W || 1.8, L = o.L || 2.1, zt = -L / 2;
  const accent = o.accent === undefined ? '#B4532F' : o.accent;
  const s = look.style;
  let yb = .12, hb = .3;
  const mBase = M((s === 'vague' || s === 'panneaux' || s === 'signature' ? 'cuir' : s === 'tubes' ? 'boucle' : s === 'executive' ? 'tissu' : 'velours') + ':' + (look.base || look.tete));
  const mTete = M((s === 'vague' || s === 'panneaux' || s === 'signature' ? 'cuir' : s === 'tubes' ? 'boucle' : s === 'executive' ? 'tissu' : 'velours') + ':' + look.tete);

  if (s === 'vague') {
    // tête de lit ondulée + chevets intégrés + croix en laiton
    const Wt = W + 1.2, H = 1.12, sh = new THREE.Shape();
    sh.moveTo(-Wt / 2, 0); sh.lineTo(Wt / 2, 0); sh.lineTo(Wt / 2, H * .72);
    for (let i = 0; i <= 48; i++) { const u = i / 48, x = Wt / 2 - u * Wt; sh.lineTo(x, H * (.78 + .16 * Math.sin(u * Math.PI)) + .045 * Math.sin(u * TAU * 3)); }
    sh.lineTo(-Wt / 2, 0);
    const t = extrude(g, sh, .1, mTete, .02); t.position.z = zt - .12;
    const lignes = []; for (let x = -Wt / 2 + .1; x < Wt / 2 - .05; x += .12) lignes.push([x, .5, zt + .005, 0, 0, 0, 1, 1, 1, 1]);
    instances(g, new THREE.BoxGeometry(.007, .9, .01), M('laque:#7A391F'), lignes);
    [-1, 1].forEach(k => {
      bloc(g, .52, .4, .42, M('laque:' + (look.chevets || '#D9CCB6')), k * (W / 2 + .33), .2, zt + .21, .03);
      bloc(g, .46, .006, .01, M('laiton'), k * (W / 2 + .33), .42, zt + .425);
    });
    bloc(g, 1.3, .05, .09, M('laiton'), 0, .02, 0, .01);
    bloc(g, .09, .05, 1.5, M('laiton'), 0, .02, 0, .01);
    yb = .1;
  } else if (s === 'panneaux') {
    [-1, 1].forEach(k => bloc(g, W / 2 - .02, 1.02, .11, mTete, k * (W / 4 + .005), .08, zt - .05, .05));
    for (let x = -W / 2 + .12; x < W / 2; x += .15) bloc(g, .006, .86, .012, M('laque:#5E5046'), x, .16, zt + .012);
    yb = .12;
  } else if (s === 'ailes') {
    const fl = []; for (let x = -W / 2 - .02; x <= W / 2 + .02; x += .075) fl.push([x, .72, zt - .02, 0, 0, 0, 1]);
    instances(g, new THREE.CapsuleGeometry(.037, 1.1, 4, 10), mTete, fl, true);
    bloc(g, W + .14, 1.26, .08, mTete, 0, .06, zt - .08, .03);
    [-1, 1].forEach(k => {
      const a = bloc(g, .14, 1.16, .52, mTete, k * (W / 2 + .1), .06, zt + .18, .06); a.rotation.y = k * .22;
      const bras = tube(g, [[k * (W / 2 + .12), 1.1, zt + .3], [k * (W / 2 + .05), 1.18, zt + .42], [k * (W / 2 - .06), 1.12, zt + .5]], .008, M('or'), false, 12, 6);
      cyl(g, .025, .05, .07, M('or'), k * (W / 2 - .07), 1.06, zt + .5);
      sphere(g, .02, M('opale'), k * (W / 2 - .07), 1.06, zt + .5);
    });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .025, .1, M('or'), a * (W / 2 - .08), b * (L / 2 - .1)));
    yb = .1;
  } else if (s === 'duo') {
    bloc(g, W + .16, 1.06, .12, mBase, 0, .06, zt - .06, .06);
    bloc(g, W - .32, .8, .08, M('velours:' + look.tete), 0, .22, zt + .03, .04);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .012, .2, M('noir'), a * (W / 2 - .06), b * (L / 2 - .06)));
    yb = .2;
  } else if (s === 'galbe') {
    const Rr = W * .95, a = Math.asin((W / 2 + .12) / Rr), cz = zt + Rr - .02;
    const arc = couronne(g, Rr, Rr + .14, Math.PI / 2 - a, Math.PI / 2 + a, 1.05, mTete, .06);
    arc.position.z = cz;
    for (let i = -6; i <= 6; i++) { const aa = Math.PI / 2 + i / 6 * a * .92; bloc(g, .006, .9, .01, M('laque:#9C8A6E'), Math.cos(aa) * (Rr - .01), .12, cz - Math.sin(aa) * (Rr - .01), 0, aa - Math.PI / 2); }
    const pdl = place(g, mesh(new THREE.CylinderGeometry(.17, .17, W + .08, 32), mBase), 0, .3, L / 2 - .12, 0, 0, Math.PI / 2);
    for (let x = -W / 2; x <= W / 2; x += .12) tore(g, .172, .012, mBase, x, .3, L / 2 - .12, 0, TAU, 24).rotation.y = Math.PI / 2;
    yb = .1;
  } else if (s === 'tubes') {
    const n = Math.round((W + .3) / .19);
    for (let i = 0; i < n; i++) capsule(g, .09, .72, mTete, -((n - 1) * .19) / 2 + i * .19, .66, zt - .02);
    capsule(g, .12, L - .1, mBase, -(W / 2 + .1), .34, 0, Math.PI / 2);
    capsule(g, .12, L - .1, mBase, W / 2 + .1, .34, 0, Math.PI / 2);
    capsule(g, .12, W, mBase, 0, .34, L / 2 + .05, 0, 0, Math.PI / 2);
    yb = .08;
  } else if (s === 'signature' || s === 'executive') {
    const sig = s === 'signature', Wt = W + (sig ? 1.7 : 1.4), H = sig ? 1.45 : 1.25;
    bloc(g, Wt, H, .1, mTete, 0, .04, zt - .06, .04);
    const q = [], pas = sig ? .21 : .24;
    for (let x = -Wt / 2 + pas / 2; x < Wt / 2; x += pas) for (let y = .16; y < H - .05; y += pas) q.push([x, y, zt + .005, 0, 0, 0, 1]);
    instances(g, new RoundedBoxGeometry(pas - .02, pas - .02, .045, 2, .02), mTete, q);
    [-1, 1].forEach(k => {
      const x = k * (W / 2 + .38);
      if (sig) {
        bloc(g, .56, .06, .38, M('noyer'), x, .52, zt + .19, .01);
        bloc(g, .5, .012, .34, M('verre'), x, .3, zt + .17);
        tube(g, [[x + k * .2, .75, zt + .02], [x + k * .2, .95, zt + .1], [x + k * .12, 1.02, zt + .18]], .008, M('chrome'), false, 10, 6);
        cyl(g, .085, .12, .15, M('opale:#FFE9C8'), x + k * .1, .92, zt + .2, 20, true).material.side = THREE.DoubleSide;
      } else {
        bloc(g, .5, .16, .38, M('noyer'), x, .38, zt + .19, .01);
        bloc(g, .5, .02, .38, M('marbreBlanc'), x, .54, zt + .19, .005);
        tube(g, [[x - k * .15, .56, zt + .05], [x - k * .15, .82, zt + .08], [x - k * .05, .9, zt + .16]], .007, M('chrome'), false, 10, 6);
        sphere(g, .025, M('opale'), x - k * .04, .88, zt + .17);
      }
    });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .014, .12, M('chrome'), a * (W / 2 - .08), b * (L / 2 - .08)));
    yb = .12;
  } else if (s === 'chesterfield') {
    bloc(g, W + .22, 1.4, .16, mTete, 0, .06, zt - .08, .07);
    const bt = [];
    for (let r0 = 0; r0 < 6; r0++) for (let x = -W / 2 + (r0 % 2 ? .12 : .02); x < W / 2 + .05; x += .2) bt.push([x, .45 + r0 * .15, zt + .005, 0, 0, 0, 1]);
    instances(g, new THREE.SphereGeometry(.018, 8, 6), M('velours:#5A3216'), bt);
    [-1, 1].forEach(k => { const a = bloc(g, .2, 1.26, .5, mTete, k * (W / 2 + .14), .06, zt + .16, .08); a.rotation.y = k * .35; });
    yb = .12;
  }

  // sommier
  if (s !== 'tubes') bloc(g, W + .08, hb, L, mBase, 0, yb, 0, .06);
  else bloc(g, W, .26, L - .06, M('chene'), 0, yb, 0, .02);
  const yMat = yb + (s === 'tubes' ? .26 : hb);
  literie(g, W, L, yMat, accent);

  // LED sous le sommier (effet flottant)
  if (look.led) {
    const led = bloc(g, W - .1, .012, L - .12, M('led'), 0, yb - .02, 0);
    led.castShadow = false;
    const hl = new THREE.Mesh(new THREE.PlaneGeometry(W + .9, L + .9), M('halo'));
    hl.rotation.x = -Math.PI / 2; hl.position.y = .006; hl.userData.nonCuit = true; g.add(hl);
  }
  ombreSol(g, W + .7, L + .5, 0, 0);
  return g;
}

/* =================================================================
   LUMINAIRES SUSPENDUS (origine au plafond)
   ================================================================= */
function cable(g, long, m = M('noir'), x = 0, z = 0, y0 = 0) {
  return cyl(g, .004, .004, long, m, x, y0 - long, z, 6);
}
function rosace(g, r = .06, m = M('blanc')) { return cyl(g, r, r, .025, m, 0, -.025, 0, 20); }

function suspension(look, o = {}) {
  const g = groupe('suspension');
  const d = o.h || .9;           // hauteur de descente
  const s = look.style;
  if (s === 'albatre') {
    rosace(g, .045, M('noir')); cable(g, d, M('noir'));
    for (let i = 0; i < 3; i++) sphere(g, .085, M('opale:#FFD8A8'), 0, -d - .02 - i * .105, 0, 1, .55, 1, 24);
    halo(g, .9, 0, -d - .12, 0);
  } else if (s === 'cylindre') {
    rosace(g, .05, M('noir')); cable(g, d, M('noir'));
    cyl(g, .14, .14, .38, M('soie:' + (look.couleur || '#B7603B')), 0, -d - .38, 0, 32, true).material.side = THREE.DoubleSide;
    tore(g, .142, .008, M('noir'), 0, -d, 0); tore(g, .142, .008, M('noir'), 0, -d - .38, 0);
    sphere(g, .05, M('opale:#FFB070'), 0, -d - .32, 0);
    halo(g, 1.1, 0, -d - .2, 0);
  } else if (s === 'tripode') {
    rosace(g, .05, M('noir')); cable(g, d - .2, M('noir'));
    [[.0, -.05], [2.1, -.18], [4.2, -.3]].forEach(([a, dy], i) => {
      const x = Math.cos(a) * .22, z = Math.sin(a) * .22;
      tube(g, [[0, -d + .2, 0], [x * .6, -d + .05, z * .6], [x, -d + dy, z]], .006, M('noir'), false, 8, 5);
      cyl(g, .17, .17, .012, M('opale'), x, -d + dy - .06, z, 32);
      tore(g, .06, .006, M('laiton'), x, -d + dy - .05, z);
    });
    halo(g, 1.2, 0, -d - .1, 0);
  } else if (s === 'arche') {
    [-.35, .35].forEach((x, i) => cable(g, d - (i ? .1 : 0), M('noir'), x, 0));
    const a = place(g, mesh(new THREE.CylinderGeometry(.19, .19, 1.3, 32, 1, true, 0, Math.PI), M('fibres')), 0, -d - .05, 0, 0, 0, Math.PI / 2);
    a.rotation.set(0, 0, Math.PI / 2); a.material.side = THREE.DoubleSide;
    const pl = []; for (let x = -.62; x <= .62; x += .05) pl.push([x, -d - .05, 0, 0, 0, 0, 1]);
    instances(g, new THREE.TorusGeometry(.19, .006, 4, 16, Math.PI), M('fibres'), pl.map(p => [p[0], p[1], p[2], 0, Math.PI / 2, 0, 1]));
    bloc(g, 1.26, .03, .06, M('noir'), 0, -d - .08, 0, .01);
    halo(g, 1.6, 0, -d - .2, 0);
  } else if (s === 'grappe') {
    rosace(g, .05, M('laiton')); cable(g, d - .25, M('laiton'));
    const c = cyl(g, .06, .24, .24, M('laiton'), 0, -d - .24, 0, 32, true); c.material = M('laiton').clone(); c.material.side = THREE.DoubleSide;
    const r = alea(42);
    for (let i = 0; i < 14; i++) { const a = r() * TAU, rr = r() * .17; sphere(g, .045 + r() * .025, M('opale'), Math.cos(a) * rr, -d - .06 - r() * .38, Math.sin(a) * rr, 1, 1, 1, 14); }
    halo(g, 1.2, 0, -d - .25, 0);
  } else if (s === 'noeud') {
    rosace(g, .04, M('laiton')); cable(g, d - .1, M('laiton'));
    const pts = []; for (let i = 0; i < 80; i++) { const u = i / 80 * TAU; pts.push([Math.cos(2 * u) * (.3 + .1 * Math.cos(3 * u)) * 1.3, -d - .1 + .08 * Math.sin(3 * u), Math.sin(2 * u) * (.3 + .1 * Math.cos(3 * u)) * .7]); }
    tube(g, pts, .012, M('laiton'), true, 160, 6);
    [[-.4, 0], [0, .1], [.4, 0]].forEach(([x, z]) => sphere(g, .07, M('opale'), x, -d - .14, z));
    halo(g, 1.3, 0, -d - .15, 0);
  } else if (s === 'galaxie') {
    rosace(g, .06, M('chrome')); cable(g, d - .3, M('chrome'));
    const ico = new THREE.IcosahedronGeometry(.3, 1), p = ico.attributes.position, vus = new Set(), l = [];
    for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (vus.has(k)) continue; vus.add(k); l.push([p.getX(i), -d - .3 + p.getY(i), p.getZ(i), 0, 0, 0, 1]); }
    instances(g, new THREE.SphereGeometry(.055, 14, 10), M('verre'), l);
    instances(g, new THREE.SphereGeometry(.014, 6, 5), M('opale:#FFB566'), l.map(t => [t[0] * .92, t[1], t[2] * .92, 0, 0, 0, 1]));
    sphere(g, .1, M('chrome'), 0, -d - .3, 0);
    halo(g, 1.4, 0, -d - .3, 0);
  } else if (s === 'lineaire') {
    [-.4, .4].forEach(x => cable(g, d - .15, M('chrome'), x, 0));
    bloc(g, .95, .02, .03, M('chrome'), 0, -d + .13, 0);
    const r = alea(9), l1 = [], l2 = [];
    for (let i = 0; i < 28; i++) { const t = [(r() - .5) * .9, -d + .05 - r() * .3, (r() - .5) * .12, 0, 0, 0, .7 + r() * .6]; (i % 2 ? l1 : l2).push(t); }
    instances(g, new THREE.SphereGeometry(.05, 12, 8), M('fume'), l1);
    instances(g, new THREE.SphereGeometry(.05, 12, 8), M('verre'), l2);
    instances(g, new THREE.SphereGeometry(.012, 6, 4), M('opale:#FFB566'), l1.concat(l2).map(t => [t[0], t[1], t[2], 0, 0, 0, 1]));
    halo(g, 1.4, 0, -d - .05, 0);
  } else {
    return lustre(look, o);
  }
  return g;
}

/* ---------- lustres ---------- */
function lustre(look, o = {}) {
  const g = groupe('lustre');
  const d = o.h || .6, s = look.style, r = alea(s.length * 7);
  if (s === 'spirale') {
    rosace(g, .12, M('chrome'));
    const cr = [];
    for (let i = 0; i < 7; i++) {
      const Rr = .78 - i * .075, y = -d - i * .19, cx = .1 * Math.cos(i * .9), cz = .1 * Math.sin(i * .9);
      tore(g, Rr, .012, M('chrome'), cx, y, cz);
      tore(g, Rr, .006, M('led:#FFE1B0'), cx, y + .012, cz);
      const n = Math.round(TAU * Rr / .045);
      for (let k = 0; k < n; k++) { const a = k / n * TAU; cr.push([cx + Math.cos(a) * Rr, y - .085, cz + Math.sin(a) * Rr, 0, 0, 0, 1, 1, .9 + r() * .3, 1]); }
      if (i === 0) [0, 2.1, 4.2].forEach(a => cable(g, d, M('chrome'), Math.cos(a) * Rr * .98, Math.sin(a) * Rr * .98));
    }
    instances(g, new THREE.CylinderGeometry(.011, .011, .16, 6), M('cristal'), cr);
    halo(g, 3, 0, -d - .6, 0);
  } else if (s === 'floral') {
    const rs = cyl(g, .45, .45, .04, M('blanc'), 0, -.04, 0, 40);
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, rr = .15 + r() * .32, y = -d + r() * .14, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      cyl(g, .004, .004, -y - .04, M('or'), x, y, z, 5);
      for (let p = 0; p < 5; p++) { const b = p / 5 * TAU; sphere(g, .04, M('opale'), x + Math.cos(b) * .035, y, z + Math.sin(b) * .035, 1, .35, 1, 10); }
    }
    const pm = []; for (let i = 0; i < 90; i++) { const a = r() * TAU, rr = r() * .42; pm.push([Math.cos(a) * rr, -d - .15 - r() * .75, Math.sin(a) * rr, 0, r() * 3, 0, 1, 1, .8 + r() * .8, 1]); }
    instances(g, new THREE.BoxGeometry(.015, .1, .015), M('cristal'), pm);
    halo(g, 2.4, 0, -d - .3, 0);
  } else if (s === 'anneaux') {
    rosace(g, .1, M('or'));
    const cr = [];
    [.62, .5, .38, .26].forEach((Rr, i) => {
      const y = -d - i * .17;
      tore(g, Rr, .014, M('or'), 0, y, 0);
      tore(g, Rr, .006, M('led:#FFD9A0'), 0, y - .01, 0);
      const n = Math.round(TAU * Rr / .035);
      for (let k = 0; k < n; k++) { const a = k / n * TAU; cr.push([Math.cos(a) * Rr, y - .05, Math.sin(a) * Rr, 0, -a, 0, 1]); }
      [0, 2.1, 4.2].forEach(a => cable(g, d + i * .17, M('or'), Math.cos(a) * Rr, Math.sin(a) * Rr));
    });
    instances(g, new THREE.BoxGeometry(.025, .07, .02), M('cristal'), cr);
    halo(g, 2.2, 0, -d - .3, 0);
  } else if (s === 'matrice') {
    const cu = [], ca = [];
    for (let i = 0; i < 9; i++) for (let k = 0; k < 9; k++) {
      const x = -1.3 + i * .325, z = -1.3 + k * .325;
      const ymin = -d - .2 - r() * 2.2;
      ca.push([x, ymin / 2, z, 0, 0, 0, 1, 1, -ymin, 1]);
      const nb = 1 + (r() * 3 | 0);
      for (let c = 0; c < nb; c++) { const t = .1 + r() * .14; cu.push([x, ymin + c * .3, z, 0, r() * 3, 0, 1, t / .2, t / .2, t / .2]); }
    }
    instances(g, new THREE.CylinderGeometry(.002, .002, 1, 4), M('chrome'), ca);
    instances(g, new THREE.BoxGeometry(.2, .2, .2), M('cristal'), cu);
    bloc(g, 2.8, .04, 2.8, M('chrome'), 0, -.04, 0);
    halo(g, 4.5, 0, -d - 1.2, 0);
  } else if (s === 'ondes') {
    for (let i = 0; i < 8; i++) {
      const Rr = 1.5 - i * .13, y = -d - i * .24, pts = [];
      for (let k = 0; k < 90; k++) { const a = k / 90 * TAU; pts.push([Math.cos(a) * Rr, y + .07 * Math.sin(a * 5 + i), Math.sin(a) * Rr]); }
      tube(g, pts, .02, M('led:#FFF0D8'), true, 180, 6);
      tube(g, pts.map(p => [p[0], p[1] + .03, p[2]]), .014, M('chene'), true, 180, 5);
      if (i === 0) [0, 1.6, 3.2, 4.7].forEach(a => cable(g, d, M('chrome'), Math.cos(a) * Rr, Math.sin(a) * Rr));
    }
    halo(g, 5, 0, -d - .9, 0);
  } else if (s === 'infini') {
    [1.25, 1.02, .8, .6, .42].forEach((Rr, i) => {
      const t = tore(g, Rr, .03, M('alu'), 0, -d - i * .32, 0);
      t.rotation.x = Math.PI / 2 + (i % 2 ? .12 : -.1);
      const l = tore(g, Rr, .012, M('led:#F4F7FF'), 0, -d - i * .32 - .03, 0);
      l.rotation.x = t.rotation.x;
      cable(g, d + i * .32, M('chrome'), Rr * .7, 0);
    });
    halo(g, 4.2, 0, -d - .7, 0);
  }
  return g;
}

/* =================================================================
   APPLIQUES (origine sur le mur, face +z)
   ================================================================= */
function applique(look) {
  const g = groupe('applique');
  if (look.style === 'orbe') {
    const p = place(g, mesh(new THREE.CylinderGeometry(.1, .1, .02, 32), M('noyer')), 0, 0, .01, 0, Math.PI / 2);
    p.scale.set(.75, 1, 1.9);
    bloc(g, .05, .03, .1, M('noir'), 0, -.015, .05);
    sphere(g, .075, M('opale'), 0, 0, .12);
    cyl(g, .045, .06, .03, M('noir'), 0, .07, .12, 16); cyl(g, .06, .045, .03, M('noir'), 0, -.1, .12, 16);
    halo(g, .8, 0, 0, .18);
  } else if (look.style === 'capsule') {
    cyl(g, .05, .05, .015, M('laiton'), 0, -.007, .007, 20).rotation.x = Math.PI / 2;
    bloc(g, .02, .02, .08, M('laiton'), 0, -.01, .05);
    cyl(g, .01, .01, .4, M('laiton'), 0, -.2, .1, 8);
    tour(g, [[0, -.19], [.05, -.17], [.075, -.08], [.06, 0], [.08, .08], [.05, .17], [0, .19]], M('ambre'), 0, 0, .1, 28);
    halo(g, .9, 0, 0, .16);
  } else {
    bloc(g, .05, .72, .012, M('laiton'), 0, -.36, .006, .005);
    [-.24, 0, .24].forEach((y, i) => { bloc(g, .03, .02, .08, M('laiton'), 0, y - .01, .045); sphere(g, .11 - i * .01, M('opale:#FFE0B8'), (i - 1) * .015, y, .12, 1.1, .45, .8, 18); });
    halo(g, 1, 0, 0, .18);
  }
  return g;
}

/* =================================================================
   LAMPADAIRE
   ================================================================= */
function lampadaire(look) {
  const g = groupe('lampadaire');
  const r = alea(5);
  tube(g, [[0, .02, 0], [.03, .5, .02], [-.02, 1.0, -.01], [.02, 1.45, .01], [0, 1.6, 0]], .025, M('or'), false, 30, 8);
  [0, 1.6, 3.2, 4.7].forEach(a => tube(g, [[0, .15, 0], [Math.cos(a) * .12, .05, Math.sin(a) * .12], [Math.cos(a) * .22, .015, Math.sin(a) * .22]], .014, M('or'), false, 10, 6));
  const pl = [];
  for (let i = 0; i < 34; i++) { const a = i / 34 * TAU + r() * .2, inc = .5 + r() * .5; pl.push([Math.cos(a) * .22, 1.6 + Math.cos(inc) * .05, Math.sin(a) * .22, 0, -a, inc - .25, 1, 1.4, .12, .55]); }
  instances(g, new THREE.SphereGeometry(.18, 10, 6), M('plumes'), pl);
  sphere(g, .05, M('opale'), 0, 1.58, 0);
  halo(g, 1.6, 0, 1.6, 0);
  ombreSol(g, .8, .8);
  return g;
}

/* =================================================================
   FAUTEUILS ET TABOURETS
   ================================================================= */
function fauteuil(look) {
  const g = groupe('fauteuil');
  const s = look.style, c = look.couleur;
  if (s === 'bourrelets') {
    const m = M('velours:' + c);
    bloc(g, .82, .2, .78, m, 0, 0, 0, .09);
    bloc(g, .62, .16, .56, m, 0, .2, .08, .07);
    [[.36, .4, .1], [.33, .55, .095], [.29, .7, .09]].forEach(([Rr, y, r]) => arcDos(g, Rr, r, Math.PI * 1.25, m, y, -.02));
  } else if (s === 'tub') {
    const m = M('cuir:' + c);
    coque(g, [[.3, 0], [.4, 0], [.43, .3], [.41, .66], [.36, .68], [.33, .4]], m, .55);
    cyl(g, .34, .36, .38, m, 0, 0, .02, 32);
    bloc(g, .55, .12, .5, m, 0, .38, .05, .06);
    bloc(g, .42, .22, .1, m, 0, .5, -.22, .05);
    bloc(g, .012, .3, .2, M('or'), .42, .3, -.1, .004);
  } else if (s === 'terra') {
    const m = M('velours:' + c);
    [-1, 1].forEach(k => bloc(g, .15, .62, .8, m, k * .34, 0, 0, .06));
    bloc(g, .54, .22, .72, m, 0, 0, 0, .04);
    bloc(g, .54, .15, .64, m, 0, .22, .06, .06);
    const d = bloc(g, .54, .46, .15, m, 0, .35, -.3, .06); d.rotation.x = -.12;
  } else if (s === 'cocon') {
    const m = M('pinceau');
    tour(g, [[0, .1], [.4, .1], [.47, .32], [.46, .6], [.41, .72], [.36, .7], [.37, .45], [.3, .32], [0, .32]], m, 0, 0, 0, 40);
    cyl(g, .3, .34, .1, M('noirMat'), 0, 0, 0, 24);
    [-.2, 0, .2].forEach((x, i) => { const cu = bloc(g, .3, .3, .09, M('boucle:#E4DCCD'), x, .38, -.2 + Math.abs(x) * .3, .04); cu.rotation.set(-.3, -x * 1.5, 0); });
  } else if (s === 'luge') {
    const m = M('boucle:' + c), bois = M('noirMat');
    [-1, 1].forEach(k => tube(g, [[k * .34, .02, .38], [k * .34, .02, -.36], [k * .34, .3, -.4], [k * .34, .55, -.28], [k * .34, .52, .1], [k * .34, .46, .34]], .025, bois, false, 40, 8));
    bloc(g, .62, .14, .6, m, 0, .28, .03, .06);
    const d = bloc(g, .62, .44, .14, m, 0, .38, -.3, .06); d.rotation.x = -.2;
  } else if (s === 'bergere') {
    const m = M('velours:' + c);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .012, .16, M('or'), a * .3, b * .28));
    bloc(g, .74, .26, .68, m, 0, .16, 0, .06);
    bloc(g, .74, .78, .18, m, 0, .38, -.3, .09);
    [-1, 1].forEach(k => bloc(g, .13, .26, .62, m, k * .31, .42, .02, .06));
    const bt = []; for (let r0 = 0; r0 < 4; r0++) for (let x = -.24 + (r0 % 2) * .08; x <= .25; x += .16) bt.push([x, .62 + r0 * .13, -.205, 0, 0, 0, 1]);
    instances(g, new THREE.SphereGeometry(.014, 8, 6), M('velours:#172755'), bt);
  } else if (s === 'pivotant') {
    const m = M('cuir:' + c);
    [0, 1, 2, 3].forEach(i => { const b = bloc(g, .6, .03, .05, M('chrome'), 0, 0, 0, .01); b.rotation.y = i * Math.PI / 4 + Math.PI / 8; });
    cyl(g, .04, .05, .3, M('chrome'), 0, .02, 0, 12);
    cyl(g, .34, .34, .16, m, 0, .32, 0, 32);
    coque(g, [[.33, .4], [.4, .42], [.42, .8], [.38, 1.1], [.33, 1.12], [.34, .8]], m, .7);
  } else if (s === 'coquille') {
    const m = M('cuir:' + c);
    coque(g, [[.3, 0], [.4, 0], [.43, .3], [.42, .74], [.36, .76], [.33, .45]], m, .7);
    const fl = []; for (let i = 0; i < 16; i++) { const a = Math.PI * .35 + i / 15 * Math.PI * 1.3; fl.push([Math.sin(a) * .43, .38, Math.cos(a) * .43, 0, a, 0, 1]); }
    instances(g, new THREE.CapsuleGeometry(.035, .62, 4, 8), m, fl);
    bloc(g, .56, .14, .56, m, 0, .28, .05, .06);
    cyl(g, .34, .36, .28, m, 0, 0, 0, 28);
  } else if (s === 'wingback') {
    const m = M('cuir:' + c);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => sphere(g, .03, M('laiton'), a * .3, .03, b * .3));
    bloc(g, .76, .3, .72, m, 0, .06, 0, .05);
    bloc(g, .6, .14, .6, m, 0, .36, .05, .06);
    bloc(g, .76, .82, .17, m, 0, .36, -.3, .07);
    [-1, 1].forEach(k => { capsule(g, .09, .5, m, k * .34, .56, .05, Math.PI / 2); const w = bloc(g, .13, .5, .34, m, k * .34, .66, -.18, .05); w.rotation.y = k * .3; });
    const bt = []; for (let r0 = 0; r0 < 4; r0++) for (let x = -.24 + (r0 % 2) * .08; x <= .25; x += .16) bt.push([x, .6 + r0 * .13, -.21, 0, 0, 0, 1]);
    instances(g, new THREE.SphereGeometry(.013, 8, 6), M('cuir:#5A2E12'), bt);
  }
  ombreSol(g, 1.1, 1.1);
  return g;
}
function tabouret(look) {
  const g = groupe('tabouret');
  if (look.style === 'fleur') {
    const m = M('velours:' + look.couleur);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; sphere(g, .12, m, Math.cos(a) * .11, .78, Math.sin(a) * .11, 1, .38, 1, 16); }
    sphere(g, .1, m, 0, .79, 0, 1, .4, 1, 16);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .78; tube(g, [[Math.cos(a) * .2, 0, Math.sin(a) * .2], [Math.cos(a) * .13, .74, Math.sin(a) * .13]], .011, M('chrome'), false, 4, 6); }
    tore(g, .18, .01, M('chrome'), 0, .3, 0);
  } else {
    const m = M('cuir:#EFE5D3');
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .014, .72, M('noir'), a * .18, b * .17));
    bloc(g, .46, .1, .44, m, 0, .72, 0, .04);
    bloc(g, .46, .42, .07, m, 0, .8, -.2, .03);
    bloc(g, .3, .28, .01, M('cuir:' + look.couleur), 0, .88, -.163, .005);
    bloc(g, .4, .015, .4, M('laiton'), 0, .28, 0, .005);
  }
  ombreSol(g, .6, .6);
  return g;
}

/* =================================================================
   CANAPÉS ET BANC
   ================================================================= */
function canape(look) {
  const g = groupe('canape');
  const s = look.style;
  if (s === 'siena') {
    const m = M('velours:' + look.couleur);
    bloc(g, 2.3, .42, .95, m, -.35, 0, 0, .14);
    bloc(g, .95, .42, 1.35, m, 1.25, 0, .68, .14);
    bloc(g, 2.9, .78, .24, m, 0, 0, -.36, .12);
    bloc(g, .24, .78, 1.9, m, 1.62, 0, .45, .12);
    bloc(g, .24, .6, .95, m, -1.52, 0, 0, .12);
    for (let i = 0; i < 3; i++) bloc(g, .7, .12, .7, m, -1.1 + i * .72, .42, .06, .06);
  } else if (s === 'galets') {
    const m = M('boucle:' + look.couleur), md = M('boucle:' + look.dossier);
    [-.95, 0, .95].forEach((x, i) => {
      const p = tour(g, [[0, 0], [.42, 0], [.5, .08], [.5, .3], [.44, .4], [0, .41]], m, x, 0, .05, 32);
      p.scale.set(1.08, 1, .92);
      sphere(g, .26, md, x, .62, -.34, 1.3, 1, .75, 20);
    });
  } else if (s === 'mineral' || s === 'tablettes') {
    const m = s === 'mineral' ? M('mineral') : M('boucle:' + look.couleur);
    const Rr = 3, a = .44, cz = 2.6;
    const assise = couronne(g, Rr - .95, Rr, Math.PI / 2 - a, Math.PI / 2 + a, .42, m, 0, .05); assise.position.z = cz;
    const dos = couronne(g, Rr - .22, Rr + .02, Math.PI / 2 - a - .03, Math.PI / 2 + a + .03, .8, m, 0, .07); dos.position.z = cz;
    if (s === 'tablettes') [-1, 1].forEach(k => cyl(g, .26, .26, .5, M('noyer'), k * Math.sin(a + .08) * (Rr - .45), 0, cz - Math.cos(a + .08) * (Rr - .45), 28));
    else [-1, 1].forEach(k => { const b = bloc(g, .28, .62, .7, m, k * Math.sin(a) * (Rr - .45), 0, cz - Math.cos(a) * (Rr - .45), .13); b.rotation.y = -k * a; });
  } else if (s === 'cercle') {
    const m = M('jungle');
    for (let i = 0; i < 4; i++) {
      const a0 = i * Math.PI / 2 + .1, a1 = (i + 1) * Math.PI / 2 - .1;
      couronne(g, 1.25, 2.02, a0, a1, .42, m, 0, .05);
      couronne(g, 1.8, 2.06, a0, a1, .82, m, 0, .06);
    }
    cyl(g, .72, .72, .36, M('travertin'), 0, 0, 0, 40);
    cyl(g, .25, .25, .2, M('plante:#3C5A36'), 0, .36, 0, 16);
  } else if (s === 'topo') {
    const b = bloc(g, 1.75, .44, .62, M('topo'), 0, 0, 0, .18);
    [-.42, .42].forEach(x => sphere(g, .34, M('laque:#4A2F60'), x, .44, 0, 1, .12, .7, 20));
  }
  ombreSol(g, 3.2, 2.2);
  return g;
}

/* =================================================================
   BAIGNOIRES (axe long selon x)
   ================================================================= */
function baignoire(look) {
  const g = groupe('baignoire');
  const ext = M(look.style === 'cannelee' ? 'laque:' + look.ext : 'laque:' + look.ext), int = M('blanc');
  const e = tour(g, [[0, 0], [.6, 0], [.74, .12], [.8, .45], [.82, .6], [.79, .62]], ext, 0, look.style === 'griffe' ? .12 : 0, 0, 48);
  const i = tour(g, [[.79, .62], [.75, .45], [.64, .16], [0, .12]], int, 0, look.style === 'griffe' ? .12 : 0, 0, 48);
  [e, i].forEach(o => { o.scale.set(1.04, 1, .5); o.material.side = THREE.DoubleSide; });
  if (look.style === 'griffe') {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { sphere(g, .045, M('or'), a * .6, .05, b * .24); cyl(g, .02, .035, .08, M('or'), a * .6, .06, b * .24); });
    const dos = sphere(g, .32, ext, -.62, .62, 0, .7, .45, 1.1, 24); dos.scale.set(.5, .5, 1.1);
  }
  if (look.style === 'cannelee') {
    const fl = []; for (let k = 0; k < 64; k++) { const a = k / 64 * TAU; fl.push([Math.cos(a) * .8 * 1.04, .31, Math.sin(a) * .8 * .5, 0, 0, 0, 1]); }
    instances(g, new THREE.CapsuleGeometry(.018, .5, 4, 6), ext, fl);
  }
  bloc(g, .06, .04, .05, M('chrome'), -.82, .5, 0, .01);
  ombreSol(g, 2.2, 1.2);
  return g;
}

/* =================================================================
   SCULPTURES
   ================================================================= */
function silhouette(g, m, echelle = 1, pose = 'marche') {
  const s = echelle, h = new THREE.Group();
  if (pose === 'marche') {
    capsule(h, .045, .42, m, -.05, .3, .1, .35);
    capsule(h, .045, .42, m, .05, .3, -.1, -.3);
    capsule(h, .075, .32, m, 0, .78, 0, .08);
    sphere(h, .075, m, 0, 1.08, .03);
    capsule(h, .03, .34, m, -.14, .8, .1, -.6, 0, .2);
    capsule(h, .03, .34, m, .14, .8, -.08, .5, 0, -.2);
  } else {
    capsule(h, .05, .45, m, -.1, .32, .08, .1, 0, .15);
    capsule(h, .05, .45, m, .14, .3, -.05, -.25, 0, -.1);
    capsule(h, .08, .34, m, .02, .8, 0, .35, .4, .1);
    sphere(h, .08, m, .06, 1.1, .12);
    capsule(h, .035, .55, m, -.3, .95, -.1, .2, 0, 1.3);
    capsule(h, .035, .45, m, .3, .7, .1, -.4, 0, -.9);
    sphere(h, .07, m, -.62, 1.12, -.12, 1, .3, 1);
  }
  h.scale.setScalar(s);
  g.add(h);
  return h;
}
function sculpture(look) {
  const g = groupe('sculpture');
  if (look.style === 'marcheur') {
    bloc(g, .62, .12, .32, M('noirMat'), 0, 0, 0, .01);
    const h = silhouette(g, M('bronze'), 1, 'marche'); h.position.y = .12;
    tore(g, .46, .018, M('led:#FFC46A'), 0, .74, 0, 0);
    halo(g, 1.6, 0, .74, .1);
    ombreSol(g, 1, .7);
  } else {
    bloc(g, 1.1, .6, 1.1, M('travertin'), 0, 0, 0, .02);
    const h = silhouette(g, M('marbreBlanc'), 1.35, 'lancer'); h.position.y = .6;
    tore(g, 1.15, .045, M('led:#FFF1DA'), 0, 2.0, -.05, 0);
    tore(g, 1.15, .06, M('laque:#EDE7DC'), 0, 2.0, -.12, 0);
    [-1, 1].forEach(k => bloc(g, .08, .7, .08, M('laque:#EDE7DC'), k * .9, .6, -.12));
    halo(g, 3.2, 0, 2.0, .1);
    ombreSol(g, 2, 1.6);
  }
  return g;
}

/* =================================================================
   EXTÉRIEUR : bulles, fontaine, salons
   ================================================================= */
function bulle(look, o = {}) {
  const g = groupe('bulle');
  if (look.style === 'geodesique') {
    const Rr = o.R || 5;
    const ico = new THREE.IcosahedronGeometry(Rr, 3), p = ico.attributes.position;
    const aretes = new Map(), cle = v => v.x.toFixed(2) + ',' + v.y.toFixed(2) + ',' + v.z.toFixed(2);
    for (let i = 0; i < p.count; i += 3) {
      const t = [0, 1, 2].map(k => new THREE.Vector3(p.getX(i + k), p.getY(i + k), p.getZ(i + k)));
      [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => { if (t[a].y < -.01 || t[b].y < -.01) return; const k = [cle(t[a]), cle(t[b])].sort().join('|'); if (!aretes.has(k)) aretes.set(k, [t[a], t[b]]); });
    }
    const geos = [];
    aretes.forEach(([a, b]) => { const l = a.distanceTo(b), c = new THREE.CylinderGeometry(.028, .028, l, 5); c.translate(0, l / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); c.applyQuaternion(q); c.translate(a.x, a.y, a.z); geos.push(c.toNonIndexed()); });
    const struts = mesh(mergeGeometries(geos), M('alu')); g.add(struts);
    const peau = mesh(new THREE.SphereGeometry(Rr - .02, 64, 24, 0, TAU, 0, Math.PI / 2), M('bulle'), false);
    peau.userData.nonCuit = true; peau.renderOrder = 5; g.add(peau);
    tore(g, Rr, .07, M('alu'), 0, .02, 0);
    const zp = Math.sqrt(Rr * Rr - 2.5 * 2.5) - .05;
    [-1, 1].forEach(k => bloc(g, .08, 2.4, .08, M('alu'), k * .6, 0, zp));
    bloc(g, 1.28, .08, .08, M('alu'), 0, 2.4, zp);
  } else {
    const Rr = (look.diametre || 3.6) / 2, H = Rr + .8, yc = H - Rr, th = Math.acos(-yc / Rr), rs = Rr * Math.sin(th);
    const peau = mesh(new THREE.SphereGeometry(Rr, 48, 24, 0, TAU, 0, th), M('bulle'), false);
    peau.position.y = yc; peau.userData.nonCuit = true; peau.renderOrder = 5; g.add(peau);
    for (let i = 0; i < 6; i++) {
      const t = mesh(new THREE.TorusGeometry(Rr, .025, 6, 48, 2 * th), M('alu'));
      t.rotation.z = Math.PI / 2 - th;
      const pv = new THREE.Group(); pv.position.y = yc; pv.rotation.y = i / 6 * Math.PI; pv.add(t); g.add(pv);
    }
    tore(g, rs, .045, M('alu'), 0, .03, 0);
    tore(g, Rr * .92, .02, M('alu'), 0, yc + Rr * .38, 0);
    cyl(g, .22, .22, .08, M('alu'), 0, H - .07, 0, 16);
    const zp = Math.sqrt(Math.max(.2, Rr * Rr - .2 - Math.pow(1.9 - yc, 2)));
    [-1, 1].forEach(k => bloc(g, .05, 1.9, .05, M('alu'), k * .45, 0, zp));
    bloc(g, .95, .05, .05, M('alu'), 0, 1.9, zp);
  }
  return g;
}

function fontaine() {
  const g = groupe('fontaine');
  const tr = M('travertin');
  // bassin de 7 m
  tour(g, [[3.18, 0], [3.5, 0], [3.52, .45], [3.46, .52], [3.2, .52], [3.16, .45], [3.14, .05]], tr, 0, 0, 0, 96);
  const eau = new THREE.Mesh(new THREE.CircleGeometry(3.16, 96), M('eau'));
  eau.rotation.x = -Math.PI / 2; eau.position.y = .38; eau.userData.nonCuit = true; g.add(eau);
  M('eau').normalMap.repeat.set(3, 3);
  cyl(g, 3.16, 3.16, .05, M('laque:#4F6E70'), 0, 0, 0, 64);
  // colonne et vasques étagées
  tour(g, [[.55, 0], [.45, .15], [.3, .3], [.26, 1.0], [.2, 1.8], [.16, 2.5], [.1, 2.7], [0, 2.72]], tr, 0, .05, 0, 32);
  const vasques = [[1.55, .95, .22], [.95, 1.7, .18], [.52, 2.35, .14]];
  const nappes = [];
  vasques.forEach(([Rr, y, h]) => {
    tour(g, [[0, 0], [Rr * .3, 0], [Rr * .85, h * .6], [Rr, h], [Rr * .96, h + .03], [Rr * .8, h * .8], [0, h * .5]], tr, 0, y, 0, 64);
    const e = new THREE.Mesh(new THREE.CircleGeometry(Rr * .88, 48), M('eau')); e.rotation.x = -Math.PI / 2; e.position.y = y + h * .78; e.userData.nonCuit = true; g.add(e);
    const n = new THREE.Mesh(new THREE.CylinderGeometry(Rr * 1.01, Rr * 1.08, y + h - .38, 48, 1, true), M('cascade'));
    n.position.y = .38 + (y + h - .38) / 2; n.userData.nonCuit = true; n.renderOrder = 6; g.add(n); nappes.push(n);
  });
  sphere(g, .14, tr, 0, 2.86, 0);
  // jets : particules sur trajectoires paraboliques (animées sur le processeur graphique)
  const N = 700, pos = new Float32Array(N * 3), graine = new Float32Array(N);
  const r = alea(3);
  for (let i = 0; i < N; i++) { graine[i] = r(); pos[i * 3] = r() * TAU; pos[i * 3 + 1] = r(); pos[i * 3 + 2] = .6 + r() * .4; }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('graine', new THREE.BufferAttribute(graine, 1));
  const pm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, taille: { value: 26 } },
    vertexShader: `attribute float graine; uniform float t; uniform float taille; varying float vA;
      void main(){ float a = position.x; float ph = fract(position.y + t * (0.35 + 0.25 * position.z));
        float v = 1.35 * position.z; float d = ph * v * 1.1; float y = 2.9 + 1.2 * ph * position.z - 4.9 * ph * ph * 0.62;
        vec3 p = vec3(cos(a) * d, y, sin(a) * d); vA = (1.0 - ph) * smoothstep(0.0, 0.08, ph);
        if (y < 0.4) vA = 0.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = taille * (0.5 + graine) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(0.9, 0.96, 1.0, vA * (0.55 - d)); }`
  });
  const jets = new THREE.Points(pg, pm); jets.userData.nonCuit = true; jets.frustumCulled = false; g.add(jets);
  ANIMS.push((t) => {
    pm.uniforms.t.value = t;
    const nm = M('eau').normalMap; nm.offset.set(t * .015, t * .01);
    M('cascade').map.offset.y = -t * .6;
  });
  ombreSol(g, 8.5, 8.5, 0, 0, .004, .7);
  return g;
}

function salonFeu() {
  const g = groupe('salon-feu');
  const ecru = M('boucle:#E9E1D1'), anth = M('boucle:#46454A');
  for (let i = 0; i < 5; i++) {
    const a0 = -Math.PI / 2 + .55 + i * 1.05, a1 = a0 + .95, m = i < 3 ? ecru : anth;
    couronne(g, 1.25, 1.9, a0, a1, .4, m, 0, .05);
    couronne(g, 1.78, 1.98, a0, a1, .72, m, 0, .05);
    const la = []; for (let a = a0 + .05; a < a1; a += .09) la.push([Math.cos(a) * 2.0, .36, -Math.sin(a) * 2.0, 0, a, 0, 1]);
    instances(g, new THREE.BoxGeometry(.02, .7, .03), M('laiton'), la);
  }
  cyl(g, .62, .62, .32, M('noirMat'), 0, 0, 0, 40);
  cyl(g, .44, .44, .1, M('verre'), 0, .32, 0, 32);
  const fl = [];
  for (let i = 0; i < 5; i++) { const f = place(g, mesh(new THREE.ConeGeometry(.08 + (i % 2) * .04, .35, 10), M('flamme'), false), (i - 2) * .08, .5, (i % 2 - .5) * .1); f.userData.nonCuit = true; fl.push(f); }
  halo(g, 2.2, 0, .6, 0);
  ANIMS.push(t => fl.forEach((f, i) => { f.scale.y = .8 + .35 * Math.sin(t * 9 + i * 1.7) * Math.sin(t * 5.3 + i); f.scale.x = f.scale.z = .9 + .1 * Math.sin(t * 7 + i); }));
  ombreSol(g, 4.6, 4.6);
  return g;
}

function plante(g, x, z, h = 1.4, type = 'olivier', y = 0) {
  const r = alea(Math.round(x * 131 + z * 37 + 11));
  if (type === 'palmier') {
    tube(g, [[x, y, z], [x + .05, y + h * .5, z], [x - .03, y + h, z + .02]], .05, M('laque:#8A7358'), false, 12, 6);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + r(); const f = sphere(g, .45, M('plante:#5E7B42'), x + Math.cos(a) * .35, y + h - .05, z + Math.sin(a) * .35, 1, .08, .22, 10); f.rotation.y = -a; f.rotation.z = .5; }
    return;
  }
  tube(g, [[x, y, z], [x + .04, y + h * .45, z - .02], [x - .02, y + h * .7, z + .02]], .045, M('laque:#6E5A45'), false, 10, 6);
  const col = type === 'olivier' ? ['#7D8C62', '#6A7A52', '#8A9A6E'] : ['#4F6B3A', '#5C7A44', '#445E33'];
  for (let i = 0; i < 7; i++) sphere(g, h * (.16 + r() * .1), M('plante:' + col[i % 3]), x + (r() - .5) * h * .45, y + h * (.7 + r() * .3), z + (r() - .5) * h * .45, 1, .85, 1, 10);
}
function jardiniere() {
  const g = groupe('jardiniere');
  place(g, mesh(new THREE.SphereGeometry(.4, 28, 16, 0, TAU, .35, Math.PI * .55), M('laque:#F2F0EA')), 0, .32, 0);
  cyl(g, .32, .32, .02, M('laque:#5B4636'), 0, .56, 0, 20);
  plante(g, 0, 0, 1.7, 'olivier', .56);
  ombreSol(g, 1, 1);
  return g;
}
function salonCorde(look) {
  const g = groupe('salon-corde');
  const co = M('corde'), cu = M('tissu:' + look.coussins);
  const pieceS = (w, x, z, ry) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
    bloc(p, w, .36, .82, co, 0, 0, 0, .05);
    bloc(p, w - .14, .14, .68, cu, 0, .36, .04, .05);
    bloc(p, w, .42, .12, co, 0, .36, -.35, .04);
    for (let i = 0; i < Math.round(w / .6); i++) { const c = bloc(p, .5, .4, .14, cu, -w / 2 + .35 + i * .6, .46, -.24, .05); c.rotation.x = -.18; }
    [-1, 1].forEach(k => bloc(p, .1, .55, .82, co, k * (w / 2 - .05), 0, 0, .04));
  };
  pieceS(2.1, 0, -1.1, 0);
  pieceS(.86, -1.55, .3, Math.PI / 2);
  pieceS(.86, 1.55, .3, -Math.PI / 2);
  bloc(g, 1.1, .34, .62, co, 0, 0, .25, .03);
  bloc(g, 1.1, .03, .62, M('pierre'), 0, .34, .25);
  ombreSol(g, 4, 3.4);
  return g;
}
function meridienne() {
  const g = groupe('meridienne');
  const sh = new THREE.Shape();
  sh.moveTo(-.95, .32); sh.quadraticCurveTo(-.2, .26, .35, .34); sh.quadraticCurveTo(.75, .45, .9, .82); sh.lineTo(.8, .86); sh.quadraticCurveTo(.62, .52, .3, .44); sh.quadraticCurveTo(-.2, .38, -.95, .42); sh.closePath();
  const b = extrude(g, sh, .68, M('corde'), .02); b.rotation.y = Math.PI / 2; b.position.x = -.34;
  const c = extrude(g, sh, .6, M('tissu:#CFCBC4'), .015); c.rotation.y = Math.PI / 2; c.position.set(-.3, .06, 0); c.scale.set(1, .95, 1);
  [[-.3, -.8], [.3, -.8], [-.3, .7], [.3, .7]].forEach(([x, z]) => pied(g, .012, .32, M('noir'), x, z));
  ombreSol(g, 1, 2.1);
  return g;
}
function balancelles() {
  const g = groupe('balancelles');
  const cadre = M('laque:#CBBDA5'), co = M('corde'), toile = M('tissu:#E8DFCC');
  [-1, 1].forEach(k => {
    const p = new THREE.Group(); p.position.z = k * 1.05; p.rotation.y = k > 0 ? Math.PI : 0; g.add(p);
    [-1, 1].forEach(s => { tube(p, [[s * .8, 0, -.35], [s * .8, 2.05, 0], [s * .8, 0, .35]], .025, cadre, false, 6, 6); });
    bloc(p, 1.7, .05, .05, cadre, 0, 2.02, 0, .01);
    const t = place(p, mesh(new THREE.CylinderGeometry(.9, .9, 1.74, 24, 1, true, -Math.PI / 2 - .6, 1.2), toile), 0, 1.55, .35, 0, 0, Math.PI / 2);
    t.material.side = THREE.DoubleSide;
    bloc(p, 1.3, .1, .52, co, 0, .45, .08, .03);
    bloc(p, 1.3, .5, .07, co, 0, .5, -.16, .03).rotation.x = -.15;
    bloc(p, 1.16, .1, .44, M('tissu:#D9CFBD'), 0, .55, .09, .04);
    [-.62, .62].forEach(x => cyl(p, .006, .006, 1.5, M('laque:#8A7B64'), x, .52, .1, 4));
  });
  cyl(g, .38, .38, .03, M('travertin'), 0, .62, 0, 28);
  cyl(g, .04, .08, .62, cadre, 0, 0, 0, 12);
  ombreSol(g, 2.4, 3.2);
  return g;
}

/* ---------------------------------------------------------------
   Aiguillage : produit (sku) -> modèle générique
   --------------------------------------------------------------- */
const CAT_BUILD = {
  'Lit': lit, 'Suspension': suspension, 'Lustre': lustre, 'Applique': applique, 'Lampadaire': lampadaire,
  'Fauteuil': fauteuil, 'Tabouret de bar': tabouret, 'Canapé': canape, 'Banc': canape, 'Baignoire îlot': baignoire,
  'Sculpture': sculpture, 'Véranda bulle': bulle, 'Chambre bulle': bulle, 'Fontaine': () => fontaine(),
  'Salon extérieur': () => salonFeu(), 'Jardinière': () => jardiniere(), 'Salon de jardin': salonCorde,
  'Méridienne': () => meridienne(), 'Balancelles': () => balancelles()
};
function construireProduit(sku, o = {}) {
  const p = DATA.PRODUITS[sku];
  if (!p) return groupe('vide');
  let g;
  // pièces choisies : maquette détaillée ; reste du catalogue : maquette générique (v3d-catalogue.js)
  if (p.look) { const f = CAT_BUILD[p.cat]; g = f ? f(p.look, o) : groupe('vide'); }
  else g = construireCatalogue(p, o);
  g.userData.sku = sku;
  return g;
}

/* =================================================================
   Visite 3D — maquettes génériques du catalogue complet
   Chaque pièce de la boutique est modélisée grossièrement d'après sa
   famille, son style, ses dimensions (m), ses couleurs et sa matière,
   déduits de sa fiche Shopify (outils/catalogue.py).
   Mêmes conventions que les maquettes détaillées : origine au sol,
   centrée, face avant vers +z ; appliques : origine au mur ;
   suspensions : origine au plafond.
   ================================================================= */

/* ---------- matières et couleurs ---------- */
const TEINTE_DEF = { velours: '#B9A68A', cuir: '#8B5A34', boucle: '#E9E1D1', tissu: '#CFC6B6', fourrure: '#EFEAE0', corde: '#C8B89A', laque: '#E8E3DA', bois: '#CFC6B6' };
const coul = (p, i = 0) => (p.cols && p.cols[i]) || (i ? null : TEINTE_DEF[p.mat] || '#CFC6B6');
// assombrit (k < 1) ou éclaircit (k > 1) une couleur
function teinte(hex, k) {
  const c = new THREE.Color(hex);
  if (k > 1) c.lerp(new THREE.Color('#FFFFFF'), Math.min(1, k - 1)); else c.multiplyScalar(k);
  return '#' + c.getHexString();
}
function mTissu(p, i = 0) {
  const c = coul(p, i) || coul(p, 0);
  switch (p.mat) {
    case 'velours': return M('velours:' + c);
    case 'cuir': return M('cuir:' + c);
    case 'boucle': case 'fourrure': return M('boucle:' + c);
    case 'laque': return M('laque:' + c);
    case 'corde': return p.cols && p.cols[i] ? M('tissu:' + c) : M('corde');
    default: return M('tissu:' + c);
  }
}
const mAccent = p => (p.cols && p.cols[1] ? mTissu(p, 1) : mTissu(p, 0));
const mMetal = p => M(p.metal === 'laiton' ? 'laiton' : p.metal === 'chrome' ? 'chrome' : 'noir');
const mBois = p => (p.bois === 'chene' ? M('chene') : p.bois === 'teck' ? M('bois:#9C6B42') : M('noyer'));
// verre des luminaires
function mVerre(p) {
  switch (p.verre) {
    case 'fume': return M('fume');
    case 'ambre': return M('ambre');
    case 'cristal': return M('cristal');
    case 'clair': return M('cristal');
    default: return M('opale:' + (p.mat === 'albatre' ? '#FFD8A8' : '#FFE3BC'));
  }
}
const aTitre = (p, re) => re.test((p.titre || '').toLowerCase());

// boîte des éléments opaques d'un groupe (pour cadrer ou ajuster l'échelle)
function boiteOpaque(g) {
  const b = new THREE.Box3();
  g.updateMatrixWorld(true);
  g.traverse(o => { if (o.isMesh && !o.material.transparent && !(o.material.userData && o.material.userData.halo)) b.expandByObject(o); });
  if (b.isEmpty()) g.traverse(o => { if (o.isMesh) b.expandByObject(o); });
  return b;
}
// ramène un modèle à la largeur voulue (et sous une hauteur maximale)
function ajuster(g, largeur, hMax) {
  const b = boiteOpaque(g), s = b.getSize(V3());
  let k = largeur / Math.max(.05, s.x, s.z);
  if (hMax && s.y * k > hMax) k = hMax / s.y;
  k = clamp(k, .2, 3);
  const porteur = groupe(g.name);
  g.scale.setScalar(k);
  porteur.add(g);
  return porteur;
}

/* =================================================================
   LITS
   ================================================================= */
function litCat(p, o = {}) {
  const g = groupe('lit');
  const [Wt, Lt, Ht0] = p.dim, st = p.st, ch = p.chevets;
  const cw = p.couchage ? p.couchage[0] : clamp(ch ? Wt - 1.05 : Wt - .28, 1.4, 2.0);
  const W = cw + .08, L = clamp(p.couchage ? p.couchage[1] + .12 : Lt - .1, 2.0, 2.3);
  const Ht = clamp(Ht0, .85, 1.6), zt = -L / 2;
  const c0 = coul(p, 0), mT = mTissu(p, 0), mA = mAccent(p);
  const accent = o.accent === undefined ? '#B4532F' : o.accent;
  if (st === 'rond') return litRond(g, p, Wt, Ht, mT, mA, accent);
  const Wh = ch ? Math.max(Wt, W + .9) : clamp(Wt, W + .1, W + .5);
  const dos = (e = .12, r = .05, h = Ht) => bloc(g, Wh, h - .04, e, mT, 0, .04, zt - e / 2 - .01, r);
  switch (st) {
    case 'capitonne': case 'chesterfield': {
      dos(.13, .06);
      const bt = [], pas = .19;
      for (let r0 = 0, y = .42; y < Ht - .1; r0++, y += pas * .78) for (let x = -Wh / 2 + .12 + (r0 % 2) * pas / 2; x < Wh / 2 - .08; x += pas) bt.push([x, y, zt + .002, 0, 0, 0, 1]);
      instances(g, new THREE.SphereGeometry(.017, 8, 6), M('tissu:' + teinte(c0, .5)), bt);
      if (st === 'chesterfield') [-1, 1].forEach(k => { const a = bloc(g, .2, Ht - .14, .5, mT, k * (Wh / 2 + .06), .06, zt + .14, .08); a.rotation.y = k * .35; });
      break;
    }
    case 'matelasse': {
      dos(.1, .03);
      const q = [], pas = clamp(Ht / 5, .2, .3);
      for (let x = -Wh / 2 + pas / 2 + .02; x < Wh / 2 - .02; x += pas) for (let y = .2 + pas / 2; y < Ht - .03; y += pas) q.push([x, y - pas / 2, zt + .01, 0, 0, 0, 1]);
      instances(g, new RoundedBoxGeometry(pas - .02, pas - .02, .07, 2, .025), mT, q, true);
      break;
    }
    case 'cannele': {
      dos(.08, .03);
      const fl = []; for (let x = -Wh / 2 + .05; x <= Wh / 2 - .04; x += .08) fl.push([x, .3 + (Ht - .4) / 2, zt + .01, 0, 0, 0, 1]);
      instances(g, new THREE.CapsuleGeometry(.038, Ht - .48, 4, 10), mT, fl, true);
      break;
    }
    case 'galbe': {
      const Rr = Wh * .95, a = Math.asin(Math.min(.98, (Wh / 2) / Rr)), cz = zt + Rr - .02;
      const arc = couronne(g, Rr, Rr + .13, Math.PI / 2 - a, Math.PI / 2 + a, Ht, mT, 0, .06);
      arc.position.z = cz;
      for (let i = -6; i <= 6; i++) { const aa = Math.PI / 2 + i / 6 * a * .92; bloc(g, .006, Ht - .25, .01, M('tissu:' + teinte(c0, .7)), Math.cos(aa) * (Rr - .01), .15, cz - Math.sin(aa) * (Rr - .01), 0, aa - Math.PI / 2); }
      break;
    }
    case 'ailes': {
      dos(.12, .05);
      const fl = []; for (let x = -Wh / 2 + .05; x <= Wh / 2 - .04; x += .09) fl.push([x, .25 + (Ht - .3) / 2, zt + .015, 0, 0, 0, 1]);
      instances(g, new THREE.CapsuleGeometry(.04, Ht - .42, 4, 10), mT, fl, true);
      [-1, 1].forEach(k => { const a = bloc(g, .14, Ht * .9, .55, mT, k * (Wh / 2 + .05), .06, zt + .2, .06); a.rotation.y = k * .25; });
      break;
    }
    case 'nuage': {
      const sh = new THREE.Shape(), n = 60, asym = aTitre(p, /asym|arche/);
      sh.moveTo(-Wh / 2, 0); sh.lineTo(Wh / 2, 0);
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = Wh / 2 - u * Wh;
        const base = asym ? Ht * (.55 + .45 * Math.sin(Math.min(1, u * 1.25) * Math.PI / 2)) : Ht * (.8 + .2 * Math.sin(u * Math.PI));
        sh.lineTo(x, base - .07 + .07 * Math.abs(Math.sin(u * Math.PI * (asym ? 2 : 3))));
      }
      sh.closePath();
      const t = extrude(g, sh, .1, mT, .05); t.position.z = zt - .14;
      break;
    }
    case 'tubes': {
      const n = Math.round((Wh + .1) / .2);
      for (let i = 0; i < n; i++) capsule(g, .095, Ht - .5, mT, -((n - 1) * .2) / 2 + i * .2, Ht / 2 + .05, zt - .03);
      capsule(g, .11, L - .12, mT, -(W / 2 + .09), .34, 0, Math.PI / 2);
      capsule(g, .11, L - .12, mT, W / 2 + .09, .34, 0, Math.PI / 2);
      break;
    }
    case 'bois': {
      bloc(g, Wh, Ht - .04, .06, mBois(p), 0, .04, zt - .04, .01);
      const l = []; for (let x = -Wh / 2 + .04; x < Wh / 2; x += .07) l.push([x, (Ht + .04) / 2, zt + .005, 0, 0, 0, 1]);
      instances(g, new THREE.BoxGeometry(.035, Ht - .12, .02), M('bois:' + teinte('#5E3F2B', .8)), l);
      bloc(g, W - .1, Ht * .55, .08, mT, 0, .45, zt + .04, .03);
      break;
    }
    default:
      dos(.1, .04);
      bloc(g, Wh - .14, Ht * .62, .04, mA, 0, Ht * .3, zt + .01, .015);
  }
  // chevets intégrés
  if (ch) {
    const mc = p.bois ? mBois(p) : M('laque:' + (p.cols && p.cols[1] ? p.cols[1] : '#D9CCB6'));
    [-1, 1].forEach(k => {
      const x = k * (W / 2 + .06 + .26);
      bloc(g, .48, .2, .4, mc, x, .3, zt + .21, .02);
      sphere(g, .05, M('opale'), x + k * .1, .58, zt + .18);
      cyl(g, .006, .006, .08, M('laiton'), x + k * .1, .5, zt + .18, 6);
    });
  }
  // sommier et pieds
  const yb = .1;
  bloc(g, W + .08, .28, L, mT, 0, yb, 0, .06);
  const mp = p.bois ? mBois(p) : mMetal(p);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, .018, .018, yb + .01, mp, a * (W / 2 - .06), 0, b * (L / 2 - .08), 8));
  literie(g, W, L, yb + .28, accent);
  if (p.led) {
    const led = bloc(g, W - .1, .012, L - .12, M('led'), 0, yb - .02, 0);
    led.castShadow = false;
    const hl = new THREE.Mesh(new THREE.PlaneGeometry(W + .9, L + .9), M('halo'));
    hl.rotation.x = -Math.PI / 2; hl.position.y = .006; hl.userData.nonCuit = true; g.add(hl);
  }
  ombreSol(g, Wh + .7, L + .5, 0, 0);
  return g;
}
function litRond(g, p, Wt, Ht, mT, mA, accent) {
  const Rr = clamp(Wt / 2, .95, 1.3);
  cyl(g, Rr, Rr, .3, mT, 0, .06, 0, 48);
  cyl(g, Rr - .07, Rr - .07, .22, M('drap'), 0, .36, 0, 48);
  cyl(g, Rr - .02, Rr - .02, .06, M('tissu:#EFEBE3'), 0, .56, Rr * .25, 48).scale.set(1, 1, .75);
  const tete = couronne(g, Rr + .02, Rr + .16, Math.PI / 2 - 1.05, Math.PI / 2 + 1.05, Ht, mT, 0, .05);
  tete.position.z = 0;
  [-1, 1].forEach(k => { const a = sphere(g, .55, mA, k * Rr * .72, Ht * .55, -Rr * .55, .9, 1, .14, 24); a.rotation.y = k * .7; });
  [-.3, .3].forEach(x => { const o = bloc(g, .55, .16, .36, M('drap'), x, .58, -Rr * .55, .07); o.rotation.x = -.35; });
  if (accent) [-.25, .25].forEach(x => { const c = bloc(g, .42, .4, .12, M('velours:' + accent), x, .6, -Rr * .38, .05); c.rotation.x = -.42; });
  cyl(g, Rr * .9, Rr * .9, .06, M('noir'), 0, 0, 0, 40);
  ombreSol(g, Rr * 2.6, Rr * 2.6);
  return g;
}

/* =================================================================
   FAUTEUILS
   ================================================================= */
function piedsCat(g, type, l, pr, hp, mp) {
  const x = l / 2 - .07, z = pr / 2 - .07, coins = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  if (type === 'metal' || type === 'bois') coins.forEach(([a, b]) => cyl(g, .01, .018, hp, mp, a * x, 0, b * z, 8));
  else if (type === 'boule') coins.forEach(([a, b]) => sphere(g, .035, mp, a * x, .035, b * z, 1, 1, 1, 12));
  else if (type === 'etoile') {
    for (let i = 0; i < 4; i++) { const b = bloc(g, Math.min(l, pr) * .8, .03, .05, mp, 0, 0, 0, .01); b.rotation.y = i * Math.PI / 4 + Math.PI / 8; }
    cyl(g, .04, .05, hp, mp, 0, .02, 0, 12);
  } else if (type === 'disque') {
    cyl(g, Math.min(l, pr) * .34, Math.min(l, pr) * .36, .03, mp, 0, 0, 0, 32);
    cyl(g, .045, .045, hp, mp, 0, .02, 0, 12);
  } else if (type === 'luge') {
    [-1, 1].forEach(k => tube(g, [[k * x, .02, z + .03], [k * x, .02, -z], [k * x, hp + .06, -z - .02]], .016, mp, false, 16, 6));
  } else if (type === 'bascule') {
    [-1, 1].forEach(k => {
      const pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16 - .5; pts.push([k * x, .03 + u * u * .5, u * (pr + .25)]); }
      tube(g, pts, .022, mp, false, 24, 6);
      [-.25, .25].forEach(dz => cyl(g, .018, .018, hp, mp, k * x, .05, dz * pr, 6));
    });
  } else if (type === 'croix') {
    [-1, 1].forEach(k => { const b = bloc(g, .04, .04, Math.hypot(l, pr) * .75, mp, 0, hp * .5, 0, .01); b.rotation.set(0, k * Math.atan2(l, pr), 0); });
    coins.forEach(([a, b]) => cyl(g, .018, .018, hp, mp, a * x * .9, 0, b * z * .9, 6));
  }
}
// fauteuil « boîte » : caisse, coussins, dossier, accoudoirs
function fauteuilBoite(g, p, l, pr, h, sh, o) {
  const m = mTissu(p, 0), m2 = o.m2 || mAccent(p);
  const bw = o.bras === 'aucun' ? 0 : o.bras === 'fin' ? .08 : clamp(l * .16, .1, .19);
  const hp = o.pieds === 'plein' ? 0 : o.pieds === 'boule' ? .07 : o.pieds === 'bascule' ? .16 : o.hp || .14;
  const e = clamp(pr * .2, .13, .2), zd = -pr / 2 + e / 2;
  const caisse = o.caisse === false ? null : bloc(g, l, Math.max(.06, sh - hp - .13), pr, o.mc || m, 0, hp, 0, .05);
  bloc(g, l - 2 * bw - .02, .14, pr - e - .02, m2, 0, sh - .14, e / 2, .06);
  const hd = Math.max(.25, h - sh + .12);
  const d = bloc(g, l - .02, hd, e, m, 0, sh - .12, zd, .07);
  d.rotation.x = o.incline != null ? o.incline : -.12;
  if (o.coussinDos) { const c = bloc(g, l - 2 * bw - .1, hd * .6, .12, m2, 0, sh + .02, zd + e / 2 + .04, .05); c.rotation.x = -.18; }
  if (bw) [-1, 1].forEach(k => {
    if (o.bras === 'rond') capsule(g, bw * .5, pr - .22, m, k * (l / 2 - bw / 2), sh + .1, .03, Math.PI / 2);
    else if (o.bras === 'bois') { bloc(g, bw * .7, .04, pr - .04, mBois(p), k * (l / 2 - bw / 2), sh + .12, .01, .01); bloc(g, .04, sh + .12 - hp, .04, mBois(p), k * (l / 2 - bw / 2), hp, pr / 2 - .08); }
    else bloc(g, bw, (o.bras === 'fin' ? .14 : .24), pr - .03, m, k * (l / 2 - bw / 2), sh - .14, .015, .05);
  });
  if (o.ailes) [-1, 1].forEach(k => { const w = bloc(g, .12, hd * .58, pr * .42, m, k * (l / 2 - .05), sh - .12 + hd * .42, zd + pr * .17, .05); w.rotation.y = k * .22; });
  if (o.boutons) {
    const bt = [];
    for (let r0 = 0; r0 < 4; r0++) for (let x = -l / 2 + .16 + (r0 % 2) * .08; x <= l / 2 - .14; x += .16) bt.push([x, sh + .1 + r0 * (hd - .2) / 4, zd + e / 2 + .005, 0, 0, 0, 1]);
    const bb = instances(g, new THREE.SphereGeometry(.014, 8, 6), M('tissu:' + teinte(coul(p, 0), .5)), bt);
    bb.rotation.x = -.12 * .5;
  }
  piedsCat(g, o.pieds, l, pr, hp, o.mp || mMetal(p));
  return caisse;
}
function fauteuilCat(p) {
  const g = groupe('fauteuil');
  const l = clamp(p.dim[0], .45, 1.7), pr = clamp(p.dim[1], .4, 1.5), h = clamp(p.dim[2], .4, 2.1);
  const m = mTissu(p, 0), m2 = mAccent(p), met = mMetal(p);
  const sh = clamp(h * .5, .34, .46), st = p.st, R = Math.min(l, pr) / 2;
  const sansPied = aTitre(p, /sans pi[eè]tement|pi[eè]tement plein|directement au sol/);
  const piedBois = !!p.bois || aTitre(p, /bois/);
  const sx = l / Math.min(l, pr), sz = pr / Math.min(l, pr);
  const rond = () => { const s = groupe(); s.scale.set(sx, 1, sz); g.add(s); return s; };
  switch (st) {
    case 'club':
      fauteuilBoite(g, p, l, pr, Math.min(h, .85), sh, { bras: 'rond', pieds: 'boule', mp: M('laiton'), boutons: aTitre(p, /chester|capiton/), incline: -.08 });
      break;
    case 'bergere':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: 'fin', pieds: piedBois ? 'bois' : 'metal', mp: piedBois ? mBois(p) : M('or'), hp: .18, boutons: true, incline: -.05 });
      break;
    case 'haut':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: 'bloc', pieds: sansPied ? 'plein' : 'metal', ailes: true, boutons: aTitre(p, /capiton/), incline: -.06 });
      break;
    case 'bois':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: 'bois', pieds: 'bois', mp: mBois(p), caisse: false, coussinDos: true, incline: -.2, hp: sh - .14 });
      bloc(g, l - .04, .05, pr - .06, mBois(p), 0, sh - .19, 0, .01);
      break;
    case 'tubulaire': case 'corde': {
      const mt = st === 'corde' && !p.cols.length ? M('corde') : m;
      const x = l / 2 - .04, z = pr / 2 - .05;
      [-1, 1].forEach(k => tube(g, [[k * x, 0, z], [k * x, sh + .16, z - .02], [k * x, sh + .18, -z + .1], [k * x, h, -z - .02], [k * x, 0, -z]], .02, met, false, 40, 8));
      bloc(g, l - .1, .12, pr - .12, mt, 0, sh - .12, .02, .05);
      const d = bloc(g, l - .1, h - sh - .02, .1, mt, 0, sh - .02, -pr / 2 + .08, .05); d.rotation.x = -.2;
      break;
    }
    case 'relax':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: piedBois ? 'bois' : 'bloc', pieds: piedBois ? 'bois' : 'etoile', mp: piedBois ? mBois(p) : met, incline: -.32, caisse: !piedBois, coussinDos: true });
      bloc(g, l * .7, sh * .85, .48, m, 0, .06, pr / 2 + .38, .07);
      break;
    case 'bascule':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: 'bois', pieds: 'bascule', mp: mBois(p), caisse: false, coussinDos: true, incline: -.25 });
      bloc(g, l - .06, .04, pr - .08, mBois(p), 0, sh - .18, 0, .01);
      break;
    case 'pivotant': {
      const s = rond(), r = R;
      coque(s, [[r * .78, sh - .04], [r * .98, sh], [r * 1.02, sh + (h - sh) * .45], [r * .92, h], [r * .82, h - .02], [r * .84, sh + .1]], m, .62);
      cyl(s, r * .86, r * .86, .14, m2, 0, sh - .14, 0, 32);
      cyl(s, r * .8, r * .75, .12, m, 0, sh - .26, 0, 32);
      piedsCat(g, aTitre(p, /base bois|bois/) ? 'disque' : 'etoile', l, pr, sh - .26, aTitre(p, /bois/) ? mBois(p) : met);
      break;
    }
    case 'coque': {
      const s = rond(), r = R;
      coque(s, [[r * .72, sh - .08], [r * .96, sh - .04], [r * 1.02, sh + (h - sh) * .5], [r * .95, h], [r * .86, h - .02], [r * .86, sh + .08]], m, .58);
      cyl(s, r * .85, r * .82, .12, m2, 0, sh - .14, 0, 32);
      piedsCat(g, 'metal', l * .8, pr * .8, sh - .12, met);
      break;
    }
    case 'cocon': case 'fourrure': {
      const s = rond(), r = R;
      coque(s, [[r * .6, 0], [r * .95, .04], [r * 1.02, sh], [r * .98, h * .82], [r * .88, h], [r * .78, h * .96], [r * .82, sh + .05]], m, st === 'fourrure' ? .5 : .46);
      cyl(s, r * .84, r * .9, sh - .02, m, 0, 0, 0, 32);
      cyl(s, r * .82, r * .82, .12, m2, 0, sh - .06, 0, 32);
      if (st === 'fourrure' || p.mat === 'fourrure') {
        const r2 = alea(p.id.length * 7), fl = [];
        for (let i = 0; i < 70; i++) { const a = Math.PI * .3 + r2() * Math.PI * 1.4, y = r2() * h; fl.push([Math.sin(a) * r * 1.02, y, Math.cos(a) * r * 1.02, r2(), r2(), r2(), .7 + r2() * .6]); }
        instances(s, new THREE.IcosahedronGeometry(.06, 0), m, fl);
      }
      if (!sansPied && aTitre(p, /pi[eè]tement/)) piedsCat(g, 'metal', l * .8, pr * .8, .05, met);
      break;
    }
    case 'petales': {
      const s = rond(), r = R;
      cyl(s, r * .82, r * .9, sh - .02, m2, 0, 0, 0, 32);
      cyl(s, r * .8, r * .8, .12, m2, 0, sh - .08, 0, 32);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * .42 + i / (n - 1) * Math.PI * 1.16;
        const pe = sphere(s, 1, m, Math.sin(a) * r * .78, sh + (h - sh) * .42, Math.cos(a) * r * .78, r * .42, (h - sh) * .62 + .08, .09, 20);
        pe.rotation.y = a; pe.rotation.x = .12;
      }
      if (aTitre(p, /pivotant/)) piedsCat(g, 'disque', l, pr, .06, met);
      break;
    }
    case 'pouf': {
      if (aTitre(p, /torique|anneau|boa/)) {
        const t = tore(g, R * .66, R * .34, m, 0, R * .34, 0, Math.PI / 2, TAU, 40);
        t.scale.set(sx, sz, h / (R * .68));
      } else {
        sphere(g, 1, m, 0, h / 2, 0, l / 2, h / 2, pr / 2, 28);
        if (aTitre(p, /ours|bunny|lapin|rabbit/)) [-1, 1].forEach(k => sphere(g, 1, m, k * l * .22, h * .98, -pr * .1, l * .1, h * .22, pr * .06, 14));
      }
      break;
    }
    case 'sculptural': {
      bloc(g, l, sh - .12, pr, m, 0, 0, 0, .1);
      bloc(g, l * .78, .14, pr * .7, m2, 0, sh - .14, pr * .1, .07);
      const n = 3, r = R;
      for (let i = 0; i < n; i++) {
        const t = arcDos(g, r * (.95 - i * .08), clamp((h - sh) / 5, .07, .14), Math.PI * 1.25, m, sh + i * (h - sh) / (n + .3), -.02);
        t.scale.x = sx;
      }
      break;
    }
    case 'suspendu': {
      // pied en arc : il part de l'arrière du socle et passe derrière la nacelle
      const hb = Math.min(h, 2), yN = Math.max(.25, hb - 1.3);
      cyl(g, .34, .36, .04, met, 0, 0, 0, 32);
      tube(g, [[0, .03, -.3], [0, hb * .45, -.66], [0, hb - .12, -.42], [0, hb, .02]], .03, met, false, 30, 8);
      cyl(g, .006, .006, hb - yN - .86, met, 0, yN + .86, .05, 6);
      const s = groupe(); s.position.set(0, yN, .05); g.add(s);
      coque(s, [[.05, 0], [.3, .06], [.42, .3], [.4, .6], [.3, .78], [.1, .86]], m, .55);
      cyl(s, .3, .3, .1, m2, 0, .08, 0, 24);
      break;
    }
    default: {
      // lounge : caisse, accoudoirs pleins, piètement fin ou plein
      const pieds = sansPied ? 'plein' : aTitre(p, /4 branches|pivotant/) ? 'etoile' : aTitre(p, /croise/) ? 'croix' : piedBois ? 'bois' : 'metal';
      fauteuilBoite(g, p, l, pr, h, sh, { bras: aTitre(p, /sans accoudoirs/) ? 'aucun' : 'bloc', pieds, mp: piedBois ? mBois(p) : met, incline: -.14, boutons: aTitre(p, /capiton/) });
    }
  }
  ombreSol(g, l + .35, pr + .35);
  return g;
}

/* =================================================================
   CANAPÉS
   ================================================================= */
// une rangée d'assises : caisse, coussins, dossier, accoudoirs (bras : [gauche, droite])
function rangee(g, p, x, z, l, d, h, bras, o = {}) {
  const m = mTissu(p, 0), m2 = mAccent(p);
  const sh = o.sh || .42, hp = o.pieds ? .1 : 0, bw = .2, e = .22;
  const r = groupe(); r.position.set(x, 0, z); if (o.ry) r.rotation.y = o.ry; g.add(r);
  bloc(r, l, sh - hp - .12, d, m, 0, hp, 0, .06);
  const l0 = l - (bras[0] ? bw : 0) - (bras[1] ? bw : 0), x0 = -l / 2 + (bras[0] ? bw : 0);
  const n = Math.max(1, Math.round(l0 / .75)), lc = l0 / n;
  for (let i = 0; i < n; i++) bloc(r, lc - .02, .14, d - (o.dos === false ? .04 : e + .02), m2, x0 + lc * (i + .5), sh - .14, o.dos === false ? 0 : e / 2, .06);
  if (o.dos !== false) {
    bloc(r, l, h - sh + .12, e, m, 0, sh - .12, -d / 2 + e / 2, .08);
    for (let i = 0; i < n; i++) { const c = bloc(r, lc - .06, (h - sh) * .75, .14, m2, x0 + lc * (i + .5), sh - .02, -d / 2 + e + .06, .06); c.rotation.x = -.16; }
  }
  bras.forEach((b, i) => { if (b) bloc(r, bw, sh + .14 - hp, d, m, (i ? 1 : -1) * (l / 2 - bw / 2), hp, 0, .07); });
  if (o.pieds) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(r, .015, .015, hp, o.pieds, a * (l / 2 - .08), 0, b * (d / 2 - .08), 8));
  return r;
}
function canapeCat(p) {
  const g = groupe('canape');
  const l = clamp(p.dim[0], 1.2, 5), pr = clamp(p.dim[1], .6, 3.4), h = clamp(p.dim[2], .35, 1.1);
  const m = mTissu(p, 0), m2 = mAccent(p);
  const pieds = aTitre(p, /pi[eè]tement|pieds/) ? mMetal(p) : null;
  const bas = h < .52;
  switch (p.st) {
    case 'cercle': {
      const Rr = clamp(l / 2, 1.3, 2.4);
      for (let i = 0; i < 4; i++) {
        const a0 = i * Math.PI / 2 + .1, a1 = (i + 1) * Math.PI / 2 - .1;
        couronne(g, Rr - .8, Rr - .02, a0, a1, .42, m, 0, .05);
        couronne(g, Rr - .26, Rr, a0, a1, h, m, 0, .06);
      }
      cyl(g, (Rr - .8) * .7, (Rr - .8) * .7, .36, M('travertin'), 0, 0, 0, 40);
      ombreSol(g, Rr * 2.4, Rr * 2.4);
      return g;
    }
    case 'courbe': {
      if (bas) { vagues(g, p, l, pr, h); break; }
      const Rr = l * .9, a = Math.asin(Math.min(.95, (l / 2) / Rr)), d = Math.min(pr, 1.05), cz = Rr + .02 - pr / 2;
      const assise = couronne(g, Rr - d, Rr, Math.PI / 2 - a, Math.PI / 2 + a, .42, m, 0, .05); assise.position.z = cz;
      const dos = couronne(g, Rr - .22, Rr + .02, Math.PI / 2 - a - .02, Math.PI / 2 + a + .02, h, m2, 0, .07); dos.position.z = cz;
      if (!aTitre(p, /asym|chaise longue/)) [-1, 1].forEach(k => { const b = bloc(g, .24, .6, d, m, k * Math.sin(a) * (Rr - d / 2), 0, cz - Math.cos(a) * (Rr - d / 2), .1); b.rotation.y = -k * a; });
      else { const c = bloc(g, .9, .42, Math.min(1.6, pr + .5), m, l / 2 - .5, 0, .2, .12); c.rotation.y = -.25; }
      break;
    }
    case 'modules': {
      if (bas) { vagues(g, p, l, pr, h); break; }
      const d = Math.min(pr, 1.0), n = Math.max(2, Math.round(l / .95)), lm = l / n, galets = aTitre(p, /galet|nuage|cloud/);
      for (let i = 0; i < n; i++) {
        const x = -l / 2 + lm * (i + .5);
        if (galets) { const t = tour(g, [[0, 0], [.42, 0], [.5, .08], [.5, .3], [.44, .4], [0, .41]], m, x, 0, -pr / 2 + d / 2, 32); t.scale.set(lm / 1.0, 1, d / 1.0); sphere(g, .26, m2, x, .62, -pr / 2 + .2, lm * 1.2, 1, .7, 20); }
        else rangee(g, p, x, -pr / 2 + d / 2, lm - .02, d, h, [i === 0, i === n - 1], { dos: true });
      }
      if (pr > 1.5) rangee(g, p, l / 2 - .5, -pr / 2 + d + (pr - d) / 2, .98, pr - d, h, [false, true], { dos: false });
      break;
    }
    case 'angle': {
      const d = Math.min(pr, 1.02);
      rangee(g, p, -.02 - (pr > 1.3 ? .48 : 0), -pr / 2 + d / 2, l - (pr > 1.3 ? .98 : 0), d, h, [true, pr <= 1.3], { pieds });
      if (pr > 1.3) {
        rangee(g, p, l / 2 - .49, -pr / 2 + d / 2, .98, d, h, [false, true], { pieds });
        rangee(g, p, l / 2 - .49, -pr / 2 + d + (pr - d) / 2, .98, pr - d, h, [false, true], { dos: false, pieds });
        if (aTitre(p, / en u/)) rangee(g, p, -l / 2 + .49, -pr / 2 + d + (pr - d) / 2, .98, pr - d, h, [true, false], { dos: false, pieds });
      }
      break;
    }
    default:
      if (bas) { vagues(g, p, l, pr, h); break; }
      rangee(g, p, 0, 0, l, Math.min(pr, 1.1), h, [true, true], { pieds });
  }
  ombreSol(g, l + .4, pr + .4);
  return g;
}
// canapé bas sans dossier : boudins arrondis côte à côte
function vagues(g, p, l, pr, h) {
  const n = Math.max(3, Math.round(l / .29)), w = l / n, m = mTissu(p, 0), m2 = mAccent(p);
  for (let i = 0; i < n; i++) capsule(g, Math.min(w * .5, h * .5), Math.max(.05, pr - h), i % 2 && p.cols.length > 1 ? m2 : m, -l / 2 + w * (i + .5), h / 2, 0, Math.PI / 2);
}

/* =================================================================
   LUMINAIRES
   ================================================================= */
// place le corps d'une suspension : descente du câble, hauteur disponible
function geometrieSuspension(p, o) {
  const hMax = o.hMax || 1.7;
  const hb = clamp(Math.min(p.dim[2], hMax - .25), .1, 2.4);
  const d = clamp(Math.min(o.h || .9, hMax - hb), .12, 3.5);
  return { hb, d, l: clamp(p.dim[0], .12, 3), pr: clamp(p.dim[1], .06, 3) };
}
function suspensionCat(p, o = {}) {
  const g = groupe('suspension');
  const { hb, d, l, pr } = geometrieSuspension(p, o);
  const met = mMetal(p), mv = mVerre(p), r = alea(p.id.length * 13 + 1);
  const yc = -d - hb / 2;
  const cables = (pts) => pts.forEach(([x, z, y0]) => cable(g, (y0 != null ? -y0 : d), met, x, z));
  rosace(g, .05, met);
  switch (p.st) {
    case 'cylindre': {
      if (l > .8 && pr < .5) {           // arche horizontale en tissu plissé
        cables([[-l * .28, 0], [l * .28, 0]]);
        const a = place(g, mesh(new THREE.CylinderGeometry(pr * .7, pr * .7, l, 32, 1, true, 0, Math.PI), M('fibres')), 0, -d - .04, 0, 0, 0, Math.PI / 2);
        a.rotation.set(0, 0, Math.PI / 2); a.material.side = THREE.DoubleSide;
        bloc(g, l - .04, .025, .05, met, 0, -d - .06, 0, .01);
      } else {
        cables([[0, 0]]);
        const rr = l / 2, mt = p.mat === 'tissu' ? M('soie:' + coul(p, 0)) : mv;
        const c = cyl(g, rr, rr, hb, mt, 0, -d - hb, 0, 32, true); c.material.side = THREE.DoubleSide;
        tore(g, rr, .007, met, 0, -d, 0); tore(g, rr, .007, met, 0, -d - hb, 0);
        sphere(g, .04, M('opale'), 0, -d - hb * .8, 0);
      }
      break;
    }
    case 'empile': {
      if (l > .5) {                      // trois diffuseurs sur une armature
        cables([[0, 0]]);
        [[0, -.05], [2.1, -.18], [4.2, -.3]].forEach(([a, dy]) => {
          const x = Math.cos(a) * l * .28, z = Math.sin(a) * pr * .28;
          tube(g, [[0, -d + .05, 0], [x * .6, -d - .05, z * .6], [x, -d + dy - hb * .3, z]], .006, met, false, 8, 5);
          cyl(g, .17, .17, .012, mv, x, -d + dy - hb * .3 - .06, z, 32);
        });
      } else {
        cables([[0, 0]]);
        for (let i = 0; i < 3; i++) sphere(g, l / 2, mv, 0, -d - l * .3 - i * hb / 3, 0, 1, .55, 1, 24);
      }
      break;
    }
    case 'grappe': {
      cables([[0, 0]]);
      if (p.metal !== 'noir' || aTitre(p, /armature|structure/)) sphere(g, .05, met, 0, yc + hb * .4, 0);
      const n = clamp(Math.round(l * 30), 10, 40), rr = l / 2;
      const liste = [];
      for (let i = 0; i < n; i++) { const a = r() * TAU, k = Math.sqrt(r()) * rr * .85; liste.push([Math.cos(a) * k, yc + (r() - .5) * hb * .8, Math.sin(a) * k * (pr / l), 0, 0, 0, .7 + r() * .5]); }
      instances(g, new THREE.SphereGeometry(clamp(l * .09, .04, .09), 14, 10), mv, liste);
      if (aTitre(p, /petales|nuage/)) instances(g, new THREE.SphereGeometry(.09, 10, 6), M('fume'), liste.slice(0, 10).map(t => [t[0], t[1] + .03, t[2], r() * 3, 0, r() * 3, 1, 1, .2, 1]));
      break;
    }
    case 'cristal': {
      cables([[0, 0]]);
      const feuilles = aTitre(p, /feuille|lotus|corail/), n = feuilles ? 26 : 60, liste = [];
      for (let i = 0; i < n; i++) {
        const u = i / n, a = u * TAU * (feuilles ? 2.2 : 4), rr = (l / 2) * (feuilles ? .5 + r() * .5 : 1 - u * .7);
        liste.push([Math.cos(a) * rr, -d - u * hb, Math.sin(a) * rr * (pr / l), r() * .6, a, r() * .6, 1]);
      }
      if (feuilles) instances(g, new THREE.SphereGeometry(.09, 10, 6), p.metal === 'laiton' ? M('laiton') : mv, liste.map(t => t.concat([1, 1.4, .25])));
      else instances(g, new THREE.CylinderGeometry(.012, .012, .14, 6), M('cristal'), liste);
      sphere(g, .05, M('opale'), 0, yc, 0);
      break;
    }
    case 'sputnik': {
      cables([[0, 0]]);
      sphere(g, .06, met, 0, yc, 0);
      const n = 18, liste = [], bouts = [];
      for (let i = 0; i < n; i++) {
        const v = V3(r() - .5, (r() - .5) * .8, r() - .5).normalize(), L = l / 2 * (.7 + r() * .3);
        const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), v), e = new THREE.Euler().setFromQuaternion(q);
        liste.push([v.x * L / 2, yc + v.y * L / 2, v.z * L / 2, e.x, e.y, e.z, 1, 1, L / .1, 1]);
        bouts.push([v.x * L, yc + v.y * L, v.z * L, 0, 0, 0, 1]);
      }
      instances(g, new THREE.CylinderGeometry(.005, .005, .1, 5), met, liste);
      instances(g, aTitre(p, /cylindre/) ? new THREE.CylinderGeometry(.025, .025, .09, 10) : new THREE.SphereGeometry(.035, 10, 8), aTitre(p, /multicolore/) ? M('laque:#D9543E') : M('opale'), bouts);
      break;
    }
    case 'anneau': {
      const vertical = pr < l * .5;
      if (vertical) {                     // anneaux vus de face
        cables([[-l * .3, 0], [l * .3, 0]]);
        const n = aTitre(p, /double/) ? 2 : 1;
        for (let i = 0; i < n; i++) { const t = tore(g, l / 2 - i * .12, .015, met, i * .1, yc, 0, 0); t.rotation.set(0, 0, 0); }
        if (aTitre(p, /globe|sph[eè]re|perles|beads/)) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .45; sphere(g, .07, mv, Math.cos(a) * l * .45, yc + Math.sin(a) * l * .45, 0); }
        else tore(g, l / 2, .01, M('led:#FFE1B0'), 0, yc, .012, 0);
      } else {                            // anneaux horizontaux superposés
        cables([[0, 0]]);
        const n = aTitre(p, /superpos|layers/) ? 3 : aTitre(p, /double/) ? 2 : 1;
        for (let i = 0; i < n; i++) { const rr = l / 2 * (1 - i * .18), y = -d - i * hb / Math.max(1, n); tore(g, rr, .02, met, 0, y, 0); tore(g, rr, .01, M('led:#FFE1B0'), 0, y - .018, 0); [0, 2.1, 4.2].forEach(a => cable(g, d + i * hb / Math.max(1, n), met, Math.cos(a) * rr, Math.sin(a) * rr)); }
        if (aTitre(p, /globe|sph[eè]re|perles|beads|cluster/)) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; sphere(g, .06, mv, Math.cos(a) * l * .3, -d - hb * .6 - (i % 3) * .06, Math.sin(a) * l * .3); }
        if (aTitre(p, /disque/)) cyl(g, l * .3, l * .3, .02, M('opale'), 0, -d - .02, 0, 32);
      }
      break;
    }
    case 'lineaire': {
      cables([[-l * .4, 0], [l * .4, 0]]);
      if (aTitre(p, /ruban|ribbon/)) {
        const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40 - .5; pts.push([u * l, yc + Math.sin(u * TAU * 1.5) * hb * .35, Math.cos(u * TAU) * pr * .3]); }
        tube(g, pts, .02, p.mat === 'acrylique' ? M('opale') : met, false, 80, 6);
        tube(g, pts.map(q => [q[0], q[1] - .03, q[2]]), .012, M('led:#FFE9C8'), false, 80, 5);
      } else if (aTitre(p, /etag[eè]re|shelf/)) {
        bloc(g, l, .03, pr, M('laque:' + coul(p, 0)), 0, -d - .03, 0, .01);
        bloc(g, l - .04, .008, pr - .04, M('led:#FFE9C8'), 0, -d - .04, 0);
      } else {
        bloc(g, l, .02, .03, met, 0, -d, 0);
        const n = Math.max(3, Math.round(l / .16)), liste = [];
        for (let i = 0; i < n; i++) liste.push([-l / 2 + l * (i + .5) / n, -d - .05 - r() * hb * .8, (r() - .5) * pr * .6, 0, 0, 0, .8 + r() * .5]);
        const cylindres = aTitre(p, /cylindr|modules/);
        instances(g, cylindres ? new THREE.CylinderGeometry(.03, .03, .12, 12) : new THREE.SphereGeometry(.05, 12, 8), cylindres ? M('laiton') : mv, liste);
        if (aTitre(p, /crois|lignes/)) { const b = bloc(g, l * .8, .015, .02, met, 0, -d - hb * .5, 0); b.rotation.y = .5; }
      }
      break;
    }
    case 'tresse': {
      cables([[0, 0]]);
      if (aTitre(p, /tubes/) && !aTitre(p, /spheri/)) {
        const n = 14, liste = [];
        for (let i = 0; i < n; i++) { const a = r() * TAU, k = r() * l / 2; liste.push([Math.cos(a) * k, -d - hb * (.2 + r() * .6), Math.sin(a) * k * (pr / l), 0, 0, 0, 1, 1, .8 + r() * 1.2, 1]); }
        instances(g, new THREE.CylinderGeometry(.02, .02, .3, 10), aTitre(p, /laiton|dor/) ? M('laiton') : M('opale'), liste);
        if (aTitre(p, /rouge/)) tube(g, liste.slice(0, 8).map(t => [t[0], t[1] + .1, t[2]]), .006, M('laque:#B8262B'), false, 40, 5);
      } else {
        const k = new THREE.TorusKnotGeometry(l * .32, .018, 120, 8, 3, 5);
        const t = place(g, mesh(k, M('led:#FFDDB0')), 0, yc, 0);
        t.scale.set(1, hb / (l * .8), 1);
        if (aTitre(p, /spheres|trois/)) { const t2 = place(g, mesh(new THREE.TorusKnotGeometry(l * .2, .014, 90, 6, 2, 3), M('led:#FFDDB0')), l * .3, yc - hb * .4, 0); t2.rotation.y = .6; }
      }
      break;
    }
    default: {                          // globe(s)
      if (l > .8 && pr < .6) {            // arc de globes
        cables([[-l * .4, 0], [l * .4, 0]]);
        const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20 - .5; pts.push([u * l, -d - Math.cos(u * Math.PI) * hb * .5, 0]); }
        tube(g, pts, .012, met, false, 40, 6);
        [-.3, 0, .3].forEach(u => sphere(g, .09, mv, u * l, -d - Math.cos(u * Math.PI) * hb * .5 - .08, 0));
      } else {
        cables([[0, 0]]);
        sphere(g, Math.min(l, hb) / 2, mv, 0, yc, 0, 1, 1, pr / l, 28);
      }
    }
  }
  halo(g, clamp(l * 1.8, .9, 3), 0, yc, 0);
  return g;
}
function lustreCat(p, o = {}) {
  const hMax = o.hMax || 2.2, l = clamp(p.dim[0], .4, 3.2);
  if (p.st === 'cascade') {
    const g = groupe('lustre');
    const pr = clamp(p.dim[1], .3, 2), hb = clamp(Math.min(p.dim[2], hMax - .1), .3, 2), d = Math.min(o.h || .2, .3);
    bloc(g, l, .04, pr, mMetal(p), 0, -.04 - d, 0, .01);
    if (d > .02) [[-1, -1], [1, 1]].forEach(([a, b]) => cable(g, d, mMetal(p), a * l * .4, b * pr * .4));
    const liste = [], r = alea(5);
    for (let x = -l / 2 + .04; x < l / 2; x += .06) for (let z = -pr / 2 + .04; z < pr / 2; z += .08) liste.push([x, -d - .04 - hb * (.5 + r() * .45) / 2, z, 0, 0, 0, 1, 1, hb * (.5 + r() * .45) / .2, 1]);
    instances(g, new THREE.CylinderGeometry(.008, .008, .2, 6), M('cristal'), liste);
    halo(g, l * 1.8, 0, -d - hb / 2, 0);
    return g;
  }
  const style = { matrice: 'matrice', floral: 'floral', infini: 'infini', spirale: 'spirale', ondes: 'ondes' }[p.st];
  if (!style) return suspensionCat(Object.assign({}, p, { st: 'anneau' }), o);
  return ajuster(lustre({ style }, { h: o.h || .3 }), l, hMax);
}
function appliqueCat(p) {
  const g = groupe('applique');
  const l = clamp(p.dim[0], .06, .8), h = clamp(p.dim[2], .15, 1.1), pr = clamp(p.dim[1], .05, .3);
  const met = mMetal(p), mv = mVerre(p);
  switch (p.st) {
    case 'tube': {
      const n = aTitre(p, /double|dual|duo/) ? 2 : 1;
      bloc(g, Math.max(.05, l * .6), .05, .02, met, 0, -.025, .01, .005);
      for (let i = 0; i < n; i++) { const x = n > 1 ? (i - .5) * Math.max(.05, l * .6) : 0; capsule(g, Math.min(.05, pr * .4), h - .1, aTitre(p, /ambr/) ? M('ambre') : mv, x, 0, pr * .6); cyl(g, .008, .008, h, met, x, -h / 2, pr * .6, 6); }
      break;
    }
    case 'vasques': {
      bloc(g, .05, h, .012, met, 0, -h / 2, .006, .004);
      for (let i = 0; i < 3; i++) { const y = -h / 2 + h * (i + .5) / 3; bloc(g, .03, .02, pr * .6, met, 0, y - .01, pr * .3); sphere(g, l / 2 - i * .01, mv, 0, y, pr * .7, 1.1, .42, .75, 18); }
      break;
    }
    case 'cadre': {
      bloc(g, l, h, .03, met, 0, -h / 2, .015, .005);
      bloc(g, l - .05, h - .05, .012, aTitre(p, /strie|lames/) ? M('cristal') : M('opale'), 0, -h / 2 + .025, .035);
      break;
    }
    case 'grille': {
      const nx = Math.max(1, Math.round(l / .2)), ny = Math.max(1, Math.round(h / .2)), liste = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) liste.push([-l / 2 + l * (i + .5) / nx, -h / 2 + h * (j + .5) / ny, .04, 0, 0, 0, 1]);
      bloc(g, l, h, .02, met, 0, -h / 2, .01, .004);
      instances(g, new RoundedBoxGeometry(l / nx - .02, h / ny - .02, .05, 2, .02), M('opale'), liste);
      break;
    }
    default: {
      const bois = aTitre(p, /bois/);
      const pl = place(g, mesh(new THREE.CylinderGeometry(l / 2, l / 2, .02, 32), bois ? mBois(p) : met), 0, 0, .01, 0, Math.PI / 2);
      pl.scale.set(1, 1, h / l);
      bloc(g, .04, .03, .1, met, 0, -.015, .05);
      sphere(g, Math.min(l, h) * .42, mv, 0, 0, .1 + Math.min(l, h) * .3);
    }
  }
  halo(g, clamp(h * 1.8, .6, 1.6), 0, 0, .15);
  return g;
}
function lampadaireCat(p) {
  const g = groupe('lampadaire');
  const h = clamp(p.dim[2], .9, 2.2), met = mMetal(p);
  cyl(g, .16, .18, .03, met, 0, 0, 0, 24);
  cyl(g, .012, .012, h - .3, met, 0, .03, 0, 8);
  const c = cyl(g, .12, .22, .3, M('soie:' + coul(p, 0)), 0, h - .3, 0, 28, true); c.material.side = THREE.DoubleSide;
  halo(g, 1.4, 0, h - .2, 0);
  ombreSol(g, .7, .7);
  return g;
}
function plafonnierCat(p) {
  const g = groupe('plafonnier');
  const l = clamp(p.dim[0], .2, 1.2);
  tore(g, l / 2, .03, aTitre(p, /bois/) ? mBois(p) : mMetal(p), 0, -.08, 0);
  sphere(g, l * .3, M('opale'), 0, -.1, 0);
  halo(g, l * 2.4, 0, -.15, 0);
  return g;
}

/* =================================================================
   BAIGNOIRES (axe long selon x)
   ================================================================= */
function baignoireCat(p) {
  const g = groupe('baignoire');
  const l = clamp(p.dim[0], 1.1, 2.1), pr = clamp(p.dim[1], .6, 1.6), h = clamp(p.dim[2], .45, .9);
  const noir = p.fc === 'sombre';
  const mExt = M('laque:' + (noir ? '#1F1D22' : '#F4F2EC')), mInt = M('blanc');
  const st = p.st;
  if (st === 'rect' || st === 'balneo') {
    bloc(g, l, h, pr, mExt, 0, 0, 0, .07);
    bloc(g, l - .14, .012, pr - .14, M('laque:#E3E1DB'), 0, h - .006, 0, .005);
    if (st === 'balneo') {
      const n = 6; for (let i = 0; i < n; i++) cyl(g, .018, .018, .008, M('chrome'), -l / 2 + .25 + i * (l - .5) / (n - 1), h + .004, (i % 2 ? 1 : -1) * (pr / 2 - .1), 10);
      capsule(g, .05, .22, M('noir'), -l / 2 + .12, h + .03, 0, 0, 0, Math.PI / 2);
      if (aTitre(p, /double|2 appuie|deux/)) capsule(g, .05, .22, M('noir'), l / 2 - .12, h + .03, 0, 0, 0, Math.PI / 2);
      bloc(g, .12, .02, .08, M('noir'), l / 2 - .2, h, pr / 2 - .06, .005);
      if (p.led) { const led = bloc(g, l - .1, .012, .012, M('led:#8FD3FF'), 0, .05, pr / 2 + .002); led.castShadow = false; }
    }
    ombreSol(g, l + .5, pr + .4);
    return g;
  }
  if (st === 'angle') {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(l, 0); s.absarc(0, 0, l, 0, Math.PI / 2, false); s.lineTo(0, 0);
    const e = extrude(g, s, h, mExt, .03); e.rotation.x = -Math.PI / 2; e.position.set(-l / 2, 0, pr / 2);
    ombreSol(g, l + .4, l + .4);
    return g;
  }
  // ovale, cannelée, griffe, slipper : coque tournée puis étirée
  const pied = st === 'griffe' ? .12 : 0;
  const e = tour(g, [[0, 0], [.36, 0], [.44, .1], [.48, .72], [.5, .97], [.485, 1]], mExt, 0, pied, 0, 48);
  const i = tour(g, [[.485, 1], [.45, .75], [.38, .2], [0, .16]], mInt, 0, pied, 0, 48);
  [e, i].forEach(m => { m.scale.set(l, h - pied, pr); m.material = m.material.clone(); m.material.side = THREE.DoubleSide; });
  if (st === 'griffe' || st === 'slipper') {
    const dos = sphere(g, .5, mExt, -l * .36, h * .92, 0, l * .45, h * .45, pr * 1.02, 24);
    dos.scale.set(l * .28, h * .5, pr * 1.02);
  }
  if (st === 'griffe') [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { sphere(g, .045, M('or'), a * l * .34, .05, b * pr * .3); cyl(g, .02, .035, .09, M('or'), a * l * .34, .06, b * pr * .3); });
  if (st === 'cannelee') {
    const fl = []; for (let k = 0; k < 64; k++) { const a = k / 64 * TAU; fl.push([Math.cos(a) * l * .485, h * .5, Math.sin(a) * pr * .485, 0, -a, 0, 1]); }
    instances(g, new THREE.CapsuleGeometry(.018, h * .75, 4, 6), mExt, fl);
  }
  bloc(g, .06, .04, .05, M('chrome'), -l / 2 + .02, h - .12, 0, .01);
  ombreSol(g, l + .5, pr + .5);
  return g;
}

/* =================================================================
   ASSISES D'APPOINT, SCULPTURES, EXTÉRIEUR
   ================================================================= */
function tabouretCat(p) {
  const g = groupe('tabouret');
  const h = clamp(p.dim[2], .4, 1.15), sh = h > .9 ? h * .68 : h, met = mMetal(p), m = mTissu(p, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, .012, .016, sh - .06, met, a * .16, 0, b * .16, 8));
  if (sh > .55) tore(g, .19, .009, M('laiton'), 0, sh * .35, 0);
  cyl(g, .21, .2, .09, m, 0, sh - .06, 0, 28);
  if (h > .9) { const d = bloc(g, .4, h - sh, .06, m, 0, sh, -.18, .03); d.rotation.x = -.1; }
  ombreSol(g, .6, .6);
  return g;
}
function bancCat(p) {
  const g = groupe('banc');
  const l = clamp(p.dim[0], .6, 2.6), pr = clamp(p.dim[1], .3, 1.1), m = mTissu(p, 0);
  const vache = aTitre(p, /vache/);
  const assise = bloc(g, l, .16, pr, vache ? M('cuir:#F2EEE6') : m, 0, .3, 0, .06);
  if (vache) {
    const r = alea(9), t = [];
    for (let i = 0; i < 9; i++) t.push([(r() - .5) * (l - .3), .463, (r() - .5) * (pr - .2), 0, r() * 3, 0, 1, .12 + r() * .12, .01, .08 + r() * .1]);
    instances(g, new THREE.SphereGeometry(1, 14, 6), M('cuir:#5E3A22'), t);
  }
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, .018, .022, .3, mMetal(p), a * (l / 2 - .08), 0, b * (pr / 2 - .08), 8));
  ombreSol(g, l + .4, pr + .4);
  return g;
}
function poufCat(p) {
  const g = groupe('pouf');
  const l = clamp(p.dim[0], .3, 1.2), h = clamp(p.dim[2], .2, .6);
  tour(g, [[0, 0], [l * .42, 0], [l * .5, h * .35], [l * .47, h * .8], [l * .3, h], [0, h]], mTissu(p, 0), 0, 0, 0, 32);
  ombreSol(g, l + .3, l + .3);
  return g;
}
function sculptureCat(p) {
  const g = groupe('sculpture');
  const l = clamp(p.dim[0], .3, 2), pr = clamp(p.dim[1], .2, 1.5), h = clamp(p.dim[2], .4, 2.6);
  if (p.st === 'arbre') {
    bloc(g, l, .4, pr, M('noirMat'), 0, 0, 0, .02);
    bloc(g, l - .06, .03, pr - .06, M('plante:#5F7A3E'), 0, .38, 0, .01);
    plante(g, 0, 0, h - .3, 'olivier', .4);
  } else if (p.st === 'cactus') {
    const m = M('laque:' + (p.cols[0] || '#5E9B4C'));
    bloc(g, l * .5, .12, pr * .6, M('noirMat'), 0, 0, 0, .02);
    capsule(g, l * .16, h * .7, m, 0, h * .45, 0);
    capsule(g, l * .1, h * .28, m, -l * .28, h * .6, 0); tube(g, [[-l * .28, h * .45, 0], [-l * .2, h * .38, 0], [-l * .06, h * .4, 0]], l * .08, m, false, 10, 8);
    capsule(g, l * .1, h * .22, m, l * .28, h * .5, 0); tube(g, [[l * .28, h * .38, 0], [l * .2, h * .32, 0], [l * .06, h * .34, 0]], l * .08, m, false, 10, 8);
  } else {
    return sculpture({ style: 'marcheur' });
  }
  ombreSol(g, l + .4, pr + .4);
  return g;
}
function meridienneCat(p) {
  if (p.st !== 'daybed') return meridienne();
  const g = groupe('meridienne');
  const l = clamp(p.dim[0], 1.5, 2.3), pr = clamp(p.dim[1], .6, 1.2), mb = mBois(p);
  bloc(g, l, .18, pr, mb, 0, .08, 0, .02);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bloc(g, .06, .1, .06, mb, a * (l / 2 - .06), 0, b * (pr / 2 - .06)));
  bloc(g, l - .08, .12, pr - .08, M('tissu:' + (p.cols[0] || '#ECE4D3')), 0, .26, 0, .05);
  const c = bloc(g, .5, .35, .12, M('tissu:#D9D2C4'), -l / 2 + .2, .38, 0, .05); c.rotation.set(0, Math.PI / 2, -.3);
  ombreSol(g, l + .5, pr + .5);
  return g;
}
function salonCat(p) {
  const l = clamp(p.dim[0], 1.2, 4.6), pr = clamp(p.dim[1], .6, 4.6);
  const coussins = p.cols[0] && p.fc !== 'sombre' ? p.cols[0] : '#55575A';
  if (p.st === 'feu' && l >= 3.5) return salonFeu();
  const g = groupe('salon-jardin');
  const cadre = p.mat === 'corde' ? M('corde') : M('laque:' + (p.fc === 'sombre' ? '#2A292C' : '#CFC3AE'));
  const mc = M((p.mat === 'boucle' ? 'boucle:' : 'tissu:') + (p.mat === 'boucle' ? coul(p, 0) : coussins));
  if (p.st === 'rond') {
    const Rr = clamp(l / 2, 1.1, 2), a = .8;
    couronne(g, Rr - .85, Rr, Math.PI / 2 - a, Math.PI / 2 + a, .38, cadre, 0, .05);
    couronne(g, Rr - .8, Rr - .05, Math.PI / 2 - a + .03, Math.PI / 2 + a - .03, .1, mc, .38, .04);
    couronne(g, Rr - .2, Rr, Math.PI / 2 - a, Math.PI / 2 + a, .7, cadre, 0, .06);
    cyl(g, .45, .45, .34, M('travertin'), 0, 0, Rr * .15, 32);
    [-1, 1].forEach(k => cyl(g, .3, .32, .38, mc, k * 1.2, 0, Rr * .5, 24));
    ombreSol(g, Rr * 2.4, Rr * 2);
    return g;
  }
  // salon droit : canapé, deux fauteuils, table basse (ou table feu)
  const ls = clamp(l, 1.6, 3);
  const piece = (w, x, z, ry) => {
    const q = groupe(); q.position.set(x, 0, z); q.rotation.y = ry; g.add(q);
    bloc(q, w, .36, .82, cadre, 0, 0, 0, .05);
    bloc(q, w - .14, .14, .68, mc, 0, .36, .04, .05);
    bloc(q, w, .42, .12, cadre, 0, .36, -.35, .04);
    for (let i = 0; i < Math.round(w / .6); i++) { const c = bloc(q, .5, .4, .14, mc, -w / 2 + .35 + i * .6, .46, -.24, .05); c.rotation.x = -.18; }
    [-1, 1].forEach(k => bloc(q, .1, .55, .82, cadre, k * (w / 2 - .05), 0, 0, .04));
  };
  piece(ls, 0, -1.05, 0);
  piece(.86, -ls / 2 - .45, .35, Math.PI / 2);
  piece(.86, ls / 2 + .45, .35, -Math.PI / 2);
  if (p.st === 'feu') { cyl(g, .5, .5, .38, M('noirMat'), 0, 0, .25, 32); cyl(g, .3, .3, .06, M('verre'), 0, .38, .25, 24); const f = place(g, mesh(new THREE.ConeGeometry(.1, .3, 10), M('flamme'), false), 0, .55, .25); f.userData.nonCuit = true; }
  else { bloc(g, 1.1, .34, .62, cadre, 0, 0, .25, .03); bloc(g, 1.1, .03, .62, M('pierre'), 0, .34, .25); }
  ombreSol(g, ls + 2.2, 3.2);
  return g;
}
function tableCat(p) {
  const g = groupe('table');
  const l = clamp(p.dim[0], .35, 3), pr = clamp(p.dim[1], .35, 1.5), h = clamp(p.dim[2], .3, 1.1);
  const plateau = aTitre(p, /marbre/) ? M('marbreBlanc') : aTitre(p, /travertin/) ? M('travertin') : p.bois ? mBois(p) : M('laque:' + (p.cols[0] || '#3A3836'));
  if (p.st === 'ronde') { cyl(g, l / 2, l / 2, .04, plateau, 0, h - .04, 0, 40); cyl(g, l * .12, l * .3, h - .04, plateau, 0, 0, 0, 24); }
  else { bloc(g, l, .05, pr, plateau, 0, h - .05, 0, .01); [-1, 1].forEach(k => bloc(g, .12, h - .05, pr * .6, p.bois ? mBois(p) : M('noir'), k * (l / 2 - .3), 0, 0, .03)); }
  ombreSol(g, l + .5, pr + .5);
  return g;
}
function meubleCat(p) {
  const g = groupe('meuble');
  const l = clamp(p.dim[0], .5, 2.6), pr = clamp(p.dim[1], .25, .7), h = clamp(p.dim[2], .4, 1.5);
  const m = M('laque:' + (p.cols[0] || '#1F1E22'));
  bloc(g, l, h - .16, pr, m, 0, .16, 0, .02);
  const n = Math.max(2, Math.round(l / .45));
  for (let i = 1; i < n; i++) bloc(g, .006, h - .22, .006, M('laiton'), -l / 2 + l * i / n, .19, pr / 2);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, .014, .02, .16, M('laiton'), a * (l / 2 - .06), 0, b * (pr / 2 - .05), 8));
  ombreSol(g, l + .3, pr + .3);
  return g;
}
function panneauMural(p) {
  const g = groupe('mural');
  const l = clamp(p.dim[0], .3, 2.2), h = clamp(p.dim[2], .3, 2.2);
  bloc(g, l, h, .04, p.fam === 'miroir' ? M('chrome') : M('tissu:' + (p.cols[0] || '#6B6358')), 0, -h / 2, .02, .02);
  return g;
}

/* ---------------------------------------------------------------
   Aiguillage : pièce du catalogue -> maquette générique
   --------------------------------------------------------------- */
const CAT_GENERIQUE = {
  lit: litCat, fauteuil: fauteuilCat, canape: canapeCat, suspension: suspensionCat, lustre: lustreCat, applique: appliqueCat,
  lampadaire: lampadaireCat, lampe: lampadaireCat, plafonnier: plafonnierCat, baignoire: baignoireCat, tabouret: tabouretCat,
  banc: bancCat, pouf: poufCat, sculpture: sculptureCat, meridienne: meridienneCat, 'salon-jardin': salonCat,
  jardiniere: () => jardiniere(), balancelle: () => balancelles(), table: tableCat, meuble: meubleCat, miroir: panneauMural, tapis: panneauMural
};
function construireCatalogue(p, o = {}) {
  const f = CAT_GENERIQUE[p.fam];
  if (!f || !p.dim) return groupe('vide');
  return f(p, o);
}



export { THREE, RoomEnvironment, mergeGeometries, TAU, V3, lerp, clamp, alea, graine, mesh, place, bloc, cyl, sphere, tore, tour, tube, extrude, groupe, instances, canvasTex, tex, std, M, LUMINEUX, ombreSol, halo, cuire, ANIMS, definirProduits, construireProduit, construireCatalogue, CAT_GENERIQUE };

