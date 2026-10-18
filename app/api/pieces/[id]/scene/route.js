import { route, json, exiger, ErreurHTTP } from '@/lib/http.js';
import { piece } from '@/lib/projets.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { sceneDepuisPiece } from '@/lib/scene.js';
import { listerScenes } from '@/lib/versions-scene.js';

// Scène commune de la pièce (format realroom-scene-v1) et historique de ses versions.
export const GET = route(async (request, { params }) => {
  const u = await exiger(request), { id } = await params;
  const p = await piece(u.id, id);
  if (!p.modele) throw new ErreurHTTP(409, 'pas-de-modele');
  return json({ scene: sceneDepuisPiece(p, PRODUITS, { version: p.version_scene || 0 }), versions: await listerScenes(u.id, id) });
});
