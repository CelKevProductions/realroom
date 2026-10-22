import {callFurnishing,remoteConfigured} from './design-remote.mjs';
export function createConnectionHandler(config,fetcher=fetch) {
  return async request=>{
    const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
    if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origine refusée.'},403);
    const cfg=config(),key=request.headers.get('x-realroom-key'),code=request.headers.get('x-realroom-code');
    if(remoteConfigured(cfg)) {
      if(code!==cfg.accessCode)return reply({error:'Code de connexion invalide.'},403);
      try {const {body}=await callFurnishing(cfg,'health',{fetcher});return reply({connected:body.status==='ready',model:body.model,provider:'huggingface',status:body.status});}
      catch(e){return reply({error:e.message},e.status || 502);}
    }
    if(cfg.spatialRequired)return reply({error:'Le service d’ameublement n’est pas encore raccordé.'},503);
    const model=request.headers.get('x-realroom-model')||'gpt-6-astra';
    if(!key||key.length>512||!['gpt-6-astra','gpt-6.1-sol'].includes(model))return reply({error:'Clé ou modèle invalide.'},400);
    try {
      const r=await fetcher('https://api.openai.com/v1/models/'+encodeURIComponent(model),{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000),redirect:'error'});
      if(!r.ok)return reply({error:r.status===401?'Cette clé est refusée.':r.status===404?'Ce modèle n’est pas accessible avec cette clé.':'La connexion a échoué ('+r.status+').'},400);
      return reply({connected:true,model});
    }catch{return reply({error:'Le service est injoignable. Réessayez.'},502);}
  };
}
