// Première proposition par ReSpace (SG-LLM gradient-spaces/respace-sg-llm-1.5b), démo privée.
//
// Licence des poids : CC BY-NC-SA 4.0, usage non commercial seulement. Le moteur ne s'active
// que si RESPACE_DEMO=1 (accord explicite pour une démo privée), RESPACE_URL et RESPACE_CODE
// sont posés. Sans eux, le moteur de placement actuel reste le seul utilisé.
//
// Partage des rôles : le moteur actuel choisit les meubles (programme, catalogue, budget) et
// produit une disposition complète ; ReSpace décide ensuite où poser et comment orienter chaque
// meuble au sol, un à la fois, sur le plan réel de la pièce. Les dimensions restent toujours
// celles du catalogue. Le moteur vérifie chaque position (pièce, chevauchements, portes) puis
// le résultat entier (circulation, accès, hauteurs) ; un meuble que ReSpace n'arrive pas à
// placer garde la position du moteur, et la proposition dit combien.
//
// Repères (mêmes axes, aucune conversion de dimensions) :
//   RealRoom : mètres, origine au centre du sol, y vers le haut, x vers la droite, z vers
//     l'entrée ; rot autour de y, face avant (sin rot, 0, cos rot) ; dim = [largeur, profondeur, hauteur].
//   SSR (ReSpace) : mètres, y vers le haut ; pos = centre du dessous de la boîte [x, y, z] ;
//     size = [largeur, hauteur, profondeur] ; rot = quaternion [x, y, z, w] autour de y, face
//     avant +z à rot nul (convention 3D-FUTURE). Hypothèse : axes de three.js, sans miroir.
//     À confirmer sur les premières sorties réelles (moteur.mesures.orientation).
import { createHash, timingSafeEqual } from 'node:crypto';
import { verifier, resoudre, produitDe, estMural, estSuspendu, estPlat, estPosable, estAdosse, porteurDe, boite, normaliserAngle } from '../agencement.js';
import { contourDe, segmentsDe, distanceSegment } from '../contour.js';
import { verifierResultat, memoriser, ErreurAssistant } from '../assistant-amenagement.js';
import { etatVariantes } from '../variation-disposition.js';
import { contraintesDe } from '../scene.js';
import { estInstallation } from '../usages.js';

export const MODELE_RESPACE = 'gradient-spaces/respace-sg-llm-1.5b';
const SYSTEME = 'You are a world-class leading interior design expert. Your task is to add furniture given the descriptions in the header and the current list of furniture in the body. You must respond ONLY with a valid JSON string that matches precisely the *format* of the existing JSON in the request. Only output the JSON as a plain string and nothing else.';

export function configRespace(env = process.env) {
  const url = String(env.RESPACE_URL || '').trim().replace(/\/+$/, '').replace(/\/v1$/, '');
  // licence non commerciale : jamais actif sur le site en production, même si les variables y sont posées
  return { actif: env.RESPACE_DEMO === '1' && !!url && !!env.RESPACE_CODE && env.VERCEL_ENV !== 'production', url, jeton: env.RESPACE_JETON || '',
    modele: env.RESPACE_MODELE || '', code: env.RESPACE_CODE || '',
    echantillons: Math.max(1, Math.min(8, Number(env.RESPACE_ECHANTILLONS) || 4)) };
}

/* ---------- conversion RealRoom <-> SSR ---------- */

const r2 = v => Math.round(v * 100) / 100;
export const quatDepuisRot = rot => { const a = normaliserAngle(rot || 0) / 2; return [0, Math.round(Math.sin(a) * 1e5) / 1e5, 0, Math.round(Math.cos(a) * 1e5) / 1e5]; };
// orientation de la face avant (0, 0, 1) tournée par le quaternion, projetée au sol
export function rotDepuisQuat([x, y, z, w]) {
  return normaliserAngle(Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y)));
}
const typePiece = fonction => (fonction === 'chambre' ? 'bedroom' : 'livingroom');

// json.dumps de Python (séparateurs « , » et « : », nombres flottants) : le modèle a été
// entraîné sur ce format exact.
export function jsonPython(v) {
  if (Array.isArray(v)) return '[' + v.map(jsonPython).join(', ') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + jsonPython(x)).join(', ') + '}';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(1) : String(v);
  return JSON.stringify(v);
}

export function objetSSR(item, p) {
  const [w, d, h] = p.dim;
  return { desc: descriptionAnglaise(item, p), size: [r2(w), r2(h), r2(d)], pos: [r2(item.x), 0, r2(item.z)], rot: quatDepuisRot(item.rot) };
}

export function sceneSSR(modele, fonction, objets) {
  const H = r2(modele.dims.hauteur || 2.5), poly = contourDe(modele);
  return { room_type: typePiece(fonction), bounds_top: poly.map(([x, z]) => [r2(x), H, r2(z)]),
    bounds_bottom: poly.map(([x, z]) => [r2(x), 0, r2(z)]), objects: objets };
}

export const instruction = (desc, scene) =>
  `<instruction>\n\t<add>${desc}</add>\n</instruction>\n<scenegraph>\n\t${jsonPython(scene)}\n</scenegraph>`;

// Sortie du modèle : un objet { desc, size, pos, rot }. Tout autre texte est ignoré.
export function lireObjet(texte) {
  const s = String(texte || ''), i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i < 0 || j <= i) return null;
  try {
    const o = JSON.parse(s.slice(i, j + 1)), nums = (a, n) => Array.isArray(a) && a.length === n && a.every(x => Number.isFinite(+x));
    if (!nums(o.pos, 3) || !nums(o.rot, 4)) return null;
    return { pos: o.pos.map(Number), rot: o.rot.map(Number), size: nums(o.size, 3) ? o.size.map(Number) : null };
  } catch (_) { return null; }
}

/* ---------- descriptions (le modèle connaît les descriptions anglaises de 3D-FUTURE) ---------- */

const COULEURS = { noir: 'black', blanc: 'white', gris: 'grey', anthracite: 'dark grey', beige: 'beige', ivoire: 'ivory', creme: 'cream', ecru: 'off-white',
  taupe: 'taupe', marron: 'brown', cognac: 'cognac', camel: 'camel', noyer: 'walnut', sable: 'sand', vert: 'green', bleu: 'blue', rouge: 'red', rose: 'pink',
  orange: 'orange', jaune: 'yellow', bordeaux: 'burgundy', terracotta: 'terracotta', moutarde: 'mustard', turquoise: 'turquoise', corail: 'coral', ocre: 'ochre' };
const MATIERES = { cuir: 'leather', velours: 'velvet', boucle: 'boucle', tissu: 'fabric', bois: 'wooden', metal: 'metal', verre: 'glass', laque: 'lacquered', corde: 'rope' };
const PAR_USAGE = [[/table-basse|basse/, 'coffee table'], [/table-repas|repas-table/, 'dining table'], [/chaise-repas/, 'dining chair'], [/chaise-bureau/, 'office chair'],
  [/chevet/, 'nightstand'], [/meuble-tv|television-meuble/, 'tv stand'], [/bout-canape|appoint/, 'side table'], [/ilot/, 'kitchen island'], [/tabouret-bar/, 'bar stool']];
const PAR_FAMILLE = { lit: 'double bed', canape: 'sofa', fauteuil: 'armchair', meridienne: 'chaise longue', chaise: 'chair', tabouret: 'stool', pouf: 'pouf', banc: 'bench',
  table: 'table', bureau: 'desk', armoire: 'wardrobe', commode: 'chest of drawers', buffet: 'sideboard', meuble: 'cabinet', etagere: 'bookshelf',
  bibliotheque: 'bookshelf', console: 'console table', lampadaire: 'floor lamp', plante: 'potted plant', portemanteau: 'coat rack', tv: 'tv stand' };
const sansAccent = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function descriptionAnglaise(item, p) {
  const usage = sansAccent(item.usageProgramme);
  const sujet = PAR_USAGE.find(([re]) => re.test(usage))?.[1] || PAR_FAMILLE[p.fam] || 'furniture';
  const couleur = (p.couleurs || []).map(c => COULEURS[sansAccent(c).split(/[\s-]/)[0]]).find(Boolean);
  const matiere = MATIERES[sansAccent(p.mat)];
  return [couleur, matiere, sujet].filter(Boolean).join(' ');
}

/* ---------- appel du serveur (API compatible OpenAI : vLLM ou TGI, Inference Endpoint) ---------- */

const modeles = new Map();
async function requete(cfg, chemin, corps, signal) {
  const r = await fetch(cfg.url + chemin, { method: corps ? 'POST' : 'GET', signal,
    headers: { 'Content-Type': 'application/json', ...(cfg.jeton ? { Authorization: 'Bearer ' + cfg.jeton } : {}) },
    body: corps ? JSON.stringify(corps) : undefined });
  if (!r.ok) { const e = new Error('respace-http-' + r.status); e.statut = r.status; throw e; }
  return r.json();
}
async function nomModele(cfg, signal) {
  if (cfg.modele) return cfg.modele;
  // certains moteurs (TGI) n'ont pas /v1/models : le nom du modèle ne compte alors pas
  if (!modeles.has(cfg.url)) modeles.set(cfg.url, (await requete(cfg, '/v1/models', null, signal).catch(e => (e.statut === 404 ? null : Promise.reject(e))))?.data?.[0]?.id || MODELE_RESPACE);
  return modeles.get(cfg.url);
}

// État du serveur : prêt, en train de démarrer (endpoint en veille réveillé par la requête), ou absent.
export async function etatRespace(cfg = configRespace()) {
  if (!cfg.actif) return { etat: 'inactif' };
  try {
    const m = await requete(cfg, '/v1/models', null, AbortSignal.timeout(8000));
    return { etat: 'pret', modele: m.data?.[0]?.id || null };
  } catch (e) {
    // 404 : le serveur répond mais n'a pas la liste des modèles ; l'essai réel dira si la route de génération existe
    if (e.statut === 404) return { etat: 'pret', modele: null, sansListe: true };
    return { etat: [502, 503, 504].includes(e.statut) || e.name === 'TimeoutError' ? 'demarrage' : 'indisponible', detail: e.statut || e.cause?.code || e.name };
  }
}

// Un appel = une proposition du modèle pour un meuble. Renvoie le texte brut.
export function appelReseau(cfg = configRespace()) {
  return async (texte, { signal } = {}) => {
    const r = await requete(cfg, '/v1/chat/completions', { model: await nomModele(cfg, signal),
      messages: [{ role: 'system', content: SYSTEME }, { role: 'user', content: texte }],
      max_tokens: 160, temperature: .7, top_p: .95 }, signal);
    return r.choices?.[0]?.message?.content || '';
  };
}

/* ---------- placement ---------- */

const ECART_ANGLE = .15;   // rad : sous cet écart, l'orientation est ramenée au quart de tour
const auSol = p => !estMural(p.fam) && !estSuspendu(p.fam) && !estPlat(p.fam) && !estPosable(p.fam, p.dim);
function arrondirAngle(r) {
  const q = Math.round(r / (Math.PI / 2)) * Math.PI / 2;
  return normaliserAngle(Math.abs(r - q) < ECART_ANGLE ? q : r);
}
// distance du milieu du dos au mur le plus proche
function dosAuMur(modele, it, p) {
  const d = p.dim[1] / 2, dos = [it.x - Math.sin(it.rot) * d, it.z - Math.cos(it.rot) * d];
  return Math.min(...segmentsDe(modele).map(s => distanceSegment(dos, s.a, s.b)));
}
// objets qui suivent un meuble déplacé : posés dessus, tapis ou suspension au-dessus
function attaches(items, catalogue, mobile) {
  const tous = items.map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p?.dim);
  const lien = new Map();
  for (const e of tous) {
    if (!(estPosable(e.p.fam, e.p.dim) || estPlat(e.p.fam) || estSuspendu(e.p.fam) || estMural(e.p.fam))) continue;
    // un tableau ou une applique suit le meuble adossé devant lequel il est accroché
    const marge = estMural(e.p.fam) ? .3 : 0;
    const dessous = o => o !== e && mobile(o.it, o.p) && (!marge || estAdosse(o.p.fam))
      && (b => e.it.x >= b.x0 - marge && e.it.x <= b.x1 + marge && e.it.z >= b.z0 - marge && e.it.z <= b.z1 + marge)(boite(o.it, o.p.dim));
    const porteur = estPosable(e.p.fam, e.p.dim) ? porteurDe(e.it, e.p, tous) : tous.find(dessous);
    const id = porteur?.it?.id ?? porteur?.id;
    if (id) lien.set(e.it.id, id);
  }
  return lien;
}
function deplacerAvec(enfant, avant, apres) {
  const da = apres.rot - (avant.rot || 0), dx = enfant.x - avant.x, dz = enfant.z - avant.z;
  const c = Math.cos(da), s = Math.sin(da);
  return { ...enfant, x: apres.x + c * dx + s * dz, z: apres.z - s * dx + c * dz, rot: normaliserAngle((enfant.rot || 0) + da) };
}

// Place les meubles au sol d'une disposition du moteur avec ReSpace.
// appel(texte) -> texte du modèle ; injectable (essais sans réseau).
export async function placerAvecRespace({ modele, fonction, agencement, catalogue, appel, echantillons = 4, signal, valider, immobiles = new Set(), rotationsFixes = new Set() }) {
  const debut = Date.now(), mesures = { appels: 0, rejets: 0, illisibles: 0, msAppels: [], echecs: 0, dernierEchec: '', exemple: '' };
  const items = structuredClone(agencement);
  const parId = new Map(items.map(it => [it.id, it]));
  // meubles que ReSpace peut déplacer : ceux du catalogue, et les meubles gardés que leurs
  // contraintes laissent bouger (« peut être déplacé ») ; jamais une installation
  const mobile = (it, p) => !it.fixe && it.garde !== false && !estInstallation(it) && !immobiles.has(it.id) && auSol(p)
    && (it.origine === 'catalogue' || !contraintesDe(it).positionFixe);
  const lien = attaches(items, catalogue, mobile);
  const ordre = items.map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p?.dim && mobile(e.it, e.p))
    .sort((a, b) => b.p.dim[0] * b.p.dim[1] - a.p.dim[0] * a.p.dim[1]);
  const mobiles = new Set(ordre.map(e => e.it.id));
  // la scène part des meubles qui ne bougent pas (conservés, fixes) ; les autres sont ajoutés un à un
  const objets = items.filter(it => !mobiles.has(it.id) && !lien.has(it.id) && it.garde !== false)
    .map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p?.dim && !estMural(e.p.fam) && !estSuspendu(e.p.fam) && !estPlat(e.p.fam))
    .map(e => objetSSR(e.it, e.p));
  const poses = new Map();                    // id -> { x, z, rot } placés par ReSpace
  const sansMobiles = id => !mobiles.has(id) || poses.has(id);
  for (const { it, p } of ordre) {
    if (signal?.aborted) throw new Error('respace-annule');
    const texte = instruction(descriptionAnglaise(it, p), sceneSSR(modele, fonction, objets));
    const reponses = await Promise.all(Array.from({ length: echantillons }, async () => {
      const t0 = Date.now();
      try { return await appel(texte, { signal }); }
      catch (e) { if (e.statut === 401 || e.statut === 403) throw e; mesures.echecs++; mesures.dernierEchec = String(e.statut || e.name || e.message); return ''; }
      finally { mesures.appels++; mesures.msAppels.push(Date.now() - t0); }
    }));
    const candidats = [];
    for (const rep of reponses) {
      if (rep && !mesures.exemple) mesures.exemple = String(rep).replace(/\s+/g, ' ').slice(0, 160);
      const o = lireObjet(rep);
      if (!o) { mesures.illisibles++; continue; }
      const tourne = !rotationsFixes.has(it.id) && !(it.origine === 'existant' && contraintesDe(it).rotationFixe);
      const pose = { ...it, x: o.pos[0], z: o.pos[2], rot: tourne ? arrondirAngle(rotDepuisQuat(o.rot)) : it.rot || 0 };
      delete pose.mur; delete pose.zoneId;
      // contrôle au sol contre ce qui est déjà en place (fixes et meubles déjà posés par ReSpace)
      const autour = items.filter(x => x.id !== it.id && !lien.has(x.id) && sansMobiles(x.id)).map(x => (poses.has(x.id) ? { ...x, ...poses.get(x.id) } : x));
      if (verifier(modele, [...autour, pose], catalogue).some(a => a.ids?.includes(it.id))) { mesures.rejets++; continue; }
      candidats.push({ pose, dos: estAdosse(p.fam) ? dosAuMur(modele, pose, p) : 0 });
    }
    candidats.sort((a, b) => a.dos - b.dos);
    const choix = candidats[0]?.pose;
    if (!choix) continue;
    poses.set(it.id, { x: choix.x, z: choix.z, rot: choix.rot });
    objets.push(objetSSR(choix, p));
  }
  // Disposition finale : meubles posés par ReSpace et leurs objets attachés, puis le solveur du
  // moteur (dos au mur, écarts, objets muraux recollés ; les meubles restés à la place du moteur
  // s'écartent de ceux de ReSpace). Si le contrôle complet échoue, les dernières poses ReSpace
  // sont rendues au moteur une à une.
  const enPlace = items.filter(it => it.garde !== false).length;
  const composer = actives => {
    if (!actives.size) return agencement;
    const brut = items.map(it => {
      if (actives.has(it.id)) { const n = { ...it, ...actives.get(it.id) }; delete n.mur; delete n.zoneId; return n; }
      const porteur = lien.get(it.id);
      if (porteur && actives.has(porteur)) { const n = deplacerAvec(it, parId.get(porteur), actives.get(porteur)); delete n.mur; return n; }
      return it;
    });
    // les meubles gardés immobiles ne bougent pas pendant la résolution
    const sortie = resoudre(modele, brut.map(it => (immobiles.has(it.id) && !it.fixe ? { ...it, fixe: true, fixeTemporaire: true } : it)), catalogue).items
      .map(({ fixeTemporaire, ...it }) => { if (fixeTemporaire) delete it.fixe; return it; });
    return sortie.filter(it => it.garde !== false).length === enPlace ? sortie : null;
  };
  const retenues = new Map(poses);
  let final = composer(retenues);
  const valable = a => !!a && (!valider || valider(a));
  let controles = 0;
  while (retenues.size && !valable(final)) {
    // rendre au moteur le meuble qui débloque tout, sinon le dernier posé (40 contrôles au plus)
    let rendu = null;
    for (const id of [...retenues.keys()].reverse()) {
      if (++controles > 40) break;
      const essai = new Map(retenues); essai.delete(id);
      const a = composer(essai);
      if (valable(a)) { rendu = id; final = a; break; }
    }
    retenues.delete(rendu ?? [...retenues.keys()].pop());
    if (!rendu) final = composer(retenues);
  }
  const orientation = [...retenues.entries()].map(([id, q]) => { const p = produitDe(parId.get(id), catalogue); return estAdosse(p.fam) ? dosAuMur(modele, { ...parId.get(id), ...q }, p) : null; }).filter(v => v != null);
  const ms = mesures.msAppels.sort((a, b) => a - b);
  return { agencement: final, places: retenues.size, total: ordre.length, diagnostic: { appels: mesures.appels, echecs: mesures.echecs, dernierEchec: mesures.dernierEchec, illisibles: mesures.illisibles, rejets: mesures.rejets, exemple: mesures.exemple }, mesures: {
    dureeMs: Date.now() - debut, appels: mesures.appels, illisibles: mesures.illisibles, rejets: mesures.rejets,
    medianeAppelMs: ms.length ? ms[ms.length >> 1] : null,
    // meubles adossés : distance médiane du dos au mur (petite si l'orientation est bien comprise)
    orientation: orientation.length ? { adosses: orientation.length, dosMurMedianM: r2(orientation.sort((a, b) => a - b)[orientation.length >> 1]) } : null } };
}

// Nouvelle proposition de l'assistant, rangée avec les autres (Shuffle) : ReSpace replace les
// meubles de la proposition affichée. Rien n'est écrasé : la pièce garde toutes ses variantes.
export async function varianteRespace(piece, produits, { appel, echantillons, signal }) {
  const contexte = etatVariantes(piece);
  if (!contexte || contexte.obsolete) throw new ErreurAssistant('assistant-obsolete');
  const { etat, courante } = contexte;
  const valider = agencement => {
    try { verifierResultat(piece, { agencement, proposition: courante.proposition }, produits, etat.brief, etat.source); return true; }
    catch (e) { if (e instanceof ErreurAssistant) return false; throw e; }
  };
  // meubles gardés : immobiles sauf contrainte contraire (mêmes règles que verifierResultat)
  const b = etat.brief, gardes = etat.source.filter(it => b.garder.includes(it.id) || b.mode === 'partiel' && !b.aRemplacer.includes(it.id));
  const immobiles = new Set(gardes.filter(it => it.contraintes?.positionFixe ?? true).map(it => it.id));
  const rotationsFixes = new Set(gardes.filter(it => it.contraintes?.rotationFixe ?? it.contraintes?.positionFixe ?? true).map(it => it.id));
  const r = await placerAvecRespace({ modele: piece.modele, fonction: piece.fonction, agencement: courante.agencement, catalogue: produits, appel, echantillons, signal, valider, immobiles, rotationsFixes });
  if (!r.places) { const e = new ErreurAssistant('respace-aucun', 422), d = r.diagnostic; e.diagnostic = `${d.appels} appels, ${d.echecs} échecs${d.dernierEchec ? ' (' + d.dernierEchec + ')' : ''}, ${d.illisibles} réponses illisibles, ${d.rejets} positions refusées par le moteur${d.exemple ? ' ; exemple de réponse : ' + d.exemple : ''}`; throw e; }
  const moteur = { type: 'respace', modele: MODELE_RESPACE, licence: 'CC-BY-NC-SA-4.0', base: courante.id, places: r.places, total: r.total, mesures: r.mesures };
  return memoriser({ agencement: r.agencement, proposition: { ...courante.proposition, moteur } }, etat, Math.max(1, etat.prochaineGraine));
}

// Code d'accès de la démo (comparaison à temps constant).
export function codeDemoValide(cfg, code) {
  if (!cfg.code || typeof code !== 'string') return false;
  const h = s => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(cfg.code), h(code.trim()));
}
