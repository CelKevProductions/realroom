import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, rendusDe, renduPublic } from '@/lib/projets.js';
import { sql, une, nouvelId } from '@/lib/db.js';
import { CREDITS } from '@/lib/config.js';
import { debiterGeneration, echouerGeneration } from '@/lib/credits.js';
import { enregistrer, enDataUri, lire } from '@/lib/stockage.js';
import { consigneRendu, soumettreRendu, soumettreMonde } from '@/lib/generation.js';
import { PRODUITS } from '@/lib/catalogue.js';
import {optionsRendu} from '@/lib/rendu-options.js';

export const maxDuration = 60;
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const GET = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  return json({ rendus: (await rendusDe(u.id, id)).map(renduPublic) });
});

// POST { type: 'image', capture: dataURL JPEG de la maquette vue de la photo }
//      { type: 'monde', rendu: id d'un rendu photo terminé }
// Le débit crée aussi la ligne du rendu (même requête) ; tout échec ensuite la passe en erreur et
// rembourse (une seule fois). Si la fonction s'arrête en route, le suivi rembourse au bout de 3 minutes.
export const POST = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const b = await lireJSON(request, 4e6);
  const p = await piece(u.id, id);
  if (!p.modele) throw new ErreurHTTP(409, 'pas-de-modele');
  const enCours = await une(`SELECT count(*)::int AS n FROM rendus WHERE utilisateur_id = $1 AND etat = 'en_cours' AND cree_le > now() - interval '15 minutes'`, [u.id]);
  if (enCours.n >= 4) throw new ErreurHTTP(429, 'limite');
  const rid = nouvelId('g_');

  if (b.type === 'monde') {
    const source = await une(`SELECT resultat FROM rendus WHERE id = $1 AND piece_id = $2 AND utilisateur_id = $3 AND type = 'image' AND etat = 'fini'`, [String(b.rendu || ''), id, u.id]);
    const f = source && source.resultat && source.resultat.fichier && await lire(source.resultat.fichier);
    if (!f || !EXTENSIONS[f.type]) throw new ErreurHTTP(400, 'rendu');
    if (!(await debiterGeneration({ uid: u.id, n: CREDITS.monde, motif: 'monde', rid, pieceId: id, type: 'monde', suivi: { source: String(b.rendu) } }))) throw new ErreurHTTP(402, 'credits');
    try {
      const { suivi } = await soumettreMonde({ image: { base64: f.octets.toString('base64'), extension: EXTENSIONS[f.type] }, nom: p.nom, description: (p.proposition && p.proposition.concept) || p.modele.style });
      await sql(`UPDATE rendus SET suivi = $2::jsonb WHERE id = $1`, [rid, JSON.stringify({ ...suivi, source: String(b.rendu) })]);
    } catch (e) {
      await echouerGeneration(rid, e.message);
      throw e.code === 'cle' ? e : new ErreurHTTP(502, 'monde', e.message);
    }
    return json({ id: rid }, 201);
  }

  const capture = String(b.capture || '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(capture) || capture.length > 3.8e6) throw new ErreurHTTP(400, 'capture');
  let options;try{options=optionsRendu(p,b);}catch(e){throw new ErreurHTTP(400,e.code);}
  const {angle,vue,ambiance,photo,sansPhoto,autres,imagesProduitsMax}=options;
  // Un instantané cohérent, puis une révision de ligne vérifiée dans le débit.
  // Deux demandes concurrentes ne peuvent pas partir du même état du compte.
  const etat=await une(`SELECT u.xmin::text AS revision,(SELECT count(*)::int FROM rendus WHERE utilisateur_id=u.id AND type='image' AND etat='en_cours' AND cree_le>now()-interval '15 minutes') AS n FROM utilisateurs u WHERE u.id=$1`,[u.id]);
  if(etat.n)throw new ErreurHTTP(409,'rendu-en-cours');
  if (!(await debiterGeneration({ uid: u.id, n: CREDITS.rendu, motif: 'rendu', rid, pieceId: id, type: 'image',revision:etat.revision,suivi:{angle,vue,ambiance,sansPhoto} }))) {
    const active=await une(`SELECT id FROM rendus WHERE utilisateur_id=$1 AND type='image' AND etat='en_cours' AND cree_le>now()-interval '15 minutes'`,[u.id]);
    throw new ErreurHTTP(active?409:402,active?'rendu-en-cours':'credits');
  }
  let refCapture = null;
  try {
    refCapture = await enregistrer(u.id, 'captures', Buffer.from(capture.split(',')[1], 'base64'), 'image/jpeg');
    let reference=null,photoUri=null;
    if(photo){const fichier=await lire(photo);if(!fichier)throw Error('photo-reference');photoUri=`data:${fichier.type};base64,${fichier.octets.toString('base64')}`;reference={...await enregistrer(u.id,'captures',fichier.octets,fichier.type),largeur:photo.largeur,hauteur:photo.hauteur};}
    await sql(`UPDATE rendus SET suivi = $2::jsonb WHERE id = $1`, [rid, JSON.stringify({ capture: refCapture,reference,angle,vue,ambiance,sansPhoto })]);
    const items = p.agencement || [];
    const mode = (p.proposition && p.proposition.mode) || 'tout';
    const produitsImages = items.filter(it => it.origine === 'catalogue' && it.garde !== false && PRODUITS[it.sku] && PRODUITS[it.sku].img).slice(0, imagesProduitsMax).map(it => PRODUITS[it.sku].img);
    const autresPhotos=await Promise.all(autres.map(enDataUri));
    const consigne = consigneRendu({ piece: p, modele: p.modele, items, produits: PRODUITS, mode,angle,ambiance,sansPhoto,nbAutres:autresPhotos.length,nbProduits:produitsImages.length });
    const { suivi } = await soumettreRendu({ photo: photoUri, capture,autresPhotos,produitsImages, consigne });
    // en simulation, l'image « rendue » est la capture elle-même : on garde sa référence, pas les octets
    if (suivi.simulation) suivi.image = refCapture.url;
    await sql(`UPDATE rendus SET suivi = $2::jsonb WHERE id = $1`, [rid, JSON.stringify({ ...suivi, capture: refCapture,reference,consigne,angle,vue,ambiance,sansPhoto })]);
  } catch (e) {
    await echouerGeneration(rid, e.message);
    throw e.code === 'cle' ? e : new ErreurHTTP(502, 'rendu', e.message);
  }
  return json({ id: rid }, 201);
});
