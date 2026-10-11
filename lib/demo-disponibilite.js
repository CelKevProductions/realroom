// Références d'assistance, sans clé, adresse de base ni détail du fournisseur.
// Le diagnostic et le POST appliquent exactement les mêmes prérequis.
export function disponibiliteDemoIA({ env, base, limites }) {
  let reference;
  if (env.DEMO_AMENAGEMENT_IA === '0') reference = 'D-01';
  else if (!(env.ANTHROPIC_API_KEY || '').trim() && !(env.FAL_KEY || '').trim()) reference = 'D-02';
  else if (env.VERCEL && !base) reference = 'D-03';
  else if ((env.VERCEL || (env.NODE_ENV === 'production' && env.REALROOM_ESSAIS !== '1')) && (env.SESSION_SECRET || '').length < 32) reference = 'D-04';
  else if (!(limites.demoAmenagementsParJour > 0 && limites.demoAmenagementsGlobauxParJour > 0)) reference = 'D-05';
  return { disponible: !reference, simulation: false, ...(reference ? { reference } : {}) };
}
