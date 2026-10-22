import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { runDesign, validateDesignInput } from '../../lib/model.mjs';
import { providerURL } from '../../lib/design-provider.mjs';
import { DesignJobs } from './jobs.mjs';
import { renderPlan } from './render-plan.mjs';
import {SingleGpuRuntime} from './runtime.mjs';
import {checkLayoutRoom} from '../../lib/design-layout.mjs';
import modelDefaults from './model.json' with {type:'json'};

export function serviceConfig(env = process.env) {
  const model=env.REALROOM_MODEL || modelDefaults.model;
  return {
    serviceKey:env.REALROOM_SERVICE_KEY || '',
    model,
    modelRevision:env.REALROOM_MODEL_REVISION || null,
    tokenizer:env.REALROOM_TOKENIZER || (model===modelDefaults.model?modelDefaults.tokenizer:model),
    tokenizerRevision:env.REALROOM_TOKENIZER_REVISION || null,
    baseURL:env.REALROOM_LLM_URL || 'http://127.0.0.1:8000/v1', key:env.VLLM_API_KEY,
    directory:env.REALROOM_JOBS_DIR || '/tmp/realroom-jobs',
    port:Number(env.PORT || 7860), host:env.REALROOM_HOST || '0.0.0.0',
    candidateCount:Number(env.REALROOM_CANDIDATES || 3), repairPasses:Number(env.REALROOM_REPAIR_PASSES || 3),
    planReview:env.REALROOM_PLAN_REVIEW !== 'false',
    spatialEngine:'semlayoutdiff',
    layoutWeights:env.REALROOM_LAYOUT_WEIGHTS || '/opt/realroom-weights',
    layoutPython:env.REALROOM_LAYOUT_PYTHON || '/opt/semlayoutdiff/bin/python',
    languagePython:env.REALROOM_LANGUAGE_PYTHON || '/usr/bin/python3',
    layoutDevice:env.REALROOM_LAYOUT_DEVICE || 'cuda',
    layoutSamples:Math.min(12,Math.max(1,Number(env.REALROOM_LAYOUT_SAMPLES || 6))),
    languageStartMs:Math.min(15*60_000,Math.max(30_000,Number(env.REALROOM_LANGUAGE_START_MS || 8*60_000))),
    jobTimeoutMs:Math.min(120*60_000,Math.max(60_000,Number(env.REALROOM_JOB_TIMEOUT_MS || 45*60_000))),
  };
}
const sameSecret = (a,b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function readInput(req) {
  let length=0; const chunks=[];
  for await (const chunk of req) {
    length+=chunk.length;
    if (length > 9_000_000) throw Object.assign(Error('Projet trop volumineux.'), {status:413});
    chunks.push(chunk);
  }
  let input; try { input=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(Error('Projet illisible.'),{status:400}); }
  try {
    validateDesignInput(input);
    if (!input.room.verified) throw Error('Validez les dimensions et les ouvertures du plan.');
  } catch (e) { e.status=400; throw e; }
  return input;
}
export async function createFurnishingServer(config, { runner=runDesign, ready, renderer=renderPlan, pollMs=500, runtime }={}) {
  if (config.serviceKey.length < 32 || !/^[\x21-\x7e]+$/.test(config.serviceKey)) throw Error('REALROOM_SERVICE_KEY doit contenir au moins 32 caractères ASCII sans espace.');
  providerURL(config.baseURL, 'models');
  const engines=runtime || (config.spatialEngine==='semlayoutdiff'?new SingleGpuRuntime(config):null);
  const checkReady = ready || (engines ? ()=>engines.ready() : async () => {
    try {
      const r=await fetch(providerURL(config.baseURL,'models'), {headers:config.key ? {Authorization:'Bearer '+config.key} : {},signal:AbortSignal.timeout(3000),redirect:'error'});
      if (!r.ok) return false;
      const body=await r.json(); return !!body.data?.some(m=>m.id===config.model);
    } catch { return false; }
  });
  const jobs=await new DesignJobs({directory:config.directory,timeoutMs:config.jobTimeoutMs, run:async(input,options)=>{
    try{return await runner(input,{
    ...options, key:config.key, model:config.model, provider:'chat', baseURL:config.baseURL,
    candidateCount:config.candidateCount, repairPasses:config.repairPasses,
    renderPlan:config.planReview ? renderer : undefined,
    layoutGenerator:engines?(input,options)=>engines.layouts(input,options):undefined,
    prepareLanguage:engines?options=>engines.prepareLanguage(options):undefined,
  });}finally{if(options.signal.aborted)await engines?.cancelLanguage();}
  }}).init();
  const housekeeping=setInterval(()=>jobs.prune().catch(()=>{}),60_000); housekeeping.unref();
  const server=createServer(async (req,res)=>{
    res.setHeader('Cache-Control','private, no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    const reply=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
    const path=new URL(req.url,'http://service.local').pathname;
    try {
      if (path==='/health' && req.method==='GET') {
        const available=await checkReady();
        return reply({status:available?'ready':'unprepared',runtime:engines?'sequential-single-gpu':'language-only',spatialEngine:engines?'semlayoutdiff':null,
          modelResident:!!engines?.language,provider:'huggingface-vllm',model:config.model,revision:config.modelRevision,
          tokenizer:config.tokenizer,tokenizerRevision:config.tokenizerRevision,queue:jobs.queue.length,running:!!jobs.active,
          capabilities:{structuredOutput:true,images:true,planReview:config.planReview,learnedPlacements:!!engines,roomTypes:engines?['salon','chambre','salle_a_manger']:null}},available?200:503);
      }
      if (!sameSecret(req.headers['x-realroom-service-key'],config.serviceKey)) return reply({error:'Connexion au service refusée.'},401);
      const match=path.match(/^\/v1\/jobs\/([a-f0-9-]{36})(\/cancel)?$/);
      if(match) {
        if(match[2] && req.method==='POST') {const job=await jobs.cancel(match[1]); return reply(job || {error:'Calcul introuvable.'},job?200:404);}
        if(!match[2] && req.method==='GET') {const job=jobs.get(match[1]); return reply(job || {error:'Calcul introuvable.'},job?200:404);}
        return reply({error:'Méthode invalide.'},405);
      }
      if(req.method!=='POST' || !['/v1/jobs','/v1/design'].includes(path)) return reply({error:'Route introuvable.'},404);
      const input=await readInput(req);
      if(engines && input.operation==='create')try{checkLayoutRoom(input.room,input.brief);}catch(e){return reply({error:e.message},422);}
      if(!await checkReady()) return reply({error:'Les poids et les interpréteurs du service ne sont pas encore préparés.'},503);
      const submitted=await jobs.submit(input,req.headers['idempotency-key']);
      if(path==='/v1/jobs') return reply(submitted,202);
      res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});
      let finished=false, lastProgress='', lastHeartbeat=0;
      const cancel=()=>{if(!finished)jobs.cancel(submitted.id).catch(()=>{});};
      res.once('close',cancel);
      const send=event=>res.write(JSON.stringify(event)+'\n');
      const check=()=>{
        if(res.destroyed) return false;
        const job=jobs.get(submitted.id);
        if(job.progress && job.progress!==lastProgress) {lastProgress=job.progress;send({type:'progress',stage:job.progress});}
        if(job.status==='succeeded') {finished=true;send({type:'result',result:job.result});res.end();return false;}
        if(['failed','cancelled'].includes(job.status)) {finished=true;send({type:'error',error:job.error});res.end();return false;}
        if(Date.now()-lastHeartbeat>10000){lastHeartbeat=Date.now();send({type:'heartbeat',jobId:job.id});}
        return true;
      };
      send({type:'progress',stage:submitted.status==='queued'?'En attente du GPU…':'Démarrage du calcul…'});
      if(check()) {
        const timer=setInterval(()=>{if(!check())clearInterval(timer);},pollMs);
        res.once('close',()=>clearInterval(timer));
      }
    } catch(e) {
      if(!res.headersSent) reply({error:e.status ? e.message : 'Le service ne peut pas traiter ce projet.'},e.status || 500);
      else res.end();
    }
  });
  server.requestTimeout=30_000; server.headersTimeout=15_000;
  server.on('close',()=>{clearInterval(housekeeping);jobs.close().catch(()=>{});engines?.close().catch(()=>{});});
  return {server,jobs};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const config=serviceConfig();
  const {server,jobs}=await createFurnishingServer(config);
  server.listen(config.port,config.host,()=>console.log(JSON.stringify({service:'realroom-furnishing',port:config.port,model:config.model})));
  const stop=async()=>{await jobs.close();server.close();setTimeout(()=>process.exit(0),5000).unref();};
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
