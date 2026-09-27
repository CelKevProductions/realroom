// Base de données : Postgres (Neon, via DATABASE_URL) en ligne ; PGlite (Postgres embarqué,
// dossier .data/pglite) en local et pour les essais. Même SQL des deux côtés.
import fs from 'node:fs';

let base = null;
let pret = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS utilisateurs (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  langue text NOT NULL DEFAULT 'fr',
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS codes (
  email text PRIMARY KEY,
  empreinte text NOT NULL,
  essais integer NOT NULL DEFAULT 0,
  expire_le timestamptz NOT NULL,
  envois integer NOT NULL DEFAULT 1,
  fenetre_le timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS projets (
  id text PRIMARY KEY,
  utilisateur_id text NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nom text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  maj_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projets_utilisateur ON projets(utilisateur_id);
CREATE TABLE IF NOT EXISTS pieces (
  id text PRIMARY KEY,
  projet_id text NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  utilisateur_id text NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nom text NOT NULL,
  fonction text NOT NULL DEFAULT 'salon',
  etat text NOT NULL DEFAULT 'photos',
  dims jsonb,
  photos jsonb NOT NULL DEFAULT '[]',
  notes text NOT NULL DEFAULT '',
  modele jsonb,
  agencement jsonb NOT NULL DEFAULT '[]',
  proposition jsonb,
  erreur text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  maj_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pieces_projet ON pieces(projet_id);
CREATE TABLE IF NOT EXISTS rendus (
  id text PRIMARY KEY,
  piece_id text NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  utilisateur_id text NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type text NOT NULL,
  etat text NOT NULL DEFAULT 'en_cours',
  credits integer NOT NULL DEFAULT 0,
  suivi jsonb,
  resultat jsonb,
  erreur text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  fini_le timestamptz
);
CREATE INDEX IF NOT EXISTS rendus_piece ON rendus(piece_id);
CREATE TABLE IF NOT EXISTS mouvements (
  id bigserial PRIMARY KEY,
  utilisateur_id text NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  motif text NOT NULL,
  ref text UNIQUE,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mouvements_utilisateur ON mouvements(utilisateur_id);
CREATE TABLE IF NOT EXISTS compteurs (
  cle text PRIMARY KEY,
  n integer NOT NULL DEFAULT 0,
  jusqu_au timestamptz NOT NULL
);
`;

async function ouvrir() {
  if (process.env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    return { requete: (texte, params = []) => sql.query(texte, params), multiple: async texte => { for (const t of texte.split(';').map(s => s.trim()).filter(Boolean)) await sql.query(t); } };
  }
  if (process.env.VERCEL) throw new Error('DATABASE_URL manquante : ajoutez une base Postgres (Neon) au projet Vercel.');
  const { PGlite } = await import('@electric-sql/pglite');
  const dossier = process.env.PGLITE_DIR || '.data/pglite';
  fs.mkdirSync(/*turbopackIgnore: true*/ dossier, { recursive: true });
  const pg = new PGlite(dossier);
  return { requete: async (texte, params = []) => (await pg.query(texte, params)).rows, multiple: texte => pg.exec(texte) };
}

// requête paramétrée ($1, $2…) -> lignes
export async function sql(texte, params = []) {
  if (!pret) pret = (async () => {
    base = await ouvrir();
    // schéma créé une fois (la dernière table créée sert de témoin)
    const t = await base.requete("SELECT to_regclass('public.compteurs') AS t");
    if (!t[0] || !t[0].t) await base.multiple(SCHEMA);
  })().catch(e => { pret = null; throw e; });
  await pret;
  return base.requete(texte, params);
}
export async function une(texte, params = []) {
  const r = await sql(texte, params);
  return r[0] || null;
}

// identifiants courts, sûrs dans une URL
export function nouvelId(prefixe = '') {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return prefixe + Buffer.from(a).toString('base64url');
}

// compteur à fenêtre (limites par jour, par heure) : true si on reste sous le plafond
export async function compter(cle, plafond, dureeMs) {
  const r = await une(
    `INSERT INTO compteurs (cle, n, jusqu_au) VALUES ($1, 1, now() + ($2 || ' milliseconds')::interval)
     ON CONFLICT (cle) DO UPDATE SET
       n = CASE WHEN compteurs.jusqu_au < now() THEN 1 ELSE compteurs.n + 1 END,
       jusqu_au = CASE WHEN compteurs.jusqu_au < now() THEN now() + ($2 || ' milliseconds')::interval ELSE compteurs.jusqu_au END
     RETURNING n`, [cle, String(dureeMs)]);
  return r.n <= plafond;
}
