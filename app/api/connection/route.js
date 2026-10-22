export const dynamic='force-dynamic';
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origine refusée.'},{status:403});
 const key=request.headers.get('x-realroom-key'),model=request.headers.get('x-realroom-model')||'gpt-6-astra';
 if(!key||key.length>512||!['gpt-6-astra','gpt-6.1-sol'].includes(model))return Response.json({error:'Clé ou modèle invalide.'},{status:400});
 try{const r=await fetch('https://api.openai.com/v1/models/'+encodeURIComponent(model),{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});if(!r.ok)return Response.json({error:r.status===401?'Cette clé est refusée.':r.status===404?'Ce modèle n’est pas accessible avec cette clé.':'La connexion a échoué ('+r.status+').'}, {status:400});return Response.json({connected:true,model},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Le service est injoignable. Réessayez.'},{status:502});}
}
