import {candidatsGroupe,verifierPlanZones} from './zonage.js';
import {optimiserAmenagement} from './confort.js';
import {produitDe,estMural,estSuspendu,estPlat} from './agencement.js';
import {verifierHauteurs} from './hauteurs.js';
import {posesStaging,evaluerStaging} from './staging.js';
import {verifierReglesDures} from './encyclopedie.js';
// Comparaison locale, sans appel IA ni nouveau produit. Les enveloppes et les
// architectures déjà affichées restent des contraintes de chaque variante.
export function comparerDispositions(modele,items,catalogue,{programme,plan,staging,...opts}={}){
 if(!programme?.encyclopedie||!plan?.zones?.length)return optimiserAmenagement(modele,items,catalogue,{...opts,variantes:3});
 const fixes=posesStaging(items,staging,catalogue).filter(it=>!['surface_item','wall_item','ceiling_item'].includes(it.kind)).map(it=>({...it,fixe:true}));
 const base=optimiserAmenagement(modele,[...items,...fixes],catalogue,{...opts,planZones:plan,patrons:false}),variantes=[];
 const ajouter=(liste,source,zone)=>{
  const tous=liste.filter(it=>!fixes.some(q=>q.id===it.id)),stage=posesStaging(tous,staging,catalogue),audit=verifierPlanZones(modele,[...tous,...stage.filter(it=>!['surface_item','wall_item','ceiling_item'].includes(it.kind))],catalogue,plan);
  if(!audit.valide||verifierHauteurs(modele,tous,catalogue).length||!verifierReglesDures(modele,[...tous,...stage],catalogue,programme.encyclopedie.profil).valide||(staging&&evaluerStaging(modele,tous,catalogue,staging,plan).audit.length))return;
  if(variantes.some(v=>!tous.some(it=>{const q=v.items.find(q=>q.id===it.id);return !q||Math.hypot(it.x-q.x,it.z-q.z)>=.15||Math.abs((it.rot||0)-(q.rot||0))>=Math.PI/6;})))return;
  variantes.push({items:tous,confort:audit.confort,source,zone});
 };
 ajouter(base.items,null,null);
 for(const z of programme.zones){
  const reserve=plan.zones.find(q=>q.id===z.id);if(!reserve)continue;
  const mobiles=items.filter(it=>it.zoneId===z.id&&!estMural(produitDe(it,catalogue)?.fam)&&!estSuspendu(produitDe(it,catalogue)?.fam)),immobiles=items.filter(it=>!mobiles.includes(it));
  if(!mobiles.length)continue;
  const obstacles=[...immobiles,...fixes].map(it=>({it,p:produitDe(it,catalogue)})).filter(e=>e.p&&!estMural(e.p.fam)&&!estSuspendu(e.p.fam)&&!estPlat(e.p.fam)).map(e=>({...e,b:{x0:e.it.x-e.p.dim[0]/2,x1:e.it.x+e.p.dim[0]/2,z0:e.it.z-e.p.dim[1]/2,z1:e.it.z+e.p.dim[1]/2}}));
  for(const c of candidatsGroupe(modele,z,mobiles,catalogue,obstacles).filter(c=>c.complete&&c.zone.x0>=reserve.x0-.01&&c.zone.x1<=reserve.x1+.01&&c.zone.z0>=reserve.z0-.01&&c.zone.z1<=reserve.z1+.01).slice(0,12)){
   const r=optimiserAmenagement(modele,[...immobiles,...c.items,...fixes],catalogue,{...opts,planZones:plan,patrons:false});ajouter(r.items,c.zone.dispositionUid,z.id);if(variantes.length>=3)break;
  }if(variantes.length>=3)break;
 }
 return{...base,items:base.items.filter(it=>!fixes.some(q=>q.id===it.id)),variantes:variantes.length?variantes:[{items,confort:base.confort}],recherche:{...base.recherche,dispositionsComparees:variantes.map(v=>v.source).filter(Boolean)}};
}
