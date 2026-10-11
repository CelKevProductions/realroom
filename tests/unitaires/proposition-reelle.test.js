import test from 'node:test';
import assert from 'node:assert/strict';
// Aucun appel externe : exercer les vrais adaptateurs, même avec la simulation de prévisualisation.
process.env.REALROOM_SIMULATION = '1';
process.env.VERCEL_ENV = 'preview';
delete process.env.ANTHROPIC_API_KEY;
process.env.FAL_KEY = 'test-sans-reseau';
const { proposerAmenagement } = await import('../../lib/claude.js');
const demande = { piece: { dimensions: { largeur: 4, profondeur: 5, hauteur: 2.5 }, meubles: [] }, fonction: 'salon', mode: 'tout', candidats: {}, budget: 900 };
const resultat = { concept: 'Une proposition du modèle', inspiration: null, meubles: [], retirer: [], conseils: [] };

test('l’aménagement réel traverse Fal malgré REALROOM_SIMULATION et transmet le budget au modèle', async t => {
  const appels = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    appels.push({ url, corps: JSON.parse(options.body) });
    return Response.json({ choices: [{ message: { content: JSON.stringify(resultat) }, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 3 } });
  });
  await proposerAmenagement(demande);
  assert.equal(appels.length, 0, 'les appels de test ordinaires restent simulés');
  const r = await proposerAmenagement(demande, { reel: true, maxTokens: 12000 });
  assert.equal(appels.length, 1); assert.deepEqual(r.proposition, resultat);
  assert.equal(appels[0].url, 'https://fal.run/openrouter/router/openai/v1/chat/completions');
  assert.equal(appels[0].corps.max_tokens, 12000);
  assert.match(appels[0].corps.messages[1].content[0].text, /Budget for new pieces: 900/);
  assert.equal(r.usage.modele, appels[0].corps.model);
  assert.ok(appels[0].corps.response_format.json_schema.schema.required.includes('meubles'));
  const schema = appels[0].corps.response_format.json_schema.schema;
  assert.ok(schema.required.includes('planVie'));
  assert.deepEqual(Object.keys(schema.properties.planVie.items.properties).sort(), ['priorite', 'raison', 'type']);
  assert.match(appels[0].corps.messages[1].content[0].text, /Functional programme.*"surface":20/);
});

test('une clé manquante ou une erreur du fournisseur ne produit jamais un aménagement simulé', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'erreur de test' } }, { status: 401 }));
  await assert.rejects(proposerAmenagement(demande, { reel: true }), e => e.code === 'cle');
  delete process.env.FAL_KEY;
  try { await assert.rejects(proposerAmenagement(demande, { reel: true }), e => e.code === 'cle'); }
  finally { process.env.FAL_KEY = 'test-sans-reseau'; }
});
