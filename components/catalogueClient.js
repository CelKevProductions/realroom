// Catalogue dans le navigateur : chargé une seule fois (public/catalogue.json)
import { avecStylesVisuels } from '@/lib/styles-index.js';
import { avecObjetsGeneriques } from '@/lib/catalogue-generique.js';
let promesse = null;
const lireCatalogue = () => fetch('/catalogue.json').then(r => {
  if (!r.ok) throw new Error('catalogue ' + r.status);
  return r.json();
});
export const chargerCatalogue = () => (promesse ||= Promise.all([
  lireCatalogue(), fetch('/styles-visuels.json').then(r => r.ok ? r.json() : null).catch(() => null)
]).then(([catalogue, index]) => { const c = avecObjetsGeneriques(catalogue); return { ...c, produits: avecStylesVisuels(c.produits, index) }; })
  .catch(e => { promesse = null; throw e; }));
