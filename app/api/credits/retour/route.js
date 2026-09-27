import { route, json, exiger } from '@/lib/http.js';
import { verifierRetour } from '@/lib/paiement.js';
import { une } from '@/lib/db.js';

// GET ?session=cs_… : au retour de Stripe, crédite tout de suite (le webhook fera de même, sans doublon)
export const GET = route(async request => {
  const u = await exiger(request);
  const session = new URL(request.url).searchParams.get('session');
  await verifierRetour(session, u.id);
  const s = await une('SELECT credits FROM utilisateurs WHERE id = $1', [u.id]);
  return json({ credits: s.credits });
});
