import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {checkLayoutRoom,retrieveLayouts,preserveLayout} from '../lib/design-layout.mjs';
import {runDesign} from '../lib/model.mjs';
import {CATALOG} from '../lib/catalog.mjs';
import {EXAMPLE_ROOM as R,EXAMPLE_SCENE as S,EMPTY_SCENE} from '../lib/examples.mjs';
import {runLayoutProcess,SingleGpuRuntime} from '../services/furnishing/runtime.mjs';
import {createFurnishingServer,serviceConfig} from '../services/furnishing/server.mjs';
import {designConfig} from '../lib/design-config.mjs';
import {createDesignHandlers} from '../lib/design-http.mjs';
import {createConnectionHandler} from '../lib/design-connection.mjs';

const brief={roomType:'salon',activities:['lecture','musique'],wishes:'Piano, coin lecture et chêne',seats:4};
const input=()=>({operation:'create',room:structuredClone(R),brief,scene:structuredClone(EMPTY_SCENE)});
const program={concept:'Fixture programme',palette:[],materials:['chêne'],priorities:[],zones:[],tradeoffs:[],
  inventory:S.items.map(i=>({sku:i.sku,quantity:1,zone:i.zone,reason:'fixture'}))};
// Synthetic spatial output: never presented as output from trained weights.
const spatial=()=>({engine:'semlayoutdiff',upstreamCommit:'fixture-source',checkpointRevision:'fixture-weights',layouts:[{
  id:'sem-fixture',seed:42,objects:[{id:'anchor-sofa',category:'sofa',x:-.5,z:-2.12,rotation:0,size:[2.4,1,.8]}],diagnostics:{fixture:true}}]});
const reply=data=>Response.json({id:'fixture',choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]});

test('unsupported room types and oversized plans fail before any model call',async()=>{
  assert.throws(()=>checkLayoutRoom(R,{roomType:'bureau'}),/autre modèle/);
  const big={...R,polygon:[[0,0],[12,0],[12,4],[0,4]],openings:[]};
  assert.throws(()=>checkLayoutRoom(big,brief),/réduit/);
  let calls=0;
  await assert.rejects(runDesign({...input(),brief:{...brief,roomType:'bureau'}},{provider:'chat',layoutGenerator:async()=>calls++,prepareLanguage:async()=>calls++}),/autre modèle/);
  assert.equal(calls,0);
});
test('retrieval uses actual SKU dimensions, honours locks, rejects malformed spatial output',()=>{
  const raw=spatial();
  const [scene]=retrieveLayouts(raw,R,brief,program);
  const item=scene.items[0];
  assert.equal(item.sku,'mcs-01');assert.deepEqual(CATALOG[item.sku].dim,[2.4,1,.8]);
  assert.equal(item.x,-.5);assert.equal(item.z,-2.12);assert.equal(item.scale,undefined);
  assert.equal(scene.provenance.spatialEngine,'semlayoutdiff');
  const locked={...S.items.find(i=>i.id==='piano'),locked:true};
  const [withLock]=retrieveLayouts(raw,R,brief,program,{items:[locked]});
  assert.deepEqual(withLock.items.find(i=>i.id===locked.id),locked);
  raw.layouts[0].objects[0].size=[NaN,1,1];
  assert.throws(()=>retrieveLayouts(raw,R,brief,program),/placements invalides/);
});
test('VLM cannot remove, replace or teleport the learned core during creation',()=>{
  const [seed]=retrieveLayouts(spatial(),R,brief,program);
  const original=seed.items[0];
  const edited={...seed,id:'invented',items:[{...original,x:20,sku:'atelier-piano'}]};
  assert.deepEqual(preserveLayout(edited,seed).items[0],original);
  assert.equal(preserveLayout({...seed,items:[]},seed).items.length,1);
  assert.equal(preserveLayout({...edited,items:[{...original,x:original.x+.2}]},seed).items[0].x,original.x+.2);
});
test('pipeline calls spatial networks before language, enriches their anchors and retains provenance',async()=>{
  const order=[];
  const result=await runDesign(input(),{provider:'chat',model:'fixture',baseURL:'http://127.0.0.1:8000/v1',repairPasses:0,
    layoutGenerator:async()=>{order.push('spatial');return spatial();},prepareLanguage:async()=>order.push('language'),
    fetcher:async(_,options)=>{
      const body=JSON.parse(options.body),payload=JSON.parse(body.messages[1].content[0].text);
      if(body.response_format.json_schema.schema.properties.inventory){
        order.push('program');
        const allowed=new Set(payload.catalogue.map(p=>p.sku));
        const inventory=program.inventory.filter(i=>allowed.has(i.sku));
        if(!inventory.some(i=>CATALOG[i.sku].fam==='canape'))inventory.push({sku:payload.catalogue.find(p=>p.type==='canape').sku,quantity:1,zone:'salon',reason:'fixture'});
        return reply({...program,inventory});
      }
      order.push('enrichment');assert.equal(payload.spatialConstraints.anchors[0].id,'anchor-sofa');
      return reply({message:'fixture',scenes:[{...S,id:payload.current.id,items:[...S.items.filter(i=>i.id!=='sofa'),...payload.current.items]}]});
    }});
  assert.deepEqual(order,['spatial','language','program','enrichment']);
  assert.equal(result.spatialEngine,'semlayoutdiff');
  assert.equal(result.candidates[0].report.valid,true);
  assert.deepEqual(result.candidates[0].report.functional.missing,[]);
  assert.ok(result.calls.some(c=>c.stage==='spatial-generation' && c.sampled===1));
  assert.ok(!result.calls.some(c=>c.stage==='composition'));
});
test('spatial errors never silently fall back to the language placement generator',async()=>{
  let language=false;
  await assert.rejects(runDesign(input(),{provider:'chat',layoutGenerator:async()=>{throw Error('checkpoint absent');},prepareLanguage:async()=>{language=true;}}),/checkpoint absent/);
  assert.equal(language,false);
});
test('a chat movement survives a later visual review of the spatial provenance',async()=>{
  const scene=structuredClone(S);scene.items[0].x+=.1;
  scene.provenance={spatialEngine:'semlayoutdiff',spatialAnchors:[{...S.items[0]}]};
  const result=await runDesign({...input(),operation:'edit',scene,message:'Décale légèrement le canapé.'},{provider:'chat',model:'fixture',baseURL:'http://127.0.0.1:8000/v1',repairPasses:0,
    fetcher:async()=>reply({message:'fixture',scenes:[{...scene,items:scene.items.map(i=>i.id==='sofa'?{...i,x:i.x+.1}:i)}]})});
  assert.equal(result.candidates[0].scene.provenance.spatialAnchors[0].x,scene.items[0].x+.1);
});
test('real child-process protocol handles result and abort without a GPU',async()=>{
  const result=await runLayoutProcess(process.execPath,['-e',"process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({type:'result',result:{fixture:true}})))"],{});
  assert.deepEqual(result,{fixture:true});
  const controller=new AbortController();
  const cancelled=runLayoutProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{},{signal:controller.signal});
  setTimeout(()=>controller.abort(),40);
  await assert.rejects(cancelled,e=>e.name==='AbortError');
});
test('the language process exits before the spatial process is allowed to start',async t=>{
  const old=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
  await new Promise((resolve,reject)=>{old.once('spawn',resolve);old.once('error',reject);});
  t.after(()=>{try{process.kill(-old.pid,'SIGKILL');}catch{}});
  let spatialCalls=0;
  const runtime=new SingleGpuRuntime({layoutPython:'/fixture',layoutWeights:'/fixture',layoutDevice:'cuda',layoutSamples:2},{
    layoutProcess:async(_command,_args,payload)=>{
      spatialCalls++;
      assert.ok(old.exitCode!==null || old.signalCode!==null);
      assert.throws(()=>process.kill(-old.pid,0),e=>e.code==='ESRCH');
      assert.equal(payload.count,2);return spatial();
    }});
  runtime.language=old;
  assert.equal((await runtime.layouts(input(),{})).engine,'semlayoutdiff');
  assert.equal(spatialCalls,1);assert.equal(runtime.language,null);
});
test('service defaults to the specialized engine and reports missing assets without starting hardware',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'rr-spatial-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const config=serviceConfig({REALROOM_SERVICE_KEY:'local-fixture-secret-with-at-least-32-characters',REALROOM_JOBS_DIR:directory,REALROOM_LAYOUT_WEIGHTS:join(directory,'absent')});
  assert.equal(config.spatialEngine,'semlayoutdiff');
  let launches=0;
  const runtime=new SingleGpuRuntime(config,{spawnProcess:()=>{launches++;assert.fail('must not launch');}});
  assert.equal(await runtime.ready(),false);
  const {server}=await createFurnishingServer(config,{runtime});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
  const health=await fetch('http://127.0.0.1:'+server.address().port+'/health');
  assert.equal(health.status,503);assert.equal((await health.json()).spatialEngine,'semlayoutdiff');assert.equal(launches,0);
});
test('the default web API never calls a language-only generator when the spatial backend is disconnected',async()=>{
  const cfg=designConfig({OPENAI_API_KEY:'fixture',REALROOM_DESIGN_ACCESS_CODE:'fixture-code'});
  const handlers=createDesignHandlers(()=>cfg,()=>assert.fail('no fallback'));
  const request=()=>new Request('https://room.example/api/design',{method:'POST',headers:{origin:'https://room.example','x-realroom-key':'fixture-old-session-key'},body:JSON.stringify(input())});
  const meta=await (await handlers.GET()).json();
  assert.equal(meta.configured,false);assert.equal(meta.provider,'huggingface');assert.equal(meta.sessionKeySupported,false);
  assert.equal((await handlers.POST(request())).status,503);
  assert.equal((await createConnectionHandler(()=>cfg,()=>assert.fail('no external request'))(request())).status,503);
});
test('a stale session key cannot override the configured spatial backend',async()=>{
  const cfg=designConfig({REALROOM_FURNISHING_URL:'https://fixture.example',REALROOM_FURNISHING_KEY:'fixture-service',REALROOM_DESIGN_ACCESS_CODE:'fixture-code'});
  let called=false;
  const handlers=createDesignHandlers(()=>cfg,()=>assert.fail('no language bypass'),async(url,options)=>{
    called=true;assert.equal(String(url),'https://fixture.example/v1/jobs');assert.ok(!JSON.stringify(options).includes('old-session-key'));
    return Response.json({id:'fixture-job'},{status:202});
  });
  const request=new Request('https://room.example/api/design',{method:'POST',headers:{origin:'https://room.example','x-realroom-code':'fixture-code','x-realroom-key':'old-session-key'},body:JSON.stringify(input())});
  assert.equal((await handlers.POST(request)).status,202);assert.equal(called,true);
});
