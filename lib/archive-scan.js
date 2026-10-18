// Export Lagarsoft (zip du projet) : seul le relevé JSON est lu, dans le navigateur.
// Lecture ZIP minimale : entrées stockées ou deflate ; ZIP64, chiffrement et fichiers trop lourds refusés.
import { ErreurScan, VERSION_SCAN } from './scan.js';

export const MAX_ARCHIVE_OCTETS = 25e6;
export const MAX_JSON_OCTETS = 5e6;
const MAX_ENTREES = 2000, MAX_CANDIDATS = 20;
const refuser = code => { throw new ErreurScan(code); };

export const estZip = o => o.length >= 4 && o[0] === 0x50 && o[1] === 0x4b && o[2] === 3 && o[3] === 4;

function entrees(o) {
  const v = new DataView(o.buffer, o.byteOffset, o.byteLength);
  let fin = -1;
  for (let i = o.length - 22; i >= Math.max(0, o.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) refuser('scan-archive');
  const total = v.getUint16(fin + 10, true), liste = [];
  if (total > MAX_ENTREES) refuser('scan-archive');
  let p = v.getUint32(fin + 16, true);
  for (let k = 0; k < total; k++) {
    if (p + 46 > o.length || v.getUint32(p, true) !== 0x02014b50) refuser('scan-archive');
    const n = v.getUint16(p + 28, true);
    liste.push({ nom: new TextDecoder().decode(o.subarray(p + 46, p + 46 + n)), chiffre: (v.getUint16(p + 8, true) & 1) === 1,
      methode: v.getUint16(p + 10, true), compresse: v.getUint32(p + 20, true), taille: v.getUint32(p + 24, true), locale: v.getUint32(p + 42, true) });
    p += 46 + n + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return liste;
}

async function contenu(o, e) {
  if (e.chiffre || ![0, 8].includes(e.methode) || [e.compresse, e.taille, e.locale].includes(0xffffffff)) refuser('scan-archive');
  if (e.taille > MAX_JSON_OCTETS) refuser('trop-gros');
  const v = new DataView(o.buffer, o.byteOffset, o.byteLength), l = e.locale;
  if (l + 30 > o.length || v.getUint32(l, true) !== 0x04034b50) refuser('scan-archive');
  const debut = l + 30 + v.getUint16(l + 26, true) + v.getUint16(l + 28, true), brut = o.subarray(debut, debut + e.compresse);
  if (brut.length !== e.compresse) refuser('scan-archive');
  if (e.methode === 0) { if (e.compresse !== e.taille) refuser('scan-archive'); return brut; }
  // La taille annoncée n'engage pas l'archive : la décompression est bornée au fil de l'eau,
  // par tranches de 16 Ko pour que le navigateur ne décompresse jamais un gros bloc d'un coup.
  let lu = 0;
  const source = new ReadableStream({ pull(c) {
    if (lu >= brut.length) { c.close(); return; }
    const fin = Math.min(lu + 16384, brut.length); c.enqueue(brut.slice(lu, fin)); lu = fin;
  } }, { highWaterMark: 0 });
  const lecteur = source.pipeThrough(new DecompressionStream('deflate-raw')).getReader(), morceaux = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      if ((total += value.length) > MAX_JSON_OCTETS) { lecteur.cancel().catch(() => {}); refuser('trop-gros'); }
      morceaux.push(value);
    }
  } catch (err) { if (err instanceof ErreurScan) throw err; refuser('scan-archive'); }
  const sortie = new Uint8Array(total);
  morceaux.reduce((i, m) => (sortie.set(m, i), i + m.length), 0);
  return sortie;
}

const ressembleAUnScan = j => !!j && typeof j === 'object' && (j.version === VERSION_SCAN || Array.isArray(j.walls)
  || Array.isArray(j.rooms) || !!j.structure || !!j.room || !!j.capturedRoom);

// Renvoie le premier JSON de l'archive qui ressemble à un relevé : scan.json d'abord (data/ de Lagarsoft).
export async function scanDepuisArchive(o) {
  if (o.length > MAX_ARCHIVE_OCTETS) refuser('trop-gros');
  // Safari 16.4, Chrome 103, Firefox 113 : sans deflate-raw, le zip ne peut pas être ouvert ici.
  try { new DecompressionStream('deflate-raw'); } catch (_) { refuser('scan-navigateur'); }
  const base = n => n.split('/').pop().toLowerCase();
  const candidats = entrees(o)
    .filter(e => base(e.nom).endsWith('.json') && !base(e.nom).startsWith('._') && !e.nom.startsWith('__MACOSX/'))
    .sort((a, b) => (base(b.nom) === 'scan.json') - (base(a.nom) === 'scan.json') || b.nom.includes('data/') - a.nom.includes('data/'))
    .slice(0, MAX_CANDIDATS);
  for (const e of candidats) {
    let json;
    try { json = JSON.parse(new TextDecoder().decode(await contenu(o, e))); }
    catch (err) { if (err instanceof ErreurScan && err.code === 'trop-gros') throw err; continue; }
    if (ressembleAUnScan(json)) return json;
  }
  refuser('scan-archive');
}
