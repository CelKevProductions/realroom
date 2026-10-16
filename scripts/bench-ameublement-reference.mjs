import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { preparerAmenagement, appliquerProposition } from '../lib/amenagement.js';
import { choisirCandidats } from '../lib/selection.js';
import { PRODUITS } from '../lib/catalogue.js';
import { verifier } from '../lib/agencement.js';
import { evaluerReferences } from '../lib/ameublement-reference.js';
import { rectangle } from '../tests/fixtures/bench-chambres.js';
import { salonReference } from '../tests/fixtures/plan-zones.js';
import { sejour89 } from '../tests/fixtures/staging.js';
import { surfacePiece } from '../lib/programme.js';

const dossier='.data/ameublement-reference';await fs.mkdir(dossier,{recursive:true});
const donnees=process.argv.includes('--contours-test')?JSON.parse(await fs.readFile(`${dossier}/contours-test.json`,'utf8')):[];
const cas=[
 {nom:'Chambre 9 m²',fonction:'chambre',modele:rectangle(3,3)},
 {nom:'Chambre 16 m²',fonction:'chambre',modele:rectangle(4,4)},
 {nom:'Salon 10 m²',fonction:'salon',modele:rectangle(2.5,4)},
 {nom:'Salon 20 m² · repas',fonction:'salon',modele:salonReference(),envies:'Salon chaleureux, télévision et repas pour quatre personnes',budget:4000},
 {nom:'Séjour 30 m²',fonction:'salon',modele:rectangle(6,5)},
 {nom:'Séjour 89 m²',fonction:'salon',modele:sejour89(),espaces:['salon','repas','travail','cuisine','bar'],placesRepas:8},
 ...donnees
];
const catalogueAvant=JSON.stringify(PRODUITS),resultats=[];
for(let i=0;i<cas.length;i++) {
 const c=cas[i],paire={nom:c.nom,fonction:c.fonction,surface:c.surface??surfacePiece(c.modele),ouverturesConnues:c.ouverturesConnues!==false};
 for(const [nom,actif] of [['avant',false],['apres',true]]) {
  const debut=performance.now(),modele=structuredClone(c.modele),geometrie=JSON.stringify(modele);
  const envies=c.envies|| (c.fonction==='chambre'?'Chambre chaleureuse avec télévision et rangement':'Salon chaleureux, télévision, repas et fauteuil');
  const prep=preparerAmenagement([],{envies,encyclopedie:true,referencesSpatiales:actif,budget:c.budget||0,espaces:c.espaces,placesRepas:c.placesRepas});
  const candidats=choisirCandidats(PRODUITS,{modele,fonction:c.fonction,...prep});
  const r=appliquerProposition({modele,fonction:c.fonction,prep,produits:PRODUITS,candidats,proposition:{meubles:[]}});
  const items=r.agencement.filter(it=>it.garde!==false),props=r.proposition.staging?.items||[],refs=evaluerReferences(modele,items,PRODUITS);
  const manquants=r.proposition.programme?.manquants?.filter(m=>m.obligatoire&&!m.substitut)||[];
  const nb=usage=>[...items,...props].filter(it=>it.usageProgramme===usage).length;
  paire[nom]={meubles:items.length,props:props.length,zones:r.proposition.planZones?.zones?.map(z=>z.type)||[],coutReferences:refs.cout,noteReferences:refs.note,collisions:verifier(modele,items,PRODUITS).length,acces:r.proposition.confort.acces,auditPlan:r.proposition.planZones?.audit?.valide??null,manquants:manquants.map(m=>m.usage),repas:nb('table-repas'),chaisesRepas:nb('chaise-repas'),television:nb('television'),budget:r.proposition.selectionBudget,ms:Math.round(performance.now()-debut)};
  if(JSON.stringify(modele)!==geometrie)throw Error('Géométrie modifiée');
  if(i<cas.length-donnees.length)await fs.writeFile(`${dossier}/${i}-${nom}.json`,JSON.stringify({modele,fonction:c.fonction,items:r.agencement,staging:r.proposition.staging,catalogue:PRODUITS,proposition:r.proposition}));
 }
 paire.gain=Number(((paire.avant.coutReferences||0)-(paire.apres.coutReferences||0)).toFixed(3));
 resultats.push(paire);await fs.writeFile(`${dossier}/bench.json`,JSON.stringify(resultats,null,2)+'\n');
 console.log(JSON.stringify({cas:paire.nom,gain:paire.gain,avant:paire.avant.meubles,apres:paire.apres.meubles,zones:paire.apres.zones,acces:paire.apres.acces,collisions:paire.apres.collisions}));
}
if(JSON.stringify(PRODUITS)!==catalogueAvant)throw Error('Catalogue altéré');
console.log(JSON.stringify({cas:resultats.length,ameliores:resultats.filter(p=>p.gain>0.01).length,identiques:resultats.filter(p=>Math.abs(p.gain)<=.01).length,degrades:resultats.filter(p=>p.gain<-.01).length,pertesFonctions:resultats.filter(p=>p.apres.repas<p.avant.repas||p.apres.television<p.avant.television||p.apres.zones.length<p.avant.zones.length).length}));
