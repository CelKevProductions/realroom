import { route, json, exiger, ErreurHTTP } from '@/lib/http.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { lireTache } from '@/lib/taches.js';
import { avancer, abandonner, tachePublique } from '@/lib/approfondissement.js';

export const maxDuration = 60;

async function tache(request, params) {
  const u = await exiger(request), { id } = await params;
  const t = await lireTache(u.id, id);
  if (!t) throw new ErreurHTTP(404, 'introuvable');
  return { u, t };
}

// suivi d'une tâche (elle avance à chaque lecture)
export const GET = route(async (request, { params }) => {
  const { u, t } = await tache(request, params);
  return json({ tache: tachePublique(await avancer(u.id, t, PRODUITS)) });
});

// annulation : arrêt sur le service et remboursement, une seule fois
export const DELETE = route(async (request, { params }) => {
  const { u, t } = await tache(request, params);
  return json({ tache: tachePublique(await abandonner(u.id, t)) });
});
