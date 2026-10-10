// Catalogue dans le navigateur : chargé une seule fois (public/catalogue.json)
import { avecStylesVisuels } from '@/lib/styles-index.js';
let promesse = null;
const lireCatalogue = () => fetch('/catalogue.json').then(r => {
  if (!r.ok) throw new Error('catalogue ' + r.status);
  return r.json();
});
export const chargerCatalogue = () => (promesse ||= Promise.all([
  lireCatalogue(), fetch('/styles-visuels.json').then(r => r.ok ? r.json() : null).catch(() => null)
]).then(([catalogue, index]) => ({ ...catalogue, produits: avecStylesVisuels(catalogue.produits, index) }))
  .catch(e => { promesse = null; throw e; }));
