// Hypothèses éditoriales de départ, pas des normes ni une note de beauté.
// Les dimensions métriques restent inchangées, même si un contrôle demande une vérification.
import { aireSignee, contourDe, contientPoint, segmentsDe, pointOuverture, distanceSegment } from './contour.js';
import { produitDe, boite, estMural, estSuspendu } from './agencement.js';

export const POIDS_DENSITE = Object.freeze({ meubleManquant: -5, zoneUnique: -20, openSpace: -30, circulation: -15, zoneDemesuree: -10, murMort: -2, sansAttrait: -10 });
export const REFERENCES_ZONES = Object.freeze({ salon: 16, repas: 16, lecture: 8, travail: 10, couchage: 16, rangement: 8, accueil: 8, bain: 12, vasque: 8, assise: 8, detente: 12 });
export const ZONES_VIE = ['salon', 'repas', 'lecture', 'travail', 'couchage', 'accueil', 'detente', 'assise'];
export function repartitionZones(modele, zones) {
  const vie = zones.filter(z => ZONES_VIE.includes(z.type));
  const distanceMax = Math.min(2.5, Math.sqrt(Math.abs(aireSignee(contourDe(modele)))) / 3);
  let total = 0, eloignes = 0;
  for (let ix = 0; ix < 8; ix++) for (let iz = 0; iz < 8; iz++) {
    const x = modele.dims.largeur * ((ix + .5) / 8 - .5), z = modele.dims.profondeur * ((iz + .5) / 8 - .5);
    if (!contientPoint(modele, x, z)) continue;
    total++;
    const d = Math.min(...vie.map(b => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1))));
    if (d > distanceMax) eloignes++;
  }
  const proportionEloignee = total ? eloignes / total : 0;
  return { distanceMax: Math.round(distanceMax * 100) / 100, proportionEloignee: Math.round(proportionEloignee * 100) / 100, score: vie.length > 1 ? -Math.round(Math.max(0, proportionEloignee - .15) * 100) : 0 };
}
export function compositionSurfaceActive(choix) {
  if (choix === false) return false;
  if (typeof process !== 'undefined' && (process.env.REALROOM_COMPOSITION_SURFACE === '0' || process.env.NEXT_PUBLIC_REALROOM_COMPOSITION_SURFACE === '0')) return false;
  if (typeof window !== 'undefined') { try { if (localStorage.getItem('rr-composition-surface') === '0') return false; } catch (_) {} }
  return true;
}
export function coherenceEchelle(modele) {
  const surface = Math.abs(aireSignee(contourDe(modele))), portes = segmentsDe(modele).flatMap(p => (modele.murs?.[p.id]?.ouvertures || []).filter(o => o.type === 'porte'));
  const indices = [];
  for (const o of portes) if (o.largeur < .6 || o.largeur > 1.4) indices.push({ type: 'largeur-porte-inhabituelle', valeur: o.largeur });
  if (modele.dims.hauteur < 2.1 || modele.dims.hauteur > 4.5) indices.push({ type: 'hauteur-inhabituelle', valeur: modele.dims.hauteur });
  const mesure = ['largeur', 'profondeur'].every(axe => modele.dims.sources?.[axe] === 'mesure') || modele.dims.estimees === false;
  return { surface: Math.round(surface * 100) / 100, unite: 'm', metrique: mesure || modele.capture?.metrique === true,
    controleTerrain: mesure, aVerifier: !mesure || indices.length > 0, indices, redimensionnement: false };
}
export function politiqueSurface(fonction, surface, zones, choixExplicites) {
  const openSpace = fonction === 'salon' && surface > 40;
  const cibleZones = fonction === 'salon' ? surface > 75 ? 4 : openSpace ? 3 : surface > 20 ? 2 : 1 : null;
  return { version: 'composition-surface-1', palier: fonction === 'salon' ? surface < 14 ? 'compact' : surface <= 20 ? 'standard' : surface <= 40 ? 'sejour' : surface <= 75 ? 'open-space' : 'grand-open-space' : 'selon-usage',
    openSpace, cibleZones, zonesChoisies: zones.filter(z => ZONES_VIE.includes(z.type)).length, choixExplicites,
    largeurCirculation: openSpace ? 1.1 : .9, maxM2ParElement: fonction === 'salon' && surface > 20 ? 5 : null,
    referencesZones: { ...REFERENCES_ZONES, ...(openSpace ? { salon: 20 } : {}) } };
}
const ancre = (type, es) => es.some(e => ({ salon: ['canape', 'salon-exterieur'], repas: ['table-repas'], lecture: ['fauteuil-lecture'], travail: ['bureau'], couchage: ['lit'], accueil: ['console', 'miroir'], detente: ['transat'], assise: ['banc'] }[type] || []).includes(e.it.usageProgramme));
export function evaluerDensite(modele, items, catalogue, programme, plan, { phase = 'final' } = {}) {
  if (!programme?.compositionSurface) return null;
  const politique = programme.compositionSurface, es = items.filter(it => it.garde !== false).map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p?.dim), regles = [];
  const ajouter = (id, points, cible, actuel, zone) => regles.push({ id, points, ...(cible != null ? { cible, actuel } : {}), ...(zone ? { zone } : {}) });
  // Comptage des meubles et éclairages utiles : tableaux et tapis ne masquent jamais un séjour vide.
  const elements = es.filter(e => !['tableau', 'miroir', 'etagere-murale', 'tapis', 'plante', 'tv', 'tv-murale'].includes(e.p.fam));
  const cibleElements = politique.maxM2ParElement ? Math.ceil(programme.surface / politique.maxM2ParElement) : 0;
  if (cibleElements > elements.length) ajouter('mobilier-insuffisant', (cibleElements - elements.length) * POIDS_DENSITE.meubleManquant, cibleElements, elements.length);
  const zones = (plan?.zones || []).filter(z => ZONES_VIE.includes(z.type) && ancre(z.type, es.filter(e => e.it.zoneId === z.id)));
  const repartition = repartitionZones(modele, zones);
  if (politique.maxM2ParElement && repartition.score < 0) ajouter('espaces-concentres', repartition.score, .15, repartition.proportionEloignee);
  if (programme.fonction === 'salon' && !zones.some(z => z.type === 'salon')) ajouter('zone-principale-absente', POIDS_DENSITE.zoneUnique, 1, 0);
  if (programme.fonction === 'salon' && programme.surface > 20 && zones.length < 2) ajouter('zone-unique', POIDS_DENSITE.zoneUnique, 2, zones.length);
  if (politique.openSpace && zones.length < 3) ajouter('open-space-incomplet', POIDS_DENSITE.openSpace, 3, zones.length);
  if (politique.openSpace && plan?.circulation && (!plan.circulation.valide || plan.circulation.largeur < 1)) ajouter('circulation-open-space', POIDS_DENSITE.circulation, 1, plan.circulation.largeur);
  for (const z of plan?.zones || []) {
    const surface = (z.x1 - z.x0) * (z.z1 - z.z0), maximum = politique.referencesZones[z.type] || 16;
    if (surface > maximum * 1.5) ajouter('zone-demesuree', POIDS_DENSITE.zoneDemesuree, maximum * 1.5, Math.round(surface * 100) / 100, z.id);
    if (!ZONES_VIE.includes(z.type)) continue;
    const groupe = es.filter(e => e.it.zoneId === z.id), centre = { x: (z.x0 + z.x1) / 2, z: (z.z0 + z.z1) / 2 };
    const attrait = groupe.some(e => ['tv', 'tv-murale', 'tableau', 'lampe', 'lampadaire', 'applique', 'suspension', 'lustre'].includes(e.p.fam) || ['lit', 'table-repas', 'bureau', 'miroir'].includes(e.it.usageProgramme))
      || segmentsDe(modele).some(p => (modele.murs?.[p.id]?.ouvertures || []).some(o => ['fenetre', 'baie'].includes(o.type) && Math.hypot(...pointOuverture(p, o.position).map((v, i) => v - (i ? centre.z : centre.x))) < 2.5));
    if (!attrait && phase === 'final') ajouter('zone-sans-attrait', POIDS_DENSITE.sansAttrait, null, null, z.id);
  }
  if (phase === 'final' && ['salon', 'chambre', 'bureau', 'salle_a_manger', 'entree'].includes(programme.fonction)) for (const p of segmentsDe(modele)) {
    const libre = p.long - (modele.murs?.[p.id]?.ouvertures || []).reduce((s, o) => s + o.largeur, 0);
    if (libre > 1.2 && !es.some(e => distanceSegment([e.it.x, e.it.z], p.a, p.b) < .65)) ajouter('mur-mort', POIDS_DENSITE.murMort, null, null, p.id);
  }
  const sol = es.filter(e => !estMural(e.p.fam) && !estSuspendu(e.p.fam) && !['tapis'].includes(e.p.fam));
  const emprise = sol.reduce((s, e) => { const b = boite(e.it, e.p.dim); return s + (b.x1 - b.x0) * (b.z1 - b.z0); }, 0);
  return { version: politique.version, score: regles.reduce((s, r) => s + r.points, 0), regles, elements: elements.length, cibleElements,
    zonesVie: zones.length, cibleZones: politique.cibleZones, openSpace: politique.openSpace, choixExplicites: politique.choixExplicites,
    tauxEmpriseIndicatif: Math.round(emprise / programme.surface * 100), repartition, echelle: coherenceEchelle(modele),
    aCompleter: regles.some(r => ['mobilier-insuffisant', 'zone-principale-absente', 'zone-unique', 'open-space-incomplet', 'zone-demesuree', 'zone-sans-attrait', 'espaces-concentres'].includes(r.id)) };
}
