// Même orientation que les quatre photos guidées ; jamais de caméra au milieu d'un renfoncement vide.
import {pointInterieur,contientPoint} from './contour.js';
export const ANGLES_RENDU=['entree','fond','gauche','droite'];
export const POSITIONS_PHOTO=[...ANGLES_RENDU,'fond-gauche','fond-droite','entree-gauche','entree-droite'];
export const NOMS_VUES={fr:{entree:'Entrée',fond:'Fond',gauche:'Gauche',droite:'Droite','fond-gauche':'Coin fond gauche','fond-droite':'Coin fond droit','entree-gauche':'Coin entrée gauche','entree-droite':'Coin entrée droit'},en:{entree:'Entrance',fond:'Back',gauche:'Left',droite:'Right','fond-gauche':'Back left corner','fond-droite':'Back right corner','entree-gauche':'Entrance left corner','entree-droite':'Entrance right corner'}};
export function vuePourAngle(modele,angle='entree'){
 if(!ANGLES_RENDU.includes(angle))throw Error('angle');
 if(angle==='entree')return modele.vue||{};
 const {largeur:L,profondeur:P,hauteur:H}=modele.dims;
 const prefere={fond:[0,-P/2+.3],gauche:[-L/2+.3,0],droite:[L/2-.3,0]}[angle];
 const [x,z]=pointInterieur(modele,prefere),[cx,cz]=pointInterieur(modele);
 return {x,z,y:Math.min(1.5,H-.2),cx,cz,cy:1.05,fov:50};
}

export function vuePourPosition(modele,position='entree'){
 if(!POSITIONS_PHOTO.includes(position))throw Error('angle');
 const {largeur:L,profondeur:P,hauteur:H}=modele.dims;
 const prefere={entree:[0,P/2-.3],fond:[0,-P/2+.3],gauche:[-L/2+.3,0],droite:[L/2-.3,0],'fond-gauche':[-L/2+.3,-P/2+.3],'fond-droite':[L/2-.3,-P/2+.3],'entree-gauche':[-L/2+.3,P/2-.3],'entree-droite':[L/2-.3,P/2-.3]}[position];
 const [x,z]=pointInterieur(modele,prefere),[cx,cz]=pointInterieur(modele);
 return {x,z,y:Math.min(1.5,H-.2),cx,cz,cy:1.05,fov:60};
}

// Le rendu conserve une vraie caméra métrique. Aucune coordonnée invalide n'est
// ramenée silencieusement à l'entrée ; la direction peut regarder vers un mur.
export function validerVue(modele,vue){
 if(!vue||typeof vue!=='object'||Array.isArray(vue))throw Error('vue');
 const cles=['x','y','z','cx','cy','cz','fov'];
 if(cles.some(k=>typeof vue[k]!=='number'||!Number.isFinite(vue[k])))throw Error('vue');
 if(!contientPoint(modele,vue.x,vue.z,.025)||vue.y<.3||vue.y>modele.dims.hauteur-.05||vue.fov<30||vue.fov>90||['cx','cy','cz'].some(k=>Math.abs(vue[k])>60)||Math.hypot(vue.cx-vue.x,vue.cy-vue.y,vue.cz-vue.z)<.05)throw Error('vue');
 return Object.fromEntries(cles.map(k=>[k,vue[k]]));
}
