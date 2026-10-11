// Base isolée : le verrou optimiste doit traiter NULL SQL et null JSON comme la même absence.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { scanApple, scanAndroid } from '../fixtures/scans.js';
import { champsDepuisScan } from '../../lib/scan.js';

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'realroom-scan-'));
process.env.PGLITE_DIR = dossier;
delete process.env.DATABASE_URL;
const { sql, une } = await import('../../lib/db.js');
// Next résout ce sous-chemin sans extension ; Node ESM direct demande le fichier .js.
const resolution = registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(['next/headers', 'next/navigation'].includes(specifier) ? specifier + '.js' : specifier, context);
} });
const { importerScan, piece, majPiece } = await import('../../lib/projets.js');
resolution.deregister();

before(async () => {
  await sql("INSERT INTO utilisateurs (id, email, credits) VALUES ('u_scan', 'scan@example.com', 3)");
  await sql("INSERT INTO projets (id, utilisateur_id, nom) VALUES ('p_scan', 'u_scan', 'Scans')");
});
after(() => fs.rmSync(dossier, { recursive: true, force: true }));

async function creer(id) {
  await sql('INSERT INTO pieces (id, projet_id, utilisateur_id, nom) VALUES ($1, $2, $3, $4)', [id, 'p_scan', 'u_scan', id]);
  return piece('u_scan', id);
}
const champs = () => champsDepuisScan(scanApple());
const conflit = e => e.statut === 409 && e.code === 'scan-conflit';

test('un premier import accepte une absence SQL de modèle et proposition', async () => {
  const avant = await creer('r_sql_null');
  const p = await importerScan('u_scan', avant.id, champs(), avant);
  assert.equal(p.modele.capture.source, 'apple-roomplan');
  assert.equal(p.proposition, null);
});

test('un plan sauvegardé avec proposition null JSON reste remplaçable', async () => {
  let p = await creer('r_json_null');
  p = await importerScan('u_scan', p.id, champs(), p);
  p = await majPiece('u_scan', p.id, { agencement: p.agencement, proposition: null });
  assert.equal((await une('SELECT proposition IS NULL AS sql_null FROM pieces WHERE id = $1', [p.id])).sql_null, false);
  const n = await importerScan('u_scan', p.id, champsDepuisScan(scanAndroid()), p);
  assert.equal(n.modele.capture.source, 'android-arcore-webxr');
});

test('une proposition concurrente est toujours protégée après normalisation du null', async () => {
  let p = await creer('r_conflit');
  p = await importerScan('u_scan', p.id, champs(), p);
  await majPiece('u_scan', p.id, { proposition: { date: 'nouvelle' } });
  await assert.rejects(importerScan('u_scan', p.id, champsDepuisScan(scanAndroid()), p), conflit);
  assert.equal((await piece('u_scan', p.id)).proposition.date, 'nouvelle');
});

test('le remplacement conserve photos, rendus et crédits', async () => {
  let p = await creer('r_preserve');
  p = await importerScan('u_scan', p.id, champs(), p);
  await sql('UPDATE pieces SET photos = $2::jsonb WHERE id = $1', [p.id, JSON.stringify([{ role: 'entree', url: '/fixture.jpg' }])]);
  await sql("INSERT INTO rendus (id, piece_id, utilisateur_id, type, etat, credits) VALUES ('g_scan', 'r_preserve', 'u_scan', 'image', 'fini', 1)");
  p = await piece('u_scan', p.id);
  const n = await importerScan('u_scan', p.id, champsDepuisScan(scanAndroid()), p);
  assert.deepEqual(n.photos, p.photos);
  assert.equal((await une("SELECT etat FROM rendus WHERE id = 'g_scan'")).etat, 'fini');
  assert.equal((await une("SELECT credits FROM utilisateurs WHERE id = 'u_scan'")).credits, 3);
});
