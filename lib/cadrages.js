// Même orientation que les quatre photos guidées ; jamais de caméra au milieu d'un renfoncement vide.
import {pointInterieur} from './contour.js';
export const ANGLES_RENDU=['entree','fond','gauche','droite'];
export function vuePourAngle(modele,angle='entree'){
 if(!ANGLES_RENDU.includes(angle))throw Error('angle');
 if(angle==='entree')return modele.vue||{};
 const {largeur:L,profondeur:P,hauteur:H}=modele.dims;
 const prefere={fond:[0,-P/2+.3],gauche:[-L/2+.3,0],droite:[L/2-.3,0]}[angle];
 const [x,z]=pointInterieur(modele,prefere),[cx,cz]=pointInterieur(modele);
 return {x,z,y:Math.min(1.5,H-.2),cx,cz,cy:1.05,fov:50};
}
