import { executerAssistant } from '../lib/assistant-amenagement.js';

self.addEventListener('message', e => {
  try { self.postMessage({ ok: true, resultat: executerAssistant(e.data.piece, e.data.demande, e.data.produits) }); }
  catch (erreur) { self.postMessage({ ok: false, erreur: erreur.code || 'serveur', statut: erreur.statut || 500 }); }
});
