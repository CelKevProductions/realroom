import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { depuisScan, normaliserScan } from '../../lib/scan.js';
import { estZip, scanDepuisArchive } from '../../lib/archive-scan.js';
import { scanApple, matrice } from '../fixtures/scans.js';

// CapturedStructure iOS 17 telle qu'exportée par Lagarsoft (data/scan.json), sans son maillage privé.
function structureApple() {
  const s = scanApple(), convert = x => ({ dimensions: x.size, transform: x.transform, category: { [x.category]: {} }, confidence: { high: {} } });
  const piece = { walls: s.walls.map(convert), doors: s.openings.filter(x => x.category === 'door').map(convert),
    windows: s.openings.filter(x => x.category === 'window').map(convert), openings: [], objects: s.objects.map(convert), coreModel: 'private' };
  return { rooms: [piece, { walls: [], doors: [], windows: [], openings: [], objects: [] }], structure: { ...piece, rooms: [] } };
}

// Archive ZIP minimale : en-têtes locaux, répertoire central et fin de répertoire.
function zip(fichiers) {
  const locaux = [], centraux = [];
  let decalage = 0;
  for (const { nom, texte, stocke } of fichiers) {
    const n = Buffer.from(nom), brut = Buffer.from(texte), donnees = stocke ? brut : deflateRawSync(brut);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(stocke ? 0 : 8, 8);
    l.writeUInt32LE(donnees.length, 18); l.writeUInt32LE(brut.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(stocke ? 0 : 8, 10);
    c.writeUInt32LE(donnees.length, 20); c.writeUInt32LE(brut.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(decalage, 42);
    locaux.push(l, n, donnees); centraux.push(c, n);
    decalage += 30 + n.length + donnees.length;
  }
  const central = Buffer.concat(centraux), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(central.length, 12); fin.writeUInt32LE(decalage, 16);
  return new Uint8Array(Buffer.concat([...locaux, central, fin]));
}
const code = c => e => e?.code === c;

test('CapturedStructure Lagarsoft : la pièce unique est lue comme une CapturedRoom', () => {
  const st = structureApple(), attendu = depuisScan(scanApple());
  assert.deepEqual(depuisScan(st), attendu);
  assert.deepEqual(depuisScan({ structure: st.structure, rooms: [] }), attendu);
  assert.equal(normaliserScan(st).coreModel, undefined);
  assert.throws(() => normaliserScan({ ...st, rooms: [st.rooms[0], st.rooms[0]] }), code('scan-pieces'));
  assert.throws(() => normaliserScan({ rooms: [] }), code('scan-format'));
  // encodage Apple : murs fusionnés au premier niveau en plus des pièces
  assert.throws(() => normaliserScan({ ...st.structure, rooms: [st.rooms[0], st.rooms[0]] }), code('scan-pieces'));
  assert.deepEqual(depuisScan({ ...st.structure, rooms: [st.rooms[0]] }), attendu);
  assert.throws(() => normaliserScan({ walls: [null] }), code('scan-format'));
  assert.throws(() => normaliserScan({ ...st.rooms[0], doors: [null] }), code('scan-format'));
});

test('RoomPlan : télévision accrochée, petit canapé et meuble arrondi contre le mur', () => {
  const s = scanApple(), el = (category, size, pos, rot = 0) => ({ category, size, transform: matrice(...pos, rot), confidence: 'medium' });
  s.objects = [el('television', [1, .56, .1], [.2, 1.6, -2.44]), el('sofa', [.9, .85, .9], [-1, .42, 1]), el('sofa', [2, .8, .9], [0, .4, 1.5]),
    el('storage', [1, .8, .4], [1.8149, .4, .6], -Math.PI / 2)];
  const [tv, fauteuil, canape, rangement] = depuisScan(s).agencement;
  assert.equal(tv.p.fam, 'tv-murale');
  assert.deepEqual([tv.x, tv.z, tv.y, tv.rot, tv.kind, tv.mur], [.2, -2.5, 1.6, 0, 'wall_item', 'fond']);
  assert.deepEqual([fauteuil.p.fam, fauteuil.p.nom, canape.p.fam], ['fauteuil', 'Fauteuil détecté', 'canape']);
  assert.equal(rangement.x, 1.8, 'ramené contre le mur au lieu de dépasser de 1 cm');
  s.objects = [el('television', [1, .56, .3], [0, .75, 0])];
  assert.equal(depuisScan(s).agencement[0].p.fam, 'tv', 'posée sur un meuble au milieu de la pièce');
});

test('zip Lagarsoft : data/scan.json est retrouvé, les autres fichiers ignorés', async () => {
  const st = JSON.stringify(structureApple());
  const archive = zip([{ nom: 'Projet/Projet.dxf', texte: '0\nEOF\n' }, { nom: '__MACOSX/Projet/data/._scan.json', texte: 'x' },
    { nom: 'Projet/data/meta.json', texte: '{"roomCount":2}' }, { nom: 'Projet/data/scan.json', texte: st }]);
  assert.ok(estZip(archive));
  assert.deepEqual(depuisScan(await scanDepuisArchive(archive)), depuisScan(scanApple()));
  const stocke = zip([{ nom: 'releve.json', texte: st, stocke: true }]);
  assert.deepEqual(depuisScan(await scanDepuisArchive(stocke)), depuisScan(scanApple()));
});

test('zip sans relevé, corrompu ou trop lourd une fois décompressé : refus explicite', async () => {
  await assert.rejects(scanDepuisArchive(zip([{ nom: 'data/meta.json', texte: '{"roomCount":1}' }])), code('scan-archive'));
  await assert.rejects(scanDepuisArchive(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])), code('scan-archive'));
  const bombe = zip([{ nom: 'data/scan.json', texte: ' '.repeat(6e6) }]);
  await assert.rejects(scanDepuisArchive(bombe), code('trop-gros'));
  // taille annoncée mensongère : la limite tient pendant la décompression
  new DataView(bombe.buffer).setUint32(bombe.length - 22 - 46 - 14 + 24, 10, true);
  await assert.rejects(scanDepuisArchive(bombe), code('trop-gros'));
  const menteur = zip([{ nom: 'data/scan.json', texte: JSON.stringify(structureApple()), stocke: true }]);
  new DataView(menteur.buffer).setUint32(menteur.length - 22 - 46 - 14 + 24, 2, true);
  await assert.rejects(scanDepuisArchive(menteur), code('scan-archive'));
  const DS = globalThis.DecompressionStream;
  try { globalThis.DecompressionStream = undefined; await assert.rejects(scanDepuisArchive(menteur), code('scan-navigateur')); }
  finally { globalThis.DecompressionStream = DS; }
});
