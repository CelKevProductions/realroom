import test from 'node:test';
import assert from 'node:assert/strict';
import { executerAssistant } from '../../lib/assistant-amenagement.js';
import { PRODUITS } from '../../lib/catalogue.js';
import { produitDe } from '../../lib/agencement.js';
import { rectangle } from '../fixtures/bench-chambres.js';
import { quatDepuisRot, rotDepuisQuat, jsonPython, instruction, sceneSSR, descriptionAnglaise, varianteRespace, configRespace, codeDemoValide } from '../../lib/moteurs/respace.js';

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

test('ReSpace : une proposition de plus parmi les variantes, dimensions du catalogue, repli du moteur', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Aucun appel externe autorisé'); });
  const base = executerAssistant({ fonction: 'salon', modele: rectangle(5, 5), agencement: [] }, { action: 'generer', espaces: ['repas'], placesRepas: 4, budget: 9000 }, PRODUITS);
  const piece = JSON.parse(JSON.stringify({ fonction: 'salon', modele: rectangle(5, 5), agencement: base.agencement, proposition: base.proposition }));
  // faux modèle : rend la position du moteur, en miroir gauche-droite (une autre disposition)
  const libres = new Map();
  for (const it of piece.agencement) { const d = descriptionAnglaise(it, produitDe(it, PRODUITS)); libres.set(d, [...(libres.get(d) || []), it]); }
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
  await assert.rejects(varianteRespace(piece, PRODUITS, { appel: async () => '???', echantillons: 1 }), { code: 'respace-aucun' });
});
