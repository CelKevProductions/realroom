import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUITS } from '../../lib/catalogue.js';
import { choisirCandidats } from '../../lib/selection.js';
import { correspondEmplacement, composerProduits, programmeComposition } from '../../lib/programme.js';
import { appliquerProposition, preparerAmenagement } from '../../lib/amenagement.js';
import { verifier } from '../../lib/agencement.js';
import { verifierHauteurs } from '../../lib/hauteurs.js';
import { choisirParEmplacement } from '../../lib/budget.js';
import { salonConcave } from '../fixtures/salons-catalogue.js';

test('catalogue réel : huit places restent disponibles sans style et avec une simple palette', () => {
  const modele = salonConcave(), original = structuredClone(modele);
  for (const envies of ['', 'terracotta cognac', 'épuré', 'Salon chaleureux']) {
    const choix = { espaces: ['repas', 'lecture', 'travail', 'rangement'], placesRepas: 8, budget: 0, envies };
    const candidats = choisirCandidats(PRODUITS, { modele, fonction: 'salon', ...choix });
    assert.ok(Object.values(candidats).every(ps => ps.length <= 10));
    const table = { usage: 'table-repas', fonction: 'salon', placesRepas: 8 };
    assert.ok(candidats.table.some(p => correspondEmplacement(p, table)), envies);
    assert.ok(candidats.table.some(p => p.id === 'rr-gen-repas-210'), 'alternative compacte à huit places disponible');
    const programme = programmeComposition({ modele, fonction: 'salon', ...choix });
    const r = composerProduits(programme, { meubles: [] }, PRODUITS, candidats, [], choix);
    assert.deepEqual(r.manquants.filter(s => s.obligatoire), []);
    assert.equal(r.meubles.filter(m => m.programme.usage === 'chaise-repas').length, 8);
  }
  assert.deepEqual(modele, original);
});

test('deux zones peuvent utiliser le même lampadaire, avec ou sans plafond de budget', () => {
  const p = Object.values(PRODUITS).find(p => p.fam === 'lampadaire' && !p.generique);
  const proposes = ['salon', 'lecture'].map(zone => ({ produit: p.id, programme: {
    id: `${zone}:lumiere:1`, fonction: 'salon', zone, usage: `lumiere-${zone}`, obligatoire: true, priorite: 1 } }));
  for (const budget of [null, p.prix * 2]) {
    const r = choisirParEmplacement(proposes, PRODUITS, budget, [], { candidats: { lampadaire: [p] } });
    assert.equal(r.retenus.length, 2);
    assert.equal(r.diagnostic.cout, p.prix * 2);
  }
});

test('séjour en L sans plafond : repas à huit et quatre activités placées avec le catalogue réel', () => {
  const modele = salonConcave(), original = structuredClone(modele);
  const prep = preparerAmenagement([], { espaces: ['repas', 'lecture', 'travail', 'rangement'], placesRepas: 8 });
  const candidats = choisirCandidats(PRODUITS, { modele, fonction: 'salon', ...prep });
  const p = Object.values(PRODUITS).find(p => p.fam === 'lampadaire' && !p.generique);
  const r = appliquerProposition({ modele, fonction: 'salon', prep, produits: PRODUITS, candidats,
    proposition: { meubles: ['salon', 'lecture'].map(zone => ({ produit: p.id, zone })) } });
  assert.equal(r.agencement.filter(it => it.usageProgramme === 'table-repas').length, 1);
  assert.equal(r.agencement.filter(it => it.usageProgramme === 'chaise-repas').length, 8);
  assert.equal(r.agencement.filter(it => it.sku === p.id).length, 2);
  assert.equal(r.proposition.densite.zonesVie, 4);
  assert.ok(r.agencement.length >= 20);
  assert.deepEqual(r.proposition.programme.manquants.filter(s => s.obligatoire), []);
  assert.ok(!r.proposition.programme.manquants.some(s => s.motif === 'budget'));
  assert.equal(r.proposition.planZones.audit.valide, true);
  assert.equal(r.proposition.planZones.audit.circulation.largeur, 1.1);
  assert.deepEqual(verifier(modele, r.agencement, PRODUITS), []);
  assert.deepEqual(verifierHauteurs(modele, r.agencement, PRODUITS), []);
  assert.deepEqual(modele, original);
});

test('un coin repas décoché n’est pas ajouté pour remplir la pièce', () => {
  const modele = salonConcave();
  const p = programmeComposition({ modele, fonction: 'salon', espaces: [] });
  assert.deepEqual(p.zones.map(z => z.id), ['salon']);
  const candidats = choisirCandidats(PRODUITS, { modele, fonction: 'salon', espaces: [] });
  const r = composerProduits(p, { meubles: [] }, PRODUITS, candidats);
  assert.ok(!r.meubles.some(m => ['table-repas', 'chaise-repas'].includes(m.programme.usage)));
});
