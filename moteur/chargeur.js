/* =================================================================
   Maison Corleone · Chez vous — chargement en 3D
   Pendant l'analyse des photos et l'aménagement : une pièce au trait
   de laiton tourne lentement, un plan de lecture la balaie, puis les
   meubles apparaissent en volumes filaires à mesure que le travail
   avance. avancer(q) suit la progression (0 → 1).
   ================================================================= */
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sortie = t => 1 - Math.pow(1 - t, 3);

export function creerChargeur(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  const piece = new THREE.Group();
  scene.add(piece);
  const laiton = opts.couleur || '#C9A66B';
  const ligne = (pts, opacite = 1) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p)));
    const m = new THREE.LineBasicMaterial({ color: laiton, transparent: true, opacity: opacite });
    return new THREE.LineSegments(g, m);
  };
  const L = 4.4, P = 3.6, H = 2.2;
  // sol quadrillé, murs du fond et de gauche, fenêtre
  const grille = [];
  for (let i = 0; i <= 11; i++) { const x = -L / 2 + i * L / 11; grille.push([x, 0, -P / 2], [x, 0, P / 2]); }
  for (let j = 0; j <= 9; j++) { const z = -P / 2 + j * P / 9; grille.push([-L / 2, 0, z], [L / 2, 0, z]); }
  piece.add(ligne(grille, .22));
  piece.add(ligne([
    [-L / 2, 0, -P / 2], [L / 2, 0, -P / 2], [L / 2, 0, -P / 2], [L / 2, 0, P / 2], [L / 2, 0, P / 2], [-L / 2, 0, P / 2], [-L / 2, 0, P / 2], [-L / 2, 0, -P / 2],
    [-L / 2, 0, -P / 2], [-L / 2, H, -P / 2], [-L / 2, H, -P / 2], [L / 2, H, -P / 2], [L / 2, H, -P / 2], [L / 2, 0, -P / 2],
    [-L / 2, H, -P / 2], [-L / 2, H, P / 2], [-L / 2, H, P / 2], [-L / 2, 0, P / 2],
    [-.9, .55, -P / 2], [.7, .55, -P / 2], [.7, .55, -P / 2], [.7, 1.75, -P / 2], [.7, 1.75, -P / 2], [-.9, 1.75, -P / 2], [-.9, 1.75, -P / 2], [-.9, .55, -P / 2]
  ], .9));
  // meubles en volumes filaires, dans l'ordre où ils apparaissent
  const boites = [
    [-1.75, .15, .9, .78, 2.2, Math.PI / 2], [-.75, .15, 1.9, .02, 2.4, Math.PI / 2], [-.75, .15, .45, .45, .45, 0],
    [.45, -.75, .85, .8, .85, -2.1], [.6, .95, .8, .78, .8, -1], [-1.95, -1.45, .4, 1.6, .4, 0], [1.4, -P / 2 + .25, 1.5, .85, .4, 0]
  ].map(([x, z, w, h, d, r]) => {
    const g = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: '#F1E6D3', transparent: true, opacity: 0 }));
    g.position.set(x, h / 2, z); g.rotation.y = r; g.scale.y = .001;
    g.userData.h = h;
    piece.add(g);
    return g;
  });
  // plan de lecture qui balaie la pièce (lecture des photos)
  const mScan = new THREE.MeshBasicMaterial({ color: laiton, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.06, H * 1.1), mScan);
  scan.position.y = H / 2;
  piece.add(scan);
  const bordScan = ligne([[-L * .53, 0, 0], [L * .53, 0, 0]], .9);
  piece.add(bordScan);

  const E = { q: 0, raf: 0, actif: true, t: 0 };
  function avancer(q) { E.q = clamp(q, 0, 1); }
  function tick(t) {
    E.raf = 0;
    if (!E.actif) return;
    const s = t / 1000;
    piece.rotation.y = -.7 + s * .18;
    // le plan de lecture va et vient tant que les photos sont lues (première moitié)
    const lecture = 1 - clamp((E.q - .4) / .15, 0, 1);
    const z = Math.sin(s * 1.1) * P * .48;
    scan.position.z = z; bordScan.position.set(0, .002, z);
    mScan.opacity = .12 * lecture; bordScan.material.opacity = .9 * lecture;
    scan.visible = bordScan.visible = lecture > .01;
    // les meubles apparaissent à mesure que l'aménagement avance
    boites.forEach((g, i) => {
      const seuil = .45 + i * .065;
      const k = sortie(clamp((E.q - seuil) / .08, 0, 1));
      g.scale.y = Math.max(.001, k);
      g.position.y = g.userData.h / 2 * k;
      g.material.opacity = k * .95;
    });
    renderer.render(scene, camera);
    E.raf = requestAnimationFrame(tick);
  }
  function redimensionner() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const d = w / h < 1 ? 12.5 : 10;
    camera.position.set(d * .62, d * .55, d * .62);
    camera.lookAt(0, .7, 0);
    camera.updateProjectionMatrix();
  }
  const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redimensionner) : null;
  if (obs) obs.observe(canvas);
  redimensionner();
  E.raf = requestAnimationFrame(tick);
  return {
    avancer,
    detruire() {
      E.actif = false;
      if (E.raf) cancelAnimationFrame(E.raf);
      if (obs) obs.disconnect();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}
