import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {OBJETS_GENERIQUES,avecObjetsGeneriques} from '../../lib/catalogue-generique.js';
import {PRODUITS,ligneProduit} from '../../lib/catalogue.js';
import {construireObjetGenerique} from '../../moteur/generiques.js';
import {deplacerVuePhoto,creerNavigationPhoto} from '../../lib/navigation-photo.js';
import {validerVue,dimensionsCapture} from '../../lib/cadrages.js';
import {optionsRendu} from '../../lib/rendu-options.js';
import {programmeComposition,composerProduits,correspondSlot} from '../../lib/programme.js';
import {choisirCandidats} from '../../lib/selection.js';
import {appliquerProposition,preparerAmenagement} from '../../lib/amenagement.js';
import {salonReference,catalogueZones} from '../fixtures/plan-zones.js';

test('44 objets de projet identifiés, sans lien commercial ni photo produit fictive',()=>{
  const commerciaux=JSON.parse(readFileSync(new URL('../../data/catalogue.json',import.meta.url)));
  const c=avecObjetsGeneriques(commerciaux);
  assert.equal(Object.keys(OBJETS_GENERIQUES).length,44);
  assert.equal(Object.keys(PRODUITS).length,Object.keys(commerciaux.produits).length+44);
  for(const [id,p] of Object.entries(OBJETS_GENERIQUES)){
    assert.equal(PRODUITS[id].generique,true);assert.equal(p.prixEstime,true);assert.ok(p.prix>0);
    assert.equal(p.url,null);assert.equal(p.img,null);assert.ok(p.usagesGeneriques.length);
    assert.ok(existsSync(new URL('../../public'+p.vign,import.meta.url)));
    assert.match(ligneProduit(p),/indicative allowance.*not sold by Maison Corleone/);
  }
  for(const [id,p] of Object.entries(commerciaux.produits))assert.deepEqual(c.produits[id],p);
});
test('tous les modèles génériques respectent exactement leurs dimensions et leur origine',()=>{
  for(const p of Object.values(OBJETS_GENERIQUES)){
    const g=construireObjetGenerique(p),b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3());
    assert.ok(g.children.length>0,p.id);
    for(const [i,v] of [s.x,s.z,s.y].entries())assert.ok(Math.abs(v-p.dim[i])<1e-6,p.id+' dimension '+i);
    assert.ok(Math.abs((b.min.x+b.max.x)/2)<1e-6,p.id);
    assert.ok(Math.abs(b.min.y-(p.fam==='miroir'?-p.dim[2]/2:0))<1e-6,p.id);
    g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  }
});
test('les tables et chaises génériques gardent leurs usages et une variété de tailles',()=>{
  const g=OBJETS_GENERIQUES;
  assert.equal(Object.values(g).filter(p=>p.usagesGeneriques.includes('table-basse')).length,6);
  assert.equal(correspondSlot(g['rr-gen-basse-ronde-60'],'chevet','chambre'),false);
  assert.equal(correspondSlot(g['rr-gen-chevet-35'],'table-repas','salon'),false);
  assert.equal(correspondSlot(g['rr-gen-chaise-bois'],'chaise-repas','salon'),true);
  assert.equal(correspondSlot(g['rr-gen-chaise-bureau'],'chaise-repas','salon'),false);
  assert.equal(correspondSlot(g['rr-gen-chaise-bois'],'chaise-repas','terrasse'),false);
});
test('les candidats et l’inventaire complètent les vrais manques de repas et de rangement',()=>{
  const modele={dims:{largeur:6,profondeur:6,hauteur:2.6}},c=choisirCandidats(PRODUITS,{dims:modele.dims,fonction:'salon',budget:6000});
  const p=programmeComposition({modele,fonction:'salon'}),r=composerProduits(p,{meubles:[]},PRODUITS,c,[],{budget:6000});
  assert.equal(r.meubles.filter(m=>m.programme.usage==='chaise-repas').length,4);
  assert.ok(r.meubles.filter(m=>m.programme.usage==='chaise-repas').every(m=>PRODUITS[m.produit].generique));
  assert.ok(c.table.some(p=>p.generique&&p.usagesGeneriques.includes('table-basse')));
  const chambre=programmeComposition({modele,fonction:'chambre'}),r2=composerProduits(chambre,{meubles:[]},PRODUITS,null);
  assert.ok(r2.meubles.some(m=>m.programme.usage==='armoire'&&PRODUITS[m.produit].generique));
});
test('le salon reste complet avec les chaises et tables génériques, sous le budget réel',()=>{
  const produits={...OBJETS_GENERIQUES,canape:catalogueZones.canape};
  assert.ok(produits.canape);
  const modele=salonReference(),r=appliquerProposition({modele,produits,fonction:'salon',prep:preparerAmenagement([],{envies:'Salon avec coin repas',budget:3000}),proposition:{meubles:[]}});
  assert.equal(r.agencement.filter(i=>i.usageProgramme==='chaise-repas').length,4);
  assert.ok(r.agencement.some(i=>i.usageProgramme==='table-basse'));
  assert.equal(r.proposition.planZones.audit.valide,true);
  const total=r.agencement.filter(i=>i.garde!==false).reduce((s,i)=>s+produits[i.sku].prix,0);
  assert.ok(total<=3000);assert.ok(total<=r.proposition.selectionBudget.cout,'les retraits de densité peuvent réduire le coût de la sélection initiale');
});

const modele={dims:{largeur:4,profondeur:4,hauteur:2.6}};
const vue={x:0,y:1.5,z:0,cx:0,cy:1.2,cz:-1,fov:62,aspect:1.72};
test('les flèches déplacent la caméra selon le regard, sans changer hauteur, fov ou cadrage',()=>{
  const v=deplacerVuePhoto(modele,vue,{avant:1},.05);
  assert.ok(v.z<vue.z);assert.equal(v.x,vue.x);assert.equal(v.y,vue.y);assert.equal(v.fov,vue.fov);assert.equal(v.aspect,vue.aspect);
  assert.ok(Math.abs((v.cz-v.z)-(vue.cz-vue.z))<1e-12);
  const droite=deplacerVuePhoto(modele,vue,{droite:1},.05);assert.ok(droite.x>0);assert.equal(droite.z,0);
  const regardEst={...vue,cx:1,cz:0},est=deplacerVuePhoto(modele,regardEst,{avant:1},.05);assert.ok(est.x>0);assert.equal(est.z,0);
  const diagonale=deplacerVuePhoto(modele,vue,{avant:1,droite:1},.05);assert.ok(Math.abs(Math.hypot(diagonale.x,diagonale.z)-Math.abs(v.z))<1e-12);
});
test('la caméra reste dans les murs et ne traverse pas le vide d’une pièce concave',()=>{
  let v={...vue,x:1.85,cx:1.85};
  for(let i=0;i<200;i++)v=deplacerVuePhoto(modele,v,{droite:1},.05);
  assert.ok(v.x<=1.88);assert.equal(v.y,1.5);
  const enL={...modele,contour:[[-2,-2],[2,-2],[2,0],[0,0],[0,2],[-2,2]]};
  let q={...vue,x:-.3,z:1,cx:.7,cz:1};
  for(let i=0;i<200;i++)q=deplacerVuePhoto(enL,q,{avant:1},.05);
  assert.ok(q.x<=-.12);assert.deepEqual(validerVue(enL,q),q);
});
test('le rendu conserve le format exact de la caméra libre, indépendant de la photo déposée',()=>{
  const piece={modele,photos:[{role:'rendu',url:'photo.jpg',largeur:600,hauteur:800}]};
  const deplacee=deplacerVuePhoto(modele,vue,{avant:1,droite:-1},.05);
  const r=optionsRendu(piece,{angle:'libre',vue:deplacee,photoRole:'rendu'});
  assert.deepEqual(r.vue,deplacee);assert.equal(r.vue.aspect,1.72);
  assert.deepEqual(dimensionsCapture(r.vue,640),{largeur:640,hauteur:372});
  for(const aspect of [0,NaN,10,'1.7'])assert.throws(()=>validerVue(modele,{...vue,aspect}));
});
class Surface {
  constructor(){this.l=new Map();}addEventListener(k,f){if(!this.l.has(k))this.l.set(k,new Set());this.l.get(k).add(f);}
  removeEventListener(k,f){this.l.get(k)?.delete(f);}emettre(k,e={}){for(const f of this.l.get(k)||[])f(e);}
}
test('le clavier ignore les saisies et fenêtres inactives, et libère toutes les touches',()=>{
  const clavier=new Surface(),canvas=new Surface();let active=true,n=0;
  const nav=creerNavigationPhoto({clavier,canvas,estActive:()=>active,demander:()=>n++});
  const e=(key,saisie=false)=>({key,target:{closest:()=>saisie?{}:null},preventDefault(){this.empeche=true;}});
  const saisie=e('ArrowUp',true);clavier.emettre('keydown',saisie);assert.equal(nav.commande(),null);assert.equal(saisie.empeche,undefined);
  const entree=e('ArrowUp');clavier.emettre('keydown',entree);assert.equal(entree.empeche,true);assert.deepEqual(nav.commande(),{avant:1,droite:0});assert.equal(n,1);
  clavier.emettre('blur');assert.equal(nav.commande(),null);
  nav.mouvement({droite:1});assert.deepEqual(nav.commande(),{avant:0,droite:1});active=false;assert.equal(nav.commande(),null);active=true;assert.equal(nav.commande(),null);
  clavier.emettre('keydown',e('ArrowRight'));clavier.emettre('keyup',e('ArrowRight'));assert.equal(nav.commande(),null);
  nav.detruire();for(const s of [clavier,canvas])assert.ok([...s.l.values()].every(x=>x.size===0));
  clavier.emettre('keydown',e('ArrowUp'));assert.equal(nav.commande(),null);
});
