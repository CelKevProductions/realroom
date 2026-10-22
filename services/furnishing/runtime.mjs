import {spawn} from 'node:child_process';
import {access,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomInt} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {providerURL} from '../../lib/design-provider.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const killGroup=(child,signal)=>{if(child && Number.isInteger(child.pid))try{process.kill(-child.pid,signal);}catch(e){if(e.code!=='ESRCH')throw e;}};
const groupAlive=child=>{if(!Number.isInteger(child?.pid))return false;try{process.kill(-child.pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};
export async function stopProcess(child) {
  if(!child)return;
  const exited=child.exitCode!==null || child.signalCode!==null?Promise.resolve():new Promise(r=>child.once('close',r));
  killGroup(child,'SIGTERM');
  const force=setTimeout(()=>killGroup(child,'SIGKILL'),5000);force.unref();
  try{
    await exited;
    // vLLM has worker descendants. Waiting only for its HTTP parent is not
    // sufficient to know that the previous GPU owner has exited.
    const deadline=Date.now()+6000;
    while(groupAlive(child) && Date.now()<deadline)await delay(50);
    if(groupAlive(child)){killGroup(child,'SIGKILL');throw Error('Les processus du modèle précédent ne sont pas encore arrêtés. Aucun second modèle n’est lancé.');}
  }finally{clearTimeout(force);}
}

// Resolve only after process close, including on cancellation: the next model
// cannot occupy the GPU while the cancelled model's process still owns it.
export function runLayoutProcess(command,args,input,{signal,emit=()=>{},spawnProcess=spawn}={}) {
  signal?.throwIfAborted();
  return new Promise((resolveResult,reject)=>{
    const child=spawnProcess(command,args,{cwd:ROOT,detached:true,stdio:['pipe','pipe','pipe'],env:{...process.env,CUDA_VISIBLE_DEVICES:'0'}});
    let pending='',result,error,force,bytes=0,settled=false;
    const cancel=()=>{killGroup(child,'SIGTERM');force=setTimeout(()=>killGroup(child,'SIGKILL'),5000);force.unref();};
    signal?.addEventListener('abort',cancel,{once:true});
    const finish=(err)=>{if(settled)return;settled=true;clearTimeout(force);signal?.removeEventListener('abort',cancel);err?reject(err):resolveResult(result);};
    child.once('error',()=>finish(Error('L’interpréteur du moteur spatial ne peut pas démarrer.')));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',chunk=>{
      bytes+=Buffer.byteLength(chunk);pending+=chunk;
      if(bytes>3_000_000){error=Error('Réponse spatiale trop volumineuse.');cancel();return;}
      let cut;
      while((cut=pending.indexOf('\n'))>=0){
        const line=pending.slice(0,cut);pending=pending.slice(cut+1);if(!line)continue;
        try{
          const event=JSON.parse(line);
          if(event.type==='progress')emit({type:'progress',stage:String(event.stage).slice(0,300)});
          else if(event.type==='result'){if(result)throw Error('Duplicate result');result=event.result;}
          else if(event.type==='error')error=Error('Le moteur spatial a échoué. Aucun autre générateur n’a pris sa place.');
        }catch{error=Error('Protocole du moteur spatial invalide.');cancel();}
      }
    });
    child.stderr.on('data',chunk=>process.stderr.write(chunk));
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(input)+'\n');
    child.once('close',code=>finish(signal?.aborted?signal.reason:error || (code!==0 || !result ? Error('Le moteur spatial n’a pas produit de résultat.'):null)));
  });
}

export class SingleGpuRuntime {
  constructor(config,{spawnProcess=spawn,layoutProcess=runLayoutProcess,fetcher=fetch}={}) {
    Object.assign(this,{config,spawnProcess,layoutProcess,fetcher});this.language=null;this.closed=false;
  }
  async ready() {
    try {
      const manifest=JSON.parse(await readFile(resolve(this.config.layoutWeights,'manifest.json'),'utf8'));
      if(manifest.repository!=='3dlg-hcvc/semlayoutdiff' || !manifest.revision)return false;
      await Promise.all(['args.pickle','sldn.pt','apm.ckpt'].map(name=>access(resolve(this.config.layoutWeights,name))));
      await Promise.all([this.config.layoutPython,this.config.languagePython].map(path=>access(path,constants.X_OK)));
      return !this.closed;
    }catch{return false;}
  }
  async layouts(input,options) {
    if(this.closed)throw Error('Le service s’arrête.');
    const old=this.language;this.language=null;
    await stopProcess(old);options.signal?.throwIfAborted();
    return this.layoutProcess(this.config.layoutPython,[resolve(ROOT,'services/furnishing/semlayout/worker.py'),
      '--weights',this.config.layoutWeights,'--device',this.config.layoutDevice],
      {...input,count:this.config.layoutSamples,seed:randomInt(2**31)},{...options,spawnProcess:this.spawnProcess});
  }
  async prepareLanguage({signal,emit=()=>{}}={}) {
    signal?.throwIfAborted();
    if(this.closed)throw Error('Le service s’arrête.');
    if(!this.language || this.language.exitCode!==null || this.language.signalCode!==null) {
      emit({type:'progress',stage:'Préparation du programme personnalisé et de la critique visuelle…'});
      const c=this.config;
      const args=['-m','vllm.entrypoints.openai.api_server','--model',c.model,
        '--host','127.0.0.1','--port','8000','--max-model-len','32768','--max-num-seqs','1',
        '--max-num-batched-tokens','4096','--gpu-memory-utilization','0.90','--enforce-eager',
        '--reasoning-parser','qwen3','--limit-mm-per-prompt','{"image":10,"video":0}',
        '--mm-processor-kwargs','{"max_pixels":262144}','--disable-log-requests'];
      if(c.modelRevision)args.push('--revision',c.modelRevision);
      this.language=this.spawnProcess(c.languagePython,args,{cwd:ROOT,detached:true,stdio:['ignore','ignore','pipe'],
        env:{...process.env,VLLM_API_KEY:c.key,CUDA_VISIBLE_DEVICES:'0'}});
      this.language.once('error',()=>{});
      this.language.stderr.on('data',chunk=>process.stderr.write(chunk));
    }
    const child=this.language,deadline=Date.now()+this.config.languageStartMs;
    try {
      while(Date.now()<deadline) {
        signal?.throwIfAborted();
        if(child.exitCode!==null || child.signalCode!==null || !child.pid)throw Error('Le modèle de dialogue n’a pas démarré.');
        try {
          const r=await this.fetcher(providerURL(this.config.baseURL,'models'),{headers:{Authorization:'Bearer '+this.config.key},signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(2000)]),redirect:'error'});
          if(r.ok && (await r.json()).data?.some(m=>m.id===this.config.model))return;
        }catch(e){if(signal?.aborted)throw e;}
        await delay(1000,undefined,{signal});
      }
      throw Error('Le modèle de dialogue n’est pas prêt dans le délai configuré.');
    }catch(e){await stopProcess(child);if(this.language===child)this.language=null;throw e;}
  }
  // Abort after a chat request also stops its model process, releasing memory.
  async cancelLanguage(){const old=this.language;this.language=null;await stopProcess(old);}
  async close(){this.closed=true;await this.cancelLanguage();}
}
