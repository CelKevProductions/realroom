// La pièce en nuage de points de l'accueil « Carte blanche ». Un seul objet three.js : des dizaines de
// milliers de points posés sur les murs, le sol et les meubles d'un séjour, comme un relevé LiDAR.
// Chaque point connaît sa place dans les deux dispositions (A, puis B après Shuffle), sa couleur de nuit
// et sa vraie couleur (matière, lumière de la fenêtre, ombre de contact), calculées une fois ici.
// Le reste (balayage du scan, plan à plat, arrivée des meubles, Shuffle, rendu « photo ») se joue dans
// le shader, piloté par quelques uniformes que la page anime au défilement.
import * as THREE from 'three';

export const PIECE = { L: 4.6, P: 3.8, H: 2.6 };
const { L, P, H } = PIECE;
const l = L / 2, q = P / 2;
const FENETRE = { x0: -0.7, x1: 0.9, y0: 0.85, y1: 2.2 };   // dans le mur du fond (z = -q)
const PORTE = { z0: 0.6, z1: 1.5, y1: 2.05 };               // dans le mur de gauche (x = -l)
// lumière du soir qui entre par la fenêtre : direction vers la fenêtre depuis un point de la pièce
const VERS_FENETRE = new THREE.Vector3(-0.35, 0.6, -1).normalize();

// couleurs en sRGB (le shader les écrit telles quelles)
const rvb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const MAT = {
  chene: '#A87A4F', lin: '#D8CCB7', laine: '#CBB899', cuir: '#9A5235', laiton: '#C9A157', abat: '#F2E9D9',
  terre: '#B0603C', feuille: '#4B6A41', fonce: '#2F2B28', marbre: '#E4DED4', livre: '#6F7F8C', mur: '#E7DFD2',
  cadre: '#F1ECE4'
};

// pièces de meuble : pavé (b), cylindre (c), boule (s) ; repère du meuble, devant = +z, posé à y = 0
const b = (w, h, d, x, y, z, m) => ({ t: 'b', w, h, d, x, y, z, m });
const c = (r, h, x, y, z, m) => ({ t: 'c', r, h, x, y, z, m });
const s = (r, x, y, z, m) => ({ t: 's', r, x, y, z, m });
const pieds = (w, d, h, m, e = 0.04) => [-1, 1].flatMap(i => [-1, 1].map(j => b(e, h, e, i * (w / 2 - e), 0, j * (d / 2 - e), m)));
const MEUBLES = [
  { nom: 'tapis', ombre: 0, pieces: [b(2.4, 0.015, 1.7, 0, 0, 0, 'laine')] },
  { nom: 'canape', ombre: 1, pieces: [
    b(2.2, 0.3, 0.9, 0, 0.1, 0, 'lin'), b(2.2, 0.44, 0.2, 0, 0.4, -0.35, 'lin'),
    b(0.18, 0.24, 0.9, -1.01, 0.4, 0, 'lin'), b(0.18, 0.24, 0.9, 1.01, 0.4, 0, 'lin'),
    b(0.92, 0.12, 0.64, -0.47, 0.4, 0.07, 'lin'), b(0.92, 0.12, 0.64, 0.47, 0.4, 0.07, 'lin'),
    ...pieds(2.1, 0.8, 0.1, 'fonce', 0.05)
  ] },
  { nom: 'table', ombre: .7, pieces: [b(1.0, 0.04, 0.55, 0, 0.38, 0, 'chene'), ...pieds(1.0, 0.55, 0.38, 'chene'),
    c(0.07, 0.14, 0.22, 0.42, 0.02, 'marbre'), b(0.3, 0.05, 0.22, -0.2, 0.42, 0, 'livre')] },
  { nom: 'fauteuil', ombre: 1, pieces: [
    b(0.8, 0.3, 0.8, 0, 0.1, 0, 'cuir'), b(0.8, 0.44, 0.16, 0, 0.4, -0.32, 'cuir'),
    b(0.12, 0.22, 0.8, -0.34, 0.4, 0, 'cuir'), b(0.12, 0.22, 0.8, 0.34, 0.4, 0, 'cuir'), ...pieds(0.72, 0.72, 0.1, 'chene', 0.04)
  ] },
  { nom: 'lampe', ombre: .5, pieces: [c(0.16, 0.03, 0, 0, 0, 'fonce'), c(0.015, 1.36, 0, 0.03, 0, 'laiton'), c(0.22, 0.3, 0, 1.36, 0, 'abat')] },
  { nom: 'plante', ombre: .6, pieces: [c(0.19, 0.42, 0, 0, 0, 'terre'), s(0.32, 0, 0.82, 0, 'feuille'), s(0.24, 0.15, 1.12, 0.08, 'feuille'),
    s(0.22, -0.14, 1.06, -0.1, 'feuille'), s(0.17, 0.02, 1.34, 0, 'feuille')] },
  { nom: 'buffet', ombre: .8, pieces: [b(1.6, 0.62, 0.42, 0, 0.12, 0, 'chene'), ...pieds(1.5, 0.36, 0.12, 'fonce', 0.04),
    c(0.08, 0.32, 0.45, 0.74, 0, 'marbre'), b(0.34, 0.24, 0.22, -0.42, 0.74, 0, 'livre'), c(0.13, 0.05, -0.05, 0.74, 0.02, 'laiton')] }
];
// deux dispositions : [x, z, rotation] par meuble
const DISPOSITIONS = [
  { tapis: [0, -0.35, 0], canape: [0, -1.42, 0], table: [0, -0.3, 0], fauteuil: [1.45, 0.15, -Math.PI / 2],
    lampe: [-1.85, -1.55, 0], plante: [1.9, -1.5, 0], buffet: [-2.08, -0.25, Math.PI / 2] },
  { tapis: [-0.55, -0.4, Math.PI / 2], canape: [-1.82, -0.5, Math.PI / 2], table: [-0.55, -0.4, Math.PI / 2],
    fauteuil: [0.75, 0.55, -2.3], lampe: [-1.15, -1.65, 0], plante: [1.95, 1.35, 0], buffet: [1.05, -1.69, 0] }
];

function hasard(graine) {
  let g = graine;
  return () => (g = (g * 16807) % 2147483647) / 2147483647;
}

// surfaces d'une pièce de meuble (sans le dessous) : [aire, tirage(r) -> [x, y, z, nx, ny, nz]]
function surfaces(p, r) {
  if (p.t === 'b') {
    const { w, h, d } = p;
    const f = (a, g) => [a, g];
    return [
      f(w * d, () => [p.x + (r() - .5) * w, p.y + h, p.z + (r() - .5) * d, 0, 1, 0]),
      f(h * d, () => [p.x - w / 2, p.y + r() * h, p.z + (r() - .5) * d, -1, 0, 0]),
      f(h * d, () => [p.x + w / 2, p.y + r() * h, p.z + (r() - .5) * d, 1, 0, 0]),
      f(w * h, () => [p.x + (r() - .5) * w, p.y + r() * h, p.z - d / 2, 0, 0, -1]),
      f(w * h, () => [p.x + (r() - .5) * w, p.y + r() * h, p.z + d / 2, 0, 0, 1])
    ];
  }
  if (p.t === 'c') {
    return [
      [2 * Math.PI * p.r * p.h, () => { const a = r() * Math.PI * 2, cx = Math.cos(a), sz = Math.sin(a); return [p.x + cx * p.r, p.y + r() * p.h, p.z + sz * p.r, cx, 0, sz]; }],
      [Math.PI * p.r * p.r, () => { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * p.r; return [p.x + Math.cos(a) * d, p.y + p.h, p.z + Math.sin(a) * d, 0, 1, 0]; }]
    ];
  }
  // boule de feuillage : un peu bosselée
  return [[4 * Math.PI * p.r * p.r, () => {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, k = Math.sqrt(1 - u * u), n = [k * Math.cos(a), u, k * Math.sin(a)];
    const rr = p.r * (0.86 + r() * 0.2);
    return [p.x + n[0] * rr, p.y + n[1] * rr, p.z + n[2] * rr, ...n];
  }]];
}

// tirage pondéré par l'aire
function tirer(liste, n, r, sortie) {
  const total = liste.reduce((t, [a]) => t + a, 0);
  for (const [a, g, info] of liste) {
    const k = Math.round(n * a / total);
    for (let i = 0; i < k; i++) sortie(g(), info);
  }
}

const lisse = (a, b2, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b2 - a))); return t * t * (3 - 2 * t); };
const hache = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// lumière : ciel + soleil du soir par la fenêtre (le rayon vers la fenêtre passe-t-il dans la vitre ?)
function eclairage(x, y, z, nx, ny, nz) {
  const ciel = 0.66 + 0.2 * (ny * 0.5 + 0.5);
  const sdist = (z + q) / -VERS_FENETRE.z;
  const xw = x + VERS_FENETRE.x * sdist, yw = y + VERS_FENETRE.y * sdist;
  const dans = xw > FENETRE.x0 && xw < FENETRE.x1 && yw > FENETRE.y0 && yw < FENETRE.y1 && z > -q + 0.02;
  const face = Math.max(0, nx * VERS_FENETRE.x + ny * VERS_FENETRE.y + nz * VERS_FENETRE.z);
  const soleil = dans ? face * 0.62 : 0;
  return [ciel + soleil * 1.0, ciel + soleil * 0.8, ciel + soleil * 0.55];
}

// ombre de contact au sol : distance à l'empreinte de chaque meuble posé
function empreintes(dispo) {
  return MEUBLES.filter(m => m.ombre).map(m => {
    const [x, z, a] = dispo[m.nom];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of m.pieces) {
      const w = p.t === 'b' ? p.w / 2 : p.r, d = p.t === 'b' ? p.d / 2 : p.r;
      x0 = Math.min(x0, p.x - w); x1 = Math.max(x1, p.x + w); z0 = Math.min(z0, p.z - d); z1 = Math.max(z1, p.z + d);
    }
    return { x, z, c: Math.cos(a), s: Math.sin(a), x0, x1, z0, z1, k: m.ombre };
  });
}
function ombreSol(x, z, liste) {
  let o = 1;
  for (const e of liste) {
    // dans le repère du meuble (rotation inverse)
    const dx = x - e.x, dz = z - e.z, lx = e.c * dx - e.s * dz, lz = e.s * dx + e.c * dz;
    const ex = Math.max(e.x0 - lx, 0, lx - e.x1), ez = Math.max(e.z0 - lz, 0, lz - e.z1);
    const d = Math.hypot(ex, ez);
    o *= 1 - e.k * 0.5 * Math.exp(-d / 0.14);
  }
  return o;
}

// parquet de chêne : lames de 16 cm, joints, teintes par lame
function parquet(x, z, r) {
  const rang = Math.floor((z + q) / 0.16), dans = (z + q) / 0.16 - rang;
  const lame = Math.floor((x + l + hache(rang) * 1.2) / 1.1);
  const t = hache(rang * 31 + lame);
  const base = [0.69 + t * 0.08, 0.52 + t * 0.07, 0.35 + t * 0.05];
  const joint = dans < 0.06 ? 0.72 : 1;
  const v = 0.96 + r() * 0.08;
  return base.map(c2 => c2 * joint * v);
}

export function creerNuage({ n = 70000 } = {}) {
  const r = hasard(1234567);
  const posA = [], posB = [], colA = [], colB = [], info = [];
  const ombres = DISPOSITIONS.map(empreintes);

  // ---- la pièce : sol, trois murs, cadres de la fenêtre et de la porte
  const piece = [];
  piece.push([L * P * 1.0, () => [(r() - .5) * L, 0, (r() - .5) * P, 0, 1, 0], 'sol']);
  const mur = (aire, g) => piece.push([aire * 0.62, () => { let p; do p = g(); while (!p); return p; }, 'mur']);
  mur(L * H - 2.16, () => { const x = (r() - .5) * L, y = r() * H; return x > FENETRE.x0 && x < FENETRE.x1 && y > FENETRE.y0 && y < FENETRE.y1 ? null : [x, y, -q, 0, 0, 1]; });
  mur(P * H - 0.81, () => { const z = (r() - .5) * P, y = r() * H; return z > PORTE.z0 && z < PORTE.z1 && y < PORTE.y1 ? null : [-l, y, z, 1, 0, 0]; });
  mur(P * H, () => [l, r() * H, (r() - .5) * P, -1, 0, 0]);
  // cadres : des traits denses (montants et traverse de la fenêtre, chambranle de la porte)
  const trait = (aire, g) => piece.push([aire, g, 'cadre']);
  const fx = FENETRE, mx = (fx.x0 + fx.x1) / 2;
  trait(0.5, () => { const k = r(), e = (r() - .5) * 0.05; return [[fx.x0, fx.x1, mx][Math.floor(k * 3)] + e, fx.y0 + r() * (fx.y1 - fx.y0), -q + 0.03, 0, 0, 1]; });
  trait(0.35, () => [fx.x0 + r() * (fx.x1 - fx.x0), [fx.y0, fx.y1, 1.55][Math.floor(r() * 3)] + (r() - .5) * 0.05, -q + 0.03, 0, 0, 1]);
  trait(0.3, () => { const k = r(); return k < 0.7 ? [-l + 0.02, r() * PORTE.y1, [PORTE.z0, PORTE.z1][Math.floor(r() * 2)] + (r() - .5) * 0.05, 1, 0, 0] : [-l + 0.02, PORTE.y1 + (r() - .5) * 0.05, PORTE.z0 + r() * (PORTE.z1 - PORTE.z0), 1, 0, 0]; });
  // plinthes
  trait(0.5, () => { const k = r(); return k < 0.4 ? [(r() - .5) * L, r() * 0.07, -q + 0.012, 0, 0, 1] : k < 0.7 ? [-l + 0.012, r() * 0.07, (r() - .5) * P, 1, 0, 0] : [l - 0.012, r() * 0.07, (r() - .5) * P, -1, 0, 0]; });

  const nPiece = Math.round(n * 0.5);
  tirer(piece, nPiece, r, ([x, y, z, nx, ny, nz], genre) => {
    if (genre === 'mur' && z < PORTE.z1 && z > PORTE.z0 && x <= -l + 0.001 && y < PORTE.y1) return;
    posA.push(x, y, z); posB.push(x, y, z);
    let base, type = genre === 'sol' ? 0 : 1;
    if (genre === 'sol') base = parquet(x, z, r);
    else {
      const v = 0.97 + r() * 0.05;
      base = rvb(genre === 'cadre' ? MAT.cadre : MAT.mur).map(c2 => c2 * v);
    }
    const lum = eclairage(x, y, z, nx, ny, nz);
    for (let k = 0; k < 2; k++) {
      let ao;
      if (genre === 'sol') {
        const bord = Math.min(x + l, l - x, z + q);
        ao = (0.8 + 0.2 * lisse(0, 0.45, bord)) * ombreSol(x, z, ombres[k]);
      } else ao = 0.8 + 0.2 * lisse(0, 0.7, y) * lisse(0, 0.35, Math.min(x + l, l - x, z + q) + (nx ? 1 : 0) * 0.35);
      (k ? colB : colA).push(base[0] * lum[0] * ao, base[1] * lum[1] * ao, base[2] * lum[2] * ao);
    }
    info.push(type, genre === 'cadre' ? 1 : 0, r(), 0);
  });

  // ---- les meubles
  const meubles = MEUBLES.flatMap((m, g) => m.pieces.flatMap(p => surfaces(p, r).map(([a, tir]) => [a * 1.45, tir, { g, m: p.m }])));
  const _n = new THREE.Vector3();
  tirer(meubles, n - nPiece, r, ([x, y, z, nx, ny, nz], { g, m }) => {
    const nom = MEUBLES[g].nom;
    const base = rvb(MAT[m]), v = 0.95 + r() * 0.1;
    DISPOSITIONS.forEach((dispo, k) => {
      const [dx, dz, a] = dispo[nom], co = Math.cos(a), si = Math.sin(a);
      // rotation autour de y : devant (+z) va vers (sin a, cos a)
      const wx = co * x + si * z + dx, wz = -si * x + co * z + dz;
      _n.set(co * nx + si * nz, ny, -si * nx + co * nz);
      (k ? posB : posA).push(wx, y, wz);
      const lum = eclairage(wx, y, wz, _n.x, _n.y, _n.z);
      const ao = (0.78 + 0.22 * lisse(0, 0.35, y)) * (nom === 'tapis' ? ombreSol(wx, wz, ombres[k]) : 1);
      (k ? colB : colA).push(base[0] * v * lum[0] * ao, base[1] * v * lum[1] * ao, base[2] * v * lum[2] * ao);
    });
    info.push(2, g, r(), 0);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
  geo.setAttribute('aB', new THREE.Float32BufferAttribute(posB, 3));
  geo.setAttribute('aColA', new THREE.Float32BufferAttribute(colA, 3));
  geo.setAttribute('aColB', new THREE.Float32BufferAttribute(colB, 3));
  geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.3, 0), 9);

  const uniforms = {
    uTemps: { value: 0 }, uIntro: { value: 0 }, uScan: { value: 0 }, uPlan: { value: 0 }, uMeubles: { value: 0 },
    uShuffle: { value: 0 }, uRendu: { value: 0 }, uEchelle: { value: 800 }, uAspect: { value: 1 },
    uSouris: { value: new THREE.Vector2(9, 9) }, uForce: { value: 0 },
    uFond: { value: new THREE.Vector3(...rvb('#0E0D0C')) }, uIvoire: { value: new THREE.Vector3(...rvb('#EDE6DA')) },
    uCorail: { value: new THREE.Vector3(...rvb('#F2613F')) }
  };
  const materiau = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      attribute vec3 aB; attribute vec3 aColA; attribute vec3 aColB; attribute vec4 aInfo;
      uniform float uTemps, uIntro, uScan, uPlan, uMeubles, uShuffle, uRendu, uEchelle, uAspect, uForce;
      uniform vec2 uSouris; uniform vec3 uFond, uIvoire, uCorail;
      varying vec3 vCol; varying float vRendu;
      const float L2 = ${l.toFixed(3)};
      void main() {
        float type = aInfo.x, g = aInfo.y, h = aInfo.z;
        bool meuble = type > 1.5;
        // Shuffle : chaque meuble à son tour, en sautant par dessus les autres
        float ts = meuble ? clamp((uShuffle - g * .06) / .58, 0., 1.) : 0.;
        ts = ts * ts * (3. - 2. * ts);
        vec3 p = mix(position, aB, ts);
        if (meuble) p.y += sin(3.14159 * ts) * .45;
        vec3 reel = mix(aColA, aColB, ts);
        // poussière : là où le point flotte avant d'être relevé (ou posé)
        float a0 = h * 6.2832 + uTemps * (.03 + h * .05);
        float ray = 2.6 + fract(h * 7.31) * 4.2;
        vec3 poussiere = vec3(cos(a0) * ray, .2 + fract(h * 3.7) * 3.8 + sin(uTemps * .4 + h * 20.) * .12, sin(a0) * ray * .8);
        // le scan : la pièce se forme derrière la lame ; les meubles se posent, l'un après l'autre
        float sx = mix(-L2 - .6, L2 + .6, uScan);
        float pose = meuble ? clamp((uMeubles - g * .075) / .5, 0., 1.) : smoothstep(sx + .05, sx - .55, position.x);
        float e = 1. - pow(1. - pose, 3.);
        vec3 depuis = meuble ? mix(poussiere, p + vec3(0., 2.4 + h, 0.), .55) : poussiere;
        p = mix(depuis, p, e);
        // le plan : tout s'aplatit au sol
        p.y = mix(p.y, p.y * .015, uPlan * e);
        // un léger frémissement, qui s'éteint dans la photo
        p += sin(uTemps * .9 + h * 40. + vec3(0., 2., 4.)) * .005 * (1. - uRendu);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vec4 cp = projectionMatrix * mv;
        // le curseur écarte les points
        vec2 ndc = cp.xy / cp.w, d = ndc - uSouris;
        d.x *= uAspect;
        float r = length(d);
        float pousse = uForce * smoothstep(.3, 0., r) * .07 * (1. - uRendu * .75);
        ndc += (d / max(r, 1e-4)) * pousse / vec2(uAspect, 1.);
        cp.xy = ndc * cp.w;
        gl_Position = cp;
        // couleurs : la nuit (ivoire, meubles corail), puis la vraie matière
        float lame = exp(-abs(position.x - sx) * 9.) * step(.001, uScan) * step(uScan, .999) * (meuble ? 0. : 1.);
        vec3 nuit = meuble ? uCorail : uIvoire * (type < .5 ? .5 : (aInfo.y > .5 ? 1.15 : .9));
        float force = mix(1., .5 + .5 * e, 1. - uRendu);
        if (type < .5) force *= 1. - .45 * uPlan;
        vec3 col = mix(nuit, reel, uRendu);
        col = mix(col, uCorail * 1.1, lame * .8);
        float voile = uIntro * force * mix(.55, 1., e);
        vCol = mix(uFond, col, clamp(voile, 0., 1.));
        vRendu = uRendu;
        float taille = mix(.021, .05, uRendu) * (1. + lame * 1.2) * mix(.8, 1., e) * (aInfo.y > .5 && !meuble ? 1.2 : 1.);
        gl_PointSize = clamp(taille * uEchelle / -mv.z, 1., 48.);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vRendu;
      void main() {
        vec2 c = gl_PointCoord - .5;
        float r2 = dot(c, c);
        if (r2 > .25) discard;
        // une touche de peinture : un peu plus sombre au bord
        gl_FragColor = vec4(vCol * (1. - r2 * .5 * vRendu), 1.);
      }`,
    depthWrite: true,
    depthTest: true
  });
  const points = new THREE.Points(geo, materiau);
  points.frustumCulled = false;
  return {
    points, uniforms, nombre: info.length / 4,
    liberer() { geo.dispose(); materiau.dispose(); }
  };
}
