// Server-side transport. The endpoint comes from deployment configuration, never a user prompt.
export function providerURL(baseURL, resource) {
  const url = new URL(baseURL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:")))
    throw Error("Adresse du service IA invalide.");
  url.pathname = url.pathname.replace(/\/$/, "") + "/" + resource;
  return url;
}

export async function requestChatJSON({key, model, baseURL, system, payload, schema,
  images = [], signal, fetcher = fetch, maxTokens = 8192, timeoutMs = 600000}) {
  const content = [{type:"text", text:JSON.stringify(payload)}];
  for (const image of images) {
    content.push({type:"text", text:String(image.label || "Vue du projet")});
    content.push({type:"image_url", image_url:{url:image.data}});
  }
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetcher(providerURL(baseURL, "chat/completions"), {
    method:"POST", redirect:"error", signal:signal ? AbortSignal.any([signal,timeout]) : timeout,
    headers:{"Content-Type":"application/json", ...(key ? {Authorization:"Bearer "+key} : {})},
    body:JSON.stringify({model, messages:[{role:"system",content:system},{role:"user",content}],
      temperature:0.7, top_p:0.8, max_tokens:maxTokens,
      chat_template_kwargs:{enable_thinking:false},
      response_format:{type:"json_schema",json_schema:{name:"realroom",strict:true,schema}}}),
  });
  if (!response.ok) {
    // Do not reflect server bodies: they can contain prompts, credentials or internals.
    const e = Error(response.status===401 || response.status===403 ? "Le service GPU refuse la connexion." :
      response.status===429 ? "Le service GPU est occupé. Réessayez après le calcul en cours." :
      response.status===503 ? "Le modèle GPU démarre encore. Réessayez dans quelques instants." :
      "Échec du service GPU ("+response.status+").");
    e.status=response.status; throw e;
  }
  const body = await response.json().catch(()=>{throw Error("Réponse du service GPU illisible.");});
  const choice=body.choices?.[0];
  if(choice?.finish_reason!=="stop" || !choice?.message?.content)
    throw Error("La réponse du modèle GPU est incomplète. Aucune modification appliquée.");
  let data;
  try {data=JSON.parse(choice.message.content);} catch {throw Error("Le modèle GPU n’a pas produit un JSON exploitable.");}
  return {data,usage:body.usage || null,responseId:body.id || null};
}
