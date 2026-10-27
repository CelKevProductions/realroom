import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, majAmenagement, publique } from '@/lib/projets.js';
import { compter } from '@/lib/db.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { executerAssistant, ErreurAssistant } from '@/lib/assistant-amenagement.js';
import { passerParRespace } from '@/lib/moteurs/respace-amenager.js';
import { partisArchitecte } from '@/lib/moteurs/architecte-amenager.js';
import { partisAttendus } from '@/lib/architecte.js';

export const maxDuration = 300;

export const POST = route(async (request, { params }) => {
  const u = await exiger(request), { id } = await params, b = await lireJSON(request, 20000);
  const p = await piece(u.id, id);
  if (p.etat === 'analyse') throw new ErreurHTTP(409, 'en-cours');
  if (!['generer', 'shuffle', 'choisir'].includes(b.action || 'generer')) throw new ErreurHTTP(400, 'assistant-demande');
  if (b.action !== 'choisir' && !(await compter('assistant:' + u.id, 40, 36e5))) throw new ErreurHTTP(429, 'limite');
  // Claude « architecte » : trois partis que le moteur suit (Aménager, puis Shuffle) ; sans eux, le moteur seul
  const demande = { ...b };
  delete demande.partis;
  const attendus = b.action !== 'choisir' && !b.respace ? partisAttendus(p, demande) : null;
  let architecte;
  if (attendus) {
    const r = await partisArchitecte({ piece: { ...p, agencement: attendus.agencement }, demande: attendus.brief, produits: PRODUITS, deja: attendus.deja, signal: request.signal });
    if (r.partis) demande.partis = r.partis; else architecte = { erreur: r.erreur };
  }
  let resultat;
  try { resultat = executerAssistant(p, demande, PRODUITS); }
  catch (e) {
    if (e instanceof ErreurAssistant) throw new ErreurHTTP(e.statut, e.code);
    if (e.code === 'REGLES_BLOQUANTES') throw new ErreurHTTP(422, 'regles-bloquantes', e.message);
    throw e;
  }
  // démo privée : le moteur a choisi les meubles, ReSpace les pose dans la pièce vidée
  let respace;
  if (b.action !== 'choisir') ({ resultat, respace } = await passerParRespace({ piece: p, resultat, produits: PRODUITS, code: b.respace, cle: u.id, signal: request.signal }));
  const n = await majAmenagement(u.id, id, resultat, p);
  const idee = b.action !== 'choisir' && resultat.assistant?.message !== 'aucune-autre-variante' && resultat.proposition.moteur?.architecte;
  if (!architecte && idee) architecte = { titre: idee.titre };
  else if (!architecte && demande.partis && b.action !== 'shuffle') architecte = { erreur: 'architecte-ne-tient-pas' };
  return json({ piece: publique(n), assistant: resultat.assistant, respace, architecte });
});
