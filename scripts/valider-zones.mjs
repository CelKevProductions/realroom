import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compositionTest, catalogueZones, salonReference, salons } from '../tests/fixtures/plan-zones.js';
import { chambres, rectangle, scenarioReference, catalogueReference } from '../tests/fixtures/bench-chambres.js';
import { TYPES_PROGRAMME, programmeComposition, composerProduits } from '../lib/programme.js';
import { verifierPlanZones } from '../lib/zonage.js';
import { verifier } from '../lib/agencement.js';
import { appliquerProposition, preparerAmenagement } from '../lib/amenagement.js';

const dossier = path.resolve('docs/plan-zones'); fs.mkdirSync(dossier, { recursive: true });
const simplifierChemin = chemin => ({ ...chemin, points: chemin.points.filter((p, i, ps) => !i || i === ps.length - 1 || Math.abs((p.x - ps[i-1].x) * (ps[i+1].z - p.z) - (p.z - ps[i-1].z) * (ps[i+1].x - p.x)) > .00001) });
const resumePlan = p => ({ statut: p.statut, zones: p.zones, chemins: (p.chemins || []).map(simplifierChemin), score: p.score, statistiques: p.statistiques, retraitsDensite: p.retraitsDensite || [], manquants: p.manquants || [], avertissements: p.avertissements || [] });
function mesurer(fonction, scenario) {
  const t = performance.now(), r = compositionTest(scenario.modele, fonction, scenario.envies || ''), audit = verifierPlanZones(scenario.modele, r.items, r.catalogue, r.plan);
  const presents = new Set(r.items.map(it => it.slotProgramme));
  const besoinsManquants = r.programme.zones.flatMap(z => z.slots).filter(s => s.obligatoire && !presents.has(s.id));
  const resultat = { nom: scenario.nom, fonction, surface: r.programme.surface, dureeMs: Math.round(performance.now() - t), demandes: r.initiaux.length, places: r.items.length,
    geometrieValide: !verifier(scenario.modele, r.items, r.catalogue).length, planValide: audit.valide, compositionComplete: audit.valide && !besoinsManquants.length,
    toutMobilierRetenu: audit.valide && r.items.length === r.initiaux.length, besoinsManquants, problemes: audit.problemes,
    modele: scenario.modele, plan: resumePlan(r.plan), agencement: r.items };
  console.log(`${fonction} · ${scenario.nom} : ${resultat.places}/${resultat.demandes}, plan ${audit.valide ? 'valide' : 'à vérifier'}, composition ${resultat.compositionComplete ? 'complète' : 'partielle'} · ${resultat.dureeMs} ms`);
  return resultat;
}
const casChambres = chambres().map(s => mesurer('chambre', s)), casSalons = salons().map(s => mesurer('salon', s));
const programmes = TYPES_PROGRAMME.flatMap(fonction => [4, 8, 14, 30].map(surface => {
  const modele = rectangle(Math.sqrt(surface), Math.sqrt(surface)), programme = programmeComposition({ modele, fonction });
  const r = composerProduits(programme, { meubles: [] }, catalogueZones, null);
  return { fonction, surface, zones: programme.zones.map(z => ({ type: z.type, priorite: z.priorite, besoins: z.slots.map(s => s.usage) })), avertissements: programme.avertissements, produits: r.meubles.map(m => ({ produit: m.produit, usage: m.programme.usage, zone: m.programme.zone })), manquants: r.manquants };
}));
const bilan = rs => ({ cas: rs.length, geometrieValide: rs.filter(r => r.geometrieValide).length, planValide: rs.filter(r => r.planValide).length,
  compositionComplete: rs.filter(r => r.compositionComplete).length, toutMobilierRetenu: rs.filter(r => r.toutMobilierRetenu).length });
const catChambre = Object.fromEntries(Object.entries(catalogueReference).map(([id, p]) => [id, { ...p, id }]));
const referenceChambre = appliquerProposition({ modele: scenarioReference().modele, fonction: 'chambre', prep: preparerAmenagement([], { budget: 3000 }), proposition: { meubles: [] }, produits: catChambre });
const referenceSalon = appliquerProposition({ modele: salonReference(), fonction: 'salon', prep: preparerAmenagement([], { budget: 4000, envies: 'Salon avec repas' }), proposition: { meubles: [] }, produits: catalogueZones });
const resultat = { version: 'zones-1', catalogue: 'synthétique, non commercial', mesures: 'exécution locale, sans appel IA payant', synthese: { chambres: bilan(casChambres), salons: bilan(casSalons), programmes: programmes.length },
  references: { chambre: { agencement: referenceChambre.agencement, audit: referenceChambre.proposition.planZones.audit.problemes }, salon: { agencement: referenceSalon.agencement, audit: referenceSalon.proposition.planZones.audit.problemes } }, chambres: casChambres, salons: casSalons, programmes };
fs.writeFileSync(path.join(dossier, 'resultats.json'), JSON.stringify(resultat, null, 2) + '\n');
fs.writeFileSync(path.join(dossier, 'apres.json'), JSON.stringify({ modele: salonReference(), catalogue: catalogueZones, items: referenceSalon.agencement, proposition: referenceSalon.proposition }, null, 2) + '\n');
if (process.env.BASELINE_ZONES) {
  const baseline = await import(pathToFileURL(path.resolve(process.env.BASELINE_ZONES, 'lib/amenagement.js')));
  const programme = programmeComposition({ modele: salonReference(), fonction: 'salon', envies: 'Salon avec repas' });
  const meubles = composerProduits(programme, { meubles: [] }, catalogueZones, null).meubles.map(({ programme, ...m }) => m);
  const avant = baseline.appliquerProposition({ modele: salonReference(), prep: baseline.preparerAmenagement([], { envies: 'Salon avec repas', budget: 4000 }), produits: catalogueZones, proposition: { meubles } });
  fs.writeFileSync(path.join(dossier, 'avant.json'), JSON.stringify({ version: '9099770', modele: salonReference(), catalogue: catalogueZones, items: avant.agencement, proposition: avant.proposition }, null, 2) + '\n');
}
console.log(JSON.stringify(resultat.synthese));
if (!referenceSalon.proposition.planZones.audit.valide || !referenceChambre.proposition.planZones.audit.valide) process.exitCode = 1;
