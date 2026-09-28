import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudre, verifier, boite, placerAuMur, zonesPortes, angleDe } from '../../lib/agencement.js';

const piece = {
  dims: { largeur: 4, profondeur: 5, hauteur: 2.5 },
  murs: { entree: { ouvertures: [{ type: 'porte', position: -1.2, largeur: .9, hauteur: 2.1, allege: 0 }] }, fond: { ouvertures: [{ type: 'fenetre', position: 0, largeur: 1.4, hauteur: 1.3, allege: .9 }] }, gauche: {}, droite: {} }
};
const cat = {
  canape: { nom: 'Canapé', fam: 'canape', dim: [2.2, .95, .8] },
  fauteuil: { nom: 'Fauteuil', fam: 'fauteuil', dim: [.85, .85, .8] },
  lit: { nom: 'Lit', fam: 'lit', dim: [1.8, 2.1, 1.1] },
  geant: { nom: 'Géant', fam: 'canape', dim: [5.5, 1, .8] },
  tapis: { nom: 'Tapis', fam: 'tapis', dim: [2, 1.4, .01] },
  applique: { nom: 'Applique', fam: 'applique', dim: [.2, .15, .3] },
  meubletv: { nom: 'Meuble TV', fam: 'meuble', dim: [1.6, .42, .5] },
  tv: { nom: 'TV', fam: 'tv', dim: [1.25, .06, .72] },
  plante: { nom: 'Grande plante', fam: 'plante', dim: [.55, .55, 1.6] }
};
const sansChevauchement = (items) => {
  const sol = items.filter(i => i.garde !== false && !['tapis', 'applique'].includes(cat[i.sku].fam));
  for (let i = 0; i < sol.length; i++) for (let j = i + 1; j < sol.length; j++) {
    const a = boite(sol[i], cat[sol[i].sku].dim), b = boite(sol[j], cat[sol[j].sku].dim);
    const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
    if (dx > .001 && dz > .001) return false;
  }
  return true;
};

test('les meubles qui se chevauchent sont écartés et restent dans la pièce', () => {
  const { items, alertes } = resoudre(piece, [
    { id: 'a', sku: 'canape', x: 0, z: 0, rot: 0 },
    { id: 'b', sku: 'fauteuil', x: .3, z: .2, rot: 0 },
    { id: 't', sku: 'tapis', x: 0, z: 0, rot: 0 }
  ], cat);
  assert.equal(alertes.length, 0);
  assert.ok(sansChevauchement(items));
  for (const it of items) {
    const b = boite(it, cat[it.sku].dim);
    assert.ok(b.x0 >= -2.001 && b.x1 <= 2.001 && b.z0 >= -2.501 && b.z1 <= 2.501, it.id + ' hors de la pièce');
  }
});

test('un lit proche du mur du fond vient s’y adosser (tête au mur, face à l’entrée)', () => {
  const { items } = resoudre(piece, [{ id: 'l', sku: 'lit', x: 0, z: -1.2, rot: angleDe('entree') }], cat);
  const b = boite(items[0], cat.lit.dim);
  assert.ok(Math.abs(b.z0 + 2.49) < .02, 'tête de lit au mur : ' + b.z0);
});

test('la zone devant la porte reste libre', () => {
  const { items } = resoudre(piece, [{ id: 'f', sku: 'fauteuil', x: -1.2, z: 2.2, rot: 0 }], cat);
  const [z] = zonesPortes(piece);
  const b = boite(items[0], cat.fauteuil.dim);
  const dx = Math.min(b.x1, z.x1) - Math.max(b.x0, z.x0), dz = Math.min(b.z1, z.z1) - Math.max(b.z0, z.z0);
  assert.ok(!(dx > 0 && dz > 0), 'le fauteuil bloque la porte');
});

test('un meuble trop grand est retiré avec une alerte ; un existant gardé ne bouge pas', () => {
  const { items, alertes } = resoudre(piece, [
    { id: 'g', sku: 'geant', x: 0, z: 0, rot: 0 },
    { id: 'e', sku: 'fauteuil', x: 1, z: 1, rot: 0, fixe: true }
  ], cat);
  assert.equal(alertes[0].type, 'trop-grand');
  assert.deepEqual(items.map(i => i.id), ['e']);
  assert.equal(items[0].x, 1);
});

test('une applique se colle au mur le plus proche, tournée vers la pièce', () => {
  const it = placerAuMur(piece, { id: 'ap', x: 1.9, z: .3 }, cat.applique.dim);
  assert.equal(it.mur, 'droite');
  assert.equal(it.x, 2);
  assert.ok(Math.abs(it.rot + Math.PI / 2) < 1e-9);
});

test('une applique évite la fenêtre du mur où on la pose', () => {
  const it = placerAuMur(piece, { id: 'ap', x: 0, z: -2.4, y: 1.55 }, cat.applique.dim, 'fond');
  assert.equal(it.mur, 'fond');
  assert.ok(Math.abs(it.x) >= .7 + .1, 'applique sur la fenêtre : x = ' + it.x);
});

test('une télévision posée sur son meuble y reste, sans alerte', () => {
  const tv = { id: 't', sku: 'tv', x: 1.75, z: .2, rot: -Math.PI / 2 };
  const meuble = { id: 'm', sku: 'meubletv', x: 1.78, z: .2, rot: -Math.PI / 2 };
  const { items, alertes } = resoudre(piece, [tv, meuble], cat, { jeu: 0 });
  assert.equal(alertes.length, 0);
  const t = items.find(i => i.id === 't'), m = boite(items.find(i => i.id === 'm'), cat.meubletv.dim);
  assert.ok(t.x > m.x0 && t.x < m.x1 && t.z > m.z0 && t.z < m.z1, 'la télévision a quitté son meuble');
  assert.deepEqual(verifier(piece, items, cat), []);
});

test('une grande plante ne se pose pas sur un meuble : elle en est écartée', () => {
  const { items } = resoudre(piece, [{ id: 'm', sku: 'meubletv', x: 0, z: 0, rot: 0 }, { id: 'p', sku: 'plante', x: 0, z: 0, rot: 0 }], cat);
  const a = boite(items.find(i => i.id === 'm'), cat.meubletv.dim), b = boite(items.find(i => i.id === 'p'), cat.plante.dim);
  const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  assert.ok(!(dx > .001 && dz > .001), 'la plante chevauche le meuble');
});

test('verifier signale un chevauchement laissé à la main', () => {
  const alertes = verifier(piece, [
    { id: 'a', sku: 'canape', x: 0, z: 0, rot: 0 },
    { id: 'b', sku: 'fauteuil', x: .2, z: 0, rot: 0 }
  ], cat);
  assert.equal(alertes[0].type, 'chevauchement');
});
