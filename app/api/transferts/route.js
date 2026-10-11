import { route,json,verifierOrigine,lireJSON,ip,origine,ErreurHTTP } from '@/lib/http.js';
import { creerTransfert,recevoirTransfert,envoyerTransfert,supprimerTransfert } from '@/lib/transferts.js';
import { ErreurScan,MAX_SCAN_OCTETS } from '@/lib/scan.js';
import QRCode from 'qrcode';

const jeton=r=>r.headers.get('authorization')?.replace(/^Bearer /,'');
export const POST=route(async r=>{
  verifierOrigine(r);
  const b=await lireJSON(r,MAX_SCAN_OCTETS);
  if(b.scan) {try{return json(await envoyerTransfert(jeton(r),b.scan));}catch(e){if(e instanceof ErreurScan)throw new ErreurHTTP(400,e.code);throw e;}}
  const t=await creerTransfert(ip(r)),lang=b.lang==='en'?'en':'fr';
  // Fragment : le secret n'apparaît ni dans les logs d'URL ni dans les Referer.
  const lien=`/${lang}/releve#t=${t.envoi}`;
  const url=new URL(lien,origine(r)).href;
  return json({lecture:t.lecture,lien,expire_le:t.expire_le,qr:await QRCode.toDataURL(url,{errorCorrectionLevel:'M',margin:4,width:256})});
});
export const GET=route(async r=>json(await recevoirTransfert(jeton(r))));
export const DELETE=route(async r=>{verifierOrigine(r);await supprimerTransfert(jeton(r));return json({ok:true});});
