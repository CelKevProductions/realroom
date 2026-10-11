import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corrigerGeometrie, corrigerPiece, mesuresConfirmees } from '../../lib/geometrie.js';
import { depuisAnalyse } from '../../lib/piece.js';

const modele = () => ({ dims: { largeur: 4, profondeur: 5, hauteur: 2.5, estimees: true },
  murs: { fond: { couleur: '#AAAAAA', ouvertures: [{ type: 'fenetre', position: 1, largeur: 1.2, hauteur: 1.3, allege: .9 }] },
    entree: { observe: false, ouvertures: [] }, gauche: { ouvertures: [] }, droite: { ouvertures: [] } },
  vue: { x: 0, z: 2, cx: 0, cz: -1.5, y: 1.5 } });

test('une seule longueur confirmée laisse les autres axes estimés, même après une nouvelle analyse', () => {
  const m = corrigerGeometrie(modele(), { dims: { largeur: 3.5 } });
  assert.equal(m.dims.largeur, 3.5);
  assert.equal(m.dims.estimees, true);
  assert.deepEqual(m.dims.sources, { largeur: 'mesure', profondeur: 'photo', hauteur: 'photo' });
  assert.deepEqual(mesuresConfirmees(m), { largeur: 3.5, profondeur: null, hauteur: null });
  const suivant = depuisAnalyse({ dimensions: { largeur: 4, profondeur: 5, hauteur: 2.5 } }, mesuresConfirmees(m)).modele;
  assert.equal(suivant.dims.estimees, true);
  assert.equal(suivant.dims.sources.profondeur, 'photo');
  assert.equal(corrigerGeometrie(m, { dims: { profondeur: 4.2, hauteur: 2.6 } }).dims.estimees, false);
});

test('les ouvertures sont bornées dans les trois dimensions et seul le mur corrigé devient confirmé', () => {
  const m = corrigerGeometrie(modele(), { dims: { largeur: 3 }, murs: { gauche: { ouvertures: [
    { type: 'porte', position: -500, largeur: 80, hauteur: 90, allege: 20 },
    { type: 'fenetre', position: 500, largeur: .7, hauteur: 10, allege: 10 }, null
  ] } } });
  for (const o of m.murs.gauche.ouvertures) {
    assert.ok(o.position - o.largeur / 2 >= -2.5001 && o.position + o.largeur / 2 <= 2.5001);
    assert.ok(o.allege + o.hauteur <= 2.5001);
  }
  assert.equal(m.murs.gauche.ouvertures[0].allege, 0);
  assert.equal(m.murs.gauche.observe, true);
  assert.equal(m.murs.entree.observe, false);
  assert.deepEqual(m.murs.entree.ouvertures, []);
  assert.equal(m.murs.fond.couleur, '#AAAAAA');
});

test('rétrécir la pièce conserve les observations et les vraies tailles, la caméra suit la géométrie', () => {
  const original = modele();
  const items = [{ id: 'lit', origine: 'existant', x: 1, z: 1, rot: 0, p: { fam: 'lit', dim: [1.8, 2, 1] } },
    { id: 'c', origine: 'catalogue', sku: 'canape', x: -1, z: 0, rot: 0 }];
  const copie = structuredClone(items);
  const cat = { canape: { fam: 'canape', dim: [2, .9, .8] } };
  const r = corrigerPiece(original, items, { dims: { largeur: 2 }, meubles: [
    { id: 'lit', dim: [1.4, 1.6, 1] }, { id: 'c', dim: [.1, .1, .1] }
  ] }, cat);
  assert.equal(r.agencement.length, 2, 'un conflit reste visible, aucun meuble supprimé');
  assert.deepEqual(r.agencement[0].p.dim, [1.4, 1.6, 1]);
  assert.equal(r.agencement[0].p.dimsLues, true);
  assert.equal(r.agencement[0].x, .5);
  assert.equal(r.agencement[1].p, undefined);
  assert.deepEqual(cat.canape.dim, [2, .9, .8], 'un produit catalogue ne peut pas être redimensionné');
  assert.deepEqual(items, copie);
  assert.deepEqual(original, modele());
  assert.equal(r.modele.vue.y, 1.5);
});

test('la télévision reste sur son support quand la largeur de pièce change', () => {
  const items = [{ id: 'm', x: 1.4, z: 0, p: { fam: 'meuble', dim: [1.4, .5, .6] } },
    { id: 'tv', x: 1.5, z: .05, p: { fam: 'tv', dim: [1.1, .1, .7] } }];
  const r = corrigerPiece(modele(), items, { dims: { largeur: 3 } });
  assert.ok(Math.abs(r.agencement[1].x - r.agencement[0].x - .1) < 1e-8);
  assert.equal(r.agencement[1].z - r.agencement[0].z, .05);
});
