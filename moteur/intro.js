/* =================================================================
   Maison Corleone · Chez vous — intro 3D pilotée par le défilement
   Une maquette de pièce flotte dans une brume chaude. Son plan se trace
   en filets de laiton, ses murs se montent lame par lame, les vieux
   meubles s'envolent, les pièces Maison Corleone (leurs vraies maquettes,
   les mêmes que dans la pièce du client) se posent une à une, puis le
   soir tombe et la caméra entre à hauteur d'yeux.
   regler(p) fixe tout l'état pour p ∈ [0, 1] : une position de défilement
   donne toujours la même image. Seuls la poussière et le tracé du plan à
   l'ouverture vivent avec le temps.
   Fluidité : tout est compilé et envoyé au processeur graphique avant la
   première image (les deux éclairages, jour et soir) ; la définition est
   choisie d'après quelques images chronométrées ; la caméra suit des courbes
   sans arrêt aux étapes ; une seule boucle par image (défilement, textes,
   rendu), cadencée à 60 images régulières si l'écran va plus vite que la
   carte graphique.
   ================================================================= */
import { THREE, RoomEnvironment, definirProduits, construireProduit, cuire, graine, std, M, bloc, cyl, sphere, LUMINEUX, canvasTex } from './meubles.js';
import './modeles/index.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lisse = t => t * t * (3 - 2 * t);
const sortie = t => 1 - Math.pow(1 - t, 3);
const rebond = t => { const c = 1.35; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const fen = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
// interpolation cubique monotone (Fritsch-Carlson) : passe par chaque clé sans dépassement, vitesse
// continue (pas d'arrêt aux clés intermédiaires), départ et arrivée en douceur
function pchip(xs, ys) {
  const n = xs.length, h = [], d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] > 0) { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
const alea = n => { let s = n >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// la pièce : murs du fond (z = -P/2) et de gauche (x = -L/2), ouverte vers la caméra comme une maquette
const L = 5.6, P = 4.6, H = 2.7, EP = .14;
const FEN = { x0: -1.2, x1: .8, y0: .62, y1: 2.2 };   // fenêtre du mur du fond

// moments du récit (part du défilement)
export const TEMPS = {
  murs: [.08, .27], sol: [.12, .26], vieuxIn: [.19, .29], vieuxOut: [.32, .45],
  nouveaux: [.46, .65], soir: [.66, .77], fin: .9
};

// pièces Maison Corleone posées (produits réels du catalogue) ; arrivee : part du défilement
export const PIECES = [
  { id: 'tapis', type: 'tapis', x: -1.0, z: .15, rot: Math.PI / 2, dim: [2.7, 1.9], arrivee: .465 },
  { id: 'canape', sku: 'com-600', x: -2.12, z: .15, rot: Math.PI / 2, arrivee: .49 },
  { id: 'table', sku: 'nordic-table-basse', x: -1.0, z: .15, rot: 0, arrivee: .515 },
  { id: 'fauteuil1', sku: 'terracotta', x: .35, z: -.9, rot: -2.15, arrivee: .54 },
  { id: 'fauteuil2', sku: 'abbraccio', x: .5, z: 1.1, rot: -.95, arrivee: .565 },
  { id: 'lampadaire', sku: 'fpf-lamp-7705', x: -2.42, z: -1.92, rot: .6, arrivee: .59 },
  { id: 'buffet', sku: 'ha-650', x: 1.78, z: -P / 2 + .23, rot: 0, arrivee: .61 },
  { id: 'suspension', sku: 'sus-lnb-34', x: -1.0, z: .15, rot: 0, arrivee: .63, suspendu: true },
  { id: 'applique1', sku: 'wom-wall-2414', x: -L / 2, y: 1.62, z: -1.05, rot: Math.PI / 2, arrivee: .64, mural: true },
  { id: 'applique2', sku: 'wom-wall-2414', x: -L / 2, y: 1.62, z: 1.35, rot: Math.PI / 2, arrivee: .645, mural: true },
  { id: 'plante', type: 'plante', x: 2.4, z: -1.75, rot: 0, dim: [.62, .62, 1.45], arrivee: .62 }
];
// lumières du soir : où brillent les luminaires
const FEUX = [
  { de: 'lampadaire', x: -2.42, y: 1.45, z: -1.92, i: 5.5 },
  { de: 'suspension', x: -1.0, y: 1.95, z: .15, i: 7 },
  { de: 'applique1', x: -L / 2 + .18, y: 1.62, z: -1.05, i: 2.2 },
  { de: 'applique2', x: -L / 2 + .18, y: 1.62, z: 1.35, i: 2.2 }
];

// caméra : positions et points visés, avec la part du défilement où ils sont atteints
const CLES = [
  { t: 0, pos: [10.5, 11.8, 13.2], vise: [0, .2, 0], fov: 32 },
  { t: .12, pos: [8.6, 8.6, 10.6], vise: [0, .45, 0], fov: 33 },
  { t: .27, pos: [6.4, 5.4, 8.2], vise: [-.3, .7, -.2], fov: 35 },
  { t: .44, pos: [4.2, 6.4, 7.4], vise: [-.4, .6, -.3], fov: 36 },
  { t: .62, pos: [-.6, 5.6, 8.4], vise: [-.5, .55, -.4], fov: 36 },
  { t: .76, pos: [2.6, 2.2, 3.6], vise: [-1.3, .95, -1.1], fov: 42 },
  { t: .88, pos: [2.5, 1.5, .6], vise: [-1.8, 1.0, -.6], fov: 46 },
  { t: 1, pos: [7.4, 7.6, 9.4], vise: [-.2, .35, -.1], fov: 34 }
];

/* ---------------------------------------------------------------
   Textures
   --------------------------------------------------------------- */
function parquet() {
  return canvasTex(1024, 1024, (x, n) => {
    const r = alea(7);
    const lames = 9, l = n / lames;
    for (let i = 0; i < lames; i++) {
      let y = -r() * 300;
      while (y < n) {
        const h = 180 + r() * 340;
        const t = r();
        x.fillStyle = `hsl(${30 + t * 6}, ${38 + t * 10}%, ${58 + (r() - .5) * 9}%)`;
        x.fillRect(i * l, y, l, h);
        x.globalAlpha = .07;
        for (let k = 0; k < 7; k++) { x.fillStyle = r() > .5 ? '#5A3A1E' : '#FFF4E2'; x.fillRect(i * l + r() * l, y, 1 + r() * 2, h); }
        x.globalAlpha = 1;
        x.fillStyle = 'rgba(60,35,15,.28)'; x.fillRect(i * l, y, l, 2);
        y += h;
      }
      x.fillStyle = 'rgba(60,35,15,.32)'; x.fillRect(i * l, 0, 2, n);
    }
  }, { rep: [L / 2.2, P / 2.2] });
}
function ciel() {
  return canvasTex(256, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#C9D6DD'); g.addColorStop(.6, '#EADFCF'); g.addColorStop(1, '#F4E7D2');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // toits lointains
    x.fillStyle = 'rgba(150,140,128,.35)';
    for (let i = 0; i < 9; i++) { const bw = 20 + (i * 37) % 30, bh = 30 + (i * 53) % 70; x.fillRect(i * 30 - 6, h - bh, bw, bh); }
  }, { clamp: true });
}
function tapis() {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#E4D6C0'; x.fillRect(0, 0, w, h);
    const r = alea(11);
    for (let i = 0; i < 6000; i++) { x.fillStyle = r() > .5 ? 'rgba(255,250,240,.18)' : 'rgba(120,95,60,.08)'; x.fillRect(r() * w, r() * h, 2, 2); }
    x.strokeStyle = '#B4935E'; x.lineWidth = 7; x.strokeRect(26, 26, w - 52, h - 52);
    x.strokeStyle = 'rgba(51,40,23,.55)'; x.lineWidth = 2; x.strokeRect(44, 44, w - 88, h - 88);
  }, { clamp: true });
}
function poussiere() {
  return canvasTex(64, 64, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  }, { clamp: true });
}

/* ---------------------------------------------------------------
   L'intro
   --------------------------------------------------------------- */
// La construction est découpée en étapes courtes, avec une image peinte entre deux (le
// préchargement continue de vivre) ; tous les shaders sont compilés et toutes les textures envoyées
// avant la première image : rien ne se compile pendant le défilement.
// opts : produits, mobile, avance(q) (0 → 1), annule() (true : on abandonne), mesure(nom, ms)
export async function creerIntro(canvas, opts = {}) {
  const produits = opts.produits || {};
  definirProduits(produits);
  const mobile = !!opts.mobile;
  const annule = opts.annule || (() => false);
  const mesure = opts.mesure || null;
  const TOTAL = 10 + PIECES.length;   // étapes : 5 de décor, une par pièce, lumières, 2 × shaders, premières images, calibrage
  let fait = 0, chrono = performance.now();
  const souffle = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  async function etape(nom) {
    if (mesure) mesure(nom, performance.now() - chrono);
    if (opts.avance) opts.avance(Math.min(1, ++fait / TOTAL));
    await souffle();
    if (annule()) { liberer(); throw Object.assign(new Error('intro annulée'), { annule: true }); }
    chrono = performance.now();
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 indisponible');
  // définition : plafonnée (écrans Retina), choisie d'après quelques images chronométrées (calibrer),
  // puis abaissée d'elle-même si des images sont manquées pendant le défilement
  const dprMax = Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.5), dprMin = mobile ? .7 : .85;
  let dpr = dprMax;
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // les ombres ne sont recalculées que lorsque des objets bougent (voir regler)
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const liberer = () => { try { renderer.dispose(); renderer.forceContextLoss(); } catch (_) { /* déjà libéré */ } };

  const scene = new THREE.Scene();
  const BRUME = { jour: new THREE.Color('#E7DDCC'), soir: new THREE.Color('#1E160E') };
  scene.background = BRUME.jour.clone();
  scene.fog = new THREE.Fog(BRUME.jour.clone(), 15, 38);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new RoomEnvironment();
  const env = pmrem.fromScene(studio, .04);
  scene.environment = env.texture;
  await etape('environnement');

  const hemi = new THREE.HemisphereLight('#FFF6E8', '#B9A58A', 1.15);
  const soleil = new THREE.DirectionalLight('#FFF0DA', 2.5);
  soleil.position.set(5.5, 9.5, 6.5);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(1024, 1024);
  soleil.shadow.bias = -.0004; soleil.shadow.normalBias = .02; soleil.shadow.radius = 4;
  Object.assign(soleil.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  soleil.shadow.camera.updateProjectionMatrix();
  scene.add(hemi, soleil, soleil.target);

  const camera = new THREE.PerspectiveCamera(34, 1, .05, 120);
  const maquette = new THREE.Group();
  scene.add(maquette);

  // socle de plâtre et ombre portée lointaine (la maquette flotte)
  bloc(maquette, L + .55, .32, P + .55, std('#E9E0D1', .95), 0, -.32, 0, .04);
  const ombre = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .16 }));
  ombre.rotation.x = -Math.PI / 2; ombre.position.y = -1.9; ombre.receiveShadow = true;
  scene.add(ombre);

  // sol : le parquet apparaît sur le plâtre (toujours « transparent » : changer ce réglage recompilerait un shader)
  const texParquet = parquet();
  await etape('parquet');
  const mSol = std('#FFFFFF', .62, 0, { map: texParquet, transparent: true, opacity: 0 });
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(L, P), mSol);
  sol.rotation.x = -Math.PI / 2; sol.position.y = .002; sol.receiveShadow = true;
  maquette.add(sol);

  /* ---------- murs : des lames qui se posent ---------- */
  const mMur = std('#EFE8DC', .93), mChant = std('#332817', .7), mPlinthe = std('#F6F1E8', .6);
  const lames = [];
  function lame(x0, x1, y0, y1, mur, i) {
    const g = new THREE.Group();
    const w = x1 - x0, h = y1 - y0;
    const corps = new THREE.Mesh(new THREE.BoxGeometry(w, h, EP), mMur);
    corps.castShadow = corps.receiveShadow = true;
    corps.position.y = h / 2;
    g.add(corps);
    if (y1 >= H - .001) {
      const chant = new THREE.Mesh(new THREE.BoxGeometry(w + .002, .016, EP + .004), mChant);
      chant.position.y = h + .008;
      g.add(chant);
    }
    if (y0 <= .001) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(w, .07, .012), mPlinthe);
      pl.position.set(0, .035, EP / 2 + .006);
      g.add(pl);
    }
    // repère du mur : le fond court le long de x ; la gauche le long de z (tournée de 90°)
    if (mur === 'fond') { g.position.set((x0 + x1) / 2, y0, -P / 2 - EP / 2); }
    else { g.rotation.y = Math.PI / 2; g.position.set(-L / 2 - EP / 2, y0, -(x0 + x1) / 2); }
    const r = alea(hash(mur + i));
    g.userData = { base: g.position.clone(), rotBase: g.rotation.y, dy: 3.2 + r() * 2.2, dr: (r() - .5) * .9, ordre: 0 };
    maquette.add(g);
    lames.push(g);
    return g;
  }
  // mur du fond : de l'angle (x = -L/2 - EP) au bout, découpé autour de la fenêtre
  const pas = .4;
  const coupes = [-L / 2 - EP];
  for (let x = -L / 2 + pas; x < L / 2 - .05; x += pas) coupes.push(Math.round(x * 100) / 100);
  coupes.push(L / 2);
  [FEN.x0, FEN.x1].forEach(v => { if (!coupes.some(c => Math.abs(c - v) < .02)) coupes.push(v); });
  coupes.sort((a, b) => a - b);
  for (let i = 0; i < coupes.length - 1; i++) {
    const x0 = coupes[i], x1 = coupes[i + 1];
    if (x0 >= FEN.x0 - .001 && x1 <= FEN.x1 + .001) { lame(x0, x1, 0, FEN.y0, 'fond', i); lame(x0, x1, FEN.y1, H, 'fond', i + 100); }
    else lame(x0, x1, 0, H, 'fond', i);
  }
  // mur de gauche : de z = -P/2 à z = P/2 (abscisse le long du mur = -z)
  const nG = Math.round(P / pas);
  for (let i = 0; i < nG; i++) lame(-P / 2 + i * P / nG, -P / 2 + (i + 1) * P / nG, 0, H, 'gauche', i);
  // ordre de pose : depuis l'angle du fond, vers les extrémités
  lames.forEach(g => { const b = g.userData.base; g.userData.ordre = Math.hypot(b.x + L / 2, b.z + P / 2) / Math.hypot(L, P); });
  await etape('murs');

  // fenêtre : dormant, meneau, vitre, ciel
  const fenetre = new THREE.Group();
  const mDormant = std('#F7F3EC', .5), cxF = (FEN.x0 + FEN.x1) / 2, wF = FEN.x1 - FEN.x0, hF = FEN.y1 - FEN.y0;
  [[wF, .05, cxF, FEN.y0], [wF, .05, cxF, FEN.y1 - .05]].forEach(([w, h, x, y]) => bloc(fenetre, w, h, .07, mDormant, x, y, -P / 2 - EP / 2));
  [FEN.x0 + .025, FEN.x1 - .025, cxF].forEach(x => bloc(fenetre, .05, hF, .07, mDormant, x, FEN.y0, -P / 2 - EP / 2));
  bloc(fenetre, wF + .12, .03, .2, mDormant, cxF, FEN.y0 - .03, -P / 2 + .03);
  const vitre = new THREE.Mesh(new THREE.PlaneGeometry(wF - .06, hF - .06), M('verre'));
  vitre.position.set(cxF, FEN.y0 + hF / 2, -P / 2 - EP / 2); vitre.renderOrder = 4;
  fenetre.add(vitre);
  const mCiel = new THREE.MeshBasicMaterial({ map: ciel(), fog: false });
  const cielP = new THREE.Mesh(new THREE.PlaneGeometry(wF, hF), mCiel);
  cielP.position.set(cxF, FEN.y0 + hF / 2, -P / 2 - EP - .005);
  fenetre.add(cielP);
  fenetre.visible = false;
  maquette.add(fenetre);

  /* ---------- le plan en filets de laiton (tracé à l'ouverture) ---------- */
  const pts = [];
  const seg = (a, b) => { pts.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
  const y = .008;
  const rect = (cx, cz, w, d, rot = 0) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    const k = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [cx + u * c + v * s, y, cz - u * s + v * c]);
    for (let i = 0; i < 4; i++) seg(k[i], k[(i + 1) % 4]);
  };
  rect(0, 0, L, P);
  seg([-L / 2, 0, -P / 2], [-L / 2, H, -P / 2]); seg([-L / 2, H, -P / 2], [L / 2, H, -P / 2]); seg([L / 2, H, -P / 2], [L / 2, 0, -P / 2]);
  seg([-L / 2, H, -P / 2], [-L / 2, H, P / 2]); seg([-L / 2, H, P / 2], [-L / 2, 0, P / 2]);
  [[FEN.x0, FEN.y0], [FEN.x1, FEN.y0], [FEN.x1, FEN.y1], [FEN.x0, FEN.y1]].forEach((a, i, t) => { const b = t[(i + 1) % 4]; seg([a[0], a[1], -P / 2 + .004], [b[0], b[1], -P / 2 + .004]); });
  // l'emprise des futurs meubles, en avant-goût
  rect(-2.12, .15, 3.2, 1.3, Math.PI / 2); rect(-1.0, .15, 2.7, 1.9, Math.PI / 2); rect(.35, -.9, .95, .9, -2.15); rect(.5, 1.1, .78, .82, -.95); rect(1.78, -P / 2 + .23, 1.7, .42);
  // cote de largeur, en avant de la pièce
  seg([-L / 2, y, P / 2 + .45], [L / 2, y, P / 2 + .45]);
  seg([-L / 2, y, P / 2 + .33], [-L / 2, y, P / 2 + .57]); seg([L / 2, y, P / 2 + .33], [L / 2, y, P / 2 + .57]);
  const gPlan = new THREE.BufferGeometry();
  gPlan.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mPlan = new THREE.LineBasicMaterial({ color: '#9C7B45', transparent: true, opacity: 1, fog: false });
  const plan = new THREE.LineSegments(gPlan, mPlan);
  plan.renderOrder = 6;
  maquette.add(plan);
  const nSegments = pts.length / 6;
  await etape('fenêtre et plan');

  /* ---------- les meubles d'avant (gris, ils partiront) ---------- */
  const vieux = [];
  function vieuxMeuble(nom, construire, x, z, rot, i) {
    const g = new THREE.Group();
    const m = std(['#A7A29A', '#9D978D', '#B1ABA2'][i % 3], .96, 0, { transparent: true, opacity: 1 });
    construire(g, m);
    g.position.set(x, 0, z); g.rotation.y = rot;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData = { m, base: g.position.clone(), rotBase: rot, i };
    maquette.add(g);
    vieux.push(g);
  }
  vieuxMeuble('canape', (g, m) => { bloc(g, 2.1, .42, .9, m, 0, .02, 0, .04); bloc(g, 2.1, .44, .2, m, 0, .42, -.35, .04); bloc(g, .18, .26, .9, m, -.96, .42, 0, .03); bloc(g, .18, .26, .9, m, .96, .42, 0, .03); }, -2.3, .2, Math.PI / 2, 0);
  vieuxMeuble('table', (g, m) => { bloc(g, 1.1, .05, .6, m, 0, .38, 0, .01); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bloc(g, .05, .38, .05, m, a * .48, 0, b * .24)); }, -1.05, .2, 0, 1);
  vieuxMeuble('fauteuil', (g, m) => { bloc(g, .8, .42, .8, m, 0, .02, 0, .04); bloc(g, .8, .46, .16, m, 0, .42, -.32, .04); }, .4, -.85, -2.2, 2);
  vieuxMeuble('etagere', (g, m) => { bloc(g, 1.0, 1.9, .34, m, 0, 0, 0, .01); }, 1.75, -P / 2 + .2, 0, 0);
  vieuxMeuble('lampe', (g, m) => { cyl(g, .15, .15, .03, m, 0, 0, 0, 20); cyl(g, .015, .015, 1.45, m, 0, .03, 0, 8); cyl(g, .12, .2, .26, m, 0, 1.42, 0, 20, true); }, -2.4, -1.9, 0, 1);
  vieuxMeuble('tapis', (g, m) => { bloc(g, 2.0, .012, 1.4, m, 0, 0, 0); }, -1.05, .2, Math.PI / 2, 2);
  await etape('meubles d’avant');

  /* ---------- les pièces Maison Corleone ---------- */
  const nouveaux = [];
  const mTapis = std('#FFFFFF', 1, 0, { map: tapis() });
  for (const d of PIECES) {
    const porteur = new THREE.Group();
    let modele = null;
    if (d.type === 'tapis') {
      modele = new THREE.Group();
      const t = new THREE.Mesh(new THREE.BoxGeometry(d.dim[0], .012, d.dim[1]), mTapis);
      t.position.y = .006; t.receiveShadow = true;
      modele.add(t);
    } else if (d.type === 'plante') {
      modele = new THREE.Group();
      const [w, , h] = d.dim;
      cyl(modele, w * .3, w * .22, .42, std('#C9BBA6', .9), 0, 0, 0, 22);
      const r = alea(5);
      for (let i = 0; i < 8; i++) sphere(modele, w * (.2 + r() * .12), M('plante:#506B3B'), (r() - .5) * w * .55, h * (.45 + r() * .45), (r() - .5) * w * .55, 1, 1.15, 1, 12);
    } else if (produits[d.sku]) {
      graine(hash(d.sku));
      try { modele = construireProduit(d.sku, d.suspendu ? { hMax: .95, h: .75 } : {}); } catch (e) { console.warn('intro', d.sku, e); }
    }
    if (!modele) continue;
    cuire(modele);
    modele.traverse(o => { if (o.isMesh) { o.castShadow = !d.type || d.type === 'plante'; o.receiveShadow = true; } });
    porteur.add(modele);
    porteur.position.set(d.x, d.suspendu ? H : d.mural ? d.y : 0, d.z);
    porteur.rotation.y = d.rot;
    maquette.add(porteur);
    porteur.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(porteur);
    const ancre = d.suspendu || d.mural ? b.getCenter(new THREE.Vector3()) : new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + .1, (b.min.z + b.max.z) / 2);
    const p = d.sku && produits[d.sku];
    porteur.userData = { d, base: porteur.position.clone(), ancre, nom: p ? p.nom : null, prix: p ? p.prix : 0, cat: p ? p.cat : null };
    porteur.visible = false;
    nouveaux.push(porteur);
    await etape(d.id);
  }

  /* ---------- lumières du soir et poussière ---------- */
  // invisibles le jour : quatre lampes à zéro coûteraient quand même leur calcul sur chaque pixel
  // (les shaders des deux éclairages sont compilés d'avance : passer de l'un à l'autre ne coûte rien)
  const feux = FEUX.map(f => {
    const l = new THREE.PointLight('#FFB46E', 0, 7.5, 2);
    l.position.set(f.x, f.y, f.z);
    l.visible = false;
    maquette.add(l);
    return { l, i: f.i, de: f.de };
  });
  const nP = mobile ? 260 : 520;
  const gP = new THREE.BufferGeometry();
  const posP = new Float32Array(nP * 3);
  const rP = alea(99);
  for (let i = 0; i < nP; i++) { posP[i * 3] = (rP() - .5) * 16; posP[i * 3 + 1] = rP() * 7 - .8; posP[i * 3 + 2] = (rP() - .5) * 16; }
  gP.setAttribute('position', new THREE.BufferAttribute(posP, 3));
  const mP = new THREE.PointsMaterial({ size: mobile ? .06 : .05, map: poussiere(), transparent: true, depthWrite: false, opacity: .5, color: '#FFFFFF', sizeAttenuation: true });
  const poussieres = new THREE.Points(gP, mP);
  scene.add(poussieres);
  // voile : les bords de l'image s'assombrissent un peu (dessiné ici, à la définition du rendu, plutôt
  // qu'en calque CSS plein écran que le navigateur recomposerait à chaque image)
  const voile = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uCouleur: { value: new THREE.Color('#1E160E') } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: 'uniform vec3 uCouleur; varying vec2 vUv; void main() { vec2 d = (vUv - vec2(.5, .6)) / vec2(1.2, .9); float k = clamp((length(d) - .55) / .45, 0., 1.); gl_FragColor = vec4(uCouleur, .22 * k);\n#include <colorspace_fragment>\n}'
  }));
  voile.frustumCulled = false;
  voile.renderOrder = 999;
  scene.add(voile);
  await etape('lumières');

  /* ---------- caméra : courbes passant par les clés ---------- */
  // Les courbes sont parcourues à vitesse réglée par la longueur (getPointAt) : la part de longueur
  // atteinte à chaque clé est interpolée sans à-coup entre les clés (pchip). Avant, chaque segment
  // était lissé à part : la caméra s'arrêtait à chaque clé puis repartait.
  const courbePos = new THREE.CatmullRomCurve3(CLES.map(c => new THREE.Vector3(...c.pos)), false, 'centripetal');
  const courbeVise = new THREE.CatmullRomCurve3(CLES.map(c => new THREE.Vector3(...c.vise)), false, 'centripetal');
  const DIV = 160;
  const partsCles = courbe => {
    courbe.arcLengthDivisions = DIV * (CLES.length - 1);
    const l = courbe.getLengths();
    return CLES.map((_, i) => l[i * DIV] / l[l.length - 1]);
  };
  const tCles = CLES.map(c => c.t);
  const sPos = pchip(tCles, partsCles(courbePos)), sVise = pchip(tCles, partsCles(courbeVise));
  const fovDe = pchip(tCles, CLES.map(c => c.fov));
  function poseCamera(p) {
    courbePos.getPointAt(clamp(sPos(p), 0, 1), E.cpos);
    courbeVise.getPointAt(clamp(sVise(p), 0, 1), E.cvise);
    const fov = fovDe(p);
    if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    placerCamera();
  }
  // la maquette « flotte » : la caméra oscille doucement (déplacer la maquette obligerait à recalculer les ombres)
  function placerCamera() {
    camera.position.set(E.cpos.x, E.cpos.y - E.bob, E.cpos.z);
    camera.lookAt(E.cvise.x, E.cvise.y - E.bob, E.cvise.z);
  }

  /* ---------- l'état pour une progression p ---------- */
  const E = { p: 0, trace: 0, t0: 0, raf: 0, actif: false, detruit: false, flotte: 0, bob: 0, soir: -1, w: 1, h: 1, ombres: true, n: 0, image: null, cpos: new THREE.Vector3(), cvise: new THREE.Vector3() };
  const cAmb = new THREE.Color();
  function ambiance(k) {
    if (Math.abs(k - E.soir) < .002) return;
    E.soir = k;
    scene.background.copy(BRUME.jour).lerp(BRUME.soir, k);
    scene.fog.color.copy(scene.background);
    hemi.intensity = lerp(1.15, .22, k);
    hemi.color.set('#FFF6E8').lerp(cAmb.set('#7D86A6'), k);
    soleil.intensity = lerp(2.5, .14, k);
    soleil.color.set('#FFF0DA').lerp(cAmb.set('#8E9AC8'), k);
    scene.environmentIntensity = lerp(.55, .14, k);
    mCiel.color.set('#FFFFFF').lerp(cAmb.set('#323B5C'), k);
    mP.color.set('#FFFFFF').lerp(cAmb.set('#FFC98C'), k);
    mP.opacity = lerp(.5, .75, k);
    ombre.material.opacity = lerp(.16, .05, k);
    for (const Lu of LUMINEUX) {
      const v = lerp(Lu.jour, Lu.soir, k);
      if (Lu.champ === 'opacite') Lu.m.opacity = v;
      else if (Lu.champ === 'couleur') { if (Lu.m.userData.base) Lu.m.color.copy(Lu.m.userData.base).multiplyScalar(v); }
      else Lu.m.emissiveIntensity = v;
    }
    const allumes = k > .002;
    feux.forEach(f => { f.l.intensity = f.i * lisse(k); f.l.visible = allumes; });
  }

  // fenêtre du défilement où des objets bougent (murs, meubles d'avant, pièces qui se posent)
  const BOUGE = [TEMPS.murs[0] - .01, TEMPS.nouveaux[1] + .07];
  function regler(p) {
    p = clamp(p, 0, 1);
    const avant = E.p;
    E.p = p;
    if (Math.min(avant, p) <= BOUGE[1] && Math.max(avant, p) >= BOUGE[0]) E.ombres = true;
    // murs
    const qm = fen(p, ...TEMPS.murs);
    for (const g of lames) {
      const u = g.userData, k = fen(qm, u.ordre * .62, u.ordre * .62 + .38), e = sortie(k);
      g.visible = k > 0;
      g.position.set(u.base.x, u.base.y + u.dy * (1 - e), u.base.z);
      g.rotation.set(u.dr * (1 - e) * .5, u.rotBase + u.dr * (1 - e), 0);
    }
    fenetre.visible = qm > .82;
    // le sol prend son parquet ; le plan s'efface sous les murs
    mSol.opacity = lisse(fen(p, ...TEMPS.sol));
    mPlan.opacity = 1 - lisse(fen(p, .2, .32));
    plan.visible = mPlan.opacity > .01;
    // meubles d'avant : ils apparaissent, puis s'envolent en s'effaçant
    for (const g of vieux) {
      const u = g.userData;
      const kin = fen(p, TEMPS.vieuxIn[0] + u.i * .012, TEMPS.vieuxIn[1]);
      const d0 = TEMPS.vieuxOut[0] + (u.i % 3) * .022, kout = fen(p, d0, d0 + .075);
      const e = sortie(kout);
      g.visible = kin > 0 && kout < 1;
      g.position.set(u.base.x, u.base.y + e * 2.6 - (1 - sortie(kin)) * .25, u.base.z);
      g.rotation.y = u.rotBase + e * .5;
      g.scale.setScalar(lerp(.94, 1, sortie(kin)) * (1 - e * .25));
      u.m.opacity = sortie(kin) * (1 - lisse(kout));
    }
    // pièces Maison Corleone : elles descendent et se posent
    for (const g of nouveaux) {
      const u = g.userData, k = fen(p, u.d.arrivee, u.d.arrivee + .055);
      g.visible = k > 0;
      const e = u.d.type === 'tapis' ? sortie(k) : rebond(k);
      const haut = u.d.suspendu ? .9 : u.d.mural ? .7 : u.d.type === 'tapis' ? .4 : 2.2;
      g.position.set(u.base.x, u.base.y + haut * (1 - e), u.base.z);
      if (u.d.type === 'tapis') g.scale.set(lerp(.6, 1, e), 1, lerp(.6, 1, e));
      else g.rotation.y = u.d.rot + (1 - Math.min(1, e)) * .6;
    }
    ambiance(lisse(fen(p, ...TEMPS.soir)));
    poseCamera(p);
    // la maquette flotte au départ, puis se pose
    E.flotte = 1 - fen(p, .02, .14);
    demander();
  }
  E.p = -1;

  // tracé du plan à l'ouverture (indépendant du défilement)
  function tracer(q) {
    E.trace = q;
    gPlan.setDrawRange(0, Math.floor(q * nSegments) * 2);
  }
  tracer(0);

  /* ---------- étiquettes des pièces (position à l'écran, visibilité) ---------- */
  const v = new THREE.Vector3();
  function etiquettes() {
    const r = { width: E.w, height: E.h };
    return nouveaux.filter(g => g.userData.nom).map(g => {
      const u = g.userData;
      v.copy(u.ancre).applyMatrix4(maquette.matrixWorld).project(camera);
      const k = fen(E.p, u.d.arrivee + .03, u.d.arrivee + .06) * (1 - fen(E.p, .7, .75));
      return { id: u.d.id, nom: u.nom, prix: u.prix, cat: u.cat, x: (v.x * .5 + .5) * r.width, y: (-v.y * .5 + .5) * r.height, visible: v.z < 1 ? k : 0 };
    });
  }

  /* ---------- boucle : défilement (image), poussière, flottement, tracé, rendu ---------- */
  // Une seule boucle : la page y règle la progression (image) juste avant le rendu.
  // Rythme : sur un écran rapide (100 Hz et plus) qui manque des images, on passe à une image sur
  // deux (60 régulières valent mieux qu'une alternance 120/60) ; ensuite seulement, la définition baisse.
  function demander() { if (!E.raf && !E.detruit && E.actif) E.raf = requestAnimationFrame(tick); }
  let dernier = 0, baisse = 0, cadence = 1;   // cadence 2 : une image sur deux
  const ecarts = [];
  function surveiller(ecart, t) {
    if (!(ecart > 0 && ecart < 250)) return;
    ecarts.push(ecart);
    if (ecarts.length > 60) ecarts.shift();
    if (ecarts.length < 60 || t - baisse < 2000) return;
    const tri = ecarts.slice().sort((a, b) => a - b);
    const periode = tri[3];                       // ≈ période de l'écran (au rythme choisi)
    const manquees = ecarts.filter(e => e > periode * 1.5).length / ecarts.length;
    if (manquees < .2) return;
    if (cadence === 1 && periode < 10.5) cadence = 2;
    else if (dpr > dprMin) { dpr = Math.max(dprMin, Math.round((dpr - .15) * 100) / 100); renderer.setPixelRatio(dpr); renderer.setSize(E.w, E.h, false); }
    else return;
    baisse = t; ecarts.length = 0;
  }
  function tick(t) {
    E.raf = 0;
    if (E.detruit || !E.actif) return;
    E.raf = requestAnimationFrame(tick);
    if (cadence === 2 && (E.n++ & 1)) return;    // une image sur deux
    const ecart = dernier ? t - dernier : 0;
    const dt = Math.min(.05, ecart / 1000);
    dernier = t;
    surveiller(ecart, t);
    if (E.image) E.image(t);                     // la page : défilement → regler(p), textes, étiquettes
    if (E.trace < 1 && E.t0) tracer(clamp((t - E.t0) / 2600, 0, 1));
    poussieres.rotation.y += dt * .012;
    poussieres.position.y = Math.sin(t / 4000) * .12;
    E.bob = Math.sin(t / 1300) * .06 * E.flotte;
    placerCamera();
    // ombres recalculées à chaque image tant que des objets bougent (coût régulier : pas d'à-coups)
    if (E.ombres) { renderer.shadowMap.needsUpdate = true; E.ombres = false; }
    renderer.render(scene, camera);
  }

  function redimensionner() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    E.w = w; E.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // écran étroit (téléphone) : on recule un peu pour garder la pièce entière
    camera.zoom = w / h < .8 ? .72 : w / h < 1.2 ? .86 : 1;
    camera.updateProjectionMatrix();
    rendreMaintenant();
  }
  function rendreMaintenant() {
    if (E.ombres) { renderer.shadowMap.needsUpdate = true; E.ombres = false; }
    renderer.render(scene, camera);
  }
  // tout compiler et tout envoyer au processeur graphique avant la première image : des images de
  // préparation où tout est visible (sous le préchargement), avec et sans les lampes du soir, puis
  // l'état de départ
  const visibles = [];
  scene.traverse(o => { visibles.push([o, o.visible]); o.visible = true; });
  const lampes = on => feux.forEach(f => { f.l.visible = on; });
  camera.aspect = Math.max(.2, (canvas.clientWidth || 1) / (canvas.clientHeight || 1));
  camera.position.set(...CLES[0].pos); camera.lookAt(...CLES[0].vise); camera.updateProjectionMatrix();
  lampes(true);
  await renderer.compileAsync(scene, camera);
  await etape('shaders du soir');
  lampes(false);
  await renderer.compileAsync(scene, camera);
  await etape('shaders du jour');
  // textures envoyées quelques-unes à la fois (une image peinte entre deux), pas toutes d'un bloc
  const textures = new Set();
  scene.traverse(o => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const mt of ms) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap']) if (mt[k] && mt[k].isTexture) textures.add(mt[k]);
  });
  let envoyees = 0;
  for (const tx of textures) {
    renderer.initTexture(tx);
    if (++envoyees % 3 === 0) { await souffle(); if (annule()) { liberer(); throw Object.assign(new Error('intro annulée'), { annule: true }); } }
  }
  if (mesure) mesure('textures (' + textures.size + ')', performance.now() - chrono);
  chrono = performance.now();
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);                 // jour
  await souffle();
  lampes(true);
  renderer.render(scene, camera);                 // soir
  visibles.forEach(([o, v]) => { o.visible = v; });
  renderer.shadowMap.needsUpdate = true;    // les images de préparation montraient tout : ombres à refaire
  await etape('premières images');

  const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redimensionner) : null;
  if (obs) obs.observe(canvas);
  redimensionner();

  // Calibrage : quelques images du moment le plus chargé (tout est posé, les lampes du soir sont
  // allumées, la caméra est dans la pièce), chronométrées jusqu'au bout (lecture d'un pixel) ; au-delà
  // de 10 ms par image, la définition baisse (le coût suit le nombre de pixels)
  const gl = renderer.getContext(), pixel = new Uint8Array(4);
  const chronometrer = () => {
    const t0 = performance.now();
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return performance.now() - t0;
  };
  regler(.8);
  for (let passe = 0; passe < 2 && dpr > dprMin; passe++) {
    // la première image peut encore préparer des états ; si elle dépasse déjà 100 ms, la carte est
    // très lente (ou le rendu logiciel) : définition minimale sans insister
    const premiere = chronometrer();
    if (premiere > 100) { dpr = dprMin; renderer.setPixelRatio(dpr); renderer.setSize(E.w, E.h, false); break; }
    const t = [];
    for (let i = 0; i < 3; i++) { const d = chronometrer(); t.push(d); if (d > 100) break; }
    t.sort((a, b) => a - b);
    const med = t[Math.floor((t.length - 1) / 2)];
    if (mesure) mesure(`calibrage ${dpr} : ${med.toFixed(1)} ms`, performance.now() - chrono);
    if (med <= 10) break;
    dpr = Math.max(dprMin, Math.round(dpr * Math.sqrt(10 / med) * 100) / 100);
    renderer.setPixelRatio(dpr);
    renderer.setSize(E.w, E.h, false);
    await souffle();
  }
  regler(0);
  rendreMaintenant();
  await etape('calibrage');

  return {
    regler,
    etiquettes,
    get progression() { return E.p; },
    // anime le tracé du plan puis vit (poussière) ; trace : false pour un plan déjà tracé ;
    // image(t) : appelée à chaque image, avant le rendu (la page y règle la progression)
    demarrer({ trace = true, image = null } = {}) {
      E.actif = true;
      E.image = image;
      if (trace && E.trace < 1) E.t0 = performance.now(); else tracer(1);
      demander();
    },
    arreter() { E.actif = false; E.image = null; if (E.raf) cancelAnimationFrame(E.raf); E.raf = 0; },
    redimensionner,
    rendre: rendreMaintenant,
    // pour les essais : appels de dessin, programmes compilés, définition
    infos: () => ({ appels: renderer.info.render.calls, triangles: renderer.info.render.triangles, programmes: renderer.info.programs ? renderer.info.programs.length : 0, textures: renderer.info.memory.textures, dpr, cadence, lampes: feux[0].l.visible }),
    detruire() {
      E.detruit = true; E.actif = false;
      if (E.raf) cancelAnimationFrame(E.raf);
      if (obs) obs.disconnect();
      ambiance(0);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      env.dispose(); pmrem.dispose();
      if (studio.dispose) studio.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}
