import test from 'node:test';
import assert from 'node:assert/strict';
import { initialiserBrief, demandeDepuisBrief, actualiserEnvies } from '../../lib/brief-reamenagement.js';
import { programmeComposition } from '../../lib/programme.js';
import { preparerAmenagement, appliquerProposition } from '../../lib/amenagement.js';
import { demandeDemoIA, validerDemoIA, ErreurDemoIA } from '../../lib/demo-ia.js';
import { manquesParEspace } from '../../lib/programme-textes.js';
import { verifier } from '../../lib/agencement.js';
import { verifierHauteurs } from '../../lib/hauteurs.js';
import { catalogueZones, salonReference } from '../fixtures/plan-zones.js';
import { rectangle } from '../fixtures/bench-chambres.js';
import { PRODUITS, candidats } from '../../lib/catalogue.js';

test('le dialogue reprend les envies et propose un repas dans un grand salon', () => {
  const piece = { fonction: 'salon', modele: rectangle(6, 6) };
  const b = initialiserBrief(piece, { envies: 'Bois clair', budget: 4200 });
  assert.ok(b.espaces.includes('repas')); assert.equal(b.placesRepas, 4); assert.equal(b.envies, 'Bois clair');
  assert.equal(b.budget, 4200);
  assert.deepEqual(initialiserBrief(piece, { envies: 'Sans coin repas', espaces: [], budget: 0 }).espaces, []);
  assert.ok(!initialiserBrief({ fonction: 'chambre', modele: piece.modele }, { envies: '' }).espaces.includes('repas'));
});

test('les nouvelles idées remplacent les anciennes et préservent mode et meubles gardés', () => {
  const piece = { fonction: 'salon', modele: salonReference() };
  const precedente = { mode: 'tout', envies: 'Sans repas. Style épuré.', budget: 800, garder: ['g1'], aRemplacer: [], langue: 'fr' };
  const demande = demandeDepuisBrief(piece, precedente, { envies: 'Table près de la fenêtre, bois clair.', espaces: ['repas', 'travail'], placesRepas: 4, budget: 3000 });
  assert.equal(demande.envies, 'Table près de la fenêtre, bois clair.'); assert.equal(demande.budget, 3000);
  assert.deepEqual(demande.garder, ['g1']); assert.equal(demande.mode, 'tout');
  const nouvellePiece = { ...piece, proposition: demande };
  assert.deepEqual(initialiserBrief(nouvellePiece, demande).espaces, ['repas', 'travail']);
  assert.deepEqual(precedente.garder, ['g1']); assert.equal(precedente.envies, 'Sans repas. Style épuré.');
});

test('table à manger, nombre de places et choix explicites gagnent sur les anciennes envies et l’IA', () => {
  const modele = rectangle(6, 6);
  const texte = programmeComposition({ modele, fonction: 'salon', envies: 'Une table à manger pour 6 personnes' });
  assert.equal(texte.zones.find(z => z.id === 'repas').slots.filter(s => s.usage === 'chaise-repas').length, 6);
  assert.equal(texte.zones.find(z => z.id === 'repas').demandee, true);
  const explicite = programmeComposition({ modele, fonction: 'salon', envies: 'Sans repas, avec lecture', espaces: ['repas', 'travail'], placesRepas: 4, planVie: [{ type: 'repas', priorite: 5 }] });
  const repas = explicite.zones.find(z => z.id === 'repas');
  assert.equal(repas.priorite, 1); assert.equal(repas.slots.filter(s => s.usage === 'chaise-repas').length, 4);
  assert.ok(!explicite.zones.some(z => z.id === 'lecture')); assert.ok(explicite.zones.some(z => z.id === 'travail'));
  const sans = programmeComposition({ modele, fonction: 'salon', envies: 'Avec un coin repas', espaces: [] });
  assert.deepEqual(sans.zones.map(z => z.id), ['salon']);
});

test('écrire une nouvelle idée coche son espace ; changer le style ne réactive pas une case décochée', () => {
  const options = ['repas', 'travail', 'lecture', 'rangement'];
  const b = { espaces: [], envies: 'Bois clair' };
  const repas = actualiserEnvies(b, 'Bois clair et une table à manger', options);
  assert.deepEqual(repas.espaces, ['repas']);
  const decoche = { ...repas, espaces: [] };
  assert.deepEqual(actualiserEnvies(decoche, repas.envies + ', des couleurs chaudes', options).espaces, []);
  assert.deepEqual(actualiserEnvies(repas, repas.envies + ', mais sans coin repas', options).espaces, []);
  assert.deepEqual(actualiserEnvies(b, 'Un coin bureau et un coin lecture', options).espaces, ['travail', 'lecture']);
  const six = actualiserEnvies(b, 'Une table à manger pour 6 personnes', options);
  assert.deepEqual(six.espaces, ['repas']); assert.equal(six.placesRepas, 6);
});

test('démo : les espaces et places sont transmis, les choix forgés sont refusés', () => {
  const piece = { fonction: 'salon', modele: salonReference(), agencement: [], notes: '' };
  const demande = demandeDemoIA(piece, { espaces: ['repas', 'lecture'], placesRepas: 6, budget: 5000 }, 'fr');
  const valide = validerDemoIA(demande, PRODUITS);
  assert.deepEqual(valide.choix.espaces, ['repas', 'lecture']); assert.equal(valide.choix.placesRepas, 6);
  assert.deepEqual(preparerAmenagement([], valide.choix).espaces, ['repas', 'lecture']);
  for (const choix of [{ espaces: ['cuisine-inventee'] }, { espaces: 'repas' }, { placesRepas: 300 }, { placesRepas: '6' }]) {
    assert.throws(() => validerDemoIA({ ...demande, choix: { ...demande.choix, ...choix } }, PRODUITS), ErreurDemoIA);
  }
});

test('le repas demandé reste complet sous un budget qui impose des choix', () => {
  const r = appliquerProposition({ modele: rectangle(6, 6), fonction: 'salon', produits: catalogueZones,
    prep: preparerAmenagement([], { espaces: ['repas'], placesRepas: 4, budget: 700 }), proposition: { meubles: [], planVie: [{ type: 'repas', priorite: 5 }] } });
  assert.equal(r.agencement.filter(it => it.usageProgramme === 'table-repas').length, 1);
  assert.equal(r.agencement.filter(it => it.usageProgramme === 'chaise-repas').length, 4);
  assert.ok(r.agencement.reduce((s, it) => s + catalogueZones[it.sku].prix, 0) <= 700);
  assert.ok(!r.proposition.programme.manquants.some(s => ['table-repas', 'chaise-repas'].includes(s.usage)));
});

test('une table trop encombrante est remplacée par une table compacte avant de supprimer le repas', () => {
  const grande = { ...catalogueZones.repas, id: 'grande', nom: 'Grande table', dim: [3.2, 1.7, .75], prix: 700 };
  const catalogue = { ...catalogueZones, grande };
  const r = appliquerProposition({ modele: salonReference(), fonction: 'salon', produits: catalogue,
    prep: preparerAmenagement([], { espaces: ['repas'], placesRepas: 4, budget: 5000 }),
    proposition: { meubles: [{ produit: 'grande', zone: 'repas' }] } });
  assert.equal(r.agencement.find(it => it.usageProgramme === 'table-repas')?.sku, 'repas');
  assert.equal(r.agencement.filter(it => it.usageProgramme === 'chaise-repas').length, 4);
  assert.ok(r.agencement.some(it => it.usageProgramme === 'canape'));
  assert.deepEqual(verifier(salonReference(), r.agencement, catalogue), []);
  assert.equal(r.proposition.planZones.audit.valide, true);
  assert.ok(r.proposition.planZones.alternativesCompactes.some(s => s.initial === 'grande' && s.retenu === 'repas'));
});

test('catalogue partagé : le grand salon reçoit table, six chaises et TV avec accès contrôlés', () => {
  const modele = rectangle(8, 6), envies = 'Salon chaleureux, table à manger pour 6 personnes';
  const r = appliquerProposition({ modele, fonction: 'salon', produits: PRODUITS,
    candidats: candidats({ dims: modele.dims, fonction: 'salon', envies, budget: 15000 }),
    prep: preparerAmenagement([], { espaces: ['repas', 'lecture'], placesRepas: 6, budget: 15000, envies }), proposition: { meubles: [] } });
  assert.equal(r.agencement.filter(it => it.usageProgramme === 'table-repas').length, 1);
  assert.equal(r.agencement.filter(it => it.usageProgramme === 'chaise-repas').length, 6);
  assert.ok(r.agencement.some(it => it.usageProgramme === 'television'));
  assert.deepEqual(verifier(modele, r.agencement, PRODUITS), []); assert.deepEqual(verifierHauteurs(modele, r.agencement, PRODUITS), []);
  assert.equal(r.proposition.planZones.audit.valide, true);
  assert.deepEqual(r.proposition.espaces, ['repas', 'lecture']); assert.equal(r.proposition.placesRepas, 6);
});

test('les espaces impossibles indiquent les pièces et leurs raisons exactes', () => {
  const r = appliquerProposition({ modele: rectangle(3, 3), fonction: 'salon', produits: catalogueZones,
    prep: preparerAmenagement([], { espaces: ['repas'], placesRepas: 8, budget: 100 }), proposition: { meubles: [] } });
  const repas = manquesParEspace(r.proposition.programme).find(z => z.zone === 'repas');
  assert.ok(repas); assert.match(repas.pieces, /table de repas/); assert.match(repas.raisons, /budget mobilier insuffisant/);
  assert.ok(r.agencement.reduce((s, it) => s + catalogueZones[it.sku].prix, 0) <= 100);
});
