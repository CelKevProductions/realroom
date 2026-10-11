// Projection SVG locale de nos modèles 3D, sans navigateur ni service d'image.
import { mkdir,writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { OBJETS_GENERIQUES } from '../lib/catalogue-generique.js';
import { construireObjetGenerique } from '../moteur/generiques.js';
class NoeudSVG {
  constructor(n){this.nom=n;this.attrs={};this.childNodes=[];this.style={};}
  setAttribute(k,v){this.attrs[k]=String(v);}
  appendChild(n){this.childNodes.push(n);}
  removeChild(n){this.childNodes.splice(this.childNodes.indexOf(n),1);}
  get outerHTML(){const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;');return `<${this.nom} ${Object.entries(this.attrs).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')}>${this.childNodes.map(n=>n.outerHTML).join('')}</${this.nom}>`;}
}
globalThis.document={createElementNS:(_,n)=>new NoeudSVG(n)};
await mkdir('public/generiques',{recursive:true});
for(const p of Object.values(OBJETS_GENERIQUES)){
  const scene=new THREE.Scene(),g=construireObjetGenerique(p);scene.add(g);
  // SVGRenderer ne gère pas les matériaux physiques ; la vignette utilise le même maillage.
  g.traverse(o=>{if(o.isMesh){const m=o.material;o.material=new THREE.MeshLambertMaterial({color:m.color});m.dispose();}});
  const b=new THREE.Box3().setFromObject(g),centre=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
  const r=Math.hypot(size.x,size.y,size.z)*.55;
  scene.add(new THREE.AmbientLight('#FFFFFF',.85));const light=new THREE.DirectionalLight('#FFFFFF',.6);light.position.set(3,5,4);scene.add(light);
  const cam=new THREE.OrthographicCamera(-r*1.12,r*1.12,r*1.12,-r*1.12,.01,100);
  cam.position.copy(centre).add(new THREE.Vector3(1.5,1.1,2).normalize().multiplyScalar(r*4));cam.lookAt(centre);cam.updateMatrixWorld();
  const ren=new SVGRenderer();ren.setSize(320,320);ren.setPrecision(1);ren.render(scene,cam);
  ren.domElement.setAttribute('xmlns','http://www.w3.org/2000/svg');ren.domElement.setAttribute('role','img');ren.domElement.setAttribute('aria-label',p.nom+' · modèle générique');
  await writeFile('public/generiques/'+p.id+'.svg',ren.domElement.outerHTML+'\n');
  g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
}
console.log(Object.keys(OBJETS_GENERIQUES).length+' vignettes 3D génériques écrites.');
