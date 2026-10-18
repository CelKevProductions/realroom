// Scène 3D commune : un seul format pour le relevé validé, les brouillons (moteur, ReSpace) et
// les versions approfondies. Elle se déduit de la pièce (modele + agencement), qui reste la
// source : aucune donnée existante n'est convertie ni effacée.
//
// Repère et unités (identiques à lib/agencement.js, à three.js et au format SSR de ReSpace) :
//   mètres ; origine au centre du sol ; +y vers le haut ; x de la gauche vers la droite vus
//   depuis l'entrée ; z du mur du fond vers l'entrée ; rotation en radians autour de +y, face
//   avant (sin rot, 0, cos rot), donc +z à rot = 0 ; dimensions [largeur, profondeur, hauteur].
// RoomPlan arrive dans ce repère par lib/scan.js (matrices rigides contrôlées, taille native
// [l, h, p] rangée en [l, p, h]). Un écart de repère se corrige par la conversion, jamais en
// changeant les dimensions d'un meuble.
import { contourDe, segmentsDe } from './contour.js';
import { produitDe, normaliserAngle } from './agencement.js';
import { estInstallation } from './usages.js';

export const VERSION_SCENE = 'realroom-scene-v1';
export const REPERE = { unite: 'm', origine: 'centre-du-sol', haut: '+y', droite: '+x', entree: '+z', avant: '+z', rotation: 'radians-autour-de-y' };

// Contraintes d'un meuble, distinctes et persistantes (champ contraintes de l'agencement) :
//   conserver        : le meuble reste dans la pièce (pas remplacé ni retiré par une proposition)
//   dimensionsFixes  : ses dimensions ne changent jamais (meuble réel, mesuré)
//   positionFixe     : « reste à cet endroit » (le moteur et ReSpace ne le déplacent pas)
//   rotationFixe     : son orientation ne change pas
// Valeurs par défaut, compatibles avec les projets existants : « conserver » vient du choix fait
// pour la pièce (tout remplacer, garder certains meubles) sauf si le meuble le porte lui-même ;
// un meuble relevé reste immobile s'il est gardé, comme avant, et ses dimensions se verrouillent
// quand on le choisit pour le garder (les cotes relevées restent corrigeables avant) ; une
// installation (radiateur, cheminée, cuisine) a toutes les contraintes ; un meuble du catalogue
// n'en a aucune.
export const CLES_CONTRAINTES = ['conserver', 'dimensionsFixes', 'positionFixe', 'rotationFixe'];
export function contraintesDe(it) {
  const existant = it.origine === 'existant', installation = estInstallation(it), c = it.contraintes || {};
  const v = (k, def) => (installation ? true : typeof c[k] === 'boolean' ? c[k] : def);
  const positionFixe = v('positionFixe', existant);
  // sans précision sur l'orientation, elle suit la position : immobile, il ne tourne pas non plus
  return { conserver: v('conserver', false), dimensionsFixes: v('dimensionsFixes', false), positionFixe, rotationFixe: v('rotationFixe', positionFixe) };
}
// champ contraintes venu du navigateur : booléens connus seulement
export function nettoyerContraintes(c) {
  if (!c || typeof c !== 'object') return undefined;
  const r = Object.fromEntries(CLES_CONTRAINTES.filter(k => typeof c[k] === 'boolean').map(k => [k, c[k]]));
  return Object.keys(r).length ? r : undefined;
}

// Édition : un meuble à dimensions fixes garde ses dimensions enregistrées.
export function verrouillerDimensions(avant, apres) {
  const anciens = new Map((avant || []).map(it => [it.id, it]));
  return apres.map(it => {
    const a = anciens.get(it.id);
    // déverrouiller (dimensionsFixes: false) dans la même modification reste possible
    if (!a?.p?.dim || !it.p?.dim || !contraintesDe(a).dimensionsFixes || it.contraintes?.dimensionsFixes === false) return it;
    return it.p.dim.every((v, i) => Math.abs(v - a.p.dim[i]) < 1e-6) ? it : { ...it, p: { ...it.p, dim: a.p.dim } };
  });
}

// Écarts d'une proposition aux contraintes des meubles de départ (vide si tout est respecté).
// gardes : meubles que la proposition devait garder. Sans contrainte explicite, un meuble gardé
// reste exactement à sa place (comportement d'avant les contraintes).
export function ecartsContraintes(gardes, resultat, catalogue) {
  const apres = new Map(resultat.filter(it => it.garde !== false).map(it => [it.id, it])), ecarts = [];
  for (const it of gardes) {
    const c = { ...contraintesDe(it), positionFixe: it.contraintes?.positionFixe ?? true, rotationFixe: it.contraintes?.rotationFixe ?? it.contraintes?.positionFixe ?? true }, q = apres.get(it.id);
    if (!q) { ecarts.push({ id: it.id, contrainte: 'conserver' }); continue; }
    const p = produitDe(it, catalogue), pq = produitDe(q, catalogue);
    if (q.sku !== it.sku || JSON.stringify(q.p) !== JSON.stringify(it.p) || (c.dimensionsFixes && JSON.stringify(pq?.dim) !== JSON.stringify(p?.dim))) ecarts.push({ id: it.id, contrainte: 'meuble' });
    if (c.positionFixe && (Math.hypot(q.x - it.x, q.z - it.z) > .005 || Math.abs((q.y || 0) - (it.y || 0)) > .005)) ecarts.push({ id: it.id, contrainte: 'positionFixe' });
    if (c.rotationFixe && Math.abs(Math.sin(((q.rot || 0) - (it.rot || 0)) / 2)) > .005) ecarts.push({ id: it.id, contrainte: 'rotationFixe' });
  }
  return ecarts;
}

const r3 = v => Math.round(v * 1000) / 1000;

// Scène commune d'une pièce. Les identifiants des murs, ouvertures et meubles sont stables :
// ceux de la pièce (pan, index d'ouverture sur le pan, id du meuble).
export function sceneDepuisPiece({ modele, agencement = [] }, catalogue, meta = {}) {
  const H = modele.dims.hauteur || 2.5;
  const murs = segmentsDe(modele).map(pan => ({ id: pan.id, a: pan.a.map(r3), b: pan.b.map(r3), longueur: r3(pan.long),
    ouvertures: (modele.murs?.[pan.id]?.ouvertures || []).map((o, i) => ({ id: `${pan.id}:${i}`, type: o.type, position: o.position,
      largeur: o.largeur, hauteur: o.hauteur, allege: o.allege || 0 })) }));
  const objets = agencement.filter(it => it.garde !== false).map(it => {
    const p = produitDe(it, catalogue);
    if (!p?.dim) return null;
    const [l, pr, h] = p.dim;
    return { id: it.id, origine: it.origine, ...(it.sku ? { sku: it.sku } : {}), famille: p.fam, nom: p.nom || '',
      dim: { largeur: l, profondeur: pr, hauteur: h }, position: [r3(it.x), r3(it.y ?? 0), r3(it.z)], rot: r3(normaliserAngle(it.rot || 0)),
      contraintes: contraintesDe(it), ...(p.glb ? { glb: p.glb } : {}) };
  }).filter(Boolean);
  return { format: VERSION_SCENE, repere: REPERE, ...meta, hauteur: H, contour: contourDe(modele).map(([x, z]) => [r3(x), r3(z)]), murs, objets };
}
