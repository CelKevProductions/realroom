// Statistiques apprises sur des pièces réelles (essai privé, branche experiment-ssr).
// Le fichier data/experiment-ssr/priors.json ne contient que des distributions agrégées
// (percentiles par taille de pièce), aucune scène. Ce terme de note rapproche le plan de
// ce qui se voit dans des pièces dessinées par des professionnels : distance canapé-écran,
// canapé-table basse, tolérance de déséquilibre, armoire facultative en petite chambre.
// Il ne choisit jamais la disposition (96 % des pièces de la base ont le canapé face à
// l'écran : s'y fier supprimerait la variété) ; il ne fait que pénaliser les aberrations.
import PRIORS from '../data/experiment-ssr/priors.json' with { type: 'json' };
import { produitDe } from './agencement.js';
import { contourDe, aireSignee } from './contour.js';

const surfaceDe = modele => Math.abs(aireSignee(contourDe(modele)));
const trancheSalon = a => a < 20 ? 'moins-20' : a < 30 ? '20-30' : a < 45 ? '30-45' : 'plus-45';
const trancheChambre = a => a < 9 ? 'moins-9' : a < 12 ? '9-12' : a < 16 ? '12-16' : 'plus-16';
const arrondi = n => Math.round(n * 10) / 10;

// Seuil d'équilibre : 75e centile des pièces réelles de même type et de même taille.
export function seuilEquilibre(modele, fonction) {
  const a = surfaceDe(modele);
  const p = fonction === 'chambre' ? PRIORS.chambre[trancheChambre(a)]?.desequilibre?.p75 : PRIORS.salon[trancheSalon(a)]?.desequilibre?.p75;
  return Number.isFinite(p) ? p : .3;
}

// En dessous de 12 m², la moitié des chambres réelles n'a pas d'armoire dans la pièce.
export function armoireFacultative(surface) {
  const t = PRIORS.chambre[trancheChambre(surface)];
  return !!t && t.armoire < .6 && surface < 12;
}

// Pénalité hors plage [p10, p90], bonus dans le cœur de la distribution [p25, p75].
function noteDistance(d, loi, { max, pente, bonus = 0 }) {
  if (!loi || !Number.isFinite(d)) return 0;
  if (d < loi.p10) return -Math.min(max, (loi.p10 - d) * pente);
  if (d > loi.p90) return -Math.min(max, (d - loi.p90) * pente);
  return d >= loi.p25 && d <= loi.p75 ? bonus : 0;
}

export function evaluerPrior(modele, items, catalogue, fonction) {
  const regles = [], ajouter = (id, points, extra = {}) => { if (points) regles.push({ id, points: arrondi(points), ...extra }); };
  if (fonction !== 'salon') return { version: 'prior-ssr-1', score: 0, regles };
  const posés = items.filter(it => it.garde !== false && Number.isFinite(it.x) && Number.isFinite(it.z));
  const u = nom => posés.find(it => it.usageProgramme === nom && produitDe(it, catalogue));
  const canape = u('canape'), tv = u('meuble-tv'), basse = u('table-basse');
  const t = PRIORS.salon[trancheSalon(surfaceDe(modele))];
  if (canape && tv) {
    const d = Math.hypot(canape.x - tv.x, canape.z - tv.z);
    ajouter('prior-canape-ecran', noteDistance(d, t.canape_ecran, { max: 6, pente: 8, bonus: 2 }), { distance: Math.round(d * 100) / 100 });
  }
  if (canape && basse) {
    const d = Math.hypot(canape.x - basse.x, canape.z - basse.z);
    ajouter('prior-canape-table-basse', noteDistance(d, t.canape_table_basse, { max: 4, pente: 10, bonus: 1 }), { distance: Math.round(d * 100) / 100 });
  }
  return { version: 'prior-ssr-1', score: arrondi(regles.reduce((s, r) => s + r.points, 0)), regles };
}
