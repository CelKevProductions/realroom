// « Aménager » par ReSpace pour les comptes : les routes de l'assistant et du réaménagement
// l'appellent après le moteur quand la demande porte le code de la démo privée. Ne lève pas
// d'erreur : sans ReSpace (code faux, serveur en veille, aucune pose valable), la proposition du
// moteur reste et la réponse dit pourquoi dans respace.erreur.
import { compter, lireCompteur } from '../db.js';
import { ErreurAssistant } from '../assistant-amenagement.js';
import { configRespace, codeDemoValide, etatRespace, appelReseau, amenagerAvecRespace } from './respace.js';
import { bilanRespace } from './bilan-respace.js';

export async function passerParRespace({ piece, resultat, produits, code, cle, signal }) {
  const cfg = configRespace();
  if (typeof code !== 'string' || !code || !cfg.actif) return { resultat };
  if ((await lireCompteur('respace-code:' + cle)) >= 10) return { resultat, respace: { erreur: 'limite' } };
  if (!codeDemoValide(cfg, code)) {
    await compter('respace-code:' + cle, Infinity, 36e5);
    return { resultat, respace: { erreur: 'respace-code' } };
  }
  if (!(await compter('respace:' + cle, 30, 36e5))) return { resultat, respace: { erreur: 'limite' } };
  const etat = await etatRespace(cfg);
  if (etat.etat !== 'pret') return { resultat, respace: { erreur: 'respace-' + etat.etat } };
  try {
    const r = await amenagerAvecRespace(piece, resultat, produits, { appel: appelReseau(cfg), echantillons: cfg.echantillons, signal });
    return { resultat: r, respace: bilanRespace(r.proposition) };
  } catch (e) {
    if (signal?.aborted) throw e;
    if (e instanceof ErreurAssistant) return { resultat, respace: { erreur: e.code, message: e.diagnostic } };
    if (e.statut === 401 || e.statut === 403) return { resultat, respace: { erreur: 'respace-acces' } };
    console.error('ReSpace :', e);
    return { resultat, respace: { erreur: 'respace-indisponible' } };
  }
}
