import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {EXAMPLE_ROOM,EXAMPLE_L_ROOM,EMPTY_SCENE} from '../lib/examples.mjs';
import {evaluate,normalizeScene} from '../lib/validation.mjs';
import {assess} from '../lib/design-quality.mjs';
const base=(process.env.REALROOM_FURNISHING_URL || 'http://127.0.0.1:7860').replace(/\/$/,'');
const key=process.env.REALROOM_FURNISHING_KEY || process.env.REALROOM_SERVICE_KEY;
const headers={'Content-Type':'application/json',...(key?{'x-realroom-service-key':key}:{}),
  ...(process.env.REALROOM_HF_TOKEN?{Authorization:'Bearer '+process.env.REALROOM_HF_TOKEN}:{})};
async function request(path,options={}) {
  const r=await fetch(base+path,{...options,headers:{...headers,...options.headers},redirect:'error',signal:AbortSignal.timeout(30000)});
  const body=await r.json();
  if(!r.ok)throw Error('HTTP '+r.status+': '+(body.error || body.status || 'service indisponible'));
  return body;
}
const health=await request('/health');
console.log(JSON.stringify({stage:'health',...health}));
if(!process.argv.includes('--generate'))process.exit(0);
if(!key)throw Error('Configurez REALROOM_FURNISHING_KEY pour tester une génération.');
const input={operation:'create',room:structuredClone(process.argv.includes('--room-l')?EXAMPLE_L_ROOM:EXAMPLE_ROOM),
  brief:{roomType:'salon',activities:['lecture','musique'],wishes:'Salon chaleureux et sobre. Chêne clair, vert sauge et lin. Un piano droit, un coin lecture éclairé. Préserver un passage clair entre les portes.',budget:0,seats:4},
  scene:structuredClone(EMPTY_SCENE)};
input.room.verified=true;
async function compute(payload) {
  const job=await request('/v1/jobs',{method:'POST',headers:{'Idempotency-Key':randomUUID()},body:JSON.stringify(payload)});
  const deadline=Date.now()+35*60_000;
  let last='';
  try {
    while(Date.now()<deadline) {
      const status=await request('/v1/jobs/'+job.id);
      if(status.progress!==last){last=status.progress;console.log(JSON.stringify({stage:'progress',message:last}));}
      if(status.status==='succeeded')return status.result;
      if(['failed','cancelled'].includes(status.status))throw Error(status.error);
      await new Promise(resolve=>setTimeout(resolve,1500));
    }
    throw Error('Le test a dépassé 35 minutes.');
  } catch(e) {await request('/v1/jobs/'+job.id+'/cancel',{method:'POST'}).catch(()=>{});throw e;}
}
const started=Date.now(), result=await compute(input);
const checked=result.candidates.map(c=>({scene:normalizeScene(c.scene,input.room),report:assess(input.room,c.scene,input.brief,evaluate)}));
const summary={testedAt:new Date().toISOString(),model:health.model,revision:health.revision,elapsedSeconds:Math.round((Date.now()-started)/1000),
  room:process.argv.includes('--room-l')?'L':'rectangle',calls:result.calls,planReview:result.planReview,
  candidates:checked.map(c=>({title:c.scene.title,items:c.scene.items.length,errors:c.report.errors,warnings:c.report.warnings,missing:c.report.functional.missing,valid:c.report.valid})),
  aestheticQuality:'not-rated: requires human review'};
if(process.argv.includes('--edit') && checked.some(c=>c.report.valid)) {
  const before=structuredClone(checked.find(c=>c.report.valid).scene); before.items[0].locked=true;
  const edit=await compute({...input,operation:'edit',scene:before,message:'Garde les meubles à leur place et change le sol pour du noyer. Explique la modification.'});
  const after=edit.candidates[0].scene;
  summary.edit={floorChanged:after.finishes.floor==='walnut',lockPreserved:JSON.stringify(after.items.find(i=>i.id===before.items[0].id))===JSON.stringify(before.items[0]),valid:edit.candidates[0].report.valid};
}
const index=process.argv.indexOf('--output'), output=resolve(index>=0?process.argv[index+1]:'outputs/furnishing-check.json');
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify({summary,input,result},null,2)+'\n');
console.log('REALROOM_BENCHMARK '+JSON.stringify(summary));
console.log(JSON.stringify({output}));
if(!checked.some(c=>c.report.valid)||summary.edit && Object.values(summary.edit).some(v=>!v))process.exitCode=2;
