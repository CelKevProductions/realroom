import {cp, mkdir, writeFile, access} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.argv[2] || resolve(root,'outputs/hf-space'));
if(output===root || root.startsWith(output+'/'))throw Error('Choisissez un dossier de sortie séparé du dépôt.');
// Explicit allowlist: never copy credentials, browser data, Git history or unrelated source.
const files=[
  'lib/model.mjs','lib/design-provider.mjs','lib/design-selection.mjs',
  'lib/validation.mjs','lib/geometry.mjs','lib/design-quality.mjs','lib/catalog.mjs',
  'lib/catalogue-generique.js','lib/catalogue-dimensions.js','lib/design-objects.js','lib/examples.mjs',
  'data/catalogue.json','services/furnishing/server.mjs','services/furnishing/jobs.mjs',
  'services/furnishing/render-plan.mjs','services/furnishing/render-plan.py',
  'services/furnishing/start.py','services/furnishing/model.json',
  'scripts/check-furnishing.mjs','docs/huggingface-backend.md','docs/choix-moteur-ameublement.md',
];
try { await access(output); throw Error('Le dossier de sortie existe déjà. Choisissez un nouveau dossier vide.'); } catch(e) { if(e.code!=='ENOENT')throw e; }
for(const file of files) {
  await mkdir(dirname(resolve(output,file)),{recursive:true});
  await cp(resolve(root,file),resolve(output,file));
}
await cp(resolve(root,'services/furnishing/Dockerfile'),resolve(output,'Dockerfile'));
await cp(resolve(root,'services/furnishing/space-card.md'),resolve(output,'README.md'));
await writeFile(resolve(output,'package.json'),JSON.stringify({name:'realroom-furnishing',private:true,type:'module',engines:{node:'>=22.13.0'},scripts:{start:'node services/furnishing/server.mjs'}},null,2)+'\n');
console.log(JSON.stringify({output,files:files.length+3}));
