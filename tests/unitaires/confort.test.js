import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bilanConfort, optimiserAmenagement } from '../../lib/confort.js';
import { boite, porteurDe, resoudre, verifier } from '../../lib/agencement.js';
import { preparerAmenagement, appliquerProposition } from '../../lib/amenagement.js';

const modele = (largeur = 5, profondeur = 5) => ({ dims: { largeur, profondeur, hauteur: 2.6, estimees: true }, murs: {
  entree: { ouvertures: [{ type: 'porte', position: 0, largeur: .9, allege: 0 }] },
  fond: { ouvertures: [] }, gauche: { ouvertures: [] }, droite: { ouvertures: [] }
} });
const produit = (fam, dim, prix = 100) => ({ nom: fam, fam, dim, prix });
const cat = {
  sofa: produit('canape', [2.2, .9, .8], 1200), coffee: produit('table', [1.1, .6, .4], 450),
  wardrobe: produit('armoire', [1.4, .6, 2]), bed: produit('lit', [1.6, 2, 1]), chair: produit('fauteuil', [.8, .8, .85]),
  cabinet: produit('meuble', [1.4, .5, .65]), lamp: produit('lampe', [.2, .2, .3]),
  mural: produit('applique', [.2, .15, .3]), pendant: produit('suspension', [.4, .4, .4]),
  rug: produit('tapis', [2.6, 1.8, .02]), unknown: produit('table', [.6, .6, .5], 0)
};
const item = (id, sku, x, z, extra = {}) => ({ id, sku, x, z, rot: 0, origine: 'catalogue', ...extra });
const types = r => r.alertes.map(a => a.type);

test('le salon forme un ensemble accessible avec la table à portée du canapé', () => {
  const m = modele(6, 6), sofa = item('s', 'sofa', 0, -2.5, { fixe: true });
  const avant = [sofa, item('t', 'coffee', 1.6, .2), item('f', 'chair', -1.8, -.3)];
  const copie = structuredClone(avant);
  const r = optimiserAmenagement(m, avant, cat);
  const table = r.items.find(i => i.id === 't');
  assert.ok(Math.abs(table.x - sofa.x) < .2);
  const ecart = boite(table, cat.coffee.dim).z0 - boite(sofa, cat.sofa.dim).z1;
  assert.ok(ecart >= .35 && ecart <= .55, `écart ${ecart}`);
  assert.deepEqual(r.items.find(i => i.id === 's'), sofa);
  assert.deepEqual(verifier(m, r.items, cat), []);
  assert.deepEqual(avant, copie, 'aucune mutation des entrées');
  assert.deepEqual(optimiserAmenagement(m, avant, cat), r, 'résultat déterministe');
  assert.equal(r.confort.circulation, true);
});

test('un couloir coupé est détecté même si les deux portes sont dégagées', () => {
  const m = modele(4, 6);
  m.murs.fond.ouvertures = [{ type: 'passage', position: 0, largeur: 1 }];
  const barriere = [item('a', 'sofa', -.7, 0), item('b', 'chair', 1.3, 0)];
  assert.deepEqual(verifier(m, barriere, cat), [], 'ni chevauchement ni meuble devant la porte');
  assert.equal(bilanConfort(m, barriere, cat).circulation, false);
  const r = optimiserAmenagement(m, barriere, cat);
  assert.equal(r.confort.circulation, true);
  assert.deepEqual(verifier(m, r.items, cat), []);
});

test('le canapé reste orienté vers la télévision conservée', () => {
  const m = modele(6, 6), tv = { id: 'tv', x: 3, z: 0, rot: -Math.PI / 2, fixe: true, p: produit('tv-murale', [1.2, .1, .8]) };
  const r = optimiserAmenagement(m, [item('s', 'sofa', 0, -2.5, { rot: Math.PI }), tv], cat);
  const sofa = r.items.find(i => i.id === 's');
  const dx = tv.x - sofa.x, dz = tv.z - sofa.z;
  assert.ok((dx * Math.sin(sofa.rot) + dz * Math.cos(sofa.rot)) / Math.hypot(dx, dz) > .8);
  assert.deepEqual(r.items.find(i => i.id === 'tv'), tv);
  assert.deepEqual(verifier(m, r.items, cat), []);
});

test('le lit double retrouve deux côtés utilisables et le rangement son recul', () => {
  const m = modele(5, 6);
  const avant = [item('l', 'bed', -1.7, -2), item('a', 'wardrobe', 1.7, -1, { rot: -Math.PI / 2 }), item('f', 'chair', .8, -1)];
  assert.ok(types(bilanConfort(m, avant, cat)).includes('acces'));
  const r = optimiserAmenagement(m, avant, cat);
  assert.ok(!r.confort.alertes.some(a => a.type === 'acces' && a.ids.includes('l')));
  assert.ok(!r.confort.alertes.some(a => a.type === 'acces' && a.ids.includes('a')));
  assert.deepEqual(verifier(m, r.items, cat), []);
});

test('la lumière est préservée : meuble haut écarté, canapé bas accepté', () => {
  const m = modele();
  m.murs.fond.ouvertures = [{ type: 'fenetre', position: 0, largeur: 1.4, hauteur: 1.2, allege: .95 }];
  const haut = [item('a', 'wardrobe', 0, -2.2)];
  assert.ok(types(bilanConfort(m, haut, cat)).includes('fenetre'));
  assert.ok(!types(optimiserAmenagement(m, haut, cat).confort).includes('fenetre'));
  assert.ok(!types(bilanConfort(m, [item('s', 'sofa', 0, -2.05)], cat)).includes('fenetre'));
});

test('les meubles conservés, muraux et suspendus restent exactement en place', () => {
  const m = modele(), fixes = [
    item('a', 'mural', .1234, -2.48, { fixe: true, y: 1.4567, rot: .1234 }),
    item('b', 'pendant', 1.2345, 1.4567, { fixe: true, y: 2.1 }),
    item('s', 'sofa', -.1234, -2.0456, { fixe: true, rot: .015 })
  ];
  const r = optimiserAmenagement(m, resoudre(m, fixes, cat).items, cat);
  for (const it of fixes) assert.deepEqual(r.items.find(i => i.id === it.id), it);
  const verrou = item('w', 'wardrobe', 0, 0);
  assert.deepEqual(optimiserAmenagement(m, [verrou], cat, { garder: ['w'] }).items, [verrou]);
});

test('une lampe suit son support ; un objet fixé verrouille aussi son support', () => {
  const m = modele();
  m.murs.fond.ouvertures = [{ type: 'fenetre', position: 0, largeur: 1.4, allege: .2 }];
  const avant = [item('c', 'cabinet', 0, -2.24), item('l', 'lamp', .15, -2.2)];
  const r = optimiserAmenagement(m, avant, cat), lampe = r.items.find(i => i.id === 'l');
  const support = porteurDe(lampe, cat.lamp, r.items.map(it => ({ it, p: cat[it.sku] })));
  assert.equal(support?.it.id, 'c');
  assert.ok(!types(r.confort).includes('fenetre'));
  const fixes = [avant[0], { ...avant[1], fixe: true }];
  assert.deepEqual(optimiserAmenagement(m, fixes, cat).items, fixes);
});

test('sans porte reconnue, la circulation est à vérifier, pas certifiée', () => {
  const m = modele(); m.murs.entree.ouvertures = [];
  const r = bilanConfort(m, [item('s', 'sofa', 0, -2)], cat, 'en');
  assert.equal(r.circulation, null);
  assert.equal(r.mesuresEstimees, true);
});

test('un agencement impossible conserve les éléments imposés et expose les problèmes', () => {
  const m = modele(2.4, 3), fixes = [item('s', 'sofa', 0, .75, { fixe: true })];
  const r = optimiserAmenagement(m, fixes, cat);
  assert.deepEqual(r.items, fixes);
  assert.equal(r.confort.ouvertures, false);
  assert.ok(r.confort.alertes.length > 0);
});

test('le budget total écarte les ajouts superflus et les prix inconnus', () => {
  const m = modele(7, 7), prep = preparerAmenagement([], { budget: 1400, langue: 'en' });
  const r = appliquerProposition({ modele: m, prep, produits: cat, proposition: { meubles: [
    { produit: 'coffee', x: 0, p: 2.5 }, { produit: 'sofa', x: 0, p: 1 }, { produit: 'unknown', x: 2, p: 3 }
  ] } });
  assert.ok(r.agencement.some(i => i.sku === 'sofa'));
  assert.ok(!r.agencement.some(i => ['coffee', 'unknown'].includes(i.sku)));
  assert.ok(r.agencement.reduce((s, it) => s + cat[it.sku].prix, 0) <= 1400);
  assert.ok(r.proposition.alertes.some(s => s.includes('budget')));
  assert.ok(r.proposition.alertes.some(s => s.includes('unconfirmed')));
  assert.ok(r.proposition.confort);
});

test('garder gagne sur remplacer, même pour une pièce catalogue en mode tout', () => {
  const gardes = [item('s', 'sofa', 0, -2, { origine: 'existant' }), item('t', 'coffee', 0, -.8)];
  for (const mode of ['tout', 'partiel']) {
    const prep = preparerAmenagement(gardes, { mode, garder: ['s', 't'], aRemplacer: ['s', 't'], budget: 100 });
    assert.deepEqual(prep.aRemplacer, []);
    const r = appliquerProposition({ modele: modele(), prep, produits: cat, proposition: { retirer: ['s', 't'], meubles: [] } });
    for (const it of gardes) {
      const final = r.agencement.find(i => i.id === it.id);
      assert.equal(final.x, it.x); assert.equal(final.z, it.z); assert.notEqual(final.garde, false);
    }
    assert.ok(r.proposition.alertes.some(s => s.includes('dépassent déjà')));
  }
});
