// « Affiner mon aménagement » : SceneWeaver (code BSD-3-Clause) sur un service GPU séparé.
// Vercel ne fait que piloter : soumettre, suivre, annuler, contrôler et appliquer le résultat.
//
// Contrat du service (à implémenter côté GPU, voir services/sceneweaver/README.md) :
//   GET    {url}/capacites          -> { formes: ['rectangle', 'polygone'?], version }
//   POST   {url}/taches             -> { externe }   (en-tête Idempotency-Key : id RealRoom)
//          corps { scene: realroom-scene-v1, consignes: { mode: 'leger', langue } }
//   GET    {url}/taches/{externe}   -> { etat: attente|en_cours|fini|erreur, progression?, scene?, erreur? }
//   DELETE {url}/taches/{externe}
// Le service travaille dans le repère de la scène commune (lib/scene.js) et rend les mêmes
// identifiants d'objets. Un objet rendu avec d'autres dimensions est refusé (jamais de
// correction de repère par les dimensions). Un objet nouveau n'est pas ajouté en mode léger.
//
// Formes : en mode léger, seule une forme que le service déclare est envoyée. Une pièce en L
// n'est jamais remplacée par son rectangle englobant : elle est refusée, avec ce motif.
import { sceneDepuisPiece, ecartsContraintes } from '../scene.js';
import { normaliserAngle } from '../agencement.js';
import { segmentsDe } from '../contour.js';
import { SIMULATION } from '../config.js';

export function configSceneWeaver(env = process.env) {
  const url = String(env.SCENEWEAVER_URL || '').trim().replace(/\/+$/, '');
  const simulation = !url && (SIMULATION || (env.SCENEWEAVER_SIMULATION === '1' && env.VERCEL_ENV !== 'production'));
  return { url, jeton: env.SCENEWEAVER_JETON || '', simulation, actif: !!url || simulation };
}

export function formeDe(modele) {
  if (!modele.contour) return 'rectangle';
  const pans = segmentsDe(modele);
  const droit = pans.length === 4 && pans.every((p, i) => { const q = pans[(i + 1) % 4]; return Math.abs(p.d[0] * q.d[0] + p.d[1] * q.d[1]) < .02; });
  return droit ? 'rectangle' : 'polygone';
}

async function requete(cfg, chemin, { method = 'GET', corps, cle } = {}) {
  const r = await fetch(cfg.url + chemin, { method, signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(cfg.jeton ? { Authorization: 'Bearer ' + cfg.jeton } : {}), ...(cle ? { 'Idempotency-Key': cle } : {}) },
    body: corps ? JSON.stringify(corps) : undefined });
  if (!r.ok) { const e = new Error('sceneweaver-http-' + r.status); e.statut = r.status; throw e; }
  return r.status === 204 ? {} : r.json();
}

export async function formesAcceptees(cfg) {
  if (cfg.simulation) return ['rectangle', 'polygone'];
  const c = await requete(cfg, '/capacites');
  return Array.isArray(c.formes) ? c.formes : ['rectangle'];
}

// Entrée envoyée au service pour une pièce et sa proposition courante.
export function entreeApprofondissement(piece, agencement, catalogue, langue) {
  return { scene: sceneDepuisPiece({ modele: piece.modele, agencement }, catalogue, { version: piece.version_scene || 0, piece: piece.id }),
    consignes: { mode: 'leger', langue: langue === 'en' ? 'en' : 'fr' } };
}

// Simulation (essais locaux, préversion sans GPU) : le « service » répond en quelques
// secondes avec la scène d'entrée inchangée. Elle vérifie tout le circuit (file, crédits,
// contrôles, versions) sans prétendre améliorer quoi que ce soit ; le résultat le dit.
const DUREE_SIMULATION = 6000;
function simuler(tache) {
  const ecoule = Date.now() - new Date(tache.cree_le).getTime();
  if (ecoule < DUREE_SIMULATION) return { etat: 'en_cours', progression: { etape: ecoule < DUREE_SIMULATION / 2 ? 1 : 2, total: 3 } };
  return { etat: 'fini', scene: structuredClone(tache.entree.scene), simulation: true };
}

export async function soumettre(cfg, tache) {
  if (cfg.simulation) return { externe: 'sim:' + tache.id };
  return requete(cfg, '/taches', { method: 'POST', corps: { scene: tache.entree.scene, consignes: tache.entree.consignes }, cle: tache.id });
}
export async function suivre(cfg, tache) {
  if (cfg.simulation || tache.externe?.startsWith('sim:')) return simuler(tache);
  return requete(cfg, '/taches/' + encodeURIComponent(tache.externe));
}
export async function annuler(cfg, tache) {
  if (cfg.simulation || !tache.externe || tache.externe.startsWith('sim:')) return;
  await requete(cfg, '/taches/' + encodeURIComponent(tache.externe), { method: 'DELETE' }).catch(() => {});
}

// Scène rendue par le service -> agencement : positions et orientations seulement, mêmes
// meubles et mêmes dimensions ; les contraintes de chaque meuble sont respectées.
export function agencementDepuisScene(agencement, scene, catalogue) {
  const objets = new Map((scene?.objets || []).map(o => [o.id, o]));
  const rapport = { appliques: 0, refuses: [], ignores: (scene?.objets || []).filter(o => !agencement.some(it => it.id === o.id)).length };
  const sortie = agencement.map(it => {
    const o = objets.get(it.id);
    if (!o || it.garde === false) return it;
    const p = it.sku ? catalogue[it.sku] : it.p;
    const dim = o.dim && [o.dim.largeur, o.dim.profondeur, o.dim.hauteur];
    if (!Array.isArray(o.position) || o.position.length !== 3 || !o.position.every(Number.isFinite) || !Number.isFinite(o.rot)) { rapport.refuses.push({ id: it.id, motif: 'format' }); return it; }
    if (dim && p?.dim && dim.some((v, i) => Math.abs(v - p.dim[i]) > .01)) { rapport.refuses.push({ id: it.id, motif: 'dimensions' }); return it; }
    const n = { ...it, x: o.position[0], z: o.position[2], rot: normaliserAngle(o.rot) };
    if (ecartsContraintes([it].filter(x => x.contraintes || x.origine === 'existant'), [n], catalogue).length) { rapport.refuses.push({ id: it.id, motif: 'contrainte' }); return it; }
    if (Math.hypot(n.x - it.x, n.z - it.z) > 1e-3 || Math.abs(n.rot - (it.rot || 0)) > 1e-3) rapport.appliques++;
    return n;
  });
  return { agencement: sortie, rapport };
}
