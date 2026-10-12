// Rendu métrique logiciel commun aux bancs synthétiques.
import * as THREE from 'three';
import { construireObjetGenerique } from '../moteur/generiques.js';
import { segmentsDe, contourDe } from '../lib/contour.js';
import { estMural, estSuspendu } from '../lib/agencement.js';
import { intervalleHauteur } from '../lib/hauteurs.js';
import { PNG } from 'pngjs';
import { construireProp } from '../moteur/staging.js';
import { posesStaging } from '../lib/staging.js';
const mat=c=>new THREE.MeshLambertMaterial({color:c});
function boite(g,w,h,d,x,y,z,c){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));o.position.set(x,y+h/2,z);g.add(o);return o;}
function fixture(p){
  if(p.generique)return construireObjetGenerique(p);
  const [w,d,h]=p.dim,g=new THREE.Group();
  if(['canape','fauteuil'].includes(p.fam)){
    const assise=h*.48,ep=Math.min(.13,d*.17);
    boite(g,w,assise-.08,d,0,.08,0,'#A89984');
    boite(g,w,h-assise,ep,0,assise,-d/2+ep/2,'#B9AA94');
    for(const x of [-1,1])boite(g,.09,h*.24,d,x*(w/2-.045),assise,0,'#B9AA94');
    boite(g,w-.2,.07,d-ep-.07,0,assise,.04,'#DDD0BB');
    for(const x of [-1,1])for(const z of [-1,1])boite(g,.035,.08,.035,x*(w/2-.07),0,z*(d/2-.07),'#514A40');
  }else if(p.fam==='applique') {
    boite(g,w*.15,h,d*.2,0,-h/2,0,'#7B6953');
    boite(g,w,h*.6,d,0,-h*.3,d*.4,'#CDBD9C');
  }else if(estSuspendu(p.fam)){
    const o=new THREE.Mesh(new THREE.CylinderGeometry(w*.35,w/2,h,20),mat('#C6A976'));o.position.y=h/2;g.add(o);
  }else{
    const styles={table:'rectangle',chaise:'chaise',meuble:'tv',lampadaire:'lampadaire',lampe:'lampe',buffet:'buffet',tapis:'tapis'};
    return construireObjetGenerique({...p,st:styles[p.fam]||'rectangle',cols:['#C2AC8B'],mat:'bois'});
  }
  return g;
}
export function sceneDe(data,camera){
  const scene=new THREE.Scene(),{modele,catalogue,items}=data;
  const L=modele.dims.largeur,P=modele.dims.profondeur;
  const mursCoupes=new Set();
  const shape=new THREE.Shape(contourDe(modele).map(([x,z])=>new THREE.Vector2(x,-z)));
  const floor=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat('#E4D7C2'));floor.rotation.x=-Math.PI/2;scene.add(floor);
  // Deux parois coupées pour lire la pièce ; les ouvertures des autres murs restent exactes.
  for(const pan of segmentsDe(modele)){
    const coupe=(camera.position.x-pan.centre[0])*pan.n[0]+(camera.position.z-pan.centre[1])*pan.n[1]<0;
    if(coupe)mursCoupes.add(pan.id);
    const h=coupe?.06:modele.dims.hauteur;
    const wall=new THREE.Group();wall.position.set(pan.centre[0]-pan.n[0]*.0275,0,pan.centre[1]-pan.n[1]*.0275);wall.rotation.y=Math.atan2(-pan.d[1],pan.d[0]);scene.add(wall);
    const os=(modele.murs[pan.id]?.ouvertures||[]).map(o=>({...o,u:o.position*pan.signePosition})).sort((a,b)=>a.u-b.u);
    let debut=-pan.long/2;
    for(const o of os){
      const a=Math.max(-pan.long/2,o.u-o.largeur/2),b=Math.min(pan.long/2,o.u+o.largeur/2);
      if(a>debut)boite(wall,a-debut,h,.055,(a+debut)/2,0,0,'#EBE6DA');
      const bas=Math.min(h,o.allege||0),haut=Math.min(h,bas+o.hauteur);
      if(bas>0)boite(wall,b-a,bas,.055,(a+b)/2,0,0,'#EBE6DA');
      if(h>haut)boite(wall,b-a,h-haut,.055,(a+b)/2,haut,0,'#EBE6DA');
      if(o.type==='fenetre'&&h>.1){
        boite(wall,b-a,.025,.09,(a+b)/2,bas,0,'#9DAEB0');
        boite(wall,.025,haut-bas,.09,(a+b)/2,bas,0,'#9DAEB0');
      }
      debut=Math.max(debut,b);
    }
    if(debut<pan.long/2)boite(wall,pan.long/2-debut,h,.055,(pan.long/2+debut)/2,0,0,'#EBE6DA');
  }
  const es=items.map(it=>({it,p:it.sku?catalogue[it.sku]:it.p}));
  for(const e of es){
    if(estMural(e.p.fam)&&mursCoupes.has(e.it.mur||e.it.attach_to?.id))continue;
    const {it,p}=e,g=fixture(p),racine=new THREE.Group(),v=intervalleHauteur(it,p,modele,es);
    racine.position.set(it.x,estMural(p.fam)?it.y:v.bas,it.z);racine.rotation.y=it.rot||0;racine.add(g);scene.add(racine);
    g.traverse(o=>{if(o.isMesh){const m=o.material;o.material=mat(m.color);}});
    if(estSuspendu(p.fam)){
      const longueur=modele.dims.hauteur-v.haut;
      const cable=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,longueur,8),mat('#514A40'));
      cable.position.set(it.x,v.haut+longueur/2,it.z);scene.add(cable);
    }
  }
  for(const it of posesStaging(items,data.staging,catalogue)) {
    if(it.kind==='wall_item'&&mursCoupes.has(it.mur))continue;
    const root=new THREE.Group();root.position.set(it.x,it.baseY||0,it.z);root.rotation.y=it.rot||0;
    const g=construireProp(it.p);g.traverse(o=>{if(o.isMesh)o.material=mat(o.material.color);});root.add(g);scene.add(root);
    if(it.kind==='ceiling_item') {
      const longueur=modele.dims.hauteur-(it.baseY+it.p.dim[2]);
      if(longueur>0){const cable=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,longueur,6),mat('#66584B'));cable.position.set(it.x,it.baseY+it.p.dim[2]+longueur/2,it.z);scene.add(cable);}
    }
  }
  scene.add(new THREE.AmbientLight('#FFFFFF',.55));const lumiere=new THREE.DirectionalLight('#FFFFFF',.45);lumiere.position.set(-4,7,5);scene.add(lumiere);
  return scene;
}
// Tampon de profondeur logiciel : SVGRenderer seul trie les triangles et peut masquer des cadres.
export function rasteriser(scene,camera,W,H){
  scene.updateMatrixWorld(true);camera.updateMatrixWorld();
  const png=new PNG({width:W,height:H}),depth=new Float64Array(W*H).fill(Infinity);
  for(let i=0;i<W*H;i++){png.data[i*4]=250;png.data[i*4+1]=248;png.data[i*4+2]=242;png.data[i*4+3]=255;}
  const light=new THREE.Vector3(-4,7,5).normalize(),view=new THREE.Vector3();camera.getWorldDirection(view).negate();
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  scene.traverse(o=>{
    if(!o.isMesh)return;
    const pos=o.geometry.attributes.position,idx=o.geometry.index,n=idx?idx.count:pos.count;
    for(let j=0;j<n;j+=3){
      const vs=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(pos,idx?idx.getX(j+k):j+k).applyMatrix4(o.matrixWorld));
      const normal=new THREE.Vector3().subVectors(vs[1],vs[0]).cross(new THREE.Vector3().subVectors(vs[2],vs[0])).normalize();
      if(normal.dot(view)<0)continue;
      const pts=vs.map(v=>{const q=v.clone().project(camera);return{x:(q.x+1)*W/2,y:(1-q.y)*H/2,z:q.z};});
      const [a,b,c]=pts,aire=cross(a,b,c);if(Math.abs(aire)<1e-6)continue;
      const x0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p.x)))),x1=Math.min(W-1,Math.ceil(Math.max(...pts.map(p=>p.x))));
      const y0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p.y)))),y1=Math.min(H-1,Math.ceil(Math.max(...pts.map(p=>p.y))));
      const colour=o.material.color.clone().multiplyScalar(.55+.45*Math.max(0,normal.dot(light))).convertLinearToSRGB();
      const rgb=[colour.r,colour.g,colour.b].map(v=>Math.round(Math.min(1,v)*255));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const q={x:x+.5,y:y+.5},u=cross(b,c,q)/aire,v=cross(c,a,q)/aire,t=1-u-v;
        if(u<-.0001||v<-.0001||t<-.0001)continue;
        const z=u*a.z+v*b.z+t*c.z,k=y*W+x;
        if(z<depth[k]){depth[k]=z;png.data[k*4]=rgb[0];png.data[k*4+1]=rgb[1];png.data[k*4+2]=rgb[2];}
      }
    }
  });
  return PNG.sync.write(png);
}
