// Remplissage équilibré : une pièce n'a pas de grands vides laissés au hasard, ses
// masses sont réparties, ses coins s'appuient sur les murs ou entre eux, et ses
// grands murs ne restent pas nus. Le vide reste permis quand il est voulu (épuré).
// Hypothèses éditoriales RealRoom, à calibrer : pas des normes.
import { produitDe, boite, estMural, estSuspendu, estPlat } from './agencement.js';
import { contourDe, aireSignee, contientPoint, segmentsDe, distanceSegment } from './contour.js';
import { ecartZones, portesDe } from './relations-zones.js';

export const POIDS_REMPLISSAGE = Object.freeze({ vide: -.6, desequilibre: -30, murNu: -3, coinFlottant: -5 });
// Coins qui doivent s'appuyer sur un mur ou sur un autre coin. Le repas, la cuisine
// et le bar peuvent être au centre ; une disposition « flottante » l'assume.
const ANCRES = new Set(['salon', 'lecture', 'travail', 'rangement', 'accueil', 'couchage', 'assise', 'detente']);
const FLOTTANTES = new Set(['SL:1.2', 'SL:1.9', 'SL:1.20', 'SL:6.5', 'CH:CH-1.10']);

export function profilVide(preferences = {}) {
  const styles = preferences?.styles || [preferences?.style];
  return styles.some(s => ['epure', 'japandi'].includes(s)) ? 'epure' : 'standard';
}

function centroide(ps) {
  let a = 0, cx = 0, cz = 0;
  ps.forEach((p, i) => { const q = ps[(i + 1) % ps.length], c = p[0] * q[1] - q[0] * p[1]; a += c; cx += (p[0] + q[0]) * c; cz += (p[1] + q[1]) * c; });
  return a ? { x: cx / (3 * a), z: cz / (3 * a) } : { x: 0, z: 0 };
}

// zones : rectangles du plan (facultatif) ; items : mobilier posé (et éventuellement la mise en scène au sol).
export function evaluerRemplissage(modele, items, catalogue, { zones = [], preferences, phase = 'final' } = {}) {
  const profil = profilVide(preferences), regles = [], ajouter = (id, points, extra = {}) => regles.push({ id, points: Math.round(points * 10) / 10, ...extra });
  const surface = Math.abs(aireSignee(contourDe(modele)));
  const es = items.filter(it => it.garde !== false && !['surface_item', 'wall_item', 'ceiling_item'].includes(it.kind))
    .map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p?.dim);
  const sol = es.filter(e => !estMural(e.p.fam) && !estSuspendu(e.p.fam)).map(e => ({ ...e, b: boite(e.it, e.p.dim) }));
  if (!sol.length || surface < 4) return { version: 'remplissage-1', profil, score: 0, regles, vide: null, equilibre: null };

  // 1. Vides : part de la pièce à plus de « rayon » de tout meuble, hors abords des portes.
  const L = modele.dims.largeur, P = modele.dims.profondeur, pas = Math.max(.2, Math.sqrt(surface / 900));
  const rayon = profil === 'epure' ? 1.9 : surface > 40 ? 1.7 : 1.5, tolerance = profil === 'epure' ? .16 : .08;
  const portes = portesDe(modele);
  let total = 0, vides = 0;
  for (let x = -L / 2 + pas / 2; x < L / 2; x += pas) for (let z = -P / 2 + pas / 2; z < P / 2; z += pas) {
    if (!contientPoint(modele, x, z)) continue;
    if (portes.some(p => Math.hypot(p.x - x, p.z - z) < 1.1)) continue;
    total++;
    const d = Math.min(...sol.map(e => Math.hypot(Math.max(e.b.x0 - x, 0, x - e.b.x1), Math.max(e.b.z0 - z, 0, z - e.b.z1))));
    if (d > rayon) vides++;
  }
  const vide = total ? vides / total : 0;
  if (vide > tolerance) ajouter('grand-vide', (vide - tolerance) * 100 * POIDS_REMPLISSAGE.vide, { part: Math.round(vide * 100) / 100 });

  // 2. Équilibre : le centre des masses au sol ne s'écarte pas trop du centre de la pièce.
  const centre = centroide(contourDe(modele));
  let m = 0, mx = 0, mz = 0;
  for (const e of sol) { const w = (e.b.x1 - e.b.x0) * (e.b.z1 - e.b.z0) * (estPlat(e.p.fam) ? .3 : 1); m += w; mx += w * (e.b.x0 + e.b.x1) / 2; mz += w * (e.b.z0 + e.b.z1) / 2; }
  const ecart = m ? Math.max(Math.abs(mx / m - centre.x) / (L / 2), Math.abs(mz / m - centre.z) / (P / 2)) : 0;
  if (ecart > .3) ajouter('desequilibre', (ecart - .3) * Math.abs(POIDS_REMPLISSAGE.desequilibre) * -1, { ecart: Math.round(ecart * 100) / 100 });

  // 3. Murs nus : un pan plein de 2 m ou plus sans rien contre lui (meuble, ou tableau en finition).
  const appuis = es.filter(e => !estSuspendu(e.p.fam) && !estPlat(e.p.fam) && (phase === 'final' || !estMural(e.p.fam)));
  for (const pan of segmentsDe(modele)) {
    const plein = pan.long - (modele.murs?.[pan.id]?.ouvertures || []).reduce((s, o) => s + (o.largeur || 0), 0);
    if (plein < 2) continue;
    const touche = appuis.some(e => {
      const b = boite(e.it, e.p.dim), coins = [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1], [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2]];
      return Math.min(...coins.map(c => distanceSegment(c, pan.a, pan.b))) < .7;
    });
    if (!touche) ajouter('mur-nu', profil === 'epure' ? POIDS_REMPLISSAGE.murNu / 2 : POIDS_REMPLISSAGE.murNu, { pan: pan.id, longueur: Math.round(plein * 10) / 10 });
  }

  // 4. Coins flottants : loin de tout mur et de tout autre coin, sans disposition qui l'assume.
  const pans = segmentsDe(modele);
  for (const z of zones.filter(z => ANCRES.has(z.type) && !FLOTTANTES.has(z.dispositionUid))) {
    const coins = [[z.x0, z.z0], [z.x1, z.z0], [z.x1, z.z1], [z.x0, z.z1]];
    const mur = Math.min(...pans.flatMap(pan => coins.map(c => distanceSegment(c, pan.a, pan.b))));
    const voisin = Math.min(Infinity, ...zones.filter(q => q !== z).map(q => ecartZones(q, z)));
    if (mur > 1 && voisin > 1.2) ajouter('coin-flottant', POIDS_REMPLISSAGE.coinFlottant, { zone: z.id, mur: Math.round(mur * 100) / 100 });
  }
  return { version: 'remplissage-1', profil, score: Math.round(regles.reduce((s, r) => s + r.points, 0) * 10) / 10, regles,
    vide: Math.round(vide * 100) / 100, equilibre: Math.round(ecart * 100) / 100 };
}
