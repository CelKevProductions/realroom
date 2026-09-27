// Aides des routes d'API : réponses JSON, garde de connexion, origine, erreurs.
import { utilisateur } from './session.js';

export class ErreurHTTP extends Error {
  constructor(statut, code, message) { super(message || code); this.statut = statut; this.code = code; }
}
export const json = (donnees, statut = 200) => Response.json(donnees, { status: statut, headers: { 'Cache-Control': 'no-store' } });

// les requêtes qui modifient viennent de notre site (cookie SameSite=Lax, et vérification de l'origine)
export function verifierOrigine(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origine = request.headers.get('origin');
  if (!origine) return; // navigateurs anciens, outils : le cookie SameSite suffit
  const hote = request.headers.get('x-forwarded-host') || request.headers.get('host');
  let o;
  try { o = new URL(origine).host; } catch (_) { throw new ErreurHTTP(403, 'origine'); }
  if (o !== hote) throw new ErreurHTTP(403, 'origine');
}

export async function exiger(request) {
  verifierOrigine(request);
  const u = await utilisateur();
  if (!u) throw new ErreurHTTP(401, 'connexion');
  return u;
}

export const ip = request => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';

// enveloppe d'une route : erreurs -> JSON propre
export function route(fn) {
  return async (request, ctx) => {
    try {
      return await fn(request, ctx);
    } catch (e) {
      if (e instanceof ErreurHTTP) return json({ erreur: e.code, message: e.message }, e.statut);
      if (e && (e.digest || '').startsWith?.('NEXT_')) throw e;
      console.error('API', request.method, new URL(request.url).pathname, e);
      return json({ erreur: 'serveur', message: e && e.code === 'cle' ? e.message : 'erreur interne' }, e && e.code === 'cle' ? 503 : 500);
    }
  };
}

export async function lireJSON(request, max = 2e6) {
  const t = await request.text();
  if (t.length > max) throw new ErreurHTTP(413, 'trop-gros');
  try { return t ? JSON.parse(t) : {}; } catch (_) { throw new ErreurHTTP(400, 'json'); }
}
