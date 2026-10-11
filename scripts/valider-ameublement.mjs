// Banc borné et reproductible ; des échecs restent des échecs dans le rapport.
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { PRODUITS } from '../lib/catalogue.js';
import { chambres,mobilierCatalogue,scenarioReference,catalogueReference } from '../tests/fixtures/bench-chambres.js';
import { resoudre,verifier } from '../lib/agencement.js';
import { bilanConfort,optimiserAmenagement } from '../lib/confort.js';
const compacter=b=>({score:b.score.total,contraintes:b.score.contraintes,circulation:b.circulation,acces:b.acces,ouvertures:b.ouvertures,cout:b.score.cout,alertes:b.alertes.map(a=>({type:a.type,ids:a.ids}))});
function mesurer(nom,modele,items,cat){
 const depart=resoudre(modele,items,cat).items,t=performance.now();
 const complet=optimiserAmenagement(modele,items,cat,{envies:'Scandinave chaleureux'});
 const places=resoudre(modele,complet.items,cat).items;
 const r=optimiserAmenagement(modele,places,cat,{envies:'Scandinave chaleureux',variantes:3});
 return {nom,modele,mobilier:depart,avant:compacter(bilanConfort(modele,depart,cat)),ecartesAvant:items.filter(it=>!depart.some(x=>x.id===it.id&&x.garde!==false)).map(x=>x.id),apres:compacter(r.confort),agencement:r.items,
  variantes:r.variantes.length,dureeMs:Math.round(performance.now()-t),recherche:r.recherche,
  conflits:verifier(modele,r.items,cat),ecartes:items.filter(it=>!r.items.some(x=>x.id===it.id&&x.garde!==false)).map(x=>x.id)};
}
const rs=chambres().map(c=>mesurer(c.nom,c.modele,mobilierCatalogue(),PRODUITS));
const reference=scenarioReference(),r=mesurer('Référence protocole · 14 m²',reference.modele,reference.items,catalogueReference);
const p=Object.values(PRODUITS);
const bilan={version:1,regles:'realroom-2026-10-v3',date:'2026-10-10',audit:{nombreProduits:p.length,dimensionsNumeriques:p.filter(x=>x.dim?.length===3&&x.dim.every(v=>Number.isFinite(v)&&v>0)).length,
 dimensionsEstimees:p.filter(x=>x.dimEstimees).map(x=>x.id),prixNonConfirme:p.filter(x=>!(x.prix>0)).map(x=>x.id),familles:p.reduce((a,p)=>(a[p.fam]=(a[p.fam]||0)+1,a),{}),
 meublesBanc:['nd-01','nordic-table-basse','et-650'].map(id=>({id,nom:PRODUITS[id].nom,dim:PRODUITS[id].dim,prix:PRODUITS[id].prix}))},
 synthese:{cas:rs.length,sansConflit:rs.filter(x=>!x.conflits.length&&!x.apres.contraintes).length,circulationValidee:rs.filter(x=>x.apres.circulation).length,
 toutesReglesUsage:rs.filter(x=>x.apres.circulation&&x.apres.acces&&x.apres.ouvertures).length,mobilierComplet:rs.filter(x=>!x.ecartes.length).length,
 scoresAmeliores:rs.filter(x=>x.apres.score>x.avant.score).length,scoreMoyenAvant:rs.reduce((s,x)=>s+x.avant.score,0)/rs.length,scoreMoyenApres:rs.reduce((s,x)=>s+x.apres.score,0)/rs.length},chambres:rs,reference:r};
fs.writeFileSync('docs/validation-ameublement.json',JSON.stringify(bilan,null,2)+'\n');
console.log(JSON.stringify({audit:bilan.audit,synthese:bilan.synthese,cas:[...rs,r].map(x=>({nom:x.nom,avant:x.avant,apres:x.apres,dureeMs:x.dureeMs,ecartes:x.ecartes,variantes:x.variantes,conflits:x.conflits.length}))},null,2));
