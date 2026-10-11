import { ESPACES_PAR_FONCTION, normaliserEspaces, normaliserPlaces, intentionsEspaces } from './espaces.js';
import { programmeComposition } from './programme.js';

export function initialiserBrief(piece, demande) {
  const options = ESPACES_PAR_FONCTION[piece.fonction] || [];
  const programme = programmeComposition({ modele: piece.modele, fonction: piece.fonction, ...demande });
  const espaces = normaliserEspaces(demande.espaces) || programme?.zones.map(z => z.id) || [];
  const places = programme?.zones.find(z => z.id === 'repas')?.slots.filter(s => s.usage === 'chaise-repas').length;
  return { envies: demande.envies || '', budget: demande.budget || '', espaces: espaces.filter(id => options.includes(id)), placesRepas: normaliserPlaces(demande.placesRepas) || normaliserPlaces(places) || 4 };
}

export function demandeDepuisBrief(piece, demande, brief) {
  const options = ESPACES_PAR_FONCTION[piece.fonction] || [];
  return { ...demande, envies: String(brief.envies || '').slice(0, 1200),
    budget: Math.max(0, Math.min(1e6, +brief.budget || 0)),
    espaces: (normaliserEspaces(brief.espaces) || []).filter(id => options.includes(id)),
    placesRepas: normaliserPlaces(brief.placesRepas) || 4 };
}

// Les idées nouvellement écrites mettent à jour les cases visibles. Une simple
// modification de style ne réactive pas un espace décoché par le client.
export function actualiserEnvies(brief, envies, options) {
  const avant = intentionsEspaces(brief.envies), apres = intentionsEspaces(envies);
  const ajouts = apres.demandes.filter(id => options.includes(id) && !avant.demandes.includes(id));
  const refus = options.filter(id => apres.refus(id) && !avant.refus(id));
  return { ...brief, envies, espaces: [...new Set([...brief.espaces, ...ajouts])].filter(id => !refus.includes(id)),
    ...(apres.placesRepas && apres.placesRepas !== avant.placesRepas ? { placesRepas: apres.placesRepas } : {}) };
}
