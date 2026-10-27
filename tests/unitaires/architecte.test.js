// Claude « architecte » : partis au vocabulaire fermé, suivis par le moteur, requête sortante sans réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executerAssistant } from '../../lib/assistant-amenagement.js';
import { PRODUITS } from '../../lib/catalogue.js';
import { normaliserPartis, schemaPartis, partisAttendus } from '../../lib/architecte.js';
import { segmentsDe, distanceSegment } from '../../lib/contour.js';
import { rectangle } from '../fixtures/bench-chambres.js';

const programme = { zones: [{ id: 'salon', type: 'salon', slots: [] }, { id: 'repas', type: 'repas', slots: [] }] };

test('les partis de Claude sont réduits aux murs, espaces et relations de la pièce', () => {
  const modele = rectangle(5, 5);
  const schema = schemaPartis(modele, programme);
  assert.deepEqual(schema.properties.partis.items.properties.espaces.items.properties.adosse_a.enum, ['fond', 'droite', 'entree', 'gauche', 'centre', 'indifferent']);
  const partis = normaliserPartis({ partis: [
    { titre: 'Canapé au fond', idee: 'x', espaces: [{ espace: 'salon', adosse_a: 'fond', relations: [{ type: 'dos_a_espace', cible: 'repas' }, { type: 'inconnue', cible: null }] }, { espace: 'cuisine', adosse_a: 'fond', relations: [] }] },
    { titre: 'Doublon', idee: 'x', espaces: [{ espace: 'salon', adosse_a: 'fond', relations: [{ type: 'dos_a_espace', cible: 'repas' }] }] },
    { titre: 'Mur inconnu', idee: 'x', espaces: [{ espace: 'salon', adosse_a: 'pan_9', relations: [] }] },
    { titre: '', idee: 'y', espaces: [{ espace: 'repas', adosse_a: 'indifferent', relations: [{ type: 'pres_fenetre', cible: null }] }] }
  ] }, modele, programme);
  assert.deepEqual(partis, [
    { titre: 'Canapé au fond', idee: 'x', espaces: { salon: { adosse_a: 'fond', relations: [{ type: 'dos_a_espace', cible: 'repas' }] } } },
    { titre: 'Idée 2', idee: 'y', espaces: { repas: { relations: [{ type: 'pres_fenetre' }] } } }
  ]);
  const piece = { proposition: { variantes: { brief: { envies: 'b' }, source: [], architecte: { partis, prochain: 2 } } } };
  assert.deepEqual(partisAttendus(piece, { action: 'shuffle' }), { deja: partis, brief: { envies: 'b' }, agencement: [] }, 'idées épuisées : en redemander');
  assert.equal(partisAttendus({ proposition: { variantes: { architecte: { partis, prochain: 1 } } } }, { action: 'shuffle' }), null);
  assert.equal(partisAttendus(piece, { action: 'choisir' }), null);
});

test('le moteur adosse le canapé au mur choisi par Claude, puis Shuffle passe à l’idée suivante', () => {
  const modele = rectangle(5, 5), brief = { envies: 'Salon épuré avec télévision et repas', espaces: ['repas'], placesRepas: 4, budget: 9000, encyclopedie: true };
  const partis = ['fond', 'droite'].map(mur => ({ titre: 'Canapé ' + mur, idee: '', espaces: { salon: { adosse_a: mur, relations: [] } } }));
  const dos = (r, mur) => {
    const c = r.agencement.find(it => it.usageProgramme === 'canape'), p = PRODUITS[c.sku], pan = segmentsDe(modele).find(s => s.id === mur);
    return distanceSegment([c.x - Math.sin(c.rot) * p.dim[1] / 2, c.z - Math.cos(c.rot) * p.dim[1] / 2], pan.a, pan.b);
  };
  let piece = { fonction: 'salon', modele, agencement: [] };
  const r = executerAssistant(piece, { action: 'generer', ...brief, partis }, PRODUITS);
  assert.equal(r.proposition.variantes.selection, 'a0');
  assert.equal(r.proposition.planZones.audit.valide, true);
  assert.ok(dos(r, 'fond') < .15, 'dos du canapé contre le mur du fond');
  piece = JSON.parse(JSON.stringify({ ...piece, agencement: r.agencement, proposition: r.proposition }));
  const suite = executerAssistant(piece, { action: 'shuffle' }, PRODUITS);
  assert.equal(suite.proposition.variantes.selection, 'a1');
  assert.equal(suite.proposition.moteur.architecte.titre, 'Canapé droite');
  assert.ok(dos(suite, 'droite') < .15, 'dos du canapé contre le mur de droite');
  assert.deepEqual(suite.proposition.variantes.architecte.prochain, 2);
});

test('la demande à Claude : modèle de l’architecte, repli serveur, schéma fermé ; refusée, elle repart sur le modèle du projet', async () => {
  const noms = ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODELE'];
  const ancien = Object.fromEntries(noms.map(k => [k, process.env[k]])), fetchOriginal = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = 'test-sans-reseau';
  const appels = [], reponse = { partis: [{ titre: 'Canapé au fond', idee: 'x', espaces: [{ espace: 'salon', adosse_a: 'fond', relations: [] }] }] };
  globalThis.fetch = async (url, options) => {
    const request = url instanceof Request ? url : null, entetes = new Headers(request ? request.headers : options.headers);
    const corps = JSON.parse(request ? await request.text() : options.body);
    appels.push({ url: String(request ? request.url : url), beta: entetes.get('anthropic-beta'), corps });
    if (appels.length === 1) return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'test' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: corps.model, content: [{ type: 'text', text: JSON.stringify(reponse) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const { proposerPartis } = await import('../../lib/claude.js');
    const { MODELES } = await import('../../lib/config.js');
    const modele = rectangle(5, 5);
    const { json } = await proposerPartis({ description: { murs: [] }, schema: schemaPartis(modele, programme), envies: 'Japandi' });
    assert.deepEqual(json, reponse);
    assert.equal(appels.length, 2);
    assert.equal(appels[0].corps.model, MODELES.architecte);
    assert.equal(appels[0].corps.fallbacks, 'default');
    assert.match(appels[0].beta, /server-side-fallback-2026-07-01/);
    assert.ok(appels[0].corps.output_config.format.schema.properties.partis);
    assert.equal(appels[1].corps.model, MODELES.claude);
    assert.equal(appels[1].corps.fallbacks, undefined);
    assert.ok(!/fallback/.test(appels[1].beta || ''));
    assert.match(appels[1].corps.messages[0].content[0].text, /Japandi/);
  } finally {
    globalThis.fetch = fetchOriginal;
    for (const k of noms) if (ancien[k] === undefined) delete process.env[k]; else process.env[k] = ancien[k];
  }
});
