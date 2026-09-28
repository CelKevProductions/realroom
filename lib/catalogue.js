// Catalogue côté serveur : produits, et sélection des candidats d'un aménagement
// (bonne famille pour la fonction de la pièce, tient dans la pièce, budget, envies).
import donnees from '../data/catalogue.json' with { type: 'json' };
import { estSuspendu, estMural } from './agencement.js';

export const PRODUITS = donnees.produits;
export const LIBELLES = donnees.libelles || {};

const FAMILLES = {
  salon: ['canape', 'fauteuil', 'table', 'meuble', 'lampadaire', 'suspension', 'lustre', 'applique', 'pouf', 'sculpture', 'miroir', 'tapis', 'banc', 'meridienne'],
  chambre: ['lit', 'fauteuil', 'meuble', 'suspension', 'applique', 'lampadaire', 'miroir', 'banc', 'pouf', 'tapis', 'meridienne', 'lustre'],
  chambre_enfant: ['lit', 'fauteuil', 'pouf', 'suspension', 'applique', 'tapis', 'meuble'],
  salle_a_manger: ['table', 'suspension', 'lustre', 'meuble', 'banc', 'tabouret', 'miroir', 'sculpture', 'applique'],
  bureau: ['table', 'fauteuil', 'lampadaire', 'suspension', 'applique', 'meuble', 'miroir', 'pouf'],
  salle_de_bain: ['baignoire', 'miroir', 'applique', 'suspension', 'tabouret', 'plafonnier'],
  cuisine: ['tabouret', 'suspension', 'table', 'plafonnier', 'applique'],
  entree: ['banc', 'miroir', 'meuble', 'applique', 'suspension', 'sculpture', 'pouf', 'lustre'],
  terrasse: ['salon-jardin', 'balancelle', 'jardiniere', 'meridienne', 'fauteuil', 'table', 'pouf', 'banc'],
  autre: ['canape', 'fauteuil', 'table', 'meuble', 'lit', 'lampadaire', 'suspension', 'applique', 'miroir', 'pouf', 'banc', 'sculpture']
};
const EXTERIEUR = new Set(['salon-jardin', 'balancelle', 'jardiniere']);

// le produit tient-il dans la pièce (au sol : empreinte, dans un sens ou l'autre ; suspendu : sous le plafond)
export function tient(p, dims) {
  if (!p || !p.dim || !dims) return false;
  const [w, d, h] = p.dim, { largeur: L, profondeur: P, hauteur: H } = dims;
  if (estSuspendu(p.fam)) return h <= Math.max(.3, H - 1.85) && w <= L - .3 && d <= P - .3;
  if (estMural(p.fam)) return w <= Math.max(L, P) - .2 && h <= H - .3;
  if (h > H - .03) return false;
  return (w <= L - .15 && d <= P - .15) || (d <= L - .15 && w <= P - .15);
}

const mots = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(m => m.length > 2);

// candidats par famille, au plus n par famille, les mieux adaptés d'abord
export function candidats({ dims, fonction, envies = '', budget = 0, exterieur, parFamille = 10, familles }) {
  const ext = exterieur ?? fonction === 'terrasse';
  const liste = familles && familles.length ? familles : (FAMILLES[fonction] || FAMILLES.autre);
  const cles = new Set(mots(envies));
  const sortie = {};
  for (const fam of liste) {
    const tous = Object.values(PRODUITS).filter(p => p.fam === fam && tient(p, dims)
      && (ext ? (p.ext || EXTERIEUR.has(p.fam) || ['fauteuil', 'table', 'pouf', 'banc', 'meridienne'].includes(p.fam)) : !(p.ext || EXTERIEUR.has(p.fam)))
      && (!budget || !p.prix || p.prix <= budget));
    if (!tous.length) continue;
    const score = p => {
      let s = 0;
      if (p.look) s += 2;                    // maquette détaillée
      if (p.dimsLues) s += 1;                // dimensions lues sur la fiche
      if (p.prix > 0) s += .5;
      const texte = new Set(mots([p.nom, p.titre, p.st, (p.couleurs || []).join(' '), p.mat].join(' ')));
      for (const m of cles) if (texte.has(m)) s += 1.5;
      if (ext && p.ext) s += 2;
      return s;
    };
    // tri par score, puis variété de styles et de couleurs
    const tries = tous.map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s || (a.p.prix || 0) - (b.p.prix || 0));
    const choisis = [], vus = new Set();
    for (const { p } of tries) {
      const cle = p.st + '|' + (p.couleurs || [])[0];
      if (vus.has(cle) && choisis.length < parFamille / 2) continue;
      vus.add(cle); choisis.push(p);
      if (choisis.length >= parFamille) break;
    }
    for (const { p } of tries) { if (choisis.length >= parFamille) break; if (!choisis.includes(p)) choisis.push(p); }
    sortie[fam] = choisis;
  }
  return sortie;
}

// une ligne compacte par produit, pour la consigne de Claude
export function ligneProduit(p) {
  const cm = v => Math.round(v * 100);
  const prix = p.prix > 0 ? p.prix + ' €' + (p.parModule ? '/module' : '') : 'sur devis';
  return `${p.id} | ${p.nom} | ${LIBELLES[p.fam] || p.fam}${p.st ? ' (' + p.st + ')' : ''} | ${cm(p.dim[0])}×${cm(p.dim[1])}×${cm(p.dim[2])} cm | ${(p.couleurs || []).slice(0, 3).join(', ') || '-'} | ${p.mat || '-'} | ${prix}`;
}
