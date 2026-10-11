import test from 'node:test';
import assert from 'node:assert/strict';
import { choisirParEmplacement } from '../../lib/budget.js';
import { preferencesDe } from '../../lib/references.js';
import { scoreStyle } from '../../lib/styles.js';
import { avecStylesVisuels } from '../../lib/styles-index.js';
import { appliquerProposition, preparerAmenagement } from '../../lib/amenagement.js';
import { bilanConfort } from '../../lib/confort.js';
import { instancierPatrons } from '../../lib/patrons.js';
import { simulerAmenagement } from '../../lib/simulation.js';
import { choisirCandidats } from '../../lib/selection.js';

const modele = { dims: { largeur: 6, profondeur: 5, hauteur: 2.6 }, murs: Object.fromEntries(['fond', 'gauche', 'droite', 'entree'].map(m => [m, { observe: true, ouvertures: [] }])) };
const produit = (id, fam, prix, dim = [1, .5, .8], extra = {}) => ({ id, fam, prix, dim, nom: id, ...extra });

test('un emplacement peut changer de produit pour conserver deux fonctions sous le plafond', () => {
  const p = { haut: produit('haut', 'lit', 900, [1.4, 2, 1]), petit: produit('petit', 'lit', 500, [1.4, 2, 1]), armoire: produit('armoire', 'armoire', 400) };
  const propositions = [{ produit: 'haut', zone: 'couchage' }, { produit: 'armoire', zone: 'rangement' }], copie = structuredClone(propositions);
  const r = choisirParEmplacement(propositions, p, 950, [], { candidats: { lit: [p.haut, p.petit], armoire: [p.armoire] } });
  assert.deepEqual(r.retenus.map(m => m.produit), ['petit', 'armoire']);
  assert.equal(r.diagnostic.cout, 900); assert.equal(r.diagnostic.substitutions.length, 1);
  assert.deepEqual(propositions, copie);
});

test('le moteur partagé applique les alternatives, les place et respecte le budget final', () => {
  const p = { haut: produit('haut', 'lit', 900, [1.4, 2, 1]), petit: produit('petit', 'lit', 500, [1.4, 2, 1]), armoire: produit('armoire', 'armoire', 400, [1, .5, 2]) };
  const r = appliquerProposition({ modele, produits: p, candidats: { lit: [p.haut, p.petit], armoire: [p.armoire] },
    prep: preparerAmenagement([], { budget: 950 }), proposition: { meubles: [{ produit: 'haut', zone: 'couchage' }, { produit: 'armoire', zone: 'rangement' }] } });
  assert.deepEqual(r.agencement.filter(it => it.garde !== false).map(it => it.sku).sort(), ['armoire', 'petit']);
  assert.ok(r.agencement.filter(it => it.garde !== false).reduce((s, it) => s + p[it.sku].prix, 0) <= 950);
  assert.ok(r.proposition.alertes.some(a => a.includes('alternatives de même usage')));
});

test('les candidats réservent une option économique avant de demander la proposition IA', () => {
  const p = Object.fromEntries([0, 1, 2, 3].map(i => ['p' + i, produit('p' + i, 'canape', 200 + i * 200, [2, .8, .8], { texte: i ? 'Contemporain moderne design ligne pure' : '', couleurs: ['c' + i] })]));
  const r = choisirCandidats(p, { dims: modele.dims, fonction: 'salon', envies: 'contemporain', budget: 2000, parFamille: 2 });
  assert.equal(r.canape.length, 2); assert.ok(r.canape.some(p => p.id === 'p0'));
});

test('un remplacement partiel sans substitut conserve la fonction existante', () => {
  const existant = { id: 'armoire', origine: 'existant', p: produit('e', 'armoire', 0, [1, .5, 2]), x: 2.7, z: -.6, rot: -Math.PI / 2, garde: true };
  const r = appliquerProposition({ modele, produits: {}, prep: preparerAmenagement([existant], { mode: 'partiel', aRemplacer: ['armoire'] }), proposition: { meubles: [] } });
  assert.equal(r.agencement[0].garde, true); assert.deepEqual(r.agencement[0].p.dim, existant.p.dim);
  assert.equal(r.agencement[0].x, existant.x);
  assert.ok(r.proposition.alertes.some(a => a.includes('faute de remplacement adapté')));
});

test('alternatives : même usage, même famille, prix connu et présence dans les candidats', () => {
  const p = { bureau: produit('bureau', 'table', 800, [1.2, .6, .75], { nom: 'Bureau' }), bas: produit('bas', 'table', 50, [1, .6, .4]),
    chevet: produit('chevet', 'table', 50, [.5, .4, .5], { nom: 'Chevet' }), petit: produit('petit', 'table', 200, [1, .5, .75], { nom: 'Bureau compact' }),
    inconnu: produit('inconnu', 'table', 0, [1, .5, .75], { nom: 'Bureau sans prix' }), hors: produit('hors', 'table', 1, [1, .5, .75], { nom: 'Bureau hors candidats' }) };
  const r = choisirParEmplacement([{ produit: 'bureau', alternatives: ['bas', 'chevet', 'inconnu', 'hors', 'petit'] }], p, 300, [], { candidats: { table: Object.values(p).filter(q => q.id !== 'hors') } });
  assert.deepEqual(r.retenus.map(m => m.produit), ['petit']);
});

test('les slots répétés coûtent leur quantité réelle et les produits non répétables restent uniques', () => {
  const p = { a: produit('a', 'table', 149.99, [.5, .4, .5], { nom: 'Chevet' }) };
  const props = [{ produit: 'a' }, { produit: 'a' }];
  assert.equal(choisirParEmplacement(props, p, 299.98).retenus.length, 2);
  assert.equal(choisirParEmplacement(props, p, 299.97).retenus.length, 1);
  const sofas = { a: produit('a', 'canape', 600), b: produit('b', 'canape', 600), c: produit('c', 'canape', 400) };
  const r = choisirParEmplacement([{ produit: 'a' }, { produit: 'b' }], sofas, 1000, [], { candidats: { canape: Object.values(sofas) } });
  assert.equal(r.retenus.length, 2); assert.equal(new Set(r.retenus.map(m => m.produit)).size, 2);
  assert.ok(r.diagnostic.cout <= 1000);
});

test('sac à dos par emplacement : couverture maximale contrôlée par énumération réduite', () => {
  for (let graine = 1; graine <= 10; graine++) {
    const p = {}, props = [], cands = {};
    for (const [i, fam] of ['lit', 'bureau', 'armoire'].entries()) {
      cands[fam] = [0, 1].map(j => produit(`${i}-${j}`, fam, 100 + (graine * 89 + i * 137 + j * 73) % 400));
      cands[fam].forEach(q => { p[q.id] = q; }); props.push({ produit: cands[fam][0].id });
    }
    const budget = 500 + graine * 17, r = choisirParEmplacement(props, p, budget, [], { candidats: cands });
    let couverture = 0;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
      const choix = [a, b, c], cout = choix.reduce((s, j, i) => s + (j ? cands[['lit', 'bureau', 'armoire'][i]][j - 1].prix : 0), 0);
      if (cout <= budget) couverture = Math.max(couverture, choix.filter(Boolean).length);
    }
    assert.equal(r.retenus.length, couverture); assert.ok(r.diagnostic.cout <= budget); assert.equal(r.diagnostic.approximation, false);
  }
});

test('le minimal conserve les fonctions et un éclairage, le chaleureux accepte des compléments', () => {
  const p = { lit: produit('lit', 'lit', 500), tapis: produit('tapis', 'tapis', 100, [2, 1, .01]), lumiere: produit('lumiere', 'applique', 50), autre: produit('autre', 'lampadaire', 60) };
  const props = Object.keys(p).map(produit => ({ produit }));
  const minimal = choisirParEmplacement(props, p, null, [], { envies: 'minimal', preferences: preferencesDe('minimal') });
  assert.ok(minimal.retenus.some(m => m.produit === 'lit'));
  assert.equal(minimal.retenus.filter(m => ['lumiere', 'autre'].includes(m.produit)).length, 1);
  assert.ok(!minimal.retenus.some(m => m.produit === 'tapis'));
  const cosy = choisirParEmplacement(props, p, null, [], { envies: 'cosy', preferences: preferencesDe('cosy') });
  assert.equal(cosy.retenus.length, 4);
  const voulu = choisirParEmplacement(props, p, null, [], { envies: 'minimal avec un tapis', preferences: preferencesDe('minimal avec un tapis') });
  assert.ok(voulu.retenus.some(m => m.produit === 'tapis'));
});

test('styles multiples et explicites : Japandi, industriel, Scandinavie et négations', () => {
  assert.deepEqual(preferencesDe('Style souhaité : Japandi, Scandinave.', { style: 'classique' }).styles, ['japandi', 'scandinave']);
  assert.equal(preferencesDe('Industrial loft').style, 'industriel');
  assert.equal(preferencesDe('pas de style classique, japandi').style, 'japandi');
  assert.equal(preferencesDe('classique sans symétrie').composition, 'equilibre');
  assert.equal(preferencesDe('', { styles: ['inconnu', 'boheme', 'boheme'] }).style, 'boheme');
  const bois = produit('bois', 'table', 100, [1, 1, 1], { texte: 'Bois clair en chêne, lignes sobres', mat: 'bois' });
  const acier = produit('acier', 'table', 100, [1, 1, 1], { texte: 'Métal noir et acier industriel', mat: 'metal' });
  assert.ok(scoreStyle(bois, 'scandinave') > scoreStyle(acier, 'scandinave'));
  assert.ok(scoreStyle(acier, 'industriel') > scoreStyle(bois, 'industriel'));
});

test('les profils classent les patrons sans supprimer les autres compositions possibles', () => {
  const p = produit('sofa', 'canape', 300, [2, .8, .8]), e = { role: 'canape', p, it: { id: 'sofa', x: 0, z: 0, rot: 0 } };
  const es = [e, { role: 'tv', p: produit('tv', 'tv', 0), it: { id: 'tv', x: 2, z: 0, rot: -Math.PI / 2 } }];
  const chaleureux = instancierPatrons(modele, [e], es, preferencesDe('chaleureux'));
  const epure = instancierPatrons(modele, [e], es, preferencesDe('epure'));
  assert.equal(chaleureux[0].id, 'salon-conversation'); assert.equal(epure[0].id, 'salon-focal');
  assert.deepEqual(chaleureux.map(p => p.id).sort(), epure.map(p => p.id).sort());
});

test('les coordonnées, angles et hauteurs sortis par le modèle n’influencent plus le placement', () => {
  const p = { lit: produit('lit', 'lit', 400, [1.4, 2, 1]), table: produit('table', 'table', 100, [.5, .4, .5], { nom: 'Chevet' }) };
  const props = { meubles: [{ produit: 'lit', zone: 'couchage' }, { produit: 'table', zone: 'couchage' }] }, copie = structuredClone(modele);
  const entree = { modele, produits: p, prep: preparerAmenagement([], { envies: 'classique', budget: 700 }), proposition: props };
  const normal = appliquerProposition(entree);
  const aberrant = appliquerProposition({ ...entree, proposition: { meubles: props.meubles.map(m => ({ ...m, x: 1000, p: -1000, oriente_vers: 'gauche', mur: 'entree', hauteur_pose: 100 })) } });
  assert.deepEqual(aberrant.agencement, normal.agencement); assert.deepEqual(modele, copie);
  assert.equal(normal.proposition.placement.source, 'solveur');
  assert.ok(normal.proposition.placement.compositionsTestees >= 4);
  assert.equal(normal.agencement.filter(it => it.garde !== false).length, 2);
});

test('la démo suit le même contrat sémantique sans nouvelles coordonnées', () => {
  const p = produit('lit', 'lit', 400, [1.4, 2, 1]);
  const r = simulerAmenagement({ piece: { dimensions: modele.dims, meubles: [] }, candidats: { lit: [p] }, mode: 'tout', langue: 'fr' });
  assert.deepEqual(Object.keys(r.proposition.meubles[0]).sort(), ['alternatives', 'produit', 'raison', 'zone']);
});

test('tapis et lumière : le score vérifie le lien avec un usage, pas leur quantité', () => {
  const p = { lit: produit('lit', 'lit', 400, [1.4, 2, 1]), lampe: produit('lampe', 'lampadaire', 40, [.2, .2, 1.4]) };
  const base = [{ id: 'lit', sku: 'lit', x: 0, z: -1.4, rot: 0 }];
  const score = (x, z) => bilanConfort(modele, [...base, { id: 'lampe', sku: 'lampe', x, z }], p, 'fr', { envies: 'cosy' }).score.criteres.find(c => c.id === 'tapisLumiere');
  assert.ok(score(1, -1).note > score(2.5, 2).note);
});

test('index CLIP : bornes et image encore actuelle, sinon classement éditorial inchangé', () => {
  const p = { a: produit('a', 'table', 100, [1, 1, 1], { img: 'https://example.com/actuelle.jpg' }) };
  const v = { source: 'openclip', image: p.a.img, modele: 'modele-test', prompts: 'prompts-test', scores: { japandi: .4, epure: Infinity, inconnu: .9 } };
  const r = avecStylesVisuels(p, { version: 1, produits: { a: v } });
  assert.deepEqual(r.a.styleVisuel.scores, { japandi: .4 }); assert.ok(r.a.styleVisuel.aVerifier);
  assert.ok(scoreStyle(r.a, 'japandi') > scoreStyle(p.a, 'japandi'));
  assert.ok(!avecStylesVisuels(p, { version: 1, produits: { a: { ...v, image: 'https://example.com/ancienne.jpg' } } }).a.styleVisuel);
  assert.ok(!p.a.styleVisuel);
});
