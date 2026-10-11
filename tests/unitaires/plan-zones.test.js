import { test } from 'node:test';
import assert from 'node:assert/strict';
import { programmeComposition, composerProduits, surfacePiece, TYPES_PROGRAMME, correspondSlot } from '../../lib/programme.js';
import { planifierZones, verifierPlanZones } from '../../lib/zonage.js';
import { verifier } from '../../lib/agencement.js';
import { catalogueZones, salonReference, compositionTest } from '../fixtures/plan-zones.js';
import { scenarioReference, catalogueReference, chambres, rectangle } from '../fixtures/bench-chambres.js';
import { salons } from '../fixtures/plan-zones.js';
import { appliquerProposition, preparerAmenagement } from '../../lib/amenagement.js';
import { circulationZones } from '../../lib/circulation-zones.js';
import { PRODUITS } from '../../lib/catalogue.js';


test('salon de référence : ensembles télé/repas, recul des chaises et chemins séparés', () => {
  const modele = salonReference(), r = compositionTest(modele, 'salon', 'Salon avec un coin repas');
  assert.deepEqual(r.plan.zones.map(z => z.type).sort(), ['repas', 'salon']);
  assert.equal(r.items.length, r.initiaux.length, JSON.stringify(r.plan));
  assert.deepEqual(verifier(modele, r.items, r.catalogue), []);
  const audit = verifierPlanZones(modele, r.items, r.catalogue, r.plan);
  assert.equal(audit.valide, true, JSON.stringify(audit));
  assert.ok(audit.circulation.chemins.every(c => c.largeur >= .8));
  const repas = r.plan.zones.find(z => z.id === 'repas'), salon = r.plan.zones.find(z => z.id === 'salon');
  assert.ok((repas.x0 + repas.x1) / 2 > (salon.x0 + salon.x1) / 2);
  const tv = r.items.find(it => it.usageProgramme === 'meuble-tv');
  assert.ok(Math.abs(Math.sin(tv.rot)) < .1, 'la télévision ne fait pas face à la fenêtre est');
});
test('chambre de référence : sommeil/rangement et chevets symétriques', () => {
  const { modele } = scenarioReference(), r = compositionTest(modele, 'chambre', '', catalogueReference);
  assert.ok(r.plan.zones.some(z => z.id === 'couchage')); assert.ok(r.plan.zones.some(z => z.id === 'rangement'));
  assert.equal(r.items.filter(it => it.usageProgramme === 'chevet').length, 2);
  assert.deepEqual(verifier(modele, r.items, r.catalogue), []);
  assert.equal(verifierPlanZones(modele, r.items, r.catalogue, r.plan).valide, true);
});
test('surface réelle concave, pas le rectangle englobant', () => {
  const modele = { dims: { largeur: 5, profondeur: 5, hauteur: 2.5 }, contour: [[-2.5,-2.5],[2.5,-2.5],[2.5,-.5],[-.5,-.5],[-.5,2.5],[-2.5,2.5]] };
  assert.equal(surfacePiece(modele), 16); assert.equal(programmeComposition({ modele, fonction: 'salon' }).surface, 16);
});
test('le pipeline complet conserve les onze achats et la circulation du salon', () => {
  const modele = salonReference(), prep = preparerAmenagement([], { envies: 'Salon avec repas', budget: 4000 });
  const r = appliquerProposition({ modele, prep, fonction: 'salon', proposition: { meubles: [], planVie: [{ type: 'repas', priorite: 1, raison: 'Recevoir' }] }, produits: catalogueZones });
  assert.equal(r.agencement.length, 11); assert.equal(r.agencement.filter(it => it.usageProgramme === 'chaise-repas').length, 4);
  assert.equal(r.proposition.planZones.audit.valide, true); assert.equal(r.proposition.confort.acces, true);
  assert.equal(r.proposition.confort.circulation, true); assert.ok(r.proposition.selectionBudget.cout <= 4000);
});
test('les sept programmes changent d’inventaire avec la vraie surface', () => {
  for (const fonction of TYPES_PROGRAMME) for (const aire of [4, 8, 14, 30]) {
    const modele = rectangle(Math.sqrt(aire), Math.sqrt(aire)), p = programmeComposition({ modele, fonction });
    assert.equal(p.fonction, fonction); assert.ok(p.zones.length); assert.ok(p.zones.every(z => z.slots.length));
    const r = composerProduits(p, { meubles: [] }, catalogueZones, null);
    assert.ok(r.meubles.every(m => catalogueZones[m.produit] && correspondSlot(catalogueZones[m.produit], m.programme.usage, fonction)));
    if (fonction === 'salle_de_bain') { assert.ok(p.avertissements.some(a => /évacuation/.test(a))); assert.equal(p.zones[0].slots[0].usage, aire < 10 ? 'baignoire-murale' : 'baignoire-ilot'); }
    if (fonction === 'entree' && aire < 5.5) assert.equal(p.zones.length, 1);
    if (fonction === 'salle_a_manger') assert.equal(p.zones[0].slots.filter(s => s.usage === 'chaise-repas').length, aire < 12 ? 4 : aire <= 18 ? 6 : 8);
  }
});
test('les chevets intégrés ne sont pas rachetés et une alternative ne change pas ce contrat', () => {
  const catalogue = { ...catalogueZones, lit: { ...catalogueZones.lit, chevets: true } };
  const p = programmeComposition({ modele: rectangle(4, 4), fonction: 'chambre' }), r = composerProduits(p, { meubles: [{ produit: 'lit', zone: 'couchage' }] }, catalogue, null);
  assert.equal(r.meubles.filter(m => m.programme.usage === 'chevet').length, 0);
  const lit = r.meubles.find(m => m.programme.usage === 'lit'); assert.equal(lit.programme.chevetsIntegres, true);
});
test('le budget reste prioritaire même si la composition de base n’est pas finançable', () => {
  const modele = salonReference(), r = appliquerProposition({ modele, fonction: 'salon', prep: preparerAmenagement([], { budget: 250, envies: 'Avec un repas' }), proposition: { meubles: [] }, produits: catalogueZones });
  assert.ok(r.agencement.reduce((s, it) => s + catalogueZones[it.sku].prix, 0) <= 250);
  assert.ok(r.proposition.programme.manquants.some(s => s.obligatoire));
  assert.ok(r.proposition.alertes.some(a => /budget|incomplets/.test(a)));
});
test('sans chaise catalogue, ni fauteuil de salon ni ensemble aux cotes incomplètes ne sont inventés', () => {
  const modele = rectangle(6, 6), p = programmeComposition({ modele, fonction: 'salon' });
  const boutique=Object.fromEntries(Object.entries(PRODUITS).filter(([,p])=>!p.generique));
  const r = composerProduits(p, { meubles: [] }, boutique, null);
  assert.ok(r.manquants.some(s => s.usage === 'chaise-repas'));
  assert.equal(r.meubles.filter(m => m.programme.usage === 'chaise-repas').length, 0);
  const ensemble = PRODUITS['table-ronde-chaises-graphite-collection-dining-contemporaine'];
  for (const usage of ['table-repas', 'chevet', 'table-appoint']) assert.equal(correspondSlot(ensemble, usage, 'salon'), false);
});
test('les exclusions du client gagnent sur le plan du modèle, qui ne fournit aucune position', () => {
  const modele = rectangle(6, 6), p = programmeComposition({ modele, fonction: 'salon', envies: 'Sans coin repas, sans lecture', planVie: [{ type: 'repas', priorite: 1, x: 200 }, { type: 'lecture', priorite: 1 }] });
  assert.ok(!p.zones.some(z => ['repas', 'lecture'].includes(z.type))); assert.ok(p.zones.every(z => !('x' in z)));
});
test('un mobilier conservé avec une ancienne zone reste exactement en place', () => {
  const modele = rectangle(5, 5), actuel = { id: 'garde', origine: 'catalogue', sku: 'buffet', x: 2.25, z: 0, rot: -Math.PI / 2, zoneId: 'obsolete' };
  const prep = preparerAmenagement([actuel], { garder: ['garde'], budget: 5000 });
  const r = appliquerProposition({ modele, fonction: 'salon', prep, proposition: { meubles: [] }, produits: catalogueZones });
  const garde = r.agencement.find(it => it.id === 'garde'); assert.ok(garde); assert.equal(garde.x, actuel.x); assert.equal(garde.z, actuel.z); assert.equal(garde.rot, actuel.rot);
});
test('le contrôle précis accepte 92 cm de passage et refuse 86 cm sans réduire la cible de 90 cm', () => {
  const modele = rectangle(4, 4), portes = [{ x0: -.45, x1: .45, z0: 1.1, z1: 2 }, { x0: -.45, x1: .45, z0: -2, z1: -1.1 }];
  const obstacles = largeur => [
    { it: { id: 'a', x: -1.25, z: 0, rot: 0 }, p: { dim: [1.5, 2, 1] }, role: 'autre', b: { x0: -2, x1: -largeur / 2, z0: -1, z1: 1 } },
    { it: { id: 'b', x: 1.25, z: 0, rot: 0 }, p: { dim: [1.5, 2, 1] }, role: 'autre', b: { x0: largeur / 2, x1: 2, z0: -1, z1: 1 } }
  ];
  assert.equal(circulationZones(modele, obstacles(.92), portes).portesBloquees, 0);
  assert.ok(circulationZones(modele, obstacles(.86), portes).portesBloquees > 0);
});
test('dix chambres et treize salons : aucune composition non validée n’est annoncée réussie', () => {
  for (const [fonction, scenarios] of [['chambre', chambres()], ['salon', salons()]]) for (const s of scenarios) {
    const r = compositionTest(s.modele, fonction, s.envies || ''), audit = verifierPlanZones(s.modele, r.items, r.catalogue, r.plan);
    assert.deepEqual(verifier(s.modele, r.items, r.catalogue), [], `${fonction} ${s.nom}`);
    if (r.plan.statut === 'compose') assert.equal(audit.valide, true, `${fonction} ${s.nom} ${audit.problemes}`);
    if (r.items.length < r.initiaux.length) assert.ok(r.plan.manquants.length || r.initiaux.some(it => it.obligatoireProgramme === false));
  }
});
