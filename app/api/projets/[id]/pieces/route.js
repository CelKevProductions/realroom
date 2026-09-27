import { route, json, exiger, lireJSON } from '@/lib/http.js';
import { creerPiece } from '@/lib/projets.js';

export const POST = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const b = await lireJSON(request, 2000);
  return json({ piece: await creerPiece(u.id, id, b) }, 201);
});
