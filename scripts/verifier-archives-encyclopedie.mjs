import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dossier='docs/encyclopedie';
let appels=0,cout=0;
for(const nom of ['vision-iteration-1.json','vision-iteration-2.json','vision-iteration-3.json','vision.json']){
 const archive=JSON.parse(await fs.readFile(dossier+'/'+nom));
 for(const c of archive.comparaisons){
  for(const e of c.empreintes){const b=await fs.readFile(dossier+'/'+e.nom);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256,e.nom);}
  if(nom==='vision.json')assert.equal(c.critique.prefere,c.apres);else assert.notEqual(c.critique.prefere,c.apres);
  appels++;cout+=c.usage.cost;
 }
}
assert.equal(appels,8);assert.ok(Math.abs(cout-.0338985)<1e-9);
console.log(JSON.stringify({appelsVision:appels,coutVisionUSD:+cout.toFixed(7),classementFinal:'apres-prefere-dans-les-deux-ordres',iterationsPrecedentes:3,empreintes:'toutes-verifiees',appelsExternesDeVerification:0}));
