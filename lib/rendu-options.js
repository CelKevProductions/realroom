import {ANGLES_RENDU,validerVue} from './cadrages.js';
const erreur=code=>{throw Object.assign(new Error(code),{code});};
export function optionsRendu(piece,b){
 const angle=b.angle??'entree';
 if(!ANGLES_RENDU.includes(angle)&&angle!=='libre')erreur('angle');
 if(angle==='libre'&&!b.vue)erreur('vue');
 let vue=null;try{if(b.vue)vue=validerVue(piece.modele,b.vue);}catch(_){erreur('vue');}
 const ambiance=b.ambiance??'jour';if(!['jour','nuit'].includes(ambiance))erreur('ambiance');
 if(b.sansPhoto!==undefined&&typeof b.sansPhoto!=='boolean')erreur('photo-reference');
 const sansPhoto=b.sansPhoto===true,role=b.photoRole??(angle==='libre'?'rendu':angle);
 if(![...ANGLES_RENDU,'rendu'].includes(role))erreur('photo-reference');
 const photo=sansPhoto?null:(piece.photos||[]).find(p=>p.role===role);
 if(!photo&&!sansPhoto)erreur('photo-entree');
 const autres=(piece.photos||[]).filter(p=>ANGLES_RENDU.includes(p.role)&&p.url!==photo?.url).slice(0,3);
 return {angle,vue,ambiance,photo:photo||null,sansPhoto,autres,imagesProduitsMax:10-(photo?2:1)-autres.length};
}
