import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { preparerAmenagement, appliquerProposition } from '../lib/amenagement.js';
import { choisirCandidats } from '../lib/selection.js';
import { PRODUITS } from '../lib/catalogue.js';
import { verifier, produitDe } from '../lib/agencement.js';
import { verifierHauteurs } from '../lib/hauteurs.js';
import { posesStaging } from '../lib/staging.js';
import { chambres, rectangle } from '../tests/fixtures/bench-chambres.js';
import { surfacePiece } from '../lib/programme.js';
import { noteComposition } from '../lib/qualite-composition.js';

const dossier=path.resolve('.data/bench-essentiels'), resultats=[], catalogueAvant=JSON.stringify(PRODUITS);
fs.mkdirSync(dossier,{recursive:true});
let appelsReseau=0;
globalThis.fetch=async()=>{appelsReseau++;throw Error('Toute requête réseau est interdite dans cette matrice');};
const chambre={envies:'Chambre épurée, télévision et rangement',budget:0};
const salon={envies:'Salon épuré avec télévision et repas',espaces:['repas'],placesRepas:4,budget:9000};
const cas=chambres().map((c,i)=>({id:`chambre-${i+1}`,nom:`Chambre ${c.nom}`,fonction:'chambre',modele:c.modele,choix:chambre}));
for(const budget of [500,1500,2500])cas.push({id:`chambre-budget-${budget}`,nom:`Chambre 16 m² · ${budget} €`,fonction:'chambre',modele:rectangle(4,4),choix:{...chambre,budget}});
cas.push(
 {id:'chambre-tv-sur-meuble',nom:'Chambre 16 m² · TV sur meuble',fonction:'chambre',modele:rectangle(4,4),choix:{...chambre,envies:'Chambre épurée avec télévision sur meuble et rangement'}},
 {id:'chambre-sans-tv',nom:'Chambre 16 m² · sans télévision',fonction:'chambre',modele:rectangle(4,4),choix:{...chambre,envies:'Chambre épurée sans télévision, avec rangement'},sansTV:true},
 {id:'chambre-chaleureuse',nom:'Chambre 16 m² · chaleureuse',fonction:'chambre',modele:rectangle(4,4),choix:{...chambre,envies:'Chambre chaleureuse avec télévision et rangement'}}
);
for(const [L,P] of [[3.5,4],[4,4],[4,5],[5,5],[6,5]])cas.push({id:`salon-${L}-${P}`,nom:`Salon ${L*P} m² · repas à quatre`,fonction:'salon',modele:rectangle(L,P),choix:salon});
for(const budget of [500,1200,2000])cas.push({id:`salon-budget-${budget}`,nom:`Salon 30 m² · ${budget} €`,fonction:'salon',modele:rectangle(6,5),choix:{...salon,budget}});
cas.push(
 {id:'chambre-ssr-off',nom:'Chambre 16 m² · SSR désactivé',fonction:'chambre',modele:rectangle(4,4),choix:{...chambre,referencesSpatiales:false}},
 {id:'salon-ssr-off',nom:'Salon 30 m² · 1 200 € · SSR désactivé',fonction:'salon',modele:rectangle(6,5),choix:{...salon,budget:1200,referencesSpatiales:false}}
);
for(const c of cas.filter(c=>!process.argv[2]||process.argv[2].split(',').includes(c.id))){
 const debut=performance.now(),modele=structuredClone(c.modele),avant=JSON.stringify(modele);
 try{
  const prep=preparerAmenagement([],{encyclopedie:true,referencesSpatiales:true,...c.choix});
  const candidats=choisirCandidats(PRODUITS,{modele,fonction:c.fonction,...prep});
  const r=appliquerProposition({modele,fonction:c.fonction,prep,candidats,produits:PRODUITS,proposition:{concept:'Essai local sans IA',planVie:[],meubles:[],retirer:[],conseils:[]}});
  const p=r.proposition,items=r.agencement.filter(it=>it.garde!==false),details=posesStaging(items,p.staging,PRODUITS),tous=[...items,...details];
  const tv=tous.filter(it=>it.usageProgramme==='television'||['tv','tv-murale'].includes(produitDe(it,PRODUITS)?.fam));
  const manquants=p.programme.manquants.filter(s=>s.obligatoire&&!s.substitut).map(s=>({usage:s.usage,motif:s.motif}));
  const confort=p.confort,conflits=verifier(modele,items,PRODUITS),hauteurs=verifierHauteurs(modele,[...items,...tv.filter(it=>!items.includes(it))],PRODUITS);
  const cout=items.reduce((s,it)=>s+(PRODUITS[it.sku]?.prix||0),0),ancre=c.fonction==='chambre'?'lit':'canape';
  const problemesTest=[];
  if(JSON.stringify(modele)!==avant)problemesTest.push('geometrie-modifiee');
  if(c.choix.budget&&cout>c.choix.budget+.001)problemesTest.push('budget-depasse');
  if(c.sansTV&&tv.length)problemesTest.push('refus-tv-ignore');
  if(p.programme.complet!==!manquants.length)problemesTest.push('completude-incoherente');
  if(p.planZones?.audit?.valide&&manquants.length)problemesTest.push('audit-mensonger');
  if(p.planZones?.statut==='compose'&&(manquants.length||conflits.length||hauteurs.length||confort.score.contraintes||!confort.acces||confort.circulation===false))problemesTest.push('succes-avec-problemes');
  const spatialOK=!conflits.length&&!hauteurs.length&&!confort.score.contraintes&&confort.acces&&confort.circulation!==false;
  const bilan={id:c.id,nom:c.nom,surface:surfacePiece(modele),choix:c.choix,meubles:items.length,details:details.length,
   lits:items.filter(it=>it.usageProgramme==='lit').length,canapes:items.filter(it=>it.usageProgramme==='canape').length,televisions:tv.length,
   tablesRepas:items.filter(it=>it.usageProgramme==='table-repas').length,chaisesRepas:items.filter(it=>it.usageProgramme==='chaise-repas').length,
   principalPresent:items.some(it=>it.usageProgramme===ancre),totalCatalogue:Math.round(cout*100)/100,manquants,
   contraintes:confort.score.contraintes,conflits,hauteurs,acces:confort.acces,circulation:confort.circulation,
   spatialOK,programmeComplet:!manquants.length,auditPlan:p.planZones?.audit?.valide??null,statut:p.planZones?.statut,
   geometrieConservee:JSON.stringify(modele)===avant,budgetRespecte:!c.choix.budget||cout<=c.choix.budget+.001,
   qualite:noteComposition(modele,items,PRODUITS),problemesTest,ms:Math.round(performance.now()-debut)};
  resultats.push(bilan);
  fs.writeFileSync(path.join(dossier,c.id+'.json'),JSON.stringify({modele,items,staging:p.staging,catalogue:PRODUITS,proposition:p,bilan}));
  console.log(JSON.stringify({cas:c.nom,qualite:bilan.qualite.note,principal:bilan.principalPresent,tv:tv.length,spatial:spatialOK,complet:!manquants.length,statut:bilan.statut,manquants,problemesTest,ms:bilan.ms}));
 }catch(e){const bilan={id:c.id,nom:c.nom,refus:e.code==='REGLES_BLOQUANTES',erreur:e.code||e.name,message:e.message,ms:Math.round(performance.now()-debut)};resultats.push(bilan);console.log(JSON.stringify(bilan));}
 fs.writeFileSync(path.join(dossier,'resultats.json'),JSON.stringify({version:'enrichissement-2026-10-15',appelsIA:0,appelsReseau,resultats},null,2));
 assert.equal(JSON.stringify(PRODUITS),catalogueAvant);
}
assert.equal(appelsReseau,0);
assert.ok(resultats.every(r=>!r.erreur&&r.spatialOK&&r.geometrieConservee&&r.budgetRespecte&&!r.problemesTest.length), 'Une exception ou un invariant du moteur a échoué : consulter resultats.json');
console.log('Terminé : '+resultats.length+' scénarios, zéro appel IA et zéro requête réseau.');
