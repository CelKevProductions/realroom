import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, majPiece, publique, demarrerAnalyse } from '@/lib/projets.js';
import { enDataUri } from '@/lib/stockage.js';
import { compter } from '@/lib/db.js';
import { LIMITES } from '@/lib/config.js';
import { analyserPiece } from '@/lib/claude.js';
import { depuisAnalyse } from '@/lib/piece.js';
import { resoudre } from '@/lib/agencement.js';
import { PRODUITS } from '@/lib/catalogue.js';

export const maxDuration = 300;

// POST { langue } : Claude lit les photos -> modèle 3D de la pièce et meubles actuels
export const POST = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const b = await lireJSON(request, 2000);
  const p = await piece(u.id, id);
  const photos = (p.photos || []).slice(0, 6);
  if (!photos.some(f => f.role === 'entree')) throw new ErreurHTTP(400, 'photo-entree');
  if (!(await compter('analyse:' + u.id, LIMITES.analysesParJour, 864e5))) throw new ErreurHTTP(429, 'limite');
  if (!(await compter('analyses-du-jour', LIMITES.analysesGlobalesParJour, 864e5))) throw new ErreurHTTP(429, 'limite');
  // une analyse à la fois par pièce (un double clic ne paie pas deux fois)
  if (!(await demarrerAnalyse(u.id, id))) throw new ErreurHTTP(409, 'en-cours');
  try {
    const images = [];
    for (const f of photos) { const d = await enDataUri(f); if (d) images.push({ role: f.role, dataUri: d }); }
    const { analyse } = await analyserPiece({ photos: images, dims: p.dims, fonction: p.fonction, notes: p.notes, langue: b.langue === 'en' ? 'en' : 'fr' });
    const { modele, meubles } = depuisAnalyse(analyse, p.dims || {});
    // les meubles relevés gardent leur place, on écarte seulement ceux qui se chevauchent
    const { items } = resoudre(modele, meubles, PRODUITS, { jeu: 0 });
    const n = await majPiece(u.id, id, { etat: 'prete', modele, agencement: items, proposition: null, erreur: null });
    return json({ piece: publique(n) });
  } catch (e) {
    console.error('analyse', id, e);
    await majPiece(u.id, id, { etat: 'erreur', erreur: e.code === 'cle' ? 'service' : 'analyse' });
    throw new ErreurHTTP(e.code === 'cle' ? 503 : 502, e.code === 'cle' ? 'service' : 'analyse');
  }
});
