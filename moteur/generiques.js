// Modèles paramétriques originaux. Même géométrie dans la pièce, la fiche et les vignettes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { estMural } from '../lib/agencement.js';

export function construireObjetGenerique(p) {
  const g = new THREE.Group(); g.name=p.nom;
  const [w,d,h]=p.dim, col=p.cols[0];
  const materiaux=new Map();
  const mat=(c,metal=0)=>{const cle=c+metal;if(!materiaux.has(cle))materiaux.set(cle,new THREE.MeshStandardMaterial({color:c,roughness:metal ? .35 : .82,metalness:metal}));return materiaux.get(cle);};
  const bois=mat(col), pied=mat(p.st==='chaise'&&p.mat.includes('bois')?col:'#45413B'), clair=mat('#EFE8DC');
  function objet(geo,m,x,y,z){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
  function box(a,b,c,x=0,y=0,z=0,m=bois,r=0){return objet(r?new RoundedBoxGeometry(a,b,c,1,Math.min(r,a/4,b/4,c/4)):new THREE.BoxGeometry(a,b,c),m,x,y+b/2,z);}
  function cyl(rt,rb,b,x=0,y=0,z=0,m=bois){return objet(new THREE.CylinderGeometry(rt,rb,b,20),m,x,y+b/2,z);}
  function pieds(y,a=w,b=d){for(const x of [-1,1])for(const z of [-1,1])box(.035,y,.035,x*(a/2-.045),0,z*(b/2-.045),pied);}
  const rangement=()=>{
    const bas=.1;
    box(w,h-bas,d,0,bas,0,bois,.008); pieds(bas);
    const n=p.st==='commode'?3:Math.max(2,Math.ceil(w/.65));
    for(let i=0;i<n;i++){
      if(p.st==='commode'){
        box(w-.035,(h-bas)/n-.012,.012,0,bas+i*(h-bas)/n+.006,d/2-.006,mat('#D7C3A3'),.003);
        box(w*.22,.012,.02,0,bas+(i+.5)*(h-bas)/n,d/2-.012,pied);
      }else{
        box(w/n-.012,h-bas-.012,.012,-w/2+(i+.5)*w/n,bas+.006,d/2-.006,bois,.003);
        box(.014,.13,.02,-w/2+(i+.5)*w/n+w/n*.3,Math.min(h-.2,bas+(h-bas)*.55),d/2-.012,pied);
      }
    }
  };
  if(p.fam==='lit'){
    pieds(.14);box(w,.16,d,0,.14,0,bois,.012);
    box(w,h,.055,0,0,-d/2+.0275,bois,.018);
    box(w-.06,.19,d-.07,0,.3,.015,clair,.045);
    box(w-.09,.025,d*.62,0,.49,d*.16,mat('#B4BCAC'),.015);
    for(const x of [-1,1])box((w-.16)/2,.085,.37,x*(w-.12)/4,.49,-d*.33,clair,.035);
  }else if(p.fam==='canape'){
    pieds(.1);box(w,.28,d,0,.1,0,bois,.05);
    box(w,h-.38,.14,0,.38,-d/2+.07,bois,.04);
    for(const x of [-1,1])box(.12,.2,d,x*(w/2-.06),.38,0,bois,.03);
    for(const x of [-1,1])box((w-.27)/2,.1,d-.17,x*(w-.25)/4,.38,.06,clair,.035);
  }else if(p.fam==='suspension'){
    cyl(w*.38,w*.5,h*.85,0,0,0,bois);
    cyl(.009,.009,h*.15,0,h*.85,0,pied);
    cyl(w*.33,w*.33,.012,0,.005,0,mat('#FFF0CD'));
  }else if(p.st==='tapis'){
    box(w,h,d,0,0,0,bois,.004);
    for(const z of [-1,1])box(w*.94,.001,.025,0,h-.001,z*(d/2-.055),clair);
  }else if(p.fam==='chaise'){
    const assise=p.st==='bureau'?.47:.45;
    box(w,.06,d,0,assise-.06,0,bois,.018);
    box(w,h-assise-.01,.05,0,assise+.01,-d/2+.025,bois,.02);
    pieds(assise-.06);
  }else if(['table','bureau','console'].includes(p.fam)&&p.st!=='chevet'){
    const ep=.045;
    if(['ronde','ovale'].includes(p.st)){
      const top=cyl(.5,.5,ep,0,h-ep,0);top.scale.set(w,1,d);
      cyl(Math.min(w,d)*.08,Math.min(w,d)*.08,h-ep,0,0,0,pied);
      cyl(Math.min(w,d)*.3,Math.min(w,d)*.3,.025,0,0,0,pied);
    }else{box(w,ep,d,0,h-ep,0,bois,.01);pieds(h-ep);}
  }else if(p.st==='etagere'){
    const ep=.025;
    box(ep,h,d,-w/2+ep/2);box(ep,h,d,w/2-ep/2);
    box(w,h,.015,0,0,-d/2+.0075,bois);
    for(let i=0;i<6;i++)box(w,ep,d,0,i*(h-ep)/5,0,bois);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)box(.028,.15+j*.012,d*.45,-w*.3+j*.032,h*.24+i*h*.19,-d*.06,mat(['#B3A491','#718075','#9D725E'][j]));
  }else if(p.st==='chevet'||['meuble','buffet','armoire','commode'].includes(p.fam))rangement();
  else if(['lampe','lampadaire'].includes(p.fam)){
    const shade=h*(p.fam==='lampe'?.42:.2);
    cyl(w*.36,w*.36,.025,0,0,0,pied);
    cyl(.012,.012,h-shade-.025,0,.025,0,pied);
    cyl(w*.35,w*.5,shade,0,h-shade,0,bois);
    const ampoule=cyl(w*.26,w*.26,.015,0,h-shade+.005,0,mat('#FFF0CD'));
    ampoule.material.emissive=new THREE.Color('#FFE4AC');ampoule.material.emissiveIntensity=.3;
  }else if(['ecran','ecran-mural'].includes(p.st)){
    const mural=p.st==='ecran-mural', bas=mural?-h/2:h*.1, hh=mural?h:h*.9, ep=mural?d:Math.min(.05,d*.25);
    box(w,hh,ep,0,bas,0,mat('#22262B'),.009);
    box(w-.018,hh-.018,.004,0,bas+.009,ep/2,mat('#171E27',.2));
    // Reflet sobre de l'écran, sans contenu ou marque fictive.
    box(w*.4,hh*.014,.001,-w*.16,bas+hh*.86,ep/2+.003,mat('#3B4650'));
    if(!mural)for(const x of [-1,1])box(.055,h*.1,d,x*w*.31,0,0,pied,.004);
  }else if(p.st==='art'){
    box(w,h,d-.008,0,-h/2,-.004,mat('#C7AD86'),.007);
    box(w-.035,h-.035,.006,0,-h/2+.0175,d/2-.006,clair);
    box(w*.28,h*.52,.002,-w*.22,-h*.29,d/2-.001,bois,.006);
    box(w*.2,h*.33,.002,w*.22,-h*.18,d/2-.001,mat('#758078'),.01);
    box(w*.68,h*.016,.002,0,h*.27,d/2-.001,mat('#826955'));
  }else if(p.st==='etagere-murale'){
    box(w,.025,d,0,-h/2,0,bois,.004);
    for(const x of [-1,1])box(.02,h*.4,.02,x*w*.4,-h/2,d/2-.02,pied);
    for(let i=0;i<5;i++)box(.024,h*(.5+i*.065),d*.62,-w*.3+i*.028,-h/2+.025,0,mat(['#B4A086','#77816F','#9B725A'][i%3]));
  }else if(p.st==='miroir'){
    box(w,h,d-.008,0,-h/2,-.004,bois,.012);
    box(w-.04,h-.04,.005,0,-h/2+.02,d/2-.0025,mat('#CFD9D8',.75));
  }else if(p.st==='banc'){box(w,.09,d,0,h-.09,0,bois,.02);pieds(h-.09);}
  else if(p.st==='pouf')cyl(w/2,w/2,h,0,0,0,bois);
  else if(p.st==='fauteuil'){
    box(w,.28,d,0,.12,0,bois,.04);pieds(.12);
    box(w,h-.4,.13,0,.4,-d/2+.065,bois,.04);
    for(const x of [-1,1])box(.1,.2,d,x*(w/2-.05),.4,0,bois,.025);
    box(w-.2,.07,d-.15,0,.4,.04,clair,.025);
  }else if(p.st==='plante'){
    cyl(w*.25,w*.2,h*.23,0,0,0,mat('#C1A88B'));
    cyl(.014,.014,h*.64,0,h*.2,0,mat('#6F624B'));
    for(let i=0;i<10;i++){
      const a=i*2.4, y=h*(.38+i*.05), x=Math.cos(a)*w*.21,z=Math.sin(a)*d*.21;
      const o=objet(new THREE.SphereGeometry(1,8,6),mat(i%2?'#798C65':col),x,y,z);
      o.scale.set(w*.26,h*.115,d*.16);o.rotation.set(.3,a,.4);
    }
  }else if(p.st==='portemanteau'){
    cyl(.02,.02,h,0,0,0,bois);
    for(const x of [-1,1])box(w/2,.025,.025,x*w/4,h*.82,0,pied);
    box(w,.035,d,0,0,0,bois);
  }else throw Error('Modèle générique inconnu : '+p.id);
  const b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());
  g.scale.set(w/s.x,h/s.y,d/s.z);
  g.position.set(-c.x*g.scale.x,(estMural(p.fam)?-h/2:0)-b.min.y*g.scale.y,(estMural(p.fam)?d/2:0)-c.z*g.scale.z);
  g.userData.generique=true;
  return g;
}
