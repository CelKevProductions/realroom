// Migration d'une base créée par une version précédente (table codes avec l'adresse en clair)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'realroom-schema-'));
after(() => fs.rmSync(dossier, { recursive: true, force: true }));

test('une base de la version 1 est migrée : codes par empreinte, profils Maison Corleone, données intactes', async () => {
  const ancienne = new PGlite(dossier);
  await ancienne.exec(`
    CREATE TABLE utilisateurs (id text PRIMARY KEY, email text UNIQUE NOT NULL, langue text NOT NULL DEFAULT 'fr', credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0), cree_le timestamptz NOT NULL DEFAULT now());
    CREATE TABLE codes (email text PRIMARY KEY, empreinte text NOT NULL, essais integer NOT NULL DEFAULT 0, expire_le timestamptz NOT NULL, envois integer NOT NULL DEFAULT 1, fenetre_le timestamptz NOT NULL DEFAULT now());
    CREATE TABLE compteurs (cle text PRIMARY KEY, n integer NOT NULL DEFAULT 0, jusqu_au timestamptz NOT NULL);
    INSERT INTO utilisateurs (id, email, credits) VALUES ('u_ancien', 'ancien@example.com', 7);
    INSERT INTO codes (email, empreinte, expire_le) VALUES ('ancien@example.com', 'x', now());
  `);
  await ancienne.close();
  process.env.PGLITE_DIR = dossier;
  delete process.env.DATABASE_URL;
  const { sql, une } = await import('../../lib/db.js');
  await sql("INSERT INTO codes (cle, empreinte, expire_le) VALUES ('code:abc', 'y', now())");
  assert.equal((await une("SELECT credits FROM utilisateurs WHERE id = 'u_ancien'")).credits, 7);
  assert.equal((await une("SELECT valeur FROM meta WHERE cle = 'schema'")).valeur, '4');
  assert.ok((await une("SELECT to_regclass('public.bienvenues') AS t")).t);
  // version 3 : profils des clients Maison Corleone (édition gratuite)
  assert.ok((await une("SELECT to_regclass('public.profils_mc') AS t")).t);
});

// En ligne (Neon), le schéma part requête par requête : chaque morceau doit être une requête valide
// (un « ; » dans un commentaire avait coupé la création de profils_mc et bloqué la migration)
test('le schéma découpé comme pour Neon : chaque requête passe seule', async () => {
  const { SCHEMA, decouperSQL } = await import('../../lib/db.js');
  const requetes = decouperSQL(SCHEMA);
  assert.ok(requetes.length >= 10);
  const pg = new PGlite();
  for (const r of requetes) {
    assert.match(r, /^CREATE (TABLE|INDEX|UNIQUE INDEX)/, 'morceau inattendu : ' + r.slice(0, 60));
    await pg.query(r);
  }
  assert.ok((await pg.query("SELECT to_regclass('public.profils_mc') AS t")).rows[0].t);
  await pg.close();
});
