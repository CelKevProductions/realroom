import { origine } from '@/lib/http.js';
import { ouvrirSession } from '@/lib/session.js';
import { MAISON, maisonConfiguree, maisonSimulee, urlConnexion, suiteSure, compteMaison, raisonErreur, marquer } from '@/lib/maison.js';

// GET /api/mc/connexion?suite=/fr/maison-corleone&lang=fr : vers la page de connexion des comptes
// clients Maison Corleone. Sans client configuré : connexion simulée en essais locaux, sinon retour
// à l'édition avec un message (?mc=inactif).
export async function GET(request) {
  const u = new URL(request.url);
  const lang = u.searchParams.get('lang') === 'en' ? 'en' : 'fr';
  const suite = suiteSure(u.searchParams.get('suite'), lang);
  const base = origine(request);
  const vers = (chemin, extra = '') => Response.redirect(base + chemin + (extra ? (chemin.includes('?') ? '&' : '?') + extra : ''), 302);
  try {
    if (maisonConfiguree()) return Response.redirect(await urlConnexion({ origine: base, suite, lang }), 302);
    if (maisonSimulee()) {
      const compte = await compteMaison({ sub: 'gid://shopify/Customer/essai', email: 'client@exemple.fr', prenom: 'Camille', langue: lang });
      await ouvrirSession(compte.id);
      return vers(suite, 'bienvenue=1');
    }
    return vers(suite, 'mc=inactif');
  } catch (e) {
    // référence étape-précision (depart-secret, decouverte-403…), affichée sous le message d'erreur
    const raison = raisonErreur(marquer(e, 'depart'));
    console.error('connexion Maison Corleone', MAISON.boutique, raison, e && e.message);
    return vers(suite, 'mc=erreur&raison=' + encodeURIComponent(raison));
  }
}
