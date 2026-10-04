import { route, json, verifierOrigine } from '@/lib/http.js';
import { fermerSession } from '@/lib/session.js';

// POST : fin de la session RealRoom (le client reste connecté à la boutique)
export const POST = route(async request => {
  verifierOrigine(request);
  await fermerSession();
  return json({ ok: true });
});
