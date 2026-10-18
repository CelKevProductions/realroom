import { route, json, exiger, lireJSON } from '@/lib/http.js';
import { compter } from '@/lib/db.js';
import { ErreurHTTP } from '@/lib/http.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { tachesDe } from '@/lib/taches.js';
import { lancer, avancer, tachePublique } from '@/lib/approfondissement.js';

// POST { langue } : « Affiner mon aménagement » (tâche payée ; une demande identique n'est
// ni relancée ni payée deux fois)
export const POST = route(async (request, { params }) => {
  const u = await exiger(request), { id } = await params, b = await lireJSON(request, 2000);
  if (!(await compter('approfondir:' + u.id, 20, 36e5))) throw new ErreurHTTP(429, 'limite');
  const t = await lancer(u.id, id, PRODUITS, b.langue);
  return json({ tache: tachePublique(t) });
});

// GET : tâches de la pièce, les actives avancées (reprise après rechargement)
export const GET = route(async (request, { params }) => {
  const u = await exiger(request), { id } = await params;
  const taches = [];
  for (const t of await tachesDe(u.id, id)) taches.push(tachePublique(await avancer(u.id, t, PRODUITS)));
  return json({ taches });
});
