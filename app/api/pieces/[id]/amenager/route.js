import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, majPiece, publique } from '@/lib/projets.js';
import { compter, lireCompteur } from '@/lib/db.js';
import { aPaye } from '@/lib/credits.js';
import { LIMITES } from '@/lib/config.js';
import { proposerAmenagement } from '@/lib/claude.js';
import { versClaude } from '@/lib/piece.js';
import { preparerAmenagement, appliquerProposition } from '@/lib/amenagement.js';
import { PRODUITS, candidats } from '@/lib/catalogue.js';
import { enDataUri } from '@/lib/stockage.js';

export const maxDuration = 300;

// POST { mode: 'tout' | 'partiel', envies, budget, garder: [ids], aRemplacer: [ids], langue }
export const POST = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const b = await lireJSON(request, 20000);
  const p = await piece(u.id, id);
  if (!p.modele) throw new ErreurHTTP(409, 'pas-de-modele');
  const payant = await aPaye(u.id);
  if ((await lireCompteur('amenager:' + u.id)) >= (payant ? LIMITES.amenagementsParJour : LIMITES.amenagementsEssaiParJour)) throw new ErreurHTTP(429, 'limite');
  if (!payant && (await lireCompteur('amenagements-du-jour')) >= LIMITES.amenagementsGlobauxParJour) {
    console.error('Aménagements : plafond du jour atteint pour les comptes d’essai (AMENAGEMENTS_GLOBAUX_PAR_JOUR)');
    throw new ErreurHTTP(429, 'limite');
  }
  await compter('amenager:' + u.id, Infinity, 864e5);
  if (!payant) await compter('amenagements-du-jour', Infinity, 864e5);
  const prep = preparerAmenagement(p.agencement || [], b);
  const cands = candidats({ dims: p.modele.dims, fonction: p.fonction, envies: prep.envies, budget: prep.budget });
  const inspirations = [];
  for (const photo of (p.photos || []).filter(ph => ph.role === 'inspiration').slice(0, LIMITES.inspirationsParPiece)) {
    const dataUri = await enDataUri(photo);
    if (dataUri) inspirations.push({ dataUri });
  }
  const { proposition } = await proposerAmenagement({
    piece: { ...versClaude(p.modele, prep.base, PRODUITS), notes_client: p.notes || '' }, fonction: p.fonction, mode: prep.mode, envies: prep.envies, budget: prep.budget,
    garder: prep.garder, aRemplacer: prep.aRemplacer, candidats: cands, inspirations, langue: b.langue === 'en' ? 'en' : 'fr'
  });
  const { agencement, proposition: prop } = appliquerProposition({ modele: p.modele, prep, proposition, produits: PRODUITS });
  const n = await majPiece(u.id, id, { agencement, proposition: prop });
  return json({ piece: publique(n) });
});
