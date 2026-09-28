import { route, json, lireJSON, verifierOrigine, ip } from '@/lib/http.js';
import { verifierCode, ouvrirSession } from '@/lib/session.js';

// POST { email, code, langue } -> session ouverte (cookie)
export const POST = route(async request => {
  verifierOrigine(request);
  const b = await lireJSON(request, 2000);
  const r = await verifierCode(b.email, b.code, b.langue, ip(request));
  if (!r.ok) return json(r, r.erreur === 'limite' ? 429 : 400);
  await ouvrirSession(r.utilisateur.id);
  return json({ ok: true, credits: r.utilisateur.credits });
});
