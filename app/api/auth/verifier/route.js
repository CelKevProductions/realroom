import { route, json, lireJSON, verifierOrigine, ip } from '@/lib/http.js';
import { verifierCode, ouvrirSession } from '@/lib/session.js';
import { compter } from '@/lib/db.js';

// POST { email, code, langue } -> session ouverte (cookie)
export const POST = route(async request => {
  verifierOrigine(request);
  if (!(await compter('verif:ip:' + ip(request), 40, 3600e3))) return json({ ok: false, erreur: 'limite' }, 429);
  const b = await lireJSON(request, 2000);
  const r = await verifierCode(b.email, b.code, b.langue);
  if (!r.ok) return json(r, 400);
  await ouvrirSession(r.utilisateur.id);
  return json({ ok: true, credits: r.utilisateur.credits });
});
