export function encyclopedieActive(choix){
 if(choix===false)return false;
 if(typeof process!=='undefined'&&(process.env.REALROOM_ENCYCLOPEDIE==='0'||process.env.NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE==='0'))return false;
 if(choix===true)return true;
 if(typeof window!=='undefined'){try{const local=localStorage.getItem('rr-encyclopedie');if(local==='0')return false;if(local==='1')return true;}catch(_){}}
 return typeof process!=='undefined'&&(process.env.REALROOM_ENCYCLOPEDIE==='1'||process.env.NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE==='1');
}
