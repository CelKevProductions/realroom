// Géométries synthétiques, mobilier réel du catalogue. Aucun plan/photo client versionné.
import { depuisScan, VERSION_SCAN } from '../../lib/scan.js';
export const rectangle = (L,P,portes=1) => ({ dims:{largeur:L,profondeur:P,hauteur:2.6,estimees:false},murs:{
  entree:{ouvertures:[{type:'porte',position:Math.min(.2,L/2-.7),largeur:.9,hauteur:2.05,allege:0}]},
  fond:{ouvertures:[{type:'fenetre',position:0,largeur:1.1,hauteur:1.2,allege:.95}]},
  gauche:{ouvertures:[]},droite:{ouvertures:portes===2?[{type:'porte',position:0,largeur:.85,hauteur:2.05,allege:0}]:[]}
} });
function polygonal(ps,portes=1){
 const a=ps[0],b=ps[1],c=ps.at(-1),d=ps.at(-2),inter=(p,q,t)=>p.map((v,i)=>v+(q[i]-v)*t);
 const openings=[{type:'porte',a:inter(a,b,.2),b:inter(a,b,.425)}];
 if(portes===2)openings.push({type:'porte',a:inter(c,d,.2),b:inter(c,d,.425)});
 const m=depuisScan({version:VERSION_SCAN,source:'plan-dxf',unit:'m',floorCorners:ps.map(([x,z])=>[x,0,z]),ceilingHeight:2.6,openings}).modele;
 const pan=Object.keys(m.murs)[2];m.murs[pan].ouvertures.push({type:'fenetre',position:0,largeur:.7,hauteur:1.2,allege:.95});return m;
}
export const chambres = () => [
 ['9 m²',rectangle(3,3)],['10,5 m²',rectangle(3,3.5)],['12,25 m² · deux portes',rectangle(3.5,3.5,2)],
 ['14 m²',rectangle(3.5,4)],['16 m² · deux portes',rectangle(4,4,2)],['20 m²',rectangle(4,5)],
 ['L · 12 m²',polygonal([[0,0],[4,0],[4,2],[2,2],[2,4],[0,4]])],
 ['L · 16 m² · deux portes',polygonal([[0,0],[5,0],[5,2],[3,2],[3,4],[0,4]],2)],
 ['Oblique · 15 m²',polygonal([[0,0],[4,0],[4,3.5],[0,4]])],
 ['Décroché · 15 m²',polygonal([[0,0],[4,0],[4,4],[3,4],[3,3],[2,3],[2,4],[0,4]])]
].map(([nom,modele])=>({nom,modele}));
export const mobilierCatalogue = () => [
 {id:'lit',sku:'nd-01',x:0,z:0,rot:0,origine:'catalogue'},
 {id:'chevet-g',sku:'nordic-table-basse',x:-1.15,z:-.8,rot:0,origine:'catalogue'},
 {id:'chevet-d',sku:'nordic-table-basse',x:1.15,z:-.8,rot:0,origine:'catalogue'},
 {id:'rangement',sku:'et-650',x:0,z:1.6,rot:Math.PI,origine:'catalogue'}
];
// Dimensions exactes imposées par le protocole ; ce jeu n'est pas vendu dans la boutique.
export const catalogueReference={
 lit:{fam:'lit',nom:'Lit de test',dim:[1.6,2,1],prix:1000},
 chevet:{fam:'table',nom:'Table de chevet de test',dim:[.45,.4,.5],prix:100},
 armoire:{fam:'armoire',nom:'Armoire de test',dim:[2,.6,2.1],prix:800},
 commode:{fam:'commode',nom:'Commode de test',dim:[1.2,.5,.8],prix:300}
};
export const scenarioReference=()=>({modele:{...rectangle(3.5,4),murs:{...rectangle(3.5,4).murs,
 entree:{ouvertures:[{type:'porte',position:.2,largeur:.9,hauteur:2.05,allege:0}]},fond:{ouvertures:[]}}},items:[
 {id:'lit',sku:'lit',x:0,z:0,rot:0},{id:'cg',sku:'chevet',x:-1.1,z:-.7,rot:0},
 {id:'cd',sku:'chevet',x:1.1,z:-.7,rot:0},{id:'armoire',sku:'armoire',x:0,z:1.6,rot:Math.PI},
 {id:'commode',sku:'commode',x:1.45,z:0,rot:-Math.PI/2}
]});
