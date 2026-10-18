/* =================================================================
   RealRoom — modèles GLB de produits
   Un GLB arrive dans son propre repère (axe vertical, face avant, unité, origine quelconques).
   Il est ramené aux conventions des maquettes (meubles.js) : mètres, +y en haut, face avant
   vers +z, origine au sol et centrée ; objets muraux : origine sur le mur, au milieu de la
   hauteur ; suspensions : origine au plafond.
   Les dimensions du produit ne sont jamais modifiées pour faire coïncider un modèle : seule une
   conversion d'unité uniforme est admise (cm, mm, pouce). Un modèle qui ne correspond pas à ses
   dimensions est refusé, avec le motif, et la maquette procédurale reste affichée.
   ================================================================= */
import * as THREE from 'three';
import { estMural, estSuspendu } from '../lib/agencement.js';

const AXES = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };
const UNITES = [1, .01, .001, .0254];
const TOLERANCE = .08;   // écart relatif admis sur chaque dimension

// objet : Object3D chargé ; p : produit { fam, dim: [largeur, profondeur, hauteur] } ;
// repere : { haut: '+y', avant: '+z' } tel que déclaré pour ce fichier (glTF : +y en haut).
export function normaliserModele(objet, p, repere = {}) {
  const u = new THREE.Vector3(...(AXES[repere.haut] || AXES['+y']));
  const f = new THREE.Vector3(...(AXES[repere.avant] || AXES['+z']));
  if (Math.abs(u.dot(f)) > 1e-6) return { ok: false, motif: 'repere' };
  const s = new THREE.Vector3().crossVectors(u, f);
  // rotation qui envoie (s, u, f) sur (x, y, z) : transposée de la base source
  const r = new THREE.Matrix4().makeBasis(s, u, f).transpose();
  const corps = new THREE.Group();
  corps.add(objet);
  objet.applyMatrix4(r);
  corps.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(corps);
  if (b.isEmpty()) return { ok: false, motif: 'vide' };
  const taille = v => [v.max.x - v.min.x, v.max.z - v.min.z, v.max.y - v.min.y];
  const ecart = (t, k) => Math.max(...t.map((v, i) => Math.abs(v * k - p.dim[i]) / p.dim[i]));
  const t = taille(b);
  const unite = UNITES.reduce((m, k) => (ecart(t, k) < ecart(t, m) ? k : m), 1);
  const e = ecart(t, unite);
  if (e > TOLERANCE) {
    // largeur et profondeur inversées : la face avant déclarée n'est pas la bonne
    const inverse = Math.max(Math.abs(t[1] * unite - p.dim[0]) / p.dim[0], Math.abs(t[0] * unite - p.dim[1]) / p.dim[1], Math.abs(t[2] * unite - p.dim[2]) / p.dim[2]);
    return { ok: false, motif: inverse <= TOLERANCE ? 'orientation' : 'dimensions', ecart: +e.toFixed(3), taille: t.map(v => +(v * unite).toFixed(3)) };
  }
  objet.applyMatrix4(new THREE.Matrix4().makeScale(unite, unite, unite));
  corps.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(corps);
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, cy = (b.min.y + b.max.y) / 2;
  const pivot = estMural(p.fam) ? [-cx, -cy, -b.min.z] : estSuspendu(p.fam) ? [-cx, -b.max.y, -cz] : [-cx, -b.min.y, -cz];
  objet.applyMatrix4(new THREE.Matrix4().makeTranslation(...pivot));
  corps.userData.glb = { unite, ecart: +e.toFixed(3) };
  return { ok: true, objet: corps, unite, ecart: +e.toFixed(3) };
}

let chargeur = null;
const ENCOURS = new Map();
// Chargement partagé par URL (plusieurs exemplaires du même produit : un seul téléchargement).
export async function chargerGLB(url) {
  if (!ENCOURS.has(url)) {
    ENCOURS.set(url, (async () => {
      if (!chargeur) { const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'); chargeur = new GLTFLoader(); }
      return chargeur.loadAsync(url);
    })().catch(e => { ENCOURS.delete(url); throw e; }));
  }
  const gltf = await ENCOURS.get(url);
  // chaque exemplaire a sa propre hiérarchie ; géométries et matériaux restent partagés
  return gltf.scene.clone(true);
}

export async function modeleGLB(p) {
  const g = typeof p.glb === 'string' ? { url: p.glb } : p.glb;
  if (!g?.url) return { ok: false, motif: 'absent' };
  const objet = await chargerGLB(g.url);
  objet.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return normaliserModele(objet, p, { haut: g.haut, avant: g.avant });
}
