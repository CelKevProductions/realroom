// Contrat sortant des deux fournisseurs : aucune requête réseau, aucune interprétation visuelle réelle.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('les inspirations arrivent dans la proposition vision, jamais dans le relevé, via Anthropic et fal', async () => {
  const noms = ['REALROOM_SIMULATION', 'ANTHROPIC_API_KEY', 'FAL_KEY'];
  const ancien = Object.fromEntries(noms.map(k => [k, process.env[k]])), fetchOriginal = globalThis.fetch;
  process.env.REALROOM_SIMULATION = '0';
  const appels = [], resultat = { concept: 'Exemple', retirer: [], meubles: [], conseils: [], inspiration: null };
  globalThis.fetch = async (url, options) => {
    const request = url instanceof Request ? url : null;
    const corps = JSON.parse(request ? await request.text() : options.body);
    appels.push(corps);
    return new Response(JSON.stringify(corps.messages[0].role === 'system'
      ? { choices: [{ message: { content: JSON.stringify(resultat) }, finish_reason: 'stop' }], usage: {} }
      : { id: 'msg_test', type: 'message', role: 'assistant', model: corps.model, content: [{ type: 'text', text: JSON.stringify(resultat) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }),
    { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const { proposerAmenagement, analyserPiece } = await import('../../lib/claude.js');
    const image = 'data:image/jpeg;base64,/9j/AA==';
    for (const fournisseur of ['anthropic', 'fal']) {
      if (fournisseur === 'anthropic') { process.env.ANTHROPIC_API_KEY = 'test-sans-reseau'; delete process.env.FAL_KEY; }
      else { delete process.env.ANTHROPIC_API_KEY; process.env.FAL_KEY = 'test-sans-reseau'; }
      await proposerAmenagement({ piece: { dimensions: { largeur: 4, profondeur: 5, hauteur: 2.5 } }, candidats: {}, fonction: 'salon', mode: 'tout', inspirations: [{ dataUri: image }] });
      const proposition = appels.at(-1), contenu = proposition.messages.at(-1).content;
      assert.equal(contenu.filter(c => ['image', 'image_url'].includes(c.type)).length, 1);
      assert.ok(contenu.some(c => c.type === 'text' && /not the client's room/.test(c.text)));
      const schema = fournisseur === 'anthropic' ? proposition.output_config.format.schema : proposition.response_format.json_schema.schema;
      assert.ok(schema.required.includes('inspiration'));
      await analyserPiece({ fonction: 'salon', photos: [{ role: 'inspiration', dataUri: image }, { role: 'entree', dataUri: image }] });
      const releve = appels.at(-1).messages.at(-1).content;
      assert.equal(releve.filter(c => ['image', 'image_url'].includes(c.type)).length, 1);
      assert.ok(!releve.some(c => c.type === 'text' && /Inspiration/.test(c.text)));
    }
    assert.equal(appels.length, 4);
  } finally {
    globalThis.fetch = fetchOriginal;
    for (const k of noms) if (ancien[k] === undefined) delete process.env[k]; else process.env[k] = ancien[k];
  }
});
