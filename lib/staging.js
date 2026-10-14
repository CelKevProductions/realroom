// Mise en scène déterministe, séparée du mobilier acheté et de son budget.
import { PROPS, propDe, RECETTES_STAGING, styleStaging, stagingActif } from './staging-catalogue.js';
import { boite, produitDe, estAuSol, estPlat, porteurDe, zonesPortes } from './agencement.js';
import { segmentsDe, pointOuverture, contientBoite, distanceSegment } from './contour.js';
import { intersectionZones } from './zones-geometrie.js';
import { candidatsGroupe, verifierPlanZones, degagementsProgramme } from './zonage.js';
import { roleFonctionDe } from './roles.js';
import { empreinteVolume, chevaucheVolumes, intervalleHauteur } from './hauteurs.js';
import { completerHauteurs } from './finition.js';
import {BASE} from './encyclopedie.js';

const r = n => Math.round(n * 1000) / 1000;
const local = (it,x,z) => ({ x:r(it.x+Math.cos(it.rot||0)*x+Math.sin(it.rot||0)*z), z:r(it.z-Math.sin(it.rot||0)*x+Math.cos(it.rot||0)*z) });
const entrees = (items,cat) => items.filter(it=>it.garde!==false).map(it=>({it,p:produitDe(it,cat)})).filter(e=>e.p?.dim).map(e=>({...e,role:roleFonctionDe(e.it,e.p),b:boite(e.it,e.p.dim)}));
export const POIDS_STAGING = Object.freeze({ hoteVivant:4, tableVide:-5, surcharge:-6, monotone:-2, masque:-15, angleNu:-3, planteSombre:-2,
  murZone:5, lattes:3, vegetalTV:-10, mursMultiples:-10, ouverture:-100, style:2 });
const prop = (id,type,style,champs={}) => ({ id,prop:type,origine:'mise-en-scene',vendu:false,classe:'S',garde:true,rot:0,x:0,z:0,p:propDe(type,style),...champs });
export function architectureProgramme(programme,envies,preferences) {
  if(!programme?.staging)return [];
  const style=styleStaging(envies,preferences);
  const architecture=programme.zones.filter(z=>z.stagingArchitecture).flatMap(z=>[
    prop(`stage-${z.id}`,z.id==='cuisine'?'ilot':'comptoir',style,{zoneId:z.id,usageProgramme:z.id==='cuisine'?'ilot-cuisine':'comptoir-bar',obligatoireProgramme:true,prioriteProgramme:z.priorite,...(programme.encyclopedie&&z.id==='cuisine'?{p:{...propDe('ilot',style),plateauArrondi:true,signatureSource:'CU:signature:504'}}:{})}),
    ...[0,1].map(i=>prop(`stage-${z.id}-siege-${i}`,'tabouret',style,{zoneId:z.id,usageProgramme:'tabouret-bar',obligatoireProgramme:true,prioriteProgramme:z.priorite,...(programme.encyclopedie?{p:propDe('tabouret',style,[.4,.4,(z.id==='cuisine'? .92:1.05)-.275])}:{})}))]);
  if(programme.encyclopedie){
   for(const z of programme.zones.filter(z=>z.prototypeStaging))architecture.push(prop(`stage-${z.id}`,z.prototypeStaging,style,{zoneId:z.id,usageProgramme:z.id==='cafe'?'console':'bibliotheque',obligatoireProgramme:true,prioriteProgramme:z.priorite}));
   if(programme.surface>40&&programme.zones.some(z=>z.id==='salon'))architecture.push(prop('stage-console-dos','enc-console-dos',style,{zoneId:'salon',usageProgramme:'console-dos',obligatoireProgramme:false,prioriteProgramme:4}));
  }
  return architecture;
}

// Les poses relatives sont la source de vérité : rotation/déplacement/suppression
// d'un hôte ne laisse jamais d'accessoire flottant dans la pièce.
export function posesStaging(items, staging, catalogue={}) {
  const poses = new Map(items.filter(it=>it.garde!==false).map(it=>[it.id,it]));
  const resultat=[];
  for (const original of staging?.items || []) {
    if (original.garde===false || !PROPS[original.prop]) continue;
    const it={...original};
    if (it.attach_to?.type==='furniture') {
      const h=poses.get(it.attach_to.id); if(!h)continue;
      let [x,y,z]=it.local || [0,0,0];const hp=produitDe(h,catalogue);
      if(hp && it.hoteDim) {
        x*=hp.dim[0]/it.hoteDim[0];z*=hp.dim[1]/it.hoteDim[1];
        y=it.surface==='lumiere'?y+hp.dim[2]-it.hoteDim[2]:it.ancreY!=null?y+(h.y??it.ancreY)-it.ancreY:y*hp.dim[2]/it.hoteDim[2];
        if(!['assise','accoudoir','lumiere'].includes(it.surface)&&(Math.abs(x)+it.p.dim[0]/2>hp.dim[0]/2+.005||Math.abs(z)+it.p.dim[1]/2>hp.dim[1]/2+.005))continue;
      }
      const position=local(h,x,z),baseY=r((h.baseY||0)+y);
      Object.assign(it,position,{baseY,y:r(baseY+it.p.dim[2]/2),height:r(baseY+it.p.dim[2]/2),rot:r((h.rot||0)+(it.localRot||0))});
    }
    poses.set(it.id,it); resultat.push(it);
  }
  return resultat;
}

function sols(es) { return es.filter(e=>estAuSol(e.p.fam)&&!estPlat(e.p.fam)&&e.it.kind!=='surface_item'&&!porteurDe(e.it,e.p,es)); }

// Les meubles marchands restent exactement ceux sélectionnés par le moteur.
// Les îlots/bar sont placés dans l'espace encore libre, avec le même audit de
// contours, portes, dégagements et chemins que les ensembles du catalogue.
export function completerZonesStaging(modele, items, catalogue, programme, plan, opts={}) {
  const style=styleStaging(opts.envies,opts.preferences),initial=plan?structuredClone(plan):null;
  if (!initial?.zones?.length || !programme?.staging) return {items:[],plan:initial,manquants:[]};
  let etats=[{items:[],plan:initial,manquants:[],score:0}];
  for (const z of programme.zones.filter(z=>z.stagingArchitecture||programme.encyclopedie&&z.id==='rangement'&&z.encyclopedie?.zones.includes('SAM:rangement_vaisselle'))) {
    if(initial.zones.some(q=>q.id===z.id))continue;
    const rangement=z.id==='rangement',type=rangement?'enc-enfilade':z.id==='cuisine'?'ilot':'comptoir', usage=rangement?'buffet':z.id==='cuisine'?'ilot-cuisine':'comptoir-bar';
    const bases=[prop(`stage-${z.id}`,type,style,{zoneId:z.id,usageProgramme:usage}),
      ...(rangement?[]:[0,1].map(i=>prop(`stage-${z.id}-siege-${i}`, 'tabouret',style,{zoneId:z.id,usageProgramme:'tabouret-bar'})))];
    const obstacles=sols(entrees(items,catalogue));
    const table=rangement&&items.find(it=>it.usageProgramme==='table-repas');
    const candidats=candidatsGroupe(modele,{...z,surfaceMax:z.id==='cuisine'?12:8},bases,catalogue,obstacles,false,{table});
    const suites=[];
    for(const etat of etats)for (const c of candidats) {
      // Un buffet n'a pas besoin d'un couloir sur ses quatre côtés : son accès
      // frontal et les chemins réels de 110 cm restent vérifiés ci-dessous.
      if(etat.plan.zones.some(q=>intersectionZones(q,c.zone,rangement?.04:1.1)>.001))continue;
      const essai={...etat.plan,zones:[...etat.plan.zones,{...c.zone,staging:true}]};
      const audit=verifierPlanZones(modele,[...items,...etat.items,...c.items],catalogue,essai);
      if(!audit.valide)continue;
      suites.push({items:[...etat.items,...c.items],plan:{...essai,audit,circulation:audit.circulation,chemins:audit.circulation.chemins},manquants:etat.manquants,score:etat.score+c.score});
    }
    if(!suites.length){etats=etats.map(e=>({...e,manquants:[...e.manquants,{zone:z.id,motif:'surface-ou-acces'}]}));continue;}
    const divers=new Map();for(const e of suites.sort((a,b)=>b.score-a.score)){const q=e.plan.zones.at(-1),key=`${Math.floor(q.x0)}:${Math.floor(q.z0)}:${r(q.rot)}`;if(!divers.has(key))divers.set(key,e);}
    etats=[...divers.values()].slice(0,24);
  }
  const meilleur=etats.sort((a,b)=>a.manquants.length-b.manquants.length||b.score-a.score)[0];
  if(programme.encyclopedie){
   const bar=meilleur.plan.zones.find(z=>z.id==='bar'),tous=[...items,...meilleur.items];
   if(bar){
    const p=propDe('enc-bar-cart',style),positions=[];
    for(const rot of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const x of [bar.x0-p.dim[0]/2-.15,bar.x1+p.dim[0]/2+.15,(bar.x0+bar.x1)/2])for(const z of [bar.z0-p.dim[1]/2-.15,bar.z1+p.dim[1]/2+.15,(bar.z0+bar.z1)/2])positions.push({x,z,rot});
    for(const position of positions){
     const it=prop('stage-bar-cart','enc-bar-cart',style,{...position,zoneId:'bar',usageProgramme:'bar-cart',dispositionSource:'3.9',dispositionUid:'SL:3.9'}),b=boite(it,p.dim);
     const dos=local(it,0,-p.dim[1]/2);if(Math.min(...segmentsDe(modele).map(pan=>distanceSegment([dos.x,dos.z],pan.a,pan.b)))>.18)continue;
     const zone={...bar,x0:Math.min(bar.x0,b.x0),x1:Math.max(bar.x1,b.x1),z0:Math.min(bar.z0,b.z0),z1:Math.max(bar.z1,b.z1),meubles:[...bar.meubles,it.id],dispositionsComplementaires:['SL:3.9']},planEssai={...meilleur.plan,zones:meilleur.plan.zones.map(q=>q.id==='bar'?zone:q)};
     const audit=verifierPlanZones(modele,[...tous,it],catalogue,planEssai);if(!audit.valide)continue;
     meilleur.items.push(it);meilleur.plan={...planEssai,audit,chemins:audit.circulation.chemins};break;
    }
   }
  }
  return {items:meilleur.items,plan:meilleur.plan,manquants:meilleur.manquants};
}

function fenetres(modele) {
  return segmentsDe(modele).flatMap(pan=>(modele.murs?.[pan.id]?.ouvertures||[]).filter(o=>['fenetre','baie'].includes(o.type)).map(o=>{
    const q=pointOuverture(pan,o.position);return{x:q[0],z:q[1]};
  }));
}
function hoteUsage(e) {
  const u=e.it.usageProgramme;
  if(u)return u;
  if(e.p.fam==='table')return e.p.dim[2]<.59?'table-basse':'table-repas';
  return e.p.fam;
}
function ajouterSur(h,type,style,liste,position,surface='plateau',dim) {
  const p=propDe(type,style,dim),[x,y,z]=position;
  const it=prop(`stage-${h.it.id}-${surface}-${liste.filter(q=>q.attach_to?.id===h.it.id&&q.surface===surface).length}`,type,style,
    {zoneId:h.it.zoneId,kind:'surface_item',attach_to:{type:'furniture',id:h.it.id},local:[r(x),r(y),r(z)],hoteDim:[...h.p.dim],...(h.it.kind==='wall_item'?{ancreY:h.it.y}:{}),localRot:0,surface,p});
  liste.push(it);return it;
}
function surfaceVivante(modele,h,types,style,liste,es,surface='plateau',y=h.p.dim[2]) {
  const [w,d]=h.p.dim, occupes=es.filter(e=>e.it.id!==h.it.id&&e.it.kind==='surface_item'&&e.it.attach_to?.id===h.it.id);
  if(h.it.usageProgramme==='ilot-cuisine')for(const [x,z,l,pr]of [[w*.25,-d*.16,w*.23,d*.4],[-w*.25,-d*.1,w*.18,d*.38]])
    occupes.push({it:{...local(h.it,x,z),rot:h.it.rot||0},p:{fam:'deco',dim:[l,pr,.01]}});
  const largeur=Math.min(w,1.3), profondeur=Math.min(d,.8);
  for(const type of types) {
    if(type.startsWith('plante-')&&!fenetres(modele).some(f=>Math.hypot(f.x-h.it.x,f.z-h.it.z)<3.5))continue;
    const p=propDe(type,style), marge=.02;
    if(p.dim[0]>w-marge*2||p.dim[1]>d-marge*2)continue;
    const candidates=[[-.30,0],[.30,0],[0,-.2],[0,.2],[-.3,-.2],[.3,.2],[0,0],[-(w-p.dim[0])/2+.02,0],[(w-p.dim[0])/2-.02,0]].map((q,i)=>i<7?[q[0]*largeur,q[1]*profondeur]:q);
    const deja=posesStaging(es.map(e=>e.it),{items:liste}).filter(it=>it.attach_to?.id===h.it.id&&it.surface===surface);
    for(const [x,z]of candidates) {
      if(Math.abs(x)+p.dim[0]/2>w/2-marge||Math.abs(z)+p.dim[1]/2>d/2-marge)continue;
      const pose={...local(h.it,x,z),rot:h.it.rot||0};
      if(occupes.some(e=>chevaucheVolumes(empreinteVolume(pose,p),empreinteVolume(e.it,e.p),-.012)))continue;
      if(deja.some(it=>chevaucheVolumes(empreinteVolume(pose,p),empreinteVolume(it,it.p),-.012)))continue;
      ajouterSur(h,type,style,liste,[x,y,z],surface);break;
    }
  }
}

function murTravaille(modele,es,style,liste,plan,encyclopedie=false) {
  const utilise=new Set();
  for(const zone of plan?.zones||[]) {
    if(utilise.size>=2 || !['salon','repas',...(encyclopedie?['bar']:[])].includes(zone.id))continue;
    const h=es.find(e=>e.it.zoneId===zone.id&&['canape','table-repas',...(encyclopedie?['comptoir-bar']:[])].includes(hoteUsage(e)));if(!h)continue;
    const dos=local(h.it,0,-h.p.dim[1]/2);
    const pans=segmentsDe(modele).sort((a,b)=>distanceSegment([dos.x,dos.z],a.a,a.b)-distanceSegment([dos.x,dos.z],b.a,b.b));
    let meilleur=null;
    for(const pan of pans) {
      if(modele.murs?.[pan.id]?.observe===false || utilise.has(pan.id))continue;
      if(distanceSegment([h.it.x,h.it.z],pan.a,pan.b)>2.5)continue;
      const trous=(modele.murs?.[pan.id]?.ouvertures||[]).map(o=>[o.position*pan.signePosition-o.largeur/2-.08,o.position*pan.signePosition+o.largeur/2+.08]).sort((a,b)=>a[0]-b[0]);
      let debut=-pan.long/2+.06;const libres=[];
      for(const [a,b]of trous){if(a>debut)libres.push([debut,a]);debut=Math.max(debut,b);}if(debut<pan.long/2-.06)libres.push([debut,pan.long/2-.06]);
      const proj=(h.it.x-pan.centre[0])*pan.d[0]+(h.it.z-pan.centre[1])*pan.d[1];
      for(const [a,b]of libres) {
        const w=Math.min(b-a,Math.max(1.4,h.p.dim[0]*1.35),3.2);if(w<1.1)continue;
        const u=Math.max(a+w/2,Math.min(b-w/2,proj)),q=pointOuverture(pan,u*pan.signePosition);
        const score=Math.hypot(q[0]-dos.x,q[1]-dos.z)+Math.abs(u-proj);
        if(!meilleur||score<meilleur.score)meilleur={pan,q,w,u,score};
      }
    }
    if(!meilleur)continue;
    const {pan,q,w,u}=meilleur,hauteur=Math.min(2.3,modele.dims.hauteur-.12);
    // Un mur végétal n'est choisi qu'à proximité d'une fenêtre et hors zone TV.
    const signatureVegetale=encyclopedie&&zone.id==='bar'&&['chaleureux','boheme','japandi','mediterraneen'].includes(style)&&w>=1.5;
    const vegetal=signatureVegetale||style==='boheme'&&zone.id==='repas'&&fenetres(modele).some(f=>Math.hypot(f.x-q[0],f.z-q[1])<3);
    const type=vegetal?'mur-vegetal':RECETTES_STAGING.salon[style].mur;
    liste.push(prop(`stage-mur-${zone.id}`,type,style,{zoneId:zone.id,kind:'wall_item',mur:pan.id,attach_to:{type:'wall',id:pan.id},
      x:r(q[0]),z:r(q[1]),rot:Math.atan2(pan.n[0],pan.n[1]),y:r(.06+hauteur/2),baseY:.06,wall_offset:r(u+pan.long/2),ancreMur:h.it.id,
      derriereHote:pan.n[0]*Math.sin(h.it.rot||0)+pan.n[1]*Math.cos(h.it.rot||0)>.8,p:propDe(type,style,[r(w),PROPS[type].dim[1],r(hauteur)]),
      ...(signatureVegetale?{dispositionUid:'SL:8.15.4',dispositionSource:'8.15.4',signatureSource:'SL:signature:vegetal',vegetalStabilise:true}: {})}));
    utilise.add(pan.id);
  }
}

function traiterAngles(modele,es,plan,style,liste) {
  const fs=fenetres(modele);
  for(const zone of plan?.zones||[]) {
    if(!['salon','repas','travail','lecture','cuisine','bar','couchage','accueil','detente'].includes(zone.type))continue;
    if(es.some(e=>e.it.zoneId===zone.id&&e.p.fam==='lampadaire'))continue;
    let pose=null;
    for(const plante of [true,false]) {
      const type=plante?'plante-haute':'lampadaire-decor',p=propDe(type,style),coins=[0,.35,.6].flatMap(m=>[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sz])=>({x:sx<0?zone.x0+p.dim[0]/2+.015-m:zone.x1-p.dim[0]/2-.015+m,z:sz<0?zone.z0+p.dim[1]/2+.015-m:zone.z1-p.dim[1]/2-.015+m})));
      coins.sort((a,b)=>Math.min(...fs.map(f=>Math.hypot(f.x-a.x,f.z-a.z)))-Math.min(...fs.map(f=>Math.hypot(f.x-b.x,f.z-b.z))));
      for(const qof of coins) {
        const q={...qof,rot:0},b=boite(q,p.dim);
        if(plante&&!fs.some(f=>Math.hypot(f.x-q.x,f.z-q.z)<3.5))continue;
        if(!contientBoite(modele,b)||zonesPortes(modele).some(o=>intersectionZones(o,b)>.001))continue;
        if(sols(es).some(e=>intersectionZones(b,e.b,.02)>.001||degagementsProgramme(e).some(d=>intersectionZones(b,d)>.001)))continue;
        const agrandie={...zone,x0:Math.min(zone.x0,b.x0),x1:Math.max(zone.x1,b.x1),z0:Math.min(zone.z0,b.z0),z1:Math.max(zone.z1,b.z1)};
        const essai={...plan,zones:plan.zones.map(z=>z.id===zone.id?agrandie:z)};
        const candidat=prop(`stage-angle-${zone.id}`,type,style,{...q,zoneId:zone.id});
        if(!verifierPlanZones(modele,[...es.map(e=>e.it),candidat],Object.fromEntries(es.filter(e=>e.it.sku).map(e=>[e.it.sku,e.p])),essai).valide)continue;
        Object.assign(zone,agrandie);pose=candidat;break;
      }
      if(pose)break;
    }
    if(pose){liste.push(pose);es.push({it:pose,p:pose.p,role:pose.p.fam,b:boite(pose,pose.p.dim)});}
  }
}

export function composerStaging({modele,items,catalogue,programme,plan,envies='',preferences,architecture=[],actif=true}) {
  if(!stagingActif(actif))return null;
  const style=styleStaging(envies,preferences),recette=RECETTES_STAGING[programme?.fonction]?.[style];if(!recette)return null;
  const es=entrees([...items,...architecture],catalogue),liste=[...architecture];
  const compact=(programme?.surface||0)<=14,maximum=compact?2:recette.maxSurface;
  for(const h of es) {
    const u=hoteUsage(h),fam=h.p.fam;
    if(['table-basse','table-appoint','chevet'].includes(u))
      surfaceVivante(modele,h,(compact?['livres','vase']:['plateau','livres','vase','bougie']).slice(0,maximum),style,liste,es);
    else if(['buffet','console','console-dos','vaisselier'].includes(u))surfaceVivante(modele,h,(u==='console-dos'?['plateau','enc-carafe','livres']:['vase-haut','livres','plante-moyenne','sculpture']).slice(0,maximum),style,liste,es);
    else if(u==='bureau')surfaceVivante(modele,h,['ordinateur','carnet','plante-petite'].slice(0,maximum),style,liste,es);
    else if(u==='table-repas')surfaceVivante(modele,h,['bol-fruits','vase'],style,liste,es);
    else if(u==='ilot-cuisine')surfaceVivante(modele,h,['planche','bouilloire',programme?.encyclopedie?'enc-bol-citrons':'bol-fruits'].slice(0,maximum),style,liste,es);
    else if(u==='comptoir-bar')surfaceVivante(modele,h,['plateau',programme?.encyclopedie?'enc-carafe':'bouteilles','verres'].slice(0,maximum),style,liste,es);
    else if(u==='bar-cart')surfaceVivante(modele,h,['enc-carafe','verres'],style,liste,es,'plateau',h.p.surfaces?.at(-1)?.hauteur??h.p.dim[2]);
    else if(u==='vasque')surfaceVivante(modele,h,['serviettes','bougie'],style,liste,es);
    else if(['etagere','etagere-murale','bibliotheque'].includes(u)||['etagere','bibliotheque'].includes(fam)) {
      const niveaux=fam==='etagere-murale'?1:compact?2:3;
      for(let n=0;n<niveaux;n++)surfaceVivante(modele,h,['livres-debout',n%2?'vase-haut':'sculpture'],style,liste,es,`niveau-${n}`,h.p.surfaces?.[n]?.hauteur??(fam==='etagere-murale'?(h.it.y||1.65)-h.p.dim[2]/2+.026:.06+n*(h.p.dim[2]-.3)/niveaux));
    }
    if(['canape','fauteuil','lit','salon-jardin'].includes(fam)) {
      const places=compact?1:Math.min(3,Math.max(1,Math.floor(h.p.dim[0]/.6))),assise=fam==='lit'?h.p.dim[2]*.65:h.p.dim[2]*.53;
      for(let i=0;i<places;i++)ajouterSur(h,'coussin',style,liste,[(i-(places-1)/2)*Math.min(.55,h.p.dim[0]/places),assise,-h.p.dim[1]*.23],'assise');
      if(!compact && style!=='epure')ajouterSur(h,'plaid',style,liste,[h.p.dim[0]/2-.18,Math.min(h.p.dim[2]-.05,assise+.17),h.p.dim[1]*.03],'accoudoir');
    }
  }
  // Écran non vendu de secours : jamais posé au sol, jamais ajouté au panier.
  const slotTV=programme?.zones.flatMap(z=>z.slots).find(s=>s.usage==='television');
  if((slotTV||programme?.focal?.usage==='television')&&!es.some(e=>['tv','tv-murale'].includes(e.p.fam))) {
    const h=es.find(e=>hoteUsage(e)==='meuble-tv');
    const slot=slotTV;
    if(slot?.pose==='mur') {
      const detail=prop('stage-television-murale','television-murale',style,{zoneId:slot.zone,slotProgramme:slot.id,usageProgramme:'television'});
      const tv=completerHauteurs(modele,items,[detail],catalogue,{programme}).items.find(it=>it.id===detail.id);
      if(tv)liste.push({...tv,baseY:tv.y-tv.p.dim[2]/2});
    } else if(h && h.p.dim[0]>=.75 && h.p.dim[1]>=.2) {
      let trouve=false;
      for(const w of [...new Set([Math.min(1.24,h.p.dim[0]-.04),Math.min(.97,h.p.dim[0]-.04),.73])]) {
        const d=Math.min(.2,h.p.dim[1]-.04),p=propDe('television',style,[w,d,w*.62]);
        for(const x of [0,(h.p.dim[0]-w)/2-.02,-(h.p.dim[0]-w)/2+.02]) {
          const pose={...local(h.it,x,0),rot:h.it.rot||0};
          if(es.some(e=>e.it.attach_to?.id===h.it.id&&chevaucheVolumes(empreinteVolume(pose,p),empreinteVolume(e.it,e.p),-.005)))continue;
          const tv=ajouterSur(h,'television',style,liste,[x,h.p.dim[2],0],'ecran',p.dim);tv.usageProgramme='television';trouve=true;break;
        }
        if(trouve)break;
      }
    }
  }
  for(const h of es.filter(e=>['ilot-cuisine','comptoir-bar'].includes(e.it.usageProgramme))) {
    const bas=programme?.encyclopedie?h.p.dim[2]+.9:Math.max(h.p.dim[2]+.75,2.1),p=PROPS['suspension-decor'];
    if(bas+p.dim[2]<modele.dims.hauteur-.08) {
      const it=ajouterSur(h,'suspension-decor',style,liste,[0,bas,0],'lumiere');it.kind='ceiling_item';
    }
  }
  if(!compact){murTravaille(modele,es,style,liste,plan,!!programme?.encyclopedie);if(!programme?.encyclopedie?.profil?.pmr)traiterAngles(modele,es,plan,style,liste);}
  if(programme?.encyclopedie){
   const mots={coussin:/coussin/i,plaid:/plaid/i,plateau:/plateau/i,livres:/livre/i,'livres-debout':/livre/i,vase:/vase/i,'vase-haut':/vase/i,bougie:/bougi/i,'enc-carafe':/carafe/i,'enc-bol-citrons':/citron/i,verres:/verre|verrerie/i,carnet:/carnet/i,ordinateur:/ordinateur|écran/i};
   for(const it of liste){const pieces=new Set(programme.zones.find(z=>z.id===it.zoneId)?.encyclopedie?.zones.map(uid=>uid.split(':')[0])||[]),mot=mots[it.prop];const src=mot&&BASE.props.find(p=>pieces.has(p.piece)&&mot.test(p.nom));if(src){it.sourceEncyclopedie=src.uid;it.venteSource=src.venteSource;}}
  }
  const staging={version:'staging-1',vendu:false,style,items:liste,...(programme?.encyclopedie?{encyclopedie:{recettes:programme.zones.map(z=>({zone:z.id,sources:z.encyclopedie?.zones,props:liste.filter(it=>it.zoneId===z.id&&it.sourceEncyclopedie).map(it=>it.sourceEncyclopedie)})),signatureSuggestions:programme.encyclopedie.signatureMoments,signatureMoments:[...es.filter(e=>e.p.signatureSource).map(e=>({uid:e.p.signatureSource,hote:e.it.id,realisation:'plateau-pierre-angles-arrondis'})),...liste.filter(it=>it.signatureSource).map(it=>({uid:it.signatureSource,hote:it.id,realisation:'mur-vegetal-stabilise'}))]}}:{})};
  staging.diagnostic=evaluerStaging(modele,items,catalogue,staging,plan);
  return staging;
}

export function evaluerStaging(modele,items,catalogue,staging,plan) {
  const props=posesStaging(items,staging,catalogue),es=entrees(items,catalogue),regles=[],audit=[],ajouter=(id,points,ids=[])=>regles.push({id,points,ids});
  const fs=fenetres(modele), surfaces=new Map();
  for(const it of props.filter(it=>it.kind==='surface_item')) {
    const key=it.attach_to.id+':'+it.surface;const qs=surfaces.get(key)||[];qs.push(it);surfaces.set(key,qs);
  }
  for(const qs of surfaces.values()) {
    if(qs.length>4)ajouter('surface-surcharge',POIDS_STAGING.surcharge,qs.map(it=>it.id));
    if(qs.length>=2&&Math.max(...qs.map(it=>it.p.dim[2]))-Math.min(...qs.map(it=>it.p.dim[2]))<.025)ajouter('hauteurs-monotones',POIDS_STAGING.monotone,qs.map(it=>it.id));
  }
  for(const h of es.filter(e=>['table-basse','buffet','console','etagere','etagere-murale'].includes(hoteUsage(e))))
    if(!props.some(it=>it.attach_to?.id===h.it.id)){ajouter(hoteUsage(h)==='table-basse'?'table-basse-vide':'hote-vide',POIDS_STAGING.tableVide,[h.it.id]);audit.push({type:'hote-vide',ids:[h.it.id]});}
  for(const z of plan?.zones||[]) {
    if(['rangement','bain','vasque'].includes(z.type))continue;
    if([...surfaces.values()].some(qs=>qs.length>=2&&qs[0].zoneId===z.id))ajouter('zone-habitee',POIDS_STAGING.hoteVivant,[z.id]);
    const angles=props.some(it=>it.zoneId===z.id&&['plante-haute','lampadaire-decor'].includes(it.prop))||es.some(e=>e.it.zoneId===z.id&&e.p.fam==='lampadaire');
    if(!angles)ajouter('angle-nu',POIDS_STAGING.angleNu,[z.id]);
    const murs=props.filter(it=>it.zoneId===z.id&&it.kind==='wall_item');
    if(murs.length){ajouter('feature-wall',POIDS_STAGING.murZone,murs.map(it=>it.id));if(murs.every(it=>it.p.style===staging.style&&it.p.styles.includes(staging.style)))ajouter('mur-style',POIDS_STAGING.style,murs.map(it=>it.id));}
    if(murs.some(it=>it.prop==='lattes'&&it.derriereHote)&&['salon','repas'].includes(z.type))ajouter('lattes-coherentes',POIDS_STAGING.lattes,murs.map(it=>it.id));
    if(murs.length>1)ajouter('murs-multiples',POIDS_STAGING.mursMultiples,murs.map(it=>it.id));
  }
  for(const it of props) {
    if(it.prop.startsWith('plante-')&&!fs.some(f=>Math.hypot(f.x-it.x,f.z-it.z)<3.5))ajouter('plante-sombre',POIDS_STAGING.planteSombre,[it.id]);
    if(it.kind==='wall_item') {
      const pan=segmentsDe(modele).find(p=>p.id===it.mur);if(!pan){audit.push({type:'mur-absent',ids:[it.id]});continue;}
      const u=(it.x-pan.centre[0])*pan.d[0]+(it.z-pan.centre[1])*pan.d[1];
      if(Math.abs(u)+it.p.dim[0]/2>pan.long/2+.01)audit.push({type:'mur-limites',ids:[it.id]});
      for(const o of modele.murs?.[pan.id]?.ouvertures||[])if(Math.min(u+it.p.dim[0]/2,o.position*pan.signePosition+o.largeur/2)-Math.max(u-it.p.dim[0]/2,o.position*pan.signePosition-o.largeur/2)>0){ajouter('mur-ouverture',POIDS_STAGING.ouverture,[it.id]);audit.push({type:'mur-ouverture',ids:[it.id]});}
      if(it.prop==='mur-vegetal'&&[...es,...props.map(q=>({it:q,p:q.p}))].some(e=>['tv','tv-murale'].includes(e.p.fam)&&e.it.zoneId===it.zoneId)){ajouter('vegetal-tv',POIDS_STAGING.vegetalTV,[it.id]);audit.push({type:'vegetal-tv',ids:[it.id]});}
    } else if(it.kind==='surface_item'&&it.surface!=='assise'&&it.surface!=='accoudoir') {
      const h=[...items,...props].find(q=>q.id===it.attach_to?.id),hp=h&&produitDe(h,catalogue);if(!h||!hp){audit.push({type:'support-absent',ids:[it.id]});continue;}
      const [x,,z]=it.local;
      if(Math.abs(x)+it.p.dim[0]/2>hp.dim[0]/2+.005||Math.abs(z)+it.p.dim[1]/2>hp.dim[1]/2+.005)audit.push({type:'support-limites',ids:[it.id]});
      for(const e of [...es,...props.map(q=>({it:q,p:q.p}))].filter(e=>e.it.id!==it.id&&['tv','tv-murale','tableau'].includes(e.p.fam))) {
        const v=intervalleHauteur(e.it,e.p,modele,es);
        if(it.baseY+it.p.dim[2]>v.bas+.015&&it.baseY<v.haut-.015&&chevaucheVolumes(empreinteVolume(it,it.p),empreinteVolume(e.it,e.p))){ajouter('focal-masque',POIDS_STAGING.masque,[it.id,e.it.id]);audit.push({type:'focal-masque',ids:[it.id,e.it.id]});}
      }
    }
  }
  const floor=props.filter(it=>!['surface_item','wall_item','ceiling_item'].includes(it.kind));
  if(plan?.zones?.length) {
    const a=verifierPlanZones(modele,[...items,...floor],catalogue,plan);
    if(!a.valide)audit.push(...a.problemes.map(type=>({type,ids:[]})));
  }
  return {score:regles.reduce((s,q)=>s+q.points,0),regles,audit,surfaces:[...surfaces].map(([id,qs])=>({id,nombre:qs.length})),nombre:props.length,horsBudget:true};
}
