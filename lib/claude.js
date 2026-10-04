// Claude : analyse des photos (la pièce et ses meubles) et proposition d'aménagement
// (meubles du catalogue placés dans la pièce). Sorties structurées (schéma JSON).
import Anthropic from '@anthropic-ai/sdk';
import { MODELES, SIMULATION } from './config.js';
import { FAMILLES_RELEVEES } from './piece.js';
import { ligneProduit, LIBELLES } from './catalogue.js';
import { texte as textes } from './i18n.js';
import { simulerAnalyse, simulerAmenagement } from './simulation.js';

const LANGUES = { fr: 'French', en: 'English' };
const ORIENT = { type: 'string', enum: ['entree', 'fond', 'gauche', 'droite'] };
const nullable = s => ({ anyOf: [s, { type: 'null' }] });
const objet = (props, requis = Object.keys(props)) => ({ type: 'object', additionalProperties: false, required: requis, properties: props });

const MUR = objet({
  couleur: { type: 'string' },
  ouvertures: { type: 'array', items: objet({ type: { type: 'string', enum: ['fenetre', 'porte', 'baie', 'passage'] }, position: { type: 'number' }, largeur: { type: 'number' }, hauteur: { type: 'number' }, allege: { type: 'number' } }) }
});
const SCHEMA_ANALYSE = objet({
  dimensions: objet({ largeur: { type: 'number' }, profondeur: { type: 'number' }, hauteur: { type: 'number' }, estimees: { type: 'boolean' } }),
  murs: objet({ fond: MUR, gauche: MUR, droite: MUR, entree: MUR }),
  sol: objet({ matiere: { type: 'string', enum: ['parquet', 'carrelage', 'marbre', 'moquette', 'beton', 'vinyle', 'autre'] }, couleur: { type: 'string' } }),
  plafond: objet({ couleur: { type: 'string' } }),
  style: { type: 'string' },
  ambiance: { type: 'string' },
  meubles: { type: 'array', items: objet({
    nom: { type: 'string' }, famille: { type: 'string', enum: FAMILLES_RELEVEES }, style: { type: 'string' },
    largeur: { type: 'number' }, profondeur: { type: 'number' }, hauteur: { type: 'number' },
    couleurs: { type: 'array', items: { type: 'string' } },
    matiere: { type: 'string', enum: ['tissu', 'velours', 'cuir', 'bois', 'metal', 'verre', 'plastique', 'pierre', 'rotin', 'autre'] },
    x: { type: 'number' }, p: { type: 'number' }, oriente_vers: ORIENT, contre_mur: nullable(ORIENT), hauteur_pose: nullable({ type: 'number' }), confiance: { type: 'number' }
  }) },
  vue_principale: objet({ x: { type: 'number' }, p: { type: 'number' }, hauteur: { type: 'number' }, vise_x: { type: 'number' }, vise_p: { type: 'number' }, champ_vertical: { type: 'number' } }),
  remarques: { type: 'array', items: { type: 'string' } }
});
const SCHEMA_AMENAGEMENT = objet({
  concept: { type: 'string' },
  retirer: { type: 'array', items: { type: 'string' } },
  meubles: { type: 'array', items: objet({ produit: { type: 'string' }, x: { type: 'number' }, p: { type: 'number' }, oriente_vers: ORIENT, mur: nullable(ORIENT), hauteur_pose: nullable({ type: 'number' }), raison: { type: 'string' } }) },
  conseils: { type: 'array', items: { type: 'string' } }
});

const REPERE = `Coordinate frame (metres), the same for everything:
- Stand in the doorway, where photo 1 ("from the entrance") was taken, and look into the room.
- largeur (width) = left-to-right size; profondeur (depth) = from the entrance wall to the far wall; hauteur = floor to ceiling.
- x = horizontal position from the room centre: negative to the left, positive to the right (from -width/2 to +width/2).
- p = depth measured from the entrance wall (0) towards the far wall (= depth).
- Walls: "entree" (the doorway wall, behind the photographer of photo 1), "fond" (far wall, facing), "gauche" (left), "droite" (right).
- Openings on "fond" / "entree": position = x of the opening centre. On "gauche" / "droite": position = p of the opening centre. largeur, hauteur; allege = sill height (0 for doors).
- A piece of furniture: x and p = centre of its footprint; largeur = its own width (along its front), profondeur = its own depth, hauteur = its height; oriente_vers = the direction its front faces ("entree" = towards the doorway, "fond" = towards the far wall, "gauche", "droite"); contre_mur = the wall its back touches, or null. Wall lights, mirrors, frames: contre_mur = their wall, hauteur_pose = height of their centre.`;

// Deux chemins vers le modèle : l'API Anthropic (ANTHROPIC_API_KEY), sinon fal.ai (FAL_KEY), qui
// sert les mêmes modèles par son passage OpenRouter compatible OpenAI. Une seule clé fal suffit
// alors pour tout le moteur : lecture des photos, aménagement et rendus.
export const iaDisponible = () => !!(process.env.ANTHROPIC_API_KEY || process.env.FAL_KEY);
const viaFal = () => !process.env.ANTHROPIC_API_KEY && !!process.env.FAL_KEY;
// modèles essayés sur fal, dans l'ordre (le premier que le passage connaît sert)
const MODELES_FAL = [process.env.FAL_LLM_MODELE, 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro'].filter(Boolean);

// délais : une tentative de plus en cas d'erreur passagère, le tout sous le maxDuration des routes (300 s)
function client() {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) throw Object.assign(new Error('ANTHROPIC_API_KEY manquante'), { code: 'cle' });
  return new Anthropic({ apiKey: cle, maxRetries: 1, timeout: 130e3 });
}

// contenu au format Anthropic (texte, image base64) → messages au format OpenAI
const versOpenAI = contenu => contenu.map(b => b.type === 'image'
  ? { type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } }
  : { type: 'text', text: b.text });
// JSON d'une réponse (au cas où le modèle l'entoure de texte ou d'un bloc de code)
function lireJSON(t) {
  const s = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(s); } catch (_) { /* on cherche l'objet dans le texte */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error('réponse du modèle illisible (JSON attendu)');
}
async function appelerFal({ systeme, contenu, schema, max }) {
  const corps = modele => ({
    model: modele,
    max_tokens: Math.min(max, 16000),
    messages: [
      { role: 'system', content: systeme + '\n\nAnswer with a single JSON object that follows this JSON schema exactly, and nothing else:\n' + JSON.stringify(schema) },
      { role: 'user', content: versOpenAI(contenu) }
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'reponse', strict: true, schema } }
  });
  let derniere = null;
  for (const modele of MODELES_FAL) {
    for (const format of [true, false]) {          // sans response_format si le modèle le refuse
      const b = corps(modele);
      if (!format) delete b.response_format;
      const r = await fetch('https://fal.run/openrouter/router/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Key ' + process.env.FAL_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
        signal: AbortSignal.timeout(270e3)
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.choices && j.choices[0]) {
        const c = j.choices[0];
        if (c.finish_reason === 'length') throw new Error('réponse du modèle tronquée');
        const u = j.usage || {};
        return { json: lireJSON(c.message && c.message.content), usage: { input_tokens: u.prompt_tokens, output_tokens: u.completion_tokens, modele } };
      }
      derniere = `fal ${modele} ${r.status} ${String((j.error && (j.error.message || j.error)) || j.detail || '').slice(0, 300)}`;
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error(derniere), { code: 'cle' });
      // 400 sur le format : on retente sans ; autre erreur (modèle inconnu…) : modèle suivant
      if (!(r.status === 400 && format)) break;
    }
  }
  throw new Error(derniere || 'fal : aucun modèle disponible');
}
// Sonnet 5 réfléchit par défaut (réflexion adaptative, effort « high ») et cette réflexion compte dans
// max_tokens : on la garde (elle aide à lire l'espace), à un effort moyen, avec une marge large.
const REFLEXION = /^claude-(sonnet-5|opus-5|opus-4-[5-9]|sonnet-4-6|fable|mythos)/;
async function appeler({ systeme, contenu, schema, max = 24000 }) {
  if (viaFal()) return appelerFal({ systeme, contenu, schema, max });
  const reflexion = REFLEXION.test(MODELES.claude);
  const r = await client().messages.create({
    model: MODELES.claude,
    max_tokens: max,
    ...(reflexion ? { thinking: { type: 'adaptive' } } : {}),
    system: systeme,
    messages: [{ role: 'user', content: contenu }],
    output_config: { ...(reflexion ? { effort: process.env.CLAUDE_EFFORT || 'medium' } : {}), format: { type: 'json_schema', schema } }
  });
  if (r.stop_reason === 'refusal') throw new Error('Claude a décliné la demande');
  if (r.stop_reason === 'max_tokens') throw new Error('réponse de Claude tronquée');
  const bloc = (r.content || []).find(b => b.type === 'text');
  if (!bloc) throw new Error('réponse vide de Claude (' + r.stop_reason + ')');
  return { json: JSON.parse(bloc.text), usage: r.usage };
}

/* ---------------------------------------------------------------
   Analyse des photos
   photos : [{ role, dataUri }] (la première : depuis l'entrée)
   --------------------------------------------------------------- */
export async function analyserPiece({ photos, dims, fonction, notes, langue = 'fr' }) {
  if (SIMULATION) { await new Promise(r => setTimeout(r, 1200)); return simulerAnalyse({ dims, fonction, langue }); }
  const t = textes(langue);
  const roles = { entree: 'from the entrance (main photo)', fond: 'from the far end, looking back towards the entrance', gauche: 'facing the left wall', droite: 'facing the right wall', detail: 'extra view' };
  const contenu = [{
    type: 'text',
    text: [
      `Room purpose: ${t.fonctions[fonction] || fonction}.`,
      dims && (dims.largeur || dims.profondeur || dims.hauteur)
        ? `Measurements given by the client (may be rough; width and depth may be swapped by mistake, check against the photos): width ${dims.largeur ?? '?'} m, depth ${dims.profondeur ?? '?'} m, ceiling height ${dims.hauteur ?? '?'} m.`
        : 'No measurements given: estimate them from the photos.',
      notes ? `Client notes: ${String(notes).slice(0, 600)}` : '',
      `${photos.length} photo(s) follow.`
    ].filter(Boolean).join('\n')
  }];
  photos.forEach((ph, i) => {
    contenu.push({ type: 'text', text: `Photo ${i + 1} — ${roles[ph.role] || roles.detail}:` });
    const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(ph.dataUri);
    contenu.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  });
  const systeme = `You are an interior surveyor. From photos of one room and rough measurements, you rebuild it as a simple 3D model: its box, openings, finishes and the furniture currently in it. Your output feeds a 3D editor, then an image model that will refurnish the real photo 1, so positions and sizes must be as plausible as you can make them.

${REPERE}
- vue_principale: where photo 1 was taken (x, p, hauteur ≈ 1.4–1.6 m) and the floor point it looks at (vise_x, vise_p), plus its vertical field of view in degrees (phone main camera held horizontally ≈ 48, held vertically ≈ 66, ultra-wide ≈ 75).

Rules:
- If measurements are given, use them. Otherwise estimate from standard objects (door ≈ 0.83–0.93 m wide and 2.04 m high, ceiling ≈ 2.5 m, seat ≈ 0.45 m high, double bed 1.4–1.8 m wide…) and set estimees = true.
- List every significant piece of furniture and light fitting you can see: sofas, beds, tables, chairs (one item per chair), cabinets, shelves, TV, rugs, large plants, lamps, pendants, wall lights, mirrors, framed art. Ignore small objects (books, cushions, vases). Fitted kitchen units, radiators, fireplaces: famille "autre".
- Keep every piece inside the room, without overlaps (a rug may lie under furniture; a TV, table lamp or small plant standing on a unit or table gets a position inside that piece's footprint), consistent across all photos (the same piece seen twice is one item).
- Colours: hex #RRGGBB close to what you see.
- Walls with no opening: empty list. The doorway of photo 1 is on the "entree" wall.
- confiance: 0–1, how sure you are of the piece's position and size.
- Write nom (short, e.g. "Canapé 3 places gris"), style, ambiance and remarques (at most 3 short notes on what is uncertain) in ${LANGUES[langue] || 'French'}.`;
  const { json, usage } = await appeler({ systeme, contenu, schema: SCHEMA_ANALYSE, max: 32000 });
  return { analyse: json, usage };
}

/* ---------------------------------------------------------------
   Proposition d'aménagement
   piece : versClaude(...) ; candidats : { famille: [produits] }
   --------------------------------------------------------------- */
export async function proposerAmenagement({ piece, fonction, mode, envies, budget, garder = [], aRemplacer = [], candidats, langue = 'fr' }) {
  if (SIMULATION) return simulerAmenagement({ piece, mode, aRemplacer, candidats, langue });
  const t = textes(langue);
  const catalogue = Object.entries(candidats).map(([fam, l]) => `## ${LIBELLES[fam] || fam}\n` + l.map(ligneProduit).join('\n')).join('\n\n');
  const systeme = `You are an interior designer. You only use real products from the given catalogue (Maison Corleone designer furniture): every piece you place exists and will be bought at that size. You receive a room model, its current furniture, the room purpose, the client's wishes, an optional budget and the catalogue candidates that physically fit in the room. You return a new layout.

${REPERE}

Rules:
- Mode "tout": redesign the room. Remove current pieces that do not suit the new design (put their ids in retirer), except those in garder_obligatoire. Keep useful pieces the catalogue cannot replace (e.g. a desk chair, a TV, shelves) unless the client asks otherwise.
- Mode "partiel": keep every current piece, except those in a_remplacer: remove them (ids in retirer) and put a suitable product in their place and role; then add what the wishes explicitly ask for, nothing else.
- Only use product ids from the candidates. A product appears once, except chairs, stools, wall lights and pendants, which may repeat (one entry each).
- Real sizes matter: every piece inside the room; no overlaps (a rug may go under furniture; a TV or table lamp may stand on a low unit or table: give it a position inside that piece's footprint); keep 0.9 m clear in front of doors and along the main path; 0.6 m around beds; 0.35–0.5 m between a sofa and its coffee table; no tall piece in front of a window.
- Beds: headboard against a wall, ideally not under a window. Sofas: back to a wall, or floating and facing the focal point (window, TV, fireplace). Armchairs: facing the conversation area. Pendants: above a table, a bed side or the room centre. Wall lights and mirrors: give mur and hauteur_pose.
- Budget: the sum of prices of the pieces you add stays under the budget when one is given. Prefer fewer, better pieces to a crowded room.
- Style: coherent with the client's wishes, the finishes and the pieces kept.
- concept: 2–3 sentences; raison: one short sentence per piece; conseils: at most 3 short tips (paint, textiles, what to keep). All in ${LANGUES[langue] || 'French'}.`;
  const contenu = [{
    type: 'text',
    text: [
      `Room purpose: ${t.fonctions[fonction] || fonction}.`,
      `Mode: ${mode}.`,
      `Client wishes: ${envies ? String(envies).slice(0, 1200) : '(none, use your judgement for this room purpose)'}`,
      budget ? `Budget for new pieces: ${budget} €.` : 'No budget given.',
      `garder_obligatoire: ${JSON.stringify(garder)}`,
      `a_remplacer: ${JSON.stringify(aRemplacer)}`,
      '',
      'Room (JSON):',
      JSON.stringify(piece),
      '',
      'Catalogue candidates (id | name | type | width×depth×height | colours | material | price):',
      catalogue || '(no candidate fits this room)'
    ].join('\n')
  }];
  const { json, usage } = await appeler({ systeme, contenu, schema: SCHEMA_AMENAGEMENT, max: 24000 });
  return { proposition: json, usage };
}

/* ---------------------------------------------------------------
   Simulations (REALROOM_SIMULATION=1) : même forme de réponse
   --------------------------------------------------------------- */
