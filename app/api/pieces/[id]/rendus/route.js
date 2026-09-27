import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, rendusDe } from '@/lib/projets.js';
import { sql, une, nouvelId } from '@/lib/db.js';
import { CREDITS } from '@/lib/config.js';
import { debiter, crediter } from '@/lib/credits.js';
import { enregistrer, enDataUri } from '@/lib/stockage.js';
import { consigneRendu, soumettreRendu, soumettreMonde } from '@/lib/generation.js';
import { PRODUITS } from '@/lib/catalogue.js';

export const maxDuration = 60;

export const GET = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const rendus = await rendusDe(u.id, id);
  return json({ rendus: rendus.map(r => ({ ...r, resultat: r.resultat && { ...r.resultat, fichier: undefined } })) });
});

// POST { type: 'image', capture: dataURL JPEG de la maquette vue de la photo }
//      { type: 'monde', rendu: id d'un rendu photo terminé }
export const POST = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const b = await lireJSON(request, 4e6);
  const p = await piece(u.id, id);
  if (!p.modele) throw new ErreurHTTP(409, 'pas-de-modele');
  const rid = nouvelId('g_');
  const enCours = await une(`SELECT count(*)::int AS n FROM rendus WHERE utilisateur_id = $1 AND etat = 'en_cours' AND cree_le > now() - interval '15 minutes'`, [u.id]);
  if (enCours.n >= 4) throw new ErreurHTTP(429, 'limite');

  if (b.type === 'monde') {
    const source = await une(`SELECT resultat FROM rendus WHERE id = $1 AND piece_id = $2 AND utilisateur_id = $3 AND type = 'image' AND etat = 'fini'`, [String(b.rendu || ''), id, u.id]);
    const image = source && source.resultat && source.resultat.source;
    if (!image) throw new ErreurHTTP(400, 'rendu');
    if (!(await debiter(u.id, CREDITS.monde, 'monde', 'monde:' + rid))) throw new ErreurHTTP(402, 'credits');
    try {
      const { suivi } = await soumettreMonde({ image, nom: p.nom, description: (p.proposition && p.proposition.concept) || p.modele.style });
      await sql(`INSERT INTO rendus (id, piece_id, utilisateur_id, type, credits, suivi) VALUES ($1, $2, $3, 'monde', $4, $5::jsonb)`, [rid, id, u.id, CREDITS.monde, JSON.stringify({ ...suivi, source: String(b.rendu) })]);
    } catch (e) {
      await crediter(u.id, CREDITS.monde, 'remboursement', 'remb:' + rid);
      throw e.code === 'cle' ? e : new ErreurHTTP(502, 'monde', e.message);
    }
    return json({ id: rid }, 201);
  }

  const capture = String(b.capture || '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(capture) || capture.length > 3.8e6) throw new ErreurHTTP(400, 'capture');
  const photo = (p.photos || []).find(f => f.role === 'entree');
  if (!photo) throw new ErreurHTTP(400, 'photo-entree');
  if (!(await debiter(u.id, CREDITS.rendu, 'rendu', 'rendu:' + rid))) throw new ErreurHTTP(402, 'credits');
  try {
    const refCapture = await enregistrer(u.id, 'captures', Buffer.from(capture.split(',')[1], 'base64'), 'image/jpeg');
    const items = p.agencement || [];
    const mode = (p.proposition && p.proposition.mode) || 'tout';
    const consigne = consigneRendu({ piece: p, modele: p.modele, items, produits: PRODUITS, mode });
    const produitsImages = items.filter(it => it.origine === 'catalogue' && it.garde !== false && PRODUITS[it.sku] && PRODUITS[it.sku].img).slice(0, 11).map(it => PRODUITS[it.sku].img);
    const { suivi } = await soumettreRendu({ photo: await enDataUri(photo), capture, produitsImages, consigne });
    // en simulation, l'image « rendue » est la capture elle-même : on garde sa référence, pas les octets
    if (suivi.simulation) suivi.image = refCapture.url;
    await sql(`INSERT INTO rendus (id, piece_id, utilisateur_id, type, credits, suivi) VALUES ($1, $2, $3, 'image', $4, $5::jsonb)`,
      [rid, id, u.id, CREDITS.rendu, JSON.stringify({ ...suivi, capture: refCapture, consigne })]);
  } catch (e) {
    await crediter(u.id, CREDITS.rendu, 'remboursement', 'remb:' + rid);
    throw e.code === 'cle' ? e : new ErreurHTTP(502, 'rendu', e.message);
  }
  return json({ id: rid }, 201);
});
