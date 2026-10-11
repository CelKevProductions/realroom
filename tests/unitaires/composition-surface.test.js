import test from 'node:test';
import assert from 'node:assert/strict';
import { programmeComposition, TYPES_PROGRAMME } from '../../lib/programme.js';
import { evaluerDensite, coherenceEchelle } from '../../lib/composition-surface.js';
import { appliquerProposition, preparerAmenagement } from '../../lib/amenagement.js';
import { verifier } from '../../lib/agencement.js';
import { verifierHauteurs } from '../../lib/hauteurs.js';
import { bilanConfort } from '../../lib/confort.js';
import { rectangle } from '../fixtures/bench-chambres.js';
import { catalogueZones } from '../fixtures/plan-zones.js';
import { OBJETS_GENERIQUES } from '../../lib/catalogue-generique.js';
import { normaliserPlaces, intentionsEspaces } from '../../lib/espaces.js';
import { demandeDemoIA, validerDemoIA } from '../../lib/demo-ia.js';
const catalogue = { ...catalogueZones, ...OBJETS_GENERIQUES };

test('10 / 18 / 30 / 90 m² : quantités croissantes, focal et zones réellement placées', () => {
  let objetsAvant = 0, slotsAvant = 0;
  for (const [L, P, zonesMin] of [[3.2, 3.125, 1], [4.5, 4, 1], [6, 5, 2], [10, 9, 3]]) {
    const modele = rectangle(L, P), r = appliquerProposition({ modele, fonction: 'salon', produits: catalogue,
      prep: preparerAmenagement([], { budget: 15000, envies: 'Salon chaleureux' }), proposition: { meubles: [] } });
    const p = r.proposition, slots = p.programme.zones.flatMap(z => z.slots).length;
    assert.ok(r.agencement.length > objetsAvant); assert.ok(slots > slotsAvant);
    assert.ok(p.densite.zonesVie >= zonesMin); assert.ok(p.finition.focal);
    assert.deepEqual(p.programme.manquants.filter(s => s.obligatoire), []);
    assert.ok(p.finition.regles.some(r => r.id === 'tv-face-canape' && r.points > 0));
    assert.equal(p.planZones.audit.valide, true); assert.deepEqual(verifier(modele, r.agencement, catalogue), []);
    assert.deepEqual(verifierHauteurs(modele, r.agencement, catalogue), []);
    if (L === 3.2) assert.ok(r.agencement.length <= 7);
    if (L === 6) {
      assert.ok(r.agencement.filter(it => it.usageProgramme === 'fauteuil-salon').length >= 2
        || ['fauteuil-lecture', 'table-appoint', 'lumiere-lecture'].every(usage => r.agencement.some(it => it.usageProgramme === usage)));
      assert.deepEqual(p.programme.manquants, []);
      const repas = p.planZones.zones.find(z => z.type === 'repas'), lecture = p.planZones.zones.find(z => z.type === 'lecture');
      const distance = Math.hypot(Math.max(repas.x0 - lecture.x1, lecture.x0 - repas.x1, 0), Math.max(repas.z0 - lecture.z1, lecture.z0 - repas.z1, 0));
      assert.ok(distance >= .79, 'lecture et repas restent deux ensembles distincts avec au moins 80 cm de séparation');
    }
    if (L === 10) { assert.ok(r.agencement.length >= 20); assert.equal(p.planZones.audit.circulation.largeur, 1.1); }
    objetsAvant = r.agencement.length; slotsAvant = slots;
  }
});
test('dix convives : le brief et le contrat démo conservent le nombre de places et le repli', () => {
  assert.equal(normaliserPlaces(10), 10); assert.equal(normaliserPlaces(12), undefined);
  assert.equal(intentionsEspaces('Une table pour 10 personnes').placesRepas, 10);
  const piece = { fonction: 'salon', modele: rectangle(10, 9), agencement: [], notes: '' };
  piece.modele.capture = { metrique: true };
  const b = demandeDemoIA(piece, { placesRepas: 10, compositionSurface: false }, 'fr');
  const valide = validerDemoIA(b, catalogue), c = valide.choix;
  assert.equal(valide.piece.modele.capture.metrique, true);
  assert.equal(c.placesRepas, 10); assert.equal(c.compositionSurface, false);
  delete b.piece.modele.dims.estimees;
  assert.equal(coherenceEchelle(validerDemoIA(b, catalogue).piece.modele).controleTerrain, false);
  const p = programmeComposition({ modele: piece.modele, fonction: piece.fonction, placesRepas: 10 });
  assert.equal(p.zones.find(z => z.id === 'repas').slots.filter(s => s.usage === 'chaise-repas').length, 10);
});
test('les sept usages ont des paliers et leurs points focaux, sans luminaires intérieurs sur la terrasse', () => {
  for (const fonction of TYPES_PROGRAMME) {
    const petite = programmeComposition({ modele: rectangle(2.5, 3.2), fonction });
    const grande = programmeComposition({ modele: rectangle(6, 5), fonction });
    assert.ok(grande.zones.flatMap(z => z.slots).length > petite.zones.flatMap(z => z.slots).length, fonction);
    assert.ok(grande.focal.usage); assert.ok(grande.zones.every(z => z.surfaceMax > 0));
    if (fonction === 'terrasse') assert.ok(!grande.zones.flatMap(z => z.slots).some(s => /lumiere|lampe|suspension/.test(s.usage)));
  }
});
test('les souhaits et refus arbitrent la seconde zone ; les choix explicites ne sont pas forcés', () => {
  const modele = rectangle(6, 5);
  for (const [envies, attendu] of [['Je reçois', 'repas'], ['Coin lecture', 'lecture'], ['Un bureau sans repas', 'travail']]) {
    const p = programmeComposition({ modele, fonction: 'salon', envies });
    assert.ok(p.zones.some(z => z.id === attendu));
    if (envies.includes('sans repas')) assert.ok(!p.zones.some(z => z.id === 'repas'));
  }
  const p = programmeComposition({ modele: rectangle(10, 9), fonction: 'salon', espaces: [] });
  assert.deepEqual(p.zones.map(z => z.id), ['salon']);
  const d = evaluerDensite(rectangle(10, 9), [], catalogue, p, { zones: [] });
  assert.ok(d.choixExplicites); assert.ok(d.aCompleter); assert.ok(d.regles.some(r => r.id === 'open-space-incomplet'));
});
test('densité : une grande pièce vide et une zone démesurée sont signalées, sans note géométrique falsifiée', () => {
  const modele = rectangle(10, 9), p = programmeComposition({ modele, fonction: 'salon' });
  const d = evaluerDensite(modele, [], catalogue, p, { zones: [{ id: 'salon', type: 'salon', x0: -4, x1: 4, z0: -4, z1: 4 }], circulation: { largeur: .9, valide: true } });
  assert.ok(d.regles.some(r => r.id === 'mobilier-insuffisant' && r.points === -90));
  assert.ok(d.regles.some(r => r.id === 'zone-unique' && r.points === -20));
  assert.ok(d.regles.some(r => r.id === 'open-space-incomplet' && r.points === -30));
  assert.ok(d.regles.some(r => r.id === 'circulation-open-space' && r.points === -15));
  assert.ok(d.regles.some(r => r.id === 'zone-demesuree' && r.points === -10));
  assert.ok(d.regles.some(r => r.id === 'zone-sans-attrait' && r.points === -10));
  assert.equal(d.regles.filter(r => r.id === 'mur-mort').length, 4);
  assert.deepEqual(verifier(modele, [], catalogue), []);
});
test('cohérence d’échelle : métrique ne signifie pas mesuré sur place ; aucune cote n’est rescalée', () => {
  const modele = rectangle(10, 9); modele.dims.estimees = true; modele.capture = { metrique: true };
  const copie = structuredClone(modele), d = coherenceEchelle(modele);
  assert.equal(d.surface, 90); assert.equal(d.metrique, true); assert.equal(d.aVerifier, true);
  assert.equal(d.controleTerrain, false); assert.deepEqual(modele, copie);
  modele.murs.entree.ouvertures[0].largeur = 3;
  assert.ok(coherenceEchelle(modele).indices.some(i => i.type === 'largeur-porte-inhabituelle'));
});
test('le siège du bureau appartient à son accès ; un autre obstacle reste interdit', () => {
  const modele = rectangle(8, 8), items = [
    { id: 'bureau', sku: 'bureau', x: -2, z: -3.7, rot: 0, zoneId: 'travail', usageProgramme: 'bureau' },
    { id: 'chaise', sku: 'chaise', x: -2, z: -3.04, rot: Math.PI, zoneId: 'travail', usageProgramme: 'chaise-bureau' }
  ];
  const bon = bilanConfort(modele, items, catalogue);
  assert.equal(bon.acces, true); assert.equal(bon.circulation, true);
  const mauvais = bilanConfort(modele, [...items, { id: 'obstacle', sku: 'buffet', x: -1.8, z: -2.7, rot: 0, zoneId: 'rangement' }], catalogue);
  assert.equal(mauvais.acces, false);
});
test('le repli de surface restaure le programme précédent et retire uniquement le diagnostic nouveau', () => {
  const modele = rectangle(10, 9), p = programmeComposition({ modele, fonction: 'salon', compositionSurface: false });
  assert.equal(p.compositionSurface, undefined);
  assert.ok(!p.zones.some(z => z.id === 'travail'));
  assert.equal(p.zones.find(z => z.id === 'repas').slots.filter(s => s.usage === 'chaise-repas').length, 6);
  assert.equal(evaluerDensite(modele, [], catalogue, p, { zones: [] }), null);
});
