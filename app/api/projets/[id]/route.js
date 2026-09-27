import { route, json, exiger, lireJSON } from '@/lib/http.js';
import { projet, renommerProjet, supprimerProjet } from '@/lib/projets.js';

export const GET = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const p = await projet(u.id, id);
  p.pieces = p.pieces.map(x => ({ ...x, photos: (x.photos || []).map(f => ({ url: f.url, role: f.role })) }));
  return json({ projet: p });
});
export const PATCH = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const b = await lireJSON(request, 2000);
  return json({ projet: await renommerProjet(u.id, id, b.nom) });
});
export const DELETE = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  await supprimerProjet(u.id, id);
  return json({ ok: true });
});
