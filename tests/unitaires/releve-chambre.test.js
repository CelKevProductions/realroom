import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chambreFenetre } from '../fixtures/chambre-fenetre.js';
import { pieceDepuisAnalyse, preparerAmenagement, appliquerProposition } from '../../lib/amenagement.js';
import { versClaude } from '../../lib/piece.js';
import { bilanConfort, optimiserAmenagement } from '../../lib/confort.js';
import { choisirCandidats, tient, tientAvecUsage } from '../../lib/selection.js';
import { resoudre } from '../../lib/agencement.js';
import { usageDe, abandonExplicite } from '../../lib/usages.js';
import { suggerer } from '../../components/maison/demande.js';
import { souhaiteEpure } from '../../lib/styles.js';

const produit = (id, fam, dim, extra = {}) => ({ id, nom: id, fam, dim, prix: 1000, ...extra });
const cat = {
  lit: produit('lit', 'lit', [1.7, 2.1, 1], { nom: 'Lit simple beige', texte: 'Silhouette basse, lignes droites.' }),
  fauteuil: produit('fauteuil', 'fauteuil', [.75, .8, .8]),
  sobre: produit('sobre', 'suspension', [.2, .2, .3], { nom: 'Globe minimal', titre: 'Suspension sobre en verre opalin' }),
  orne: produit('orne', 'suspension', [.4, .4, .5], { nom: 'Lustre blanc', titre: 'Lustre floral à pampilles en cristal blanc', look: { style: 'floral' } }),
  chevet: produit('chevet', 'meuble', [.4, .4, .5], { nom: 'Table de chevet' })
};

test('le relevé conserve les observations, les installations et une TV réellement murale', () => {
  const a = structuredClone(chambreFenetre);
  // Un chevauchement suspect doit rester à vérifier, jamais effacer une pièce du relevé.
  a.meubles.push({ ...a.meubles[0], nom: 'Observation incertaine', confiance: .3 });
  const { modele, agencement } = pieceDepuisAnalyse(a, {}, cat);
  assert.equal(agencement.length, a.meubles.length);
  assert.deepEqual(agencement.slice(0, 1).map(x => [x.x, x.z, x.rot]), [[.93, -.7, -Math.PI / 2]]);
  assert.equal(modele.murs.entree.observe, false);
  assert.deepEqual(modele.murs.entree.ouvertures, []);
  assert.equal(agencement[3].p.fam, 'tv-murale');
  assert.equal(agencement[3].mur, 'gauche');
  assert.equal(agencement[3].x, -2);
  assert.equal(agencement[3].y, 1.65);
  const vue = versClaude(modele, agencement, cat);
  assert.equal(vue.meubles[1].immobile, true);
  assert.equal(vue.meubles[3].hauteur_pose, 1.65);
  assert.equal(vue.meubles.at(-1).confiance, .3);
  assert.equal(vue.murs_observes.entree, false);
  assert.deepEqual(a.meubles[0], chambreFenetre.meubles[0]);
});

test('tout repenser ne retire ni radiateur, ni rangement/coiffeuse/TV sans remplaçant adapté', () => {
  const { modele, agencement } = pieceDepuisAnalyse(chambreFenetre, {}, cat);
  const prep = preparerAmenagement(agencement, { mode: 'tout', budget: 0, envies: 'Style souhaité : Épuré. Repenser toute la pièce.' });
  assert.ok(prep.garder.includes('e2'));
  const r = appliquerProposition({ modele, prep, produits: cat, proposition: {
    retirer: agencement.map(i => i.id),
    meubles: [{ produit: 'lit', x: 0, p: 3.9, oriente_vers: 'entree' }, { produit: 'orne', x: 0, p: 2.5 }, { produit: 'chevet', x: -1.5, p: .5 }]
  } });
  for (const id of ['e2', 'e3', 'e4', 'e5']) {
    const avant = agencement.find(it => it.id === id), apres = r.agencement.find(it => it.id === id);
    assert.ok(apres && apres.garde !== false, id + ' conservé');
    assert.equal(apres.x, avant.x); assert.equal(apres.z, avant.z); assert.equal(apres.rot, avant.rot);
  }
  assert.ok(!r.agencement.some(it => it.sku === 'orne'));
  const lit = r.agencement.find(it => it.sku === 'lit');
  assert.ok(lit, 'un lit catalogue doit pouvoir être proposé dans cette chambre');
  assert.ok(!r.proposition.confort.alertes.some(a => ['fenetre', 'radiateur', 'chevauchement'].includes(a.type) && a.ids.includes(lit.id)), JSON.stringify(r.proposition.confort.alertes));
  assert.equal(r.proposition.confort.circulation, null, 'pas de porte inventée');
  assert.ok(r.proposition.alertes.some(s => s.includes('Coiffeuse')));
});

test('le radiateur anciennement classé autre reste protégé, y compris en optimisation locale', () => {
  const { modele, agencement } = pieceDepuisAnalyse(chambreFenetre, {}, cat);
  const ancien = { ...agencement[1], p: { ...agencement[1].p, fam: 'autre' } };
  const prep = preparerAmenagement([ancien], { mode: 'tout', aRemplacer: [ancien.id] });
  assert.deepEqual(prep.aRemplacer, []);
  assert.ok(prep.garder.includes(ancien.id));
  const r = optimiserAmenagement(modele, [ancien], cat);
  assert.deepEqual(r.items, [ancien]);
  const solved = resoudre(modele, [ancien], cat).items[0];
  assert.equal(solved.x, ancien.x); assert.equal(solved.z, ancien.z);
});

test('un lit bas sous la fenêtre est signalé même si sa tête reste sous l’allège', () => {
  const { modele } = pieceDepuisAnalyse(chambreFenetre, {}, cat);
  const bas = { nom: 'Lit bas', fam: 'lit', dim: [1.6, 2, .5] };
  const items = [{ id: 'l', p: bas, x: 0, z: -1.5, rot: 0 }];
  assert.ok(bilanConfort(modele, items, cat).alertes.some(a => a.type === 'fenetre'));
  const r = optimiserAmenagement(modele, items, cat);
  assert.ok(!r.confort.alertes.some(a => a.type === 'fenetre'));
});

test('épure filtre la forme et les ornements malgré la couleur ou la maquette détaillée', () => {
  const dims = { largeur: 4, profondeur: 5, hauteur: 2.55 };
  const c = choisirCandidats(cat, { dims, fonction: 'chambre', envies: 'Style souhaité : Épuré.', budget: 0 });
  assert.ok(c.suspension.some(p => p.id === 'sobre'));
  assert.ok(!c.suspension.some(p => p.id === 'orne'));
  const classique = choisirCandidats(cat, { dims, fonction: 'chambre', envies: 'Classique chic', budget: 0 });
  assert.ok(classique.suspension.some(p => p.id === 'orne'), 'les autres styles restent possibles');
  const mini = suggerer(Object.fromEntries(Object.entries(cat).map(([id,p]) => [id, { ...p, vign: '/photo.jpg' }])), { fonction: 'chambre', styles: ['epure'] });
  assert.ok(!mini.some(p => p.id === 'orne'), 'même règle dans les suggestions du parcours');
  assert.equal(souhaiteEpure('epure artdeco'), false, 'le brief mixte des suggestions suit la même règle');
});

test('un lit surdimensionné est écarté des candidats, un modèle compact garde sa place', () => {
  const dims = { largeur: 3, profondeur: 3.2, hauteur: 2.55 };
  const grand = produit('grand', 'lit', [2.8, 2.3, 1]);
  assert.equal(tient(grand, dims), true);
  assert.equal(tientAvecUsage(grand, dims), false);
  assert.equal(tientAvecUsage(cat.lit, dims), true);
});

test('une suppression explicite est respectée et un chevet ne remplace pas une commode', () => {
  assert.notEqual(usageDe(cat.chevet), usageDe({ fam: 'commode', nom: 'Commode' }));
  const { modele, agencement } = pieceDepuisAnalyse(chambreFenetre, {}, cat);
  const prep = preparerAmenagement(agencement, { mode: 'tout', envies: 'Supprimer la coiffeuse et la télévision.' });
  const r = appliquerProposition({ modele, prep, produits: cat, proposition: { retirer: ['e4', 'e5'], meubles: [] } });
  assert.equal(r.agencement.find(i => i.id === 'e5').garde, false);
  assert.equal(r.agencement.find(i => i.id === 'e4').garde, false);
  assert.equal(abandonExplicite('travail', 'Ne pas supprimer la coiffeuse'), false);
  assert.equal(abandonExplicite('travail', 'Do not remove the desk'), false);
  assert.equal(abandonExplicite('travail', 'Garder le bureau, retirer le tapis'), false);
});

test('un lit rejeté faute de place ne fait pas disparaître la fonction de couchage', () => {
  const { modele, agencement } = pieceDepuisAnalyse(chambreFenetre, {}, cat);
  const impossible = produit('impossible', 'lit', [5, 4, 1]);
  const r = appliquerProposition({ modele, prep: preparerAmenagement(agencement, { mode: 'tout' }), produits: { impossible }, proposition: { retirer: ['e1'], meubles: [{ produit: 'impossible', x: 0, p: 2 }] } });
  assert.equal(r.agencement.find(i => i.id === 'e1').garde, true);
  assert.ok(r.proposition.alertes.some(s => s.includes('Lit double')));
});
