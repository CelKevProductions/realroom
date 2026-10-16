export async function assistantEnArrierePlan(donnees) {
  if (typeof Worker === 'undefined') {
    const { executerAssistant } = await import('../../lib/assistant-amenagement.js');
    return executerAssistant(donnees.piece, donnees.demande, donnees.produits);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../moteur/assistant-worker.js', import.meta.url), { type: 'module' });
    const finir = ({ ok, resultat, erreur = 'serveur', statut = 500 }) => {
      clearTimeout(delai); worker.terminate();
      if (ok) resolve(resultat); else reject(Object.assign(new Error(erreur), { code: erreur, statut }));
    };
    const delai = setTimeout(() => finir({ erreur: 'delai-amenagement' }), 300000);
    worker.onmessage = e => finir(e.data);
    worker.onerror = () => finir({});
    worker.onmessageerror = () => finir({});
    worker.postMessage(donnees);
  });
}
