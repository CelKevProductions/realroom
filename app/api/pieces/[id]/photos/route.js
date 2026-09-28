import { route, json, exiger, ErreurHTTP } from '@/lib/http.js';
import { piece, majPhotos, publique } from '@/lib/projets.js';
import { enregistrer, supprimer, typeReel } from '@/lib/stockage.js';
import { LIMITES, ROLES_PHOTO } from '@/lib/config.js';

export const maxDuration = 30;

// POST (multipart) : photo = fichier (JPEG/PNG/WebP, déjà réduit par le navigateur), role, largeur, hauteur
export const POST = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const p = await piece(u.id, id);
  const f = await request.formData().catch(() => null);
  const fichier = f && f.get('photo');
  if (!fichier || typeof fichier.arrayBuffer !== 'function') throw new ErreurHTTP(400, 'photo');
  if (fichier.size > LIMITES.photoOctetsMax) throw new ErreurHTTP(413, 'trop-gros');
  const role = ROLES_PHOTO.includes(f.get('role')) ? f.get('role') : 'detail';
  // une seule photo par rôle principal : elle remplace l'ancienne ; sinon, 8 photos au plus
  const remplace = liste => (role !== 'detail' ? liste.findIndex(x => x.role === role) : -1);
  if (remplace(p.photos || []) < 0 && (p.photos || []).length >= LIMITES.photosParPiece) throw new ErreurHTTP(409, 'limite-photos');
  const octets = Buffer.from(await fichier.arrayBuffer());
  const type = typeReel(octets);
  if (!type) throw new ErreurHTTP(415, 'format');
  const ref = await enregistrer(u.id, 'photos', octets, type);
  const photo = { ...ref, role, largeur: Math.round(+f.get('largeur')) || null, hauteur: Math.round(+f.get('hauteur')) || null };
  try {
    const n = await majPhotos(u.id, id, liste => {
      const photos = [...liste], i = remplace(photos);
      if (i < 0 && photos.length >= LIMITES.photosParPiece) throw new ErreurHTTP(409, 'limite-photos');
      const retirees = i >= 0 ? [photos[i]] : [];
      if (i >= 0) photos[i] = photo; else photos.push(photo);
      // l'ordre compte : la vue depuis l'entrée d'abord
      photos.sort((a, b) => ROLES_PHOTO.indexOf(a.role) - ROLES_PHOTO.indexOf(b.role));
      return { photos, retirees };
    });
    return json({ piece: publique(n) });
  } catch (e) {
    await supprimer([ref]);
    throw e;
  }
});

// DELETE ?url=… : retire une photo
export const DELETE = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const url = new URL(request.url).searchParams.get('url');
  const n = await majPhotos(u.id, id, liste => {
    const photo = liste.find(x => x.url === url);
    if (!photo) throw new ErreurHTTP(404, 'introuvable');
    return { photos: liste.filter(x => x !== photo), retirees: [photo] };
  });
  return json({ piece: publique(n) });
});
