// Sac à dos sur les pièces déjà proposées et compatibles, pas sur tout le catalogue.
// Frontières de Pareto par fonctions couvertes : garder des usages avant la décoration.
import { usageDe } from './usages.js';
import { scoreStyle } from './styles.js';
import { profilsDe, normaliserStyle } from './profils.js';

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

// Même famille et même fonction : une table basse ne remplace jamais un bureau ou un chevet.
export function emplacementDe(p) {
  return p ? p.fam + ':' + (usageDe(p) || (p.fam === 'table' ? p.dim?.[2] < .59 ? 'table-basse' : 'repas' : p.fam)) : null;
}
const lumiere = p => ['lampe', 'lampadaire', 'applique', 'suspension', 'lustre', 'plafonnier'].includes(p?.fam);
function utiliteComplement(p, opts, lumieresPresentes = 0) {
  const profils = profilsDe(opts.preferences), bonus = profils.reduce((s, p) => s + p.complements, 0) / profils.length;
  const texte = normaliserStyle(opts.envies);
  const demande = p.fam === 'tapis' ? /\b(tapis|rug)\b/.test(texte)
    : lumiere(p) ? /\b(lumiere|eclairage|lampe|light\w*)\b/.test(texte)
    : p.fam === 'miroir' ? /\b(miroir|mirror)\b/.test(texte) : false;
  // Le premier éclairage et les chevets restent utiles même dans un projet épuré.
  return Math.round(bonus + (demande ? 500 : 0) + (lumiere(p) && !lumieresPresentes ? 80 : usageDe(p) === 'chevet' ? 100 : 0));
}

// Sac à dos à choix multiples : zéro ou un produit par emplacement du brief, quantités comprises.
// Les variantes restent limitées au catalogue éligible envoyé au modèle. Aucun nouvel usage n'est inventé.
export function choisirParEmplacement(proposes, produits, disponible, dejaPresents = [], opts = {}) {
  const avecBudget = disponible != null, plafond = avecBudget ? Math.max(0, Math.round((Number.isFinite(disponible) ? disponible : 0) * 100)) : Infinity;
  const eligibles = opts.candidats ? Object.values(opts.candidats).flat() : [];
  const autorises = new Set(eligibles.map(p => p.id));
  const repetables = opts.repetables || new Set(['chaise', 'tabouret', 'applique', 'suspension', 'lustre']);
  const peutRepeter = p => repetables.has(p.fam) || usageDe(p) === 'chevet';
  const gardes = new Set(dejaPresents.filter(p => p.id && !peutRepeter(p)).map(p => p.id));
  const slots = proposes.slice(0, 24).map((m, i) => {
    const p = produits[m.produit], emplacement = emplacementDe(p);
    const ids = avecBudget ? [...new Set([m.produit, ...(Array.isArray(m.alternatives) ? m.alternatives.slice(0, 6) : []), ...eligibles.filter(q => emplacementDe(q) === emplacement).map(q => q.id)])] : [m.produit];
    const choix = ids.filter(id => produits[id] && (id === m.produit || autorises.has(id)) && emplacementDe(produits[id]) === emplacement
      && !gardes.has(id) && (!avecBudget || produits[id].prix > 0 && Number.isFinite(produits[id].prix)))
      .map(id => {
        const q = produits[id], adaptation = Math.round(scoreStyle(q, opts.envies, opts.preferences) * 8) + (id === m.produit ? 25 : 0);
        return { id, p: q, prix: q.prix > 0 && Number.isFinite(q.prix) ? centimes(q) : 0, adaptation: Math.max(-100, Math.min(200, adaptation)) };
      });
    // Toujours réserver une option économique : le score de style ne doit pas la faire disparaître.
    choix.sort((a, b) => b.adaptation - a.adaptation || a.prix - b.prix || a.id.localeCompare(b.id));
    const petit = [...choix].sort((a, b) => a.prix - b.prix || b.adaptation - a.adaptation)[0];
    const bornes = choix.slice(0, 7);
    if (petit && !bornes.some(c => c.id === petit.id)) bornes.push(petit);
    return { i, m, emplacement, choix: bornes };
  });
  const depart = dejaPresents.reduce((m, p) => m | bitDe(p), 0);
  const lumieresGardees = dejaPresents.filter(lumiere).length;
  const vide = { prix: 0, utilite: 0, masque: depart, choix: [], uniques: [], lumieres: lumieresGardees };
  let etats = [vide], approximation = false;
  for (const slot of slots) {
    const suite = [...etats];
    for (const e of etats) for (const c of slot.choix) {
      if (e.prix + c.prix > plafond || (!peutRepeter(c.p) && e.uniques.includes(c.id))) continue;
      const bit = bitDe(c.p), usage = bit && !(e.masque & bit) ? 100000 : bit ? 3000 : utiliteComplement(c.p, opts, e.lumieres);
      const utile = usage + c.adaptation;
      // Épuré : un complément non demandé n'est pas ajouté pour occuper un vide.
      if (!bit && usage <= 0) continue;
      suite.push({ prix: e.prix + c.prix, utilite: e.utilite + utile, masque: e.masque | bit,
        choix: [...e.choix, { slot: slot.i, id: c.id }], uniques: peutRepeter(c.p) ? e.uniques : [...e.uniques, c.id].sort(), lumieres: e.lumieres + (lumiere(c.p) ? 1 : 0) });
    }
    // Les produits non répétables participent à l'état, car ils peuvent revenir dans un slot suivant.
    const groupes = new Map();
    for (const e of suite) {
      const cle = e.masque + ':' + e.choix.length + ':' + Math.min(1, e.lumieres) + ':' + e.uniques.join(',');
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(e);
    }
    etats = [];
    for (const groupe of groupes.values()) {
      let meilleur = -Infinity;
      for (const e of groupe.sort((a, b) => a.prix - b.prix || b.utilite - a.utilite)) {
        if (e.utilite <= meilleur) continue;
        etats.push(e); meilleur = e.utilite;
      }
    }
    if (etats.length > 4096) {
      approximation = true;
      etats.sort((a, b) => b.utilite - a.utilite || a.prix - b.prix);
      etats = etats.slice(0, 4095).concat(vide);
    }
  }
  etats.sort((a, b) => b.utilite - a.utilite || a.prix - b.prix);
  const meilleur = etats[0], substitutions = [];
  const retenus = meilleur.choix.map(c => {
    const slot = slots[c.slot];
    if (c.id === slot.m.produit) return slot.m;
    substitutions.push({ initial: slot.m.produit, retenu: c.id, emplacement: slot.emplacement });
    return { ...slot.m, produit: c.id, raison: opts.langue === 'en' ? 'Alternative for the same use, chosen within your budget.' : 'Alternative de même usage choisie dans votre budget.' };
  });
  return { retenus, diagnostic: { methode: 'sac-a-dos-emplacements', emplacements: slots.length,
    candidats: slots.reduce((s, p) => s + p.choix.length, 0), retenus: retenus.length, cout: meilleur.prix / 100,
    prixComplets: retenus.every(m => produits[m.produit].prix > 0), plafond: avecBudget ? plafond / 100 : null, approximation, substitutions } };
}
