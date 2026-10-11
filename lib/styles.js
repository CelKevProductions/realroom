import { etiquettesStyle } from './references-styles.js';
import { descriptionDe } from './usages.js';
import { PROFILS, stylesDemandes } from './profils.js';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function souhaiteEpure(envies) {
  const t = norm(envies);
  return /\b(epure|minimal(?:iste|ist)?|minimalisme|sobre)\b/.test(t)
    && !/\b(baroque|classique|classic|art[ -]?deco|audacieux|maximalist)\b/.test(t);
}
export function ornemental(p) {
  return /\b(cristal|crystal|baroque|chesterfield|mandala|paons?|peacock|chinoiserie|floral|fleurs|flowers|feuillage|tropica\w*|pampilles|tassels|ornemente|ornate)\b/.test(descriptionDe(p));
}
export const respecteStyle = (p, envies) => !souhaiteEpure(envies) || !ornemental(p);
export function scoreStyle(p, envies, preferences = null) {
  const t = descriptionDe(p);
  let score = 0;
  const demandes = stylesDemandes(envies);
  const ids = demandes.length ? demandes : (preferences?.styles || [preferences?.style]).filter(s => PROFILS[s]);
  for (const id of ids) {
    score += Math.min(2,(p.stylesEditoriaux || etiquettesStyle(p)).find(e=>e.style===id)?.score*2 || 0)/Math.max(1,ids.length);
    score += PROFILS[id].mots.filter(m => t.includes(m)).length * 2 / Math.max(1, ids.length);
    // Un index visuel n'est utilisé que lorsqu'il correspond encore à cette image.
    const v = p.styleVisuel;
    if (v?.source === 'openclip' && v.image === (p.img || p.vign) && Number.isFinite(v.scores?.[id])) score += Math.max(0, Math.min(1, v.scores[id])) * 6 / Math.max(1, ids.length);
  }
  if (souhaiteEpure(envies)) {
    if (/\b(minimal\w*|epure\w*|sobre\w*|simple|discret\w*)\b/.test(t)) score += 7;
    if (/ligne\w* (droite\w*|simple\w*|pure\w*)|silhouette (basse|fine)|profil bas/.test(t)) score += 3;
    if (/\b(blanc|white|ecru|ivoire|ivory|beige|taupe|lin|linen|chene|oak)\b/.test(t)) score += 1;
    if (/\b(xxl|capitonn\w*|matelass\w*|sculptural|dore|gold)\b/.test(t)) score -= 3;
    if (ornemental(p)) score -= 15;
  }
  // Palette et matières d'une référence restent des bonus bornés, pas des exclusions.
  const cues = [...(preferences?.palette || []), ...(preferences?.matieres || [])].map(norm).filter(s => s.length > 2);
  const fiche = norm([t, p.mat, ...(p.couleurs || [])].join(' '));
  score += Math.min(3, cues.filter(s => fiche.includes(s)).length);
  return score;
}
