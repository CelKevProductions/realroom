// Crédits et générations sur une vraie base (PGlite, dossier temporaire) :
// débit + ligne du rendu en une requête, remboursement unique, solde jamais négatif.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'realroom-credits-'));
process.env.PGLITE_DIR = dossier;
delete process.env.DATABASE_URL;
const { sql, une } = await import('../../lib/db.js');
const { debiterGeneration, echouerGeneration, crediter } = await import('../../lib/credits.js');

const solde = async uid => (await une('SELECT credits FROM utilisateurs WHERE id = $1', [uid])).credits;

before(async () => {
  await sql("INSERT INTO utilisateurs (id, email, credits) VALUES ('u_a', 'a@example.com', 3)");
  await sql("INSERT INTO projets (id, utilisateur_id, nom) VALUES ('p_a', 'u_a', 'Projet')");
  await sql("INSERT INTO pieces (id, projet_id, utilisateur_id, nom) VALUES ('r_a', 'p_a', 'u_a', 'Salon')");
});
after(() => fs.rmSync(dossier, { recursive: true, force: true }));

test('le débit crée la ligne du rendu, dans la même requête', async () => {
  assert.equal(await debiterGeneration({ uid: 'u_a', n: 1, motif: 'rendu', rid: 'g_1', pieceId: 'r_a', type: 'image' }), true);
  assert.equal(await solde('u_a'), 2);
  const r = await une("SELECT etat, credits, type FROM rendus WHERE id = 'g_1'");
  assert.deepEqual({ ...r }, { etat: 'en_cours', credits: 1, type: 'image' });
  const m = await une("SELECT delta, ref FROM mouvements WHERE ref = 'rendu:g_1'");
  assert.equal(m.delta, -1);
});

test('solde insuffisant : ni débit, ni ligne', async () => {
  assert.equal(await debiterGeneration({ uid: 'u_a', n: 5, motif: 'monde', rid: 'g_2', pieceId: 'r_a', type: 'monde', suivi: { source: 'g_1' } }), false);
  assert.equal(await solde('u_a'), 2);
  assert.equal(await une("SELECT id FROM rendus WHERE id = 'g_2'"), null);
});

test('un échec rembourse une seule fois, même appelé deux fois en parallèle', async () => {
  const [a, b] = await Promise.all([echouerGeneration('g_1', 'essai'), echouerGeneration('g_1', 'essai')]);
  assert.equal([a, b].filter(Boolean).length, 1);
  assert.equal(await solde('u_a'), 3);
  assert.equal(await echouerGeneration('g_1', 'encore'), false);
  assert.equal(await solde('u_a'), 3);
  assert.equal((await une("SELECT etat FROM rendus WHERE id = 'g_1'")).etat, 'erreur');
});

test('débits simultanés : jamais plus que le solde', async () => {
  const ids = Array.from({ length: 6 }, (_, i) => 'g_p' + i);
  const res = await Promise.all(ids.map(rid => debiterGeneration({ uid: 'u_a', n: 1, motif: 'rendu', rid, pieceId: 'r_a', type: 'image' })));
  assert.equal(res.filter(Boolean).length, 3);
  assert.equal(await solde('u_a'), 0);
  assert.equal((await une("SELECT count(*)::int AS n FROM rendus WHERE id LIKE 'g_p%'")).n, 3);
});

test('un crédit Stripe ne compte qu’une fois', async () => {
  assert.equal(await crediter('u_a', 10, 'achat', 'stripe:cs_test_1'), true);
  assert.equal(await crediter('u_a', 10, 'achat', 'stripe:cs_test_1'), false);
  assert.equal(await solde('u_a'), 10);
});
