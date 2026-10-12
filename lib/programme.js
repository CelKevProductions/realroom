// Programme de vie : des emplacements, des produits et des objets génériques identifiés.
import { aireSignee, contourDe } from './contour.js';
import { usageDe, descriptionDe } from './usages.js';
import { scoreStyle } from './styles.js';
import { finitionActive } from './finition.js';
import { normaliserEspaces, normaliserPlaces, intentionsEspaces } from './espaces.js';
import { compositionSurfaceActive, politiqueSurface } from './composition-surface.js';
import {enrichirProgramme} from './encyclopedie.js';
import { stagingActif } from './staging-catalogue.js';

export const TYPES_PROGRAMME = ['salon', 'chambre', 'salle_a_manger', 'bureau', 'salle_de_bain', 'entree', 'terrasse'];
const texte = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function surfacePiece(modele) { return Math.abs(aireSignee(contourDe(modele))); }
const LIBELLES = { salon: 'Salon', repas: 'Repas', lecture: 'Lecture', couchage: 'Sommeil', rangement: 'Rangement',
  travail: 'Travail', bain: 'Bain', vasque: 'Vasque', accueil: 'Accueil', assise: 'Assise', detente: 'Détente', cuisine:'Cuisine', bar:'Bar' };

export function programmeComposition({ modele, fonction, envies = '', espaces, placesRepas, planVie = [], langue = 'fr', details, compositionSurface, staging, encyclopedie, profilUsage }) {
  if (!TYPES_PROGRAMME.includes(fonction)) return null;
  const surface = Math.round(surfacePiece(modele) * 10000) / 10000, brief = texte(envies), zones = [], avertissements = [], fini = finitionActive(details);
  const refuse = mot => new RegExp(`(?:sans|pas de|ni|without|no)\\s+(?:coin\\s+)?(?:${mot})`).test(brief);
  const explicites = normaliserEspaces(espaces), intentions = intentionsEspaces(envies);
  const demande = id => (explicites || intentions.demandes).includes(id);
  const souhaite = (id, parDefaut) => explicites ? demande(id) : !intentions.refus(id) && (demande(id) || parDefaut);
  const demandeRepas = demande('repas'), demandeTravail = demande('travail');
  const places = normaliserPlaces(placesRepas) || intentions.placesRepas;
  const parSurface = compositionSurfaceActive(compositionSurface);
  const deco = stagingActif(staging) && parSurface && fini;
  function ajouter(id, priorite, besoins) {
    const zone = { id, type: id, libelle: LIBELLES[id], priorite: demande(id) ? 1 : priorite, demandee: demande(id), slots: [] };
    for (const [usage, quantite = 1, obligatoire = true] of besoins) for (let i = 0; i < quantite; i++)
      zone.slots.push({ id: `${id}:${usage}:${i + 1}`, zone: id, usage, obligatoire, demandee: demande(id), priorite: obligatoire ? zone.priorite : zone.priorite + 2 });
    zones.push(zone);
  }
  if (fonction === 'salon') {
    ajouter('salon', 1, [['canape'], ['table-basse'], ['meuble-tv'], ['lumiere-salon'], ...(surface >= 14 ? [['fauteuil-salon', parSurface && surface > 75 ? 2 : 1, false]] : []), ...(surface > 20 ? [['tapis', 1, false]] : [])]);
    // Chaque palier reçoit des ensembles complets. Le brief peut demander ou exclure chaque espace.
    const repasDefaut = parSurface ? surface > 40 || surface > 20 && !demande('lecture') && !demandeTravail : surface >= 28;
    if (souhaite('repas', repasDefaut)) ajouter('repas', demandeRepas ? 1 : 2, [['table-repas'], ['chaise-repas', places || (parSurface && surface > 75 ? 8 : surface >= 45 ? 6 : 4)], ['suspension', 1, false]]);
    const lectureDefaut = parSurface ? surface > 40 && !(deco && surface > 75) || !demandeTravail && surface <= 75 && (surface >= 28 || surface > 20 && !zones.some(z => z.id === 'repas')) : !demandeTravail && surface > 20;
    if (souhaite('lecture', lectureDefaut)) ajouter('lecture', 3, [['fauteuil-lecture'], ['table-appoint'], ['lumiere-lecture']]);
    if (souhaite('travail', parSurface && surface > 75)) ajouter('travail', 3, [['bureau'], ['chaise-bureau'], ['lampe-bureau']]);
    // Un refus dans le texte peut exclure le repas ; essayer l'usage suivant avant de laisser un seul coin.
    if (parSurface && !explicites && surface > 20 && zones.length < (surface > 40 ? 3 : 2)) {
      for (const id of ['repas', 'lecture', 'travail']) {
        if (zones.some(z => z.id === id) || intentions.refus(id)) continue;
        if (id === 'repas') ajouter(id, 2, [['table-repas'], ['chaise-repas', places || 4], ['suspension', 1, false]]);
        if (id === 'lecture') ajouter(id, 3, [['fauteuil-lecture'], ['table-appoint'], ['lumiere-lecture']]);
        if (id === 'travail') ajouter(id, 3, [['bureau'], ['chaise-bureau'], ['lampe-bureau']]);
        if (zones.length >= (surface > 40 ? 3 : 2)) break;
      }
    }
    if (souhaite('rangement', parSurface ? surface >= 28 : surface > 35)) ajouter('rangement', 4, [['buffet', 1, demande('rangement')]]);
    if (deco && (surface>40||demande('cuisine')||demande('bar'))) for (const id of ['cuisine','bar']) {
      if (souhaite(id,surface>40&&(id==='cuisine'||surface>=60))) {
        ajouter(id,2,[]);
        zones.at(-1).stagingArchitecture=true;
      }
    }
    if (parSurface && surface > 20 && !zones.some(z => z.id === 'lecture') && zones[0].slots.filter(s => s.usage === 'fauteuil-salon').length < 2) {
      zones[0].slots.push({ id: 'salon:fauteuil-salon:2', zone: 'salon', usage: 'fauteuil-salon', obligatoire: false, priorite: 3 });
    }
  } else if (fonction === 'chambre') {
    ajouter('couchage', 1, [['lit'], ['chevet', surface < 10 ? 1 : 2], ['lampe-chevet', surface < 10 ? 1 : 2, false]]);
    ajouter('rangement', 1, [['armoire'], ...(surface >= 13 ? [['buffet', 1, false]] : [])]);
    if (surface >= 13) zones[0].slots.push({ id: 'couchage:banc:1', zone: 'couchage', usage: 'banc', obligatoire: false, priorite: 4 });
    if (demandeTravail) ajouter('travail', 3, [['bureau'], ['chaise-bureau'], ['lampe-bureau']]);
    if (souhaite('lecture', !demandeTravail && surface > 16)) ajouter('lecture', 3, [['fauteuil-lecture'], ['table-appoint'], ['lumiere-lecture']]);
  } else if (fonction === 'salle_a_manger') {
    ajouter('repas', 1, [['table-repas'], ['chaise-repas', places || (surface < 12 ? 4 : surface <= 18 ? 6 : 8)], ['suspension']]);
    if (souhaite('rangement', surface >= 12)) ajouter('rangement', 2, [['buffet'], ...(surface > 18 ? [['vaisselier', 1, false]] : [])]);
  } else if (fonction === 'bureau') {
    ajouter('travail', 1, [['bureau'], ['chaise-bureau'], ['lampe-bureau']]);
    if (souhaite('rangement', surface > 9)) ajouter('rangement', 2, [['etagere']]);
    if (souhaite('lecture', surface > 9)) ajouter('lecture', 3, [['fauteuil-lecture', 1, demande('lecture')], ...(parSurface && surface > 14 ? [['table-appoint', 1, demande('lecture')]] : []), ['lumiere-lecture', 1, demande('lecture')]]);
  } else if (fonction === 'salle_de_bain') {
    ajouter('bain', 1, [[surface >= 10 ? 'baignoire-ilot' : 'baignoire-murale']]);
    ajouter('vasque', 1, [['vasque'], ['miroir'], ['seche-serviettes', 1, false]]);
    if (parSurface && surface >= 10) ajouter('rangement', 3, [['etagere', 1, false]]);
    avertissements.push(langue === 'en' ? 'Plumbing, drainage and power positions must be checked before installing bathroom furniture.' : 'Les arrivées d’eau, évacuations et équipements électriques doivent être vérifiés avant toute installation.');
    if (surface < 10) avertissements.push(langue === 'en' ? 'A freestanding bath is not proposed in this small room: choose a documented wall-mounted model.' : 'Cette petite pièce ne reçoit pas de baignoire îlot : il faut un modèle prévu pour une pose murale.');
  } else if (fonction === 'entree') {
    ajouter('accueil', 1, [['console'], ['miroir']]);
    if (demande('rangement')) ajouter('rangement', 1, [['etagere']]);
    if (surface > 5.5) ajouter('assise', 3, [['banc', 1, false], ['portemanteau', 1, false], ['tapis', 1, false]]);
    if (parSurface && surface > 10 && !zones.some(z => z.id === 'rangement')) ajouter('rangement', 3, [['etagere', 1, false]]);
  } else if (fonction === 'terrasse') {
    ajouter('salon', 1, [['salon-exterieur']]);
    if (souhaite('repas', surface > 15)) ajouter('repas', 2, [['table-repas'], ['chaise-repas', places || (surface > 25 ? 6 : 4)]]);
    if (surface > 25) ajouter('detente', 3, [['transat', 2, false]]);
  }
  const sansTV = refuse('television|tele|tv|screen');
  if (fini) {
    const salon = zones.find(z => z.id === 'salon'), couchage = zones.find(z => z.id === 'couchage'), travail = zones.find(z => z.id === 'travail');
    const ajouterSlot = (z, usage, obligatoire = false, priorite = z?.priorite + 2) => {
      if (z) z.slots.push({ id: `${z.id}:${usage}:1`, zone: z.id, usage, obligatoire, priorite, couche: 'finition' });
    };
    if (fonction === 'salon') {
      if (!sansTV) {
        ajouterSlot(salon, 'television', true, 1);
        const slot = salon.slots.at(-1);
        if (/(?:tv|television|tele|screen).{0,25}(?:mural|au mur|wall)|wall.{0,20}(?:tv|screen)/.test(brief)) slot.pose = 'mur';
        else if (/(?:tv|television|tele|screen).{0,25}(?:sur (?:un |le |une |la )?(?:meuble|commode|console)|sur pied|stand)/.test(brief)) slot.pose = 'meuble';
      }
      ajouterSlot(salon, 'tableau-principal', sansTV, 3);
      if (!parSurface || surface >= 14) ajouterSlot(salon, 'tableau-secondaire', false, 4);
      if (surface >= 32) ajouterSlot(salon, 'etagere-murale', false, 5);
    } else if (fonction === 'chambre') {
      couchage.slots.filter(s => s.usage === 'lampe-chevet').forEach(s => { s.obligatoire = true; s.priorite = 2; });
      ajouterSlot(couchage, 'tableau-principal', false, 3);
      if (surface >= 13) ajouterSlot(couchage, 'tableau-secondaire', false, 4);
    } else if (fonction === 'salle_a_manger') {
      ajouterSlot(zones.find(z => z.id === 'repas'), 'tableau-secondaire', false, 3);
      if (parSurface && surface > 18) ajouterSlot(zones.find(z => z.id === 'rangement'), 'tableau-secondaire', false, 4);
    } else if (fonction === 'bureau') {
      ajouterSlot(travail, 'tableau-principal', false, 3);
      ajouterSlot(travail, 'etagere-murale', false, 4);
    } else if (fonction === 'entree') {
      ajouterSlot(zones.find(z => z.id === 'accueil'), 'eclairage-accueil', false, 2);
    }
    // Le miroir est déjà présent dans les programmes entrée et bain, la suspension dans repas.
    // Ces usages ont une pose verticale, aucun rectangle de sol supplémentaire.
    for (const z of zones) for (const s of z.slots) if (['suspension', 'miroir'].includes(s.usage)) s.couche = 'finition';
    if (fonction === 'salon') zones.find(z => z.id === 'repas')?.slots.filter(s => s.usage === 'suspension').forEach(s => { s.obligatoire = true; s.priorite = 2; });
  }
  // Le modèle ajuste l'ordre des usages existants. Il ne peut pas contourner les exclusions,
  // créer une zone arbitraire, ni injecter des positions dans le solveur.
  for (const z of zones) {
    const suggestion = Array.isArray(planVie) && planVie.find(p => p.type === z.id);
    if (!z.demandee && suggestion && Number.isFinite(suggestion.priorite)) {
      z.priorite = Math.max(1, Math.min(5, Math.round(suggestion.priorite)));
      z.raison = String(suggestion.raison || '').slice(0, 180);
      z.slots.forEach(s => { s.priorite = z.priorite + (s.obligatoire ? 0 : 2); });
    }
  }
  const focalUsage = { salon: sansTV ? 'tableau-principal' : 'television', chambre: 'lit', salle_a_manger: 'table-repas', bureau: 'bureau', entree: 'miroir', terrasse: 'salon-exterieur', salle_de_bain: 'vasque' }[fonction];
  const politique = parSurface ? politiqueSurface(fonction, surface, zones, !!explicites) : null;
  for (const z of zones) if (politique) z.surfaceMax = politique.referencesZones[z.type] || 16;
  if (parSurface) for (const s of zones.flatMap(z => z.slots)) {
    if (s.usage === 'canape') { s.largeurCible = surface < 14 ? 1.8 : surface <= 20 ? 2.1 : surface <= 40 ? 2.4 : surface <= 75 ? 2.8 : 3.2; s.largeurMax = surface < 14 ? 2.1 : surface <= 20 ? 2.6 : 3.8; }
    if (s.usage === 'table-basse' && surface > 20) s.largeurCible = surface <= 40 ? 1.1 : 1.4;
    if (s.usage === 'tapis') s.largeurCible = surface > 40 ? 2.5 : 1.8;
  }
  return enrichirProgramme({ version: parSurface ? 'zones-surface-3' : fini ? 'zones-hauteur-2' : 'zones-1', fonction, surface: Math.round(surface * 100) / 100, zones, avertissements,
    ...(deco ? { staging:true } : {}),
    ...(politique ? { compositionSurface: politique } : {}),
    ...(fini ? { focal: { usage: focalUsage, sansTV }, details: { muraux: fonction === 'terrasse' ? [0, 0] : ['salon', 'chambre', 'bureau'].includes(fonction) ? [2, 4] : [1, 2] } } : {}) },encyclopedie,envies,profilUsage);
}

export function correspondSlot(p, usage, fonction) {
  if (!p?.dim?.every(d => Number.isFinite(d) && d > 0)) return false;
  if (p.generique && !p.usagesGeneriques?.includes(usage)) return false;
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
    case 'television': return ['tv', 'tv-murale'].includes(fam);
    case 'tableau-principal': case 'tableau-secondaire': return fam === 'tableau';
    case 'etagere-murale': return fam === 'etagere-murale';
    case 'eclairage-accueil': return ['applique', 'lampe'].includes(fam);
    case 'buffet': return ['meuble', 'buffet', 'commode'].includes(fam) && h <= 1.4;
    case 'console': return ['meuble', 'console'].includes(fam) && d <= .4;
    case 'etagere': return ['bibliotheque', 'etagere', 'meuble'].includes(fam);
    case 'vaisselier': return fam === 'vaisselier' || /vaisselier/.test(nom);
    case 'lampe-chevet': case 'lampe-bureau': return fam === 'lampe';
    case 'lumiere-salon': case 'lumiere-lecture': return ['lampadaire', 'applique', 'lampe'].includes(fam);
    case 'suspension': return ['suspension', 'lustre'].includes(fam);
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
    && (slot.usage !== 'television' || (slot.pose !== 'mur' || p.fam === 'tv-murale') && (slot.pose !== 'meuble' || p.fam === 'tv'))
    && (!slot.largeurMax || p.dim[0] <= slot.largeurMax + .01) && (!slot.largeurMin || p.dim[0] >= slot.largeurMin - .01)
    && (slot.usage !== 'lit' || typeof slot.chevetsIntegres !== 'boolean' || !!p.chevets === slot.chevetsIntegres);
}

export const slotRepetable = m => ['chaise-repas', 'chaise-bureau', 'fauteuil-salon', 'fauteuil-lecture', 'chevet', 'lampe-chevet',
  'lumiere-salon', 'lumiere-lecture', 'lampe-bureau', 'eclairage-accueil', 'suspension', 'transat', 'tableau-secondaire'].includes(m.programme?.usage);

export function composerProduits(programme, proposition, catalogue, candidats, gardes = [], opts = {}) {
  if (!programme) return { meubles: proposition.meubles || [], manquants: [] };
  const pool = (candidats ? Object.values(candidats).flat() : Object.values(catalogue)).filter(p => (!opts.budget || p.prix > 0)&&!(programme.encyclopedie&&p.generique&&['tv','tv-murale'].includes(p.fam)));
  const proposes = (proposition.meubles || []).filter(m => catalogue[m.produit]&&!(programme.encyclopedie&&catalogue[m.produit].generique&&['tv','tv-murale'].includes(catalogue[m.produit].fam)));
  const utilises = new Set(), couverts = new Set(), manquants = [], meubles = [], gardesCouverts = [], skus = new Set(), lits = new Map();
  const inventaire = gardes.filter(it => it.garde !== false).map(it => ({ it, p: it.sku ? catalogue[it.sku] : it.p }));
  for (const z of [...programme.zones].sort((a, b) => a.priorite - b.priorite)) for (const original of z.slots) {
    const slot = { ...original, fonction: programme.fonction, ...(original.usage === 'table-repas' ? { placesRepas: z.slots.filter(s => s.usage === 'chaise-repas').length } : {}) };
    if (slot.usage === 'tableau-principal') {
      const principal = meubles.find(m => m.programme.zone === z.id && ['canape', 'lit', 'bureau'].includes(m.programme.usage));
      const p = principal ? catalogue[principal.produit] : inventaire.find(e => ['canape', 'lit', 'bureau'].includes(e.p?.fam))?.p;
      if (p) { slot.largeurMin = p.dim[0] * (programme.encyclopedie?2/3:.5); slot.largeurMax = p.dim[0] * (programme.encyclopedie ? .75 : 2/3); }
    }
    if (slot.usage === 'television' && slot.pose !== 'mur') {
      const support = meubles.find(m => m.programme.zone === z.id && m.programme.usage === 'meuble-tv');
      const p = support ? catalogue[support.produit] : inventaire.find(e => correspondSlot(e.p, 'meuble-tv', programme.fonction))?.p;
      if (p) { slot.largeurMax = p.dim[0]; slot.largeurMin = Math.min(.73, p.dim[0] * .65); }
    }
    const lit = lits.get(z.id);
    if ((slot.usage === 'chevet' && lit?.chevets) || (slot.usage === 'lampe-chevet' && lit?.look?.liseuses)) continue;
    const gardee = inventaire.find(e => !couverts.has(e.it.id) && correspondEmplacement(e.p, slot));
    if (gardee) { couverts.add(gardee.it.id); gardesCouverts.push({ id: gardee.it.id, slot: slot.id }); if (slot.usage === 'lit') lits.set(z.id, gardee.p); continue; }
    const suggeres = proposes.filter((m, i) => !utilises.has(i) && correspondEmplacement(catalogue[m.produit], slot));
    const adaptes = pool.filter(p => correspondEmplacement(p, slot)).sort((a, b) =>
      Number(skus.has(a.id) && !slotRepetable({ programme: slot })) - Number(skus.has(b.id) && !slotRepetable({ programme: slot }))
      || (slot.usage === 'lumiere-salon' ? Number(a.fam === 'lampe') - Number(b.fam === 'lampe') : 0)
      || (slot.usage === 'television' ? Number(a.fam === 'tv-murale') - Number(b.fam === 'tv-murale') : 0)
      // Le patron salon vise environ 2,55 m ; une taille connue adaptée passe avant la taille minimale.
      || (slot.usage === 'television' ? Number(a.diagonaleEcran > 0 && (2.55 / a.diagonaleEcran < 1.5 || 2.55 / a.diagonaleEcran > 3))
        - Number(b.diagonaleEcran > 0 && (2.55 / b.diagonaleEcran < 1.5 || 2.55 / b.diagonaleEcran > 3)) : 0)
      || Number(!!a.generique) - Number(!!b.generique)
      || (slot.largeurCible ? Math.abs(a.dim[0] - slot.largeurCible) - Math.abs(b.dim[0] - slot.largeurCible) : 0)
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
