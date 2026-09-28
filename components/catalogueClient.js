// Catalogue dans le navigateur : chargé une seule fois (public/catalogue.json)
let promesse = null;
export const chargerCatalogue = () => (promesse ||= fetch('/catalogue.json').then(r => {
  if (!r.ok) throw new Error('catalogue ' + r.status);
  return r.json();
}).catch(e => { promesse = null; throw e; }));
