import { origine } from '@/lib/http.js';
import { ouvrirSession } from '@/lib/session.js';
import { finirConnexion, compteMaison, suiteSure, raisonErreur } from '@/lib/maison.js';

// GET /api/mc/retour?code=…&state=… : retour de la page de connexion de la boutique
export async function GET(request) {
  const u = new URL(request.url);
  const base = origine(request);
  if (u.searchParams.get('error')) {
    console.error('retour Maison Corleone : refus de la boutique', u.searchParams.get('error'), String(u.searchParams.get('error_description') || '').slice(0, 200));
    return Response.redirect(base + '/fr/maison-corleone?mc=annule', 302);
  }
  try {
    const r = await finirConnexion({ origine: base, code: u.searchParams.get('code'), etat: u.searchParams.get('state') });
    const compte = await compteMaison({ sub: r.sub, email: r.email, prenom: r.prenom, langue: r.lang });
    await ouvrirSession(compte.id);
    const suite = suiteSure(r.suite, r.lang);
    return Response.redirect(base + suite + (suite.includes('?') ? '&' : '?') + 'bienvenue=1', 302);
  } catch (e) {
    const raison = raisonErreur(e);
    console.error('retour Maison Corleone', raison, e && e.message);
    return Response.redirect(base + '/fr/maison-corleone?mc=erreur&raison=' + encodeURIComponent(raison), 302);
  }
}
