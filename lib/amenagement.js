// Étapes pures d'une analyse et d'un aménagement : du résultat de Claude (ou de la simulation) à
// l'agencement enregistré. Sans base ni réseau : servent aux routes d'API et à la démo sans compte.
import { depuisAnalyse, depuisProposition } from './piece.js';
import { resoudre } from './agencement.js';
import { tient } from './selection.js';

// analyse des photos -> modèle 3D de la pièce et meubles relevés (chevauchements écartés)
export function pieceDepuisAnalyse(analyse, saisie, produits) {
  const { modele, meubles } = depuisAnalyse(analyse, saisie || {});
  const { items } = resoudre(modele, meubles, produits, { jeu: 0 });
  return { modele, agencement: items };
}

// demande d'aménagement : mode, meubles à garder ou à remplacer (seulement ceux de la pièce),
// envies, budget ; base = les meubles de départ montrés à Claude
export function preparerAmenagement(actuels, b) {
  const mode = b.mode === 'partiel' ? 'partiel' : 'tout';
  const ids = new Set(actuels.map(it => it.id));
  const garder = (Array.isArray(b.garder) ? b.garder : []).filter(x => ids.has(x));
  const aRemplacer = (Array.isArray(b.aRemplacer) ? b.aRemplacer : []).filter(x => ids.has(x));
  const envies = String(b.envies || '').slice(0, 1200);
  const budget = Math.max(0, Math.min(1e6, Math.round(+b.budget || 0)));
  // en « tout », on repart des meubles relevés sur les photos ; en « partiel », de la pièce telle qu'elle est
  const base = mode === 'tout' ? actuels.filter(it => it.origine === 'existant').map(it => ({ ...it, garde: true })) : actuels.filter(it => it.garde !== false);
  return { mode, ids, garder, aRemplacer, envies, budget, base };
}

// proposition (Claude ou simulation) -> agencement final (solveur) et résumé à afficher
export function appliquerProposition({ modele, prep, proposition, produits }) {
  const { mode, ids, garder, aRemplacer, envies, budget, base } = prep;
  const retirer = new Set((proposition.retirer || []).filter(x => ids.has(x) && !garder.includes(x)));
  if (mode === 'partiel') { for (const x of [...retirer]) if (!aRemplacer.includes(x)) retirer.delete(x); aRemplacer.forEach(x => retirer.add(x)); }
  const items = base.map(it => (retirer.has(it.id) ? { ...it, garde: false } : { ...it, fixe: true }));
  const nouveaux = (proposition.meubles || []).filter(m => produits[m.produit] && tient(produits[m.produit], modele.dims)).slice(0, 24)
    .map((m, i) => depuisProposition(m, modele, i));
  const { items: finaux, alertes } = resoudre(modele, [...items, ...nouveaux], produits);
  return {
    agencement: finaux.map(({ fixe, ...it }) => it),
    proposition: {
      mode, envies, budget,
      concept: String(proposition.concept || '').slice(0, 800),
      conseils: (proposition.conseils || []).slice(0, 4).map(s => String(s).slice(0, 300)),
      alertes: alertes.map(a => a.texte),
      date: new Date().toISOString()
    }
  };
}
