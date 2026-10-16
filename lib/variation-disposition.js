import { normaliserAngle } from './agencement.js';

const USAGES = new Set(['lit', 'canape', 'table-repas', 'bureau', 'fauteuil-lecture', 'salon-exterieur', 'console', 'vasque', 'baignoire-ilot', 'baignoire-murale']);
const arrondi = n => Math.round(n * 1000) / 1000;

// Mesurer les changements d'organisation, plutôt que de SKU ou d'accessoires.
export function ancresDisposition(items) {
  return items.filter(it => it.garde !== false && !it.fixe && USAGES.has(it.usageProgramme))
    .map(it => ({ zone: it.zoneId, usage: it.usageProgramme, x: it.x, z: it.z, rot: it.rot || 0 }));
}

export function dispositionsDistinctes(a, b) {
  return a.some(it => {
    const autres = b.filter(q => q.zone === it.zone && q.usage === it.usage);
    return autres.length > 0 && autres.every(q => {
      const angle = Math.abs(normaliserAngle(it.rot - q.rot));
      const rotation = it.usage === 'table-repas' ? Math.min(angle, Math.abs(Math.PI - angle)) : angle;
      return Math.hypot(it.x - q.x, it.z - q.z) >= .65 || rotation >= Math.PI / 4;
    });
  });
}

export function scoreVariation(zone, items, variation) {
  if (!Number.isInteger(variation?.graine) || variation.graine < 1 || items.some(it => it.fixe)) return 0;
  const ancre = ancresDisposition(items)[0];
  if (!ancre) return 0;
  const phase = [...zone.id].reduce((s, c) => s + c.charCodeAt(0), 0) % 4;
  const angle = (variation.graine - 1 + phase) % 4 * Math.PI / 2;
  const orientation = Math.cos(normaliserAngle(ancre.rot - angle)) * 18;
  const precedentes = (variation.eviter || []).flatMap(as => as.filter(a => a.zone === ancre.zone && a.usage === ancre.usage));
  const distance = precedentes.length ? Math.min(...precedentes.map(a => Math.min(1,
    Math.hypot(ancre.x - a.x, ancre.z - a.z) / 1.5 + Math.abs(normaliserAngle(ancre.rot - a.rot)) / Math.PI))) : 0;
  return orientation + distance * 14;
}

const ordonner = valeur => Array.isArray(valeur) ? valeur.map(ordonner)
  : valeur && typeof valeur === 'object' ? Object.fromEntries(Object.keys(valeur).sort().map(k => [k, ordonner(valeur[k])])) : valeur;

export function signaturePiece(piece) {
  const { vue, ...modele } = piece.modele || {};
  return JSON.stringify(ordonner({ fonction: piece.fonction, modele }));
}

export function signatureAgencement(items) {
  return JSON.stringify(items.map(it => ({ id: it.id, origine: it.origine, sku: it.sku || null, p: it.sku ? null : it.p,
    x: arrondi(it.x), z: arrondi(it.z), rot: arrondi(normaliserAngle(it.rot || 0)), y: arrondi(it.y || 0),
    garde: it.garde !== false, mur: it.mur || null, kind: it.kind || null, attach_to: it.attach_to || null
  })).sort((a, b) => a.id.localeCompare(b.id)).map(ordonner));
}

export function signatureBrief(brief) {
  return JSON.stringify({ mode: brief.mode === 'partiel' ? 'partiel' : 'tout', envies: brief.envies || '', budget: +brief.budget || 0,
    garder: [...(brief.garder || [])].sort(), aRemplacer: [...(brief.aRemplacer || [])].sort(),
    espaces: brief.espaces ? [...brief.espaces].sort() : null, placesRepas: +brief.placesRepas || null });
}

export function etatVariantes(piece, items = piece.agencement || []) {
  const etat = piece.proposition?.variantes;
  if (etat?.version !== 1 || !Array.isArray(etat.liste) || !etat.liste.length) return null;
  const courante = etat.liste.find(v => v.id === etat.selection);
  return { etat, courante, obsolete: !courante || signaturePiece(piece) !== etat.signaturePiece
    || signatureAgencement(items) !== signatureAgencement(courante.agencement) };
}
