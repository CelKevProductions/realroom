// Relations entre les coins d'une pièce : un plan se juge aussi à la façon dont ses
// ensembles s'enchaînent (repas près du salon, lecture hors de l'axe de l'écran…).
// Hypothèses éditoriales RealRoom, à calibrer : pas des normes.
import { produitDe } from './agencement.js';
import { segmentsDe, pointOuverture, contourDe, aireSignee } from './contour.js';

export const POIDS_RELATIONS = Object.freeze({
  salonRepasProches: 4, salonRepasEloignes: -6,
  repasCuisineProches: 5, repasCuisineEloignes: -6,
  barRelie: 3, barIsole: -3,
  lectureAxeEcran: -6, travailAxeEcran: -5, bureauFaceLit: -3,
  calmeContrePorte: -3, accueilPorte: 3, rangementRepas: 2
});

const TEXTES = {
  'salon-repas-proches': 'Le coin repas prolonge le salon.',
  'salon-repas-eloignes': 'Le coin repas est coupé du salon.',
  'repas-cuisine-proches': 'Le repas est à portée de la cuisine.',
  'repas-cuisine-eloignes': 'Le repas est loin de la cuisine.',
  'bar-relie': 'Le bar fait le lien entre les espaces de vie.',
  'bar-isole': 'Le bar est isolé des espaces qu’il sert.',
  'lecture-axe-ecran': 'Le coin lecture est dans l’axe de la télévision.',
  'travail-axe-ecran': 'Le bureau est dans l’axe de la télévision.',
  'bureau-face-lit': 'L’écran du bureau fait face au lit.',
  'calme-contre-porte': 'Un coin calme est collé à une porte.',
  'accueil-porte': 'L’accueil est près de la porte.',
  'rangement-repas': 'Le rangement sert le coin repas.'
};

// Écart entre deux rectangles (0 s'ils se touchent ou se chevauchent).
export const ecartZones = (a, b) => Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), Math.max(a.z0 - b.z1, b.z0 - a.z1, 0));
const distancePointZone = (p, z) => Math.hypot(Math.max(z.x0 - p.x, 0, p.x - z.x1), Math.max(z.z0 - p.z, 0, p.z - z.z1));

export function portesDe(modele) {
  return segmentsDe(modele).flatMap(pan => (modele.murs?.[pan.id]?.ouvertures || [])
    .filter(o => o.type === 'porte' || o.type === 'passage' || (o.type === 'baie' && !(o.allege > .05)))
    .map(o => { const q = pointOuverture(pan, o.position); return { x: q[0] + pan.n[0] * .3, z: q[1] + pan.n[1] * .3, o }; }));
}

// Couloir de vue entre le canapé et l'écran d'un même salon (segment épaissi).
function axeEcran(zones, es) {
  const salon = zones.find(z => z.type === 'salon');
  if (!salon) return null;
  const dansSalon = es.filter(e => e.it.zoneId === salon.id);
  const sofa = dansSalon.find(e => e.p.fam === 'canape') || dansSalon.find(e => e.p.fam === 'fauteuil');
  const ecran = dansSalon.find(e => ['tv', 'tv-murale'].includes(e.p.fam)) || dansSalon.find(e => e.it.usageProgramme === 'meuble-tv');
  if (!sofa || !ecran) return null;
  return { a: { x: sofa.it.x, z: sofa.it.z }, b: { x: ecran.it.x, z: ecran.it.z }, demi: Math.max(.4, sofa.p.dim[0] * .35) };
}
function coupeAxe(zone, axe) {
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, p = { x: axe.a.x + (axe.b.x - axe.a.x) * t, z: axe.a.z + (axe.b.z - axe.a.z) * t };
    if (distancePointZone(p, zone) < axe.demi) return true;
  }
  return false;
}

export function scoreRelations(modele, zones, items, catalogue, fonction) {
  const regles = [], ajouter = (id, points, ids) => regles.push({ id, points, zones: ids, texte: TEXTES[id] });
  if (!zones?.length) return { score: 0, regles };
  const es = items.filter(it => it.garde !== false).map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p?.dim);
  const type = t => zones.filter(z => z.type === t);
  const premier = t => type(t)[0];
  const salon = premier('salon'), repas = premier('repas'), cuisine = premier('cuisine'), bar = premier('bar');
  const surface = Math.abs(aireSignee(contourDe(modele)));
  // Dans un grand séjour, « proche » se mesure à l'échelle de la pièce.
  const proche = Math.max(2.5, Math.sqrt(surface) / 3), loin = proche + 1.5;
  if (salon && repas) {
    const d = ecartZones(salon, repas);
    if (d <= proche) ajouter('salon-repas-proches', POIDS_RELATIONS.salonRepasProches, [salon.id, repas.id]);
    else if (d > loin) ajouter('salon-repas-eloignes', POIDS_RELATIONS.salonRepasEloignes, [salon.id, repas.id]);
  }
  if (repas && cuisine) {
    const d = ecartZones(repas, cuisine);
    if (d <= 2) ajouter('repas-cuisine-proches', POIDS_RELATIONS.repasCuisineProches, [repas.id, cuisine.id]);
    else if (d > 3.5) ajouter('repas-cuisine-eloignes', POIDS_RELATIONS.repasCuisineEloignes, [repas.id, cuisine.id]);
  }
  if (bar) {
    const voisins = [cuisine, repas, salon].filter(Boolean);
    if (voisins.length) {
      const d = Math.min(...voisins.map(z => ecartZones(bar, z)));
      ajouter(d <= 2 ? 'bar-relie' : 'bar-isole', d <= 2 ? POIDS_RELATIONS.barRelie : POIDS_RELATIONS.barIsole, [bar.id]);
    }
  }
  const axe = axeEcran(zones, es);
  if (axe) {
    for (const z of type('lecture')) if (coupeAxe(z, axe)) ajouter('lecture-axe-ecran', POIDS_RELATIONS.lectureAxeEcran, [z.id]);
    for (const z of type('travail')) if (coupeAxe(z, axe)) ajouter('travail-axe-ecran', POIDS_RELATIONS.travailAxeEcran, [z.id]);
  }
  // Chambre : l'écran du bureau (côté assise) ne doit pas faire face à l'oreiller.
  const lit = es.find(e => e.p.fam === 'lit'), bureau = es.find(e => e.it.usageProgramme === 'bureau');
  if (lit && bureau) {
    const a = bureau.it.rot || 0, fx = Math.sin(a), fz = Math.cos(a);
    const dx = lit.it.x - bureau.it.x, dz = lit.it.z - bureau.it.z, d = Math.hypot(dx, dz);
    if (d > .1 && d < 3.5 && (dx * fx + dz * fz) / d > .7) ajouter('bureau-face-lit', POIDS_RELATIONS.bureauFaceLit, [bureau.it.zoneId]);
  }
  const portes = portesDe(modele);
  if (portes.length) {
    for (const z of zones.filter(z => ['lecture', 'travail'].includes(z.type) || (z.type === 'couchage' && fonction !== 'chambre'))) {
      if (Math.min(...portes.map(p => distancePointZone(p, z))) < .6) ajouter('calme-contre-porte', POIDS_RELATIONS.calmeContrePorte, [z.id]);
    }
    for (const z of type('accueil')) if (Math.min(...portes.map(p => distancePointZone(p, z))) < 1.5) ajouter('accueil-porte', POIDS_RELATIONS.accueilPorte, [z.id]);
  }
  if (repas) for (const z of type('rangement')) if (ecartZones(z, repas) <= 1.5) ajouter('rangement-repas', POIDS_RELATIONS.rangementRepas, [z.id]);
  return { score: regles.reduce((s, r) => s + r.points, 0), regles };
}
