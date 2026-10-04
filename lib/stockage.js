// Fichiers des utilisateurs (photos, captures de maquette, rendus) : Vercel Blob en ligne
// (BLOB_READ_WRITE_TOKEN), dossier .data/fichiers en local. Chaque fichier est rangé sous
// u/<utilisateur>/… ; le navigateur y accède par /api/fichiers/<chemin>, qui vérifie le propriétaire.
import fs from 'node:fs/promises';
import path from 'node:path';
import { nouvelId } from './db.js';

const LOCAL = path.resolve(/*turbopackIgnore: true*/ process.env.FICHIERS_DIR || '.data/fichiers');
// jeton du magasin Vercel Blob : BLOB_READ_WRITE_TOKEN, ou le même avec le préfixe choisi en
// connectant le magasin au projet (…_READ_WRITE_TOKEN)
export function jetonBlob() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const k = Object.keys(process.env).sort().find(n => /_READ_WRITE_TOKEN$/.test(n) && String(process.env[n]).startsWith('vercel_blob_rw_'));
  return k ? process.env[k] : '';
}
// (ou, nouvelle connexion des magasins, BLOB_STORE_ID avec le jeton OIDC que Vercel donne aux fonctions)
const enLigne = () => !!(jetonBlob() || process.env.BLOB_STORE_ID);
export const fichiersEnLigne = enLigne;
const optJeton = () => { const t = jetonBlob(); return t ? { token: t } : {}; };
const acces = () => (process.env.BLOB_ACCES === 'public' ? 'public' : 'private');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// enregistre des octets ; renvoie la référence à garder en base : { chemin, url, type }.
// nom (facultatif) : nom fixe, réécrit s'il existe (ex. le rendu d'une génération, copié une seule fois)
export async function enregistrer(uid, dossier, octets, type, nom) {
  const ext = EXT[type];
  if (!ext) throw new Error('type de fichier refusé : ' + type);
  if (nom !== undefined && !/^[\w-]{4,64}$/.test(nom)) throw new Error('nom de fichier refusé');
  const chemin = `u/${uid}/${dossier}/${nom || nouvelId()}.${ext}`;
  // sur Vercel, le disque des fonctions est en lecture seule : sans magasin Blob, rien ne s'enregistre
  if (process.env.VERCEL && !enLigne()) throw Object.assign(new Error('BLOB_READ_WRITE_TOKEN manquant : ajoutez un magasin Vercel Blob au projet'), { code: 'cle' });
  if (enLigne()) {
    const { put } = await import('@vercel/blob');
    const r = await put(chemin, octets, { access: acces(), contentType: type, addRandomSuffix: false, allowOverwrite: !!nom, ...optJeton() });
    return { chemin, blob: r.url, url: '/api/fichiers/' + chemin, type };
  }
  const f = path.join(/*turbopackIgnore: true*/ LOCAL, chemin);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, octets);
  return { chemin, url: '/api/fichiers/' + chemin, type };
}

// lit un fichier (référence enregistrée) -> { octets, type } ou null
export async function lire(ref) {
  if (!ref || !ref.chemin || ref.chemin.includes('..')) return null;
  if (ref.blob && enLigne()) {
    const { get } = await import('@vercel/blob');
    const r = await get(ref.blob, { access: acces(), ...optJeton() }).catch(() => null);
    if (!r || !r.stream) return null;
    const octets = Buffer.from(await new Response(r.stream).arrayBuffer());
    return { octets, type: ref.type || r.blob?.contentType || 'image/jpeg' };
  }
  try {
    return { octets: await fs.readFile(path.join(/*turbopackIgnore: true*/ LOCAL, ref.chemin)), type: ref.type || 'image/jpeg' };
  } catch (_) { return null; }
}

// URI data: (pour Claude et fal.ai, qui ne peuvent pas lire les fichiers privés)
export async function enDataUri(ref) {
  const f = await lire(ref);
  return f ? `data:${f.type};base64,${f.octets.toString('base64')}` : null;
}

export async function supprimer(refs) {
  const liste = (refs || []).filter(r => r && r.chemin && !r.chemin.includes('..'));
  if (!liste.length) return;
  if (enLigne()) {
    const { del } = await import('@vercel/blob');
    await del(liste.map(r => r.blob).filter(Boolean), optJeton()).catch(e => console.error('Blob : suppression impossible', liste.map(r => r.chemin), e && e.message));
    return;
  }
  await Promise.all(liste.map(r => fs.rm(path.join(/*turbopackIgnore: true*/ LOCAL, r.chemin), { force: true })));
}

// tous les fichiers d'un utilisateur (suppression de compte)
export async function supprimerTout(uid) {
  if (!/^u_[\w-]+$/.test(uid)) return;
  if (enLigne()) {
    const { list, del } = await import('@vercel/blob');
    let curseur;
    do {
      const r = await list({ prefix: `u/${uid}/`, cursor: curseur, limit: 1000, ...optJeton() });
      if (r.blobs.length) await del(r.blobs.map(b => b.url), optJeton());
      curseur = r.hasMore ? r.cursor : undefined;
    } while (curseur);
    return;
  }
  await fs.rm(path.join(/*turbopackIgnore: true*/ LOCAL, 'u', uid), { recursive: true, force: true });
}

// signature des images : JPEG, PNG, WebP (on ne se fie pas au type annoncé)
export function typeReel(octets) {
  if (octets.length > 3 && octets[0] === 0xFF && octets[1] === 0xD8 && octets[2] === 0xFF) return 'image/jpeg';
  if (octets.length > 8 && octets.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png';
  if (octets.length > 12 && octets.slice(0, 4).toString() === 'RIFF' && octets.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
