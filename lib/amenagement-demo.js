// Même sélection et même solveur dans le worker et dans le repli sans Worker.
import { preparerAmenagement, appliquerProposition } from './amenagement.js';
import { choisirCandidats } from './selection.js';
import { simulerAmenagement } from './simulation.js';
import { versClaude } from './piece.js';

export function calculerDemo({ piece, choix, langue, produits }) {
  const prep = preparerAmenagement(piece.agencement || [], { ...choix, langue });
  const candidats = choisirCandidats(produits, {
    dims: piece.modele.dims, fonction: piece.fonction,
    envies: prep.envies, budget: prep.budget, parFamille: 30
  });
  const { proposition } = simulerAmenagement({
    piece: versClaude(piece.modele, prep.base, produits), mode: prep.mode,
    aRemplacer: prep.aRemplacer, candidats, envies: prep.envies,
    garder: prep.garder, langue, demo: true
  });
  return appliquerProposition({ modele: piece.modele, fonction: piece.fonction, prep, proposition, produits, candidats });
}
