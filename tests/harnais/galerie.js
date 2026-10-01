// Banc d'essai des maquettes 3D : chaque produit du catalogue rendu seul, sur fond de studio,
// en vue de trois quarts face (comme une photo de catalogue). Sert à comparer la maquette
// à la photo du produit (tests/galerie.py).
import { THREE, RoomEnvironment, definirProduits, construireProduit, cuire, graine } from '../../moteur/meubles.js';
import '../../moteur/modeles/index.js';
import catalogue from '../../data/catalogue.json';

const P = catalogue.produits;
definirProduits(P);
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const SUSPENDUS = new Set(['suspension', 'lustre', 'plafonnier']);

const W = 640, H = 640;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#EFEBE3');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .7;
scene.add(new THREE.HemisphereLight('#FFF8EE', '#D2C6B5', 1.0));
const cle = new THREE.DirectionalLight('#FFF3E2', 2.2);
cle.castShadow = true; cle.shadow.mapSize.set(1024, 1024); cle.shadow.bias = -.0005; cle.shadow.normalBias = .02;
scene.add(cle, cle.target);
const contre = new THREE.DirectionalLight('#E2E8F0', .6);
contre.position.set(-4, 3, -4);
scene.add(contre);
const sol = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .18 }));
sol.rotation.x = -Math.PI / 2; sol.receiveShadow = true;
scene.add(sol);
const camera = new THREE.PerspectiveCamera(28, W / H, .01, 200);
let courant = null;

function vider() {
  if (!courant) return;
  scene.remove(courant);
  courant.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  courant = null;
}

// rend un produit ; azimut en degrés (0 = de face, 35 = trois quarts)
window.__rendre = (id, azimut = 32, elevation = 16) => {
  vider();
  const p = P[id];
  if (!p) return null;
  graine(hash(id));
  const opts = SUSPENDUS.has(p.fam) ? { hMax: 1.1, h: .8 } : {};
  const g = construireProduit(id, opts);
  cuire(g);
  const porteur = new THREE.Group();
  porteur.add(g);
  scene.add(porteur);
  courant = porteur;
  // les suspensions pendent sous leur origine : on les pose au-dessus du sol pour le cadrage
  let b = new THREE.Box3().setFromObject(porteur);
  if (SUSPENDUS.has(p.fam) || b.min.y < -.001) porteur.position.y = -b.min.y;
  porteur.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(porteur);
  const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  const r = Math.max(.15, s.length() / 2);
  const d = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.08;
  const az = THREE.MathUtils.degToRad(azimut), el = THREE.MathUtils.degToRad(elevation);
  camera.position.set(c.x + d * Math.cos(el) * Math.sin(az), c.y + d * Math.sin(el), c.z + d * Math.cos(el) * Math.cos(az));
  camera.near = d / 50; camera.far = d * 10; camera.updateProjectionMatrix();
  camera.lookAt(c);
  cle.position.set(c.x + r * 3, c.y + r * 5, c.z + r * 4);
  cle.target.position.copy(c);
  const ombre = cle.shadow.camera;
  ombre.left = ombre.bottom = -r * 1.6; ombre.right = ombre.top = r * 1.6; ombre.near = .1; ombre.far = r * 20;
  ombre.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  return canvas.toDataURL('image/jpeg', .9);
};
window.__ids = () => Object.values(P).map(p => ({ id: p.id, nom: p.nom, fam: p.fam, st: p.st || '', titre: p.titre || '' }));
window.__pret = true;
