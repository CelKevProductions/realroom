// Aménagement « vivant » : variété des dispositions, relations entre les coins et
// remplissage équilibré. Pièces synthétiques uniquement, aucun plan client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRelations, ecartZones } from '../../lib/relations-zones.js';
import { evaluerRemplissage, profilVide } from '../../lib/remplissage.js';
import { aleatoire, signatureDispositions } from '../../lib/zonage.js';
import { tirerVariation, variationValide, VARIATION_MAX } from '../../lib/variation.js';
import { preparerAmenagement, appliquerProposition } from '../../lib/amenagement.js';
import { demandeDemoIA, validerDemoIA, ErreurDemoIA } from '../../lib/demo-ia.js';
import { verifier, produitDe } from '../../lib/agencement.js';
import { PRODUITS } from '../../lib/catalogue.js';
import { choisirCandidats } from '../../lib/selection.js';
import { rectangle } from '../fixtures/bench-chambres.js';

const CAT = {
  canape: { fam: 'canape', dim: [2.2, .9, .8] }, meuble: { fam: 'meuble', dim: [1.6, .4, .5] },
  table: { fam: 'table', dim: [1.6, .9, .75] }, chaise: { fam: 'chaise', dim: [.45, .5, .9] },
  fauteuil: { fam: 'fauteuil', dim: [.8, .8, .8] }, buffet: { fam: 'buffet', dim: [1.6, .45, .8] }
};
const zone = (id, type, x0, x1, z0, z1, extra = {}) => ({ id, type, x0, x1, z0, z1, ...extra });
const ids = r => r.regles.map(x => x.id);

test('relations : le repas prolonge le salon, un repas coupé du salon est pénalisé', () => {
  const modele = rectangle(6, 5);
  const proches = scoreRelations(modele, [zone('salon', 'salon', -2.8, -.6, -2.3, 1), zone('repas', 'repas', .4, 2.6, -1, 1)], [], CAT, 'salon');
  assert.ok(ids(proches).includes('salon-repas-proches')); assert.ok(proches.score > 0);
  const long = rectangle(14, 4);
  const loin = scoreRelations(long, [zone('salon', 'salon', -6.8, -4.5, -1.5, 1.5), zone('repas', 'repas', 4.5, 6.8, -1, 1)], [], CAT, 'salon');
  assert.ok(ids(loin).includes('salon-repas-eloignes')); assert.ok(loin.score < 0);
  assert.equal(ecartZones({ x0: 0, x1: 1, z0: 0, z1: 1 }, { x0: .5, x1: 2, z0: 0, z1: 1 }), 0);
});

test('relations : un coin lecture dans l’axe canapé → télévision est pénalisé, à côté il ne l’est pas', () => {
  const modele = rectangle(6, 5), salon = zone('salon', 'salon', -1.5, 1.5, -2.4, 1.6);
  const items = [{ id: 's', sku: 'canape', x: 0, z: 1, rot: Math.PI, zoneId: 'salon' }, { id: 't', sku: 'meuble', x: 0, z: -2.2, rot: 0, zoneId: 'salon', usageProgramme: 'meuble-tv' }];
  const dansAxe = scoreRelations(modele, [salon, zone('lecture', 'lecture', -.5, .5, -1.2, -.3)], items, CAT, 'salon');
  assert.ok(ids(dansAxe).includes('lecture-axe-ecran'));
  const aCote = scoreRelations(modele, [salon, zone('lecture', 'lecture', 1.8, 2.9, -2.4, -1.4)], items, CAT, 'salon');
  assert.ok(!ids(aCote).includes('lecture-axe-ecran'));
});

test('relations : l’accueil près de la porte, un coin calme contre la porte', () => {
  const modele = rectangle(6, 5); // porte sur le mur d’entrée (z = +2,5), vers x = 0,2
  const r = scoreRelations(modele, [zone('accueil', 'accueil', -.6, .9, 1.4, 2.5), zone('lecture', 'lecture', -.4, .8, 1.2, 2.2)], [], CAT, 'salon');
  assert.ok(ids(r).includes('accueil-porte')); assert.ok(ids(r).includes('calme-contre-porte'));
});

test('remplissage : un meuble seul dans un grand séjour laisse un vide et déséquilibre la pièce', () => {
  const modele = rectangle(8, 6), seul = [{ id: 'c', sku: 'canape', x: -3, z: -2.4, rot: 0 }];
  const r = evaluerRemplissage(modele, seul, CAT, {});
  assert.ok(ids(r).includes('grand-vide')); assert.ok(ids(r).includes('desequilibre')); assert.ok(r.score < -20);
  // Le même plan en style épuré reste jugé, mais le vide y est davantage permis.
  const epure = evaluerRemplissage(modele, seul, CAT, { preferences: { styles: ['epure'] } });
  assert.equal(epure.profil, 'epure'); assert.ok(epure.score > r.score);
  assert.equal(profilVide({ style: 'japandi' }), 'epure'); assert.equal(profilVide({}), 'standard');
});

test('remplissage : une pièce meublée sur ses murs n’a ni grand vide ni mur nu', () => {
  const modele = rectangle(5, 4), items = [
    { id: 'c', sku: 'canape', x: 0, z: 1.5, rot: Math.PI }, { id: 't', sku: 'meuble', x: 0, z: -1.78, rot: 0 },
    { id: 'b', sku: 'buffet', x: -2.25, z: 0, rot: Math.PI / 2 }, { id: 'f', sku: 'fauteuil', x: 2, z: 0, rot: -Math.PI / 2 }];
  const r = evaluerRemplissage(modele, items, CAT, {});
  assert.ok(!ids(r).includes('grand-vide')); assert.ok(!ids(r).includes('mur-nu')); assert.ok(!ids(r).includes('desequilibre'));
});

test('remplissage : un salon posé au milieu sans disposition flottante est un coin flottant', () => {
  const modele = rectangle(9, 7), items = [{ id: 'c', sku: 'canape', x: 0, z: .3, rot: Math.PI, zoneId: 'salon' }];
  const flottant = evaluerRemplissage(modele, items, CAT, { zones: [zone('salon', 'salon', -1.2, 1.2, -1, 1)] });
  assert.ok(ids(flottant).includes('coin-flottant'));
  const assume = evaluerRemplissage(modele, items, CAT, { zones: [zone('salon', 'salon', -1.2, 1.2, -1, 1, { dispositionUid: 'SL:1.2' })] });
  assert.ok(!ids(assume).includes('coin-flottant'));
});

test('variation : graine entière bornée, validée côté démo, transmise à la préparation', () => {
  for (let i = 0; i < 50; i++) { const v = tirerVariation(); assert.ok(variationValide(v)); assert.ok(v >= 1 && v <= VARIATION_MAX); }
  for (const v of [0, -3, 1.5, '12', VARIATION_MAX + 1, null]) assert.equal(variationValide(v), false);
  assert.equal(preparerAmenagement([], { variation: 42 }).variation, 42);
  assert.equal(preparerAmenagement([], { variation: '42' }).variation, 0);
  assert.equal(preparerAmenagement([], {}).variation, 0);
  const piece = { fonction: 'salon', modele: rectangle(5, 4), agencement: [], notes: '' };
  assert.equal(validerDemoIA(demandeDemoIA(piece, { variation: 77 }, 'fr'), PRODUITS).choix.variation, 77);
  assert.equal(validerDemoIA(demandeDemoIA(piece, {}, 'fr'), PRODUITS).choix.variation, undefined);
  const forge = demandeDemoIA(piece, {}, 'fr'); forge.choix.variation = 'x';
  assert.throws(() => validerDemoIA(forge, PRODUITS), ErreurDemoIA);
  // Générateur à graine : même graine, même suite.
  const a = aleatoire(7), b = aleatoire(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.equal(signatureDispositions([{ type: 'repas' }, { type: 'salon', dispositionUid: 'SL:1.3', strategie: 'canape-lateral' }]), 'repas:-:-|salon:SL:1.3:canape-lateral');
});

function amenager(modele, fonction, choix) {
  const prep = preparerAmenagement([], { budget: 0, ...choix });
  const candidats = choisirCandidats(PRODUITS, { modele, fonction, ...prep });
  return appliquerProposition({ modele, prep, fonction, produits: PRODUITS, proposition: { meubles: [] }, candidats });
}
const plan = r => r.agencement.map(it => `${it.sku}:${it.x}:${it.z}:${Math.round((it.rot || 0) * 100)}`).sort().join('|');

test('réaménager : même graine, même plan ; graines différentes, plusieurs dispositions sûres', () => {
  const modele = () => rectangle(4.5, 4), choix = { envies: 'Salon chaleureux', encyclopedie: true };
  assert.equal(plan(amenager(modele(), 'salon', choix)), plan(amenager(modele(), 'salon', { ...choix, variation: 0 })));
  assert.equal(plan(amenager(modele(), 'salon', { ...choix, variation: 3 })), plan(amenager(modele(), 'salon', { ...choix, variation: 3 })));
  const plans = new Set(), dispositions = new Set();
  for (const variation of [0, 1, 2, 3, 4, 5]) {
    const r = amenager(modele(), 'salon', { ...choix, variation });
    assert.equal(r.proposition.planZones.statut, 'compose', `variation ${variation}`);
    assert.equal(r.proposition.planZones.audit.valide, true, `variation ${variation}`);
    assert.deepEqual(verifier(modele(), r.agencement, PRODUITS), [], `variation ${variation}`);
    plans.add(plan(r)); for (const z of r.proposition.planZones.zones) if (z.dispositionUid) dispositions.add(`${z.dispositionUid}:${z.strategie}`);
  }
  assert.ok(plans.size >= 2, 'plusieurs plans distincts'); assert.ok(dispositions.size >= 2, [...dispositions].join(', '));
  // Au moins une disposition où le canapé n’est pas face à la télévision.
  assert.ok([...dispositions].some(d => /canape-lateral|conversation-laterale/.test(d)), [...dispositions].join(', '));
});

test('canapé sur le côté : le canapé tourne d’un quart de tour et un fauteuil fait face à l’écran', () => {
  for (let variation = 0; variation <= 12; variation++) {
    const r = amenager(rectangle(6, 5), 'salon', { envies: 'Salon chaleureux', encyclopedie: true, variation });
    const salon = r.proposition.planZones.zones.find(z => z.type === 'salon');
    if (salon?.strategie !== 'canape-lateral') continue;
    const es = r.agencement.filter(it => it.zoneId === salon.id).map(it => ({ it, p: produitDe(it, PRODUITS) }));
    const sofa = es.find(e => e.p.fam === 'canape'), meuble = es.find(e => e.it.usageProgramme === 'meuble-tv'), fauteuil = es.find(e => e.p.fam === 'fauteuil');
    const quart = Math.abs(Math.abs(((sofa.it.rot - meuble.it.rot) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) - Math.PI / 2);
    assert.ok(quart < .05, 'canapé perpendiculaire à l’écran');
    // Le fauteuil regarde l’écran : sa face avant pointe vers le meuble TV.
    const fx = Math.sin(fauteuil.it.rot), fz = Math.cos(fauteuil.it.rot), dx = meuble.it.x - fauteuil.it.x, dz = meuble.it.z - fauteuil.it.z;
    assert.ok((fx * dx + fz * dz) / Math.hypot(dx, dz) > .9, 'fauteuil face à l’écran');
    return;
  }
  assert.fail('aucune des graines essayées ne donne la disposition canapé sur le côté');
});

test('vis-à-vis à écran latéral : le réglage fin ne ramène pas l’écran face au canapé', () => {
  const quart = (a, b) => Math.abs(Math.abs(((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) - Math.PI / 2);
  for (const variation of [0, 1, 3, 5, 6]) {
    const r = amenager(rectangle(4.5, 4), 'salon', { envies: 'Salon chaleureux', encyclopedie: true, variation });
    const salon = r.proposition.planZones.zones.find(z => z.type === 'salon');
    if (salon?.strategie !== 'conversation-laterale') continue;
    const es = r.agencement.filter(it => it.zoneId === salon.id).map(it => ({ it, p: produitDe(it, PRODUITS) }));
    const sofa = es.find(e => e.p.fam === 'canape'), meuble = es.find(e => e.it.usageProgramme === 'meuble-tv');
    assert.ok(quart(sofa.it.rot || 0, meuble.it.rot || 0) < .05, 'écran sur le côté du canapé');
    for (const f of es.filter(e => e.p.fam === 'fauteuil')) {
      const dx = sofa.it.x - f.it.x, dz = sofa.it.z - f.it.z;
      assert.ok((Math.sin(f.it.rot) * dx + Math.cos(f.it.rot) * dz) / Math.hypot(dx, dz) > .7, 'fauteuil tourné vers le canapé');
    }
    assert.ok(sofa.it.dispositionStrategie === 'conversation-laterale');
    return;
  }
  assert.fail('aucune des graines essayées ne donne le vis-à-vis à écran latéral');
});

test('petites pièces : le lit compact et la table réduite plutôt que pas de lit ni de table', () => {
  const chambre = amenager(rectangle(3, 3.5), 'chambre', { envies: 'Chambre japandi' });
  assert.ok(chambre.agencement.some(it => produitDe(it, PRODUITS)?.fam === 'lit'), 'un lit est posé');
  const sam = amenager(rectangle(5, 3), 'salle_a_manger', { envies: 'Salle à manger classique' });
  assert.ok(sam.agencement.some(it => it.usageProgramme === 'table-repas'), 'une table est posée');
  assert.ok(sam.agencement.filter(it => it.usageProgramme === 'chaise-repas').length >= 2);
  // Le nombre de places imposé par le client n’est jamais réduit en silence.
  const impose = amenager(rectangle(5, 3), 'salle_a_manger', { envies: 'Salle à manger', placesRepas: 6 });
  const chaises = impose.agencement.filter(it => it.usageProgramme === 'chaise-repas').length;
  assert.ok(chaises === 0 || chaises === 6 || impose.proposition.programme.manquants.some(s => s.usage === 'chaise-repas'));
});
