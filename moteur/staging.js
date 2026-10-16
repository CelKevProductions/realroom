// Primitives de mise en scène originales : pas d'asset externe ni de licence tierce.
// Même constructeur dans l'éditeur WebGL et les rendus de validation.
import * as THREE from 'three';

export function construireProp(p) {
  const [w,d,h]=p.dim,g=new THREE.Group(),couleurs=p.cols||['#B69773','#D5C6AE','#6A8559'];
  const mat=(c,roughness=.8)=>new THREE.MeshStandardMaterial({color:c,roughness});
  const bois=mat(couleurs[0]),clair=mat(couleurs[1]),vert=mat(couleurs[2]),noir=mat('#272D31'),metal=mat('#66584B',.45);
  const mesh=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
  const box=(a,b,c,x=0,y=0,z=0,m=bois)=>mesh(new THREE.BoxGeometry(a,b,c),m,x,y+b/2,z);
  const cyl=(rt,rb,hh,x=0,y=0,z=0,m=clair)=>mesh(new THREE.CylinderGeometry(rt,rb,hh,16),m,x,y+hh/2,z);
  const sphere=(a,b,c,x,y,z,m=vert)=>{const o=mesh(new THREE.SphereGeometry(1,8,6),m,x,y,z);o.scale.set(a,b,c);return o;};
  const pieds=(hh)=>{for(const x of [-1,1])for(const z of [-1,1])box(.027,hh,.027,x*(w/2-.06),0,z*(d/2-.06),metal);};
  switch(p.forme) {
    case 'ency-console-suspendue':
      box(w,h,d,0,0,0,bois);for(const x of [-1,1])box(w*.48,h*.88,.018,x*w*.25,h*.06,d/2,clair);break;
    case 'ency-console':case 'ency-buffet':case 'ency-armoire':
      box(w,h*.065,d,0,h*.935,0,clair);box(w,h*.08,d,0,h*.12,0,bois);
      if(p.forme==='ency-console'){pieds(h*.935);}else{
       box(w,h*.74,d,0,h*.2,0,bois);for(const x of [-1,1]){box(w*.48,h*.71,.018,x*w*.25,h*.21,d/2,clair);box(.012,h*.13,.025,x*w*.08,h*.56,d/2+.016,metal);}pieds(h*.18);
      }break;
    case 'ency-bibliotheque':
      for(const x of [-1,1])box(.025,h,d,x*(w/2-.0125),0,0,bois);
      box(w,h,.016,0,0,-d/2,clair);for(let i=0;i<5;i++)box(w,.025,d,0,i*(h-.025)/4,0,bois);break;
    case 'ency-chariot':
      for(const y of [h*.17,h*.72]){box(w,.026,d,0,y,0,bois);for(const x of [-1,1])box(.018,.055,d,x*(w/2-.01),y,0,metal);}
      for(const x of [-1,1])for(const z of [-1,1]){box(.02,h*.83,.02,x*(w/2-.025),h*.05,z*(d/2-.025),metal);const roue=mesh(new THREE.CylinderGeometry(.038,.038,.016,10),noir,x*(w/2-.025),.038,z*(d/2-.035));roue.rotation.z=Math.PI/2;}
      box(w*.7,.018,.025,0,h*.98,-d/2,metal);break;
    case 'ency-carafe':
      cyl(w*.33,w*.48,h*.66,0,0,0,mat('#ACC7C2',.15));cyl(w*.18,w*.33,h*.22,0,h*.66,0,mat('#ACC7C2',.15));cyl(w*.21,w*.18,h*.12,0,h*.88,0,clair);break;
    case 'plateau':
      box(w,h*.3,d,0,0,0,bois);for(const x of [-1,1])box(.01,h,d,x*(w/2-.005),0,0,bois);for(const z of [-1,1])box(w,h,.01,0,0,z*(d/2-.005),bois);break;
    case 'livres':
      for(let i=0;i<2;i++){box(w*(i?.94:1),h/2,d*(i?.95:1),i*.007,i*h/2,i*.003,i?clair:bois);box(w*.94,h*.17,d*.94,i*.007,i*h/2+h*.15,i*.003,mat('#E8E0D3'));}break;
    case 'livres-debout':
      for(let i=0;i<4;i++)box(w/4*.87,h*(.73+i*.09),d,(i-1.5)*w/4,0,0,i%2?bois:clair);break;
    case 'vase':
      cyl(w*.24,w*.43,h*.72,0,0,0,clair);cyl(w*.22,w*.24,h*.2,0,h*.72,0,clair);
      for(let i=0;i<3;i++){const a=i*2.4;box(.004,h*.45,.004,Math.cos(a)*w*.2,h*.65,Math.sin(a)*d*.15,metal);sphere(w*.14,h*.075,d*.10,Math.cos(a)*w*.25,h*.91+i*h*.02,Math.sin(a)*d*.2,vert);}break;
    case 'bougie':cyl(w/2,w/2,h,0,0,0,clair);box(.003,.009,.003,0,h,0,noir);break;
    case 'bol':
      cyl(w*.46,w*.17,h*.45,0,0,0,clair);
      for(let i=0;i<5;i++){const a=i*2.4;sphere(w*.10,h*.25,d*.10,Math.cos(a)*w*.2,h*.45,Math.sin(a)*d*.2,mat(p.fruitCouleur||(i%2?'#C69F53':'#AA6551')));}break;
    case 'ordinateur':case 'television': {
      const tv=p.forme==='television',mural=p.fam==='tv-murale',bh=mural?0:tv?h*.1:h*.24;
      box(w,h-bh,.035,0,bh,-d*.23,noir);box(w*.94,(h-bh)*.92,.004,0,bh+(h-bh)*.04,-d*.23+.019,mat('#263640',.35));
      box(w*.35,h*.008,.002,-w*.16,h*.88,-d*.23+.023,mat('#70818A'));
      if(tv&&!mural){for(const x of [-1,1])box(.045,bh,d,x*w*.30,0,0,noir);}else if(!tv){box(.035,bh,.025,0,0,-d*.2,metal);box(w*.88,.012,d,0,0,d*.13,noir);for(let i=0;i<5;i++)box(w*.78,.001,.009,0,.012,d*(-.05+i*.07),metal);}break;
    }
    case 'coussin':sphere(w/2,h/2,d/2,0,h/2,0,clair);break;
    case 'plaid':box(w,h,d,0,0,0,clair);for(let i=0;i<6;i++)box(w*.02,.002,d,(-.4+i*.16)*w,h,0,bois);break;
    case 'corbeille':cyl(w*.48,w*.4,h,0,0,0,bois);for(let i=0;i<6;i++)cyl(w*.49,w*.49,.007,0,i*h/6,0,clair);break;
    case 'plante':
      cyl(w*.25,w*.18,h*.23,0,0,0,clair);box(.012,h*.56,.012,0,h*.2,0,metal);
      for(let i=0;i<13;i++){const a=i*2.4,o=sphere(w*.22,h*.075,d*.12,Math.cos(a)*w*.23,h*(.35+i*.047),Math.sin(a)*d*.23,i%3?vert:mat('#899874'));o.rotation.set(.3,a,.4);}break;
    case 'lampadaire':
      cyl(w*.43,w*.43,.024,0,0,0,metal);cyl(.008,.008,h*.83,0,0,0,metal);cyl(w*.35,w/2,h*.17,0,h*.83,0,clair);break;
    case 'suspension':cyl(w*.32,w/2,h,0,0,0,clair);break;
    case 'ilot':case 'comptoir': {
      const cuisine=p.forme==='ilot';
      box(w,h-.055,d,0,0,0,bois);
      if(p.plateauArrondi){
        const a=(w+.025)/2,b=(d+.025)/2,r=.08,s=new THREE.Shape();
        s.moveTo(-a+r,-b);s.lineTo(a-r,-b);s.quadraticCurveTo(a,-b,a,-b+r);s.lineTo(a,b-r);s.quadraticCurveTo(a,b,a-r,b);s.lineTo(-a+r,b);s.quadraticCurveTo(-a,b,-a,b-r);s.lineTo(-a,-b+r);s.quadraticCurveTo(-a,-b,-a+r,-b);
        const top=mesh(new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:false,curveSegments:5}),clair,0,h-.055,0);top.rotation.x=-Math.PI/2;
      }else box(w+.025,.055,d+.025,0,h-.055,0,clair);
      for(let i=0;i<4;i++){box(.008,h*.73,.008,(-.375+i*.25)*w,h*.13,d/2+.002,metal);box(w*.08,.012,.014,(-.375+i*.25)*w,h*.81,d/2+.01,metal);}
      if(cuisine&&p.plateauArrondi){box(w*.23,.004,d*.40,w*.25,h-.004,-d*.16,noir);box(w*.18,.004,d*.38,-w*.25,h-.004,-d*.1,metal);}
      else if(cuisine){box(w*.23,.008,d*.40,w*.25,h+.002,-d*.16,noir);for(const x of [-1,1])for(const z of [-1,1])cyl(.048,.048,.002,w*.25+x*.095,h+.010,-d*.16+z*.10,metal);
        box(w*.18,.009,d*.38,-w*.25,h+.002,-d*.1,metal);box(.012,.16,.012,-w*.25,h,-d*.31,metal);box(.08,.012,.012,-w*.25+.033,h+.15,-d*.31,metal);}
      break;
    }
    case 'tabouret':
      cyl(w*.49,w*.49,.05,0,h-.05,0,bois);pieds(h-.05);for(const z of [-1,1])box(w-.10,.02,.025,0,h*.34,z*(d/2-.06),metal);break;
    case 'bouteilles':
      for(const x of [-1,1]){cyl(w*.20,w*.20,h*.72,x*w*.25,0,0,vert);cyl(w*.085,w*.20,h*.12,x*w*.25,h*.72,0,vert);cyl(w*.085,w*.085,h*.16,x*w*.25,h*.84,0,metal);}break;
    case 'verres':for(const x of [-1,1])cyl(w*.20,w*.17,h,x*w*.26,0,0,mat('#B4CBC6',.2));break;
    case 'bouilloire':cyl(w*.4,w*.43,h*.8,0,0,0,noir);cyl(w*.18,w*.35,h*.15,0,h*.8,0,metal);box(w*.35,h*.03,d*.05,w*.33,h*.7,0,metal);break;
    case 'sculpture':{const o=mesh(new THREE.TorusGeometry(w*.3,w*.13,6,14),clair,0,h*.6,0);o.rotation.y=.3;box(w*.7,h*.14,d,0,0,0,bois);break;}
    case 'lattes':
      box(w,h,d*.33,0,0,d*.17,mat('#76634D'));for(let x=-w/2+.025;x<w/2;x+=.075)box(.036,h,d*.67,x,0,d*.5,bois);break;
    case 'lambris':
      box(w,h,d*.35,0,0,d*.17,clair);for(let x=-w/2+.04;x<w/2;x+=w/3)box(.024,h-.1,d*.65,x,.05,d*.5,bois);for(const y of [.15,h*.55,h-.08])box(w-.08,.025,d*.65,0,y,d*.5,bois);break;
    case 'mur-vegetal':
      box(w,h,d*.4,0,0,d*.2,mat('#354B39'));for(let ix=0;ix<12;ix++)for(let iy=0;iy<12;iy++)sphere(w*.055,h*.048,d*.32,(-.46+ix*.084)*w,(.04+iy*.083)*h,d*.7,(ix+iy)%3?vert:mat('#8B9A73'));break;
    default:throw Error('Prop inconnu : '+p.id);
  }
  // Dimensions contractuelles : accessoires au sol, panneaux à la face du mur.
  const b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());
  g.scale.set(w/s.x,h/s.y,d/s.z);g.position.set(-c.x*g.scale.x,-b.min.y*g.scale.y,(p.fam==='panneau'?d/2:0)-c.z*g.scale.z);
  g.userData.miseEnScene=true;return g;
}
