// Édition Maison Corleone : accès gratuit avec le compte client de la boutique maisoncorleone.com.
// La boutique utilise les nouveaux comptes clients Shopify : connexion OAuth 2.0 / OpenID Connect
// par la Customer Account API (canal « Headless » de la boutique : identifiant client, et secret
// si le client est déclaré confidentiel ; sinon PKCE). Le compte RealRoom associé a pour clé
// « mc:<identifiant client> » et reçoit les rendus offerts une seule fois par client.
// Module serveur uniquement (routes d'API, pages) : le secret ne quitte jamais le serveur.
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, decodeJwt } from 'jose';
import { cookies } from 'next/headers';
import { sql, une, nouvelId, compter, lireCompteur } from './db.js';
import { secret, empreinte } from './session.js';
import { ESSAIS_LOCAUX } from './config.js';
import { suiteSure, estCompteMaison } from './maison-regles.js';

export { suiteSure, estCompteMaison };

const nombre = (nom, defaut) => {
  const v = process.env[nom];
  const n = v === undefined || String(v).trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : defaut;
};
export const MAISON = {
  boutique: (process.env.MC_BOUTIQUE || 'maisoncorleone.com').replace(/^https?:\/\//, '').replace(/\/$/, ''),
  clientId: (process.env.MC_CLIENT_ID || '').trim(),
  clientSecret: (process.env.MC_CLIENT_SECRET || '').trim(),
  rendusOfferts: nombre('MC_RENDUS_OFFERTS', 2),
  analysesMax: nombre('MC_ANALYSES_MAX', 6),      // pièces analysées au total par client
  nouveauxParJour: nombre('MC_NOUVEAUX_PAR_JOUR', 300)   // clients qui reçoivent leurs rendus offerts, par jour (garde-fou de coût)
};
export const maisonConfiguree = () => !!MAISON.clientId;
// étape qui a échoué, affichée discrètement sous le message d'erreur (pour le support) :
// decouverte (boutique injoignable), etat (cookie perdu ou expiré), jeton-<statut> (échange du code), serveur (base…)
export const raisonErreur = e => String((e && (e.raison || (['decouverte', 'etat', 'jeton'].includes(e.code) ? e.code : ''))) || 'serveur');
// essais locaux sans client Shopify : connexion simulée (jamais sur Vercel)
export const maisonSimulee = () => !maisonConfiguree() && ESSAIS_LOCAUX;

const COOKIE_OAUTH = 'mc_oauth';
const AGENT = 'RealRoom-MaisonCorleone/1.0 (+https://maisoncorleone.com)';
const b64url = b => Buffer.from(b).toString('base64url');
const prod = () => process.env.NODE_ENV === 'production' && !ESSAIS_LOCAUX;

// points d'entrée OAuth de la boutique (découverte OpenID), gardés une heure
let decouverte = null;
async function points() {
  if (decouverte && Date.now() - decouverte.t < 36e5) return decouverte;
  const r = await fetch(`https://${MAISON.boutique}/.well-known/openid-configuration`, { headers: { 'User-Agent': AGENT }, cache: 'no-store' });
  if (!r.ok) throw Object.assign(new Error('découverte OpenID ' + r.status), { code: 'decouverte' });
  const j = await r.json().catch(() => ({}));
  if (!j.authorization_endpoint || !j.token_endpoint) throw Object.assign(new Error('découverte OpenID incomplète'), { code: 'decouverte' });
  decouverte = { ...j, t: Date.now() };
  return decouverte;
}


// 1) départ vers la page de connexion de la boutique : état, nonce et vérificateur PKCE dans un
//    cookie signé de 10 minutes (lu seulement par /api/mc/retour)
export async function urlConnexion({ origine, suite, lang }) {
  const p = await points();
  const etat = b64url(randomBytes(24)), nonce = b64url(randomBytes(24)), verif = b64url(randomBytes(48));
  const jeton = await new SignJWT({ etat, nonce, verif, suite: suiteSure(suite, lang), lang })
    .setProtectedHeader({ alg: 'HS256' }).setAudience('mc-oauth').setIssuedAt().setExpirationTime('10m').sign(secret());
  (await cookies()).set(COOKIE_OAUTH, jeton, { httpOnly: true, secure: prod(), sameSite: 'lax', path: '/api/mc', maxAge: 600 });
  const u = new URL(p.authorization_endpoint);
  u.searchParams.set('scope', 'openid email customer-account-api:full');
  u.searchParams.set('client_id', MAISON.clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', origine + '/api/mc/retour');
  u.searchParams.set('state', etat);
  u.searchParams.set('nonce', nonce);
  u.searchParams.set('locale', lang === 'en' ? 'en' : 'fr');
  if (!MAISON.clientSecret) {
    u.searchParams.set('code_challenge', b64url(createHash('sha256').update(verif).digest()));
    u.searchParams.set('code_challenge_method', 'S256');
  }
  return u.toString();
}

// 2) retour de la boutique : état vérifié, code échangé contre les jetons, identité lue dans l'id_token
//    (reçu directement du point de jeton, en TLS : on vérifie nonce, audience et échéance)
export async function finirConnexion({ origine, code, etat }) {
  const jar = await cookies();
  const brut = jar.get(COOKIE_OAUTH)?.value;
  jar.set(COOKIE_OAUTH, '', { path: '/api/mc', maxAge: 0 });
  if (!brut) throw Object.assign(new Error('état absent ou expiré'), { code: 'etat' });
  let att;
  try { att = (await jwtVerify(brut, secret(), { algorithms: ['HS256'], audience: 'mc-oauth' })).payload; } catch (_) { throw Object.assign(new Error('état invalide'), { code: 'etat' }); }
  if (!etat || etat !== att.etat) throw Object.assign(new Error('état différent'), { code: 'etat' });
  const p = await points();
  const corps = new URLSearchParams({ grant_type: 'authorization_code', client_id: MAISON.clientId, redirect_uri: origine + '/api/mc/retour', code: String(code || '') });
  const entetes = { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': AGENT };
  if (MAISON.clientSecret) entetes.Authorization = 'Basic ' + Buffer.from(MAISON.clientId + ':' + MAISON.clientSecret).toString('base64');
  else { corps.set('code_verifier', att.verif); entetes.Origin = origine; }
  const r = await fetch(p.token_endpoint, { method: 'POST', headers: entetes, body: corps, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  // 401 : identifiant ou secret refusé ; 400 invalid_grant : code expiré ou adresse de retour différente
  if (!r.ok || !j.id_token) {
    throw Object.assign(new Error(`échange du code ${r.status} ${j.error || ''} ${String(j.error_description || '').slice(0, 200)}`), { code: 'jeton', raison: 'jeton-' + r.status });
  }
  const id = decodeJwt(j.id_token);
  const aud = Array.isArray(id.aud) ? id.aud : [id.aud];
  if (id.nonce !== att.nonce || !aud.includes(MAISON.clientId) || (id.exp && id.exp * 1000 < Date.now() - 60e3) || !id.sub) {
    throw Object.assign(new Error('id_token refusé'), { code: 'jeton' });
  }
  const prenom = await prenomClient(j.access_token).catch(() => null);
  return { sub: String(id.sub), email: typeof id.email === 'string' ? id.email : null, prenom, suite: att.suite, lang: att.lang };
}

// prénom du client (Customer Account API) : seulement pour l'accueil, sans incidence si absent
async function prenomClient(jeton) {
  if (!jeton) return null;
  const d = await fetch(`https://${MAISON.boutique}/.well-known/customer-account-api`, { headers: { 'User-Agent': AGENT } }).then(r => (r.ok ? r.json() : null));
  if (!d || !d.graphql_api) return null;
  const r = await fetch(d.graphql_api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: jeton, 'User-Agent': AGENT },
    body: JSON.stringify({ query: 'query { customer { firstName } }' })
  });
  const j = await r.json().catch(() => null);
  const v = j && j.data && j.data.customer && j.data.customer.firstName;
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : null;
}

// compte RealRoom du client (créé au premier passage) ; rendus offerts une fois par client, même
// après suppression du compte (registre bienvenues, par empreinte de l'identifiant)
export async function compteMaison({ sub, email, prenom, langue }) {
  const idClient = String(sub).replace(/^gid:\/\/shopify\/Customer\//, '').slice(0, 80);
  const cle = 'mc:' + idClient;
  let u = await une('SELECT id, email, langue, credits FROM utilisateurs WHERE email = $1', [cle]);
  if (!u) {
    await sql('INSERT INTO utilisateurs (id, email, langue, credits) VALUES ($1, $2, $3, 0) ON CONFLICT (email) DO NOTHING', [nouvelId('u_'), cle, langue === 'en' ? 'en' : 'fr']);
    u = await une('SELECT id, email, langue, credits FROM utilisateurs WHERE email = $1', [cle]);
  }
  await sql(
    `INSERT INTO profils_mc (utilisateur_id, shopify_id, email, prenom) VALUES ($1, $2, $3, $4)
     ON CONFLICT (utilisateur_id) DO UPDATE SET email = COALESCE($3, profils_mc.email), prenom = COALESCE($4, profils_mc.prenom), vu_le = now()`,
    [u.id, idClient, email ? String(email).slice(0, 200) : null, prenom || null]);
  // rendus offerts : une fois par client, et pas plus de MC_NOUVEAUX_PAR_JOUR nouveaux clients par jour
  // (au-delà, la connexion marche mais sans rendu offert ; l'alerte apparaît dans les journaux)
  const marque = empreinte('offert-mc', idClient);
  const dejaServi = !!(await une('SELECT 1 AS x FROM bienvenues WHERE empreinte = $1', [marque]));
  let permis = !dejaServi && MAISON.rendusOfferts > 0;
  if (permis && (await lireCompteur('offerts-mc-du-jour')) >= MAISON.nouveauxParJour) {
    console.error('Maison Corleone : plafond du jour des rendus offerts atteint (MC_NOUVEAUX_PAR_JOUR)');
    permis = false;
  }
  if (permis) {
    await compter('offerts-mc-du-jour', Infinity, 864e5);
    await une(
      `WITH b AS (INSERT INTO bienvenues (empreinte) VALUES ($2) ON CONFLICT (empreinte) DO NOTHING RETURNING empreinte),
            m AS (INSERT INTO mouvements (utilisateur_id, delta, motif, ref) SELECT $1::text, $3::int, 'offert-mc', 'offert-mc:' || $1::text FROM b ON CONFLICT (ref) DO NOTHING RETURNING utilisateur_id, delta),
            c AS (UPDATE utilisateurs SET credits = credits + m.delta FROM m WHERE utilisateurs.id = m.utilisateur_id RETURNING utilisateurs.id)
       SELECT (SELECT count(*) FROM c)::int AS n`, [u.id, marque, MAISON.rendusOfferts]);
    u = await une('SELECT id, email, langue, credits FROM utilisateurs WHERE id = $1', [u.id]);
  }
  return u;
}

// ce que la page de l'édition connaît du client connecté : prénom, rendus restants, sa dernière pièce
export async function profilMaison(u) {
  if (!estCompteMaison(u)) return null;
  const pr = await une('SELECT prenom FROM profils_mc WHERE utilisateur_id = $1', [u.id]);
  const projet = await une('SELECT id FROM projets WHERE utilisateur_id = $1 ORDER BY maj_le DESC LIMIT 1', [u.id]);
  const pieces = await sql(
    `SELECT id, nom, fonction, etat, maj_le FROM pieces WHERE utilisateur_id = $1 AND modele IS NOT NULL ORDER BY maj_le DESC LIMIT 6`, [u.id]);
  return {
    prenom: (pr && pr.prenom) || null,
    rendus: u.credits,
    projetId: projet ? projet.id : null,
    pieces: pieces.map(p => ({ id: p.id, nom: p.nom, fonction: p.fonction, maj_le: p.maj_le }))
  };
}

// garde-fou propre à l'édition gratuite : nombre total de pièces analysées par client
export async function analyseMaisonPermise(u) {
  if (!estCompteMaison(u)) return true;
  return (await lireCompteur('mc-analyses:' + u.id)) < MAISON.analysesMax;
}
export async function compterAnalyseMaison(u) {
  if (estCompteMaison(u)) await compter('mc-analyses:' + u.id, Infinity, 365 * 864e5);
}
