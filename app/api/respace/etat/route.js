import { route, json, exiger } from '@/lib/http.js';
import { configRespace, etatRespace } from '@/lib/moteurs/respace.js';

// État du serveur ReSpace pour la démo privée : prêt, démarrage (sortie de veille), indisponible.
// ?sonde=1 dit seulement si la démo existe, sans contacter (ni réveiller) le serveur.
export const GET = route(async request => {
  await exiger(request);
  const cfg = configRespace();
  if (new URL(request.url).searchParams.get('sonde')) return json({ actif: cfg.actif });
  return json(cfg.actif ? await etatRespace(cfg) : { etat: 'inactif' }, cfg.actif ? 200 : 404);
});
