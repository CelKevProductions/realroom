import { etiquettesStyle } from './references-styles.js';
import { PROFILS } from './profils.js';

// Pas de dépendance ML dans l'application : uniquement les scores pré-calculés d'images catalogue.
export function avecStylesVisuels(produits, index) {
  produits=Object.fromEntries(Object.entries(produits).map(([id,p])=>[id,{...p,stylesEditoriaux:etiquettesStyle(p)}]));
  if (index?.version !== 1 || !index.produits || typeof index.produits !== 'object') return produits;
  return Object.fromEntries(Object.entries(produits).map(([id, p]) => {
    const v = index.produits[id];
    if (v?.source !== 'openclip' || v.image !== (p.img || p.vign) || typeof v.modele !== 'string' || typeof v.prompts !== 'string') return [id, p];
    const scores = Object.fromEntries(Object.entries(v.scores || {}).filter(([style, n]) => PROFILS[style] && Number.isFinite(n) && n >= 0 && n <= 1));
    return [id, { ...p, styleVisuel: { source: v.source, image: v.image, modele: v.modele, prompts: v.prompts, scores, aVerifier: true } }];
  }));
}
