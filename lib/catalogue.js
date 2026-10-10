// Catalogue côté serveur : produits, et sélection des candidats d'un aménagement
// (bonne famille pour la fonction de la pièce, tient dans la pièce, budget, envies).
import donnees from '../data/catalogue.json' with { type: 'json' };
import indexVisuel from '../data/styles-visuels.json' with { type: 'json' };
import { choisirCandidats } from './selection.js';
import { avecStylesVisuels } from './styles-index.js';

export const PRODUITS = avecStylesVisuels(donnees.produits, indexVisuel);
export const LIBELLES = donnees.libelles || {};

export { tient, FAMILLES } from './selection.js';
// candidats par famille, au plus n par famille, les mieux adaptés d'abord
export const candidats = opts => choisirCandidats(PRODUITS, opts);

// une ligne compacte par produit, pour la consigne de Claude
export function ligneProduit(p) {
  const cm = v => Math.round(v * 100);
  const prix = p.prix > 0 ? p.prix + ' €' + (p.parModule ? '/module' : '') : 'sur devis';
  const aspect = String(p.texte || p.titre || '').replace(/\s+/g, ' ').slice(0, 240);
  const classements = p.styleVisuel ? Object.entries(p.styleVisuel.scores).sort((a, b) => b[1] - a[1]) : [];
  // Ne pas pousser un nom de style au modèle lorsque les indices visuels se valent.
  const indices = classements[0]?.[1] >= .2 && classements[0][1] - (classements[1]?.[1] || 0) >= .015 ? classements.slice(0, 2).map(([s]) => s).join(', ') : '';
  return `${p.id} | ${p.nom} | ${LIBELLES[p.fam] || p.fam}${p.st ? ' (' + p.st + ')' : ''} | ${cm(p.dim[0])}×${cm(p.dim[1])}×${cm(p.dim[2])} cm hors tout${p.chevets ? ', chevets intégrés' : ''} | ${(p.couleurs || []).slice(0, 3).join(', ') || '-'} | ${p.mat || '-'} | ${prix} | ${aspect}${indices ? ' | indices visuels à vérifier : ' + indices : ''}`;
}
