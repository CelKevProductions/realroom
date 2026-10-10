// DXF ASCII : géométrie métrique, sans IA et sans chargement de liens externes.
// R12 POLYLINE/VERTEX et LWPOLYLINE linéaires ; une pièce est un contour fermé.
import { VERSION_SCAN, depuisScan, ErreurScan } from './scan.js';
import { aireSignee, distanceSegment, contientPoint, segmentsDe, pointOuverture } from './contour.js';

export const APP_LAGARSOFT = 'https://apps.apple.com/app/id6779339424';
const echec = code => { throw new ErreurScan(code); };
const nombre = s => { if(s==null||String(s).trim()==='')echec('plan-format');const n=Number(s); if(!Number.isFinite(n))echec('plan-format'); return n; };
const premier = (e,k,def='') => e.p.find(p=>p[0]===k)?.[1] ?? def;
const point = (e,x=10,y=20) => [nombre(premier(e,x,null)),nombre(premier(e,y,null))];
const couche = e => premier(e,8).toUpperCase();
const unites = {m:1,cm:.01,mm:.001,ft:.3048,in:.0254};
const INSUNITS = {1:'in',2:'ft',4:'mm',5:'cm',6:'m'};

function groupes(texte) {
  if(typeof texte!=='string'||texte.length>5e6||texte.startsWith('AutoCAD Binary DXF'))echec('plan-format');
  const lignes=texte.replace(/^\uFEFF/,'').replace(/\r/g,'').trimEnd().split('\n');
  if(lignes.length%2)echec('plan-format');
  const ps=[];
  for(let i=0;i<lignes.length;i+=2){if(!/^\s*\d+\s*$/.test(lignes[i]))echec('plan-format');ps.push([Number(lignes[i]),lignes[i+1].trim()]);}
  if(!ps.some(p=>p[0]===0&&p[1]==='EOF'))echec('plan-format');
  return ps;
}
function entites(ps) {
  const resultat=[];let dans=false,e=null;
  for(let i=0;i<ps.length;i++){
    const [k,v]=ps[i];
    if(k===0&&v==='SECTION'){dans=ps[i+1]?.[1]==='ENTITIES';e=null;continue;}
    if(k===0&&v==='ENDSEC'){dans=false;e=null;continue;}
    if(!dans)continue;
    if(k===0){e={type:v,p:[]};resultat.push(e);if(resultat.length>20000)echec('trop-gros');}
    else e?.p.push([k,v]);
  }
  return resultat;
}
function polygones(es) {
  const res=[];
  for(let i=0;i<es.length;i++){
    const e=es[i];if(!['POLYLINE','LWPOLYLINE'].includes(e.type))continue;
    if(!(nombre(premier(e,70,'0'))&1))continue;
    let points=[];
    if(e.type==='POLYLINE'){
      while(es[i+1]?.type==='VERTEX'){const v=es[++i];if(Math.abs(nombre(premier(v,42,'0')))>1e-9)echec('plan-courbe');points.push(point(v));}
    }else{
      let x=null;
      for(const [k,v]of e.p){if(k===42&&Math.abs(nombre(v))>1e-9)echec('plan-courbe');if(k===10)x=nombre(v);if(k===20){if(x===null)echec('plan-format');points.push([x,nombre(v)]);x=null;}}
      if(x!==null||nombre(premier(e,90,String(points.length)))!==points.length)echec('plan-format');
    }
    if(points.length>1&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7)points.pop();
    if(points.length>=3)res.push({points,couche:couche(e)});
  }
  return res;
}
function bouclesMurs(es,facteur){
  const restants=es.filter(e=>e.type==='LINE'&&/^(WALLS?|MURS?)$/.test(couche(e))).map(e=>[point(e),point(e,11,21)]);
  if(restants.length>256)echec('plan-contour');
  const res=[];
  while(restants.length){
    const s=restants.shift(),ps=[...s];let ferme=false;
    for(let n=0;n<256;n++){
      if(Math.hypot(ps[0][0]-ps.at(-1)[0],ps[0][1]-ps.at(-1)[1])*facteur<.025){ps.pop();ferme=true;break;}
      const candidats=[];
      restants.forEach((r,i)=>r.forEach((p,j)=>{if(Math.hypot(p[0]-ps.at(-1)[0],p[1]-ps.at(-1)[1])*facteur<.025)candidats.push({i,j});}));
      if(candidats.length!==1)break;
      const {i,j}=candidats[0],r=restants.splice(i,1)[0];ps.push(r[1-j]);
    }
    if(ferme&&ps.length>=3)res.push({points:ps,couche:'WALLS'});
  }
  return res;
}

// Renvoie des pièces séparées : l'utilisateur en choisit une, jamais une boîte autour de la maison.
export function lireDXF(texte, uniteChoisie=null) {
  const ps=groupes(texte),es=entites(ps);
  let unite=null;
  const ui=ps.findIndex(p=>p[0]===9&&p[1]==='$INSUNITS');
  if(ui>=0)unite=INSUNITS[Number(ps[ui+1]?.[1])]||null;
  if(!unite&&ps.some(([k,v])=>k===999&&/Units:\s*met(?:re|er)s\b/i.test(v)))unite='m';
  if(uniteChoisie){if(!Object.hasOwn(unites,uniteChoisie))echec('plan-unites');unite=uniteChoisie;}
  if(!unite)return {unites:null,pieces:[]};
  const f=unites[unite];let polys=polygones(es);
  const sols=polys.filter(p=>/^(FLOOR|FLOORS|SOL|ROOMS?|PIECES?)$/.test(p.couche));
  polys=sols.length?sols:polys.filter(p=>!/(NORTH|DIMS|DIMENSION|ANNOT|FURNITURE|MEUBLE)/.test(p.couche));
  if(!polys.length)polys=bouclesMurs(es,f);
  if(!polys.length||polys.length>40)echec('plan-contour');
  const ouvertures=es.filter(e=>e.type==='LINE'&&/^(DOORS?|PORTES?|WINDOWS?|FENETRES?)$/.test(couche(e))).map(e=>({type:/DOOR|PORTE/.test(couche(e))?'porte':'fenetre',a:point(e).map(v=>v*f),b:point(e,11,21).map(v=>v*f)}));
  const textes=es.filter(e=>e.type==='TEXT').map(e=>({p:point(e).map(v=>v*f),nom:premier(e,1).slice(0,60)}));
  const pieces=polys.map((p,i)=>{
    const points=p.points.map(q=>q.map(v=>v*f));
    const scan={version:VERSION_SCAN,source:'plan-dxf',unit:'m',floorCorners:points.map(([x,z])=>[x,0,z]),ceilingHeight:null,openings:ouvertures.filter(o=>points.some((a,j)=>distanceSegment(o.a,a,points[(j+1)%points.length])<.08&&distanceSegment(o.b,a,points[(j+1)%points.length])<.08))};
    const r=depuisScan(scan); // même validation côté client et serveur
    const labels=textes.filter(t=>!/(north|nord|m²|m2|\d.*m\b)/i.test(t.nom)&&contientPoint({contour:points,dims:r.modele.dims},...t.p));
    return {id:String(i),nom:labels[0]?.nom||`Pièce ${i+1}`,surface:Math.round(Math.abs(aireSignee(points))*100)/100,scan,...r};
  });
  return {unites:unite,pieces};
}

export function exporterDXF(scan){
  const {modele}=depuisScan(scan),ps=modele.contour||[[-modele.dims.largeur/2,-modele.dims.profondeur/2],[modele.dims.largeur/2,-modele.dims.profondeur/2],[modele.dims.largeur/2,modele.dims.profondeur/2],[-modele.dims.largeur/2,modele.dims.profondeur/2]];
  const g=[999,'Generated by RealRoom. Units: metres.',0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1009',0,'ENDSEC',0,'SECTION',2,'ENTITIES',0,'POLYLINE',8,'FLOOR',66,1,70,1];
  for(const [x,z]of ps)g.push(0,'VERTEX',8,'FLOOR',10,x,20,z,30,0);
  g.push(0,'SEQEND');
  for(const pan of segmentsDe(modele))for(const o of modele.murs[pan.id]?.ouvertures||[]){const [x,z]=pointOuverture(pan,o.position),k=o.largeur/2;g.push(0,'LINE',8,o.type==='fenetre'?'WINDOWS':'DOORS',10,x-pan.d[0]*k,20,z-pan.d[1]*k,30,0,11,x+pan.d[0]*k,21,z+pan.d[1]*k,31,0);}
  g.push(0,'ENDSEC',0,'EOF');return g.join('\n')+'\n';
}
