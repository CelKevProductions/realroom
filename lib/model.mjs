import { shortlist, CATALOG } from "./catalog.mjs";
import {
  checkRoom,
  normalizeScene,
  evaluate,
  diffScenes,
} from "./validation.mjs";
import { assess } from "./design-quality.mjs";
import { walls } from "./geometry.mjs";
import {requestChatJSON} from "./design-provider.mjs";
import {selectCatalogue, compactCatalogue, PROGRAM_SCHEMA, validateProgram} from "./design-selection.mjs";
const string = { type: "string" },
  number = { type: "number" };
const object = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const array = (items) => ({ type: "array", items });
export const SCENE_SCHEMA = object({
  id: string,
  title: string,
  intent: string,
  zones: array(
    object({ id: string, name: string, activity: string, rationale: string }),
  ),
  finishes: object({
    floor: {
      type: "string",
      enum: ["oak", "walnut", "stone", "terrazzo", "terracotta"],
    },
    wallColor: string,
    accentWall: { type: "integer" },
    accentColor: string,
  }),
  items: array(
    object({
      id: string,
      sku: { type: "string", enum: Object.keys(CATALOG) },
      x: number,
      z: number,
      y: number,
      rotation: number,
      zone: string,
      note: string,
      locked: { type: "boolean" },
    }),
  ),
  rationale: array(string),
  limitations: array(string),
});
export const RESPONSE_SCHEMA = object({
  message: string,
  scenes: array(SCENE_SCHEMA),
});
export const SYSTEM = `Tu es un architecte d'intérieur expérimenté. Tu conçois une composition complète, habitable, personnelle et visuellement cohérente, pas une collection d'objets isolés. Réponds en français, via le schéma JSON.
Le plan et ses ouvertures sont IMMUTABLES. Le DXF fait autorité. Unités : mètres. Sol = XZ ; altitude = Y. Objet = centre de son empreinte, y = face inférieure. Dimensions du catalogue = [largeur X, profondeur Z, hauteur Y]. Rotation en degrés autour de Y : 0 fait face au +Z ; 90 au +X ; 180 au -Z ; 270 au -X. Pour un meuble dos au mur, dirige son avant vers l'intérieur. Chaque référence garde exactement ses dimensions et sa matière ; sélectionne une autre référence si nécessaire. N'invente aucun SKU. Les objets génériques sont des objets de projet, pas des produits commerciaux garantis.
Commence par concevoir les usages, les relations entre zones, le point focal, le cheminement et les perspectives. Organise ensuite une hiérarchie de volumes avec des espaces de respiration. Une pièce en L reste un L. N'aligne pas automatiquement tous les meubles sur tous les murs. Place d'abord des groupes cohérents : conversation autour d'une table basse, lecture avec lumière et surface d'appui, musique avec accès au banc/instrument, travail avec chaise et recul, repas avec vraies places assises. Évite de surcharger. Choisis des meubles qui se répondent en échelle, matière et palette.
La demande personnelle du client prime sur les suggestions générales. Assure chaque usage prioritaire ou explique précisément pourquoi il ne tient pas. Ne transforme pas un petit salon en entrepôt pour satisfaire une liste. Ajoute tapis, éclairage, rangements utiles, art mural et quelques objets sur supports quand l'espace le permet. Ne mets pas de plante ni de luminaire haut devant une fenêtre. Sol, murs et accent peuvent changer ; jamais les ouvertures.
Contraintes de base : aucun objet hors du polygone, aucun chevauchement volumique, aucun débattement ou accès de porte encombré. Garde le passage demandé de l'entrée vers les autres portes et vers les usages. Devant les rangements : au moins 0,65 m ; devant une assise : environ 0,5 m ; canapé/table basse : 0,4–0,55 m ; derrière une chaise de repas ou de travail : place pour reculer et passer. Ce sont des objectifs de confort du prototype, pas une certification réglementaire. Un tapis au sol peut passer sous des meubles. Un objet de décoration est supporté par un meuble, y=hauteur de sa surface. Un objet mural a son dos à moins de 10 cm du mur et une hauteur cohérente. Pour suspension/plafonnier : y + hauteur = hauteur du plafond. Aucun meuble au sol ne flotte.
Renvoie des décisions courtes, concrètes, sans prétendre que tes préférences sont une mesure objective de qualité. Les images sont des vues exactes du projet, elles ne remplacent pas les dimensions fournies. Les contraintes mesurées signalées doivent être réparées dans les coordonnées. Ne masque pas les difficultés avec une explication. Conserve scrupuleusement tous les objets verrouillés et leurs positions. Pour une retouche, préserve ce qui n'est pas concerné et réutilise les IDs des objets existants. N'ajoute pas de références à des modèles, fichiers, API ou détails techniques dans le texte destiné au client.`;
export function modelPayload({
  operation,
  room,
  brief,
  scene,
  candidates,
  message,
  history,
  feedback,
  catalogue,
  program,
  variant,
  previousConcepts,
}) {
  const width = brief?.accessible ? 0.9 : 0.7;
  return {
    operation,
    task:
      operation === "create"
        ? "Propose exactement 3 compositions réellement différentes de cette pièce, chacune avec un parti pris cohérent, répondant toutes au même brief. 10 à 28 objets bien choisis selon la surface."
        : operation === "review"
          ? "Analyse les vues de chaque proposition (plan coté puis vues 3D), compare composition, proportions, matières, lumière, usages et circulation. Renvoie une seule proposition finale : conserve ou améliore la meilleure. Tu peux déplacer, remplacer, supprimer et ajouter. Prends en compte les problèmes mesurés. Explique le parti pris."
          : operation === "repair"
            ? "Corrige les violations mesurées de cette proposition en conservant son intention. Renvoie exactement une scène."
            : "Modifie la composition actuelle conformément au message. Une seule scène complète. Si une demande contredit un verrouillage ou est impossible, conserve la scène et explique la difficulté. Réponds à une question sans modifier inutilement la pièce.",
    room: {
      ...room,
      walls: walls(room).map((w) => ({
        id: w.id,
        start: w.a,
        end: w.b,
        length: w.length,
        inward: w.n,
      })),
    },
    brief,
    routeWidth: width,
    current: scene || null,
    candidates: candidates || null,
    userMessage: message || "",
    history: (history || []).slice(-8),
    feedback: feedback || null,
    catalogue: catalogue || shortlist(),
    ...(program ? {program} : {}),
    ...(variant ? {variant, previousConcepts} : {}),
  };
}
export async function requestModel({
  key,
  model = "gpt-6-astra",
  payload,
  images = [],
  signal,
  fetcher = fetch,
  provider = "responses", baseURL, maxTokens = 8192,
}) {
  if(provider === "chat") {
    const schema=structuredClone(RESPONSE_SCHEMA);
    const skus=payload.catalogue?.map(p=>p.sku);
    if(skus?.length) schema.properties.scenes.items.properties.items.items.properties.sku.enum=skus;
    const {data,...meta}=await requestChatJSON({key,model,baseURL,system:SYSTEM,payload,schema,images,signal,fetcher,maxTokens});
    if(typeof data?.message!=="string" || !Array.isArray(data.scenes) || !data.scenes.length || data.scenes.length>3)throw Error("Le modèle GPU n’a pas renvoyé de composition exploitable.");
    return {...data,...meta};
  }
  const content = [{ type: "input_text", text: JSON.stringify(payload) }];
  for (const image of images) {
    if (
      typeof image?.data === "string" &&
      /^data:image\/(png|jpeg);base64,/.test(image.data)
    ) {
      content.push({
        type: "input_text",
        text: String(image.label || "Vue du projet"),
      });
      content.push({
        type: "input_image",
        image_url: image.data,
        detail: "high",
      });
    }
  }
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "high" },
      max_output_tokens: payload.operation === "create" ? 48000 : 24000,
      instructions: SYSTEM,
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "realroom_compositions",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    }),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error("La réponse du modèle est illisible. Réessayez.");
  }
  if (!response.ok) {
    const err = Error(
      response.status === 401
        ? "La clé du modèle est refusée."
        : response.status === 429
          ? "Le modèle est momentanément limité ou le compte API manque de crédits."
          : response.status === 404
            ? "Le modèle configuré n’est pas accessible à ce compte."
            : "Le service IA a retourné une erreur (" + response.status + ").",
    );
    err.status = response.status;
    throw err;
  }
  if (result.status === "incomplete" || result.error)
    throw Error(
      "Le modèle a interrompu sa réponse. Aucune modification appliquée.",
    );
  const blocks = (result.output || []).flatMap((o) => o.content || []);
  if (blocks.some((b) => b.type === "refusal"))
    throw Error(
      "Le modèle n’a pas pu traiter cette demande. Reformulez vos envies.",
    );
  const raw = blocks
    .filter((b) => b.type === "output_text")
    .map((b) => b.text)
    .join("");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Error(
      "La proposition reçue est incomplète. Aucune modification appliquée.",
    );
  }
  if (
    !parsed ||
    typeof parsed.message !== "string" ||
    !Array.isArray(parsed.scenes) ||
    !parsed.scenes.length ||
    parsed.scenes.length > 3
  )
    throw Error("Le modèle n’a pas renvoyé une composition exploitable.");
  return {
    ...parsed,
    usage: result.usage || null,
    responseId: result.id || null,
  };
}
export async function runDesign(
  input,
  {
    key,
    model = "gpt-6-astra",
    emit = (event) => {},
    signal,
    fetcher = fetch,
    provider = "responses", baseURL, maxTokens = 8192, candidateCount = 3, repairPasses = 3, renderPlan,
  } = {},
) {
  const { room, brief = {}, operation = "create" } = input;
  validateDesignInput(input);
  checkRoom(room);
  if (!room.verified)
    throw Error("Validez d’abord les dimensions et ouvertures du plan.");
  if (!key && provider !== "chat") {
    const e = Error(
      "La connexion au modèle IA n’est pas encore configurée. Les plans, l’éditeur et les exemples restent utilisables.",
    );
    e.code = "MODEL_NOT_CONFIGURED";
    throw e;
  }
  let previous = input.scene ? normalizeScene(input.scene, room) : null;
  const candidates = input.candidates?.map((c) => {
    const scene = normalizeScene(c.scene, room, previous);
    return { scene, report: assess(room, scene, brief, evaluate) };
  });
  emit({
    type: "progress",
    stage:
      operation === "review"
        ? "Analyse des vues 3D et de la composition…"
        : operation === "edit"
          ? "Étude de votre demande et des éléments à préserver…"
          : "Conception de trois aménagements complets…",
  });
  const transport={key,model,provider,baseURL,maxTokens,signal,fetcher};
  const existingItems=[...(previous?.items || []),...(candidates || []).flatMap(c=>c.scene.items)];
  const selected=provider==="chat" ? selectCatalogue(brief,{items:existingItems}) : null;
  const catalogue=selected ? compactCatalogue(selected) : undefined;
  let program=null, initial, calls=[];
  if(provider==="chat" && operation==="create") {
    emit({type:"progress",stage:"Définition des usages, de la palette et des groupes de meubles…"});
    const schema=structuredClone(PROGRAM_SCHEMA);
    schema.properties.inventory.items.properties.sku.enum=selected.map(p=>p.sku);
    const planned=await requestChatJSON({...transport,system:SYSTEM,
      payload:{task:"Définis le programme de cette pièce avant de placer les objets. Analyse la forme et les ouvertures, les priorités explicites du client et les relations entre zones. Choisis un inventaire cohérent, à l’échelle de la pièce, avec les SKU fournis. Pas encore de coordonnées. Explique les arbitrages sans oublier un usage prioritaire.",room,brief,current:previous,catalogue},
      schema,images:input.images,maxTokens:4096});
    program=validateProgram(planned.data,selected);
    calls.push({stage:"program",responseId:planned.responseId,usage:planned.usage});
    initial={message:"Plusieurs compositions du même programme sont proposées.",scenes:[]};
    for(let v=0;v<Math.min(3,Math.max(1,candidateCount));v++) {
      signal?.throwIfAborted();
      emit({type:"progress",stage:"Composition "+(v+1)+" : placement des groupes, éclairage et matières…"});
      const payload=modelPayload({...input,catalogue,program,variant:v+1,previousConcepts:initial.scenes.map(s=>({title:s.title,intent:s.intent,items:s.items.map(i=>({sku:i.sku,x:i.x,z:i.z,rotation:i.rotation}))}))});
      payload.task="Propose exactement UNE composition complète et habitable, variante "+(v+1)+". Respecte les usages du programme ; les meubles peuvent être remplacés par d’autres références du catalogue si nécessaire. Différencie l’organisation des groupes des propositions précédentes. Vérifie les dégagements avant de répondre. Priorité aux usages et aux perspectives, puis aux détails. Renvoie 10 à 28 objets selon la surface ; moins si la pièce l’exige.";
      const answer=await requestModel({...transport,payload,images:input.images});
      initial.scenes.push(answer.scenes[0]);
      calls.push({stage:"composition",responseId:answer.responseId,usage:answer.usage});
    }
  } else {
    initial=await requestModel({...transport,payload:modelPayload({...input,candidates,catalogue}),images:input.images});
    calls.push({responseId:initial.responseId,usage:initial.usage});
  }
  const results=[];
  for (let index = 0; index < initial.scenes.length; index++) {
    let scene = normalizeScene(initial.scenes[index], room, previous);
    let report = assess(room, scene, brief, evaluate);
    emit({
      type: "progress",
      stage:
        "Vérification de « " +
        scene.title +
        " » : dimensions, accès et ouvertures…",
    });
    for (
      let pass = 0;
      pass < Math.min(3, Math.max(0,repairPasses)) &&
      (report.errors > 0 ||
        report.issues.some((i) =>
          ["access", "use-clearance", "missing-activity"].includes(i.code),
        ));
      pass++
    ) {
      signal?.throwIfAborted();
      emit({
        type: "progress",
        stage:
          "Révision " +
          (pass + 1) +
          " de « " +
          scene.title +
          " » · " +
          report.errors +
          " conflit(s), " +
          report.warnings +
          " point(s) de confort",
      });
      const repair = await requestModel({
        ...transport,
        payload: modelPayload({
          operation: "repair",
          room,
          brief,
          scene,
          feedback: report,
          catalogue, program,
          message: input.message,
        }),
        signal,
        fetcher,
      });
      calls.push({ responseId: repair.responseId, usage: repair.usage });
      const next = normalizeScene(repair.scenes[0], room, previous || scene),
        nextReport = assess(room, next, brief, evaluate);
      // Never replace a geometrically stronger result by a weaker repair.
      if (
        nextReport.errors < report.errors ||
        (nextReport.errors === report.errors &&
          nextReport.warnings <= report.warnings)
      ) {
        scene = next;
        report = nextReport;
      } else break;
    }
    scene.provenance = {
      kind: "ai",
      model,
      provider,
      generatedAt: new Date().toISOString(),
      visualReview:
        operation === "review" && input.images.some((i) => i.kind === "3d"),
      planReview: operation === "review",
    };
    results.push({
      scene,
      report,
      changes: previous ? diffScenes(previous, scene) : [],
    });
    emit({ type: "candidate", index, candidate: results.at(-1) });
  }
  results.sort(
    (a, b) =>
      a.report.errors - b.report.errors ||
      a.report.warnings - b.report.warnings,
  );
  if (operation === "review" && results[0]?.report.errors > 0) {
    const baseline = (candidates || [])
      .map((c) => ({ ...c, report: assess(room, c.scene, brief, evaluate) }))
      .filter((c) => c.report.valid)
      .sort((a, b) => a.report.warnings - b.report.warnings)[0];
    if (baseline) {
      results[0] = {
        ...baseline,
        changes: previous ? diffScenes(previous, baseline.scene) : [],
      };
      initial.message =
        "La révision a introduit des conflits. La meilleure proposition contrôlée est conservée.";
    }
  }
  let planReview = operation === "review";
  if (provider === "chat" && renderPlan && operation !== "review" && results.some(c => c.report.valid)) {
    emit({type:"progress",stage:"Comparaison visuelle des plans exacts et affinage de la composition…"});
    const images=[];
    for (const c of results) images.push(await renderPlan(room,c.scene,signal));
    const reviewed=await runDesign({...input,operation:"review",candidates:results,images,
      message:"Compare les plans exacts : équilibre des masses, relations entre usages, points focaux, accès et perspectives. Les couleurs du schéma ne sont pas les matériaux finaux. Choisis la meilleure composition et affine-la si utile. Préserve les usages, les dimensions et les ouvertures."},
      {...transport,candidateCount:1,repairPasses:Math.min(2,repairPasses),emit:e=>{if(e.type==='progress')emit(e);}});
    calls.push(...reviewed.calls.map(c=>({...c,stage:"plan-review"})));
    const chosen=reviewed.candidates[0];
    if(chosen?.report.valid && chosen.report.functional.missing.length <= results[0].report.functional.missing.length) {
      const others=results.filter(c=>c.scene.id!==chosen.scene.id);
      results.splice(0,results.length,chosen,...others.slice(0,Math.max(0,initial.scenes.length-1)));
      initial.message=reviewed.message; planReview=true;
    }
  }
  const result = {
    message: initial.message,
    candidates: results,
    model,
    calls,
    program,
    provider,
    visualReview:
      operation === "review" && input.images.some((i) => i.kind === "3d"),
    planReview,
  };
  emit({ type: "result", result });
  return result;
}

export function validateDesignInput(input) {
  if (!input || !["create", "edit", "review"].includes(input.operation))
    throw Error("Opération invalide.");
  const b = input.brief;
  if (!b || Array.isArray(b) || typeof b !== "object")
    throw Error("Brief invalide.");
  if (
    !Array.isArray(b.activities) ||
    b.activities.length > 12 ||
    b.activities.some((a) => typeof a !== "string" || a.length > 80)
  )
    throw Error("Usages invalides.");
  if (
    typeof b.wishes !== "string" ||
    b.wishes.length > 5000 ||
    String(input.message || "").length > 5000
  )
    throw Error("Demande trop longue.");
  if (
    b.budget != null &&
    (!Number.isFinite(b.budget) || b.budget < 0 || b.budget > 1e6)
  )
    throw Error("Budget invalide.");
  if (
    b.seats != null &&
    (!Number.isInteger(b.seats) || b.seats < 1 || b.seats > 12)
  )
    throw Error("Nombre de places invalide.");
  if (
    input.images != null &&
    (!Array.isArray(input.images) ||
      input.images.length > 10 ||
      input.images.some(
        (i) =>
          !i ||
          typeof i.data !== "string" ||
          i.data.length > 2e6 ||
          !/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(i.data) ||
          String(i.label || "").length > 250,
      ))
  )
    throw Error("Vues invalides ou trop volumineuses.");
  if (input.operation === "review" && !input.images?.length)
    throw Error("Une révision visuelle exige des vues du projet.");
  if (
    input.candidates != null &&
    (!Array.isArray(input.candidates) || input.candidates.length > 3)
  )
    throw Error("Trop de propositions.");
  if (
    input.history != null &&
    (!Array.isArray(input.history) ||
      input.history.length > 20 ||
      input.history.some(
        (h) =>
          !h ||
          !["user", "assistant"].includes(h.role) ||
          typeof h.content !== "string" ||
          h.content.length > 6000,
      ))
  )
    throw Error("Historique invalide.");
  checkRoom(input.room);
  return input;
}
