import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimiserAmenagement } from '../../lib/confort.js';
import { boite, porteurDe, verifier } from '../../lib/agencement.js';
import { preparerAmenagement, appliquerProposition } from '../../lib/amenagement.js';

const modele = () => ({ dims: { largeur: 5, profondeur: 6, hauteur: 2.5 }, murs: {
  entree: { ouvertures: [{ type: 'porte', position: -1.6, largeur: .9, allege: 0 }] },
  fond: { ouvertures: [] }, gauche: { ouvertures: [] }, droite: { ouvertures: [] }
} });
const cat = { lit: { nom: 'Lit', fam: 'lit', dim: [1.4, 1.6, 1], prix: 900 },
  chevet: { nom: 'Table de chevet', fam: 'meuble', dim: [.4, .4, .5], prix: 100 },
  lampe: { nom: 'Lampe', fam: 'lampe', dim: [.2, .2, .4], prix: 60 } };
const items = () => [{ id: 'l', sku: 'lit', x: 0, z: 0, rot: 0 },
  { id: 'a', sku: 'chevet', x: -.96, z: -.55, rot: 0 }, { id: 'b', sku: 'chevet', x: .96, z: -.55, rot: 0 },
  { id: 'lum', sku: 'lampe', x: .96, z: -.55, rot: 0 }];

test('le lit central rejoint un mur ; ses deux chevets et sa lampe restent un ensemble', () => {
  const m = modele(), avant = items(), r = optimiserAmenagement(m, avant, cat);
  const l = r.items.find(i => i.id === 'l'), b = boite(l, cat.lit.dim);
  assert.ok(Math.min(Math.abs(b.x0 + 2.5), Math.abs(b.x1 - 2.5), Math.abs(b.z0 + 3), Math.abs(b.z1 - 3)) < .09);
  assert.deepEqual(verifier(m, r.items, cat), []);
  assert.equal(r.confort.acces, true);
  assert.equal(r.confort.circulation, true);
  const lampe = r.items.find(i => i.id === 'lum');
  assert.equal(porteurDe(lampe, cat.lampe, r.items.map(it => ({ it, p: cat[it.sku] })))?.it.id, 'b');
  assert.equal(r.items.length, avant.length);
  assert.deepEqual(avant, items());
});

test('les variantes sont réellement différentes, sans nouveau produit ni ouverture bloquée', () => {
  const m = modele(), r = optimiserAmenagement(m, items(), cat, { variantes: 3 });
  assert.equal(r.variantes.length, 3);
  assert.equal(new Set(r.variantes.map(v => v.items.find(it => it.id === 'l').rot)).size, 3);
  for (const v of r.variantes) {
    assert.deepEqual(v.items.map(i => i.sku), items().map(i => i.sku));
    assert.deepEqual(verifier(m, v.items, cat), []);
    assert.equal(v.confort.acces, true);
    assert.equal(v.confort.ouvertures, true);
  }
  assert.deepEqual(r, optimiserAmenagement(m, items(), cat, { variantes: 3 }), 'pas d’aléatoire ni d’apprentissage nécessaire');
});

test('une chambre déjà correcte peut proposer des alternatives de qualité comparable', () => {
  const m = modele(), optimise = optimiserAmenagement(m, items(), cat);
  const r = optimiserAmenagement(m, optimise.items, cat, { variantes: 3 });
  assert.ok(r.variantes.length >= 2);
  assert.deepEqual(r.items, optimise.items);
});

test('deux exemplaires du même chevet sont acceptés et comptés dans le budget', () => {
  const proposition = { meubles: [{ produit: 'lit', x: 0, p: 3 },
    { produit: 'chevet', x: -.96, p: 3.55 }, { produit: 'chevet', x: .96, p: 3.55 }] };
  const r = appliquerProposition({ modele: modele(), prep: preparerAmenagement([], { budget: 1100 }), proposition, produits: cat });
  assert.equal(r.agencement.filter(it => it.sku === 'chevet').length, 2);
  assert.equal(r.agencement.reduce((s, it) => s + cat[it.sku].prix, 0), 1100);
  const limite = appliquerProposition({ modele: modele(), prep: preparerAmenagement([], { budget: 1000 }), proposition, produits: cat });
  assert.equal(limite.agencement.filter(it => it.sku === 'chevet').length, 1);
});
