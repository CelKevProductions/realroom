import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece as lirePiece } from '@/lib/projets.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { normaliserParcours, agencementAvecContraintes } from '@/lib/parcours.js';
import { piecesDuParcours, lireParcours, ecrireParcours, ecrireAgencement } from '@/lib/parcours-serveur.js';
import { validerScene } from '@/lib/versions-scene.js';

// Parcours guidé du projet : état enregistré et pièces.
export const GET = route(async (request, { params }) => {
  const u = await exiger(request), { id } = await params;
  const pieces = await piecesDuParcours(u.id, id);
  return json({ ...(await lireParcours(u.id, id, pieces)), pieces });
});

// PUT { etat, revision } : enregistrement automatique
export const PUT = route(async (request, { params }) => {
  const u = await exiger(request), { id } = await params, b = await lireJSON(request, 200000);
  const pieces = await piecesDuParcours(u.id, id);
  const etat = normaliserParcours(b.etat, pieces);
  try { return json({ etat, revision: await ecrireParcours(u.id, id, etat, b.revision || null) }); }
  catch (e) { if (e.code === 'parcours-conflit') return json({ erreur: e.code, ...(await lireParcours(u.id, id, pieces)), pieces }, 409); throw e; }
});

// POST { action: 'valider' | 'contraintes', piece } : plan validé, meubles gardés
export const POST = route(async (request, { params }) => {
  const u = await exiger(request), { id } = await params, b = await lireJSON(request, 2000);
  const pieces = await piecesDuParcours(u.id, id);
  const p = pieces.find(x => x.id === b.piece);
  if (!p) throw new ErreurHTTP(404, 'introuvable');
  if (b.action === 'valider') {
    if (!p.modele) throw new ErreurHTTP(409, 'pas-de-modele');
    // un plan venu des photos n'a pas encore de version : sa validation crée la première
    if (!p.version_scene) await validerScene(u.id, await lirePiece(u.id, p.id), PRODUITS);
  } else if (b.action === 'contraintes') {
    const { etat } = await lireParcours(u.id, id, pieces);
    await ecrireAgencement(u.id, p, agencementAvecContraintes(etat, p));
  } else throw new ErreurHTTP(400, 'action');
  return json({ pieces: await piecesDuParcours(u.id, id) });
});
