import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, majPiece, supprimerPiece, publique, rendusDe, renduPublic } from '@/lib/projets.js';
import { dimsValides } from '@/lib/piece.js';
import { FONCTIONS } from '@/lib/config.js';
import { verifier } from '@/lib/agencement.js';
import { corrigerPiece, mesuresConfirmees } from '@/lib/geometrie.js';
import { PRODUITS } from '@/lib/catalogue.js';

export const GET = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const p = await piece(u.id, id);
  const rendus = await rendusDe(u.id, id);
  return json({ piece: publique(p), rendus: rendus.map(renduPublic) });
});

// modifications de la pièce : nom, fonction, mesures, notes, modèle corrigé, agencement édité
export const PATCH = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const b = await lireJSON(request, 1e6);
  const p = await piece(u.id, id);
  const champs = {};
  if (typeof b.nom === 'string') champs.nom = b.nom.trim().slice(0, 80) || p.nom;
  if (FONCTIONS.includes(b.fonction)) champs.fonction = b.fonction;
  if (typeof b.notes === 'string') champs.notes = b.notes.slice(0, 1000);
  if (b.dims) champs.dims = dimsValides(b.dims);
  // Le plan corrigé remplace la géométrie ; le relevé reste visible, même s'il faut l'ajuster.
  if ((b.dims || b.geometrie) && p.modele) {
    const correction = b.geometrie && typeof b.geometrie === 'object' ? b.geometrie : { dims: b.dims };
    Object.assign(champs, corrigerPiece(p.modele, Array.isArray(b.agencement) ? nettoyer(b.agencement) : p.agencement || [], correction, PRODUITS));
    champs.dims = mesuresConfirmees(champs.modele);
    champs.proposition = p.proposition ? { ...p.proposition, confort: null } : null;
  }
  if (Array.isArray(b.agencement)) {
    if (!p.modele) throw new ErreurHTTP(409, 'pas-de-modele');
    if (!b.dims && !b.geometrie) champs.agencement = nettoyer(b.agencement);
  }
  if (b.vue && p.modele) champs.modele = { ...(champs.modele || p.modele), vue: { ...p.modele.vue, ...pick(b.vue, ['x', 'y', 'z', 'cx', 'cy', 'cz', 'fov']) } };
  const n = await majPiece(u.id, id, champs);
  return json({ piece: publique(n), alertes: n.modele ? verifier(n.modele, n.agencement || [], PRODUITS) : [] });
});

export const DELETE = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  await supprimerPiece(u.id, id);
  return json({ ok: true });
});

const pick = (o, cles) => Object.fromEntries(cles.filter(k => typeof o[k] === 'number' && isFinite(o[k])).map(k => [k, o[k]]));
// agencement venu du navigateur : champs connus seulement, produits du catalogue existants
function nettoyer(liste) {
  return liste.slice(0, 80).map(it => {
    if (!it || typeof it.id !== 'string') return null;
    const base = { id: it.id.slice(0, 40), origine: it.origine === 'existant' ? 'existant' : 'catalogue', ...pick(it, ['x', 'z', 'rot', 'y']) };
    if (typeof base.x !== 'number' || typeof base.z !== 'number') return null;
    if (['fond', 'gauche', 'droite', 'entree'].includes(it.mur)) base.mur = it.mur;
    if (it.garde === false) base.garde = false;
    if (typeof it.raison === 'string') base.raison = it.raison.slice(0, 240);
    if (base.origine === 'catalogue') {
      if (!PRODUITS[it.sku]) return null;
      base.sku = it.sku;
    } else {
      const q = it.p || {};
      if (!Array.isArray(q.dim) || q.dim.length !== 3 || !q.dim.every(v => typeof v === 'number' && v > 0 && v < 8)) return null;
      base.p = { nom: String(q.nom || '').slice(0, 80), fam: String(q.fam || 'autre').slice(0, 20), st: String(q.st || '').slice(0, 40), dim: q.dim, cols: (Array.isArray(q.cols) ? q.cols : []).filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 3), mat: String(q.mat || 'tissu').slice(0, 20), metal: 'noir', bois: String(q.bois || '').slice(0, 20) };
      if (q.dimsLues === true) base.p.dimsLues = true;
      if (typeof it.confiance === 'number') base.confiance = it.confiance;
    }
    return base;
  }).filter(Boolean);
}
