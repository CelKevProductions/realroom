// Drapeau de l'essai « statistiques apprises » (branche experiment-ssr).
// Désactivé par défaut ; REALROOM_PRIOR_SSR=0 le coupe même en preview.
export function priorSsrActif() {
  if (typeof process === 'undefined') return false;
  if (process.env.REALROOM_PRIOR_SSR === '0' || process.env.NEXT_PUBLIC_REALROOM_PRIOR_SSR === '0') return false;
  return process.env.REALROOM_PRIOR_SSR === '1' || process.env.NEXT_PUBLIC_REALROOM_PRIOR_SSR === '1';
}
