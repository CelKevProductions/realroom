import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PROPS, RECETTES_STAGING, propDe } from '../../lib/staging-catalogue.js';
import { composerStaging, posesStaging, evaluerStaging } from '../../lib/staging.js';
import { construireProp } from '../../moteur/staging.js';
import { PRODUITS } from '../../lib/catalogue.js';
import { choisirCandidats } from '../../lib/selection.js';
import { preparerAmenagement, appliquerProposition } from '../../lib/amenagement.js';
import { programmeComposition } from '../../lib/programme.js';
import { verifierHauteurs } from '../../lib/hauteurs.js';
import { demandeDemoIA, validerDemoIA } from '../../lib/demo-ia.js';
import { sejour89 } from '../fixtures/staging.js';
import { rectangle } from '../fixtures/bench-chambres.js';
import { normaliserDimensionsCatalogue } from '../../lib/catalogue-dimensions.js';

function amenager(modele,choix={},proposition={meubles:[]}) {
  const prep=preparerAmenagement([],choix);return appliquerProposition({modele,prep,produits:PRODUITS,fonction:'salon',proposition,
    candidats:choisirCandidats(PRODUITS,{modele,fonction:'salon',...prep})});
}

test('bibliothèque non vendue : dimensions 3D exactes, descriptions et recettes 7 × 12',()=>{
  assert.equal(Object.keys(RECETTES_STAGING).length,7);
  for(const styles of Object.values(RECETTES_STAGING))assert.equal(Object.keys(styles).length,12);
  for(const id of Object.keys(PROPS)) {
    const p=propDe(id);assert.equal(p.vendu,false);assert.ok(p.description);assert.equal(p.prix,undefined);assert.equal(p.sku,undefined);
    const box=new THREE.Box3().setFromObject(construireProp(p)),s=box.getSize(new THREE.Vector3());
    for(const [mesure,cible]of [[s.x,p.dim[0]],[s.z,p.dim[1]],[s.y,p.dim[2]]])assert.ok(Math.abs(mesure-cible)<1e-6,id);
  }
});

test('tapis : largeur/épaisseur/longueur devient largeur/profondeur/hauteur sans mesure inventée',()=>{
  const brut={produits:{a:{fam:'tapis',dim:[1.5,.05,1.9]},b:{fam:'table',dim:[1.5,.05,1.9]},c:{fam:'tapis',dim:[2,3,.02]}}},copie=structuredClone(brut);
  const n=normaliserDimensionsCatalogue(brut);assert.deepEqual(n.produits.a.dim,[1.5,1.9,.05]);assert.deepEqual(n.produits.a.dimSource,[1.5,.05,1.9]);
  assert.deepEqual(n.produits.b.dim,brut.produits.b.dim);assert.deepEqual(n.produits.c.dim,brut.produits.c.dim);assert.deepEqual(brut,copie);
});

test('89 m² : cinq activités, TV, chaque zone éclairée et habitée, angles et murs sans ouverture',()=>{
  const modele=sejour89(),copie=structuredClone(modele),r=amenager(modele,{envies:'Salon chaleureux'}),p=r.proposition;
  assert.deepEqual(modele,copie);assert.equal(p.densite.echelle.surface,89);assert.equal(p.densite.zonesVie,5);
  for(const id of ['salon','repas','cuisine','bar','travail']) {
    assert.ok(p.planZones.zones.some(z=>z.id===id),id);
    assert.ok(p.staging.diagnostic.regles.some(q=>q.id==='zone-habitee'&&q.ids.includes(id)),id);
    const lumiere=r.agencement.some(it=>it.zoneId===id&&/lumiere|lampe|suspension/.test(it.usageProgramme||''))
      ||p.staging.items.some(it=>it.zoneId===id&&['suspension-decor','lampadaire-decor'].includes(it.prop));assert.ok(lumiere,id);
  }
  assert.ok(r.agencement.some(it=>it.usageProgramme==='television')||p.staging.items.some(it=>it.prop==='television'));
  assert.ok(p.staging.items.some(it=>it.kind==='wall_item'));
  assert.equal(p.planZones.audit.valide,true);assert.equal(p.planZones.audit.circulation.largeur,1.1);
  assert.deepEqual(p.staging.diagnostic.audit,[]);assert.ok(!p.staging.diagnostic.regles.some(q=>['angle-nu','surface-surcharge','focal-masque','plante-sombre'].includes(q.id)));
  assert.ok(p.staging.diagnostic.surfaces.every(q=>q.nombre<=4));assert.deepEqual(p.programme.manquants.filter(s=>s.obligatoire),[]);
});

test('la lampe de table ne fait plus supprimer la télévision sur le même meuble',()=>{
  const m=rectangle(6,5);const lampe=Object.values(PRODUITS).find(p=>p.generique&&p.fam==='lampe');
  const r=amenager(m,{espaces:[],envies:'Télévision sur meuble'}, {meubles:[{produit:lampe.id,zone:'salon'}]});
  assert.ok(r.agencement.some(it=>it.usageProgramme==='television'));
  assert.deepEqual(verifierHauteurs(m,r.agencement,PRODUITS),[]);
});

test('staging à composition égale : aucune mutation du mobilier, des prix ou du plafond',()=>{
  const modele=rectangle(6,5),r=amenager(modele,{espaces:['repas'],envies:'Salon chaleureux',budget:7000,staging:false}),copie=structuredClone(r);
  const staging=composerStaging({modele,items:r.agencement,catalogue:PRODUITS,programme:{...r.proposition.programme,staging:true},plan:structuredClone(r.proposition.planZones),envies:'Salon chaleureux'});
  assert.ok(staging.items.length>0);assert.deepEqual(r,copie);
  assert.ok(staging.items.every(it=>it.origine==='mise-en-scene'&&!it.sku&&it.vendu===false&&!it.p.prix));
  const cout=xs=>xs.filter(it=>it.origine==='catalogue').reduce((s,it)=>s+(PRODUITS[it.sku]?.prix||0),0);
  assert.equal(cout([...r.agencement,...staging.items]),cout(r.agencement));
});

test('les accessoires suivent la rotation et disparaissent avec l’hôte retiré',()=>{
  const h={id:'h',p:{fam:'table',dim:[1,.6,.75]},x:1,z:2,rot:0};
  const stage={items:[{id:'a',prop:'vase',p:propDe('vase'),kind:'surface_item',attach_to:{type:'furniture',id:'h'},local:[.2,.75,.1]}]};
  const q=posesStaging([{...h,x:3,z:4,rot:Math.PI/2}],stage)[0];
  assert.equal(q.x,3.1);assert.equal(q.z,3.8);assert.equal(q.baseY,.75);
  assert.deepEqual(posesStaging([{...h,garde:false}],stage),[]);assert.deepEqual(posesStaging([],stage),[]);
});

test('un écran de secours non vendu sur support existe même sans TV au catalogue',()=>{
  const modele=rectangle(6,5),h={id:'bas',p:{fam:'meuble',dim:[1.4,.4,.55]},zoneId:'salon',usageProgramme:'meuble-tv',x:0,z:1,rot:Math.PI};
  const programme=programmeComposition({modele,fonction:'salon',espaces:[]});
  const s=composerStaging({modele,items:[h],catalogue:{},programme,plan:null});
  const tv=posesStaging([h],s).find(it=>it.usageProgramme==='television');
  assert.ok(tv);assert.equal(tv.baseY,.55);assert.equal(tv.attach_to.id,'bas');assert.equal(tv.sku,undefined);assert.equal(tv.p.prix,undefined);
  const sans=composerStaging({modele,items:[h],catalogue:{},programme:programmeComposition({modele,fonction:'salon',espaces:[],envies:'Sans TV'}),plan:null});
  assert.ok(!sans.items.some(it=>it.prop==='television'));
});

test('les refus, cases décochées et flag staging traversent le contrat démo',()=>{
  const piece={fonction:'salon',modele:sejour89(),agencement:[],notes:''};
  const c=validerDemoIA(demandeDemoIA(piece,{espaces:['repas','cuisine','bar'],staging:false},'fr'),PRODUITS).choix;
  assert.equal(c.staging,false);assert.deepEqual(c.espaces,['repas','cuisine','bar']);
  for(const choix of [{espaces:[]},{envies:'Sans cuisine ni bar'},{staging:false}]) {
    const p=programmeComposition({modele:piece.modele,fonction:'salon',...choix});assert.ok(!p.zones.some(z=>z.stagingArchitecture));
  }
});

test('10 m² épuré : deux accessoires au plus par surface, aucune architecture ajoutée',()=>{
  const r=amenager(rectangle(3.2,3.125),{envies:'Salon minimaliste',espaces:[]});
  assert.ok(r.agencement.length<=7);assert.ok(r.proposition.staging.items.length<=5);
  assert.ok(r.proposition.staging.diagnostic.surfaces.every(s=>s.nombre<=2));
  assert.ok(!r.proposition.staging.items.some(it=>['ilot','comptoir','plante-haute'].includes(it.prop)));
  assert.deepEqual(r.proposition.staging.diagnostic.audit,[]);
});

test('le score sanctionne ouverture, végétal derrière TV, surcharge et focal masqué',()=>{
  const modele=rectangle(6,5),h={id:'bas',p:{fam:'meuble',dim:[1.5,.5,.55]},x:0,z:0,rot:0,zoneId:'salon'},tv={id:'tv',p:{fam:'tv',dim:[1,.2,.6]},kind:'surface_item',attach_to:{type:'furniture',id:'bas'},x:0,z:0,rot:0,zoneId:'salon'};
  const accessoires=Array.from({length:5},(_,i)=>({id:'v'+i,prop:'vase',p:propDe('vase'),kind:'surface_item',zoneId:'salon',surface:'plateau',attach_to:{type:'furniture',id:'bas'},local:[0,.55,0]}));
  const wall={id:'mur',prop:'mur-vegetal',p:propDe('mur-vegetal'),kind:'wall_item',mur:'entree',x:modele.murs.entree.ouvertures[0].position,z:2.5,rot:Math.PI,y:1.1,baseY:.1,zoneId:'salon'};
  const diagnostic=evaluerStaging(modele,[h,tv],{}, {items:[...accessoires,wall,{...wall,id:'mur2'}]}, {zones:[{id:'salon',type:'salon',x0:-2,x1:2,z0:-2,z1:1.8}],largeurCirculation:1.1});
  for(const [id,points]of [['surface-surcharge',-6],['hauteurs-monotones',-2],['focal-masque',-15],['mur-ouverture',-100],['vegetal-tv',-10],['murs-multiples',-10]])assert.ok(diagnostic.regles.some(q=>q.id===id&&q.points===points),id);
});
