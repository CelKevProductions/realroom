// Sélection des produits candidats d'un aménagement (bonne famille pour la fonction de la pièce,
// tient dans la pièce, budget, envies). Pur JavaScript : sert au serveur (lib/catalogue.js) et à la
// démo dans le navigateur, qui lui passe le catalogue chargé.
import { estSuspendu, estMural } from './agencement.js';
import { respecteStyle, scoreStyle } from './styles.js';
import { usageDe } from './usages.js';

export const FAMILLES = {
  salon: ['canape', 'fauteuil', 'table', 'meuble', 'lampadaire', 'suspension', 'lustre', 'applique', 'pouf', 'sculpture', 'miroir', 'tapis', 'banc', 'meridienne'],
  chambre: ['lit', 'fauteuil', 'table', 'meuble', 'suspension', 'applique', 'lampadaire', 'miroir', 'banc', 'pouf', 'tapis', 'meridienne', 'lustre', 'plafonnier'],
  chambre_enfant: ['lit', 'fauteuil', 'pouf', 'suspension', 'applique', 'tapis', 'meuble'],
  salle_a_manger: ['table', 'suspension', 'lustre', 'meuble', 'banc', 'tabouret', 'miroir', 'sculpture', 'applique'],
  bureau: ['table', 'fauteuil', 'lampadaire', 'suspension', 'applique', 'meuble', 'miroir', 'pouf'],
  salle_de_bain: ['baignoire', 'miroir', 'applique', 'suspension', 'tabouret', 'plafonnier'],
  cuisine: ['tabouret', 'suspension', 'table', 'plafonnier', 'applique'],
  entree: ['banc', 'miroir', 'meuble', 'applique', 'suspension', 'sculpture', 'pouf', 'lustre'],
  terrasse: ['salon-jardin', 'balancelle', 'jardiniere', 'meridienne', 'fauteuil', 'table', 'pouf', 'banc'],
  autre: ['canape', 'fauteuil', 'table', 'meuble', 'lit', 'lampadaire', 'suspension', 'applique', 'miroir', 'pouf', 'banc', 'sculpture']
};
// Les mêmes usages existent avec des familles explicites dans un catalogue enrichi.
for (const fonction of ['salon', 'salle_a_manger', 'bureau', 'terrasse']) FAMILLES[fonction].push('chaise');
for (const fonction of ['salon', 'chambre', 'bureau']) FAMILLES[fonction].push('bureau', 'lampe', 'armoire', 'commode', 'buffet', 'etagere');
FAMILLES.entree.push('console', 'portemanteau');
FAMILLES.salle_de_bain.push('vasque', 'lavabo', 'seche-serviettes');
FAMILLES.terrasse.push('transat');
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

// Un lit qui rentre au chausse-pied n'est pas un candidat utilisable au quotidien.
export function tientAvecUsage(p, dims) {
  if (!tient(p, dims)) return false;
  if (p.fam !== 'lit') return true;
  const [w, d] = p.dim, cote = w < 1.3 ? .6 : 1.2;
  return (w + cote <= dims.largeur && d + .65 <= dims.profondeur)
    || (w + cote <= dims.profondeur && d + .65 <= dims.largeur);
}

// candidats par famille, au plus n par famille, les mieux adaptés d'abord
export function choisirCandidats(produits, { dims, fonction, envies = '', budget = 0, exterieur, parFamille = 10, familles }) {
  const ext = exterieur ?? fonction === 'terrasse';
  const liste = familles && familles.length ? familles : (FAMILLES[fonction] || FAMILLES.autre);
  const cles = new Set(mots(envies));
  const sortie = {};
  for (const fam of liste) {
    const tous = Object.values(produits).filter(p => p.fam === fam && tientAvecUsage(p, dims) && respecteStyle(p, envies)
      && (!(fonction === 'chambre' && p.fam === 'table') || usageDe(p) === 'travail' || usageDe(p) === 'chevet' || (p.dim[0] <= .8 && p.dim[1] <= .8 && p.dim[2] < .75))
      && (ext ? (p.ext || EXTERIEUR.has(p.fam) || ['fauteuil', 'table', 'pouf', 'banc', 'meridienne'].includes(p.fam)) : !(p.ext || EXTERIEUR.has(p.fam)))
      && (!budget || !p.prix || p.prix <= budget));
    if (!tous.length) continue;
    const score = p => {
      let s = scoreStyle(p, envies);
      if (p.look) s += 2;                    // maquette détaillée
      if (p.dimsLues) s += 1;                // dimensions lues sur la fiche
      if (p.prix > 0) s += .5;
      const texte = new Set(mots([p.nom, p.titre, p.texte, p.st, (p.couleurs || []).join(' '), p.mat].join(' ')));
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
    // Une variété de couleurs ne garantit pas une variété d'encombrements.
    // Réserver un modèle compact par usage, et son alternative économique si le budget est fixé.
    // Le catalogue, les cotes et le nombre maximal de candidats restent inchangés.
    const compacts = new Map(), economiques = new Map();
    for (const p of tous) {
      const cle = usageDe(p) || (p.fam === 'table' ? p.dim[2] < .59 ? 'table-basse' : 'repas' : p.fam);
      const petit = compacts.get(cle);
      if (!petit || p.dim[0] * p.dim[1] < petit.dim[0] * petit.dim[1]) compacts.set(cle, p);
      if (budget && p.prix > 0 && (!economiques.has(cle) || p.prix < economiques.get(cle).prix)) economiques.set(cle, p);
    }
    const reserves = [...new Set([...economiques.values(), ...compacts.values()])].slice(0, parFamille);
    for (const p of reserves) if (!choisis.includes(p)) {
      const remplace = choisis.findLastIndex(q => !reserves.includes(q));
      if (remplace >= 0) choisis[remplace] = p;
    }
    sortie[fam] = choisis;
  }
  return sortie;
}
