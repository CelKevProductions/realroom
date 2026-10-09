// Sac à dos sur les pièces déjà proposées et compatibles, pas sur tout le catalogue.
// Frontières de Pareto par fonctions couvertes : garder des usages avant la décoration.
import { usageDe } from './usages.js';

const USAGES = ['couchage', 'assise', 'repas', 'travail', 'rangement', 'vetements', 'television'];
const bitDe = p => {
  const usage = usageDe(p) || (['canape', 'fauteuil', 'chaise', 'tabouret', 'banc', 'pouf', 'meridienne'].includes(p.fam) ? 'assise'
    : p.fam === 'table' && p.dim?.[2] >= .59 ? 'repas' : null);
  const i = USAGES.indexOf(usage); return i < 0 ? 0 : 1 << i;
};
const centimes = p => Math.round(p.prix * 100);

export function choisirSousBudget(proposes, produits, disponible, dejaPresents = []) {
  if (disponible == null) return { retenus: proposes.slice(0, 24), diagnostic: { methode: 'sans-plafond' } };
  const candidats = proposes.slice(0, 80).filter(m => produits[m.produit]?.prix > 0 && Number.isFinite(produits[m.produit].prix));
  const plafond = Math.max(0, Math.round((Number.isFinite(disponible) ? disponible : 0) * 100));
  const depart = dejaPresents.reduce((m, p) => m | bitDe(p), 0);
  let etats = [{ prix: 0, utilite: 0, masque: depart, indices: [] }], approximation = false;
  for (let i = 0; i < candidats.length; i++) {
    const p = produits[candidats[i].produit], prix = centimes(p), bit = bitDe(p);
    const candidatsEtats = [...etats];
    for (const e of etats) {
      if (e.prix + prix > plafond || e.indices.length >= 24) continue;
      const utile = bit && !(e.masque & bit) ? 10000 : bit ? 300 : 100;
      candidatsEtats.push({ prix: e.prix + prix, utilite: e.utilite + utile,
        masque: e.masque | bit, indices: [...e.indices, i] });
    }
    const groupes = new Map();
    for (const e of candidatsEtats) {
      // La cardinalité participe à l'état : on ne peut pas ajouter une 25e pièce.
      const cle = e.masque + ':' + e.indices.length;
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(e);
    }
    etats = [];
    for (const groupe of groupes.values()) {
      let meilleur = -1;
      for (const e of groupe.sort((a, b) => a.prix - b.prix || b.utilite - a.utilite)) {
        if (e.utilite <= meilleur) continue;
        etats.push(e); meilleur = e.utilite;
      }
    }
    // Protection du temps serveur sur un grand brief ; cette borne rend alors la recherche indicative.
    if (etats.length > 12000) {
      approximation = true;
      etats.sort((a, b) => b.utilite - a.utilite || a.prix - b.prix);
      etats = etats.slice(0, 11999).concat({ prix: 0, utilite: 0, masque: depart, indices: [] });
    }
  }
  etats.sort((a, b) => b.utilite - a.utilite || a.prix - b.prix);
  const meilleur = etats[0];
  return { retenus: meilleur.indices.map(i => candidats[i]), diagnostic: {
    methode: 'sac-a-dos-pareto', candidats: candidats.length, retenus: meilleur.indices.length,
    cout: meilleur.prix / 100, plafond: plafond / 100, approximation
  } };
}
