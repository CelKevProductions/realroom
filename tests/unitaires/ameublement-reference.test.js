import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluerReferences, scoreProduitReference, ajusterGroupeReference, referencesSpatialesActives } from '../../lib/ameublement-reference.js';
import { bilanConfort } from '../../lib/confort.js';
import { preparerAmenagement, appliquerProposition } from '../../lib/amenagement.js';
import { catalogueZones, salonReference } from '../fixtures/plan-zones.js';
import { rectangle } from '../fixtures/bench-chambres.js';
import PROFILS from '../../data/ameublement/profils.json' with {type:'json'};

const catalogue={sofa:{fam:'canape',dim:[2.4,.9,.8]},table:{fam:'table',nom:'Table basse',dim:[1.3,.6,.4]},lit:{fam:'lit',dim:[1.6,2,1]},chevet:{fam:'table',nom:'Chevet',dim:[.45,.4,.5]},lampe:{fam:'lampe',dim:[.15,.15,.3]}};
const salon=[{id:'sofa',sku:'sofa',x:0,z:0,rot:0,zoneId:'salon'},{id:'table',sku:'table',x:0,z:1.15,rot:0,zoneId:'salon',usageProgramme:'table-basse'}];
test('profil compact : train physique filtré, données agrégées sans scènes ni assets',()=>{
 assert.ok(PROFILS.calibration.scenesRetenues>5000);assert.equal(PROFILS.calibration.scenesFichier,12055);assert.equal(PROFILS.source.meshesImportes,false);assert.equal(PROFILS.source.scenesDistribuees,false);
 assert.ok(PROFILS.relations['chevet-recul'].n>1000);assert.ok(!JSON.stringify(PROFILS).includes('bounds_bottom'));assert.ok(!JSON.stringify(PROFILS).includes('jid'));
});
test('proportions : un canapé de taille courante passe avant un modèle disproportionné',()=>{
 const contexte={modele:rectangle(6,5),fonction:'salon'};
 const normal={fam:'canape',dim:[2.4,.9,.8]},petit={fam:'canape',dim:[.9,.5,.8]},grand={fam:'canape',dim:[5,1.7,.8]};
 assert.ok(scoreProduitReference(normal,contexte)>scoreProduitReference(petit,contexte));assert.ok(scoreProduitReference(normal,contexte)>scoreProduitReference(grand,contexte));
});
test('convives, sièges et support TV gardent leurs critères fonctionnels',()=>{
 for(const [fam,usage,dim] of [['table','table-repas',[2.5,1,.75]],['chaise','chaise-repas',[.65,.6,.9]],['meuble','meuble-tv',[1.8,.4,.5]]])assert.equal(scoreProduitReference({fam,dim},{modele:rectangle(6,5),fonction:'salon',usage}),0);
 assert.equal(scoreProduitReference({fam:'canape',dim:[2.4,.9,.8]},{modele:rectangle(2.5,4),fonction:'salon'}),0);
});
test('table basse : regroupée et centrée elle reçoit une meilleure évaluation',()=>{
 const modele=rectangle(6,6),a=evaluerReferences(modele,salon,catalogue),b=evaluerReferences(modele,[salon[0],{...salon[1],x:1.4,z:2.4}],catalogue);
 assert.ok(a.cout<b.cout);assert.ok(a.note>b.note);
});
test('les relations sont invariantes sous une rotation de l’ensemble',()=>{
 const tourne=salon.map(it=>({...it,x:it.z,z:-it.x,rot:Math.PI/2}));
 assert.deepEqual(evaluerReferences(rectangle(6,6),salon,catalogue).mesures,evaluerReferences(rectangle(6,6),tourne,catalogue).mesures);
});
test('deux coins salon : une table ne s’accroche pas à un canapé d’une autre zone',()=>{
 const items=[{...salon[0],zoneId:'a'}, {...salon[1],zoneId:'b'}];assert.equal(evaluerReferences(rectangle(6,6),items,catalogue).mesures.length,0);
});
test('calibration des chevets : objets fixés intacts et lampe solidaire de son support',()=>{
 const items=[{id:'lit',sku:'lit',x:0,z:1,rot:0,zoneId:'chambre',fixe:true},{id:'chevet',sku:'chevet',x:1.1,z:.7,rot:0,zoneId:'chambre',usageProgramme:'chevet'},{id:'lampe',sku:'lampe',x:1.1,z:.7,rot:0,zoneId:'chambre',attach_to:{type:'furniture',id:'chevet'}}];
 const avant=structuredClone(items),apres=ajusterGroupeReference(items,catalogue);
 assert.deepEqual(items,avant);assert.deepEqual(apres[0],items[0]);assert.equal(apres[1].x,apres[2].x);assert.equal(apres[1].z,apres[2].z);assert.ok(apres[1].z<items[1].z);
});
test('arrêt explicite et environnement : aucune pénalité statistique',()=>{
 assert.equal(referencesSpatialesActives(false),false);assert.equal(evaluerReferences(rectangle(6,6),salon,catalogue,{actif:false}).cout,0);
 const avant=process.env.REALROOM_REFERENCES_SPATIALES;
 try{process.env.REALROOM_REFERENCES_SPATIALES='0';assert.equal(referencesSpatialesActives(true),false);}finally{if(avant===undefined)delete process.env.REALROOM_REFERENCES_SPATIALES;else process.env.REALROOM_REFERENCES_SPATIALES=avant;}
});
test('les observations statistiques ne changent pas les contraintes bloquantes',()=>{
 const m=rectangle(4,4),items=[{id:'lit',sku:'lit',x:1.5,z:1.4,rot:0,fixe:true}];
 const a=bilanConfort(m,items,catalogue,'fr',{referencesSpatiales:false}),b=bilanConfort(m,items,catalogue,'fr',{referencesSpatiales:true});
 assert.ok(a.score.contraintes>0);assert.equal(a.score.contraintes,b.score.contraintes);assert.equal(a.acces,b.acces);
});
test('pipeline : les repères préservent le repas à quatre places et les deux ensembles',()=>{
 const modele=salonReference(),avant=structuredClone(modele),prep=preparerAmenagement([],{envies:'Salon avec un coin repas',referencesSpatiales:true,staging:false});
 const r=appliquerProposition({modele,fonction:'salon',prep,produits:catalogueZones,proposition:{meubles:[]}});
 assert.deepEqual(modele,avant);assert.equal(r.agencement.filter(it=>it.usageProgramme==='chaise-repas').length,4);assert.ok(r.proposition.planZones.zones.some(z=>z.type==='repas'));
 assert.equal(r.proposition.planZones.audit.geometrieValide,true);
 // Ce catalogue de géométrie ne contient aucune TV, et le staging est désactivé.
 assert.ok(r.proposition.programme.manquants.some(s=>s.usage==='television'&&s.obligatoire));
 assert.equal(r.proposition.planZones.audit.valide,false);assert.equal(r.proposition.planZones.statut,'a-completer');
});
