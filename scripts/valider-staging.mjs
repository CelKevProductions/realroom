// node scripts/valider-staging.mjs ; BASELINE_STAGING=/archive ajoute l'avant cc158b.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PRODUITS } from '../lib/catalogue.js';
import { choisirCandidats } from '../lib/selection.js';
import { preparerAmenagement, appliquerProposition } from '../lib/amenagement.js';
import { posesStaging } from '../lib/staging.js';
import { sejour89 } from '../tests/fixtures/staging.js';
import { rectangle } from '../tests/fixtures/bench-chambres.js';
const dossier=path.resolve('docs/staging');await fs.mkdir(dossier,{recursive:true});
// Les instantanés complets de pièces restent locaux ; seuls les bilans et
// rendus des fixtures indépendantes sont publiés avec le dépôt.
const dossierModeles=path.resolve(process.env.STAGING_MODELES||'.data/staging-modeles');await fs.mkdir(dossierModeles,{recursive:true});
const ancien=process.env.BASELINE_STAGING?await import(path.join(process.env.BASELINE_STAGING,'lib/amenagement.js')):null;
const ancienneSelection=process.env.BASELINE_STAGING?await import(path.join(process.env.BASELINE_STAGING,'lib/selection.js')):null;
const cas=[{id:10,modele:rectangle(3.2,3.125),choix:{envies:'Salon minimaliste',espaces:[]}},
  {id:18,modele:rectangle(4.5,4),choix:{envies:'Salon chaleureux'}},
  {id:30,modele:rectangle(6,5),choix:{envies:'Salon chaleureux'}},
  {id:89,modele:sejour89(),choix:{envies:'Salon chaleureux'}}];
const resultats=[];
function donnees(modele,r){return{modele,items:r.agencement,catalogue:Object.fromEntries(r.agencement.filter(it=>it.sku).map(it=>[it.sku,PRODUITS[it.sku]])),
  staging:r.proposition.staging,planZones:r.proposition.planZones};}
function bilan(r){const p=r.proposition,props=posesStaging(r.agencement,p.staging);return{mobilier:r.agencement.length,props:props.length,
  zonesVie:p.densite.zonesVie,zones:p.planZones.zones.map(z=>({id:z.id,surface:Math.round((z.x1-z.x0)*(z.z1-z.z0)*100)/100})),
  television:r.agencement.some(it=>it.usageProgramme==='television')||props.some(it=>it.usageProgramme==='television'),
  murs:props.filter(it=>it.kind==='wall_item').length,scoreStaging:p.staging?.diagnostic.score||0,auditStaging:p.staging?.diagnostic.audit||[],
  anglesNus:p.staging?.diagnostic.regles.filter(q=>q.id==='angle-nu').length||0,maxPropsSurface:Math.max(0,...(p.staging?.diagnostic.surfaces.map(s=>s.nombre)||[])),
  auditPlacement:p.planZones.audit.valide,largeurPassage:p.planZones.audit.circulation.largeur,
  coutMobilier:r.agencement.filter(it=>it.origine==='catalogue').reduce((s,it)=>s+(PRODUITS[it.sku]?.prix||0),0),
  coutProps:props.reduce((s,it)=>s+(it.p.prix||0),0),manquants:p.programme.manquants.filter(s=>s.obligatoire),
  architectureManquante:p.staging?.manquants||[]};}
for(const {id,modele,choix}of cas) {
  const original=structuredClone(modele),prep=preparerAmenagement([],{budget:0,...choix});
  const r=appliquerProposition({modele,prep,fonction:'salon',produits:PRODUITS,proposition:{meubles:[]},candidats:choisirCandidats(PRODUITS,{modele,fonction:'salon',...prep})}),apres=bilan(r);
  assert.deepEqual(modele,original);assert.deepEqual(apres.auditStaging,[]);assert.ok(apres.auditPlacement);assert.ok(apres.television);assert.ok(apres.maxPropsSurface<=4);assert.equal(apres.coutProps,0);
  if(id===89){assert.equal(apres.zonesVie,5);assert.equal(apres.anglesNus,0);assert.ok(apres.murs>=1);assert.deepEqual(apres.architectureManquante,[]);assert.equal(apres.largeurPassage,1.1);}
  if(id===10){assert.ok(apres.props<=5);assert.ok(apres.maxPropsSurface<=2);}
  let avant=null;
  if(ancien){const pp=ancien.preparerAmenagement([],{budget:0,...choix}),rr=ancien.appliquerProposition({modele,prep:pp,fonction:'salon',produits:PRODUITS,proposition:{meubles:[]},candidats:ancienneSelection.choisirCandidats(PRODUITS,{modele,fonction:'salon',...pp})});avant=bilan(rr);await fs.writeFile(path.join(dossierModeles,`${id}-avant.json`),JSON.stringify(donnees(modele,rr),null,2)+'\n');}
  await fs.writeFile(path.join(dossierModeles,`${id}-apres.json`),JSON.stringify(donnees(modele,r),null,2)+'\n');
  const resultat={surface:id,avant,apres};resultats.push(resultat);console.log(JSON.stringify(resultat));
}
await fs.writeFile(path.join(dossier,'resultats.json'),JSON.stringify({provenance:'Fixtures synthétiques indépendantes : tests/fixtures/bench-chambres.js et tests/fixtures/staging.js. Aucun plan, budget ou donnée du client. Les instantanés géométriques complets restent locaux dans .data/staging-modeles.',cas:resultats},null,2)+'\n');
