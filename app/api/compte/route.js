import { route, json, exiger } from '@/lib/http.js';
import { sql } from '@/lib/db.js';
import { supprimerTout } from '@/lib/stockage.js';
import { fermerSession } from '@/lib/session.js';
import { historique } from '@/lib/credits.js';

export const GET = route(async request => {
  const u = await exiger(request);
  return json({ email: u.email, credits: u.credits, historique: await historique(u.id) });
});

// suppression du compte : fichiers, projets, pièces, rendus, historique
export const DELETE = route(async request => {
  const u = await exiger(request);
  await supprimerTout(u.id);
  await sql('DELETE FROM utilisateurs WHERE id = $1', [u.id]);
  await fermerSession();
  return json({ ok: true });
});
