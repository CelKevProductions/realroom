// Chaque opération est issue de la géométrie source. Les installations et
// mécanismes non renseignés restent bloqués, plutôt que remplacés par une rangée.
import fs from 'node:fs/promises';
import BASE from '../data/encyclopedie/runtime.json' with {type:'json'};
import {INTERPRETEURS} from '../lib/encyclopedie-dispositions.js';
const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const operations=BASE.dispositions.map(d=>{
 const t=normal(d.geometrie+' '+d.conditions),besoins=[];
 if(/foyer|cheminee|poele|conduit/.test(t))besoins.push('foyer-et-distances-fabricant');
 if(/plomb|evacuation|arrivee d.eau|douche|gaine/.test(t))besoins.push('installations-relevees');
 if(/suspendu|porteur|fixation|renforce/.test(t))besoins.push('ancrage-valide');
 if(/escamot|motorise|gigogne|convertible|pivotant|pliante|rabattable/.test(t))besoins.push('modele-et-enveloppe-ouverte');
 if(/sur mesure|estrade|decaiss|sous escalier|sous pente|bow.window|alcove|niche|mezzanine/.test(t))besoins.push('geometrie-architecturale-relevee');
 if(/lit.*superpos|couchage.*haut/.test(t))besoins.push('produit-nf-en-747-valide');
 const operation=/diagon|biais|45°/.test(t)?'diagonale':/face.a.face|vis.a.vis|face a face/.test(t)?'vis-a-vis':/\ben u\b|u ouvert|u ferme/.test(t)?'U':/\ben l\b|l contre|l flottant/.test(t)?'L':/ilot|flottant|centre|central/.test(t)?'central':/perpendiculaire/.test(t)?'fenetre-laterale':'lineaire';
 return{interpreteur:INTERPRETEURS[d.uid]||null,statutExecution:INTERPRETEURS[d.uid]?'actif':besoins.length?'preconditions-et-modele-requis':'interpreteur-ou-modele-manquant',uid:d.uid,id:d.id,piece:d.piece,zone:d.zone_id,operation,besoins,conditions:d.conditions,meubles:d.meubles,source:d.geometrie,reference:{document:d.document,ligne:d.ligne}};
});
await fs.writeFile('data/encyclopedie/dispositions-operations.json',JSON.stringify(operations,null,2)+'\n');
console.log(JSON.stringify({dispositions:operations.length,avecPreconditions:operations.filter(x=>x.besoins.length).length,operations:Object.fromEntries([...new Set(operations.map(x=>x.operation))].map(op=>[op,operations.filter(x=>x.operation===op).length]))}));
