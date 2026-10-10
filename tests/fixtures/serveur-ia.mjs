// Double de fournisseur chargé seulement par le serveur des tests API. Pas de drapeau de mock public.
import fs from 'node:fs';
import catalogue from '../../data/catalogue.json' with { type: 'json' };

const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url) !== 'https://fal.run/openrouter/router/openai/v1/chat/completions') return fetchOriginal(url, options);
  const corps = JSON.parse(options.body);
  if (process.env.DEMO_FAL_REFUS === '1') return Response.json({ error: 'Clé de test refusée' }, { status: 401 });
  const texte = corps.messages.at(-1).content.find(c => c.type === 'text').text;
  const ids = [...texte.matchAll(/^([^\s|]+) \|/gm)].map(m => m[1]);
  const p = ids.map(id => catalogue.produits[id]).find(p => p && ['table', 'lampe'].includes(p.fam));
  const proposition = { concept: 'Proposition IA du fournisseur de test.', inspiration: null, retirer: [], conseils: [], meubles: p ? [{ produit: p.id, alternatives: [], zone: p.fam === 'lampe' ? 'eclairage' : 'decoration', raison: 'Compléter une fonction sans bloquer les passages.' }] : [] };
  fs.appendFileSync(process.env.DEMO_FAL_AUDIT, JSON.stringify(corps) + '\n');
  return Response.json({ choices: [{ message: { content: JSON.stringify(proposition) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 20 } });
};
