// Brouillons anonymes à usage unique : aucune lecture de compte/pièce sur le téléphone.
import { createHash, randomBytes } from 'node:crypto';
import { sql, une, compter } from './db.js';
import { normaliserScan, depuisScan } from './scan.js';
import { ErreurHTTP } from './http.js';

export const empreinteTransfert = t => createHash('sha256').update(String(t)).digest('hex');
export const jetonValide = t => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);
export async function creerTransfert(adresse) {
  if (!(await compter('capture:' + empreinteTransfert(adresse), 12, 3600000))) throw new ErreurHTTP(429,'capture-limite');
  await sql('DELETE FROM transferts_scan WHERE expire_le < now()');
  const lecture=randomBytes(32).toString('base64url'), envoi=randomBytes(32).toString('base64url');
  const r=await une(`INSERT INTO transferts_scan (lecture,envoi,expire_le)
    SELECT $1,$2,now()+interval '15 minutes' WHERE (SELECT count(*) FROM transferts_scan)<500 RETURNING expire_le`,[empreinteTransfert(lecture),empreinteTransfert(envoi)]);
  if(!r) throw new ErreurHTTP(429,'capture-limite');
  return {lecture,envoi,expire_le:r.expire_le};
}
export async function recevoirTransfert(jeton) {
  if(!jetonValide(jeton)) throw new ErreurHTTP(404,'capture-expire');
  const r=await une('SELECT scan,expire_le FROM transferts_scan WHERE lecture=$1 AND expire_le>now()',[empreinteTransfert(jeton)]);
  if(!r) throw new ErreurHTTP(410,'capture-expire');
  return {scan:r.scan || null,expire_le:r.expire_le};
}
export async function envoyerTransfert(jeton, brut) {
  if(!jetonValide(jeton)) throw new ErreurHTTP(404,'capture-expire');
  const scan=normaliserScan(brut);depuisScan(scan);
  // Mise à jour atomique : un second téléphone ne peut ni écraser ni relire un relevé.
  const r=await une('UPDATE transferts_scan SET scan=$2 WHERE envoi=$1 AND expire_le>now() AND scan IS NULL RETURNING expire_le',[empreinteTransfert(jeton),JSON.stringify(scan)]);
  if(!r) throw new ErreurHTTP(410,'capture-expire');
  return {ok:true};
}
export async function supprimerTransfert(jeton) {
  if(jetonValide(jeton)) await sql('DELETE FROM transferts_scan WHERE lecture=$1',[empreinteTransfert(jeton)]);
}
