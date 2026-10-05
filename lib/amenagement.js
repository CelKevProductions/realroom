// Étapes pures d'une analyse et d'un aménagement : du résultat de Claude (ou de la simulation) à
// l'agencement enregistré. Sans base ni réseau : servent aux routes d'API et à la démo sans compte.
import { depuisAnalyse, depuisProposition } from './piece.js';
import { resoudre } from './agencement.js';
import { optimiserAmenagement } from './confort.js';
import { tientAvecUsage } from './selection.js';
import { respecteStyle } from './styles.js';
import { estInstallation, usageDe, abandonExplicite } from './usages.js';

// Le relevé décrit l'existant : ne pas déplacer ou effacer une observation pour rendre la maquette plausible.
// Les incohérences restent visibles ; seul un nouvel aménagement passe dans le solveur.
export function pieceDepuisAnalyse(analyse, saisie, produits) {
  const { modele, meubles } = depuisAnalyse(analyse, saisie || {});
  return { modele, agencement: meubles };
}

// demande d'aménagement : mode, meubles à garder ou à remplacer (seulement ceux de la pièce),
// envies, budget ; base = les meubles de départ montrés à Claude
export function preparerAmenagement(actuels, b) {
  const mode = b.mode === 'partiel' ? 'partiel' : 'tout';
  const ids = new Set(actuels.map(it => it.id));
  const garder = [...new Set([...(Array.isArray(b.garder) ? b.garder : []).filter(x => ids.has(x)), ...actuels.filter(estInstallation).map(it => it.id)])];
  const aRemplacer = (Array.isArray(b.aRemplacer) ? b.aRemplacer : []).filter(x => ids.has(x) && !garder.includes(x));
  const envies = String(b.envies || '').slice(0, 1200);
  const budget = Math.max(0, Math.min(1e6, Math.round(+b.budget || 0)));
  // en « tout », on repart des meubles relevés sur les photos ; en « partiel », de la pièce telle qu'elle est
  const base = mode === 'tout' ? actuels.filter(it => it.origine === 'existant' || garder.includes(it.id)).map(it => ({ ...it, garde: true })) : actuels.filter(it => it.garde !== false);
  return { mode, ids, garder, aRemplacer, envies, budget, base, langue: b.langue === 'en' ? 'en' : 'fr' };
}

// proposition (Claude ou simulation) -> agencement final (solveur) et résumé à afficher
export function appliquerProposition({ modele, prep, proposition, produits }) {
  const { mode, ids, garder, aRemplacer, envies, budget, base, langue = 'fr' } = prep;
  const retirer = new Set((proposition.retirer || []).filter(x => ids.has(x) && !garder.includes(x) && !base.some(it => it.id === x && estInstallation(it))));
  if (mode === 'partiel') { for (const x of [...retirer]) if (!aRemplacer.includes(x)) retirer.delete(x); aRemplacer.forEach(x => retirer.add(x)); }
  let items = base.map(it => (retirer.has(it.id) ? { ...it, garde: false } : { ...it, fixe: true }));
  // Le budget couvre le mobilier catalogue encore présent dans la sélection, quantités comprises.
  let depense = items.filter(it => it.garde !== false && it.origine === 'catalogue').reduce((s, it) => s + Math.max(0, produits[it.sku]?.prix || 0), 0);
  const coutGardes = depense;
  const gardesSurDevis = budget && items.some(it => it.garde !== false && it.origine === 'catalogue' && !(produits[it.sku]?.prix > 0));
  let budgetEcarte = false, prixInconnu = false;
  const repetables = new Set(['chaise', 'tabouret', 'applique', 'suspension', 'lustre']);
  const deja = new Set(items.filter(it => it.garde !== false).map(it => it.sku).filter(Boolean));
  // On conserve d'abord les fonctions essentielles, avant les pièces décoratives.
  const priorite = p => ['lit', 'canape', 'bureau', 'armoire', 'dressing'].includes(p.fam) ? 0
    : ['table', 'chaise', 'meuble', 'buffet', 'commode'].includes(p.fam) ? 1 : 2;
  const ecartes = (proposition.meubles || []).filter(m => produits[m.produit] && (!tientAvecUsage(produits[m.produit], modele.dims) || !respecteStyle(produits[m.produit], envies)));
  const retenus = (proposition.meubles || []).filter(m => produits[m.produit] && tientAvecUsage(produits[m.produit], modele.dims) && respecteStyle(produits[m.produit], envies))
    .sort((a, b) => priorite(produits[a.produit]) - priorite(produits[b.produit])).filter(m => {
      const p = produits[m.produit];
      if (deja.has(m.produit) && !repetables.has(p.fam)) return false;
      if (budget && !(p.prix > 0 && Number.isFinite(p.prix))) { prixInconnu = true; return false; }
      if (budget && Math.round((depense + p.prix) * 100) > budget * 100) { budgetEcarte = true; return false; }
      depense += Math.max(0, p.prix || 0);
      deja.add(m.produit);
      return true;
    }).slice(0, 24);
  const nouveaux = retenus.map((m, i) => depuisProposition(m, modele, i));
  // « Tout repenser » renouvelle le mobilier sans supprimer silencieusement le rangement ou la coiffeuse.
  // En l'absence de remplaçant adapté (ou s'il est rejeté par le solveur), on garde la fonction existante.
  const essentiels = new Set(['couchage', 'rangement', 'vetements', 'travail', 'television']);
  const restaures = new Set();
  function conserverFonctions(liste) {
    const presents = new Set(liste.filter(it => it.garde !== false).map(it => usageDe(it.sku ? produits[it.sku] : it.p)));
    const ajouts = [];
    if (mode === 'tout') for (const it of base) {
      const usage = usageDe(it.sku ? produits[it.sku] : it.p);
      if (retirer.has(it.id) && essentiels.has(usage) && !presents.has(usage) && !abandonExplicite(usage, envies)) {
        ajouts.push({ ...it, garde: true, fixe: true });
        restaures.add(it.id); presents.add(usage);
      }
    }
    return [...liste.filter(it => !ajouts.some(a => a.id === it.id)), ...ajouts];
  }
  items = conserverFonctions([...items, ...nouveaux]);
  let { items: places, alertes } = resoudre(modele, items, produits);
  for (let tour = 0; tour < essentiels.size; tour++) {
    const retablis = conserverFonctions(places);
    if (!retablis.some(it => it.garde !== false && !places.some(p => p.id === it.id && p.garde !== false))) break;
    const reprise = resoudre(modele, retablis, produits);
    places = reprise.items; alertes.push(...reprise.alertes);
  }
  const { items: finaux, confort } = optimiserAmenagement(modele, places, produits, { langue });
  const avis = alertes.map(a => langue === 'en' ? `Not enough room for ${produits[nouveaux.find(it => it.id === a.id)?.sku]?.nom || a.id}.` : a.texte);
  if (ecartes.length) avis.push(langue === 'en' ? 'Some pieces were left out because their size or appearance did not fit the brief.' : 'Certaines pièces ont été écartées car leur encombrement ou leur aspect ne convenait pas à la demande.');
  if (restaures.size) {
    const noms = base.filter(it => restaures.has(it.id)).map(it => (it.sku ? produits[it.sku] : it.p)?.nom || it.id).join(', ');
    avis.push(langue === 'en' ? `Kept to preserve their use, with no suitable replacement retained: ${noms}.` : `Conservés pour préserver leur usage, faute de remplacement adapté retenu : ${noms}.`);
  }
  if (budgetEcarte) avis.push(langue === 'en' ? 'Some proposed pieces were left out to respect your budget.' : 'Certaines pièces proposées ont été écartées pour respecter votre budget.');
  if (prixInconnu) avis.push(langue === 'en' ? 'Pieces with an unconfirmed price were left out of the budget.' : 'Les pièces dont le prix est à confirmer ont été écartées du budget.');
  if (budget && coutGardes > budget) avis.push(langue === 'en' ? 'The pieces you kept already exceed your budget.' : 'Les pièces que vous conservez dépassent déjà votre budget.');
  if (gardesSurDevis) avis.push(langue === 'en' ? 'Confirm the price of the kept pieces quoted on request before validating the budget.' : 'Confirmez le prix des pièces conservées sur devis avant de valider le budget.');
  return {
    agencement: finaux.map(({ fixe, ...it }) => it),
    proposition: {
      mode, envies, budget, garder, confort,
      concept: String(proposition.concept || '').slice(0, 800),
      conseils: (proposition.conseils || []).slice(0, 4).map(s => String(s).slice(0, 300)),
      alertes: avis,
      date: new Date().toISOString()
    }
  };
}
