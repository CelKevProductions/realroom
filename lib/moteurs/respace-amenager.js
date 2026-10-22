// « Aménager » par ReSpace pour les comptes : les routes de l'assistant et du réaménagement
// l'appellent après le moteur quand la demande porte le code de la démo privée. Version
// « ReSpace seul » : aucun repli sur le moteur. Code faux, serveur en veille ou aucune réponse
// lisible : l'erreur remonte et la pièce n'est pas modifiée. Sans code (Maison Corleone), le
// moteur reste seul, comme avant.
import { compter, lireCompteur } from '../db.js';
import { ErreurHTTP } from '../http.js';
import { ErreurAssistant } from '../assistant-amenagement.js';
import { configRespace, codeDemoValide, etatRespace, appelReseau, amenagerAvecRespace } from './respace.js';
import { bilanRespace } from './bilan-respace.js';

export async function passerParRespace({ piece, resultat, produits, code, cle, signal }) {
  if (typeof code !== 'string' || !code) return { resultat };
  const cfg = configRespace();
  if (!cfg.actif) throw new ErreurHTTP(404, 'respace-inactif');
  if ((await lireCompteur('respace-code:' + cle)) >= 10) throw new ErreurHTTP(429, 'limite');
  if (!codeDemoValide(cfg, code)) {
    await compter('respace-code:' + cle, Infinity, 36e5);
    throw new ErreurHTTP(403, 'respace-code');
  }
  if (!(await compter('respace:' + cle, 30, 36e5))) throw new ErreurHTTP(429, 'limite');
  const etat = await etatRespace(cfg);
  if (etat.etat !== 'pret') throw new ErreurHTTP(503, 'respace-' + etat.etat, etat.detail ? String(etat.detail) : undefined);
  try {
    const r = await amenagerAvecRespace(piece, resultat, produits, { appel: appelReseau(cfg), signal });
    return { resultat: r, respace: bilanRespace(r.proposition) };
  } catch (e) {
    if (signal?.aborted) throw e;
    if (e instanceof ErreurAssistant) throw new ErreurHTTP(e.statut, e.code, e.diagnostic);
    if (e.statut === 401 || e.statut === 403) throw new ErreurHTTP(503, 'respace-acces');
    console.error('ReSpace :', e);
    throw new ErreurHTTP(503, 'respace-indisponible', e.statut ? 'HTTP ' + e.statut : e.message);
  }
}
