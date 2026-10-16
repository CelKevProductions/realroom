import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, majAmenagement, publique } from '@/lib/projets.js';
import { compter } from '@/lib/db.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { executerAssistant, ErreurAssistant } from '@/lib/assistant-amenagement.js';

export const maxDuration = 300;

export const POST = route(async (request, { params }) => {
  const u = await exiger(request), { id } = await params, b = await lireJSON(request, 20000);
  const p = await piece(u.id, id);
  if (p.etat === 'analyse') throw new ErreurHTTP(409, 'en-cours');
  if (!['generer', 'shuffle', 'choisir'].includes(b.action || 'generer')) throw new ErreurHTTP(400, 'assistant-demande');
  if (b.action !== 'choisir' && !(await compter('assistant:' + u.id, 40, 36e5))) throw new ErreurHTTP(429, 'limite');
  let resultat;
  try { resultat = executerAssistant(p, b, PRODUITS); }
  catch (e) {
    if (e instanceof ErreurAssistant) throw new ErreurHTTP(e.statut, e.code);
    if (e.code === 'REGLES_BLOQUANTES') throw new ErreurHTTP(422, 'regles-bloquantes', e.message);
    throw e;
  }
  const n = await majAmenagement(u.id, id, resultat, p);
  return json({ piece: publique(n), assistant: resultat.assistant });
});
