import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { normaliserModele } from '../../moteur/glb.js';

const boite = (x, y, z, decalage = [0, 0, 0]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x, y, z));
  m.position.set(...decalage);
  return new THREE.Group().add(m);
};
const mesure = o => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); return { b, t: [b.max.x - b.min.x, b.max.z - b.min.z, b.max.y - b.min.y] }; };
const proche = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${a} ≠ ${b}`));

test('GLB : axe vertical, face avant, unité et pivot ramenés aux conventions, dimensions jamais forcées', () => {
  // fichier en centimètres, z vers le haut, face avant vers -y, origine décalée
  const p = { fam: 'commode', dim: [.8, .5, 1.2] };
  const r = normaliserModele(boite(80, 50, 120, [300, 40, 60]), p, { haut: '+z', avant: '-y' });
  assert.equal(r.ok, true); assert.equal(r.unite, .01);
  const { b, t } = mesure(r.objet);
  proche(t, p.dim);
  proche([(b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2], [0, 0, 0]);
  // objet mural : origine sur le mur (dos), au milieu de la hauteur
  const m = normaliserModele(boite(.9, .6, .04), { fam: 'tableau', dim: [.9, .04, .6] });
  const mb = mesure(m.objet).b;
  proche([mb.min.z, (mb.min.y + mb.max.y) / 2], [0, 0]);
  // face avant mal déclarée (largeur et profondeur inversées) : refus, pas de redimensionnement
  assert.deepEqual(normaliserModele(boite(.5, 1.2, .8), p, {}).motif, 'orientation');
  assert.deepEqual(normaliserModele(boite(1, 1, 1), p, {}).motif, 'dimensions');
});
