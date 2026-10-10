// L'animation et les gestes restent libres pendant l'optimisation de la démo.
export async function amenagerEnArrierePlan(donnees) {
  if (typeof Worker === 'undefined') {
    const { calculerDemo } = await import('../../lib/amenagement-demo.js');
    return calculerDemo(donnees);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../moteur/amenager-worker.js', import.meta.url), { type: 'module' });
    const finir = (resultat, erreur) => {
      clearTimeout(delai); worker.terminate();
      if (erreur) reject(new Error('amenagement')); else resolve(resultat);
    };
    const delai = setTimeout(() => finir(null, true), 45000);
    worker.onmessage = e => finir(e.data.resultat, !e.data.ok);
    worker.onerror = () => finir(null, true);
    worker.onmessageerror = () => finir(null, true);
    worker.postMessage(donnees);
  });
}
