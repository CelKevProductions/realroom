// Repères statistiques compacts ; aucune scène, aucun mesh, aucun SKU externe au catalogue.
import PROFILS from '../data/ameublement/profils.json' with { type: 'json' };
import { roleFonctionDe } from './roles.js';
import { usageDe } from './usages.js';
import { produitDe } from './agencement.js';
import { aireSignee, contourDe, segmentsDe, distanceSegment } from './contour.js';

const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const rond = x => Math.round(x*1000)/1000;
const fonctions = new Set(['chambre','salon','bureau','salle_a_manger']);
export const VERSION_REFERENCES = PROFILS.version;
export function referencesSpatialesActives(choix) {
  if (choix === false) return false;
  if (typeof process !== 'undefined' && (process.env.REALROOM_REFERENCES_SPATIALES === '0' || process.env.NEXT_PUBLIC_REALROOM_REFERENCES_SPATIALES === '0')) return false;
  if (typeof window !== 'undefined') { try { if (localStorage.getItem('rr-references-spatiales') === '0') return false; } catch (_) {} }
  return true;
}
const surfaceDe = m => m?.dims ? Math.abs(aireSignee(contourDe(m))) : 0;
const valides = p => p?.dim?.length === 3 && p.dim.every(v => Number.isFinite(v) && v > 0);
export function roleReference(p, usage) {
  const roles = { 'table-repas':'table-repas', 'table-basse':'table-basse', chevet:'chevet', 'table-appoint':'table-appoint', bureau:'bureau', armoire:'armoire', 'meuble-tv':'meuble-tv', buffet:'rangement', 'fauteuil-salon':'fauteuil', 'fauteuil-lecture':'fauteuil', 'chaise-repas':'chaise', 'chaise-bureau':'chaise' };
  if (roles[usage]) return roles[usage];
  if (usageDe(p) === 'chevet') return 'chevet';
  if (usageDe(p) === 'travail') return 'bureau';
  if (usageDe(p) === 'vetements') return 'armoire';
  const r = roleFonctionDe({},p);
  return r === 'repas' ? 'table-repas' : r === 'appoint' ? 'table-appoint' : r;
}
function dimensions(fonction,role,surface) {
  if (!fonctions.has(fonction) || !Number.isFinite(surface) || surface <= 0) return null;
  const palier = PROFILS.bornesSurface.findIndex(b => b == null || surface <= b);
  return PROFILS.dimensions[`${fonction}:${palier}:${role}`] || PROFILS.dimensions[`${fonction}:${role}`] || null;
}
function distanceTaille(v,q) {
  return Math.min(2,Math.abs(Math.log(v/q.q50))/Math.max(.25,Math.log(q.q90/q.q10)));
}
export function scoreProduitReference(p,{modele,surface,fonction,usage,actif,ancre} = {}) {
  if (!referencesSpatialesActives(actif) || !valides(p)) return 0;
  const role = roleReference(p,usage), aire = surface ?? surfaceDe(modele);
  // Le nombre de convives et les petits espaces priment sur une moyenne du dataset.
  // Ses tables de grands séjours ne doivent pas agrandir un repas pour quatre personnes.
  if (aire < 14 || ['table-repas','chaise','meuble-tv'].includes(role)) return 0;
  if (role === 'bureau' && fonction !== 'bureau') return 0; // Un coin travail ne prend pas les proportions d'un bureau entier.
  const profil = dimensions(fonction,role,aire);
  let score = profil ? 2 - 2*(.65*distanceTaille(p.dim[0],profil.w)+.35*distanceTaille(p.dim[1],profil.d)) : 0;
  // Les dimensions d'une table/chevet se jugent aussi avec le meuble qui sera réellement choisi.
  const cle = role === 'table-basse' ? 'table-canape-largeur' : role === 'chevet' ? 'chevet-largeur' : null;
  if (cle && valides(ancre)) { const q=PROFILS.relations[cle]; if(q)score += 1-Math.min(2,Math.abs(p.dim[0]/ancre.dim[0]-q.q50)/Math.max(.1,q.q90-q.q10)); }
  return rond(clamp(score,-3,3));
}
function local(a,b) {
  const angle=a.it.rot||0,dx=b.it.x-a.it.x,dz=b.it.z-a.it.z;
  return {x:dx*Math.cos(angle)-dz*Math.sin(angle),z:dx*Math.sin(angle)+dz*Math.cos(angle)};
}
function projection(a,b) {
  const r=(b.it.rot||0)-(a.it.rot||0),c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r));
  return {w:c*b.p.dim[0]+s*b.p.dim[1],d:s*b.p.dim[0]+c*b.p.dim[1]};
}
const memeZone = (a,b) => a.it.zoneId && b.it.zoneId ? a.it.zoneId === b.it.zoneId : !a.it.zoneId && !b.it.zoneId;
function donnees(items,catalogue) {
  return items.filter(it => it.garde !== false).map(it => ({it,p:produitDe(it,catalogue)})).filter(e => valides(e.p) && Number.isFinite(e.it.x) && Number.isFinite(e.it.z)).map(e => ({...e,role:roleReference(e.p,e.it.usageProgramme)}));
}
export function evaluerReferences(modele,items,catalogue,{actif} = {}) {
  if (!referencesSpatialesActives(actif)) return {actif:false,version:VERSION_REFERENCES,cout:0,note:null,mesures:[]};
  const es=donnees(items,catalogue),mesures=[];
  const ajouter=(cle,valeur,ids,poids=1) => {
    const q=PROFILS.relations[cle];if(!q||!Number.isFinite(valeur))return;
    const bas=['tete-lit-mur','table-canape-decentrage'].includes(cle)?0:q.q25,haut=cle==='chaise-repas-face'?1:q.q75;
    const ecart=Math.max(0,bas-valeur,valeur-haut)/Math.max(.08,q.q90-q.q10);
    mesures.push({relation:cle,valeur:rond(valeur),intervalle:[bas,haut],observations:q.n,ids,penalite:rond(Math.min(3,ecart)*poids)});
  };
  for(const e of es) {
    if(e.role==='lit') {
      const r=e.it.rot||0,tete=[e.it.x-Math.sin(r)*e.p.dim[1]/2,e.it.z-Math.cos(r)*e.p.dim[1]/2];
      const pans=segmentsDe(modele);if(pans.length)ajouter('tete-lit-mur',Math.min(...pans.map(p=>distanceSegment(tete,p.a,p.b))),[e.it.id]);
    }
    const cible=e.role==='chevet'?'lit':e.role==='table-basse'?'canape':e.role==='chaise'&&e.it.usageProgramme==='chaise-repas'?'table-repas':null;
    if(!cible)continue;
    const ancres=es.filter(a=>a.role===cible&&memeZone(a,e)).sort((a,b)=>Math.hypot(a.it.x-e.it.x,a.it.z-e.it.z)-Math.hypot(b.it.x-e.it.x,b.it.z-e.it.z));
    const a=ancres[0];if(!a)continue;
    const q=local(a,e),d=projection(a,e),ids=[a.it.id,e.it.id];
    if(cible==='lit') {
      ajouter('chevet-recul',q.z/a.p.dim[1],ids);ajouter('chevet-ecart',Math.abs(q.x)-a.p.dim[0]/2-d.w/2,ids);ajouter('chevet-largeur',d.w/a.p.dim[0],ids,.5);
    } else if(cible==='canape') {
      ajouter('table-canape-largeur',d.w/a.p.dim[0],ids);ajouter('table-canape-ecart',q.z-a.p.dim[1]/2-d.d/2,ids);ajouter('table-canape-decentrage',Math.abs(q.x)/a.p.dim[0],ids);
    } else {
      const dx=a.it.x-e.it.x,dz=a.it.z-e.it.z,r=e.it.rot||0;
      ajouter('chaise-repas-face',(dx*Math.sin(r)+dz*Math.cos(r))/Math.max(.01,Math.hypot(dx,dz)),ids);
    }
  }
  const penalite=mesures.reduce((s,m)=>s+m.penalite,0);
  return {actif:true,version:VERSION_REFERENCES,scenesCalibration:PROFILS.calibration.scenesRetenues,cout:rond(Math.min(450,penalite*35)),note:mesures.length?rond(100*Math.exp(-penalite/mesures.length)):null,mesures};
}

// Une graine supplémentaire soumise aux mêmes collisions, portes, zones et circulations que les autres.
export function ajusterGroupeReference(items,catalogue) {
  const es=donnees(items,catalogue),deplacements=new Map();
  const deplacer=(e,x,z) => {if(e&&!e.it.fixe){const r=e.it.rot||0;deplacements.set(e.it.id,{x,z,dx:x-e.it.x,dz:z-e.it.z,rot:r});}};
  for(const a of es.filter(e=>e.role==='lit'||e.role==='canape')) {
    const r=a.it.rot||0,c=Math.cos(r),s=Math.sin(r),versMonde=(x,z)=>({x:a.it.x+c*x+s*z,z:a.it.z-s*x+c*z});
    const appartient = e => es.filter(q=>q.role===a.role&&memeZone(q,e)).sort((q,t)=>Math.hypot(q.it.x-e.it.x,q.it.z-e.it.z)-Math.hypot(t.it.x-e.it.x,t.it.z-e.it.z))[0]===a;
    if(a.role==='lit')for(const e of es.filter(e=>e.role==='chevet'&&memeZone(a,e)&&appartient(e))) {
      const q=local(a,e),d=projection(a,e),gap=clamp(PROFILS.relations['chevet-ecart'].q50,.04,.15),recul=clamp(PROFILS.relations['chevet-recul'].q50*a.p.dim[1],-a.p.dim[1]/2+d.d/2+.02,-a.p.dim[1]*.15);
      const p=versMonde((q.x<0?-1:1)*(a.p.dim[0]/2+d.w/2+gap),recul);deplacer(e,p.x,p.z);
    }
    else {
      const e=es.filter(e=>e.role==='table-basse'&&memeZone(a,e)&&appartient(e)).sort((e,f)=>Math.hypot(e.it.x-a.it.x,e.it.z-a.it.z)-Math.hypot(f.it.x-a.it.x,f.it.z-a.it.z))[0];
      if(e){const d=projection(a,e),gap=clamp(PROFILS.relations['table-canape-ecart'].q50,.4,.5),p=versMonde(0,a.p.dim[1]/2+d.d/2+gap);deplacer(e,p.x,p.z);}
    }
  }
  return items.map(it => {
    const m=deplacements.get(it.id)||(!it.fixe&&it.attach_to?.type==='furniture'?deplacements.get(it.attach_to.id):null);
    if(!m)return {...it};
    return {...it,x:rond(it.x+m.dx),z:rond(it.z+m.dz)};
  });
}
