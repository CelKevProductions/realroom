// Inspection locale par défaut. --executer soumet au plus un appel par cas, facturable.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const dossier=path.resolve('docs/staging');
const protocole=JSON.parse(await fs.readFile(path.join(dossier,'protocole-vision.json'),'utf8'));
const archive=JSON.parse(await fs.readFile(path.join(dossier,'vision.json'),'utf8'));
const cas=process.argv.find(a=>a.startsWith('--cas='))?.slice(6);
const comparaisons=protocole.comparaisons.filter(c=>!cas||c.id===cas);
if(!comparaisons.length)throw new Error('Cas inconnu.');
const executer=process.argv.includes('--executer');
if(executer&&!process.env.FAL_KEY)throw new Error('FAL_KEY nécessaire pour les critiques facturables.');
const resultats=[];
for(const c of comparaisons) {
  const fichiers=await Promise.all(c.images.map(async nom=>{
    const b=await fs.readFile(path.join(dossier,nom));
    const sha256=createHash('sha256').update(b).digest('hex');
    assert.equal(sha256,protocole.images.find(f=>f.nom===nom)?.sha256,nom+' : image différente du protocole');
    return{nom,sha256,data:'data:image/jpeg;base64,'+b.toString('base64')};
  }));
  const historique=archive.comparaisons.find(q=>q.id===c.id);
  assert.deepEqual(fichiers.map(({nom,sha256})=>({nom,sha256})),historique.empreintes);
  assert.equal(historique.critique.prefere,c.apres);
  if(c.id==='10-minimal')assert.equal(historique.critique.B_surcharge,false);
  console.log(JSON.stringify({id:c.id,images:fichiers.map(({nom,sha256})=>({nom,sha256})),critiqueArchivee:historique.critique,promptOriginalArchive:c.promptOriginalArchive}));
  if(!executer)continue;
  const r=await fetch('https://fal.run/'+protocole.endpoint_id,{
    method:'POST',signal:AbortSignal.timeout(240000),
    headers:{Authorization:'Key '+process.env.FAL_KEY,'Content-Type':'application/json','X-Fal-Store-IO':'0','X-Fal-No-Retry':'1'},
    body:JSON.stringify({...protocole.input,prompt:c.prompt,image_urls:fichiers.map(f=>f.data)})
  });
  if(!r.ok)throw new Error(`HTTP ${r.status} : ${c.id}. Aucun nouvel appel automatique.`);
  const data=await r.json();
  if(typeof data.output!=='string')throw new Error('Sortie absente.');
  let critique=null;
  try{critique=JSON.parse(data.output.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch(_){}
  resultats.push({...c,input:protocole.input,empreintes:fichiers.map(({nom,sha256})=>({nom,sha256})),critique,sortie:data.output});
  // Identifiants de compte/requête et facturation ne sont jamais enregistrés.
  await fs.writeFile(path.join(dossier,'vision-rejouee.json'),JSON.stringify({endpoint_id:protocole.endpoint_id,resultats},null,2)+'\n');
}
if(!executer)console.log('Archives vérifiées : après préféré dans les deux ordres à 89 m² ; 10 m² non surchargé. Aucun appel externe. --executer est facturable ; --cas=89-direct limite à un cas.');
