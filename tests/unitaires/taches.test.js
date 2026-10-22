// File des tâches longues sur une base PGlite isolée : dédoublonnage, débit unique,
// reprise, application du résultat, annulation remboursée une seule fois.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerHooks } from 'node:module';

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'realroom-taches-'));
after(() => fs.rmSync(dossier, { recursive: true, force: true }));
process.env.PGLITE_DIR = dossier;
process.env.REALROOM_SIMULATION = '1';
delete process.env.DATABASE_URL; delete process.env.SCENEWEAVER_URL;
// Next résout ces sous-chemins sans extension ; Node ESM direct demande le fichier .js.
registerHooks({ resolve: (s, c, suite) => suite(['next/headers', 'next/navigation'].includes(s) ? s + '.js' : s, c) });

test('approfondissement : un seul débit, résultat ajouté aux propositions, annulation remboursée une fois', async () => {
  const { sql, une } = await import('../../lib/db.js');
  const { PRODUITS } = await import('../../lib/catalogue.js');
  const { executerAssistant } = await import('../../lib/assistant-amenagement.js');
  const { rectangle } = await import('../fixtures/bench-chambres.js');
  const { lancer, avancer, abandonner } = await import('../../lib/approfondissement.js');
  const credits = async () => (await une("SELECT credits FROM utilisateurs WHERE id = 'u1'")).credits;
  await sql("INSERT INTO utilisateurs (id, email, credits) VALUES ('u1', 'u1@example.com', 10)");
  await sql("INSERT INTO projets (id, utilisateur_id, nom) VALUES ('p1', 'u1', 'Projet')");
  const modele = rectangle(5, 4), r = executerAssistant({ fonction: 'chambre', modele, agencement: [] }, { action: 'generer' }, PRODUITS);
  await sql(`INSERT INTO pieces (id, projet_id, utilisateur_id, nom, fonction, etat, modele, agencement, proposition) VALUES ('x1', 'p1', 'u1', 'Chambre', 'chambre', 'prete', $1::jsonb, $2::jsonb, $3::jsonb)`,
    [JSON.stringify(modele), JSON.stringify(r.agencement), JSON.stringify(r.proposition)]);

  const t1 = await lancer('u1', 'x1', PRODUITS, 'fr');
  const t2 = await lancer('u1', 'x1', PRODUITS, 'fr');
  assert.equal(t2.id, t1.id, 'demande identique : même tâche');
  assert.equal(await credits(), 8, 'débitée une seule fois');
  assert.equal((await avancer('u1', t1, PRODUITS)).etat, 'en_cours');
  await sql("UPDATE taches SET cree_le = now() - interval '10 seconds' WHERE id = $1", [t1.id]);
  const fin = await avancer('u1', await une('SELECT * FROM taches WHERE id = $1', [t1.id]), PRODUITS);
  assert.equal(fin.etat, 'fini', JSON.stringify(fin.erreur));
  assert.equal(fin.resultat.applique, true);
  const piece = await une("SELECT * FROM pieces WHERE id = 'x1'");
  assert.equal(piece.proposition.variantes.liste.length, 2);
  assert.equal(piece.proposition.moteur.type, 'sceneweaver');
  assert.equal((await une("SELECT count(*)::int AS n FROM scenes WHERE piece_id = 'x1' AND type = 'approfondie'")).n, 1);
  // une seconde lecture d'une tâche finie ne réapplique rien
  await avancer('u1', await une('SELECT * FROM taches WHERE id = $1', [t1.id]), PRODUITS);
  assert.equal((await une("SELECT * FROM pieces WHERE id = 'x1'")).proposition.variantes.liste.length, 2);

  assert.equal((await lancer('u1', 'x1', PRODUITS, 'fr')).id, t1.id, 'même disposition après une simulation sans changement : même tâche, rien à payer');
  assert.equal(await credits(), 8);
  await sql(`INSERT INTO pieces (id, projet_id, utilisateur_id, nom, fonction, etat, modele, agencement, proposition) VALUES ('x2', 'p1', 'u1', 'Chambre 2', 'chambre', 'prete', $1::jsonb, $2::jsonb, $3::jsonb)`,
    [JSON.stringify(modele), JSON.stringify(r.agencement), JSON.stringify(r.proposition)]);
  const t3 = await lancer('u1', 'x2', PRODUITS, 'fr');
  assert.notEqual(t3.id, t1.id, 'autre pièce : nouvelle tâche');
  assert.equal(await credits(), 6);
  assert.equal((await abandonner('u1', t3)).etat, 'annule');
  await abandonner('u1', await une('SELECT * FROM taches WHERE id = $1', [t3.id]));
  assert.equal(await credits(), 8, 'remboursée une seule fois');
});
