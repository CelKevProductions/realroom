import { route, json, verifierOrigine, lireJSON, ErreurHTTP, ip } from '@/lib/http.js';
import { compter } from '@/lib/db.js';
import { empreinte } from '@/lib/session.js';
import { LIMITES } from '@/lib/config.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { validerDemoIA, ErreurDemoIA } from '@/lib/demo-ia.js';
import { nettoyerPartis } from '@/lib/architecte.js';
import { architecteActif, partisArchitecte } from '@/lib/moteurs/architecte-amenager.js';

export const maxDuration = 300;

// Démo sans compte : Claude propose trois partis pour la pièce, le moteur du navigateur les pose.
// Répond toujours 200 avec { partis } ou { erreur } : sans partis, le moteur aménage seul.
export const POST = route(async request => {
  verifierOrigine(request);
  const corps = await lireJSON(request, 1.3e6);
  let b;
  try { b = validerDemoIA({ ...corps, inspirations: [] }, PRODUITS); }
  catch (e) { if (e instanceof ErreurDemoIA) throw new ErreurHTTP(400, e.code); throw e; }
  if (!architecteActif()) return json({ erreur: 'architecte-inactif' });
  try {
    const quota = await compter('demo-architecte:' + empreinte('demo-architecte', ip(request)).slice(0, 40), LIMITES.demoArchitecteParJour, 864e5)
      && await compter('demo-architecte-du-jour', LIMITES.demoArchitecteGlobalParJour, 864e5);
    if (!quota) return json({ erreur: 'architecte-limite' });
  } catch (_) { return json({ erreur: 'architecte-indisponible' }); }
  const r = await partisArchitecte({ piece: b.piece, demande: { ...b.choix, langue: b.langue }, produits: PRODUITS,
    deja: nettoyerPartis(corps.deja), signal: request.signal });
  return json(r);
});
