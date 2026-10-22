import { DEFAULT_FINISHES } from './validation.mjs';
import { exportDXF } from './dxf.mjs';
export const EXAMPLE_ROOM={id:'salon-demo',name:'Salon · lecture & musique',polygon:[[-3.6,-2.8],[3.6,-2.8],[3.6,2.8],[-3.6,2.8]],height:2.7,openings:[{id:'door-1',type:'door',wall:2,offset:6.3,width:.9,height:2.1,sill:0,swing:'inward',hinge:'end'},{id:'window-1',type:'window',wall:0,offset:4.8,width:2.1,height:1.45,sill:.85,swing:'fixed',hinge:'start'},{id:'window-2',type:'window',wall:1,offset:1.65,width:1.5,height:1.45,sill:.85,swing:'fixed',hinge:'start'}],source:{format:'exemple',units:'m'},verified:true};
export const EMPTY_SCENE={id:'empty',title:'Votre pièce, une page blanche',intent:'Définissez vos envies, puis lancez la composition.',items:[],zones:[],rationale:[],limitations:[],finishes:DEFAULT_FINISHES,provenance:null};
const item=(id,sku,x,z,rotation=0,zone='salon',y=0)=>({id,sku,x,z,y,rotation,zone,note:'',locked:false});
export const EXAMPLE_SCENE={id:'example',title:'Un salon pour ralentir',intent:'Une conversation au centre, un fauteuil vers la lumière, et un piano qui trouve sa place sans fermer la perspective.',finishes:{floor:'oak',wallColor:'#eee8dd',accentWall:3,accentColor:'#a4aa91'},zones:[{id:'salon',name:'Se retrouver',activity:'conversation',rationale:'Canapé et fauteuil cadrent un tapis de laine.'},{id:'lecture',name:'Lire à la lumière',activity:'lecture',rationale:'Le fauteuil profite des fenêtres, avec une lumière d’appoint.'},{id:'musique',name:'Jouer & écouter',activity:'musique',rationale:'Un piano le long du mur et son banc indépendant.'}],items:[
 item('sofa','mcs-01',-.5,-2.12,0),
 item('rug','atelier-tapis',-.5,-.55,0),
 item('coffee','atelier-table-basse',-.5,-.8,0),
 item('chair','abbraccio',1.66,.05,295),
 item('reading','cognac-shell',2.82,-1.72,325,'lecture'),
 item('lamp','fpf-lamp-7705',3.25,.55,0,'lecture'),
 item('piano','atelier-piano',2.75,2.44,180,'musique'),
 item('bench','atelier-banc-piano',2.75,1.52,180,'musique'),
 item('library','atelier-bibliotheque',-3.39,-1.85,90,'lecture'),
 item('art','atelier-cadre',-.65,-2.76,0,'salon',1.4),
 item('books','atelier-livres',-.65,-.8,0,'salon',.36),
 item('vase','atelier-vase',-.15,-.8,0,'salon',.36)
 ],rationale:['Une palette de chêne, bouclette, vert sauge et cuir cognac.','Les ouvertures et les dimensions des objets sont conservées.'],limitations:['Exemple composé manuellement pour explorer l’interface ; il ne s’agit pas d’une génération en direct.'],provenance:{kind:'example',model:null}};
export const EXAMPLE_L_ROOM={id:'bureau-L',name:'Pièce en L',polygon:[[-3,-2.5],[3,-2.5],[3,.6],[.7,.6],[.7,2.5],[-3,2.5]],height:2.6,openings:[{id:'ld',type:'door',wall:4,offset:2.8,width:.85,height:2.1,sill:0,swing:'inward',hinge:'start'},{id:'lw',type:'window',wall:0,offset:3.5,width:1.8,height:1.3,sill:.95,swing:'fixed',hinge:'start'}],verified:true,source:{format:'exemple',units:'m'}};
export const exampleDXF=()=>exportDXF(EXAMPLE_ROOM);
