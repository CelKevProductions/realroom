// Données éditoriales -> ensembles métriques. Jamais de cote marchande inventée.
import BASE from '../data/encyclopedie/runtime.json' with {type:'json'};
import {boite,produitDe,estAuSol,estPlat,zonesPortes} from './agencement.js';
import {contientPoint,contientBoite,segmentsDe,distanceSegment,pointOuverture,aireSignee,contourDe} from './contour.js';
export {BASE};
import {encyclopedieActive} from './encyclopedie-active.js';
import {INTERPRETEURS} from './encyclopedie-dispositions.js';
export {encyclopedieActive};
export function profilEncyclopedie(envies='',profil={}){
 const t=envies.toLowerCase(),age=t.match(/(?:enfant|enfants).{0,20}?(\d{1,2})\s*ans/),moinsDeSix=/enfants?.{0,15}(?:moins de|<)\s*6\s*ans/.test(t);
 return{pmr:/pmr|fauteuil roulant|accessible/.test(t)||profil.pmr===true,occupant:/enfant/.test(t)?'enfant':/invités|invites/.test(t)?'invites':'adulte',age:moinsDeSix?5:age?+age[1]:Number.isFinite(profil.age)?profil.age:null,balcon:/balcon/.test(t)||profil.balcon===true,ergonomieStricte:/ergonomie stricte/.test(t)||profil.ergonomieStricte===true,studio:/studio|personne seule/.test(t)||profil.studio===true};
}
const ZONES={salon:{salon:['SL:conversation','SL:ecran_media'],repas:['SAM:table_repas'],cuisine:['CU:ilot'],bar:['SL:bar'],travail:['BU:poste_travail'],lecture:['SL:lecture'],rangement:['SAM:rangement_vaisselle']},chambre:{couchage:['CH:couchage','CH:chevets'],rangement:['CH:rangement_vetements'],travail:['CH:bureau_chambre'],lecture:['CH:lecture']},salle_a_manger:{repas:['SAM:table_repas'],rangement:['SAM:rangement_vaisselle']},bureau:{travail:['BU:poste_travail'],rangement:['BU:rangement_bureau'],lecture:['SL:lecture']},entree:{accueil:['EN:depose_cles','EN:miroir_sortie'],assise:['EN:assise_chaussage'],rangement:['EN:chaussures']},terrasse:{salon:['BA:detente_lounge'],repas:['BA:repas_exterieur'],detente:['BA:bain_de_soleil'],rangement:['BA:rangement_ext']},salle_de_bain:{bain:['SDB:baignoire'],vasque:['SDB:vasque'],rangement:['SDB:rangement_sdb']}};
export function enrichirProgramme(p,choix,envies,profil){
 if(!encyclopedieActive(choix)||!p)return p;
 const usage=profilEncyclopedie(envies,profil),retenues=[];let utilise=0;
 for(const z of p.zones){
  const sources=(ZONES[p.fonction]?.[z.id]||[]).map(uid=>BASE.zones.find(x=>x.uid===uid)).filter(Boolean);
  const minimum=Math.max(0,...sources.map(x=>x.surfaceMin||0));
  // Les emprises du catalogue et le solveur restent l'arbitre : le minimum
  // éditorial de la zone fusionnée est un filtre souple sur les compléments.
  if(z.priorite>2&&!z.demandee&&utilise+minimum>p.surface){p.avertissements.push(`${z.libelle} : surface indicative de l’encyclopédie indisponible.`);continue;}
  utilise+=minimum;
  retenues.push({...z,encyclopedie:{zones:sources.map(x=>x.uid),surfaceMin:minimum,conditions:sources.map(x=>x.conditions)},profil:usage});
 }
 // Les compléments du brief sont choisis dans les zones source. Les usages
 // sans modèle/installation connu restent explicitement à compléter.
 const brief=String(envies||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const piece={salon:'SL',chambre:'CH',salle_a_manger:'SAM',bureau:'BU',salle_de_bain:'SDB',entree:'EN',terrasse:'BA'}[p.fonction];
 const demandes=[['SAM:coin_cafe',/coin cafe|station cafe|espace cafe|coffee/,['salon','salle_a_manger'],'cafe','accueil','enc-console-dos'],
  ['SL:bibliotheque',/bibliotheque/,['salon'],'bibliotheque','rangement','enc-bibliotheque-ouverte']];
 for(const [uid,motif,fonctions,id,type,prototype] of demandes){
  const sourceZone=BASE.zones.find(z=>z.uid===uid);if(!sourceZone||!fonctions.includes(p.fonction)||!motif.test(brief)||new RegExp('(?:sans|pas de)\\s+(?:coin\\s+)?'+(id==='cafe'?'cafe':'bibliotheque')).test(brief))continue;
  if(utilise+sourceZone.surfaceMin>p.surface){p.avertissements.push(`${id} : surface disponible insuffisante.`);continue;}
  utilise+=sourceZone.surfaceMin;
  retenues.push({id,type,libelle:id==='cafe'?'Café':'Bibliothèque',priorite:2,demandee:true,slots:[],prototypeStaging:prototype,
   encyclopedie:{zones:[uid],surfaceMin:sourceZone.surfaceMin,conditions:[sourceZone.conditions]},profil:usage});
 }
 const sourcesRetenues=new Set(retenues.flatMap(z=>z.encyclopedie.zones));
 const signatures=BASE.signature_moments.filter(s=>retenues.some(z=>z.encyclopedie.zones.some(uid=>uid.startsWith(s.piece+':'))));
 const choixZones=BASE.zones.filter(z=>z.piece===piece||sourcesRetenues.has(z.uid)).map(z=>({uid:z.uid,surfaceMin:z.surfaceMin,conditions:z.conditions,
  decision:sourcesRetenues.has(z.uid)?'retenue':z.surfaceMin>p.surface?'surface-insuffisante':'non-demandee-ou-installation-a-relever'}));
 return {...p,zones:retenues,encyclopedie:{version:BASE.version,profil:usage,choixZones,signatureMoments:signatures.map(s=>s.uid)},avertissements:p.avertissements};
}
export function variantesEncyclopedie(piece,maximum=256){
 const sources=BASE.dispositions.filter(d=>d.piece===piece),resultat=sources.map(d=>({id:d.uid+'@base',source:d.id,uidSource:d.uid,zone:d.zone_id,profil:'tous',fenetre:'libre'})),cles=new Set(resultat.map(v=>v.id));
 const profils=['adulte','enfant','invites'],fenetres=['face','profil','dos'],combinaisons=profils.flatMap(profil=>fenetres.map(fenetre=>({profil,fenetre})));
 const possibles=sources.map((d,i)=>combinaisons.map((_,j)=>combinaisons[(i+j)%combinaisons.length]).filter(v=>{
  if(/enfant|bébé|bebe|cododo/i.test(d.geometrie+' '+d.conditions)&&v.profil!=='enfant')return false;
  return !(/couple/i.test(d.conditions)&&v.profil==='enfant');
 }));
 // Tour par tour : chaque ligne reçoit une variation avant qu'une autre n'en
 // reçoive deux. Le plafond ne concentre pas tous les contextes sur le couchage.
 boucle:for(let rang=0;rang<9;rang++)for(let i=0;i<sources.length;i++){
  if(resultat.length>=Math.max(maximum,sources.length))break boucle;
  const d=sources[i],v=possibles[i][rang];if(!v)continue;
  const id=d.uid+'@'+v.profil+'-'+v.fenetre;if(cles.has(id))continue;cles.add(id);
  resultat.push({id,source:d.id,uidSource:d.uid,zone:d.zone_id,...v});
 }
 return resultat;
}
const source=(uid)=>BASE.dispositions.find(d=>d.uid===uid);
const famille=(it,cat)=>produitDe(it,cat)?.fam;
const clone=(items)=>items.map(it=>({...it}));
function repasMetier(base,table,cat){
 const q=clone(base),t=q.find(it=>it.id===table.id),p=produitDe(table,cat),sieges=q.filter(it=>it.usageProgramme==='chaise-repas');
 if(!p||sieges.length<6)return q;
 const long=Math.max(p.dim[0],p.dim[1]),prof=Math.min(p.dim[0],p.dim[1]);t.rot=p.dim[1]>p.dim[0]?Math.PI/2:0;
 const parCote=Math.ceil((sieges.length-2)/2);
 sieges.forEach((it,i)=>{const sp=produitDe(it,cat);if(i<parCote*2){const cote=i<parCote?1:-1,rang=i%parCote;Object.assign(it,{x:(rang-(parCote-1)/2)*Math.max(.6,sp.dim[0]+.08),z:cote*(prof/2+sp.dim[1]/2+.08),rot:cote>0?Math.PI:0});}else{const cote=i===parCote*2?1:-1;Object.assign(it,{x:cote*(long/2+sp.dim[1]/2+.08),z:0,rot:cote>0?-Math.PI/2:Math.PI/2});}});
 return q;
}
export function grainesEncyclopedie(zone,items,cat,base){
 if(!zone.encyclopedie)return [{items:base}];
 const out=[],ajouter=(uid,liste,strategie)=>{const d=source(uid);if(d&&INTERPRETEURS[uid])out.push({items:liste.map(it=>({...it,dispositionSource:d.id,dispositionUid:d.uid})),disposition:d,strategy:strategie});};
 const fs=items.filter(it=>famille(it,cat)==='fauteuil'),sofa=items.find(it=>famille(it,cat)==='canape');
 if(zone.type==='salon'&&sofa){
  const consoleDos=base.find(it=>it.usageProgramme==='console-dos'),sansConsole=base.filter(it=>it.id!==consoleDos?.id);
  const uid=fs.length>=2?'SL:1.5':fs.length===1?'SL:1.3':'SL:1.1';ajouter(uid,clone(sansConsole),'mur');
  if(fs.length){const q=clone(sansConsole);for(const f of fs){const it=q.find(it=>it.id===f.id);if(it)it.rot+=(it.x>0?-1:1)*(fs.length>=2?Math.PI/6:Math.PI/4);}ajouter(fs.length>=2?'SL:1.7':'SL:1.4',q,'eventail');}
  if(consoleDos){const q=clone(base),c=q.find(it=>it.id===consoleDos.id);Object.assign(c,{x:0,z:-produitDe(c,cat).dim[1]/2-.1,rot:Math.PI});ajouter('SL:1.2',q,'flottant-console');}
 }else if(zone.type==='couchage'){
  ajouter(zone.profil.pmr?'CH:CH-1.32':'CH:CH-1.01',clone(base),'mur');
  if(!zone.profil.pmr){const q=clone(base);for(const it of q)if(['lit','chevet','lampe-chevet'].includes(it.usageProgramme))it.x+=.12;ajouter('CH:CH-1.03',q,'decale');}
  if(!zone.profil.pmr){ajouter('CH:CH-1.02',clone(base),'lit-vue-porte');ajouter('CH:CH-1.08',clone(base),'lit-face-fenetre');ajouter('CH:CH-1.09',clone(base),'lit-profil-fenetre');}
 }else if(zone.type==='repas'){
  const table=items.find(it=>it.usageProgramme==='table-repas');
  const p=table&&produitDe(table,cat),rond=p&&(p.forme==='ronde'||/ronde|round/i.test(p.nom));
  const metier=table&&!rond?repasMetier(base,table,cat):clone(base);
  ajouter(rond?'SAM:SAM-1.03':'SAM:SAM-1.01',metier,rond?'rond':'axe-long');
  if(!rond)ajouter('SAM:SAM-1.02',clone(metier),'fenetre-bout');
 }else if(zone.type==='travail'){
  const piece=zone.encyclopedie.zones[0]?.startsWith('CH:')?'CH':'BU';
  ajouter(piece+':'+(piece==='CH'?'CH-4.01':'BU-1.01'),clone(base),'fenetre-laterale');
  ajouter(piece+':'+(piece==='CH'?'CH-4.03':'BU-1.04'),clone(base),'mur');
  if(piece==='BU')ajouter('BU:BU-1.03',clone(base),'bureau-vue-porte');
 }else if(zone.type==='lecture'){
  ajouter('SL:4.1',clone(base),'angle');const q=clone(base);const f=q.find(it=>famille(it,cat)==='fauteuil');if(f)f.rot+=Math.PI/4;ajouter('SL:4.2',q,'diagonale');
 }else if(zone.type==='cuisine')ajouter('CU:CU-2.01',clone(base),'ilot');
 else if(zone.type==='bar'){
  ajouter('SL:3.1',clone(base),'tabourets-un-cote');
  const q=clone(base),sieges=q.filter(it=>it.usageProgramme==='tabouret-bar');
  if(sieges.length>=2){const c=q.find(it=>it.usageProgramme==='comptoir-bar'),p=produitDe(c,cat),s=sieges[1];Object.assign(s,{x:p.dim[0]/2+.32,z:0,rot:-Math.PI/2});ajouter('SL:3.2',q,'tabourets-en-L');}
 }else if(zone.type==='accueil')ajouter(zone.id==='cafe'?'SAM:SAM-4.04':'EN:EN-1.01',clone(base),'console');
 else if(zone.type==='rangement'){
  if(zone.id==='bibliotheque')ajouter('SL:6.5',clone(base),'bibliotheque-separatrice');
  if(zone.encyclopedie.zones[0]==='SAM:rangement_vaisselle')ajouter('SAM:SAM-2.01',clone(base),'buffet');
  else if(zone.encyclopedie.zones[0]==='CH:rangement_vetements')ajouter('CH:CH-3.04',clone(base),'armoire');
  else if(zone.encyclopedie.zones[0]==='BU:rangement_bureau')ajouter('BU:BU-2.02',clone(base),'bibliotheque');
 }else if(zone.type==='vasque')ajouter('SDB:SDB-2.01',clone(base),'vasque');
 if(!out.length)return[{items:base,nonCouvert:true}];
 const resultat=[];
 for(const g of out){const variantes=variantesEncyclopedie(g.disposition.piece).filter(v=>v.uidSource===g.disposition.uid&&v.profil===zone.profil.occupant).slice(0,3);
  for(const v of variantes){const angle=v.fenetre==='profil'?Math.PI/2:v.fenetre==='dos'?Math.PI:0;resultat.push({...g,variante:v,items:g.items.map(it=>({...it,x:Math.cos(angle)*it.x+Math.sin(angle)*it.z,z:-Math.sin(angle)*it.x+Math.cos(angle)*it.z,rot:(it.rot||0)+angle,dispositionVariante:v.id}))});}resultat.push(g);
 }return resultat;
}
export function evaluerDisposition(modele,liste,cat,graine,zone){
 if(!graine.disposition)return{valide:true,score:0,raisons:['geometrie-legacy-sans-disposition-compatible']};
 const es=liste.map(it=>({it,p:produitDe(it,cat)})),bureau=es.find(e=>e.it.usageProgramme==='bureau'),table=es.find(e=>e.it.usageProgramme==='table-repas');
 const ouvertures=segmentsDe(modele).flatMap(pan=>(modele.murs?.[pan.id]?.ouvertures||[]).filter(o=>['fenetre','baie'].includes(o.type)).map(o=>({pan,q:pointOuverture(pan,o.position)})));
 if(graine.strategy==='fenetre-laterale'&&!ouvertures.length)return{valide:false,score:0};
 const a=bureau||table;
 if(a&&['fenetre-laterale','fenetre-bout'].includes(graine.strategy)){
  const f=[...ouvertures].sort((a1,b1)=>Math.hypot(a1.q[0]-a.it.x,a1.q[1]-a.it.z)-Math.hypot(b1.q[0]-a.it.x,b1.q[1]-a.it.z))[0];
  if(!f)return{valide:false,score:0};
  const dx=f.q[0]-a.it.x,dz=f.q[1]-a.it.z,lat=Math.abs(dx*Math.cos(a.it.rot)-dz*Math.sin(a.it.rot)),front=Math.abs(dx*Math.sin(a.it.rot)+dz*Math.cos(a.it.rot));
  if(graine.strategy==='fenetre-laterale'&&lat<front||graine.strategy==='fenetre-bout'&&lat<front)return{valide:false,score:0};
 }
 if(graine.strategy==='axe-long'&&table){const pan=[...segmentsDe(modele)].sort((a,b)=>b.long-a.long)[0];if(Math.abs((table.p.dim[0]>=table.p.dim[1]?Math.cos(table.it.rot):Math.sin(table.it.rot))*pan.d[0]+(table.p.dim[0]>=table.p.dim[1]?-Math.sin(table.it.rot):Math.cos(table.it.rot))*pan.d[1])<.8)return{valide:false,score:0};}
 if(graine.variante){const ancre=es.find(e=>['lit','canape','bureau','table'].includes(e.p?.fam));if(ancre&&ouvertures.length){const f=[...ouvertures].sort((a,b)=>Math.hypot(a.q[0]-ancre.it.x,a.q[1]-ancre.it.z)-Math.hypot(b.q[0]-ancre.it.x,b.q[1]-ancre.it.z))[0],dx=f.q[0]-ancre.it.x,dz=f.q[1]-ancre.it.z,a=ancre.it.rot||0,front=dx*Math.sin(a)+dz*Math.cos(a),lat=Math.abs(dx*Math.cos(a)-dz*Math.sin(a));if(graine.variante.fenetre==='face'&&front<lat||graine.variante.fenetre==='dos'&&-front<lat||graine.variante.fenetre==='profil'&&lat<Math.abs(front))return{valide:false,score:0};}}
 const d=graine.disposition,surface=Math.abs(aireSignee(contourDe(modele))),petite=d.conditions.match(/(?:≥|>)\s*(\d+(?:,\d+)?)\s*m²/),max=d.conditions.match(/<\s*(\d+(?:,\d+)?)\s*m²/);
 if(petite&&surface<+petite[1].replace(',','.')||max&&surface>=+max[1].replace(',','.'))return{valide:false,score:0};
 const lit=es.find(e=>e.p.fam==='lit'),sofa=es.find(e=>e.p.fam==='canape');
 const axe=(it,dx,dz)=>({lat:dx*Math.cos(it.rot||0)-dz*Math.sin(it.rot||0),front:dx*Math.sin(it.rot||0)+dz*Math.cos(it.rot||0)});
 if(bureau&&graine.strategy==='bureau-vue-porte'){
  const portes=segmentsDe(modele).flatMap(p=>(modele.murs?.[p.id]?.ouvertures||[]).filter(o=>o.type==='porte').map(o=>pointOuverture(p,o.position)));
  if(!portes.some(q=>{const a=axe(bureau.it,q[0]-bureau.it.x,q[1]-bureau.it.z);return a.front>Math.abs(a.lat);}))return{valide:false,score:0};
 }
 if(lit&&graine.strategy.startsWith('lit-')){
  const os=graine.strategy==='lit-vue-porte'?segmentsDe(modele).flatMap(p=>(modele.murs?.[p.id]?.ouvertures||[]).filter(o=>o.type==='porte').map(o=>pointOuverture(p,o.position))):ouvertures.map(o=>o.q);
  if(!os.length)return{valide:false,score:0};
  if(!os.some(q=>{const a=axe(lit.it,q[0]-lit.it.x,q[1]-lit.it.z);return graine.strategy==='lit-profil-fenetre'?Math.abs(a.lat)>Math.abs(a.front):a.front>Math.abs(a.lat);} ))return{valide:false,score:0};
 }
 if(d.uid==='SL:1.7'&&Math.max(modele.dims.largeur,modele.dims.profondeur)/Math.min(modele.dims.largeur,modele.dims.profondeur)>1.2)return{valide:false,score:0};
 if(d.uid==='SL:1.5'&&Math.min(modele.dims.largeur,modele.dims.profondeur)<3.5)return{valide:false,score:0};
 if(d.uid==='CH:CH-1.01'&&lit){const pan=[...segmentsDe(modele)].sort((a,b)=>b.long-a.long)[0],dos=zoneLocale(lit.it,0,-lit.p.dim[1]/2,.01,.01),centre=[(dos.x0+dos.x1)/2,(dos.z0+dos.z1)/2];if(distanceSegment(centre,pan.a,pan.b)>.15||Math.hypot(centre[0]-(pan.a[0]+pan.b[0])/2,centre[1]-(pan.a[1]+pan.b[1])/2)>.25)return{valide:false,score:0};}
 if(graine.strategy==='flottant-console'&&sofa){const dos=zoneLocale(sofa.it,0,-sofa.p.dim[1]/2-.45,sofa.p.dim[0],.9);if(!contientBoite(modele,dos))return{valide:false,score:0};}
 return{valide:true,score:graine.strategy==='fenetre-laterale'?5:graine.strategy==='eventail'?2:graine.strategy==='flottant-console'?4:0,raisons:[]};
}
function obstacles(items,cat){return items.filter(it=>it.garde!==false&&!['surface_item','wall_item','ceiling_item'].includes(it.kind)).map(it=>({it,p:produitDe(it,cat)})).filter(e=>e.p&&estAuSol(e.p.fam)&&!estPlat(e.p.fam)).map(e=>({...e,b:boite(e.it,e.p.dim)}));}
function zoneLocale(it,x,z,w,d){const a=it.rot||0;return boite({x:it.x+Math.cos(a)*x+Math.sin(a)*z,z:it.z-Math.sin(a)*x+Math.cos(a)*z,rot:a},[w,d,1]);}
export function verifierReglesDures(modele,items,cat,profil={}){
 const es=obstacles(items,cat),erreurs=[],portes=zonesPortes(modele);let cercle=null;
 if(profil.pmr){
  for(const pan of segmentsDe(modele))for(const o of modele.murs?.[pan.id]?.ouvertures||[])if(['porte','passage'].includes(o.type)&&Number.isFinite(o.largeur)&&o.largeur<(o.type==='porte'?.83:.9))erreurs.push('pmr-largeur-ouverture-83-90');
  if(Number.isFinite(modele.pmr?.largeurCirculation)&&modele.pmr.largeurCirculation<.9)erreurs.push('pmr-circulation-90');
  for(const e of es.filter(e=>['vasque','lavabo'].includes(e.p.fam)))if(!(e.p.hauteurLibreSousVasque>=.7))erreurs.push('pmr-vasque-hauteur-libre-70-non-verifiee');
  for(const e of es.filter(e=>e.p.fam==='lit')){
   const [w,d]=e.p.dim;
   const acceptable=([[.9,1.2],[1.2,.9]]).some(([c,pied])=>{
    const zones=[zoneLocale(e.it,0,d/2+pied/2,w,pied),...[-1,1].map(s=>zoneLocale(e.it,s*(w/2+c/2),0,c,d))];
    if(profil.studio)zones.pop();
    return zones.every(b=>contientBoite(modele,b)&&!es.some(q=>q.it.id!==e.it.id&&q.b.x0<b.x1-.001&&q.b.x1>b.x0+.001&&q.b.z0<b.z1-.001&&q.b.z1>b.z0+.001));
   });if(!acceptable)erreurs.push('pmr-passages-lit-90-120');
  }
  const r=.75,L=modele.dims.largeur,P=modele.dims.profondeur;
  for(let x=-L/2+r;x<=L/2-r+.001&&!cercle;x+=.1)for(let z=-P/2+r;z<=P/2-r+.001;z+=.1){
   if(!contientPoint(modele,x,z,r))continue;
   if(es.some(e=>Math.hypot(Math.max(e.b.x0-x,0,x-e.b.x1),Math.max(e.b.z0-z,0,z-e.b.z1))<r-.001))continue;
   // Plus conservateur que l'empiètement de 25 cm autorisé : aucun débattement.
   if(portes.some(b=>Math.hypot(Math.max(b.x0-x,0,x-b.x1),Math.max(b.z0-z,0,z-b.z1))<r-.001))continue;
   cercle={x:+x.toFixed(3),z:+z.toFixed(3),diametre:1.5};break;
  }
  if(!cercle)erreurs.push('pmr-cercle-150');
  for(const e of es.filter(e=>e.it.usageProgramme==='ilot-cuisine')){const b=zoneLocale(e.it,0,-e.p.dim[1]/2-.75,e.p.dim[0],1.5);if(!contientBoite(modele,b)||es.some(q=>q.it.id!==e.it.id&&q.b.x0<b.x1&&q.b.x1>b.x0&&q.b.z0<b.z1&&q.b.z1>b.z0))erreurs.push('pmr-cuisine-150');}
 }
 for(const e of items.filter(it=>it.garde!==false).map(it=>({it,p:produitDe(it,cat)})).filter(e=>e.p&&(e.p.fam==='lit-superpose'||e.p.superpose||/superpos[eé]|mezzanine/i.test(e.p.nom||'')))){
  const s=e.p.securite||{};
  if(profil.age==null||profil.age<6)erreurs.push('couchage-haut-age-6');
  if(!(s.barriereAuDessusMatelas>=.16&&s.barriereAuDessusSommier>=.26&&s.videMax<=.075))erreurs.push('couchage-haut-barriere');
  if(s.validationNFEN747!==true)erreurs.push('nf-en-747-validation-produit-manquante');
 }
 if(profil.ergonomieStricte){const d=modele.ergonomie?.distanceOeilEcran;if(!Number.isFinite(d))erreurs.push('ergonomie-distance-non-mesuree');else if(d<.5||d>.7)erreurs.push('ergonomie-distance-50-70');}
 if(profil.balcon){
  const gc=modele.gardeCorps;
  if(!gc?.validation||!(gc.hauteur>=1))erreurs.push('garde-corps-non-verifie');
  for(const id of gc?.segments||[]){const pan=segmentsDe(modele).find(p=>p.id===id);if(pan&&es.some(e=>distanceSegment([e.it.x,e.it.z],pan.a,pan.b)-Math.max(...e.p.dim.slice(0,2))/2<.6))erreurs.push('garde-corps-meuble-escaladable');}
 }
 return{valide:!erreurs.length,erreurs:[...new Set(erreurs)],cercle,certification:false};
}
export function scoreReglesEncyclopedie(items,cat,{modele,profil={}}={}){
 const es=items.filter(it=>it.garde!==false).map(it=>({it,p:produitDe(it,cat)})).filter(e=>e.p),ecarts=[],mesures=[];
 const intervalle=(uid,val,min,max,poids=5)=>{if(!Number.isFinite(val))return;const delta=Math.max(min-val,0,val-max),points=delta>0?-Math.round(delta*poids*10)/10:0;
  const mesure={uid,valeur:+val.toFixed(3),intervalle:[min,Number.isFinite(max)?max:null],points};mesures.push(mesure);if(delta>.001)ecarts.push(mesure);};
 const proche=(e,f)=>es.filter(f).sort((a,b)=>Math.hypot(a.it.x-e.it.x,a.it.z-e.it.z)-Math.hypot(b.it.x-e.it.x,b.it.z-e.it.z))[0];
 const memeZone=(e,q)=>!e.it.zoneId||!q.it.zoneId||e.it.zoneId===q.it.zoneId;
 const assise=e=>e.p.hauteurAssise??(e.p.forme==='tabouret'?e.p.dim[2]:null);
 const distanceLibre=(e,q)=>{const a=boite(e.it,e.p.dim),b=boite(q.it,q.p.dim);return Math.hypot(Math.max(a.x0-b.x1,b.x0-a.x1,0),Math.max(a.z0-b.z1,b.z0-a.z1,0));};
 for(const basse of es.filter(e=>e.it.usageProgramme==='table-basse')){const sofa=proche(basse,e=>e.p.fam==='canape'&&memeZone(e,basse));if(!sofa)continue;
  intervalle('SL:regle:longueur_table_basse',basse.p.dim[0]/sofa.p.dim[0],.6,2/3);
  intervalle('SL:regle:canape_table_basse',distanceLibre(basse,sofa),.4,.45);
  if(assise(sofa)!=null)intervalle('SL:regle:hauteur_table_basse',assise(sofa)-basse.p.dim[2],0,.1);
 }
 const sieges=es.filter(e=>['canape','fauteuil'].includes(e.p.fam));for(let i=0;i<sieges.length;i++)for(const q of sieges.slice(i+1))if(memeZone(sieges[i],q))intervalle('SL:regle:espace_entre_deux_assises',distanceLibre(sieges[i],q),.3,Infinity,2);
 for(const e of es){
  if(e.p.fam==='tapis'){
   const sofa=proche(e,q=>q.p.fam==='canape'&&memeZone(e,q));if(sofa)intervalle('SL:regle:tapis_debord_de_chaque_cote_du_canape',(e.p.dim[0]-sofa.p.dim[0])/2,.2,.3,2);
   if(modele)intervalle('SL:regle:tapis_mur',Math.min(...segmentsDe(modele).map(p=>distanceSegment([e.it.x,e.it.z],p.a,p.b)))-Math.min(...e.p.dim.slice(0,2))/2,.3,.5,1);
  }
  if(['tv','tv-murale'].includes(e.p.fam)&&Number.isFinite(e.it.y))intervalle('SL:regle:centre_de_l_ecran_au_sol',e.it.y,1,1.2,2);
  if(e.it.usageProgramme==='tableau-principal'){
   const sofa=proche(e,q=>q.p.fam==='canape'&&memeZone(e,q));if(sofa)intervalle('SL:regle:largeur_d_une_uvre_au_dessus_d_un_canape',e.p.dim[0]/sofa.p.dim[0],2/3,.75);
  }
  if(e.it.usageProgramme==='ilot-cuisine')intervalle('CU:regle:hauteur_du_plan_de_travail',e.p.dim[2],.85,.95);
  if(e.it.usageProgramme==='comptoir-bar')intervalle('SL:regle:plan_de_bar_ilot',e.p.dim[2],1.05,1.1);
  if(e.it.usageProgramme==='bureau')intervalle('BU:regle:plan_de_travail_fixe',e.p.dim[2],.72,.73,1);
  if(['tabouret-bar','chaise-repas'].includes(e.it.usageProgramme)){
   const comptoir=proche(e,q=>memeZone(e,q)&&['ilot-cuisine','comptoir-bar','table-repas'].includes(q.it.usageProgramme));
   if(comptoir&&assise(e)!=null)intervalle(e.it.usageProgramme==='tabouret-bar'?'SL:regle:assise_de_tabouret':'SAM:regle:ecart_plateau_assise',comptoir.p.dim[2]-assise(e),.25,.3);
  }
  if(e.it.usageProgramme==='chevet'){
   const lit=proche(e,q=>q.p.fam==='lit'&&memeZone(e,q));if(lit&&Number.isFinite(lit.p.hauteurMatelas))intervalle('CH:regle:hauteur_de_chevet',e.p.dim[2]-lit.p.hauteurMatelas,0,.05);
  }
  if(profil.pmr&&e.p.fam==='lit'&&Number.isFinite(e.p.hauteurMatelas))intervalle('CH:regle:plan_de_couchage_pmr',e.p.hauteurMatelas,.4,.5);
  if(e.p.fam==='suspension'||e.p.fam==='lustre'){
   const h=es.find(q=>q.it.id===e.it.attach_to?.id)||proche(e,q=>memeZone(e,q)&&['table-repas','ilot-cuisine'].includes(q.it.usageProgramme));
   const bas=e.it.baseY??(Number.isFinite(e.it.y)?e.it.y-e.p.dim[2]/2:null);
   if(h&&bas!=null&&['table-repas','ilot-cuisine'].includes(h.it.usageProgramme))intervalle(h.it.usageProgramme==='ilot-cuisine'?'CU:regle:suspension_au_dessus_de_l_ilot':'SAM:regle:suspension_au_dessus_du_plateau',bas-h.p.dim[2],h.it.usageProgramme==='ilot-cuisine'?.8:.75,h.it.usageProgramme==='ilot-cuisine'?1:.9);
  }
 }
 for(const h of es.filter(e=>['ilot-cuisine','comptoir-bar'].includes(e.it.usageProgramme))){
  const ss=es.filter(e=>e.it.usageProgramme==='tabouret-bar'&&memeZone(e,h));if(ss.length)intervalle('SL:regle:largeur_de_plan_par_personne_au_bar',h.p.dim[0]/ss.length,.6,Infinity);
  for(let i=0;i<ss.length;i++)for(const q of ss.slice(i+1))intervalle('SL:regle:espace_entre_tabourets',distanceLibre(ss[i],q),.2,Infinity);
 }
 if(Number.isFinite(modele?.ergonomie?.distanceOeilEcran))intervalle('BU:regle:distance_il_ecran',modele.ergonomie.distanceOeilEcran,.5,.7);
 const appliquees=new Set(mesures.map(m=>m.uid));
 return{score:ecarts.reduce((s,e)=>s+e.points,0),ecarts,mesures,
  nonMesurees:BASE.regles.filter(r=>r.statut==='souple'&&!appliquees.has(r.uid)).map(r=>({uid:r.uid,motif:'usage-absent-ou-mesure-produit-installation-non-renseignee'})),profil};
}
