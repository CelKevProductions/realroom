import { providerURL } from './design-provider.mjs';
export const remoteConfigured = c => !!(c.furnishingURL && c.furnishingKey && c.accessCode);
export async function callFurnishing(cfg, resource, {method='GET', input, signal, idempotencyKey, fetcher=fetch}={}) {
  const url=providerURL(cfg.furnishingURL,resource);
  if(cfg.hfToken && !url.hostname.endsWith('.hf.space')) throw Error('Le jeton Hugging Face exige une adresse de Space hf.space.');
  const response=await fetcher(url,{
    method,redirect:'error',cache:'no-store',signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    headers:{'Content-Type':'application/json','x-realroom-service-key':cfg.furnishingKey,
      ...(cfg.hfToken ? {Authorization:'Bearer '+cfg.hfToken} : {}),
      ...(idempotencyKey ? {'Idempotency-Key':idempotencyKey} : {})},
    ...(input ? {body:JSON.stringify(input)} : {}),
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok) {
    const err=Error(response.status===401 || response.status===403 ? 'La connexion au service GPU est refusée. Vérifiez sa configuration serveur.' :
      response.status===503 ? 'Le modèle GPU démarre encore ou le Space est en veille.' :
      response.status===429 ? 'Le GPU traite déjà plusieurs demandes. Réessayez dans un instant.' :
      response.status===404 ? 'Le calcul ou le service GPU est introuvable.' : 'Le service GPU a retourné une erreur ('+response.status+').');
    err.status=response.status; throw err;
  }
  if(!body || typeof body!=='object') throw Error('La réponse du service GPU est illisible.');
  return {body,status:response.status};
}
