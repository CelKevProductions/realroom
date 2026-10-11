// Maquette métrique synthétique, mêmes positions et caméra. Aucun plan ou cliché client.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { construireObjetGenerique } from '../moteur/generiques.js';
import { segmentsDe } from '../lib/contour.js';
import { estMural, estSuspendu } from '../lib/agencement.js';
import { intervalleHauteur } from '../lib/hauteurs.js';
import { PNG } from 'pngjs';

const dossier=path.resolve('docs/composition-hauteur');
const donnees=await Promise.all(['avant','apres'].map(async n=>JSON.parse(await fs.readFile(path.join(dossier,n+'.json'),'utf8'))));
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
  }else if(estSuspendu(p.fam)){
    const o=new THREE.Mesh(new THREE.CylinderGeometry(w*.35,w/2,h,20),mat('#C6A976'));o.position.y=h/2;g.add(o);
  }else{
    const styles={table:'rectangle',chaise:'chaise',meuble:'tv',lampadaire:'lampadaire',lampe:'lampe',buffet:'buffet'};
    return construireObjetGenerique({...p,st:styles[p.fam]||'rectangle',cols:['#C2AC8B'],mat:'bois'});
  }
  return g;
}
function sceneDe(data,camera){
  const scene=new THREE.Scene(),{modele,catalogue,items}=data;
  boite(scene,5.14,.08,4.14,0,-.08,0,'#E4D7C2');
  for(let i=0;i<24;i++)boite(scene,5,.001,.007,0,.001,-2+i*4/23,'#CBBBA4');
  // Deux parois coupées pour lire la pièce ; les ouvertures des autres murs restent exactes.
  for(const pan of segmentsDe(modele)){
    const coupe=(camera.position.x-pan.centre[0])*pan.n[0]+(camera.position.z-pan.centre[1])*pan.n[1]<0;
    const h=coupe?.06:modele.dims.hauteur;
    const wall=new THREE.Group();wall.position.set(...[pan.centre[0],0,pan.centre[1]]);wall.rotation.y=Math.atan2(-pan.d[1],pan.d[0]);scene.add(wall);
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
  const es=items.map(it=>({it,p:catalogue[it.sku]}));
  for(const e of es){
    const {it,p}=e,g=fixture(p),racine=new THREE.Group(),v=intervalleHauteur(it,p,modele,es);
    racine.position.set(it.x,estMural(p.fam)?it.y:v.bas,it.z);racine.rotation.y=it.rot||0;racine.add(g);scene.add(racine);
    g.traverse(o=>{if(o.isMesh){const m=o.material;o.material=mat(m.color);}});
    if(estSuspendu(p.fam)){
      const longueur=modele.dims.hauteur-v.haut;
      const cable=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,longueur,8),mat('#514A40'));
      cable.position.set(it.x,v.haut+longueur/2,it.z);scene.add(cable);
    }
  }
  scene.add(new THREE.AmbientLight('#FFFFFF',.55));const lumiere=new THREE.DirectionalLight('#FFFFFF',.45);lumiere.position.set(-4,7,5);scene.add(lumiere);
  return scene;
}
// Tampon de profondeur logiciel : SVGRenderer seul trie les triangles et peut masquer des cadres.
function rasteriser(scene,camera,W,H){
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
const W=900,H=570,cam=new THREE.OrthographicCamera(-3.25*W/H,3.25*W/H,3.25,-3.25,.01,100);
const vues=[[-6,5.2,5],[6,5.2,-5]];
const sorties=[];
for(let i=0;i<2;i++){
  const paths=[];
  for(const vue of vues){
    cam.position.set(...vue);cam.lookAt(0,.7,0);cam.updateMatrixWorld();
    const png=rasteriser(sceneDe(donnees[i],cam),cam,W,H);
    paths.push(`<image x="${-W/2}" y="${-H/2}" width="${W}" height="${H}" href="data:image/png;base64,${png.toString('base64')}"/>`);
  }
  sorties.push(paths);
  await fs.writeFile(path.join(dossier,(i?'apres':'avant')+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H*2}" viewBox="0 0 ${W} ${H*2}"><rect width="${W}" height="${H*2}" fill="#FAF8F2"/><g transform="translate(${W/2} ${H/2})">${paths[0]}</g><g transform="translate(${W/2} ${H*1.5})">${paths[1]}</g></svg>\n`);
}
const comparaison=`<svg xmlns="http://www.w3.org/2000/svg" width="1840" height="1370" viewBox="0 0 1840 1370">
<rect width="1840" height="1370" fill="#FAF8F2"/>
<g font-family="sans-serif" fill="#3E3930"><text x="40" y="48" font-size="28">Salon de référence · une pièce achevée</text>
<text x="40" y="78" font-size="17" fill="#716658">20 m² · même mobilier au sol, mêmes ouvertures et même caméra</text>
<text x="40" y="122" font-size="22">Avant · sans la couche composition</text><text x="960" y="122" font-size="22">Après · télévision, éclairage et murs</text></g>
<g transform="translate(460 435)">${sorties[0][0]}</g><g transform="translate(1380 435)">${sorties[1][0]}</g>
<g transform="translate(460 1005)">${sorties[0][1]}</g><g transform="translate(1380 1005)">${sorties[1][1]}</g>
<path d="M920 100V1270" stroke="#D8D0C2"/>
<g font-family="sans-serif" fill="#716658" font-size="17"><text x="40" y="1315">Maquette synthétique métrique · vues opposées, parois proches coupées.</text>
<text x="960" y="1315">TV 43″ · deux tableaux · suspension : 72,5 cm au-dessus de la table.</text>
<text x="40" y="1346">La comparaison isole les ajouts ; elle ne représente pas un ancien résultat du moteur.</text></g></svg>\n`;
await fs.writeFile(path.join(dossier,'comparaison.svg'),comparaison);
// sharp est disponible avec Next, ou dans le runtime de documents ; aucun téléchargement requis.
const require=createRequire(import.meta.url);let sharp;
try{sharp=require('sharp');}catch{sharp=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','__runtime.cjs'))('sharp');}
for(const nom of ['avant','apres','comparaison'])await sharp(path.join(dossier,nom+'.svg')).png().toFile(path.join(dossier,nom+'.png'));
console.log(path.join(dossier,'comparaison.png'));
