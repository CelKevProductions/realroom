import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lireDXF,exporterDXF,APP_LAGARSOFT,creerLecteurDXF,messageErreurDXF} from '../../lib/plans.js';
import {depuisScan,VERSION_SCAN} from '../../lib/scan.js';
import {aireSignee,contientPoint,segmentsDe} from '../../lib/contour.js';
import {vuePourAngle,ANGLES_RENDU} from '../../lib/cadrages.js';
import {preparerAmenagement} from '../../lib/amenagement.js';
import {usageDe} from '../../lib/usages.js';
import {optimiserAmenagement} from '../../lib/confort.js';
const contour=[[0,0],[4,0],[4,2],[3,2],[3,3],[2,3],[2,4],[0,4]];
const scan=()=>({version:VERSION_SCAN,source:'plan-dxf',unit:'m',floorCorners:contour.map(([x,z])=>[x,0,z]),ceilingHeight:null,openings:[{type:'porte',a:[.5,0],b:[1.4,0]},{type:'fenetre',a:[0,1],b:[0,2.2]}]});
const poly=(ps,layer='FLOOR')=>[0,'LWPOLYLINE',8,layer,90,ps.length,70,1,...ps.flatMap(([x,z])=>[10,x,20,z])];
const dxf=(entities,unite=6)=>[0,'SECTION',2,'HEADER',9,'$INSUNITS',70,unite,0,'ENDSEC',0,'SECTION',2,'ENTITIES',...entities,0,'ENDSEC',0,'EOF'].join('\n')+'\n';
test('DXF R12 : huit coins, ouvertures et mètres restent dans le contrat partagé',()=>{
 const brut=scan(),r=lireDXF(exporterDXF(brut));assert.equal(r.unites,'m');assert.equal(r.pieces.length,1);
 const m=r.pieces[0].modele;assert.equal(m.contour.length,8);assert.equal(Math.abs(aireSignee(m.contour)),13);assert.equal(m.capture.nbOuvertures,2);
 const os=Object.values(m.murs).flatMap(m=>m.ouvertures);assert.deepEqual(os.map(o=>o.type).sort(),['fenetre','porte']);assert.ok(Math.abs(os.find(o=>o.type==='porte').largeur-.9)<.01);
 assert.equal(m.capture.mobilierDetecte,false);assert.equal(m.dims.sources.hauteur,'estimation');
});
test('DXF moderne en mm et maison multi-pièces : aucune boîte englobante fictive',()=>{
 const r=lireDXF(dxf([...poly([[0,0],[4000,0],[4000,3000],[0,3000]]),...poly([[5000,0],[8000,0],[8000,3000],[5000,3000]])],4));
 assert.equal(r.unites,'mm');assert.equal(r.pieces.length,2);assert.deepEqual(r.pieces.map(p=>p.surface),[12,9]);assert.equal(r.pieces[0].modele.dims.largeur,4);assert.equal(r.pieces[1].modele.dims.largeur,3);
});
test('sans unité, aucune estimation de cote ; unité manuelle puis validation explicite',()=>{
 const s=dxf(poly([[0,0],[400,0],[400,300],[0,300]]),0);
 assert.deepEqual(lireDXF(s),{unites:null,pieces:[]});assert.equal(lireDXF(s,'cm').pieces[0].surface,12);
 assert.throws(()=>lireDXF(s,'pixels'));
});
test('DXF invalide, courbe, croisé ou binaire est refusé sans correction inventée',()=>{
 for(const s of ['AutoCAD Binary DXF\r\n',dxf([...poly([[0,0],[4,0],[4,3],[0,3]]),42,.3]),dxf(poly([[0,0],[4,3],[4,0],[0,3]])),'0\nEOF\n25'])assert.throws(()=>lireDXF(s));
 assert.throws(()=>lireDXF(dxf(poly([[0,0],[4,0],[4,3],[0,3]])).replace('10\n0\n20\n0\n','10\n0\n')),'une coordonnée manquante ne devient pas un triangle inventé');
});
test('un meuble ou une annotation courbe ne fait pas refuser un sol valide',()=>{
 const sol=poly([[0,0],[4,0],[4,3],[0,3]]);
 const meuble=[...poly([[1,1],[2,1],[2,2],[1,2]],'FURNITURE'),42,.5];
 const annotation=[0,'POLYLINE',8,'ANNOTATIONS',70,1,0,'VERTEX',10,0,20,0,42,.5,0,'SEQEND'];
 const autreCalque=[...poly([[0,0],[4,0],[4,3],[0,3]],'DECORATION'),42,.5];
 for(const decor of [meuble,annotation,autreCalque]){
  const r=lireDXF(dxf([...sol,...decor]));assert.equal(r.pieces.length,1);assert.equal(r.pieces[0].surface,12);
 }
 assert.throws(()=>lireDXF(dxf([...sol,42,.5,...meuble])),e=>e.code==='plan-courbe','un sol courbe reste refusé');
 const sansCalqueSol=poly([[0,0],[4,0],[4,3],[0,3]],'0');
 assert.equal(lireDXF(dxf([...sansCalqueSol,...meuble])).pieces[0].surface,12);
});
test('une abscisse DXF dupliquée ou sans ordonnée n’est jamais ignorée',()=>{
 const fichier=dxf(poly([[0,0],[4,0],[4,3],[0,3]]));
 for(const coord of ['10\n99\n10\n0\n20\n0\n','20\n0\n','10\n0\n']){
  assert.throws(()=>lireDXF(fichier.replace('10\n0\n20\n0\n',coord)),e=>e.code==='plan-format');
 }
});
test('deux lectures de DXF : seul le dernier fichier choisi peut être affiché',async()=>{
 const lecteur=creerLecteurDXF(),resultats=[],erreurs=[];
 const fichier=surface=>dxf(poly([[0,0],[surface,0],[surface,3],[0,3]]));
 let terminer;
 const lent=lecteur.lire({size:100,text:()=>new Promise(r=>{terminer=r;})},r=>resultats.push(r.resultat.pieces[0].surface),e=>erreurs.push(e.code));
 await lecteur.lire({size:100,text:async()=>fichier(5)},r=>resultats.push(r.resultat.pieces[0].surface),e=>erreurs.push(e.code));
 terminer(fichier(4));await lent;
 assert.deepEqual(resultats,[15]);assert.deepEqual(erreurs,[]);
});
test('lecture périmée, annulation et taille : aucun résultat ou échec tardif ne remplace le plan',async()=>{
 const lecteur=creerLecteurDXF(),resultats=[],erreurs=[],fichier=dxf(poly([[0,0],[4,0],[4,3],[0,3]]));
 let echouer;
 const lent=lecteur.lire({size:100,text:()=>new Promise((_,r)=>{echouer=r;})},r=>resultats.push(r),e=>erreurs.push(e.code));
 await lecteur.lire({size:100,text:async()=>fichier},r=>resultats.push(r.resultat.pieces[0].surface),e=>erreurs.push(e.code));
 echouer(new Error('ancienne lecture'));await lent;
 let terminer;
 const annule=lecteur.lire({size:100,text:()=>new Promise(r=>{terminer=r;})},r=>resultats.push(r),e=>erreurs.push(e.code));
 lecteur.annuler();terminer(fichier);await annule;
 assert.deepEqual(resultats,[12]);assert.deepEqual(erreurs,[]);
 let lu=false;
 await lecteur.lire({size:5e6+1,text:async()=>{lu=true;return fichier;}},r=>resultats.push(r),e=>erreurs.push(e.code));
 assert.equal(lu,false);assert.deepEqual(erreurs,['plan-taille']);
 await lecteur.lire({size:100,text:async()=>'fichier incomplet'},r=>resultats.push(r),e=>erreurs.push(e.code));
 assert.deepEqual(erreurs,['plan-taille','plan-format']);
});
test('les messages DXF proposent une action en français et anglais sans contenu privé',()=>{
 assert.match(messageErreurDXF('plan-taille'),/5 Mo.*PDF\/image/);
 assert.match(messageErreurDXF('plan-format','en'),/DXF.*PDF\/image/);
 assert.match(messageErreurDXF('plan-courbe'),/contour.*courbes.*segments/);
 assert.match(messageErreurDXF('plan-unites','en'),/actual units/);
 assert.match(messageErreurDXF('scan-dimensions'),/unités.*3 à 32/);
});
test('un contour oblique et ses portes survivent à l’export métrique',()=>{
 const ps=[[0,0],[4,.5],[3.7,3.5],[0,3]],o={type:'porte',a:[.8,.1],b:[1.6,.2]},s={...scan(),floorCorners:ps.map(([x,z])=>[x,0,z]),openings:[o]};
 const m=depuisScan(s).modele,r=lireDXF(exporterDXF(s)).pieces[0].modele;
 assert.equal(r.capture.nbOuvertures,1);assert.ok(Math.abs(Math.abs(aireSignee(m.contour))-Math.abs(aireSignee(r.contour)))<.05);
 assert.equal(segmentsDe(r).length,4);
});
test('les cadrages complémentaires restent à l’intérieur d’une pièce en L',()=>{
 const m=depuisScan({...scan(),floorCorners:[[0,0,0],[5,0,0],[5,0,2],[2,0,2],[2,0,5],[0,0,5]],openings:[]}).modele;
 for(const a of ANGLES_RENDU){const v=vuePourAngle(m,a);assert.ok(contientPoint(m,v.x,v.z),a);assert.ok(contientPoint(m,v.cx,v.cz),a);}
 assert.throws(()=>vuePourAngle(m,'plafond'));assert.match(APP_LAGARSOFT,/6779339424$/);
});
test('budget libre en centimes, mobilier commercial et repli sans mutation',()=>{
 assert.equal(preparerAmenagement([],{budget:2123.45}).budget,2123.45);
 assert.equal(usageDe({fam:'fauteuil',texte:'Près de votre table d’appoint'}),null);
 assert.equal(usageDe({fam:'applique',texte:'Un éclairage au-dessus du chevet'}),null);
 assert.equal(usageDe({fam:'table',nom:'Table de chevet'}),'chevet');
 const m=depuisScan(scan()).modele,items=[{id:'lit',p:{fam:'lit',dim:[1.6,2,1]},x:0,z:0,rot:0}],copie=structuredClone(items);
 const r=optimiserAmenagement(m,items,{}, {moteurGuide:false,variantes:3});assert.deepEqual(r.items,copie);assert.deepEqual(items,copie);assert.equal(r.recherche.iterations,0);assert.equal(r.variantes.length,1);
});
