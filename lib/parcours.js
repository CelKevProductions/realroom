// Parcours guidé d'un projet : dix étapes, sur une ou plusieurs pièces. L'état (étape courante,
// choix, réponses) est enregistré au fil de l'eau et repris à la visite suivante. L'avancement
// affiché vient des données réelles (plan relevé, plan validé, proposition calculée…), jamais
// du simple passage sur une étape.
import { estInstallation } from './usages.js';
import { ESPACES, ESPACES_PAR_FONCTION } from './espaces.js';
import { etatVariantes } from './variation-disposition.js';
import { TYPES_PROGRAMME } from './programme.js';

export const ETAPES = ['perimetre', 'usages', 'capture', 'validation', 'choix', 'selection', 'photos', 'preferences', 'proposition', 'approfondissement'];
export const CHOIX = ['tout', 'reagencer', 'certains'];
export const POSES = ['deplacable', 'fixe'];
const texte = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const entier = (v, min, max) => (Number.isFinite(+v) ? Math.max(min, Math.min(max, Math.round(+v))) : undefined);

export const etatVide = () => ({ v: 1, etape: 'perimetre', pieces: [], usages: {}, valides: {}, choix: {}, selection: {}, photosPassees: {}, preferences: {} });

// État venu du navigateur : seules les pièces du projet et les valeurs connues sont gardées.
export function normaliserParcours(e, pieces) {
  const ids = new Set(pieces.map(p => p.id)), r = etatVide();
  if (!e || typeof e !== 'object') return r;
  r.etape = ETAPES.includes(e.etape) ? e.etape : 'perimetre';
  r.pieces = [...new Set(Array.isArray(e.pieces) ? e.pieces : [])].filter(id => ids.has(id)).slice(0, 20);
  for (const id of r.pieces) {
    const p = pieces.find(x => x.id === id), u = e.usages?.[id];
    if (u && typeof u === 'object') r.usages[id] = { espaces: ESPACES.filter(x => (ESPACES_PAR_FONCTION[p.fonction] || []).includes(x) && u.espaces?.includes?.(x)),
      ...(entier(u.placesRepas, 2, 12) ? { placesRepas: entier(u.placesRepas, 2, 12) } : {}), envies: texte(u.envies, 600), confirme: u.confirme === true };
    if (Number.isInteger(e.valides?.[id])) r.valides[id] = e.valides[id];
    if (CHOIX.includes(e.choix?.[id])) r.choix[id] = e.choix[id];
    const s = e.selection?.[id], existants = new Set((p.agencement || []).filter(it => it.origine === 'existant').map(it => it.id));
    if (s && typeof s === 'object') r.selection[id] = Object.fromEntries(Object.entries(s).filter(([k, v]) => existants.has(k) && POSES.includes(v)).slice(0, 80));
    if (e.photosPassees?.[id] === true) r.photosPassees[id] = true;
  }
  const pr = e.preferences || {};
  r.preferences = { budget: entier(pr.budget, 0, 1e6) ?? 0, style: texte(pr.style, 120), envies: texte(pr.envies, 800), confirme: pr.confirme === true };
  return r;
}

// Meubles relevés que la pièce garde, selon le choix fait pour elle.
export function gardesDe(etat, p) {
  const existants = (p.agencement || []).filter(it => it.origine === 'existant' && it.garde !== false);
  const choix = etat.choix[p.id];
  if (choix === 'reagencer') return existants;
  if (choix === 'certains') return existants.filter(it => estInstallation(it) || etat.selection[p.id]?.[it.id]);
  return existants.filter(estInstallation);
}

// Contraintes à enregistrer sur l'agencement de la pièce (étape « Sélection sur le plan »).
export function agencementAvecContraintes(etat, p) {
  const gardes = new Set(gardesDe(etat, p).map(it => it.id)), choix = etat.choix[p.id];
  return (p.agencement || []).map(it => {
    if (it.origine !== 'existant') return it;
    if (estInstallation(it)) return { ...it, contraintes: { conserver: true, dimensionsFixes: true, positionFixe: true, rotationFixe: true } };
    if (!gardes.has(it.id)) return { ...it, contraintes: { ...it.contraintes, conserver: false } };
    const fixe = choix === 'certains' ? etat.selection[p.id]?.[it.id] === 'fixe' : false;
    return { ...it, contraintes: { conserver: true, dimensionsFixes: true, positionFixe: fixe, rotationFixe: fixe } };
  });
}

// Demande envoyée à l'assistant (route des variantes) pour la première proposition d'une pièce.
export function demandeProposition(etat, p, langue) {
  const u = etat.usages[p.id] || {}, pr = etat.preferences;
  const envies = [u.envies, pr.style && (langue === 'en' ? 'Style: ' : 'Style : ') + pr.style, pr.envies].filter(Boolean).join('\n').slice(0, 1200);
  const n = etat.pieces.length;
  return { action: 'generer', mode: 'tout', garder: gardesDe(etat, p).map(it => it.id), aRemplacer: [], espaces: u.espaces || [],
    ...(u.placesRepas ? { placesRepas: u.placesRepas } : {}), envies, ...(pr.budget ? { budget: Math.round(pr.budget / Math.max(1, n)) } : {}), langue };
}

// Avancement réel, étape par étape, pour les pièces choisies.
export function avancement(etat, pieces) {
  const ps = etat.pieces.map(id => pieces.find(p => p.id === id)).filter(Boolean);
  const toutes = f => ps.length > 0 && ps.every(f);
  const aExistants = p => (p.agencement || []).some(it => it.origine === 'existant' && it.garde !== false && !estInstallation(it));
  const gardesAvecPhoto = p => gardesDe(etat, p).filter(it => !estInstallation(it)).every(it => (p.photos || []).some(f => f.meuble === it.id));
  return {
    perimetre: ps.length > 0,
    usages: toutes(p => etat.usages[p.id]?.confirme),
    capture: toutes(p => !!p.modele),
    validation: toutes(p => p.modele && etat.valides[p.id] === (p.version_scene || 0)),
    choix: toutes(p => !aExistants(p) || CHOIX.includes(etat.choix[p.id])),
    selection: toutes(p => etat.choix[p.id] !== 'certains' || Object.keys(etat.selection[p.id] || {}).length > 0 || !aExistants(p)),
    photos: toutes(p => etat.photosPassees[p.id] || gardesAvecPhoto(p)),
    preferences: etat.preferences.confirme === true,
    proposition: toutes(p => TYPES_PROGRAMME.includes(p.fonction) && (c => c && !c.obsolete)(etatVariantes(p))),
    approfondissement: toutes(p => !!p.approfondie)
  };
}
