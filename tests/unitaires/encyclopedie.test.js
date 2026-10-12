import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BASE,encyclopedieActive,profilEncyclopedie,variantesEncyclopedie,verifierReglesDures,scoreReglesEncyclopedie,grainesEncyclopedie,evaluerDisposition} from '../../lib/encyclopedie.js';
import {INTERPRETEURS} from '../../lib/encyclopedie-dispositions.js';
import MODELES from '../../data/encyclopedie/modeles.json' with {type:'json'};
import OPERATIONS from '../../data/encyclopedie/dispositions-operations.json' with {type:'json'};
import {verifierCotes} from '../../lib/controle-modeles.js';
import {construireProp} from '../../moteur/staging.js';
import {propDe} from '../../lib/staging-catalogue.js';
import {preparerAmenagement,appliquerProposition} from '../../lib/amenagement.js';
import {PRODUITS} from '../../lib/catalogue.js';
import {choisirCandidats} from '../../lib/selection.js';
import {programmeComposition} from '../../lib/programme.js';
import {rectangle} from '../fixtures/bench-chambres.js';
import {sejour89} from '../fixtures/staging.js';
import {posesStaging} from '../../lib/staging.js';
import {comparerDispositions} from '../../lib/encyclopedie-variantes.js';
const lit={id:'lit',p:{fam:'lit',dim:[1.6,2,.45]},x:0,z:0,rot:0};
function amenager(modele,fonction,choix={}){const prep=preparerAmenagement([],{encyclopedie:true,envies:'Pièce chaleureuse',...choix});return appliquerProposition({modele,fonction,prep,produits:PRODUITS,candidats:choisirCandidats(PRODUITS,{modele,fonction,...prep}),proposition:{meubles:[]}});}

test('deux tomes : 1630 lignes couvertes, IDs uniques et aucune référence pendante',()=>{
 assert.deepEqual(BASE.documents.map(d=>[d.lignes,d.lignesCouvertes]),[[702,702],[928,928]]);
 assert.equal(BASE.zones.length,100);assert.equal(BASE.dispositions.length,521);
 for(const collection of ['zones','dispositions','meubles','props','regles','signature_moments'])assert.equal(new Set(BASE[collection].map(x=>x.uid)).size,BASE[collection].length,collection);
 const ds=new Set(BASE.dispositions.map(d=>d.uid)),ms=new Set(BASE.meubles.map(m=>m.uid));
 for(const z of BASE.zones)for(const id of z.dispositions)assert.ok(ds.has(id),id);
 for(const d of BASE.dispositions)for(const id of d.meubles)assert.ok(ms.has(id),id);
 assert.ok(BASE.trous.some(t=>t.type==='dimensions-incompletes'));assert.ok(BASE.meubles.filter(m=>!m.dim).every(m=>m.dimensionsSource));
 assert.equal(BASE.dispositions.find(d=>d.uid==='SL:1.1').id,'1.1');assert.equal(BASE.dispositions.find(d=>d.uid==='CH:CH-1.01').id,'CH-1.01');
});
test('manifeste : les 521 lignes ont un statut ; seul un interpréteur connu est actif',()=>{
 assert.equal(OPERATIONS.length,521);for(const o of OPERATIONS)assert.equal(o.statutExecution==='actif',!!INTERPRETEURS[o.uid]);
 assert.equal(OPERATIONS.filter(o=>o.interpreteur).length,Object.keys(INTERPRETEURS).length);assert.ok(OPERATIONS.some(o=>o.besoins.includes('ancrage-valide')));
});
test('chambre : 119 lignes réelles deviennent 256 contextes identifiés, sans doublons',()=>{
 assert.equal(BASE.dispositions.filter(d=>d.piece==='CH').length,119);const vs=variantesEncyclopedie('CH');assert.equal(vs.length,256);assert.equal(new Set(vs.map(v=>v.id)).size,256);
 for(const v of vs)assert.ok(BASE.dispositions.some(d=>d.uid===v.uidSource&&d.id===v.source));
 assert.equal(vs.filter(v=>v.fenetre==='libre').length,119);assert.ok(vs.some(v=>v.fenetre==='profil'&&v.profil==='adulte'));
 for(const d of BASE.dispositions.filter(d=>d.piece==='CH'))assert.ok(vs.filter(v=>v.uidSource===d.uid).length>=2,d.uid);
});
test('feature flag expérimental : désactivation explicite et arrêt par environnement',()=>{
 assert.equal(encyclopedieActive(false),false);const avant=process.env.REALROOM_ENCYCLOPEDIE;process.env.REALROOM_ENCYCLOPEDIE='0';assert.equal(encyclopedieActive(true),false);if(avant===undefined)delete process.env.REALROOM_ENCYCLOPEDIE;else process.env.REALROOM_ENCYCLOPEDIE=avant;
});
test('navigateur : sans choix local le drapeau du build active aussi l’encyclopédie',()=>{
 const avant={window:Object.getOwnPropertyDescriptor(globalThis,'window'),localStorage:Object.getOwnPropertyDescriptor(globalThis,'localStorage'),serveur:process.env.REALROOM_ENCYCLOPEDIE,client:process.env.NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE};
 try{
  globalThis.window={};delete process.env.REALROOM_ENCYCLOPEDIE;process.env.NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE='1';
  for(const [local,attendu] of [[null,true],['1',true],['0',false]]){globalThis.localStorage={getItem:()=>local};assert.equal(encyclopedieActive(),attendu);}
  globalThis.localStorage={getItem:()=>{throw new Error('stockage indisponible');}};assert.equal(encyclopedieActive(),true);
  process.env.REALROOM_ENCYCLOPEDIE='0';assert.equal(encyclopedieActive(true),false);
 }finally{
  for(const key of ['window','localStorage']){if(avant[key])Object.defineProperty(globalThis,key,avant[key]);else delete globalThis[key];}
  for(const [key,value] of [['REALROOM_ENCYCLOPEDIE',avant.serveur],['NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE',avant.client]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
test('configuration : activation limitée aux previews des branches mission 5 et aménagement vivant, avec arrêt prioritaire',async()=>{
 const keys=['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','REALROOM_ENCYCLOPEDIE','NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE'],avant=keys.map(k=>process.env[k]),branche='codex/realroom-mission5-encyclopedie-2026-10-12';
 try{
  const cas=[['preview',branche,undefined,undefined,true],['production',branche,undefined,undefined,false],['preview','main',undefined,undefined,false],['development',branche,undefined,undefined,false],['preview',branche,'0',undefined,false],['preview',branche,undefined,'0',false],['preview','amenagement-vivant',undefined,undefined,true],['production','amenagement-vivant',undefined,undefined,false],['preview','amenagement-vivant','0',undefined,false]];
  for(let i=0;i<cas.length;i++){const valeurs=cas[i];for(let k=0;k<keys.length;k++){if(valeurs[k]===undefined)delete process.env[keys[k]];else process.env[keys[k]]=valeurs[k];}const {default:config}=await import(`../../next.config.mjs?mission5-test=${i}`);assert.equal(config.env?.NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE==='1',valeurs[4]);assert.equal(config.env?.REALROOM_ENCYCLOPEDIE==='1',valeurs[4]);}
 }finally{for(let i=0;i<keys.length;i++){if(avant[i]===undefined)delete process.env[keys[i]];else process.env[keys[i]]=avant[i];}}
});
test('profils : moins de six ans reste incompatible avec le couchage haut',()=>{
 assert.equal(profilEncyclopedie('enfant de moins de 6 ans').age,5);assert.equal(profilEncyclopedie('enfant de 8 ans').age,8);assert.equal(profilEncyclopedie('chambre PMR').pmr,true);
});
test('PMR : cercle Ø150 et deux côtés 90/pied120, échec en chambre étroite',()=>{
 const oui=verifierReglesDures(rectangle(6,6),[lit],{}, {pmr:true});assert.equal(oui.valide,true);assert.equal(oui.cercle.diametre,1.5);
 const non=verifierReglesDures(rectangle(2.5,3),[lit],{}, {pmr:true});assert.ok(non.erreurs.includes('pmr-passages-lit-90-120'));assert.ok(non.erreurs.includes('pmr-cercle-150'));assert.equal(non.certification,false);
});
test('PMR : ouvertures, circulation et hauteur libre sous la vasque sont bloquantes',()=>{
 const m=rectangle(6,6);m.pmr={largeurCirculation:.8};assert.ok(verifierReglesDures(m,[],{},{pmr:true}).erreurs.includes('pmr-circulation-90'));m.pmr.largeurCirculation=.9;assert.equal(verifierReglesDures(m,[],{},{pmr:true}).valide,true);
 const v={id:'v',p:{fam:'vasque',dim:[.7,.5,.85],hauteurLibreSousVasque:.7},x:2,z:2,rot:0};assert.equal(verifierReglesDures(m,[v],{},{pmr:true}).valide,true);delete v.p.hauteurLibreSousVasque;assert.ok(verifierReglesDures(m,[v],{},{pmr:true}).erreurs.includes('pmr-vasque-hauteur-libre-70-non-verifiee'));
 const pan=Object.keys(m.murs)[0];m.murs[pan].ouvertures=[{type:'porte',position:0,largeur:.8,hauteur:2}];assert.ok(verifierReglesDures(m,[],{},{pmr:true}).erreurs.includes('pmr-largeur-ouverture-83-90'));
});
test('PMR cuisine : 150 cm de dégagement devant le plan, obstacle refusé',()=>{
 const m=rectangle(6,6),i={id:'ilot',p:{fam:'ilot',dim:[2,.95,.92]},usageProgramme:'ilot-cuisine',x:0,z:0,rot:0};assert.equal(verifierReglesDures(m,[i],{},{pmr:true}).valide,true);
 const q={id:'q',p:{fam:'meuble',dim:[.8,.6,1]},x:0,z:-1.3,rot:0};assert.ok(verifierReglesDures(m,[i,q],{},{pmr:true}).erreurs.includes('pmr-cuisine-150'));
});
test('couchage haut : âge, barrières et validation fournisseur requis séparément',()=>{
 const m=rectangle(6,6),b={...lit,p:{...lit.p,superpose:true,securite:{barriereAuDessusMatelas:.16,barriereAuDessusSommier:.26,videMax:.075,validationNFEN747:true}}};
 assert.equal(verifierReglesDures(m,[b],{},{age:6}).valide,true);assert.ok(verifierReglesDures(m,[b],{},{age:5}).erreurs.includes('couchage-haut-age-6'));
 b.p.securite.barriereAuDessusMatelas=.15;assert.ok(verifierReglesDures(m,[b],{},{age:8}).erreurs.includes('couchage-haut-barriere'));b.p.securite.barriereAuDessusMatelas=.16;b.p.securite.validationNFEN747=false;
 assert.ok(verifierReglesDures(m,[b],{},{age:8}).erreurs.includes('nf-en-747-validation-produit-manquante'));
});
test('garde-corps : validation et hauteur ≥1m ; meuble escaladable refusé',()=>{
 const m=rectangle(6,6);assert.ok(verifierReglesDures(m,[],{},{balcon:true}).erreurs.includes('garde-corps-non-verifiee')||verifierReglesDures(m,[],{},{balcon:true}).erreurs.includes('garde-corps-non-verifie'));
 m.gardeCorps={validation:true,hauteur:1,segments:['fond']};assert.equal(verifierReglesDures(m,[],{},{balcon:true}).valide,true);
 const q={id:'q',p:{fam:'meuble',dim:[.5,.5,.7]},x:0,z:-2.6,rot:0};assert.ok(verifierReglesDures(m,[q],{},{balcon:true}).erreurs.includes('garde-corps-meuble-escaladable'));m.gardeCorps.hauteur=.99;assert.equal(verifierReglesDures(m,[],{},{balcon:true}).valide,false);
});
test('INRS : recommandation souple ; mode strict bloquant sans mesure ou hors 50–70cm',()=>{
 assert.equal(BASE.regles.find(r=>r.uid==='CH:regle:plan_de_couchage_pmr').statut,'souple');
 assert.equal(BASE.regles.find(r=>r.uid==='BU:regle:distance_il_ecran').statut,'souple');const m=rectangle(6,6);assert.equal(verifierReglesDures(m,[],{},{}).valide,true);
 assert.ok(verifierReglesDures(m,[],{},{ergonomieStricte:true}).erreurs.includes('ergonomie-distance-non-mesuree'));m.ergonomie={distanceOeilEcran:.6};assert.equal(verifierReglesDures(m,[],{},{ergonomieStricte:true}).valide,true);m.ergonomie.distanceOeilEcran=.8;assert.equal(verifierReglesDures(m,[],{},{ergonomieStricte:true}).valide,false);
});
test('règles chiffrées : assise réelle requise, hauteur totale non substituée',()=>{
 const h={id:'h',p:{fam:'meuble',dim:[1.5,.55,1.05]},usageProgramme:'comptoir-bar',zoneId:'bar',x:0,z:0},s={id:'s',p:{fam:'tabouret',dim:[.4,.4,1.1]},usageProgramme:'tabouret-bar',zoneId:'bar',x:0,z:1};
 assert.ok(!scoreReglesEncyclopedie([h,s],{}).mesures.some(m=>m.uid==='SL:regle:assise_de_tabouret'));s.p.hauteurAssise=.775;assert.equal(scoreReglesEncyclopedie([h,s],{}).mesures.find(m=>m.uid==='SL:regle:assise_de_tabouret').points,0);
 s.p.hauteurAssise=.9;assert.ok(scoreReglesEncyclopedie([h,s],{}).ecarts.some(m=>m.uid==='SL:regle:assise_de_tabouret'));
});
test('composition : café/bibliothèque du brief sélectionnés depuis les zones source',()=>{
 const p=programmeComposition({modele:sejour89(),fonction:'salon',envies:'Salon avec coin café et bibliothèque',encyclopedie:true});assert.ok(p.zones.some(z=>z.id==='cafe'&&z.encyclopedie.zones.includes('SAM:coin_cafe')));assert.ok(p.zones.some(z=>z.id==='bibliotheque'&&z.encyclopedie.zones.includes('SL:bibliotheque')));
 assert.ok(p.encyclopedie.choixZones.some(z=>z.decision==='retenue'));assert.ok(!programmeComposition({modele:sejour89(),fonction:'salon',envies:'sans coin café',encyclopedie:true}).zones.some(z=>z.id==='cafe'));
});
test('chambre de référence : recuit amorcé avec un ID réel du tome 2',()=>{
 const r=amenager(rectangle(4,4),'chambre'),p=r.proposition;assert.ok(p.planZones.zones.find(z=>z.id==='couchage').dispositionUid.startsWith('CH:CH-1.'));assert.ok(p.recherche.grainesSource.some(id=>id.startsWith('CH-1.')));assert.equal(p.encyclopedie.audit.valide,true);assert.equal(p.planZones.audit.valide,true);assert.deepEqual(p.programme.manquants.filter(m=>m.obligatoire&&!m.substitut),[]);
});
test('89 m² : cinq activités avec IDs, télévision S, recettes, signature et passages 110cm',()=>{
 const m=sejour89(),original=structuredClone(m),r=amenager(m,'salon',{envies:'Salon chaleureux'}),p=r.proposition;
 assert.deepEqual(m,original);assert.equal(p.densite.zonesVie,5);for(const id of ['salon','repas','cuisine','bar','travail']){const z=p.planZones.zones.find(z=>z.id===id);assert.ok(z?.dispositionUid,id);assert.ok(p.staging.encyclopedie.recettes.some(z=>z.zone===id&&z.sources.length),id);}
 const props=posesStaging(r.agencement,p.staging,PRODUITS);assert.ok(props.some(it=>it.usageProgramme==='television'));assert.ok(props.some(it=>it.prop==='enc-bol-citrons'));assert.ok(p.staging.encyclopedie.signatureMoments.some(s=>s.uid==='CU:signature:504'));
 assert.ok(props.some(it=>it.sourceEncyclopedie));assert.equal(p.planZones.audit.valide,true);assert.equal(p.planZones.audit.circulation.largeur,1.1);assert.deepEqual(p.staging.diagnostic.audit,[]);assert.deepEqual(p.programme.manquants.filter(m=>m.obligatoire&&!m.substitut),[]);assert.ok(props.every(it=>it.vendu===false&&!it.sku&&!it.p.prix));
});
test('proposition non conforme : refus avant enregistrement',()=>{
 assert.throws(()=>amenager(rectangle(4,4),'chambre',{profilUsage:{ergonomieStricte:true}}),e=>e.code==='REGLES_BLOQUANTES');
});
test('réaménagement partiel : les règles bloquantes restent appliquées sans programme macro',()=>{
 assert.throws(()=>amenager(rectangle(4,4),'chambre',{mode:'partiel',profilUsage:{ergonomieStricte:true}}),e=>e.code==='REGLES_BLOQUANTES');
});
test('variantes proposées : positions distinctes, mêmes produits et contrôles complets',()=>{
 const m=rectangle(6,5),r=amenager(m,'salon',{envies:'Salon chaleureux'}),p=r.proposition,v=comparerDispositions(m,r.agencement,PRODUITS,{programme:p.programme,plan:p.planZones,staging:p.staging,envies:'Salon chaleureux'});
 assert.ok(v.variantes.length>=2);for(const q of v.variantes){assert.deepEqual(q.items.map(it=>it.id).sort(),r.agencement.map(it=>it.id).sort());assert.ok(q.confort.acces);assert.equal(q.confort.score.contraintes,0);assert.ok(!q.source||BASE.dispositions.some(d=>d.uid===q.source));}
 assert.ok(v.variantes[1].items.some(it=>{const avant=v.variantes[0].items.find(q=>q.id===it.id);return Math.hypot(it.x-avant.x,it.z-avant.z)>=.15||Math.abs(it.rot-avant.rot)>=Math.PI/6;}));
});
test('huit prototypes : 96 configurations dans ±5%, classe S et jamais vendables',()=>{
 assert.equal(MODELES.plafond,8);assert.equal(MODELES.modeles.length,8);assert.equal(MODELES.appelsGeneration3D,0);assert.equal(MODELES.coutGeneration3DUSD,0);
 for(const m of MODELES.modeles){assert.equal(m.vendu,false);assert.equal(m.classe,'S');assert.equal(m.validationProduit,false);assert.equal(m.sku,undefined);assert.equal(m.prix,undefined);assert.equal(m.tagsStyle.length,12);
  for(const style of Object.keys(MODELES.styles)){const p=propDe(m.id,style);assert.equal(verifierCotes(construireProp(p),m).valide,true,m.id);assert.deepEqual(p.cols,MODELES.styles[style]);}
 }
});
test('contrôle de cotes : un objet déformé de 6% est rejeté',()=>{
 const m=MODELES.modeles[0],g=new THREE.Group();g.add(construireProp(propDe(m.id)));g.scale.x=1.06;assert.equal(verifierCotes(g,m).valide,false);
});
