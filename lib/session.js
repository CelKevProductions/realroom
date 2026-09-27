// Comptes : connexion par code reçu par e-mail, session dans un cookie signé (JWT HS256).
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual, randomInt } from 'node:crypto';
import { sql, une, nouvelId, compter } from './db.js';
import { CREDITS, estLangue } from './config.js';
import { envoyerEmail } from './email.js';
import { texte } from './i18n.js';

export const COOKIE = 'rr_session';
const DUREE = 60 * 60 * 24 * 30; // 30 jours

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (process.env.VERCEL) throw new Error('SESSION_SECRET manquant (32 caractères au moins).');
  return new TextEncoder().encode('developpement-seulement-ne-pas-utiliser-en-ligne-0123456789');
}

export const emailValide = e => typeof e === 'string' && e.length <= 200 && /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(e.trim());
const normaliser = e => e.trim().toLowerCase();
const empreinte = (email, code) => createHmac('sha256', secret()).update(email + ':' + code).digest('hex');

// 1) demande d'un code : 6 chiffres, valable 10 minutes, 5 envois par heure au plus
export async function demanderCode(emailBrut, langue, ip) {
  if (!emailValide(emailBrut)) return { ok: false, erreur: 'email' };
  const email = normaliser(emailBrut);
  if (!(await compter('code:ip:' + ip, 20, 3600e3))) return { ok: false, erreur: 'limite' };
  if (!(await compter('code:email:' + email, 5, 3600e3))) return { ok: false, erreur: 'limite' };
  const code = String(randomInt(0, 1e6)).padStart(6, '0');
  await sql(
    `INSERT INTO codes (email, empreinte, essais, expire_le) VALUES ($1, $2, 0, now() + interval '10 minutes')
     ON CONFLICT (email) DO UPDATE SET empreinte = $2, essais = 0, expire_le = now() + interval '10 minutes'`,
    [email, empreinte(email, code)]);
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

// 2) vérification : 5 essais par code ; crée le compte au premier passage (crédits offerts)
export async function verifierCode(emailBrut, codeBrut, langue) {
  if (!emailValide(emailBrut) || !/^\d{6}$/.test(String(codeBrut || '').trim())) return { ok: false, erreur: 'code' };
  const email = normaliser(emailBrut), code = String(codeBrut).trim();
  const ligne = await une('UPDATE codes SET essais = essais + 1 WHERE email = $1 RETURNING empreinte, essais, expire_le > now() AS valide', [email]);
  if (!ligne || !ligne.valide || ligne.essais > 5) return { ok: false, erreur: 'expire' };
  const a = Buffer.from(ligne.empreinte, 'hex'), b = Buffer.from(empreinte(email, code), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, erreur: 'code' };
  await sql('DELETE FROM codes WHERE email = $1', [email]);
  let u = await une('SELECT id, email, langue, credits FROM utilisateurs WHERE email = $1', [email]);
  if (!u) {
    const id = nouvelId('u_');
    u = await une('INSERT INTO utilisateurs (id, email, langue, credits) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id, email, langue, credits',
      [id, email, estLangue(langue) ? langue : 'fr', CREDITS.bienvenue]);
    if (u && CREDITS.bienvenue > 0) await sql('INSERT INTO mouvements (utilisateur_id, delta, motif, ref) VALUES ($1, $2, $3, $4) ON CONFLICT (ref) DO NOTHING', [u.id, CREDITS.bienvenue, 'bienvenue', 'bienvenue:' + u.id]);
    if (!u) u = await une('SELECT id, email, langue, credits FROM utilisateurs WHERE email = $1', [email]);
  }
  return { ok: true, utilisateur: u };
}

export async function ouvrirSession(uid) {
  const jeton = await new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(DUREE + 's').sign(secret());
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
    const { payload } = await jwtVerify(jeton, secret(), { algorithms: ['HS256'] });
    if (typeof payload.uid !== 'string') return null;
    return await une('SELECT id, email, langue, credits FROM utilisateurs WHERE id = $1', [payload.uid]);
  } catch (_) { return null; }
}
