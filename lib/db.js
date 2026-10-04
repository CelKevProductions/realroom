// Base de données : Postgres (Neon, via DATABASE_URL) en ligne ; PGlite (Postgres embarqué,
// dossier .data/pglite) en local et pour les essais. Même SQL des deux côtés.
import fs from 'node:fs';

// une seule connexion par processus : Next charge ce module plusieurs fois (pages, routes d'API),
// et deux PGlite sur le même dossier ne verraient pas les écritures l'un de l'autre
const G = globalThis.__realroomDb || (globalThis.__realroomDb = { base: null, pret: null });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS utilisateurs (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  langue text NOT NULL DEFAULT 'fr',
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  cree_le timestamptz NOT NULL DEFAULT now()
);
-- codes de connexion en attente : la clé est une empreinte de l'adresse (pas l'adresse elle-même)
CREATE TABLE IF NOT EXISTS codes (
  cle text PRIMARY KEY,
  empreinte text NOT NULL,
  essais integer NOT NULL DEFAULT 0,
  expire_le timestamptz NOT NULL
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
CREATE INDEX IF NOT EXISTS pieces_utilisateur ON pieces(utilisateur_id);
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
CREATE INDEX IF NOT EXISTS rendus_utilisateur ON rendus(utilisateur_id);
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
-- crédits offerts : une fois par adresse (empreinte de l'adresse normalisée), même après suppression du compte
CREATE TABLE IF NOT EXISTS bienvenues (
  empreinte text PRIMARY KEY,
  cree_le timestamptz NOT NULL DEFAULT now()
);
-- clients Maison Corleone (connexion par le compte client de la boutique) : leur compte RealRoom
-- a pour clé « mc:<identifiant client Shopify> » ; adresse et prénom pour l'affichage
CREATE TABLE IF NOT EXISTS profils_mc (
  utilisateur_id text PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
  shopify_id text UNIQUE NOT NULL,
  email text,
  prenom text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  vu_le timestamptz NOT NULL DEFAULT now()
);
-- version du schéma
CREATE TABLE IF NOT EXISTS meta (
  cle text PRIMARY KEY,
  valeur text NOT NULL
);
`;
// Versions du schéma. Une base neuve reçoit SCHEMA directement ; une base existante passe d'abord
// par les migrations des versions qui lui manquent (puis SCHEMA, tout en IF NOT EXISTS).
// Pour changer une table : ajouter une version ici, et mettre SCHEMA à jour.
const VERSION = 3;
const MIGRATIONS = {
  // 2 : codes de connexion rangés par empreinte de l'adresse (plus d'adresse en clair)
  2: 'DROP TABLE IF EXISTS codes'
  // 3 : table profils_mc (créée par SCHEMA, rien à transformer)
};

async function ouvrir() {
  // Neon via Vercel : DATABASE_URL (ou POSTGRES_URL, que l'intégration crée aussi)
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    return { requete: (texte, params = []) => sql.query(texte, params), multiple: async texte => { for (const t of texte.split(';').map(s => s.trim()).filter(Boolean)) await sql.query(t); } };
  }
  if (process.env.VERCEL) throw new Error('DATABASE_URL manquante : ajoutez une base Postgres (Neon) au projet Vercel.');
  const { PGlite } = await import('@electric-sql/pglite');
  const dossier = process.env.PGLITE_DIR || '.data/pglite';
  fs.mkdirSync(/*turbopackIgnore: true*/ dossier, { recursive: true });
  const pg = new PGlite(dossier);
  return { requete: async (texte, params = []) => (await pg.query(texte, params)).rows, multiple: texte => pg.exec(texte) };
}

async function migrer(base) {
  const existe = async t => { const r = await base.requete('SELECT to_regclass($1) AS t', [t]); return !!(r[0] && r[0].t); };
  let version = 0;
  if (await existe('public.meta')) {
    const r = await base.requete("SELECT valeur FROM meta WHERE cle = 'schema'");
    version = Number(r[0] && r[0].valeur) || 0;
  }
  // base d'avant la table meta : version 1
  if (!version && await existe('public.utilisateurs')) version = 1;
  if (version >= VERSION) return;
  if (version > 0) for (let v = version + 1; v <= VERSION; v++) if (MIGRATIONS[v]) await base.multiple(MIGRATIONS[v]);
  await base.multiple(SCHEMA);
  await base.requete("INSERT INTO meta (cle, valeur) VALUES ('schema', $1) ON CONFLICT (cle) DO UPDATE SET valeur = $1", [String(VERSION)]);
}

// requête paramétrée ($1, $2…) -> lignes
export async function sql(texte, params = []) {
  if (!G.pret) G.pret = (async () => {
    G.base = await ouvrir();
    await migrer(G.base);
  })().catch(e => { G.pret = null; throw e; });
  await G.pret;
  return G.base.requete(texte, params);
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

// compteur à fenêtre (limites par jour, par heure) : true si on reste sous le plafond.
// Les clés ne contiennent jamais d'adresse e-mail ni d'IP en clair (voir empreinte() dans session.js).
export async function compter(cle, plafond, dureeMs) {
  const r = await une(
    `INSERT INTO compteurs (cle, n, jusqu_au) VALUES ($1, 1, now() + ($2 || ' milliseconds')::interval)
     ON CONFLICT (cle) DO UPDATE SET
       n = CASE WHEN compteurs.jusqu_au < now() THEN 1 ELSE compteurs.n + 1 END,
       jusqu_au = CASE WHEN compteurs.jusqu_au < now() THEN now() + ($2 || ' milliseconds')::interval ELSE compteurs.jusqu_au END
     RETURNING n`, [cle, String(dureeMs)]);
  return r.n <= plafond;
}

// valeur d'un compteur encore dans sa fenêtre (0 sinon), sans l'incrémenter
export async function lireCompteur(cle) {
  const r = await une('SELECT n FROM compteurs WHERE cle = $1 AND jusqu_au > now()', [cle]);
  return r ? r.n : 0;
}

// ménage : codes expirés et compteurs échus (appelé de temps en temps)
export async function purger() {
  await sql("DELETE FROM codes WHERE expire_le < now() - interval '1 hour'");
  await sql("DELETE FROM compteurs WHERE jusqu_au < now() - interval '1 hour'");
}
