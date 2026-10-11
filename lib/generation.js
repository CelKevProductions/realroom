// Générations payantes : rendu photo réaliste (fal.ai, Nano Banana Pro) et visite 3D (World Labs,
// Marble). Soumission, puis suivi par le navigateur. En simulation : aucun appel, résultats factices.
import { MODELES, SIMULATION } from './config.js';
import { LIBELLES } from './catalogue.js';
import { normaliserAngle, ANGLES, estMural, estSuspendu } from './agencement.js';
import { enregistrer, typeReel } from './stockage.js';

// aucun appel sans délai maximal : une fonction arrêtée en plein appel laisserait un rendu en suspens
const delai = ms => AbortSignal.timeout(ms);

const FILE = 'https://queue.fal.run/';
const WL = 'https://api.worldlabs.ai/marble/v1/';
const SUIVI_FAL = /^https:\/\/queue\.fal\.run\/[a-z0-9._/-]+\/requests\/[0-9a-f-]{36}(\/status)?$/;
const court = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

const FONCTIONS_EN = { salon: 'living room', chambre: 'bedroom', salle_a_manger: 'dining room', bureau: 'home office', salle_de_bain: 'bathroom', cuisine: 'kitchen', entree: 'entrance hall', chambre_enfant: 'child’s bedroom', terrasse: 'terrace', autre: 'room' };

// où se trouve un meuble, en mots, depuis le point de vue de la photo (entrée)
function situer(it, dims) {
  const { largeur: L, profondeur: P } = dims;
  const cote = it.x < -L / 6 ? 'on the left' : it.x > L / 6 ? 'on the right' : 'in the middle';
  const p = P / 2 - it.z;
  const prof = p > P * .66 ? 'at the back of the room' : p < P * .33 ? 'near the camera' : 'halfway into the room';
  const a = normaliserAngle(it.rot || 0);
  const face = Math.abs(a - ANGLES.entree) < .8 ? 'facing the camera' : Math.abs(Math.abs(a) - Math.PI) < .8 ? 'facing away' : a > 0 ? 'facing right' : 'facing left';
  if (it.mur) return `on the ${{ fond: 'far', gauche: 'left', droite: 'right', entree: 'near' }[it.mur]} wall, ${cote}`;
  return `${cote}, ${prof}, ${face}`;
}

// consigne du rendu : la vraie photo (image 1) est modifiée selon la maquette (image 2) et les produits
export function consigneRendu({ piece, modele, items, produits, mode,angle='entree',ambiance='jour',sansPhoto=false,nbAutres=0,nbProduits=8 }) {
  const nouveaux = items.filter(it => it.origine === 'catalogue' && it.garde !== false && produits[it.sku]);
  const retires = items.filter(it => it.origine === 'existant' && it.garde === false);
  const gardes = items.filter(it => it.origine === 'existant' && it.garde !== false);
  const images = nouveaux.filter(it=>produits[it.sku].img).slice(0,nbProduits),imageMaquette=sansPhoto?1:2,premierProduit=(sansPhoto?2:3)+nbAutres;
  const lignes = images.map((it, i) => {
    const p = produits[it.sku], d = p.dim.map(v => Math.round(v * 100));
    return `- Image ${i + premierProduit}: ${LIBELLES[p.fam] || p.fam} "${court(p.nom, 50)}" (${court(p.titre, 140)}), about ${d[0]} × ${d[1]} × ${d[2]} cm (width × depth × height), ${angle==='entree'?situer(it, modele.dims):`at the position and orientation shown in image ${imageMaquette}`}${estSuspendu(p.fam) ? ', hanging from the ceiling' : estMural(p.fam) ? ', fixed on the wall' : ''}.`;
  });
  const generiques=nouveaux.filter(it=>produits[it.sku].generique).map(it=>{const p=produits[it.sku];return `- Generic planning object "${court(p.nom,60)}": ${p.dim.map(v=>Math.round(v*100)).join(' × ')} cm, ${court(p.mat,80)}. Reproduce its model, scale, position and orientation from image ${imageMaquette}; it has no commercial product reference photo.`;});
  return [
    sansPhoto?`Turn image 1, a 3D mock-up of a ${FONCTIONS_EN[piece.fonction] || 'room'}, into one photorealistic interior photo. Preserve its exact camera position, framing, perspective, room outline, openings and furniture layout.`:`Create one photorealistic photo of this ${FONCTIONS_EN[piece.fonction] || 'room'}, refurnished with real designer furniture from Maison Corleone. Image 1 is a real photo taken from the chosen angle. Image 2 is the new 3D layout captured with the user's chosen camera.`,
    !sansPhoto?`Preserve the architecture and finishes from image 1 (walls, windows, doors, floor, ceiling, radiators, sockets). Use the camera, framing and furniture arrangement of image 2; reconcile small differences in the reference photo without changing room geometry.`:'',
    `Image ${imageMaquette} defines the position, orientation and scale of every piece. Keep its exact viewpoint; do not substitute another room angle.`,
    nbAutres?`Images ${sansPhoto?2:3}–${(sansPhoto?1:2)+nbAutres} are other angles of the same real room, for architectural details, materials and finishes only. They must not override the chosen camera or layout.`:'',
    mode === 'partiel'
      ? `Keep every piece of furniture of image 1 exactly as it is, except the pieces removed below; add the new products only.`
      : `Remove from image 1 every piece of furniture and decoration that is not in the mock-up.`,
    retires.length ? `Remove: ${retires.map(it => court(it.p?.nom, 50)).join('; ')}.` : '',
    gardes.length ? `Keep unchanged: ${gardes.map(it => court(it.p?.nom, 50)).join('; ')}.` : '',
    lignes.length ? 'Place these exact products, reproducing each one faithfully (silhouette, proportions, colours, materials, details) from its product photo:' : '',
    ...lignes,
    ...generiques,
    ambiance==='nuit'?`Night photograph: dark exterior through the existing windows, warm light from the existing luminaires, realistic artificial-light shadows. Do not add fixtures or windows.`:`Daytime photograph: natural daylight through the existing windows, consistent realistic contact shadows.`,
    `Photorealistic interior photograph, realistic contact shadows and reflections, sharp focus. Do not add any other furniture, do not change the room, no people, no text, no watermark.`
  ].filter(Boolean).join('\n');
}

export async function soumettreRendu({ photo, capture,autresPhotos=[],produitsImages, consigne }) {
  if (SIMULATION) return { suivi: { simulation: true, image: capture, t: Date.now() } };
  const cle = process.env.FAL_KEY;
  if (!cle) throw Object.assign(new Error('FAL_KEY manquante'), { code: 'cle' });
  const corps = {
    prompt: consigne,
    image_urls: [...(photo?[photo,capture]:[capture]),...autresPhotos,...produitsImages].slice(0,10),
    num_images: 1,
    limit_generations: true,
    aspect_ratio: 'auto',
    output_format: 'jpeg',
    resolution: process.env.FAL_RESOLUTION || '2K'
  };
  const r = await fetch(FILE + MODELES.fal, { method: 'POST', headers: { Authorization: 'Key ' + cle, 'Content-Type': 'application/json' }, body: JSON.stringify(corps), signal: delai(30e3) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.request_id) throw new Error((j.detail && (j.detail[0]?.msg || j.detail)) || 'fal.ai a refusé la demande (' + r.status + ')');
  const base = FILE + MODELES.fal.split('/').slice(0, 2).join('/') + '/requests/' + j.request_id;
  return { suivi: { id: j.request_id, statut: j.status_url || base + '/status', resultat: j.response_url || base } };
}

// -> { etat: 'en_cours' | 'fini' | 'erreur', image?, largeur?, hauteur?, erreur? }
export async function suivreRendu(suivi) {
  if (suivi.simulation) {
    if (Date.now() - suivi.t < 2500) return { etat: 'en_cours' };
    return { etat: 'fini', image: suivi.image, simulation: true };
  }
  const cle = process.env.FAL_KEY;
  if (!SUIVI_FAL.test(suivi.statut) || !SUIVI_FAL.test(suivi.resultat)) return { etat: 'erreur', erreur: 'suivi invalide' };
  const r = await fetch(suivi.statut.endsWith('/status') ? suivi.statut : suivi.statut + '/status', { headers: { Authorization: 'Key ' + cle }, signal: delai(10e3) }).catch(() => null);
  if (!r) return { etat: 'en_cours' };
  const s = await r.json().catch(() => ({}));
  if (!r.ok) return { etat: 'en_cours' };
  if (s.status !== 'COMPLETED') return { etat: 'en_cours', position: s.queue_position };
  const r2 = await fetch(suivi.resultat.replace(/\/status$/, ''), { headers: { Authorization: 'Key ' + cle }, signal: delai(15e3) }).catch(() => null);
  if (!r2) return { etat: 'en_cours' };
  const j = await r2.json().catch(() => ({}));
  const img = j.images && j.images[0];
  if (!r2.ok || !img || !img.url) return { etat: 'erreur', erreur: (j.detail && (j.detail[0]?.msg || j.detail)) || 'aucune image produite' };
  return { etat: 'fini', image: img.url, largeur: img.width, hauteur: img.height };
}

// copie de l'image produite par fal.ai dans nos fichiers, sous un nom fixe (l'identifiant du rendu) :
// deux suivis simultanés écrivent le même fichier. -> référence, null (à réessayer) ou { refus } (définitif)
const HOTES_FAL = /(^|\.)fal\.(media|ai|run)$/;
export async function copierRendu(uid, rid, url) {
  let u;
  try { u = new URL(url); } catch (_) { return { refus: 'adresse invalide' }; }
  const permis = u.protocol === 'https:' && (HOTES_FAL.test(u.hostname) || (u.hostname === 'storage.googleapis.com' && u.pathname.startsWith('/falserverless/')));
  if (!permis) return { refus: 'hôte inattendu : ' + u.hostname };
  const rep = await fetch(u, { signal: delai(20e3) }).catch(() => null);
  if (!rep || !rep.ok) return null;
  const octets = Buffer.from(await rep.arrayBuffer().catch(() => new ArrayBuffer(0)));
  if (!octets.length || octets.length > 25e6) return null;
  const type = typeReel(octets);
  if (!type) return null;
  return enregistrer(uid, 'rendus', octets, type, rid);
}

// image : { base64, extension } (le rendu copié chez nous : les liens fal.ai ne durent pas)
export async function soumettreMonde({ image, nom, description }) {
  if (SIMULATION) return { suivi: { simulation: true, t: Date.now() } };
  const cle = process.env.WLT_API_KEY;
  if (!cle) throw Object.assign(new Error('WLT_API_KEY manquante'), { code: 'cle' });
  const corps = {
    display_name: 'RealRoom · ' + court(nom, 50),   // 64 caractères au plus
    model: MODELES.marble,
    world_prompt: { type: 'image', image_prompt: { source: 'data_base64', data_base64: image.base64, extension: image.extension }, text_prompt: court(description, 400) || 'Interior, photorealistic.' },
    // visible par qui a le lien (le client), sans être public
    permission: { public: false, allow_id_access: true }
  };
  const r = await fetch(WL + 'worlds:generate', { method: 'POST', headers: { 'WLT-Api-Key': cle, 'Content-Type': 'application/json' }, body: JSON.stringify(corps), signal: delai(40e3) });
  const j = await r.json().catch(() => ({}));
  const op = j.operation_id || j.id || j.name;
  if (!r.ok || !op) throw new Error(j.message || j.detail || 'World Labs a refusé la demande (' + r.status + ')');
  return { suivi: { op: String(op).replace(/^operations\//, '') } };
}

export async function suivreMonde(suivi) {
  if (suivi.simulation) {
    if (Date.now() - suivi.t < 4000) return { etat: 'en_cours', progres: 'simulation' };
    return { etat: 'fini', monde: { id: 'simulation', url: null, vignette: null, simulation: true } };
  }
  const cle = process.env.WLT_API_KEY, entetes = { 'WLT-Api-Key': cle };
  if (!/^[0-9a-zA-Z_-]{8,80}$/.test(suivi.op || '')) return { etat: 'erreur', erreur: 'opération invalide' };
  const r = await fetch(WL + 'operations/' + suivi.op, { headers: entetes, signal: delai(10e3) }).catch(() => null);
  if (!r) return { etat: 'en_cours' };
  const o = await r.json().catch(() => ({}));
  if (!r.ok) return { etat: 'en_cours' };
  if (o.error) return { etat: 'erreur', erreur: o.error.message || 'génération échouée' };
  if (!o.done) return { etat: 'en_cours', progres: o.metadata?.progress?.description || '' };
  let w = o.response && (o.response.world || o.response);
  const id = (w && (w.id || w.world_id)) || o.metadata?.world_id;
  if ((!w || !w.assets) && id) {
    const r2 = await fetch(WL + 'worlds/' + id, { headers: entetes, signal: delai(10e3) }).catch(() => null);
    if (!r2) return { etat: 'en_cours' };
    const j2 = await r2.json().catch(() => ({}));
    w = j2.world || j2;
  }
  if (!w) return { etat: 'erreur', erreur: 'monde introuvable' };
  const a = w.assets || {};
  return {
    etat: 'fini',
    monde: {
      id: w.id || id,
      url: w.world_marble_url || ('https://marble.worldlabs.ai/world/' + (w.id || id)),
      vignette: a.thumbnail_url || null,
      pano: a.imagery?.pano_url || null
    }
  };
}
