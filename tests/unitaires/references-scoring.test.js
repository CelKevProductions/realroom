import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preferencesDe, poidsComposition, placePhoto, photosPiece, contenuInspirations } from '../../lib/references.js';
import { bilanConfort, optimiserAmenagement } from '../../lib/confort.js';
import { appliquerProposition, preparerAmenagement } from '../../lib/amenagement.js';
import { LIMITES } from '../../lib/config.js';

const modele = (L = 7, P = 5) => ({ dims: { largeur: L, profondeur: P, hauteur: 2.6 }, murs: {
  entree: { ouvertures: [{ type: 'porte', position: -1.5, largeur: .9 }] }, fond: { ouvertures: [] }, gauche: { ouvertures: [] }, droite: { ouvertures: [] }
} });
const cat = { s: { nom: 'Canapé', fam: 'canape', dim: [2.2, .9, .8] }, t: { nom: 'Table basse', fam: 'table', dim: [1.1, .6, .4] },
  f: { nom: 'Fauteuil', fam: 'fauteuil', dim: [.8, .8, .85] }, a: { nom: 'Armoire', fam: 'armoire', dim: [1.4, .6, 2] } };
const it = (id, sku, x, z, rot = 0) => ({ id, sku, x, z, rot });

test('les références restent des préférences bornées, les demandes explicites ont priorité', () => {
  const p = preferencesDe('salon épuré et convivial, sans symétrie', { style: 'classique', composition: 'symetrie',
    palette: ['vert', 'vert', 123, 'x'.repeat(100)], matieres: ['bois'], resume: 'r'.repeat(500), passage: 0, poids: { geometrie: 0 } });
  assert.equal(p.style, 'epure'); assert.equal(p.composition, 'equilibre');
  assert.deepEqual(p.palette, ['vert', 'x'.repeat(32)]); assert.equal(p.resume.length, 240);
  assert.ok(!('passage' in p) && !('poids' in p));
  assert.ok(poidsComposition(preferencesDe('conversation')).conversation > poidsComposition(preferencesDe()).conversation);
});

test('les inspirations ne participent jamais aux vues du relevé, le message vision les distingue', () => {
  const photos = [{ role: 'inspiration', dataUri: 'data:image/jpeg;base64,/9j/AA==' }, { role: 'entree', dataUri: 'data:image/png;base64,AAAA' }];
  assert.deepEqual(photosPiece(photos), [photos[1]]);
  const contenu = contenuInspirations([photos[0], { dataUri: 'https://example.com/image.jpg' }, photos[0], photos[0]]);
  assert.equal(contenu.filter(c => c.type === 'image').length, 2);
  assert.match(contenu[0].text, /not the client's room/);
  assert.equal(contenu[1].source.media_type, 'image/jpeg');
});

test('huit vues de pièce et trois inspirations ont des quotas indépendants et restent retirables', () => {
  const photos = Array.from({ length: 8 }, (_, i) => ({ role: i ? 'detail' : 'entree' }));
  assert.equal(placePhoto(photos, 'inspiration', LIMITES).possible, true);
  const plein = [...photos, ...Array.from({ length: 3 }, () => ({ role: 'inspiration' }))];
  assert.equal(placePhoto(plein, 'inspiration', LIMITES).possible, false);
  assert.equal(placePhoto(plein, 'detail', LIMITES).possible, false);
  assert.deepEqual(placePhoto(plein, 'entree', LIMITES), { remplace: 0, possible: true });
  assert.equal(placePhoto(plein.slice(0, -1), 'inspiration', LIMITES).possible, true);
});

test('le score expose les conflits, ne certifie pas les portes inconnues et ne note pas une pièce vide', () => {
  const m = modele(), items = [it('s', 's', 0, 0), it('t', 't', 0, 0)];
  const r = bilanConfort(m, items, cat, 'fr', { envies: 'classique, symétrie' });
  assert.ok(r.score.contraintes > 0); assert.ok(r.score.total <= 49);
  assert.ok(r.score.criteres.find(c => c.id === 'geometrie').problemes > 0);
  m.murs.entree.ouvertures = [];
  const inconnu = bilanConfort(m, [it('s', 's', 0, -2)], cat);
  assert.equal(inconnu.score.criteres.find(c => c.id === 'circulation').note, null);
  assert.equal(inconnu.score.incomplet, true);
  assert.equal(bilanConfort(m, [], cat).score.total, null);
  const inegal = bilanConfort(modele(), [it('s', 's', -1, -1.7), it('t', 't', -1, -.53), it('a', 'a', 2.2, -2.17)], cat);
  assert.ok(inegal.score.criteres.some(c => c.note !== null && c.note < 100));
  assert.ok(inegal.score.total < 100, 'le total arrondi ne doit pas masquer un critère dégradé');
});

test('le critère conversation préfère deux sièges qui se regardent à ceux qui se tournent le dos', () => {
  const m = modele(), face = [it('a', 'f', -1, 0, Math.PI / 2), it('b', 'f', 1, 0, -Math.PI / 2)];
  const dos = face.map(i => ({ ...i, rot: i.rot + Math.PI }));
  const critere = items => bilanConfort(m, items, cat, 'fr', { envies: 'conversation' }).score.criteres.find(c => c.id === 'conversation');
  assert.ok(critere(face).note > critere(dos).note);
  assert.equal(critere(face).poids, 2);
});

test('le recuit sort d’un arrangement moins bon que les seules passes locales, sans nouveaux conflits', () => {
  // Cas synthétique : six meubles, une fenêtre et deux groupes d'assises/rangement.
  const m = modele(); m.murs.fond.ouvertures = [{ type: 'fenetre', position: 0, largeur: 1.8, allege: .9 }];
  const items = [it('i0', 's', .68, -.85, Math.PI / 2), it('i1', 't', -1.74, -.29, 3 * Math.PI / 2),
    it('i2', 'f', 1.25, 1.13, Math.PI), it('i3', 'a', -1.06, .48), it('i4', 'f', -1.68, -1.12, 3 * Math.PI / 2), it('i5', 'a', .69, 1.1, Math.PI / 2)];
  const copie = structuredClone(items), opts = { envies: 'salon convivial', mode: 'tout' };
  const local = optimiserAmenagement(m, items, cat, { ...opts, recuit: false });
  const global = optimiserAmenagement(m, items, cat, opts);
  assert.ok(global.confort.score.cout < local.confort.score.cout - 10);
  assert.equal(global.confort.alertes.length, 0);
  assert.ok(global.recherche.acceptationsMoinsBonnes > 0 && global.recherche.iterations >= 192);
  assert.deepEqual(global, optimiserAmenagement(m, items, cat, opts));
  assert.deepEqual(items, copie); assert.deepEqual(global.items.map(i => i.sku), items.map(i => i.sku));
});

test('les préférences d’une inspiration sont enregistrées sans modifier les mesures ni le budget', () => {
  const m = modele(), copie = structuredClone(m);
  const produits = { simple: { nom: 'Applique simple', fam: 'applique', dim: [.3, .2, .3], prix: 100 },
    ornee: { nom: 'Lustre floral cristal', fam: 'lustre', dim: [.8, .8, .6], prix: 150 } };
  const r = appliquerProposition({ modele: m, produits, prep: preparerAmenagement([], { budget: 120 }), proposition: {
    meubles: [{ produit: 'simple', x: 1, p: 5, mur: 'fond', hauteur_pose: 1.7 }, { produit: 'ornee', x: 0, p: 2 }],
    inspiration: { style: 'epure', composition: 'equilibre', palette: ['vert'], matieres: ['bois'], resume: 'Lignes simples.', largeur: 100 }
  } });
  assert.deepEqual(m, copie); assert.deepEqual(r.proposition.preferences.palette, ['vert']);
  assert.equal(r.proposition.preferences.style, 'epure'); assert.equal(r.proposition.confort.score.version, 'realroom-2026-10-v3');
  assert.ok(!r.agencement.some(i => i.sku === 'ornee')); assert.ok(r.agencement.reduce((s, i) => s + produits[i.sku].prix, 0) <= 120);
});
