import { contientPoint } from './contour.js';

// Déplacement métrique à hauteur constante, relatif au regard. Sous-pas et marge
// contre les murs pour ne pas traverser le vide d'une pièce concave.
export function deplacerVuePhoto(modele,vue,commande,secondes) {
  if(!vue||!commande||!Number.isFinite(secondes)||secondes<=0)return vue;
  const avant=Math.max(-1,Math.min(1,commande.avant||0)),droite=Math.max(-1,Math.min(1,commande.droite||0));
  const norm=Math.max(1,Math.hypot(avant,droite));
  if(!avant&&!droite)return vue;
  const l=Math.hypot(vue.cx-vue.x,vue.cz-vue.z),fx=l>.001?(vue.cx-vue.x)/l:0,fz=l>.001?(vue.cz-vue.z)/l:-1;
  const distance=1.2*Math.min(secondes,.1),dx=(fx*avant-fz*droite)/norm*distance,dz=(fz*avant+fx*droite)/norm*distance;
  const pas=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.025));let x=vue.x,z=vue.z;
  // Un cadrage de côté existant peut être à moins de 12 cm d'un mur : il peut s'en éloigner.
  const marge=contientPoint(modele,x,z,.12) ? .12 : .025;
  for(let i=0;i<pas;i++){
    const nx=x+dx/pas,nz=z+dz/pas;
    if(contientPoint(modele,nx,nz,marge)){x=nx;z=nz;}
    else if(contientPoint(modele,nx,z,marge))x=nx;
    else if(contientPoint(modele,x,nz,marge))z=nz;
  }
  if(x===vue.x&&z===vue.z)return vue;
  return {...vue,x,z,cx:vue.cx+x-vue.x,cz:vue.cz+z-vue.z};
}

// Écouteurs retirés à la destruction ; clavier indépendant du raf/WebGL.
export function creerNavigationPhoto({clavier,canvas,estActive,demander,onDebut=()=>{}}) {
  const touches=new Set();let tactile=null,detruit=false;
  const fleches=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
  const liberer=()=>{touches.clear();tactile=null;};
  function bas(e){
    if(detruit||!fleches.has(e.key)||!estActive()||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.isComposing
      ||e.target?.closest?.('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"])'))return;
    e.preventDefault();if(!touches.size)onDebut();touches.add(e.key);demander();
  }
  function haut(e){touches.delete(e.key);}
  clavier.addEventListener('keydown',bas);clavier.addEventListener('keyup',haut);clavier.addEventListener('blur',liberer);canvas.addEventListener('blur',liberer);
  return {
    commande(){if(!estActive()){liberer();return null;}const avant=Number(touches.has('ArrowUp'))-Number(touches.has('ArrowDown'))+(tactile?.avant||0),droite=Number(touches.has('ArrowRight'))-Number(touches.has('ArrowLeft'))+(tactile?.droite||0);return avant||droite?{avant,droite}:null;},
    mouvement(c){if(detruit||!estActive()){liberer();return;}tactile=c;if(c){onDebut();demander();}},
    liberer,
    detruire(){detruit=true;liberer();clavier.removeEventListener('keydown',bas);clavier.removeEventListener('keyup',haut);clavier.removeEventListener('blur',liberer);canvas.removeEventListener('blur',liberer);}
  };
}
