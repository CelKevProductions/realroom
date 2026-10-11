// Programme de vie : des emplacements, jamais des coordonnées ni de produits fictifs.
import { aireSignee, contourDe } from './contour.js';
import { usageDe, descriptionDe } from './usages.js';
import { scoreStyle } from './styles.js';

export const TYPES_PROGRAMME = ['salon', 'chambre', 'salle_a_manger', 'bureau', 'salle_de_bain', 'entree', 'terrasse'];
const texte = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function surfacePiece(modele) { return Math.abs(aireSignee(contourDe(modele))); }
const LIBELLES = { salon: 'Salon', repas: 'Repas', lecture: 'Lecture', couchage: 'Sommeil', rangement: 'Rangement',
  travail: 'Travail', bain: 'Bain', vasque: 'Vasque', accueil: 'Accueil', assise: 'Assise', detente: 'Détente' };

export function programmeComposition({ modele, fonction, envies = '', planVie = [], langue = 'fr' }) {
  if (!TYPES_PROGRAMME.includes(fonction)) return null;
  const surface = surfacePiece(modele), brief = texte(envies), zones = [], avertissements = [];
  const refuse = mot => new RegExp(`(?:sans|pas de|ni|without|no)\\s+(?:coin\\s+)?(?:${mot})`).test(brief);
  const demandeRepas = /repas|salle a manger|dining|recevoir|recois/.test(brief) && !refuse('repas|salle a manger|dining');
  const demandeTravail = /bureau|travail|office|desk/.test(brief) && !refuse('bureau|travail|office|desk');
  function ajouter(id, priorite, besoins) {
    const zone = { id, type: id, libelle: LIBELLES[id], priorite, slots: [] };
    for (const [usage, quantite = 1, obligatoire = true] of besoins) for (let i = 0; i < quantite; i++)
      zone.slots.push({ id: `${id}:${usage}:${i + 1}`, zone: id, usage, obligatoire, priorite: obligatoire ? priorite : priorite + 2 });
    zones.push(zone);
  }
  if (fonction === 'salon') {
    ajouter('salon', 1, [['canape'], ['table-basse'], ['meuble-tv'], ['lumiere-salon'], ...(surface >= 14 ? [['fauteuil-salon', 1, false]] : []), ...(surface > 20 ? [['tapis', 1, false]] : [])]);
    if ((demandeRepas || surface >= 28) && !refuse('repas|salle a manger|dining')) ajouter('repas', demandeRepas ? 1 : 2, [['table-repas'], ['chaise-repas', surface >= 45 ? 6 : 4], ['suspension', 1, false]]);
    if (demandeTravail) ajouter('travail', 2, [['bureau'], ['chaise-bureau'], ['lampe-bureau']]);
    else if (surface > 20 && !refuse('lecture')) ajouter('lecture', 3, [['fauteuil-lecture'], ['table-appoint'], ['lumiere-lecture']]);
    if (surface > 35) ajouter('rangement', 4, [['buffet', 1, false]]);
  } else if (fonction === 'chambre') {
    ajouter('couchage', 1, [['lit'], ['chevet', surface < 10 ? 1 : 2], ['lampe-chevet', surface < 10 ? 1 : 2, false]]);
    ajouter('rangement', 1, [['armoire'], ...(surface >= 13 ? [['buffet', 1, false]] : [])]);
    if (surface >= 13) zones[0].slots.push({ id: 'couchage:banc:1', zone: 'couchage', usage: 'banc', obligatoire: false, priorite: 4 });
    if (surface > 16 || demandeTravail) ajouter(demandeTravail ? 'travail' : 'lecture', 3, demandeTravail ? [['bureau'], ['chaise-bureau'], ['lampe-bureau']] : [['fauteuil-lecture'], ['table-appoint'], ['lumiere-lecture']]);
  } else if (fonction === 'salle_a_manger') {
    ajouter('repas', 1, [['table-repas'], ['chaise-repas', surface < 12 ? 4 : surface <= 18 ? 6 : 8], ['suspension']]);
    if (surface >= 12) ajouter('rangement', 2, [['buffet'], ...(surface > 18 ? [['vaisselier', 1, false]] : [])]);
  } else if (fonction === 'bureau') {
    ajouter('travail', 1, [['bureau'], ['chaise-bureau'], ['lampe-bureau']]);
    if (surface > 9) { ajouter('rangement', 2, [['etagere']]); ajouter('lecture', 3, [['fauteuil-lecture', 1, false], ['lumiere-lecture', 1, false]]); }
  } else if (fonction === 'salle_de_bain') {
    ajouter('bain', 1, [[surface >= 10 ? 'baignoire-ilot' : 'baignoire-murale']]);
    ajouter('vasque', 1, [['vasque'], ['miroir'], ['seche-serviettes', 1, false]]);
    avertissements.push(langue === 'en' ? 'Plumbing, drainage and power positions must be checked before installing bathroom furniture.' : 'Les arrivées d’eau, évacuations et équipements électriques doivent être vérifiés avant toute installation.');
    if (surface < 10) avertissements.push(langue === 'en' ? 'A freestanding bath is not proposed in this small room: choose a documented wall-mounted model.' : 'Cette petite pièce ne reçoit pas de baignoire îlot : il faut un modèle prévu pour une pose murale.');
  } else if (fonction === 'entree') {
    ajouter('accueil', 1, [['console'], ['miroir']]);
    if (surface > 5.5) ajouter('assise', 3, [['banc', 1, false], ['portemanteau', 1, false], ['tapis', 1, false]]);
  } else if (fonction === 'terrasse') {
    ajouter('salon', 1, [['salon-exterieur']]);
    if (surface > 15) ajouter('repas', 2, [['table-repas'], ['chaise-repas', surface > 25 ? 6 : 4]]);
    if (surface > 25) ajouter('detente', 3, [['transat', 2, false]]);
  }
  // Le modèle ajuste l'ordre des usages existants. Il ne peut pas contourner les exclusions,
  // créer une zone arbitraire, ni injecter des positions dans le solveur.
  for (const z of zones) {
    const suggestion = Array.isArray(planVie) && planVie.find(p => p.type === z.id);
    if (suggestion && Number.isFinite(suggestion.priorite)) {
      z.priorite = Math.max(1, Math.min(5, Math.round(suggestion.priorite)));
      z.raison = String(suggestion.raison || '').slice(0, 180);
      z.slots.forEach(s => { s.priorite = z.priorite + (s.obligatoire ? 0 : 2); });
    }
  }
  return { version: 'zones-1', fonction, surface: Math.round(surface * 100) / 100, zones, avertissements };
}

export function correspondSlot(p, usage, fonction) {
  if (!p?.dim?.every(d => Number.isFinite(d) && d > 0)) return false;
  const [w, d, h] = p.dim, fam = p.fam, nom = texte(descriptionDe(p));
  // La fiche de ce type d'ensemble donne parfois uniquement le diamètre de la table.
  // Sans emprise globale renseignée, ni ses chaises ni sa géométrie ne sont devinées.
  if (fam === 'table' && /ensemble compose.*chaises/.test(nom) && !Array.isArray(p.dimEnsemble)) return false;
  if (fonction === 'terrasse' && p.ext !== true) return false;
  if (fonction !== 'terrasse' && p.ext === true) return false;
  switch (usage) {
    case 'lit': return fam === 'lit';
    case 'canape': return fam === 'canape';
    case 'fauteuil-salon': case 'fauteuil-lecture': return fam === 'fauteuil';
    case 'table-basse': return fam === 'table' && h < .59 && w >= .35 && !/bureau/.test(nom);
    case 'table-appoint': case 'chevet': return fam === 'table' && w <= .8 && d <= .7 && h <= .8;
    case 'table-repas': return fam === 'table' && h >= .65 && h <= .85 && !/chevet|appoint|bureau/.test(nom);
    case 'chaise-repas': return !/enfant|\bkid\b|child|baby/.test(nom) && (fam === 'chaise' || (fam === 'tabouret' && h >= .4 && h <= .55 && !/bar/.test(nom))
      || (fam === 'fauteuil' && w <= .8 && d <= .85 && /^chaise|^dining chair/.test(texte(p.titre))));
    case 'chaise-bureau': return ['chaise', 'fauteuil'].includes(fam) && (/bureau|office|desk|travail/.test(nom) || fam === 'chaise');
    case 'bureau': return fam === 'bureau' || usageDe(p) === 'travail';
    case 'armoire': return usageDe(p) === 'vetements' || ['armoire', 'dressing'].includes(fam);
    case 'meuble-tv': return ['meuble', 'buffet', 'commode', 'meuble-tv'].includes(fam) && h <= 1.05 && w >= .8;
    case 'buffet': return ['meuble', 'buffet', 'commode'].includes(fam) && h <= 1.4;
    case 'console': return ['meuble', 'console'].includes(fam) && d <= .4;
    case 'etagere': return ['bibliotheque', 'etagere', 'meuble'].includes(fam);
    case 'vaisselier': return fam === 'vaisselier' || /vaisselier/.test(nom);
    case 'lampe-chevet': case 'lampe-bureau': return fam === 'lampe';
    case 'lumiere-salon': case 'lumiere-lecture': return ['lampadaire', 'applique', 'lampe'].includes(fam);
    case 'suspension': return ['suspension', 'lustre', 'plafonnier'].includes(fam);
    case 'baignoire-ilot': return fam === 'baignoire' && !/murale|wall mounted|encastr/.test(nom);
    case 'baignoire-murale': return fam === 'baignoire' && /murale|wall mounted|encastr/.test(nom);
    case 'vasque': return ['vasque', 'lavabo'].includes(fam);
    case 'seche-serviettes': return fam === 'seche-serviettes';
    case 'portemanteau': return fam === 'portemanteau';
    case 'salon-exterieur': return fam === 'salon-jardin';
    case 'transat': return ['transat', 'meridienne'].includes(fam);
    default: return fam === usage;
  }
}

export function correspondEmplacement(p, slot) {
  return correspondSlot(p, slot.usage, slot.fonction) && (slot.usage !== 'table-repas' || !slot.placesRepas || Math.floor(p.dim[0] / .5) * 2 >= slot.placesRepas)
    && (slot.usage !== 'lit' || typeof slot.chevetsIntegres !== 'boolean' || !!p.chevets === slot.chevetsIntegres);
}

export const slotRepetable = m => ['chaise-repas', 'chaise-bureau', 'fauteuil-salon', 'fauteuil-lecture', 'chevet', 'lampe-chevet', 'transat'].includes(m.programme?.usage);

export function composerProduits(programme, proposition, catalogue, candidats, gardes = [], opts = {}) {
  if (!programme) return { meubles: proposition.meubles || [], manquants: [] };
  const pool = (candidats ? Object.values(candidats).flat() : Object.values(catalogue)).filter(p => !opts.budget || p.prix > 0);
  const proposes = (proposition.meubles || []).filter(m => catalogue[m.produit]);
  const utilises = new Set(), couverts = new Set(), manquants = [], meubles = [], gardesCouverts = [], skus = new Set(), lits = new Map();
  const inventaire = gardes.filter(it => it.garde !== false).map(it => ({ it, p: it.sku ? catalogue[it.sku] : it.p }));
  for (const z of [...programme.zones].sort((a, b) => a.priorite - b.priorite)) for (const original of z.slots) {
    const slot = { ...original, fonction: programme.fonction, ...(original.usage === 'table-repas' ? { placesRepas: z.slots.filter(s => s.usage === 'chaise-repas').length } : {}) };
    const lit = lits.get(z.id);
    if ((slot.usage === 'chevet' && lit?.chevets) || (slot.usage === 'lampe-chevet' && lit?.look?.liseuses)) continue;
    const gardee = inventaire.find(e => !couverts.has(e.it.id) && correspondSlot(e.p, slot.usage, programme.fonction));
    if (gardee) { couverts.add(gardee.it.id); gardesCouverts.push({ id: gardee.it.id, slot: slot.id }); if (slot.usage === 'lit') lits.set(z.id, gardee.p); continue; }
    const suggeres = proposes.filter((m, i) => !utilises.has(i) && correspondEmplacement(catalogue[m.produit], slot));
    const adaptes = pool.filter(p => correspondEmplacement(p, slot)).sort((a, b) =>
      Number(skus.has(a.id) && !slotRepetable({ programme: slot })) - Number(skus.has(b.id) && !slotRepetable({ programme: slot }))
      || scoreStyle(b, opts.envies, opts.preferences) - scoreStyle(a, opts.envies, opts.preferences) || a.prix - b.prix || a.id.localeCompare(b.id));
    const suggestion = suggeres.find(m => m.zone === z.id) || suggeres[0];
    const produit = suggestion ? catalogue[suggestion.produit] : adaptes[0];
    if (!produit) { manquants.push({ slot: slot.id, zone: z.id, usage: slot.usage, obligatoire: slot.obligatoire, motif: 'catalogue' }); continue; }
    if (suggestion) utilises.add(proposes.indexOf(suggestion));
    skus.add(produit.id);
    if (slot.usage === 'lit') { lits.set(z.id, produit); slot.chevetsIntegres = !!produit.chevets; }
    meubles.push({ produit: produit.id, alternatives: adaptes.filter(p => p.id !== produit.id).slice(0, 6).map(p => p.id), zone: z.id,
      raison: suggestion?.raison || (opts.langue === 'en' ? `Completes the ${z.id} area.` : `Complète l’ensemble ${z.libelle.toLowerCase()}.`), programme: { ...slot, fonction: programme.fonction } });
  }
  return { meubles, manquants, gardes: gardesCouverts };
}
