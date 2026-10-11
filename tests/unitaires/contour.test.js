import {test} from 'node:test';
import assert from 'node:assert/strict';
import {depuisScan,normaliserScan} from '../../lib/scan.js';
import {contientPoint,contientBoite,segmentsDe,aireSignee} from '../../lib/contour.js';
import {corrigerPiece} from '../../lib/geometrie.js';
import {resoudre,boite,verifier,zonesPortes} from '../../lib/agencement.js';
import {versClaude} from '../../lib/piece.js';
import {bilanConfort} from '../../lib/confort.js';
import {scanAndroid,scanApple,matrice} from '../fixtures/scans.js';
const scanL=()=>({...scanAndroid(),floorCorners:[[0,0,0],[5,.02,0],[5,-.01,2],[2,.03,2],[2,0,5],[0,0,5]]});
test('un scan en L conserve son aire, ses six murs et le renfoncement',()=>{
 const m=depuisScan(scanL()).modele;
 assert.equal(m.contour.length,6);assert.equal(Math.abs(aireSignee(m.contour)),16);
 const brief=versClaude(m,[],{});assert.equal(brief.surface_sol_m2,16);assert.equal(Object.keys(brief.ouvertures).length,6);assert.equal(brief.contour.length,6);
 assert.equal(segmentsDe(m).length,6);assert.equal(contientPoint(m,1,1),false);assert.equal(contientPoint(m,-1,-1),true);
 assert.equal(contientBoite(m,{x0:-1,x1:1,z0:-1,z1:1}),false);
 const correction=corrigerPiece(m,[],{contour:m.contour.map((p,i)=>i===3?[p[0]-.1,p[1]]:p)});
 assert.equal(correction.modele.contour[3][0],m.contour[3][0]-.1);
});
test('les pièces obliques, triangles et pointages légèrement imparfaits passent',()=>{
 const a=scanAndroid();a.floorCorners[2][0]-=.18;a.floorCorners[2][1]+=.1;
 assert.equal(depuisScan(a).modele.contour.length,4);
 assert.equal(depuisScan({...a,floorCorners:[[0,0,0],[4,0,0],[1,0,3]]}).modele.contour.length,3);
});
test('les contours croisés, redondants ou trop petits restent refusés',()=>{
 for(const ps of [[[0,0,0],[4,0,4],[0,0,4],[4,0,0]],[[0,0,0],[4,0,0],[4,0,4],[0,0,0]],[[0,0,0],[4,0,0],[2,0,.1]]]) assert.throws(()=>depuisScan({...scanAndroid(),floorCorners:ps}));
});
test('le solveur et le score interdisent un meuble dans le vide du L',()=>{
 const m=depuisScan(scanL()).modele,p={fam:'meuble',nom:'Rangement',dim:[.6,.4,.7]},it={id:'test',p,x:1,z:1,rot:0};
 assert.ok(verifier(m,[it],{}).some(a=>a.type==='limites'));
 assert.ok(bilanConfort(m,[it],{}).alertes?.some(a=>a.type==='limites') || JSON.stringify(bilanConfort(m,[it],{})).includes('limites'));
 const r=resoudre(m,[it],{});assert.equal(r.items.length,1);assert.ok(contientBoite(m,boite(r.items[0],p.dim)));
 m.murs.pan_5.ouvertures=[{type:'porte',position:0,largeur:.8}];const z=zonesPortes(m)[0];assert.ok(z.x1>z.x0&&z.z1>z.z0);
});
test('les murs RoomPlan en L reconstituent le contour fermé sans rectangle fictif',()=>{
 const ps=[[0,0],[5,0],[5,2],[2,2],[2,5],[0,5]];
 const s={...scanApple(),openings:[],objects:[],walls:ps.map((a,i)=>{const b=ps[(i+1)%ps.length],rot=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);return {size:[Math.hypot(b[0]-a[0],b[1]-a[1]),2.6,0],transform:matrice((a[0]+b[0])/2,1.3,(a[1]+b[1])/2,rot),confidence:'high'};})};
 const m=depuisScan(s).modele;assert.equal(m.contour.length,6);assert.equal(Math.abs(aireSignee(m.contour)),16);
});
test('Apple CapturedRoom JSON est adapté sans conserver ses données privées ou son maillage',()=>{
 const s=scanApple(),convert=x=>({dimensions:x.size,transform:x.transform,category:{[x.category]:{}},confidence:{high:{}}});
 const raw={walls:s.walls.map(convert),doors:s.openings.filter(x=>x.category==='door').map(convert),windows:s.openings.filter(x=>x.category==='window').map(convert),objects:s.objects.map(convert),coreModel:'private',images:['private']};
 const normal=normaliserScan(raw);assert.equal(normal.coreModel,undefined);assert.equal(normal.images,undefined);assert.deepEqual(depuisScan(raw),depuisScan(s));
 assert.throws(()=>normaliserScan({walls:[{dimensions:'ambiguous',transform:[]}]}));
});
