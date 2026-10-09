import test from 'node:test';
import assert from 'node:assert/strict';
import { choisirSousBudget } from '../../lib/budget.js';
import { instancierPatrons, PATRONS } from '../../lib/patrons.js';
import { optimiserAmenagement } from '../../lib/confort.js';
import { preparerAmenagement, appliquerProposition } from '../../lib/amenagement.js';
import { depuisScan } from '../../lib/scan.js';
import { scanApple } from '../fixtures/scans.js';

test('le sac à dos garde deux fonctions utiles là où le premier meuble cher absorbait le budget', () => {
  const p = { cher: { fam: 'lit', prix: 900 }, petit: { fam: 'lit', prix: 500 }, rangement: { fam: 'armoire', prix: 400 }, deco: { fam: 'plante', prix: 50 } };
  const propositions = Object.keys(p).map(produit => ({ produit }));
  const copie = structuredClone(propositions);
  const r = choisirSousBudget(propositions, p, 950);
  assert.deepEqual(r.retenus.map(m => m.produit), ['petit', 'rangement', 'deco']);
  assert.equal(r.diagnostic.cout, 950); assert.equal(r.diagnostic.approximation, false);
  assert.deepEqual(propositions, copie);
});

test('budget : centimes exacts, reste nul, prix inconnus et quantités réelles', () => {
  const p = { chaise: { fam: 'chaise', prix: 149.99 }, inconnu: { fam: 'lit', prix: null } };
  const q = [{ produit: 'chaise' }, { produit: 'chaise' }, { produit: 'inconnu' }];
  assert.equal(choisirSousBudget(q, p, 299.98).retenus.length, 2);
  assert.equal(choisirSousBudget(q, p, 299.97).retenus.length, 1);
  assert.equal(choisirSousBudget(q, p, 0).retenus.length, 0);
  assert.equal(choisirSousBudget(q, p, null).retenus.length, 3, 'absence de budget ne veut pas dire budget zéro');
});

test('budget : couverture des usages plutôt que multiplication du mobilier déjà conservé', () => {
  const p = { lit: { fam: 'lit', prix: 200 }, bureau: { fam: 'bureau', prix: 200 }, armoire: { fam: 'armoire', prix: 200 } };
  const q = Object.keys(p).map(produit => ({ produit }));
  const r = choisirSousBudget(q, p, 400, [{ fam: 'lit' }]);
  assert.deepEqual(r.retenus.map(m => m.produit), ['bureau', 'armoire']);
});

test('budget : optimum de l’utilité contrôlé par énumération sur de petits catalogues', () => {
  const familles = ['lit', 'chaise', 'table', 'bureau', 'armoire', 'plante'];
  for (let graine = 1; graine <= 12; graine++) {
    const produits = Object.fromEntries(familles.map((fam, i) => ['p' + i, { fam, prix: 100 + ((i * 197 + graine * 89) % 430), dim: [1, 1, 1] }]));
    const props = familles.map((_, i) => ({ produit: 'p' + i })), budget = 500 + graine * 33;
    const r = choisirSousBudget(props, produits, budget);
    const utilite = liste => liste.reduce((s, m) => s + (m.produit === 'p5' ? 100 : 10000), 0);
    let meilleur = 0;
    for (let bits = 0; bits < 64; bits++) {
      const liste = props.filter((_, i) => bits & (1 << i)), prix = liste.reduce((s, m) => s + produits[m.produit].prix, 0);
      if (prix <= budget) meilleur = Math.max(meilleur, utilite(liste));
    }
    assert.equal(utilite(r.retenus), meilleur);
    assert.ok(r.retenus.reduce((s, m) => s + produits[m.produit].prix, 0) <= budget);
  }
});

test('neuf patrons paramétriques, slots bornés et aucun nouveau produit', () => {
  assert.equal(PATRONS.length, 9);
  const { modele } = depuisScan(scanApple());
  const p = { lit: { fam: 'lit', dim: [1.4, 1.6, 1] }, armoire: { fam: 'armoire', dim: [1.1, .5, 2] } };
  const es = [{ role: 'lit', p: p.lit, it: { id: 'lit', x: 0, z: 0, rot: 0 } }, { role: 'rangement', p: p.armoire, it: { id: 'armoire', x: 1, z: 0, rot: 0 } }];
  const copie = structuredClone(es), patrons = instancierPatrons(modele, es, es);
  assert.equal(patrons.length, 3);
  for (const patron of patrons) for (const slot of patron.slots) {
    assert.ok(es.some(e => e.it.id === slot.id));
    assert.ok(Math.abs(slot.position.x) <= modele.dims.largeur / 2);
    assert.ok(Math.abs(slot.position.z) <= modele.dims.profondeur / 2);
  }
  assert.deepEqual(es, copie);
});

test('les patrons passent dans le score, gardent les verrous et ne changent ni produit ni taille', () => {
  const { modele } = depuisScan(scanApple()), cat = { lit: { fam: 'lit', dim: [1.4, 1.6, 1] }, armoire: { fam: 'armoire', dim: [1, .4, 1.8] } };
  const items = [{ id: 'lit', origine: 'catalogue', sku: 'lit', x: 0, z: 0, rot: 0 }, { id: 'armoire', origine: 'catalogue', sku: 'armoire', x: 1.3, z: .5, rot: -Math.PI / 2, fixe: true }];
  const r = optimiserAmenagement(modele, items, cat, { mode: 'tout', recuit: false });
  assert.equal(r.recherche.patronsEssayes.length, 3);
  assert.deepEqual(r.items.find(it => it.id === 'armoire'), items[1]);
  assert.deepEqual(r.items.map(it => it.sku).sort(), items.map(it => it.sku).sort());
  assert.deepEqual(cat.lit.dim, [1.4, 1.6, 1]);
  const partiel = optimiserAmenagement(modele, items, cat, { mode: 'partiel', recuit: false });
  assert.deepEqual(partiel.recherche.patronsEssayes, []);
});

test('un lit conservé ne déclenche pas un deuxième achat, même proposé par le modèle', () => {
  const { modele, agencement } = depuisScan(scanApple());
  const produits = { neuf: { id: 'neuf', nom: 'Lit neuf', fam: 'lit', dim: [1.4, 1.6, 1], prix: 400 },
    bureau: { id: 'bureau', nom: 'Bureau', fam: 'bureau', dim: [1, .5, .7], prix: 100 } };
  const prep = preparerAmenagement(agencement, { mode: 'partiel', garder: [agencement[0].id], envies: 'Conserver mon lit et ajouter un bureau', budget: 600 });
  const r = appliquerProposition({ modele, prep, produits, proposition: { meubles: [{ produit: 'neuf' }, { produit: 'bureau' }] } });
  assert.ok(!r.agencement.some(it => it.sku === 'neuf'));
  assert.deepEqual(r.agencement.find(it => it.id === agencement[0].id).p.dim, [1.4, 1.6, 1]);
  assert.ok(r.agencement.some(it => it.sku === 'bureau'));
  assert.ok(r.proposition.alertes.some(s => s.includes('couchage est déjà conservé')));
});

test('un second lit reste possible sur demande explicite, jamais par négation ou lit double', () => {
  const { modele, agencement } = depuisScan(scanApple());
  const produits = { neuf: { id: 'neuf', nom: 'Lit neuf', fam: 'lit', dim: [1.4, 1.6, 1], prix: 400 } };
  for (const [envies, attendu] of [['Ajouter un deuxième lit', true], ['Add another bed', true], ['Ne pas ajouter un deuxième lit', false], ['Conserver le lit double', false], ['Garder mes deux lits', false]]) {
    const prep = preparerAmenagement(agencement, { mode: 'partiel', envies, budget: 600 });
    const r = appliquerProposition({ modele, prep, produits, proposition: { meubles: [{ produit: 'neuf' }] } });
    assert.equal(r.agencement.some(it => it.sku === 'neuf'), attendu, envies);
  }
});
