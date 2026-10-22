import test from 'node:test';
import assert from 'node:assert/strict';
import { executerAssistant } from '../../lib/assistant-amenagement.js';
import { PRODUITS } from '../../lib/catalogue.js';
import { produitDe } from '../../lib/agencement.js';
import { rectangle } from '../fixtures/bench-chambres.js';
import { quatDepuisRot, rotDepuisQuat, jsonPython, instruction, sceneSSR, descriptionAnglaise, varianteRespace, amenagerAvecRespace, configRespace, codeDemoValide } from '../../lib/moteurs/respace.js';

test('ReSpace : repères, format d’entrée du modèle et accès de la démo', () => {
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2, .3]) assert.ok(Math.abs(Math.sin((rotDepuisQuat(quatDepuisRot(r)) - r) / 2)) < 1e-4);
  assert.equal(jsonPython({ a: [1, 2.5], b: 'x' }), '{"a": [1.0, 2.5], "b": "x"}');
  const scene = sceneSSR(rectangle(4, 3), 'chambre', []);
  assert.deepEqual(scene.bounds_bottom.map(p => p[1]), [0, 0, 0, 0]);
  assert.ok(instruction('double bed', scene).startsWith('<instruction>\n\t<add>double bed</add>\n</instruction>\n<scenegraph>\n\t{"room_type": "bedroom"'));
  assert.equal(configRespace({ RESPACE_URL: 'https://x/v1/', RESPACE_CODE: 'c' }).actif, false, 'accord non commercial explicite exigé');
  const cfg = configRespace({ RESPACE_DEMO: '1', RESPACE_URL: 'https://x/v1/', RESPACE_CODE: 'secret' });
  assert.equal(cfg.url, 'https://x');
  assert.equal(codeDemoValide(cfg, 'secret'), true);
  assert.equal(codeDemoValide(cfg, 'autre'), false);
});

test('ReSpace seul : une proposition de plus parmi les variantes, dimensions du catalogue, positions brutes', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Aucun appel externe autorisé'); });
  const base = executerAssistant({ fonction: 'salon', modele: rectangle(5, 5), agencement: [] }, { action: 'generer', espaces: ['repas'], placesRepas: 4, budget: 9000 }, PRODUITS);
  const piece = JSON.parse(JSON.stringify({ fonction: 'salon', modele: rectangle(5, 5), agencement: base.agencement, proposition: base.proposition }));
  // faux modèle : rend la position du moteur, en miroir gauche-droite (une autre disposition)
  const libres = new Map(), remplir = () => { libres.clear(); for (const it of piece.agencement) { const d = descriptionAnglaise(it, produitDe(it, PRODUITS)); libres.set(d, [...(libres.get(d) || []), it]); } };
  remplir();
  const appel = async texte => {
    const desc = texte.match(/<add>(.*)<\/add>/)[1], it = libres.get(desc)?.shift();
    if (!it) return 'pas du JSON';
    return JSON.stringify({ desc, size: [1, 1, 1], pos: [-it.x, 0, it.z], rot: quatDepuisRot(-(it.rot || 0)) });
  };
  const r = await varianteRespace(piece, PRODUITS, { appel, echantillons: 1 });
  const m = r.proposition.moteur;
  assert.equal(m.type, 'respace');
  assert.ok(m.places > 0 && m.places <= m.total, JSON.stringify(m));
  assert.equal(r.proposition.variantes.liste.length, 2, 'la première proposition est gardée');
  assert.deepEqual(r.agencement.map(it => it.sku).sort(), piece.agencement.map(it => it.sku).sort(), 'mêmes meubles, mêmes dimensions');
  assert.ok(r.agencement.some(it => { const a = piece.agencement.find(b => b.id === it.id); return Math.abs(a.x - it.x) > .05; }), 'disposition changée');
  // aucune retouche du moteur : chaque meuble posé est exactement là où le modèle l'a dit
  const poses = r.agencement.filter(it => { const a = piece.agencement.find(b => b.id === it.id); return a && Math.abs(it.x + a.x) < 1e-9 && it.x !== a.x; });
  assert.ok(poses.length >= m.places, 'positions du modèle, telles quelles (objets posés dessus compris)');
  await assert.rejects(varianteRespace(piece, PRODUITS, { appel: async () => '???', echantillons: 1 }), { code: 'respace-aucun' });
  // un meuble sans réponse lisible est retiré et nommé, sans place reprise du moteur
  remplir();
  const plusGrand = piece.agencement.map(it => ({ it, p: produitDe(it, PRODUITS) })).filter(e => e.it.usageProgramme === 'canape')[0];
  const sansCanape = await varianteRespace(piece, PRODUITS, { appel: async (texte, o) => (texte.includes('<add>' + descriptionAnglaise(plusGrand.it, plusGrand.p) + '</add>') ? '???' : appel(texte, o)) });
  assert.ok(!sansCanape.agencement.some(it => it.id === plusGrand.it.id), 'canapé retiré');
  assert.deepEqual(sansCanape.proposition.moteur.nonPoses, [plusGrand.p.nom]);
  // « Aménager » : la pose de ReSpace remplace la proposition du moteur au lieu de s'y ajouter
  remplir();
  const a = await amenagerAvecRespace(piece, base, PRODUITS, { appel, echantillons: 1 });
  assert.equal(a.proposition.moteur.type, 'respace');
  assert.equal(a.proposition.variantes.liste.length, 1);
});

test('contraintes : un meuble gardé « peut être déplacé » bouge, un meuble « reste à cet endroit » non', async () => {
  const { ecartsContraintes, contraintesDe, verrouillerDimensions, sceneDepuisPiece } = await import('../../lib/scene.js');
  const meuble = { id: 'e1', origine: 'existant', x: 1, z: 0, rot: 0, p: { fam: 'canape', dim: [2, .9, .8], nom: 'Canapé' } };
  assert.deepEqual(contraintesDe(meuble), { conserver: false, dimensionsFixes: false, positionFixe: true, rotationFixe: true });
  const bouge = [{ ...meuble, x: -1 }];
  assert.deepEqual(ecartsContraintes([meuble], bouge, PRODUITS).map(e => e.contrainte), ['positionFixe']);
  assert.deepEqual(ecartsContraintes([{ ...meuble, contraintes: { positionFixe: false } }], bouge, PRODUITS), []);
  assert.deepEqual(ecartsContraintes([{ ...meuble, contraintes: { positionFixe: false } }], [{ ...meuble, x: -1, rot: 1 }], PRODUITS), []);
  assert.deepEqual(ecartsContraintes([{ ...meuble, contraintes: { positionFixe: false, rotationFixe: true } }], [{ ...meuble, x: -1, rot: 1 }], PRODUITS).map(e => e.contrainte), ['rotationFixe']);
  const verrou = { ...meuble, contraintes: { dimensionsFixes: true } };
  assert.deepEqual(verrouillerDimensions([verrou], [{ ...verrou, p: { ...verrou.p, dim: [3, .9, .8] } }])[0].p.dim, [2, .9, .8]);
  const scene = sceneDepuisPiece({ modele: rectangle(4, 3), agencement: [meuble] }, PRODUITS, { version: 2 });
  assert.equal(scene.format, 'realroom-scene-v1');
  assert.deepEqual(scene.objets[0].dim, { largeur: 2, profondeur: .9, hauteur: .8 });
  assert.equal(scene.murs.length, 4);
});
