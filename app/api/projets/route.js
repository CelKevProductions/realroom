import { route, json, exiger, lireJSON } from '@/lib/http.js';
import { listerProjets, creerProjet } from '@/lib/projets.js';

export const GET = route(async request => {
  const u = await exiger(request);
  const projets = await listerProjets(u.id);
  return json({ projets: projets.map(p => ({ id: p.id, nom: p.nom, nb: p.nb, maj_le: p.maj_le, apercu: p.apercu ? p.apercu.url : null })) });
});
export const POST = route(async request => {
  const u = await exiger(request);
  const b = await lireJSON(request, 2000);
  return json({ projet: await creerProjet(u.id, b.nom) }, 201);
});
