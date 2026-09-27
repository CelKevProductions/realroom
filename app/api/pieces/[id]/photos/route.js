import { route, json, exiger, ErreurHTTP } from '@/lib/http.js';
import { piece, majPiece, publique } from '@/lib/projets.js';
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
  const octets = Buffer.from(await fichier.arrayBuffer());
  const type = typeReel(octets);
  if (!type) throw new ErreurHTTP(415, 'format');
  const role = ROLES_PHOTO.includes(f.get('role')) ? f.get('role') : 'detail';
  const photos = [...(p.photos || [])];
  // une seule photo par rôle principal : elle remplace l'ancienne
  const ancienne = role !== 'detail' ? photos.findIndex(x => x.role === role) : -1;
  if (ancienne < 0 && photos.length >= LIMITES.photosParPiece) throw new ErreurHTTP(409, 'limite-photos');
  const ref = await enregistrer(u.id, 'photos', octets, type);
  const photo = { ...ref, role, largeur: Math.round(+f.get('largeur')) || null, hauteur: Math.round(+f.get('hauteur')) || null };
  if (ancienne >= 0) { await supprimer([photos[ancienne]]); photos[ancienne] = photo; } else photos.push(photo);
  // l'ordre compte : la vue depuis l'entrée d'abord
  photos.sort((a, b) => ROLES_PHOTO.indexOf(a.role) - ROLES_PHOTO.indexOf(b.role));
  const n = await majPiece(u.id, id, { photos });
  return json({ piece: publique(n) });
});

// DELETE ?url=… : retire une photo
export const DELETE = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const p = await piece(u.id, id);
  const url = new URL(request.url).searchParams.get('url');
  const photo = (p.photos || []).find(x => x.url === url);
  if (!photo) throw new ErreurHTTP(404, 'introuvable');
  await supprimer([photo]);
  const n = await majPiece(u.id, id, { photos: p.photos.filter(x => x !== photo) });
  return json({ piece: publique(n) });
});
