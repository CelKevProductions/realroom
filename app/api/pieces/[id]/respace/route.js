import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, majAmenagement, publique } from '@/lib/projets.js';
import { compter, lireCompteur } from '@/lib/db.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { archiverProposition } from '@/lib/versions-scene.js';
import { ErreurAssistant } from '@/lib/assistant-amenagement.js';
import { configRespace, codeDemoValide, etatRespace, appelReseau, varianteRespace } from '@/lib/moteurs/respace.js';

export const maxDuration = 300;

// Démo privée ReSpace (non commerciale) : ajoute une proposition ReSpace aux variantes de la
// pièce. POST { code }
export const POST = route(async (request, { params }) => {
  const cfg = configRespace();
  if (!cfg.actif) throw new ErreurHTTP(404, 'introuvable');
  const u = await exiger(request), { id } = await params, b = await lireJSON(request, 2000);
  if ((await lireCompteur('respace-code:' + u.id)) >= 10) throw new ErreurHTTP(429, 'limite');
  if (!codeDemoValide(cfg, b.code)) {
    await compter('respace-code:' + u.id, Infinity, 36e5);
    throw new ErreurHTTP(403, 'respace-code');
  }
  if (!(await compter('respace:' + u.id, 30, 36e5))) throw new ErreurHTTP(429, 'limite');
  const p = await piece(u.id, id);
  if (p.etat === 'analyse') throw new ErreurHTTP(409, 'en-cours');
  const etat = await etatRespace(cfg);
  if (etat.etat !== 'pret') throw new ErreurHTTP(503, 'respace-' + etat.etat);
  let resultat;
  try { resultat = await varianteRespace(p, PRODUITS, { appel: appelReseau(cfg), echantillons: cfg.echantillons, signal: request.signal }); }
  catch (e) {
    if (e instanceof ErreurAssistant) throw new ErreurHTTP(e.statut, e.code);
    if (e.statut === 401 || e.statut === 403) throw new ErreurHTTP(503, 'respace-acces');
    throw e;
  }
  const n = await majAmenagement(u.id, id, resultat, p);
  await archiverProposition(u.id, p, 'brouillon', resultat.agencement, PRODUITS, resultat.proposition.moteur);
  return json({ piece: publique(n), moteur: resultat.proposition.moteur });
});
