import { route, json } from '@/lib/http.js';
import { utilisateur } from '@/lib/session.js';
import { profilMaison } from '@/lib/maison.js';

// profil de l'édition Maison Corleone (prénom, rendus restants, pièces) ; null hors connexion,
// sans erreur 401 (la page ne doit pas renvoyer vers la connexion pour une simple lecture)
export const GET = route(async () => {
  const u = await utilisateur();
  return json({ profil: u ? await profilMaison(u) : null });
});
