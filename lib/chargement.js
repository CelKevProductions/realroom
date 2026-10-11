// Une erreur termine le travail : elle ne peut jamais faire avancer la progression.
export function avancerChargement(etat, maintenant, demo) {
  const plan = {
    analyse: { de: .03, a: .58, tau: demo ? 2.6 : 40 },
    amenager: { de: .6, a: .96, tau: 28 },
    fin: { de: 1, a: 1, tau: 1 }
  }[etat.phase];
  if (!plan) return etat.aff;
  const ecoule = Math.max(0, (maintenant - etat.t0) / 1000);
  const cible = plan.de + (plan.a - plan.de) * (1 - Math.exp(-ecoule / plan.tau));
  etat.aff += (Math.max(etat.aff, cible) - etat.aff) * (etat.phase === 'fin' ? .12 : .05);
  if (etat.phase === 'fin' && 1 - etat.aff < .004) etat.aff = 1;
  return etat.aff;
}
