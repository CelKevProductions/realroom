// Claude : analyse des photos (la pièce et ses meubles) et proposition d'aménagement
// (meubles du catalogue placés dans la pièce). Sorties structurées (schéma JSON).
import Anthropic from '@anthropic-ai/sdk';
import { MODELES, SIMULATION } from './config.js';
import { FAMILLES_RELEVEES } from './piece.js';
import { ligneProduit, LIBELLES } from './catalogue.js';
import { texte as textes } from './i18n.js';

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

function client() {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) throw Object.assign(new Error('ANTHROPIC_API_KEY manquante'), { code: 'cle' });
  return new Anthropic({ apiKey: cle, maxRetries: 2, timeout: 110e3 });
}
async function appeler({ systeme, contenu, schema, max = 8000 }) {
  const r = await client().messages.create({
    model: MODELES.claude,
    max_tokens: max,
    system: systeme,
    messages: [{ role: 'user', content: contenu }],
    output_config: { format: { type: 'json_schema', schema } }
  });
  const bloc = (r.content || []).find(b => b.type === 'text');
  if (!bloc) throw new Error('réponse vide de Claude (' + r.stop_reason + ')');
  if (r.stop_reason === 'max_tokens') throw new Error('réponse de Claude tronquée');
  return { json: JSON.parse(bloc.text), usage: r.usage };
}

/* ---------------------------------------------------------------
   Analyse des photos
   photos : [{ role, dataUri }] (la première : depuis l'entrée)
   --------------------------------------------------------------- */
export async function analyserPiece({ photos, dims, fonction, notes, langue = 'fr' }) {
  if (SIMULATION) return simulerAnalyse({ dims, fonction, langue });
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
  const { json, usage } = await appeler({ systeme, contenu, schema: SCHEMA_ANALYSE, max: 9000 });
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
  const { json, usage } = await appeler({ systeme, contenu, schema: SCHEMA_AMENAGEMENT, max: 6000 });
  return { proposition: json, usage };
}

/* ---------------------------------------------------------------
   Simulations (REALROOM_SIMULATION=1) : même forme de réponse
   --------------------------------------------------------------- */
function simulerAnalyse({ dims, langue }) {
  const L = dims?.largeur || 4.2, P = dims?.profondeur || 5, H = dims?.hauteur || 2.55;
  const en = langue === 'en';
  return {
    usage: null,
    analyse: {
      dimensions: { largeur: L, profondeur: P, hauteur: H, estimees: !dims?.largeur },
      murs: {
        fond: { couleur: '#EEE8DF', ouvertures: [{ type: 'fenetre', position: .2, largeur: 1.5, hauteur: 1.4, allege: .9 }] },
        gauche: { couleur: '#EEE8DF', ouvertures: [] },
        droite: { couleur: '#E6DED2', ouvertures: [{ type: 'fenetre', position: P * .6, largeur: 1.1, hauteur: 1.3, allege: .95 }] },
        entree: { couleur: '#EEE8DF', ouvertures: [{ type: 'porte', position: L / 2 - .7, largeur: .9, hauteur: 2.04, allege: 0 }] }
      },
      sol: { matiere: 'parquet', couleur: '#B08D66' },
      plafond: { couleur: '#F5F3EE' },
      style: en ? 'contemporary, simple' : 'contemporain, simple',
      ambiance: en ? 'Bright room, daylight from the far window.' : 'Pièce lumineuse, jour venant de la fenêtre du fond.',
      meubles: [
        { nom: en ? 'Grey 3-seat sofa' : 'Canapé 3 places gris', famille: 'canape', style: '', largeur: 2.1, profondeur: .9, hauteur: .82, couleurs: ['#8C8C8A'], matiere: 'tissu', x: -L / 2 + .46, p: P * .5, oriente_vers: 'droite', contre_mur: 'gauche', hauteur_pose: null, confiance: .8 },
        { nom: en ? 'Oak coffee table' : 'Table basse en chêne', famille: 'table', style: 'basse', largeur: 1, profondeur: .55, hauteur: .4, couleurs: ['#B08A5E'], matiere: 'bois', x: -L / 2 + 1.45, p: P * .5, oriente_vers: 'droite', contre_mur: null, hauteur_pose: null, confiance: .7 },
        { nom: en ? 'Beige rug' : 'Tapis beige', famille: 'tapis', style: '', largeur: 2, profondeur: 1.4, hauteur: .01, couleurs: ['#D8CCB8'], matiere: 'tissu', x: -L / 2 + 1.3, p: P * .5, oriente_vers: 'droite', contre_mur: null, hauteur_pose: null, confiance: .6 },
        { nom: en ? 'Low TV unit' : 'Meuble TV bas', famille: 'meuble', style: '', largeur: 1.6, profondeur: .42, hauteur: .5, couleurs: ['#F2F0EA'], matiere: 'bois', x: L / 2 - .22, p: P * .45, oriente_vers: 'gauche', contre_mur: 'droite', hauteur_pose: null, confiance: .7 },
        { nom: 'TV', famille: 'tv', style: '', largeur: 1.25, profondeur: .06, hauteur: .72, couleurs: ['#111111'], matiere: 'plastique', x: L / 2 - .25, p: P * .45, oriente_vers: 'gauche', contre_mur: 'droite', hauteur_pose: null, confiance: .7 },
        { nom: en ? 'Large plant' : 'Grande plante', famille: 'plante', style: '', largeur: .55, profondeur: .55, hauteur: 1.4, couleurs: ['#4F6B3A'], matiere: 'autre', x: L / 2 - .45, p: P - .45, oriente_vers: 'entree', contre_mur: null, hauteur_pose: null, confiance: .6 }
      ],
      vue_principale: { x: L / 2 - .7, p: .2, hauteur: 1.5, vise_x: -.3, vise_p: P, champ_vertical: 50 },
      remarques: [en ? 'Simulated analysis (no API key).' : 'Analyse simulée (pas de clé d’API).']
    }
  };
}
function simulerAmenagement({ piece, mode, aRemplacer, candidats, langue }) {
  const en = langue === 'en';
  const { largeur: L, profondeur: P } = piece.dimensions;
  const prendre = fam => (candidats[fam] || [])[0];
  const meubles = [];
  const canape = prendre('canape'), fauteuil = prendre('fauteuil'), susp = prendre('suspension') || prendre('lustre'), lit = prendre('lit'), baignoire = prendre('baignoire');
  if (lit) meubles.push({ produit: lit.id, x: 0, p: P - lit.dim[1] / 2 - .05, oriente_vers: 'entree', mur: null, hauteur_pose: null, raison: en ? 'Headboard against the far wall.' : 'Tête de lit contre le mur du fond.' });
  else if (canape) meubles.push({ produit: canape.id, x: -L / 2 + canape.dim[1] / 2 + .05, p: P * .5, oriente_vers: 'droite', mur: null, hauteur_pose: null, raison: en ? 'Back to the left wall, facing the TV.' : 'Dos au mur de gauche, face à la télévision.' });
  else if (baignoire) meubles.push({ produit: baignoire.id, x: 0, p: P - baignoire.dim[1] / 2 - .1, oriente_vers: 'entree', mur: null, hauteur_pose: null, raison: en ? 'In front of the window.' : 'Face à la fenêtre.' });
  if (fauteuil) meubles.push({ produit: fauteuil.id, x: L * .15, p: P * .72, oriente_vers: 'gauche', mur: null, hauteur_pose: null, raison: en ? 'Reading corner near the window.' : 'Coin lecture près de la fenêtre.' });
  if (susp) meubles.push({ produit: susp.id, x: -L * .15, p: P * .5, oriente_vers: 'entree', mur: null, hauteur_pose: null, raison: en ? 'Soft light above the seating area.' : 'Lumière douce au-dessus du coin salon.' });
  const existants = (piece.meubles || []).filter(m => m.origine === 'existant');
  const retirer = mode === 'partiel' ? aRemplacer : existants.filter(m => ['canape', 'fauteuil', 'lit', 'table', 'tapis'].includes(m.famille)).map(m => m.id);
  return {
    usage: null,
    proposition: {
      concept: en ? 'Simulated layout: warm tones, one statement piece per function, room left to breathe.' : 'Aménagement simulé : tons chauds, une pièce forte par usage, de l’air autour.',
      retirer,
      meubles,
      conseils: [en ? 'Simulation mode: add an Anthropic key for real suggestions.' : 'Mode simulation : ajoutez une clé Anthropic pour de vraies propositions.']
    }
  };
}
