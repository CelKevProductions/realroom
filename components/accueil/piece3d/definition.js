// Définition adaptative des scènes 3D de l'accueil : on part de la définition de l'écran (plafonnée) et on la
// baisse d'un cran (jusqu'à 0,75) quand plus de 40 % des images arrivent lentement (moins de 40 par seconde)
// sur une centaine ; on ne remonte jamais (pas de va-et-vient). Rend la fonction à appeler à chaque image
// avec l'intervalle depuis la précédente (ms).
export function definitionAdaptative(renderer, max, redimensionner) {
  let dpr = max, vues = 0, lentes = 0;
  renderer.setPixelRatio(dpr);
  return ms => {
    vues++;
    if (ms > 25) lentes++;
    if (vues < 100) return;
    const lent = lentes / vues > .4;
    vues = lentes = 0;
    if (!lent || dpr <= .75) return;
    dpr = Math.max(.75, dpr - .25);
    renderer.setPixelRatio(dpr);
    redimensionner();
  };
}
