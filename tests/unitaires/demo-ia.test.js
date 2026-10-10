import test from 'node:test';
import assert from 'node:assert/strict';
import { demandeDemoIA, validerDemoIA, ErreurDemoIA } from '../../lib/demo-ia.js';
import { champsDepuisScan } from '../../lib/scan.js';
import { PRODUITS } from '../../lib/catalogue.js';
import { scanApple, scanAndroid } from '../fixtures/scans.js';

const demande = () => demandeDemoIA({ ...champsDepuisScan(scanApple()), fonction: 'chambre', notes: '' }, { mode: 'tout', budget: 2000, envies: 'Chambre épurée', garder: ['e1'] }, 'fr');

test('la démo transmet le plan et le brief sans compte, crédits, rendus ni photos de la pièce', () => {
  const b = demandeDemoIA({ ...demande().piece, id: 'prive', projet_id: 'prive', photos: [{ role: 'entree', url: 'prive' }], rendus: ['prive'], credits: 12 }, demande().choix, 'fr');
  assert.deepEqual(Object.keys(b.piece).sort(), ['agencement', 'fonction', 'modele', 'notes']);
  const r = validerDemoIA(b, PRODUITS);
  assert.equal(r.choix.budget, 2000); assert.deepEqual(r.choix.garder, ['e1']);
  assert.deepEqual(r.piece.agencement[0].p.dim, b.piece.agencement[0].p.dim);
  assert.deepEqual(r.piece.modele.murs, b.piece.modele.murs);
});

test('le contour concave d’un scan reste métrique et n’est pas remplacé par son rectangle', () => {
  const scan = scanAndroid();
  scan.floorCorners = [[-2, 0, -2.5], [2, 0, -2.5], [2, 0, .5], [0, 0, .5], [0, 0, 2.5], [-2, 0, 2.5]];
  const champs = champsDepuisScan(scan);
  const b = demandeDemoIA({ ...champs, fonction: 'salon', notes: '' }, { budget: 1000 }, 'en');
  const r = validerDemoIA(b, PRODUITS);
  assert.deepEqual(r.piece.modele.contour, champs.modele.contour);
  assert.equal(Object.keys(r.piece.modele.murs).length, 6); assert.equal(r.langue, 'en');
  assert.deepEqual(champs.modele.contour, b.piece.modele.contour);
});

test('le catalogue serveur est la seule source des prix et dimensions commerciales', () => {
  const b = demande(), sku = Object.keys(PRODUITS)[0];
  b.piece.agencement.push({ id: 'c1', origine: 'catalogue', sku, x: 0, z: 0, rot: 0, p: { prix: 0, dim: [.01, .01, .01] }, prix: 0 });
  const r = validerDemoIA(b, PRODUITS), it = r.piece.agencement.at(-1);
  assert.equal(it.sku, sku); assert.equal(it.p, undefined); assert.equal(it.prix, undefined);
  b.piece.agencement.at(-1).sku = 'inventee';
  assert.throws(() => validerDemoIA(b, PRODUITS), ErreurDemoIA);
});

test('une géométrie ou un inventaire invalides sont refusés avant l’appel payant', () => {
  for (const changer of [
    b => { b.piece.modele.dims.largeur = NaN; },
    b => { b.piece.modele.dims.hauteur = 200; },
    b => { b.piece.modele.contour = [[-2, -2], [2, 2], [2, -2], [-2, 2]]; },
    b => { b.piece.agencement.push(b.piece.agencement[0]); },
    b => { b.piece.agencement[0].x = Infinity; },
    b => { b.choix.budget = -1; },
    b => { b.choix.envies = 'x'.repeat(1201); }
  ]) { const b = demande(); changer(b); assert.throws(() => validerDemoIA(b, PRODUITS), ErreurDemoIA); }
});

test('seules trois inspirations incorporées sont acceptées, jamais une URL à télécharger sur le serveur', () => {
  const b = demande();
  b.inspirations = [{ dataUri: 'data:image/jpeg;base64,/9j/AA==', role: 'entree', url: 'prive' }];
  assert.deepEqual(validerDemoIA(b, PRODUITS).inspirations, [{ dataUri: b.inspirations[0].dataUri }]);
  for (const images of [[{ dataUri: 'http://127.0.0.1/prive' }], Array(4).fill(b.inspirations[0]), [{ dataUri: 'data:image/jpeg;base64,/9j/' + 'A'.repeat(400000) }]]) {
    b.inspirations = images;
    assert.throws(() => validerDemoIA(b, PRODUITS), e => e.code === 'inspiration-demo');
  }
});
