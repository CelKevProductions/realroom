// Édition Maison Corleone : retour de connexion sûr, demande d'aménagement composée par le parcours
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suiteSure, estCompteMaison } from '../../lib/maison-regles.js';
import { textesMaison } from '../../components/maison/textes.js';
import { composerEnvies, aGarder, suggerer } from '../../components/maison/demande.js';

test('retour après connexion : seulement une page de l’édition Maison Corleone', () => {
  for (const ok of ['/fr/maison-corleone', '/en/maison-corleone', '/fr/maison-corleone/demo', '/fr/maison-corleone?piece=r_Ab3-_x9']) {
    assert.equal(suiteSure(ok, 'fr'), ok);
  }
  for (const non of ['https://exemple.com', '//exemple.com', '/fr/app', '/fr/maison-corleone//exemple.com', '/fr/maison-corleone/../app', '/de/maison-corleone', 'javascript:alert(1)', '']) {
    assert.equal(suiteSure(non, 'fr'), '/fr/maison-corleone', non);
  }
  assert.equal(suiteSure('/fr/app', 'en'), '/en/maison-corleone');
});

test('compte Maison Corleone : reconnu à sa clé', () => {
  assert.equal(estCompteMaison({ email: 'mc:123456' }), true);
  assert.equal(estCompteMaison({ email: 'client@exemple.fr' }), false);
  assert.equal(estCompteMaison(null), false);
});

test('demande d’aménagement : style, mots du client, priorités et coups de cœur', () => {
  const t = textesMaison('fr');
  const produits = { a1: { nom: 'Royal Curve' } };
  const e = composerEnvies(t, { styles: ['chaleureux', 'artdeco'], texte: 'des tons terracotta', priorites: ['canape', 'eclairage'], coups: ['a1', 'inconnu'] }, produits);
  assert.match(e, /Style souhaité : Chaleureux, Art déco\./);
  assert.match(e, /des tons terracotta\./);
  assert.match(e, /À changer en priorité : le canapé, la lumière/);
  assert.match(e, /Coups de cœur à intégrer si possible : Royal Curve\./);
  assert.match(composerEnvies(t, { styles: [], texte: '', priorites: ['tout'], coups: [] }, produits), /Repenser toute la pièce/);
  assert.ok(composerEnvies(t, { texte: 'x'.repeat(5000), priorites: [] }, produits).length <= 1200);
  assert.match(composerEnvies(textesMaison('en'), { styles: ['epure'], priorites: ['lit'] }, {}), /Desired style: Minimal\. Change first: the bed/);
});

test('meubles gardés : tout ce que les priorités ne visent pas (rien si tout repenser)', () => {
  const piece = { agencement: [
    { id: 'e1', origine: 'existant', p: { fam: 'canape' } },
    { id: 'e2', origine: 'existant', p: { fam: 'lampe' } },
    { id: 'e3', origine: 'existant', p: { fam: 'tv' } },
    { id: 'e4', origine: 'existant', p: { fam: 'table' } },
    { id: 'c1', origine: 'catalogue', sku: 'x' }
  ] };
  assert.deepEqual(aGarder(piece, { priorites: ['canape'] }), ['e2', 'e3', 'e4']);
  assert.deepEqual(aGarder(piece, { priorites: ['canape', 'eclairage', 'tables'] }), ['e3']);
  assert.deepEqual(aGarder(piece, { priorites: ['tout'] }), []);
  assert.deepEqual(aGarder(piece, { priorites: [] }), []);
});

test('suggestions : familles de la pièce, budget respecté, style d’abord, variété', () => {
  const p = (id, fam, prix, extra = {}) => ({ id, fam, prix, nom: id, vign: '/v.jpg', ...extra });
  const produits = Object.fromEntries([
    p('lit-velours', 'lit', 1800, { titre: 'Lit en velours cognac' }), p('lit-blanc', 'lit', 900, { titre: 'Lit blanc' }),
    p('fauteuil-rotin', 'fauteuil', 400, { titre: 'Fauteuil en rotin naturel' }), p('fauteuil-cher', 'fauteuil', 9000),
    p('canape', 'canape', 2000), p('baignoire', 'baignoire', 3000), p('applique', 'applique', 150)
  ].map(x => [x.id, x]));
  const s = suggerer(produits, { fonction: 'chambre', styles: ['chaleureux'], budget: 2000 }, 4);
  assert.equal(s.length, 4);
  assert.equal(s[0].id, 'lit-velours');                       // le mot « velours » du style chaleureux
  assert.ok(s.every(x => ['lit', 'fauteuil', 'applique', 'suspension', 'lustre', 'meuble'].includes(x.fam)));
  assert.ok(!s.some(x => x.prix > 2000));
  assert.equal(new Set(s.slice(0, 3).map(x => x.fam)).size, 3); // une famille de chaque d'abord
  assert.equal(s[3].id, 'lit-blanc');                          // puis on complète
  assert.deepEqual(suggerer(null, { fonction: 'salon' }), []);
});
