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

for (const [nom, statut, corps, code] of [
  ['clé invalide', 401, { error: { message: 'Invalid API key' } }, 'cle'],
  ['paiement requis', 402, {}, 'credits-ia'],
  ['solde épuisé dans detail', 403, { detail: 'User is locked. Reason: Exhausted balance.' }, 'credits-ia'],
  ['crédits insuffisants dans error', 403, { error: { code: 'insufficient_credits', message: 'Credit allowance exceeded' } }, 'credits-ia'],
  ['plafond de facturation', 429, { error: { message: 'Billing hard limit reached' } }, 'credits-ia'],
  ['permission refusée', 403, { error: { message: 'Permission denied' } }, 'acces-ia'],
  ['compte verrouillé pour une raison inconnue', 403, { detail: 'User is locked.' }, 'acces-ia']
]) test(`Fal : ${nom}, sans nouvelle tentative ni fuite du message brut`, async t => {
  let appels = 0;
  const reponse = { ...corps, message: 'détail privé à ne pas transmettre' };
  t.mock.method(globalThis, 'fetch', async () => {
    appels++;
    return Response.json(reponse, { status: statut });
  });
  await assert.rejects(proposerAmenagement(demande, { reel: true }), e => {
    assert.equal(e.code, code);
    assert.equal(e.statutFournisseur, statut);
    assert.equal(e.fournisseur, 'fal');
    assert.equal(e.message, code);
    return true;
  });
  assert.equal(appels, 1, 'changer de modèle ne peut pas corriger ce blocage');
});

test('un refus pour solde épuisé ne bloque pas une future demande rétablie', async t => {
  let appels = 0;
  t.mock.method(globalThis, 'fetch', async () => ++appels === 1
    ? Response.json({ detail: 'User is locked. Reason: Exhausted balance.' }, { status: 403 })
    : Response.json({ choices: [{ message: { content: JSON.stringify(resultat) }, finish_reason: 'stop' }], usage: {} }));
  await assert.rejects(proposerAmenagement(demande, { reel: true }), e => e.code === 'credits-ia');
  assert.deepEqual((await proposerAmenagement(demande, { reel: true })).proposition, resultat);
  assert.equal(appels, 2);
});
