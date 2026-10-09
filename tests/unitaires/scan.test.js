import test from 'node:test';
import assert from 'node:assert/strict';
import { depuisScan, champsDepuisScan, VERSION_SCAN, ErreurScan } from '../../lib/scan.js';
import { corrigerPiece, mesuresConfirmees } from '../../lib/geometrie.js';
import { scanApple, scanAndroid, matrice } from '../fixtures/scans.js';

test('RoomPlan : murs, porte, allège, mobilier et repère métrique sans photographie', () => {
  const s = scanApple(), copie = structuredClone(s), r = depuisScan(s);
  assert.deepEqual(r.modele.dims, { largeur: 4, profondeur: 5, hauteur: 2.6, estimees: true, sources: { largeur: 'scan', profondeur: 'scan', hauteur: 'scan' } });
  assert.equal(r.modele.murs.entree.ouvertures[0].position, -1.25);
  assert.equal(r.modele.murs.fond.ouvertures[0].allege, .9);
  assert.deepEqual(r.agencement[0].p.dim, [1.4, 1.6, 1]);
  assert.deepEqual([r.agencement[0].x, r.agencement[0].z], [0, -.8]);
  assert.equal(r.agencement[0].p.dimsLues, false, 'le capteur ne vaut pas une vérification humaine');
  assert.equal(r.agencement.length, 2);
  assert.equal(r.modele.capture.version, VERSION_SCAN);
  assert.deepEqual(s, copie);
});

test('RoomPlan : invariance par rotation et translation du repère AR', () => {
  const original = scanApple(), tourne = structuredClone(original), a = .61, c = Math.cos(a), s = Math.sin(a);
  for (const e of [...tourne.walls, ...tourne.openings, ...tourne.objects]) {
    const m = e.transform, x = m[12], z = m[14], angle = Math.atan2(m[8], m[10]);
    e.transform = matrice(17 + c * x + s * z, m[13] + 3, -8 - s * x + c * z, angle + a);
  }
  const r = depuisScan(tourne), o = depuisScan(original);
  assert.deepEqual(r.modele.dims, o.modele.dims);
  assert.deepEqual(r.agencement.map(it => [it.x, it.z, it.p.dim]), o.agencement.map(it => [it.x, it.z, it.p.dim]));
  r.agencement.forEach((it, i) => assert.ok(Math.abs(it.rot - o.agencement[i].rot) < .0001));
  assert.deepEqual(r.modele.murs, o.modele.murs);
});

test('Android : quatre coins métriques, hauteur et mobilier explicitement inconnus', () => {
  const r = depuisScan(scanAndroid());
  assert.equal(r.modele.dims.largeur, 4); assert.equal(r.modele.dims.profondeur, 5);
  assert.equal(r.modele.dims.sources.hauteur, 'estimation');
  assert.deepEqual(r.agencement, []);
  assert.ok(Object.values(r.modele.murs).every(m => m.observe == null && !m.ouvertures.length));
  assert.equal(r.modele.capture.mobilierDetecte, false);
  assert.equal(r.modele.capture.ouverturesDetectees, false);
  assert.equal(champsDepuisScan({ ...scanAndroid(), ceilingHeight: 2.7 }).dims.hauteur, 2.7);
});

test('Android : échelle inchangée sous rotation, translation et sens de parcours inverse', () => {
  const a = .44, s = scanAndroid();
  s.floorCorners = s.floorCorners.map(([x, y, z]) => [9 + Math.cos(a) * x + Math.sin(a) * z, y - 3, 5 - Math.sin(a) * x + Math.cos(a) * z]);
  assert.deepEqual(depuisScan(s).modele.dims, depuisScan(scanAndroid()).modele.dims);
  const inverse = scanAndroid(); inverse.floorCorners.reverse();
  const r = depuisScan(inverse); assert.equal(r.modele.dims.largeur, 4); assert.equal(r.modele.dims.profondeur, 5);
});

test('les formes en L, scans incomplets et points sur des plans différents sont refusés', () => {
  const a = scanAndroid(); a.floorCorners[2][0] -= .6;
  assert.throws(() => depuisScan(a), e => e.code === 'scan-forme');
  const b = scanAndroid(); b.floorCorners[2][1] += .2;
  assert.throws(() => depuisScan(b), e => e.code === 'scan-sol');
  const c = scanApple(); c.walls.pop();
  assert.throws(() => depuisScan(c), e => e.code === 'scan-incomplet');
  const d = scanApple(); d.walls.push({ ...d.walls[0], size: [1, 2.6, 0], transform: matrice(0, 1.3, 0) });
  assert.throws(() => depuisScan(d), e => e.code === 'scan-forme');
  const e = scanApple(); e.walls[3].size[0] = 2;
  assert.throws(() => depuisScan(e), err => err.code === 'scan-incomplet');
});

test('un import invalide, une unité ambiguë ou une matrice non rigide ne sont pas devinés', () => {
  for (const s of [null, {}, { ...scanApple(), unit: 'cm' }, { ...scanApple(), source: 'photo' }, { ...scanApple(), version: 'v2' }])
    assert.throws(() => depuisScan(s), ErreurScan);
  const a = scanApple(); a.objects[0].transform[0] = 100;
  assert.throws(() => depuisScan(a), e => e.code === 'scan-repere');
  const b = scanApple(); b.objects[0].transform[12] = 999;
  assert.throws(() => depuisScan(b), e => e.code === 'scan-objet');
  const c = scanApple(); c.walls = Array(33).fill(c.walls[0]);
  assert.throws(() => depuisScan(c), e => e.code === 'scan-format');
});

test('les cotes scannées restent distinctes des mesures humaines après une correction', () => {
  const r = depuisScan(scanApple()), p = corrigerPiece(r.modele, r.agencement, { dims: r.modele.dims, sources: r.modele.dims.sources });
  assert.deepEqual(p.modele.dims.sources, r.modele.dims.sources);
  assert.deepEqual(mesuresConfirmees(p.modele), { largeur: null, profondeur: null, hauteur: null });
  const q = corrigerPiece(p.modele, p.agencement, { dims: { largeur: 4.1 }, sources: { largeur: 'mesure' } });
  assert.equal(q.modele.capture.source, 'apple-roomplan');
  assert.deepEqual(q.modele.dims.sources, { largeur: 'mesure', profondeur: 'scan', hauteur: 'scan' });
});

test('les ajouts manuels après un scan conservent les observations, dimensions et IDs', () => {
  const r = depuisScan(scanAndroid()), ajout = { id: 'm_test', fam: 'lit', nom: 'Mon lit', dim: [1.4, 1.6, 1], x: 0, z: -.8, rot: 0 };
  const p = corrigerPiece(r.modele, r.agencement, { ajouts: [ajout, { ...ajout, id: 'c_catalogue' }, { ...ajout, id: 'm_faux', fam: '<script>' }] });
  assert.equal(p.agencement.length, 1); assert.deepEqual(p.agencement[0].p.dim, [1.4, 1.6, 1]);
  assert.equal(p.agencement[0].p.dimsLues, true);
  assert.equal(corrigerPiece(p.modele, p.agencement, { ajouts: [ajout] }).agencement.length, 1, 'un ajout rejoué ne duplique pas le relevé');
});
