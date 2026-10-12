import * as THREE from 'three';
export function verifierCotes(objet,fiche,tolerance=.05){
 const b=new THREE.Box3().setFromObject(objet),s=b.getSize(new THREE.Vector3()),mesures=[s.x,s.z,s.y],ecarts=mesures.map((v,i)=>Math.abs(v-fiche.dim[i])/fiche.dim[i]);
 return{id:fiche.id,cibles:fiche.dim,mesures:mesures.map(v=>+v.toFixed(6)),ecartsRelatifs:ecarts.map(v=>+v.toFixed(8)),tolerance,valide:ecarts.every(v=>Number.isFinite(v)&&v<=tolerance),bas:+b.min.y.toFixed(6)};
}
