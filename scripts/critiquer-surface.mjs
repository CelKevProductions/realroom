// Sans --executer : protocole et empreintes seulement, aucun appel payant.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const dossier = path.resolve('docs/composition-surface');
const protocole = JSON.parse(await fs.readFile(path.join(dossier, 'protocole-vision.json'), 'utf8'));
const cas = process.argv.find(a => a.startsWith('--cas='))?.slice(6);
const comparaisons = protocole.comparaisons.filter(c => !cas || c.id === cas);
if (!comparaisons.length) throw new Error('Cas inconnu.');
const executer = process.argv.includes('--executer');
if (executer && !process.env.FAL_KEY) throw new Error('FAL_KEY nécessaire pour lancer les critiques facturables.');
const resultats = [];
for (const c of comparaisons) {
  const input = { ...protocole.input, ...c.inputOverrides };
  const fichiers = await Promise.all(c.images.map(async nom => {
    const b = await fs.readFile(path.join(dossier, nom));
    return { nom, sha256: createHash('sha256').update(b).digest('hex'), data: 'data:image/jpeg;base64,' + b.toString('base64') };
  }));
  console.log(JSON.stringify({ id: c.id, images: fichiers.map(({ nom, sha256 }) => ({ nom, sha256 })), input: { ...input, prompt: c.prompt } }));
  if (!executer) continue;
  // Une seule soumission par cas, sans reprise automatique. Le module de rendu du produit reste indépendant.
  const r = await fetch('https://fal.run/' + protocole.endpoint_id, {
    method: 'POST', signal: AbortSignal.timeout(240000),
    headers: { Authorization: 'Key ' + process.env.FAL_KEY, 'Content-Type': 'application/json', 'X-Fal-Store-IO': '0', 'X-Fal-No-Retry': '1' },
    body: JSON.stringify({ ...input, prompt: c.prompt, image_urls: fichiers.map(f => f.data) })
  });
  if (!r.ok) throw new Error(`Fournisseur : HTTP ${r.status} pour ${c.id}. Aucun nouvel appel automatique.`);
  const data = await r.json();
  if (typeof data.output !== 'string') throw new Error('Sortie de critique absente.');
  const nettoyee = data.output.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let critique = null; try { critique = JSON.parse(nettoyee); } catch (_) {}
  resultats.push({ ...c, input, empreintes: fichiers.map(({ nom, sha256 }) => ({ nom, sha256 })), critique, sortie: data.output });
  // Ne conserver ni identifiant de compte/requête ni données de facturation.
  await fs.writeFile(path.join(dossier, 'vision-rejouee.json'), JSON.stringify({ endpoint_id: protocole.endpoint_id, resultats }, null, 2) + '\n');
}
if (!executer) console.log('Inspection uniquement. --executer lance les appels facturables ; --cas=30-direct limite à un cas.');
