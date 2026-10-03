/* =================================================================
   RealRoom — vitrine 3D d'un produit (fiche du catalogue)
   Le meuble seul, posé sur un sol de studio, présenté en gros plan :
   il arrive en tournant (un demi-tour qui ralentit), puis continue
   lentement ; on le fait tourner au doigt ou à la souris, avec inertie.
   Même maquette que dans la pièce (construireProduit).
   ================================================================= */
import { THREE, RoomEnvironment, definirProduits, construireProduit, cuire, graine } from './meubles.js';
import './modeles/index.js';

const SUSPENDUS = new Set(['suspension', 'lustre', 'plafonnier']);
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const REPOS = -.56;        // trois quarts face (la face avant du meuble regarde +z)
const AUTO = .32;          // vitesse du tour lent (rad/s)

export function creerVitrine(canvas, opts = {}) {
  const produits = opts.produits || {};
  definirProduits(produits);
  const anime = opts.anime !== false;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 indisponible');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.fond || '#EFEBE3');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new RoomEnvironment();
  const env = pmrem.fromScene(studio, .04);
  scene.environment = env.texture;
  scene.environmentIntensity = .7;
  scene.add(new THREE.HemisphereLight('#FFF8EE', '#D2C6B5', 1));
  const cle = new THREE.DirectionalLight('#FFF3E2', 2.2);
  cle.castShadow = true; cle.shadow.mapSize.set(1024, 1024); cle.shadow.bias = -.0005; cle.shadow.normalBias = .02;
  scene.add(cle, cle.target);
  const contre = new THREE.DirectionalLight('#E2E8F0', .6);
  contre.position.set(-4, 3, -4);
  scene.add(contre);
  const sol = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.ShadowMaterial({ opacity: .18 }));
  sol.rotation.x = -Math.PI / 2; sol.receiveShadow = true;
  scene.add(sol);
  const camera = new THREE.PerspectiveCamera(28, 1, .01, 200);
  const plateau = new THREE.Group();     // tourne sur lui-même, le meuble posé dessus
  scene.add(plateau);

  const S = { modele: null, centre: new THREE.Vector3(), rayon: 1, angle: REPOS, vitesse: 0, intro: null, glisse: null, reprise: 0, pause: false, raf: 0, dernier: 0, detruit: false };

  function vider() {
    if (!S.modele) return;
    plateau.remove(S.modele);
    S.modele.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    S.modele = null;
  }
  // cadrage : tout le meuble dans l'image, vu un peu d'en haut
  function cadrer() {
    const r = S.rayon, c = S.centre;
    const demi = THREE.MathUtils.degToRad(camera.fov / 2);
    const k = camera.aspect < 1 ? 1 / camera.aspect : 1;
    const d = r / Math.sin(demi) * 1.06 * k;
    const el = THREE.MathUtils.degToRad(15);
    camera.position.set(c.x, c.y + d * Math.sin(el), c.z + d * Math.cos(el));
    camera.near = d / 50; camera.far = d * 10; camera.updateProjectionMatrix();
    camera.lookAt(c);
    cle.position.set(c.x + r * 3, c.y + r * 5, c.z + r * 4);
    cle.target.position.copy(c);
    const o = cle.shadow.camera;
    o.left = o.bottom = -r * 1.6; o.right = o.top = r * 1.6; o.near = .1; o.far = r * 20;
    o.updateProjectionMatrix();
  }
  function montrer(id) {
    const p = produits[id];
    if (!p) return;
    vider();
    graine(hash(id));
    const g = construireProduit(id, SUSPENDUS.has(p.fam) ? { hMax: 1.1, h: .8 } : {});
    cuire(g);
    const porteur = new THREE.Group();
    porteur.add(g);
    // centré sur l'axe du plateau et posé au sol (les suspensions pendent sous leur origine)
    let b = new THREE.Box3().setFromObject(porteur);
    const c0 = b.getCenter(new THREE.Vector3());
    porteur.position.set(-c0.x, -b.min.y, -c0.z);
    plateau.add(porteur);
    S.modele = porteur;
    plateau.rotation.y = 0;
    plateau.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(porteur);
    const s = b.getSize(new THREE.Vector3());
    // rayon de la sphère qui contient le meuble quel que soit l'angle du plateau
    S.rayon = Math.max(.15, Math.hypot(Math.max(s.x, s.z), s.y, Math.min(s.x, s.z)) / 2);
    S.centre.set(0, s.y / 2, 0);
    cadrer();
    S.vitesse = 0; S.glisse = null;
    if (anime) { S.intro = { t0: performance.now(), de: REPOS - 2.6 }; S.angle = S.intro.de; }
    else { S.intro = null; S.angle = REPOS; }
    demander();
  }

  function demander() { if (!S.raf && !S.detruit && !S.pause) S.raf = requestAnimationFrame(rendre); }
  function rendre() {
    S.raf = 0;
    const t = performance.now();
    const dt = S.dernier ? Math.min(.05, (t - S.dernier) / 1000) : 0;
    S.dernier = t;
    let encore = false;
    if (S.intro) {
      // arrivée : un demi-tour qui ralentit jusqu'aux trois quarts face
      const k = clamp((t - S.intro.t0) / 1700, 0, 1), e = 1 - Math.pow(1 - k, 4);
      S.angle = S.intro.de + (REPOS - S.intro.de) * e;
      if (k >= 1) { S.intro = null; S.reprise = t + 900; }
      encore = true;
    } else if (!S.glisse) {
      if (Math.abs(S.vitesse) > .002) { S.angle += S.vitesse * dt; S.vitesse *= Math.pow(.04, dt); encore = true; }
      else if (anime && t >= S.reprise) { S.angle += AUTO * dt; encore = true; }
      else if (anime) encore = true;
    }
    plateau.rotation.y = S.angle;
    renderer.render(scene, camera);
    if (encore) demander(); else S.dernier = 0;
  }

  // glisser pour tourner (avec inertie), puis le tour lent reprend après une pause
  const pointeur = { id: null, x: 0, t: 0 };
  function bas(e) {
    if (pointeur.id !== null) return;
    pointeur.id = e.pointerId; pointeur.x = e.clientX; pointeur.t = performance.now();
    S.glisse = true; S.intro = null; S.vitesse = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
  }
  function bouge(e) {
    if (e.pointerId !== pointeur.id) return;
    const t = performance.now(), dx = e.clientX - pointeur.x;
    const da = dx * (Math.PI * 2 / Math.max(320, canvas.clientWidth * 1.6));
    S.angle += da;
    S.vitesse = da / Math.max(.008, (t - pointeur.t) / 1000);
    pointeur.x = e.clientX; pointeur.t = t;
    plateau.rotation.y = S.angle;
    if (!S.raf) renderer.render(scene, camera);
  }
  function haut(e) {
    if (e.pointerId !== pointeur.id) return;
    pointeur.id = null;
    S.glisse = null;
    if (performance.now() - pointeur.t > 80) S.vitesse = 0;   // relâché à l'arrêt : pas d'élan
    S.vitesse = clamp(S.vitesse, -9, 9);
    S.reprise = performance.now() + 2600;
    demander();
  }
  canvas.addEventListener('pointerdown', bas);
  canvas.addEventListener('pointermove', bouge);
  canvas.addEventListener('pointerup', haut);
  canvas.addEventListener('pointercancel', haut);

  function redimensionner() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (S.modele) cadrer(); else camera.updateProjectionMatrix();
    if (!S.raf) renderer.render(scene, camera);
  }
  const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redimensionner) : null;
  if (obs) obs.observe(canvas);
  redimensionner();

  return {
    montrer,
    // photo affichée à la place de la 3D : plus de rendu en attendant
    pause(oui) {
      S.pause = !!oui;
      if (S.pause && S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
      S.dernier = 0;
      if (!S.pause) demander();
    },
    detruire() {
      S.detruit = true;
      if (S.raf) cancelAnimationFrame(S.raf);
      if (obs) obs.disconnect();
      canvas.removeEventListener('pointerdown', bas);
      canvas.removeEventListener('pointermove', bouge);
      canvas.removeEventListener('pointerup', haut);
      canvas.removeEventListener('pointercancel', haut);
      vider();
      sol.geometry.dispose(); sol.material.dispose();
      env.dispose(); pmrem.dispose();
      if (studio.dispose) studio.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}
