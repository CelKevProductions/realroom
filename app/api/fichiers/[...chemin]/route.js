import { ErreurHTTP, route, exiger } from '@/lib/http.js';
import { lire } from '@/lib/stockage.js';
import { sql } from '@/lib/db.js';

// GET /api/fichiers/u/<uid>/… : seulement pour son propriétaire
export const GET = route(async (request, { params }) => {
  const u = await exiger(request);
  const { chemin } = await params;
  const c = (chemin || []).join('/');
  if (!c.startsWith('u/' + u.id + '/') || c.includes('..')) throw new ErreurHTTP(404, 'introuvable');
  // référence complète (URL du blob) retrouvée en base : photos, captures, rendus
  const url = '/api/fichiers/' + c;
  const lignes = await sql(`SELECT f AS ref FROM pieces, jsonb_array_elements(photos) f WHERE utilisateur_id = $1 AND f->>'url' = $2
    UNION ALL SELECT suivi->'capture' FROM rendus WHERE utilisateur_id = $1 AND suivi->'capture'->>'url' = $2
    UNION ALL SELECT resultat->'fichier' FROM rendus WHERE utilisateur_id = $1 AND resultat->'fichier'->>'url' = $2 LIMIT 1`, [u.id, url]);
  const ref = lignes[0] && lignes[0].ref;
  const f = ref && await lire(ref);
  if (!f) throw new ErreurHTTP(404, 'introuvable');
  return new Response(f.octets, { headers: { 'Content-Type': f.type, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
});
