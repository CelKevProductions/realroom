// Réduction d'une photo dans le navigateur avant l'envoi : 1600 px au plus, JPEG.
// (orientation EXIF appliquée par createImageBitmap ; les photos HEIC d'iPhone sont
// converties par le navigateur quand il sait les lire.)
export async function reduireImage(fichier, cote = 1600, qualite = .86) {
  let source;
  try {
    source = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch (_) {
    source = await new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ko(new Error('format'));
      img.src = URL.createObjectURL(fichier);
    });
  }
  const w0 = source.width, h0 = source.height;
  const k = Math.min(1, cote / Math.max(w0, h0));
  const w = Math.round(w0 * k), h = Math.round(h0 * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(source, 0, 0, w, h);
  if (source.close) source.close();
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', qualite));
  if (!blob) throw new Error('format');
  return { blob, largeur: w, hauteur: h };
}
