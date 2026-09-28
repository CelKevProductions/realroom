import { route, exiger, ErreurHTTP, origine } from '@/lib/http.js';
import { paiementSimule } from '@/lib/paiement.js';
import { crediter } from '@/lib/credits.js';
import { nouvelId } from '@/lib/db.js';
import { PACKS } from '@/lib/config.js';

// achat simulé : développement et essais seulement (jamais en production)
export const GET = route(async request => {
  if (!paiementSimule()) throw new ErreurHTTP(404, 'introuvable');
  const u = await exiger(request);
  const q = new URL(request.url).searchParams;
  const pack = PACKS.find(p => p.id === q.get('pack'));
  if (!pack) throw new ErreurHTTP(400, 'pack');
  await crediter(u.id, pack.credits, 'achat', 'simulation:' + nouvelId());
  const langue = q.get('langue') === 'en' ? 'en' : 'fr';
  return Response.redirect(`${origine(request)}/${langue}/app/compte?paiement=ok`, 303);
});
