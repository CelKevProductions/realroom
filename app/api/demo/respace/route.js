import { route, json, verifierOrigine, lireJSON, ErreurHTTP, ip } from '@/lib/http.js';
import { compter, lireCompteur } from '@/lib/db.js';
import { empreinte } from '@/lib/session.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { TYPES_PROGRAMME } from '@/lib/programme.js';
import { ErreurAssistant } from '@/lib/assistant-amenagement.js';
import { configRespace, codeDemoValide, etatRespace, appelReseau, varianteRespace } from '@/lib/moteurs/respace.js';

export const maxDuration = 300;

const objet = x => x && typeof x === 'object' && !Array.isArray(x);
const nombre = (x, min, max) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

// Démo privée ReSpace sans compte : la pièce vit dans le navigateur (démo), le serveur ne garde
// rien. Tout passe par le code d'accès, y compris la vérification de l'état : un visiteur sans
// code ne peut pas réveiller le serveur GPU. POST { code, action: 'etat' } ou { code, piece }
export const POST = route(async request => {
  const cfg = configRespace();
  if (!cfg.actif) throw new ErreurHTTP(404, 'introuvable');
  verifierOrigine(request);
  const b = await lireJSON(request, 1.5e6), visiteur = empreinte('demo-respace', ip(request)).slice(0, 40);
  if ((await lireCompteur('respace-code:' + visiteur)) >= 10) throw new ErreurHTTP(429, 'limite');
  if (!codeDemoValide(cfg, b.code)) {
    await compter('respace-code:' + visiteur, Infinity, 36e5);
    throw new ErreurHTTP(403, 'respace-code');
  }
  if (b.action === 'etat') return json(await etatRespace(cfg));
  const p = b.piece, d = p?.modele?.dims;
  if (!objet(p) || !TYPES_PROGRAMME.includes(p.fonction) || !objet(p.modele) || !objet(d) || !nombre(d.largeur, 1.2, 30) || !nombre(d.profondeur, 1.2, 30) || !nombre(d.hauteur, 1.9, 8)
    || !Array.isArray(p.agencement) || p.agencement.length > 80 || !p.agencement.every(objet) || !objet(p.proposition)) throw new ErreurHTTP(400, 'demande-demo');
  if (!(await compter('respace:' + visiteur, 30, 36e5))) throw new ErreurHTTP(429, 'limite');
  const etat = await etatRespace(cfg);
  if (etat.etat !== 'pret') throw new ErreurHTTP(503, 'respace-' + etat.etat);
  const piece = { id: 'demo', fonction: p.fonction, modele: p.modele, agencement: p.agencement, proposition: p.proposition };
  let resultat;
  try { resultat = await varianteRespace(piece, PRODUITS, { appel: appelReseau(cfg), echantillons: cfg.echantillons, signal: request.signal }); }
  catch (e) {
    if (e instanceof ErreurAssistant) throw new ErreurHTTP(e.statut, e.code, e.diagnostic);
    if (e.statut === 401 || e.statut === 403) throw new ErreurHTTP(503, 'respace-acces');
    throw e;
  }
  return json({ agencement: resultat.agencement, proposition: resultat.proposition, moteur: resultat.proposition.moteur });
});
