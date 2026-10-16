// Parcours reproductible de l'assistant, sans IA ni requête réseau.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { executerAssistant } from '../lib/assistant-amenagement.js';
import { PRODUITS } from '../lib/catalogue.js';
import { rectangle } from '../tests/fixtures/bench-chambres.js';
import { ancresDisposition, dispositionsDistinctes } from '../lib/variation-disposition.js';

const sortie=path.resolve('.data/bench-assistant');fs.mkdirSync(sortie,{recursive:true});
globalThis.fetch=()=>{throw new Error('Réseau interdit');};
const catalogue=JSON.stringify(PRODUITS),resultats=[];
const cas=[
  {id:'chambre-16',fonction:'chambre',modele:rectangle(4,4),envies:'Chambre épurée avec télévision et rangement',budget:0},
  {id:'salon-25',fonction:'salon',modele:rectangle(5,5),envies:'Salon épuré avec télévision et repas',espaces:['repas'],placesRepas:4,budget:9000},
  {id:'salon-1200',fonction:'salon',modele:rectangle(6,5),envies:'Salon épuré avec télévision et repas',espaces:['repas'],placesRepas:4,budget:1200}
];
for(const c of cas.filter(c=>!process.argv[2]||process.argv[2].split(',').includes(c.id))){
  let piece={fonction:c.fonction,modele:structuredClone(c.modele),agencement:[]};
  const avant=JSON.stringify(piece.modele),variantes=[];
  for(let tour=0;tour<3;tour++){
    const debut=performance.now();
    const r=executerAssistant(piece,tour?{action:'shuffle',session:piece.proposition.variantes.session}:{...c,action:'generer',encyclopedie:true},PRODUITS);
    assert.equal(r.assistant.message,'proposition',`${c.id} : une disposition différente est attendue`);
    assert.equal(r.proposition.programme.complet,true);
    assert.equal(r.proposition.planZones.audit.valide,true);
    const ancres=ancresDisposition(r.agencement);
    assert.ok(variantes.every(v=>dispositionsDistinctes(ancres,v.ancres)));
    const cout=r.agencement.reduce((s,it)=>s+(PRODUITS[it.sku]?.prix||0),0);
    assert.ok(!c.budget||cout<=c.budget+.001);
    assert.equal(JSON.stringify(piece.modele),avant);assert.equal(JSON.stringify(PRODUITS),catalogue);
    const tv=r.proposition.staging.items.filter(it=>it.usageProgramme==='television').length;
    const bilan={id:c.id,tour,selection:r.assistant.selection,complet:true,audit:true,meubles:r.agencement.length,televisions:tv,
      cout:Math.round(cout*100)/100,ancres,ms:Math.round(performance.now()-debut)};
    fs.writeFileSync(path.join(sortie,`${c.id}-${tour}.json`),JSON.stringify({modele:piece.modele,items:r.agencement,staging:r.proposition.staging,catalogue:PRODUITS,proposition:r.proposition,bilan}));
    variantes.push(bilan);console.log(JSON.stringify(bilan));
    piece=JSON.parse(JSON.stringify({...piece,agencement:r.agencement,proposition:r.proposition}));
  }
  const retour=executerAssistant(piece,{action:'choisir',id:'v0'},PRODUITS);
  const premier=JSON.parse(fs.readFileSync(path.join(sortie,`${c.id}-0.json`)));
  assert.deepEqual(retour.agencement,premier.items);
  assert.deepEqual(retour.proposition.staging,premier.staging);
  resultats.push({id:c.id,variantes,retourExact:true,geometrieConservee:true});
}
fs.writeFileSync(path.join(sortie,'resultats.json'),JSON.stringify({version:'assistant-2026-10-16',appelsIA:0,appelsReseau:0,resultats},null,2));
