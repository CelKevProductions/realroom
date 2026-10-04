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
// domaine de la boutique, quelle que soit la saisie (« https://www.maisoncorleone.com/ », espaces…)
const domaine = v => {
  const brut = String(v || '').trim().replace(/^https?:\/\//i, '');
  try { return new URL('https://' + brut).host || 'maisoncorleone.com'; } catch (_) { return 'maisoncorleone.com'; }
};
export const MAISON = {
  boutique: domaine(process.env.MC_BOUTIQUE || 'maisoncorleone.com'),
  // identifiant de la boutique chez Shopify (public : il figure dans sa découverte OpenID) ; sert de
  // secours si la découverte ne répond pas
  idShopify: (process.env.MC_SHOP_ID || '93810557195').trim(),
  clientId: (process.env.MC_CLIENT_ID || '').trim(),
  clientSecret: (process.env.MC_CLIENT_SECRET || '').trim(),
  rendusOfferts: nombre('MC_RENDUS_OFFERTS', 2),
  analysesMax: nombre('MC_ANALYSES_MAX', 6),      // pièces analysées au total par client
  nouveauxParJour: nombre('MC_NOUVEAUX_PAR_JOUR', 300)   // clients qui reçoivent leurs rendus offerts, par jour (garde-fou de coût)
};
export const maisonConfiguree = () => !!MAISON.clientId;
// Référence d'erreur, affichée discrètement sous le message (pour le support, sans les journaux) :
// <étape>-<précision>, l'étape parmi depart (avant la boutique), decouverte (boutique injoignable),
// etat (cookie perdu ou expiré), jeton (échange du code), idtoken (identité refusée), compte (base),
// session ; la précision est un code SQL, un statut HTTP, un code réseau ou une variable manquante.
const precision = e => {
  if (!e) return '';
  const m = String(e.message || '');
  if (/SESSION_SECRET/.test(m)) return 'secret';
  if (/DATABASE_URL/.test(m)) return 'base';
  const c = e.code || (e.cause && e.cause.code) || (e.name && e.name !== 'Error' ? e.name : '');
  return String(c || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16);
};
// annote une erreur de son étape (la première étape qui l'a vue l'emporte)
export function marquer(e, etape) {
  if (!e || typeof e !== 'object') e = new Error(String(e));
  if (!e.raison) { const p = precision(e); e.raison = p ? etape + '-' + p : etape; }
  return e;
}
export const raisonErreur = e => String((e && e.raison) || 'serveur-' + (precision(e) || 'inconnu'));
// essais locaux sans client Shopify : connexion simulée (jamais sur Vercel)
export const maisonSimulee = () => !maisonConfiguree() && ESSAIS_LOCAUX;

const COOKIE_OAUTH = 'mc_oauth';
const AGENT = 'RealRoom-MaisonCorleone/1.0 (+https://maisoncorleone.com)';
const b64url = b => Buffer.from(b).toString('base64url');
const prod = () => process.env.NODE_ENV === 'production' && !ESSAIS_LOCAUX;

// points d'entrée OAuth de la boutique (découverte OpenID), gardés une heure. Si la découverte ne
// répond pas (réseau, page de protection…), les adresses génériques de Shopify pour cette boutique
// prennent le relais (gardées cinq minutes : la découverte est retentée ensuite)
let decouverte = null;
async function points() {
  if (decouverte && Date.now() - decouverte.t < (decouverte.secours ? 3e5 : 36e5)) return decouverte;
  try {
    let r;
    try { r = await fetch(`https://${MAISON.boutique}/.well-known/openid-configuration`, { headers: { 'User-Agent': AGENT }, cache: 'no-store' }); } catch (e) { throw marquer(e, 'decouverte'); }
    if (!r.ok) throw Object.assign(new Error('découverte OpenID ' + r.status), { raison: 'decouverte-' + r.status });
    const j = await r.json().catch(() => ({}));
    if (!j.authorization_endpoint || !j.token_endpoint) throw Object.assign(new Error('découverte OpenID incomplète'), { raison: 'decouverte-incomplete' });
    decouverte = { ...j, t: Date.now() };
  } catch (e) {
    if (!MAISON.idShopify) throw e;
    console.error('Maison Corleone : découverte OpenID indisponible, adresses Shopify de secours', raisonErreur(e), e && e.message);
    const base = `https://shopify.com/authentication/${MAISON.idShopify}`;
    decouverte = { authorization_endpoint: base + '/oauth/authorize', token_endpoint: base + '/oauth/token', secours: true, t: Date.now() };
  }
  return decouverte;
}


// 1) départ vers la page de connexion de la boutique : état, nonce et vérificateur PKCE dans un
//    cookie signé de 10 minutes (lu seulement par /api/mc/retour)
export async function urlConnexion({ origine, suite, lang }) {
  const p = await points();
  const etat = b64url(randomBytes(24)), nonce = b64url(randomBytes(24)), verif = b64url(randomBytes(48));
  try {
    const jeton = await new SignJWT({ etat, nonce, verif, suite: suiteSure(suite, lang), lang })
      .setProtectedHeader({ alg: 'HS256' }).setAudience('mc-oauth').setIssuedAt().setExpirationTime('10m').sign(secret());
    (await cookies()).set(COOKIE_OAUTH, jeton, { httpOnly: true, secure: prod(), sameSite: 'lax', path: '/api/mc', maxAge: 600 });
  } catch (e) { throw marquer(e, 'depart'); }
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
  if (!brut) throw Object.assign(new Error('état absent ou expiré'), { raison: 'etat-absent' });
  let att;
  try { att = (await jwtVerify(brut, secret(), { algorithms: ['HS256'], audience: 'mc-oauth' })).payload; } catch (e) { throw marquer(e, 'etat'); }
  if (!etat || etat !== att.etat) throw Object.assign(new Error('état différent'), { raison: 'etat-different' });
  const p = await points();
  const corps = new URLSearchParams({ grant_type: 'authorization_code', client_id: MAISON.clientId, redirect_uri: origine + '/api/mc/retour', code: String(code || '') });
  const entetes = { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': AGENT };
  if (MAISON.clientSecret) entetes.Authorization = 'Basic ' + Buffer.from(MAISON.clientId + ':' + MAISON.clientSecret).toString('base64');
  else { corps.set('code_verifier', att.verif); entetes.Origin = origine; }
  let r;
  try { r = await fetch(p.token_endpoint, { method: 'POST', headers: entetes, body: corps, cache: 'no-store' }); } catch (e) { throw marquer(e, 'jeton'); }
  const j = await r.json().catch(() => ({}));
  // 401 invalid_client : identifiant ou secret refusé ; 400 invalid_grant : code expiré ou adresse de retour différente
  if (!r.ok || !j.id_token) {
    const err = String(j.error || (r.ok ? 'sansidtoken' : '')).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);
    throw Object.assign(new Error(`échange du code ${r.status} ${j.error || ''} ${String(j.error_description || '').slice(0, 200)}`), { raison: 'jeton-' + r.status + (err ? '-' + err : '') });
  }
  let id;
  try { id = decodeJwt(j.id_token); } catch (e) { throw marquer(e, 'idtoken'); }
  const aud = Array.isArray(id.aud) ? id.aud : [id.aud];
  const refus = id.nonce !== att.nonce ? 'nonce' : !aud.includes(MAISON.clientId) ? 'aud' : id.exp && id.exp * 1000 < Date.now() - 60e3 ? 'exp' : !id.sub ? 'sub' : null;
  if (refus) throw Object.assign(new Error('id_token refusé : ' + refus), { raison: 'idtoken-' + refus });
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
