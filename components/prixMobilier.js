import { prix } from '@/lib/i18n.js';
export const prixMobilier = (p, lang='fr', surDevis='') => p?.prix > 0 ? `${p.generique ? '~ ' : ''}${prix(p.prix*100,lang)}` : surDevis;
export const nomCategorie = (p, lang='fr') => p.generique ? `${p.cat} · ${lang==='fr'?'Générique':'Generic'}` : p.cat;
export const noteGeneriques = lang => lang==='fr'?'Les objets génériques complètent le projet. Leur budget est indicatif ; ils ne sont pas vendus sur la boutique.':'Generic objects complete your plan. Their budget is indicative; they are not sold in the store.';
