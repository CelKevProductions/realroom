// Comptes : connexion par code reçu par e-mail, session dans un cookie signé (JWT HS256).
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, timingSafeEqual, randomInt } from 'node:crypto';
import { sql, une, nouvelId, compter, lireCompteur, purger } from './db.js';
import { CREDITS, LIMITES, estLangue } from './config.js';
import { envoyerEmail } from './email.js';
import { texte } from './i18n.js';

export const COOKIE = 'rr_session';
const DUREE = 60 * 60 * 24 * 30; // 30 jours

// clé de signature des sessions et des empreintes. En ligne, SESSION_SECRET est obligatoire ;
// la clé de développement ne sert qu'en local (et pour les essais automatiques).
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (process.env.VERCEL || (process.env.NODE_ENV === 'production' && process.env.REALROOM_ESSAIS !== '1')) throw new Error('SESSION_SECRET manquant (32 caractères au moins).');
  return new TextEncoder().encode('developpement-seulement-ne-pas-utiliser-en-ligne-0123456789');
}
// une session ouverte sur un déploiement (prévisualisation, production, local) ne vaut que pour lui
const AUDIENCE = 'realroom:' + (process.env.VERCEL_ENV || 'local');

export const emailValide = e => typeof e === 'string' && e.length <= 200 && /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(e.trim());
const normaliser = e => e.trim().toLowerCase();
// empreinte (HMAC) : codes, compteurs et registre des crédits offerts ne gardent jamais l'adresse ni l'IP en clair
const empreinte = (...parts) => createHmac('sha256', secret()).update(parts.join(':')).digest('hex');
const cle = (type, valeur) => type + ':' + empreinte(type, valeur).slice(0, 40);
// adresse « canonique » pour les crédits offerts : sans +étiquette, et sans les points pour Gmail
function canonique(email) {
  let [local, domaine] = email.split('@');
  local = local.split('+')[0];
  if (domaine === 'googlemail.com') domaine = 'gmail.com';
  if (domaine === 'gmail.com') local = local.replaceAll('.', '');
  return local + '@' + domaine;
}

// 1) demande d'un code : 6 chiffres, valable 10 minutes, 5 envois par heure au plus
export async function demanderCode(emailBrut, langue, ip) {
  if (!emailValide(emailBrut)) return { ok: false, erreur: 'email' };
  const email = normaliser(emailBrut);
  if (Math.random() < .2) await purger().catch(e => console.error('purge', e && e.message));
  if (!(await compter(cle('code-ip', ip), 20, 3600e3))) return { ok: false, erreur: 'limite' };
  if (!(await compter(cle('code-email', email), 5, 3600e3))) return { ok: false, erreur: 'limite' };
  const code = String(randomInt(0, 1e6)).padStart(6, '0');
  await sql(
    `INSERT INTO codes (cle, empreinte, essais, expire_le) VALUES ($1, $2, 0, now() + interval '10 minutes')
     ON CONFLICT (cle) DO UPDATE SET empreinte = $2, essais = 0, expire_le = now() + interval '10 minutes'`,
    [cle('code', email), empreinte(email, code)]);
  const t = texte(estLangue(langue) ? langue : 'fr');
  const envoi = await envoyerEmail({
    a: email,
    sujet: t.email.sujet.replace('{code}', code),
    texte: t.email.texte.replace('{code}', code),
    html: t.email.html.replaceAll('{code}', code)
  });
  if (!envoi.ok) return { ok: false, erreur: 'envoi' };
  // hors ligne, sans service d'e-mail : le code est renvoyé pour les essais
  return { ok: true, ...(envoi.simule ? { code } : {}) };
}

// 2) vérification : 5 essais par code, 15 échecs par jour et par adresse (les nouveaux codes ne remettent
// pas ce compte à zéro) ; crée le compte au premier passage
export async function verifierCode(emailBrut, codeBrut, langue) {
  if (!emailValide(emailBrut) || !/^\d{6}$/.test(String(codeBrut || '').trim())) return { ok: false, erreur: 'code' };
  const email = normaliser(emailBrut), code = String(codeBrut).trim();
  const cleEchecs = cle('echecs', email);
  if ((await lireCompteur(cleEchecs)) >= 15) return { ok: false, erreur: 'limite' };
  const ligne = await une('UPDATE codes SET essais = essais + 1 WHERE cle = $1 RETURNING empreinte, essais, expire_le > now() AS valide', [cle('code', email)]);
  if (!ligne || !ligne.valide || ligne.essais > 5) return { ok: false, erreur: 'expire' };
  const a = Buffer.from(ligne.empreinte, 'hex'), b = Buffer.from(empreinte(email, code), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await compter(cleEchecs, Infinity, 864e5);
    return { ok: false, erreur: 'code' };
  }
  await sql('DELETE FROM codes WHERE cle = $1', [cle('code', email)]);
  let u = await une('SELECT id, email, langue, credits FROM utilisateurs WHERE email = $1', [email]);
  if (!u) {
    const offerts = await crediterBienvenue(email) ? CREDITS.bienvenue : 0;
    const id = nouvelId('u_');
    u = await une('INSERT INTO utilisateurs (id, email, langue, credits) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id, email, langue, credits',
      [id, email, estLangue(langue) ? langue : 'fr', offerts]);
    if (u && offerts > 0) await sql('INSERT INTO mouvements (utilisateur_id, delta, motif, ref) VALUES ($1, $2, $3, $4) ON CONFLICT (ref) DO NOTHING', [u.id, offerts, 'bienvenue', 'bienvenue:' + u.id]);
    if (!u) u = await une('SELECT id, email, langue, credits FROM utilisateurs WHERE email = $1', [email]);
  }
  return { ok: true, utilisateur: u };
}

// crédits offerts : une seule fois par adresse canonique (même après suppression du compte),
// et un plafond global par jour contre les inscriptions en série
async function crediterBienvenue(email) {
  if (!(CREDITS.bienvenue > 0)) return false;
  if (!(await compter('bienvenues-du-jour', LIMITES.bienvenuesParJour, 864e5))) return false;
  const r = await une('INSERT INTO bienvenues (empreinte) VALUES ($1) ON CONFLICT (empreinte) DO NOTHING RETURNING empreinte', [empreinte('bienvenue', canonique(email))]);
  return !!r;
}

export async function ouvrirSession(uid) {
  const jeton = await new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setAudience(AUDIENCE).setIssuedAt().setExpirationTime(DUREE + 's').sign(secret());
  (await cookies()).set(COOKIE, jeton, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: DUREE });
}
export async function fermerSession() {
  (await cookies()).delete(COOKIE);
}

// utilisateur connecté (ou null) ; lu depuis le cookie de la requête en cours
export async function utilisateur() {
  const jeton = (await cookies()).get(COOKIE)?.value;
  if (!jeton) return null;
  try {
    const { payload } = await jwtVerify(jeton, secret(), { algorithms: ['HS256'], audience: AUDIENCE });
    if (typeof payload.uid !== 'string') return null;
    return await une('SELECT id, email, langue, credits FROM utilisateurs WHERE id = $1', [payload.uid]);
  } catch (_) { return null; }
}

// pages de l'application : l'utilisateur connecté, sinon retour à la connexion (session expirée,
// compte supprimé). La mise en page vérifie aussi, mais elle n'est pas rejouée à chaque navigation.
export async function connecteOuConnexion(lang) {
  const u = await utilisateur();
  if (!u) redirect(`/${lang}/connexion`);
  return u;
}
