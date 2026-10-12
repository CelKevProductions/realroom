import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {BASE,variantesEncyclopedie} from '../lib/encyclopedie.js';
import {PRODUITS} from '../lib/catalogue.js';
import {choisirCandidats} from '../lib/selection.js';
import {preparerAmenagement,appliquerProposition} from '../lib/amenagement.js';
import {posesStaging} from '../lib/staging.js';
import {rectangle} from '../tests/fixtures/bench-chambres.js';
import {sejour89} from '../tests/fixtures/staging.js';
const local='.data/encyclopedie-modeles',docs='docs/encyclopedie';await fs.mkdir(local,{recursive:true});await fs.mkdir(docs,{recursive:true});
const variantes=Object.fromEntries(['SL','CH','SAM','CU','BU','SDB','EN','BA','AN'].map(piece=>[piece,{source:BASE.dispositions.filter(d=>d.piece===piece).length,contextes:variantesEncyclopedie(piece).length,parZone:Object.fromEntries(BASE.zones.filter(z=>z.piece===piece).map(z=>[z.id,variantesEncyclopedie(piece).filter(v=>z.dispositions.includes(v.uidSource)).length]))}]));
const resultats=[];
for(const c of [{id:'chambre',fonction:'chambre',modele:rectangle(4,4)},{id:10,fonction:'salon',modele:rectangle(3.2,3.125)},{id:18,fonction:'salon',modele:rectangle(4.5,4)},{id:30,fonction:'salon',modele:rectangle(6,5)},{id:89,fonction:'salon',modele:sejour89()}]){
 const modele=c.modele,original=structuredClone(modele),prep=preparerAmenagement([],{encyclopedie:true,envies:c.id===10?'Salon minimaliste':c.fonction==='chambre'?'Chambre chaleureuse':'Salon chaleureux',...(c.id===10?{espaces:[]}:{})});
 const r=appliquerProposition({modele,fonction:c.fonction,prep,produits:PRODUITS,candidats:choisirCandidats(PRODUITS,{modele,fonction:c.fonction,...prep}),proposition:{meubles:[]}}),p=r.proposition,props=posesStaging(r.agencement,p.staging,PRODUITS);
 assert.deepEqual(modele,original);assert.equal(p.encyclopedie.audit.valide,true);assert.equal(p.planZones.audit?.valide,true);assert.deepEqual(p.staging?.diagnostic.audit,[]);
 const bilan={id:c.id,surface:p.programme.surface,mobilier:r.agencement.length,props:props.length,activites:p.densite.zonesVie,zones:p.planZones.zones.map(z=>({id:z.id,uid:z.dispositionUid,sources:z.encyclopedie?.zones})),graines:p.recherche.grainesSource,
 auditRegles:p.encyclopedie.audit.valide,auditPlacement:p.planZones.audit.valide,auditProps:p.staging.diagnostic.audit,passage:p.planZones.audit.circulation.largeur,
 television:r.agencement.some(it=>it.usageProgramme==='television')||props.some(it=>it.usageProgramme==='television'),manquants:p.programme.manquants.filter(s=>s.obligatoire&&!s.substitut),
 coutMobilier:r.agencement.filter(it=>it.origine==='catalogue').reduce((s,it)=>s+(PRODUITS[it.sku]?.prix||0),0),coutProps:props.reduce((s,it)=>s+(it.p.prix||0),0),modelesNouveaux:[...new Set(props.filter(it=>it.prop.startsWith('enc-')).map(it=>it.prop))],
 reglesMesurees:[...new Set(p.encyclopedie.regles.mesures.map(m=>m.uid))],signatureMoments:p.staging.encyclopedie.signatureMoments,statistiques:p.planZones.statistiques};
 if(c.id===89){assert.equal(bilan.activites,5);assert.ok(bilan.zones.every(z=>z.uid));assert.equal(bilan.passage,1.1);assert.equal(bilan.television,true);assert.deepEqual(bilan.manquants,[]);}
 await fs.writeFile(`${local}/${c.id}-apres.json`,JSON.stringify({modele,items:r.agencement,catalogue:Object.fromEntries(r.agencement.filter(it=>it.sku).map(it=>[it.sku,PRODUITS[it.sku]])),staging:p.staging,planZones:p.planZones},null,2)+'\n');
 resultats.push(bilan);console.log(JSON.stringify(bilan));
}
await fs.copyFile('.data/staging-modeles/89-apres.json',`${local}/89-avant.json`);
await fs.writeFile(`${docs}/acceptation.json`,JSON.stringify({provenance:'Fixtures synthétiques indépendantes ; aucune pièce client. Instantanés complets sous .data/encyclopedie-modeles, non suivis par Git.',comptes:BASE.comptes,variantes,cas:resultats},null,2)+'\n');
