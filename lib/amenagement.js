// Étapes pures d'une analyse et d'un aménagement : du résultat de Claude (ou de la simulation) à
// l'agencement enregistré. Sans base ni réseau : servent aux routes d'API et à la démo sans compte.
import { depuisAnalyse } from './piece.js';
import { resoudre, verifier } from './agencement.js';
import { optimiserAmenagement } from './confort.js';
import { tientAvecUsage } from './selection.js';
import { respecteStyle } from './styles.js';
import { estInstallation, usageDe, abandonExplicite } from './usages.js';
import { preferencesDe } from './references.js';
import { choisirParEmplacement } from './budget.js';
import { amorcerDisposition } from './composition.js';
import { moteurGuideActif } from './moteur-guide.js';
import { programmeComposition, composerProduits, slotRepetable } from './programme.js';
import { planifierZones, verifierPlanZones } from './zonage.js';
import { intituleUsage } from './programme-textes.js';

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
  const budget = Math.max(0, Math.min(1e6, Math.round((+b.budget || 0)*100)/100));
  // en « tout », on repart des meubles relevés sur les photos ; en « partiel », de la pièce telle qu'elle est
  const base = mode === 'tout' ? actuels.filter(it => it.origine === 'existant' || garder.includes(it.id)).map(it => ({ ...it, garde: true })) : actuels.filter(it => it.garde !== false);
  return { mode, ids, garder, aRemplacer, envies, budget, base, moteurGuide: b.moteurGuide !== false, langue: b.langue === 'en' ? 'en' : 'fr' };
}

// proposition (Claude ou simulation) -> agencement final (solveur) et résumé à afficher
export function appliquerProposition({ modele, prep, proposition, produits, candidats, fonction }) {
  const { mode, ids, garder, aRemplacer, envies, budget, base, langue = 'fr' } = prep;
  const preferences = preferencesDe(envies, proposition.inspiration);
  const styleBrief = `${envies} ${preferences.styles.join(' ')}`;
  const retirer = new Set((proposition.retirer || []).filter(x => ids.has(x) && !garder.includes(x) && !base.some(it => it.id === x && estInstallation(it))));
  if (mode === 'partiel') { for (const x of [...retirer]) if (!aRemplacer.includes(x)) retirer.delete(x); aRemplacer.forEach(x => retirer.add(x)); }
  let items = base.map(it => (retirer.has(it.id) ? { ...it, garde: false } : { ...it, fixe: true }));
  const programme = mode === 'tout' && moteurGuideActif(prep.moteurGuide) ? programmeComposition({ modele, fonction, envies, planVie: proposition.planVie, langue }) : null;
  const compo = composerProduits(programme, proposition, produits, candidats, items, { budget, envies, preferences, langue });
  proposition = { ...proposition, meubles: compo.meubles };
  // Le budget couvre le mobilier catalogue encore présent dans la sélection, quantités comprises.
  let depense = items.filter(it => it.garde !== false && it.origine === 'catalogue').reduce((s, it) => s + Math.max(0, produits[it.sku]?.prix || 0), 0);
  const coutGardes = depense;
  const gardesSurDevis = budget && items.some(it => it.garde !== false && it.origine === 'catalogue' && !(produits[it.sku]?.prix > 0));
  let budgetEcarte = false, prixInconnu = false;
  const repetables = new Set(['chaise', 'tabouret', 'applique', 'suspension', 'lustre']);
  // Un lit conservé ne justifie pas un deuxième achat ; les assises et rangements restent répétables.
  // Autoriser l'exception seulement sur une demande explicite d'ajout, pas « lit double » ou « garder deux lits ».
  const litSupplementaire = envies.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[.;\n]/).some(phrase =>
    !/\b(?:pas|jamais|not|never|without|sans|no)\b/.test(phrase)
    && /\b(?:ajout\w*|rajout\w*|add\w*)\b.{0,60}\b(?:deuxieme|second|autre|supplementaire|another|additional)\s+(?:lit|bed)\b/.test(phrase));
  if (litSupplementaire) repetables.add('lit');
  const couchageConserve = items.some(it => it.garde !== false && usageDe(it.sku ? produits[it.sku] : it.p) === 'couchage');
  let litRedondant = false;
  let litPropose = false;
  const deja = new Set(items.filter(it => it.garde !== false).map(it => it.sku).filter(Boolean));
  const autorises = candidats ? new Set(Object.values(candidats).flat().map(p => p.id)) : null;
  // On conserve d'abord les fonctions essentielles, avant les pièces décoratives.
  const priorite = p => ['lit', 'canape', 'bureau', 'armoire', 'dressing'].includes(p.fam) ? 0
    : ['table', 'chaise', 'meuble', 'buffet', 'commode'].includes(p.fam) ? 1 : 2;
  const ecartes = (proposition.meubles || []).filter(m => produits[m.produit] && ((autorises && !autorises.has(m.produit)) || !tientAvecUsage(produits[m.produit], modele.dims) || !respecteStyle(produits[m.produit], styleBrief)));
  const retenus = (proposition.meubles || []).filter(m => produits[m.produit] && (!autorises || autorises.has(m.produit)) && tientAvecUsage(produits[m.produit], modele.dims) && respecteStyle(produits[m.produit], styleBrief))
    .sort((a, b) => priorite(produits[a.produit]) - priorite(produits[b.produit])).filter(m => {
      const p = produits[m.produit];
      if (p.fam === 'lit' && (couchageConserve || litPropose) && !litSupplementaire) { litRedondant = true; return false; }
      if (deja.has(m.produit) && !repetables.has(p.fam) && usageDe(p) !== 'chevet' && !slotRepetable(m)) return false;
      if (budget && !(p.prix > 0 && Number.isFinite(p.prix))) prixInconnu = true;
      if (p.fam === 'lit') litPropose = true;
      deja.add(m.produit);
      return true;
    }).slice(0, 80);
  const eligibles = candidats ? Object.fromEntries(Object.entries(candidats).map(([fam, ps]) => [fam, ps.filter(p => tientAvecUsage(p, modele.dims) && respecteStyle(p, styleBrief))])) : undefined;
  const selectionBudget = choisirParEmplacement(retenus, produits, budget ? Math.max(0, budget - depense) : null,
    items.filter(it => it.garde !== false).map(it => it.sku ? produits[it.sku] : it.p).filter(Boolean),
    { candidats: eligibles, preferences, envies, langue, repetables });
  const selectionnes = selectionBudget.retenus;
  budgetEcarte = !!budget && selectionnes.length < retenus.length;
  const depart = amorcerDisposition(modele, selectionnes, items, produits, { preferences, envies, mode, langue, programme });
  const nouveaux = depart.items;
  // « Tout repenser » renouvelle le mobilier sans supprimer silencieusement le rangement ou la coiffeuse.
  // En l'absence de remplaçant adapté (ou s'il est rejeté par le solveur), on garde la fonction existante.
  const essentiels = new Set(['couchage', 'rangement', 'vetements', 'travail', 'television']);
  const restaures = new Set();
  function conserverFonctions(liste) {
    const presents = new Set(liste.filter(it => it.garde !== false).map(it => usageDe(it.sku ? produits[it.sku] : it.p)));
    const ajouts = [];
    for (const it of base) {
      const usage = usageDe(it.sku ? produits[it.sku] : it.p);
      if (retirer.has(it.id) && essentiels.has(usage) && !presents.has(usage) && !abandonExplicite(usage, envies)) {
        ajouts.push({ ...it, garde: true, fixe: true });
        restaures.add(it.id); presents.add(usage);
      }
    }
    return [...liste.filter(it => !ajouts.some(a => a.id === it.id)), ...ajouts];
  }
  items = conserverFonctions([...items, ...nouveaux]);
  const zonage = planifierZones(modele, items, produits, programme);
  let planZones = zonage.plan;
  items = zonage.items;
  if (programme && !planZones?.zones?.length) {
    const repli = amorcerDisposition(modele, selectionnes, items.filter(it => it.fixe || it.garde === false), produits, { preferences, envies, mode, langue });
    items = conserverFonctions([...items.filter(it => it.fixe || it.garde === false), ...repli.items]);
  }
  // Chercher une composition complète avant de déclarer un ajout impossible : le placement
  // séquentiel peut coincer une armoire pourtant logeable en déplaçant le groupe lit/chevets.
  if (moteurGuideActif(prep.moteurGuide) && verifier(modele, items, produits).length) {
    items = optimiserAmenagement(modele, items, produits, {langue,mode,envies,preferences,planZones}).items;
  }
  let { items: places, alertes } = resoudre(modele, items, produits, { planZones });
  for (let tour = 0; tour < essentiels.size; tour++) {
    const retablis = conserverFonctions(places);
    if (!retablis.some(it => it.garde !== false && !places.some(p => p.id === it.id && p.garde !== false))) break;
    const reprise = resoudre(modele, retablis, produits, { planZones });
    places = reprise.items; alertes.push(...reprise.alertes);
  }
  const { items: finaux, confort, recherche } = optimiserAmenagement(modele, places, produits, { langue, mode, envies, preferences, moteurGuide: prep.moteurGuide, planZones });
  const avis = alertes.map(a => langue === 'en' ? `Not enough room for ${produits[nouveaux.find(it => it.id === a.id)?.sku]?.nom || a.id}.` : a.texte);
  if (ecartes.length) avis.push(langue === 'en' ? 'Some pieces were left out because their size or appearance did not fit the brief.' : 'Certaines pièces ont été écartées car leur encombrement ou leur aspect ne convenait pas à la demande.');
  if (litRedondant) avis.push(couchageConserve
    ? langue === 'en' ? 'A bed is already kept: additional beds were left out. Explicitly ask to add another bed if needed.' : 'Un couchage est déjà conservé : les lits supplémentaires ont été écartés. Demandez explicitement un lit supplémentaire si nécessaire.'
    : langue === 'en' ? 'One bed was selected. Explicitly ask to add another bed if needed.' : 'Un seul couchage a été retenu. Demandez explicitement un lit supplémentaire si nécessaire.');
  if (restaures.size) {
    const noms = base.filter(it => restaures.has(it.id)).map(it => (it.sku ? produits[it.sku] : it.p)?.nom || it.id).join(', ');
    avis.push(langue === 'en' ? `Kept to preserve their use, with no suitable replacement retained: ${noms}.` : `Conservés pour préserver leur usage, faute de remplacement adapté retenu : ${noms}.`);
  }
  if (budgetEcarte) avis.push(langue === 'en' ? 'Some proposed pieces were left out to respect your budget.' : 'Certaines pièces proposées ont été écartées pour respecter votre budget.');
  if (selectionBudget.diagnostic.substitutions.length) avis.push(langue === 'en'
    ? 'Alternatives for the same uses were selected within your budget: ' + selectionBudget.diagnostic.substitutions.map(s => produits[s.retenu].nom).join(', ') + '.'
    : 'Des alternatives de même usage ont été choisies dans votre budget : ' + selectionBudget.diagnostic.substitutions.map(s => produits[s.retenu].nom).join(', ') + '.');
  if (prixInconnu) avis.push(langue === 'en' ? 'Pieces with an unconfirmed price were left out of the budget.' : 'Les pièces dont le prix est à confirmer ont été écartées du budget.');
  if (budget && coutGardes > budget) avis.push(langue === 'en' ? 'The pieces you kept already exceed your budget.' : 'Les pièces que vous conservez dépassent déjà votre budget.');
  if (gardesSurDevis) avis.push(langue === 'en' ? 'Confirm the price of the kept pieces quoted on request before validating the budget.' : 'Confirmez le prix des pièces conservées sur devis avant de valider le budget.');
  let bilanProgramme = null;
  if (programme) {
    const presents = new Set(finaux.filter(it => it.garde !== false).map(it => it.slotProgramme));
    for (const garde of compo.gardes || []) if (finaux.some(it => it.id === garde.id && it.garde !== false)) presents.add(garde.slot);
    const litFinal = finaux.filter(it => it.garde !== false).map(it => it.sku ? produits[it.sku] : it.p).find(p => p?.fam === 'lit');
    for (const s of programme.zones.flatMap(z => z.slots)) if ((s.usage === 'chevet' && litFinal?.chevets) || (s.usage === 'lampe-chevet' && litFinal?.look?.liseuses)) presents.add(s.id);
    const absents = programme.zones.flatMap(z => z.slots).filter(s => !presents.has(s.id)).map(s => ({ ...s, motif: compo.manquants.some(m => m.slot === s.id) ? 'catalogue' : selectionnes.some(m => m.programme?.id === s.id) ? 'surface-ou-acces' : 'budget' }));
    bilanProgramme = { ...programme, manquants: absents, retenus: finaux.filter(it => it.garde !== false && it.zoneId).length };
    const catalogueManquant = [...new Set(absents.filter(s => s.obligatoire && s.motif === 'catalogue').map(s => s.usage))];
    if (catalogueManquant.length) avis.push(langue === 'en' ? `Catalogue pieces still needed: ${catalogueManquant.map(u => intituleUsage(u, langue)).join(', ')}.` : `Ensembles à compléter : le catalogue ne contient pas encore de produit adapté pour ${catalogueManquant.map(u => intituleUsage(u, langue)).join(', ')}.`);
    if (absents.some(s => s.obligatoire && s.motif !== 'catalogue')) avis.push(langue === 'en' ? 'Some activity areas are incomplete under the available budget or space. Clearances have been preserved.' : 'Certains ensembles restent incomplets avec le budget ou l’espace disponible. Les dégagements sont préservés.');
    avis.push(...programme.avertissements, ...(planZones?.avertissements || []));
    if (planZones?.zones?.length) { planZones = { ...planZones, zones: planZones.zones.map(z => ({ ...z, meubles: finaux.filter(it => it.garde !== false && it.zoneId === z.id).map(it => it.id) })).filter(z => z.meubles.length) }; const audit = verifierPlanZones(modele, finaux, produits, planZones); planZones = { ...planZones, audit, chemins: audit.circulation?.chemins || [], statut: audit.valide ? 'compose' : 'a-verifier' }; }
  }
  return {
    agencement: finaux.map(({ fixe, ...it }) => it),
    proposition: {
      mode, envies, budget, garder, confort, preferences, recherche, selectionBudget: selectionBudget.diagnostic, placement: depart.diagnostic,
      ...(programme ? { programme: bilanProgramme, planZones } : {}),
      concept: String(proposition.concept || '').slice(0, 800),
      conseils: (proposition.conseils || []).slice(0, 4).map(s => String(s).slice(0, 300)),
      alertes: avis,
      date: new Date().toISOString()
    }
  };
}
