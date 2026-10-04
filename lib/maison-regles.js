// Règles de l'édition Maison Corleone sans dépendance au serveur Next (testées seules)

// compte RealRoom d'un client de la boutique : sa clé est « mc:<identifiant client Shopify> »
export const estCompteMaison = u => !!u && typeof u.email === 'string' && u.email.startsWith('mc:');

// chemin de retour accepté après la connexion : une page de l'édition Maison Corleone, rien d'autre
export function suiteSure(suite, lang = 'fr') {
  const s = String(suite || '');
  const l = lang === 'en' ? 'en' : 'fr';
  return /^\/(fr|en)\/maison-corleone(\/[a-z0-9-]*)?(\?[a-z0-9=&_-]*)?$/i.test(s) && !s.includes('//') ? s : `/${l}/maison-corleone`;
}
