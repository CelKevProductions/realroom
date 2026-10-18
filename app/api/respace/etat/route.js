import { route, json, exiger } from '@/lib/http.js';
import { configRespace, etatRespace } from '@/lib/moteurs/respace.js';

// État du serveur ReSpace pour la démo privée : prêt, démarrage (sortie de veille), indisponible.
export const GET = route(async request => {
  await exiger(request);
  const cfg = configRespace();
  return json(cfg.actif ? await etatRespace(cfg) : { etat: 'inactif' }, cfg.actif ? 200 : 404);
});
