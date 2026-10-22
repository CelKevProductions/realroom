import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {requestChatJSON,providerURL} from '../lib/design-provider.mjs';
import {selectCatalogue,validateProgram} from '../lib/design-selection.mjs';
import {callFurnishing} from '../lib/design-remote.mjs';
import {createDesignHandlers} from '../lib/design-http.mjs';
import {createConnectionHandler} from '../lib/design-connection.mjs';
import {createFurnishingServer} from '../services/furnishing/server.mjs';
import {DesignJobs} from '../services/furnishing/jobs.mjs';
import {renderPlan,planPrimitives} from '../services/furnishing/render-plan.mjs';
import {runDesign} from '../lib/model.mjs';
import {EXAMPLE_ROOM as R,EXAMPLE_SCENE as S,EMPTY_SCENE} from '../lib/examples.mjs';
const key='local-fixture-secret-not-a-real-key-123456789';
const brief={roomType:'salon',activities:['lecture','musique'],wishes:'Un piano et un coin lecture',seats:4};
const input=()=>({operation:'create',room:structuredClone(R),brief:structuredClone(brief),scene:structuredClone(EMPTY_SCENE)});
const program={concept:'Programme de test',palette:[],materials:[],priorities:[],zones:[],inventory:[{sku:'atelier-piano',quantity:1,zone:'musique',reason:'Test'}],tradeoffs:[]};
const reply=(data,finish='stop')=>Response.json({id:'fixture',choices:[{finish_reason:finish,message:{content:JSON.stringify(data)}}],usage:{total_tokens:10}});
const eventually=async fn=>{for(let i=0;i<100;i++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,10));}throw Error('Test timeout');};

test('GPU protocol constrains JSON, sends images and refuses incomplete output',async()=>{
  let seen;
  const options={baseURL:'http://127.0.0.1:8000/v1',key,model:'fixture',system:'test',payload:{test:true},schema:{type:'object'},images:[{data:'data:image/png;base64,YQ=='}],
    fetcher:async(url,options)=>{seen={url:String(url),...JSON.parse(options.body)};assert.equal(options.redirect,'error');return reply({ok:true});}};
  assert.deepEqual((await requestChatJSON(options)).data,{ok:true});
  assert.equal(seen.url,'http://127.0.0.1:8000/v1/chat/completions');
  assert.equal(seen.chat_template_kwargs.enable_thinking,false);
  assert.equal(seen.response_format.json_schema.strict,true);
  assert.ok(seen.messages[1].content.some(c=>c.type==='image_url'));
  await assert.rejects(requestChatJSON({...options,fetcher:async()=>reply({},'length')}),/incomplète/);
  await assert.rejects(requestChatJSON({...options,fetcher:async()=>new Response('secret-upstream-body',{status:500})}),e=>!e.message.includes('secret-upstream-body'));
});
test('provider addresses reject public HTTP, credentials and query strings',()=>{
  for(const url of ['http://remote.example/v1','https://key:secret@remote.example/v1','https://remote.example/v1?token=secret'])assert.throws(()=>providerURL(url,'models'));
  assert.equal(String(providerURL('https://service.example/v1/','models')),'https://service.example/v1/models');
});
test('catalogue keeps existing furniture and provides requested activity families',()=>{
  const products=selectCatalogue(brief,S),skus=new Set(products.map(p=>p.sku));
  for(const item of S.items)assert.ok(skus.has(item.sku));
  for(const family of ['canape','piano','fauteuil','lampadaire','tableau'])assert.ok(products.some(p=>p.type===family));
  assert.ok(products.length<=100);
  assert.throws(()=>validateProgram({...program,inventory:[{sku:'imaginary',quantity:1}]},products));
});
test('GPU pipeline plans, makes distinct requests, checks geometry and reviews rendered plans',async()=>{
  let plans=0,compositions=0,reviews=0;const events=[];
  const result=await runDesign(input(),{provider:'chat',model:'fixture',baseURL:'http://127.0.0.1:8000/v1',repairPasses:0,
    emit:e=>events.push(e),renderPlan:async(_,scene)=>{plans++;return {data:'data:image/png;base64,YQ==',kind:'plan',label:scene.id};},
    fetcher:async(_,options)=>{
      const body=JSON.parse(options.body),payload=JSON.parse(body.messages[1].content[0].text);
      if(body.response_format.json_schema.schema.properties.inventory)return reply(program);
      if(payload.operation==='review'){reviews++;assert.equal(body.messages[1].content.filter(c=>c.type==='image_url').length,3);return reply({message:'Fixture review',scenes:[{...S,id:'reviewed'}]});}
      compositions++;assert.equal(payload.variant,compositions);assert.equal(payload.previousConcepts.length,compositions-1);
      return reply({message:'Fixture composition',scenes:[{...S,id:'variant-'+compositions}]});
    }});
  assert.equal(compositions,3);assert.equal(plans,3);assert.equal(reviews,1);
  assert.equal(result.planReview,true);assert.equal(result.candidates.length,3);
  assert.equal(result.candidates[0].scene.id,'reviewed');assert.equal(result.candidates[0].report.valid,true);
  assert.equal(events.filter(e=>e.type==='result').length,1);
  assert.equal(result.calls.length,5);
});
test('local plan renderer uses actual item footprints, doors and valid PNG output',async()=>{
  const primitives=planPrimitives(R,S);
  assert.equal(primitives.polygon,R.polygon);assert.ok(primitives.openings.some(o=>o.zone));
  const image=await renderPlan(R,S);
  const png=Buffer.from(image.data.split(',')[1],'base64');
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),1200);
});
test('jobs serialize GPU work, deduplicate requests and retain results after process restart',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'rr-jobs-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let active=0,maximum=0,calls=0;const release=[];
  const jobs=await new DesignJobs({directory,run:async()=>{active++;maximum=Math.max(maximum,active);calls++;await new Promise(r=>release.push(r));active--;return {value:calls};}}).init();
  const [a,duplicate]=await Promise.all([jobs.submit(input(),'duplicate-key'),jobs.submit(input(),'duplicate-key')]);
  assert.equal(a.id,duplicate.id);
  await assert.rejects(jobs.submit({...input(),message:'different'},'duplicate-key'),e=>e.status===409);
  const b=await jobs.submit(input(),'another-key');
  await eventually(()=>release.length===1);assert.equal(jobs.get(b.id).status,'queued');release.shift()();
  await eventually(()=>release.length===1);release.shift()();
  await eventually(()=>jobs.get(b.id).status==='succeeded');assert.equal(maximum,1);assert.equal(calls,2);
  const restored=await new DesignJobs({directory,run:async()=>{throw Error('Should not rerun');}}).init();
  assert.equal(restored.get(a.id).status,'succeeded');assert.deepEqual(restored.get(b.id).result,{value:2});
  const disk=await readFile(join(directory,a.id+'.json'),'utf8');assert.ok(!disk.includes('Un piano et un coin lecture'));
});
test('queued cancellation never calls the model, running cancellation propagates abort',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'rr-cancel-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let calls=0;
  const jobs=await new DesignJobs({directory,run:(_,options)=>new Promise((_,reject)=>{calls++;options.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});})}).init();
  const a=await jobs.submit(input());await eventually(()=>calls===1);
  const b=await jobs.submit(input());await jobs.cancel(b.id);await jobs.cancel(a.id);
  await eventually(()=>jobs.get(a.id).status==='cancelled');assert.equal(jobs.get(b.id).status,'cancelled');assert.equal(calls,1);
});
test('job timeout aborts GPU request and releases the queue',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'rr-timeout-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const jobs=await new DesignJobs({directory,timeoutMs:30,run:(_,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(o.signal.reason),{once:true}))}).init();
  const a=await jobs.submit(input());await eventually(()=>jobs.get(a.id).status==='failed');assert.match(jobs.get(a.id).error,/durée maximale/);await eventually(()=>jobs.active===null);
});
test('unfinished persisted job becomes failed on restart, never a fabricated result',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'rr-restart-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const id='00000000-0000-0000-0000-000000000001';
  await writeFile(join(directory,id+'.json'),JSON.stringify({id,status:'running',updatedAt:Date.now()}));
  const jobs=await new DesignJobs({directory,run:async()=>assert.fail()}).init();
  assert.equal(jobs.get(id).status,'failed');assert.equal(jobs.get(id).result,undefined);
});
test('HTTP service and RealRoom proxy roundtrip with server secrets and asynchronous results',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'rr-http-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let calls=0;
  const {server}=await createFurnishingServer({serviceKey:key,model:'fixture',baseURL:'http://127.0.0.1:8000/v1',directory,planReview:false},
    {ready:async()=>true,runner:async(_,o)=>{calls++;o.emit({type:'progress',stage:'Fixture test'});return {candidates:[{scene:S}],model:'fixture'};}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
  const base='http://127.0.0.1:'+server.address().port,cfg={furnishingURL:base,furnishingKey:key,accessCode:'local-test-code'};
  const handlers=createDesignHandlers(()=>cfg),url='https://realroom.example/api/design';
  const req=(method,job,code='local-test-code')=>new Request(url+(job?'?job='+job:''),{method,headers:{origin:'https://realroom.example','x-realroom-code':code},...(method==='POST'?{body:JSON.stringify(input())}:{})});
  assert.equal((await fetch(base+'/v1/jobs',{method:'POST',body:'{}'})).status,401);
  assert.equal((await handlers.POST(req('POST',null,'wrong'))).status,403);
  const response=await handlers.POST(req('POST'));assert.equal(response.status,202);const submitted=await response.json();
  const job=await eventually(async()=>{const r=await handlers.GET(req('GET',submitted.id));const j=await r.json();return j.status==='succeeded'?j:null;});
  assert.equal(calls,1);assert.equal(job.result.model,'fixture');assert.ok(!JSON.stringify(job).includes(key));
  const connection=await createConnectionHandler(()=>cfg)(req('POST'));assert.equal((await connection.json()).connected,true);
  assert.equal((await handlers.GET(req('GET',submitted.id,'wrong'))).status,403);
  const meta=await (await handlers.GET()).json();assert.equal(meta.provider,'huggingface');assert.ok(!JSON.stringify(meta).includes(base));
});
test('a Hugging Face token is never sent to a different host',async()=>{
  let called=false;
  await assert.rejects(callFurnishing({furnishingURL:'https://other.example',furnishingKey:key,hfToken:'fixture-token'},'health',{fetcher:async()=>{called=true;}}),/hf.space/);
  assert.equal(called,false);
});
