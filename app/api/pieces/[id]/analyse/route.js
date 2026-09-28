import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, majPiece, publique, demarrerAnalyse } from '@/lib/projets.js';
import { enDataUri } from '@/lib/stockage.js';
import { compter, lireCompteur } from '@/lib/db.js';
import { aPaye } from '@/lib/credits.js';
import { LIMITES } from '@/lib/config.js';
import { analyserPiece } from '@/lib/claude.js';
import { pieceDepuisAnalyse } from '@/lib/amenagement.js';
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
  // plafonds par jour : par compte (plus bas pour un compte d'essai) et, pour les comptes d'essai, global.
  // On vérifie d'abord, on compte seulement une analyse réellement lancée.
  const payant = await aPaye(u.id);
  if ((await lireCompteur('analyse:' + u.id)) >= (payant ? LIMITES.analysesParJour : LIMITES.analysesEssaiParJour)) throw new ErreurHTTP(429, 'limite');
  if (!payant && (await lireCompteur('analyses-du-jour')) >= LIMITES.analysesGlobalesParJour) {
    console.error('Analyses : plafond du jour atteint pour les comptes d’essai (ANALYSES_GLOBALES_PAR_JOUR)');
    throw new ErreurHTTP(429, 'limite');
  }
  // une analyse à la fois par pièce (un double clic ne paie pas deux fois)
  if (!(await demarrerAnalyse(u.id, id))) throw new ErreurHTTP(409, 'en-cours');
  await compter('analyse:' + u.id, Infinity, 864e5);
  if (!payant) await compter('analyses-du-jour', Infinity, 864e5);
  try {
    const images = [];
    for (const f of photos) { const d = await enDataUri(f); if (d) images.push({ role: f.role, dataUri: d }); }
    const { analyse } = await analyserPiece({ photos: images, dims: p.dims, fonction: p.fonction, notes: p.notes, langue: b.langue === 'en' ? 'en' : 'fr' });
    // les meubles relevés gardent leur place, on écarte seulement ceux qui se chevauchent
    const { modele, agencement } = pieceDepuisAnalyse(analyse, p.dims, PRODUITS);
    const n = await majPiece(u.id, id, { etat: 'prete', modele, agencement, proposition: null, erreur: null });
    return json({ piece: publique(n) });
  } catch (e) {
    console.error('analyse', id, e);
    await majPiece(u.id, id, { etat: 'erreur', erreur: e.code === 'cle' ? 'service' : 'analyse' });
    throw new ErreurHTTP(e.code === 'cle' ? 503 : 502, e.code === 'cle' ? 'service' : 'analyse');
  }
});
