import { route, json, ip, lireJSON, verifierOrigine } from '@/lib/http.js';
import { demanderCode } from '@/lib/session.js';

// POST { email, langue } -> un code de connexion par e-mail
export const POST = route(async request => {
  verifierOrigine(request);
  const b = await lireJSON(request, 2000);
  const r = await demanderCode(b.email, b.langue, ip(request));
  return json(r, r.ok ? 200 : r.erreur === 'limite' ? 429 : r.erreur === 'envoi' ? 502 : 400);
});
