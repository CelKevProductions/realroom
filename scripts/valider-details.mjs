import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { appliquerProposition, preparerAmenagement } from '../lib/amenagement.js';
import { verifier } from '../lib/agencement.js';
import { verifierHauteurs } from '../lib/hauteurs.js';
import { evaluerFinition } from '../lib/finition.js';
import { OBJETS_GENERIQUES } from '../lib/catalogue-generique.js';
import { catalogueZones, salonReference, salons } from '../tests/fixtures/plan-zones.js';
import { chambres } from '../tests/fixtures/bench-chambres.js';
import { lireDXF } from '../lib/plans.js';
import { depuisScan } from '../lib/scan.js';
import { PRODUITS, candidats } from '../lib/catalogue.js';

const dossier=path.resolve('docs/composition-hauteur');fs.mkdirSync(dossier,{recursive:true});
const catalogue={...catalogueZones,...OBJETS_GENERIQUES};
const scenarii=[...salons().map(s=>({...s,fonction:'salon'})),...chambres().map(s=>({...s,fonction:'chambre'}))];
const resultats=[];
for(const s of scenarii){
  const t=performance.now(),r=appliquerProposition({modele:s.modele,fonction:s.fonction,produits:catalogue,
    prep:preparerAmenagement([],{budget:7000,envies:s.envies||''}),proposition:{meubles:[]}});
  const geometrie=verifier(s.modele,r.agencement,catalogue),hauteurs=verifierHauteurs(s.modele,r.agencement,catalogue);
  const bilan={nom:s.nom,fonction:s.fonction,tempsMs:Math.round(performance.now()-t),objets:r.agencement.length,geometrie,hauteurs,
    planValide:r.proposition.planZones?.audit?.valide||false,finition:r.proposition.finition,manquants:r.proposition.programme?.manquants||[]};
  resultats.push(bilan);console.log(`${s.fonction} · ${s.nom} : ${bilan.objets} objets, ${hauteurs.length} conflits de hauteur, plan ${bilan.planValide?'valide':'à vérifier'} · ${bilan.tempsMs} ms`);
}
const modele=salonReference();
const r=appliquerProposition({modele,fonction:'salon',produits:catalogue,prep:preparerAmenagement([],{budget:5000,envies:'Salon avec repas'}),proposition:{meubles:[]}});
const apres={modele,catalogue,items:r.agencement,proposition:r.proposition};
const sansCouche=r.agencement.filter(it=>!['tv','tv-murale','tableau','etagere-murale','lampe','lampadaire','applique','suspension','lustre','plafonnier'].includes(catalogue[it.sku].fam));
const avant={modele,catalogue,items:sansCouche,proposition:{...r.proposition,finition:evaluerFinition(modele,sansCouche,catalogue,r.proposition.programme)}};
for(const [nom,data] of Object.entries({avant,apres}))fs.writeFileSync(path.join(dossier,nom+'.json'),JSON.stringify(data,null,2)+'\n');
const synthese={cas:resultats.length,sansConflit:resultats.filter(r=>!r.geometrie.length&&!r.hauteurs.length).length,plansValides:resultats.filter(r=>r.planValide).length,
  television:resultats.filter(r=>r.finition?.tvDistance).length,
  programmesCompletEtValide:resultats.filter(r=>r.planValide&&!r.manquants.some(s=>s.obligatoire)).length,
  reference:{objets:r.agencement.length,planValide:r.proposition.planZones.audit.valide,scoreAvant:avant.proposition.finition.score,scoreApres:r.proposition.finition.score}};
// Seules les fixtures synthétiques ci-dessus alimentent les artefacts versionnés.
fs.writeFileSync(path.join(dossier,'resultats.json'),JSON.stringify({source:'tests/fixtures/plan-zones.js et tests/fixtures/bench-chambres.js',donneesClient:false,synthese,resultats},null,2)+'\n');
if(process.env.DXF_REGRESSION){
  const scan=lireDXF(fs.readFileSync(process.env.DXF_REGRESSION,'utf8')).pieces[0].scan,modele=depuisScan(scan).modele;
  const c=candidats({dims:modele.dims,fonction:'salon',budget:15000,envies:'Salon épuré avec repas et lecture',parFamille:30}),t=performance.now();
  const reelle=appliquerProposition({modele,fonction:'salon',produits:PRODUITS,candidats:c,prep:preparerAmenagement([],{budget:15000,envies:'Salon épuré avec repas et lecture'}),proposition:{meubles:[]}});
  const dxfClient={tempsMs:Math.round(performance.now()-t),objets:reelle.agencement.length,geometrie:verifier(modele,reelle.agencement,PRODUITS),hauteurs:verifierHauteurs(modele,reelle.agencement,PRODUITS),planValide:reelle.proposition.planZones?.audit?.valide||false,finition:reelle.proposition.finition,
    manquants:reelle.proposition.programme.manquants.map(({zone,usage,motif})=>({zone,usage,motif})),total:reelle.agencement.filter(it=>it.garde!==false).reduce((s,it)=>s+(PRODUITS[it.sku]?.prix||0),0)};
  fs.writeFileSync(path.join(os.tmpdir(),'realroom-details-dxf-local.json'),JSON.stringify(dxfClient,null,2)+'\n');
  console.log('Régression DXF privée enregistrée dans le dossier temporaire local, hors dépôt.');
}
console.log(JSON.stringify(synthese));
if(!r.proposition.planZones.audit.valide||resultats.some(r=>r.geometrie.length||r.hauteurs.length))process.exitCode=1;
