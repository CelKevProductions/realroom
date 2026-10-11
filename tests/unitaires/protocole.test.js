import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scenarioReference,catalogueReference} from '../fixtures/bench-chambres.js';
import {optimiserAmenagement,bilanConfort} from '../../lib/confort.js';
import {resoudre,verifier} from '../../lib/agencement.js';
import {appliquerProposition,preparerAmenagement} from '../../lib/amenagement.js';
const local=(it,x,z)=>({x:it.x+Math.cos(it.rot)*x+Math.sin(it.rot)*z,z:it.z-Math.sin(it.rot)*x+Math.cos(it.rot)*z});
test('référence 3,50 × 4 m : cinq meubles, chevets, dos adossés, porte et accès',()=>{
 const {modele,items}=scenarioReference();
 const complet=optimiserAmenagement(modele,items,catalogueReference,{envies:'Scandinave chaleureux'});
 const r=optimiserAmenagement(modele,resoudre(modele,complet.items,catalogueReference).items,catalogueReference,{envies:'Scandinave chaleureux',variantes:3});
 assert.deepEqual(r.items.filter(i=>i.garde!==false).map(i=>i.id).sort(),items.map(i=>i.id).sort());
 assert.deepEqual(verifier(modele,r.items,catalogueReference),[]);assert.equal(r.confort.score.contraintes,0);
 assert.equal(r.confort.ouvertures,true);assert.equal(r.confort.acces,true);assert.equal(r.confort.circulation,true);
 const bed=r.items.find(x=>x.id==='lit'),back=local(bed,0,-1);
 assert.ok(Math.min(1.75-Math.abs(back.x),2-Math.abs(back.z))<=.04);
 for(const [id,cote]of [['cg',-1],['cd',1]]){
  const n=r.items.find(x=>x.id===id),target=local(bed,cote*(.8+.225+.06),-1+.2+.05);
  assert.ok(Math.hypot(target.x-n.x,target.z-n.z)<.025,id);assert.equal(n.rot,bed.rot);
 }
 const armoire=r.items.find(x=>x.id==='armoire'),dos=local(armoire,0,-.3);
 assert.ok(Math.min(1.75-Math.abs(dos.x),2-Math.abs(dos.z))<=.04);
 assert.ok(!r.confort.alertes.some(a=>a.ids.includes('lit')||a.ids.includes('armoire')));
 const avant=bilanConfort(modele,items,catalogueReference);assert.ok(r.confort.score.total>avant.score.total);
});
test('la vraie proposition cherche une place pour l’ensemble avant d’écarter des achats',()=>{
 const {modele}=scenarioReference(),prep=preparerAmenagement([],{envies:'Scandinave chaleureux',budget:3000});
 const r=appliquerProposition({modele,prep,produits:catalogueReference,proposition:{meubles:[
  {produit:'lit'},{produit:'chevet'},{produit:'chevet'},{produit:'armoire'},{produit:'commode'}]}});
 assert.equal(r.agencement.filter(i=>i.garde!==false).length,5);
 assert.equal(r.agencement.filter(i=>i.sku==='chevet').length,2);
 assert.deepEqual(verifier(modele,r.agencement,catalogueReference),[]);
});
