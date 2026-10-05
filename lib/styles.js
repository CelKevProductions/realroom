import { descriptionDe } from './usages.js';

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
export function scoreStyle(p, envies) {
  if (!souhaiteEpure(envies)) return 0;
  const t = descriptionDe(p);
  let score = 0;
  if (/\b(minimal\w*|epure\w*|sobre\w*|simple|discret\w*)\b/.test(t)) score += 7;
  if (/ligne\w* (droite\w*|simple\w*|pure\w*)|silhouette (basse|fine)|profil bas/.test(t)) score += 3;
  if (/\b(blanc|white|ecru|ivoire|ivory|beige|taupe|lin|linen|chene|oak)\b/.test(t)) score += 1;
  if (/\b(xxl|capitonn\w*|matelass\w*|sculptural|dore|gold)\b/.test(t)) score -= 3;
  if (ornemental(p)) score -= 15;
  return score;
}
