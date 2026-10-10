// Contrat métrique commun : RoomPlan natif et coins au sol relevés par WebXR/ARCore.
// Aucun appel vision, aucune URL chargée. Un scan n'est pas une mesure certifiée.
import { MURS, normaliserAngle } from './agencement.js';
import { validerContour, segmentsDe, distanceSegment, pointOuverture, contientPoint, pointInterieur } from './contour.js';

export const VERSION_SCAN = 'realroom-scan-v1';
export const MAX_SCAN_OCTETS = 200000;
export class ErreurScan extends Error {
  constructor(code) { super(code); this.code = code; }
}
const refuser = code => { throw new ErreurScan(code); };
const rond = v => Math.round(v * 100) / 100;
const fini = v => typeof v === 'number' && Number.isFinite(v);
const liste = (v, max) => {
  if (!Array.isArray(v) || v.length > max) refuser('scan-format');
  return v;
};
const confiance = c => ({ high: .85, medium: .6, low: .3 })[c] ?? .3;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const intervalle = (v, min, max) => fini(v) && v >= min && v <= max;
const normes = (v, n) => Array.isArray(v) && v.length === n && v.every(x => intervalle(x, -1000, 1000));

function surface(s, objet = false) {
  if (!s || !normes(s.transform, 16) || !normes(s.size, 3)) refuser('scan-format');
  const m = s.transform;
  // Matrice affine rigide, colonne majeure, +Y vertical. Pas d'échelle cachée ni de miroir.
  if ([3, 7, 11].some(i => Math.abs(m[i]) > .001) || Math.abs(m[15] - 1) > .001) refuser('scan-repere');
  const axes = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]];
  const d3 = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  if (axes.some(a => Math.abs(d3(a, a) - 1) > .03)
    || Math.abs(d3(axes[0], axes[1])) > .03 || Math.abs(d3(axes[0], axes[2])) > .03 || Math.abs(d3(axes[1], axes[2])) > .03
    || m[5] < .98 || Math.abs(m[1]) > .12 || Math.abs(m[9]) > .12
    || m[0] * m[10] - m[8] * m[2] < .97) refuser('scan-repere');
  if (!intervalle(s.size[0], .05, 30) || !intervalle(s.size[1], .05, 8)
    || !intervalle(s.size[2], objet ? .01 : 0, objet ? 8 : 1)) refuser('scan-dimensions');
  return { ...s, centre: [m[12], m[14]], axe: [m[0], m[2]], bas: m[13] - s.size[1] / 2 };
}

function cadre(u, points, sol) {
  const v = [-u[1], u[0]], xs = points.map(p => dot(p, u)), zs = points.map(p => dot(p, v));
  const xmin = Math.min(...xs), xmax = Math.max(...xs), zmin = Math.min(...zs), zmax = Math.max(...zs);
  const L = xmax - xmin, P = zmax - zmin;
  if (![L, P].every(n => intervalle(n, 1.2, 30))) refuser('scan-dimensions');
  const cx = (xmin + xmax) / 2, cz = (zmin + zmax) / 2;
  return { L, P, sol, u, v, point: p => [dot(p, u) - cx, dot(p, v) - cz] };
}

// Coins consécutifs, sans hypothèse d'angle droit. La révision 2D garde le relevé brut.
export function cadreDepuisCoins(coins) {
  if (liste(coins, 32).length < 3 || coins.some(p => !normes(p, 3))) refuser('scan-coins');
  if (Math.max(...coins.map(p => p[1])) - Math.min(...coins.map(p => p[1])) > .15) refuser('scan-sol');
  const ps = coins.map(p => [p[0], p[2]]), a = [ps[1][0] - ps[0][0], ps[1][1] - ps[0][1]], len = Math.hypot(...a);
  if (len < .2) refuser('scan-coins');
  const c = cadre(a.map(n => n / len), ps, coins.reduce((s, p) => s + p[1], 0) / coins.length);
  const locaux = ps.map(c.point).map(p => p.map(rond));
  try { validerContour(locaux); } catch(e) { refuser(e.message); }
  // Les anciens contrats rectangulaires gardent leurs noms de murs et ouvertures.
  const rectangle = locaux.length === 4 && locaux.every((p,i) => {
    const q = locaux[(i+1)%4];
    return Math.abs(Math.abs(p[0])-c.L/2) < .011 && Math.abs(Math.abs(p[1])-c.P/2) < .011
      && (Math.abs(p[0]-q[0]) < .011 || Math.abs(p[1]-q[1]) < .011);
  });
  if (!rectangle) c.contour = locaux;
  return c;
}

function cadrePolygonalRoomPlan(murs) {
  const bouts = murs.map(s => [-1,1].map(k => s.centre.map((v,i) => v+k*s.axe[i]*s.size[0]/2)));
  if (bouts.length < 3) refuser('scan-incomplet');
  const restants = bouts.slice(1), points = [bouts[0][0],bouts[0][1]];
  while (restants.length) {
    const fin = points.at(-1); let meilleur = null;
    restants.forEach((s,i) => s.forEach((p,j) => { const d=Math.hypot(p[0]-fin[0],p[1]-fin[1]); if (!meilleur || d<meilleur.d) meilleur={i,j,d}; }));
    if (meilleur.d > .35) refuser('scan-incomplet');
    const s = restants.splice(meilleur.i,1)[0];
    points[points.length-1] = fin.map((v,i)=>(v+s[meilleur.j][i])/2);
    points.push(s[1-meilleur.j]);
  }
  if (Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1]) > .35) refuser('scan-incomplet');
  points[0] = points[0].map((v,i)=>(v+points.at(-1)[i])/2); points.pop();
  const sols=murs.map(s=>s.bas).sort((a,b)=>a-b), sol=sols[Math.floor(sols.length/2)];
  const c=cadreDepuisCoins(points.map(p=>[p[0],sol,p[1]]));
  if (sols.some(y=>Math.abs(y-sol)>.15)) refuser('scan-sol');
  return c;
}

// Apple JSONEncoder(CapturedRoom), utilisé par les applications RoomPlan tierces.
// Dimensions Apple en mètres, matrices colonne majeure ; aucun maillage n'est deviné.
export function normaliserScan(scan) {
  if (scan?.version === VERSION_SCAN) {
    if(['android-arcore-webxr','plan-dxf','plan-dessine'].includes(scan.source))return {version:scan.version,source:scan.source,unit:scan.unit,floorCorners:liste(scan.floorCorners,32),ceilingHeight:scan.ceilingHeight??null,
      ...(scan.source!=='android-arcore-webxr'?{openings:liste(scan.openings||[],24).map(o=>({type:o?.type,a:o?.a,b:o?.b}))}: {})};
    if(scan.source!=='apple-roomplan')refuser('scan-format');
    const element=s=>({size:s?.size,transform:s?.transform,category:typeof s?.category==='string'?s.category.slice(0,40):'unknown',confidence:['high','medium','low'].includes(s?.confidence)?s.confidence:'low'});
    return {version:scan.version,source:scan.source,unit:scan.unit,walls:liste(scan.walls,32).map(element),openings:liste(scan.openings||[],24).map(element),objects:liste(scan.objects||[],80).map(element)};
  }
  const r = scan?.room || scan?.capturedRoom || scan;
  if (!r || !Array.isArray(r.walls) || !r.walls.length || !r.walls.every(w=>Array.isArray(w.dimensions) && Array.isArray(w.transform))) refuser('scan-format');
  const convertir = (s, type) => ({ size:s.dimensions, transform:s.transform.flat(),
    category:type || (typeof s.category==='string' ? s.category : Object.keys(s.category || {})[0]),
    confidence:typeof s.confidence==='string' ? s.confidence : Object.keys(s.confidence || {})[0] });
  return { version:VERSION_SCAN, source:'apple-roomplan',unit:'m',
    walls:liste(r.walls,32).map(s=>convertir(s,'wall')),
    openings:[...liste(r.doors||[],24).map(s=>convertir(s,'door')),...liste(r.windows||[],24).map(s=>convertir(s,'window')),...liste(r.openings||[],24).map(s=>convertir(s,'opening'))],
    objects:liste(r.objects||[],80).map(s=>convertir(s)) };
}

function murDe(c, position, tolerance = .2) {
  const [x, z] = c.point(position);
  const candidats = [['fond', Math.abs(z + c.P / 2)], ['entree', Math.abs(z - c.P / 2)],
    ['gauche', Math.abs(x + c.L / 2)], ['droite', Math.abs(x - c.L / 2)]].sort((a, b) => a[1] - b[1]);
  if (candidats[0][1] > tolerance) refuser('scan-forme');
  return candidats[0][0];
}

function cadreRoomPlan(murs, ouvertures) {
  if (murs.length < 4) refuser('scan-incomplet');
  const porte = ouvertures.find(s => s.category === 'door' || s.category === 'opening');
  const distanceMur = s => porte ? Math.abs(dot([porte.centre[0] - s.centre[0], porte.centre[1] - s.centre[1]], [-s.axe[1], s.axe[0]])) : Infinity;
  const long = porte ? [...murs].sort((a, b) => distanceMur(a) - distanceMur(b))[0] : murs.reduce((a, b) => a.size[0] >= b.size[0] ? a : b);
  const norme = Math.hypot(...long.axe), u = long.axe.map(v => v / norme);
  const points = murs.flatMap(s => [-1, 1].map(signe => s.centre.map((v, i) => v + signe * s.axe[i] * s.size[0] / 2)));
  const sols = murs.map(s => s.bas), sol = [...sols].sort((a, b) => a - b)[Math.floor(sols.length / 2)];
  if (sols.some(y => Math.abs(y - sol) > .15)) refuser('scan-sol');
  let c = cadre(u, points, sol);
  // Quand une porte est reconnue, elle définit le mur d'entrée et le repère du client.
  if (porte && c.point(porte.centre)[1] < 0) c = cadre(u.map(n => -n), points, sol);
  const observes = new Set(), segments = Object.fromEntries(MURS.map(m => [m, []]));
  for (const s of murs) {
    // Tous les segments doivent appartenir au contour, et non à un renfoncement intérieur.
    const extremites = [-1, 1].map(signe => s.centre.map((v, i) => v + signe * s.axe[i] * s.size[0] / 2));
    const mur = murDe(c, s.centre);
    const horizontal = ['fond', 'entree'].includes(mur), axe = horizontal ? c.u : c.v;
    if (Math.abs(dot(s.axe, axe)) < .985) refuser('scan-forme');
    for (const p of extremites) {
      const [x, z] = c.point(p);
      const bord = mur === 'fond' ? -c.P / 2 : mur === 'entree' ? c.P / 2 : mur === 'gauche' ? -c.L / 2 : c.L / 2;
      if (Math.abs((horizontal ? z : x) - bord) > .2) refuser('scan-forme');
    }
    observes.add(mur);
    const pos = c.point(s.centre)[horizontal ? 0 : 1];
    segments[mur].push([pos - s.size[0] / 2, pos + s.size[0] / 2]);
  }
  if (observes.size !== 4) refuser('scan-incomplet');
  for (const s of ouvertures) {
    const mur = murDe(c, s.centre), pos = c.point(s.centre)[['fond', 'entree'].includes(mur) ? 0 : 1];
    segments[mur].push([pos - s.size[0] / 2, pos + s.size[0] / 2]);
  }
  for (const mur of MURS) {
    const long = ['fond', 'entree'].includes(mur) ? c.L : c.P;
    let fin = -long / 2, couvert = 0;
    for (const [a, b] of segments[mur].sort((a, b) => a[0] - b[0])) { couvert += Math.max(0, Math.min(b, long / 2) - Math.max(a, fin)); fin = Math.max(fin, b); }
    if (couvert < long * .85) refuser('scan-incomplet');
  }
  return c;
}

const CATEGORIES = {
  bed: ['lit', 'Lit détecté'], sofa: ['canape', 'Canapé détecté'], chair: ['chaise', 'Siège détecté'],
  table: ['table', 'Table détectée'], storage: ['meuble', 'Rangement détecté'], television: ['tv', 'Télévision détectée'],
  fireplace: ['cheminee', 'Cheminée détectée'], bathtub: ['baignoire', 'Baignoire détectée'],
  refrigerator: ['cuisine', 'Réfrigérateur détecté'], oven: ['cuisine', 'Four détecté'], stove: ['cuisine', 'Cuisson détectée'],
  dishwasher: ['cuisine', 'Lave-vaisselle détecté'], washerDryer: ['cuisine', 'Lave-linge détecté'],
  sink: ['cuisine', 'Évier détecté'], toilet: ['autre', 'Sanitaire détecté'], stairs: ['autre', 'Escalier détecté']
};

export function depuisScan(scan) {
  scan = normaliserScan(scan);
  if (!scan || scan.version !== VERSION_SCAN || scan.unit !== 'm'
    || !['apple-roomplan', 'android-arcore-webxr','plan-dxf','plan-dessine'].includes(scan.source)) refuser('scan-format');
  const apple = scan.source === 'apple-roomplan';
  const mursBruts = apple ? liste(scan.walls, 32).map(s => surface(s)) : [];
  const ouvertures = apple ? liste(scan.openings || [], 24).map(s => surface(s)) : [];
  let c;
  if (apple) { try { c = cadreRoomPlan(mursBruts, ouvertures); } catch(e) { if (!['scan-forme','scan-incomplet'].includes(e.code)) throw e; c = cadrePolygonalRoomPlan(mursBruts); } }
  else c = cadreDepuisCoins(scan.floorCorners);
  const geometrie = {dims:{largeur:c.L,profondeur:c.P}, ...(c.contour ? {contour:c.contour} : {})};
  const pans = segmentsDe(geometrie);
  const hauteur = apple ? [...mursBruts.map(s => s.size[1])].sort((a, b) => a - b)[Math.floor(mursBruts.length / 2)] : scan.ceilingHeight;
  if (hauteur != null && !intervalle(hauteur, 1.9, 8)) refuser('scan-dimensions');
  const H = hauteur ?? 2.5;
  const objets = apple ? liste(scan.objects || [], 80).map(s => surface(s, true)) : [];
  const murs = Object.fromEntries(pans.map(({id:m}) => [m, { couleur: '#EFEAE2', observe: apple ? true : null, ouvertures: [] }]));
  const depuisPlan=['plan-dxf','plan-dessine'].includes(scan.source);
  if(depuisPlan)for(const o of scan.openings||[]){
    if(!['porte','fenetre'].includes(o.type)||!normes(o.a,2)||!normes(o.b,2))refuser('scan-ouverture');
    const a=c.point(o.a),b=c.point(o.b),milieu=a.map((v,i)=>(v+b[i])/2),largeur=Math.hypot(a[0]-b[0],a[1]-b[1]);
    const pan=[...pans].sort((p,q)=>distanceSegment(milieu,p.a,p.b)-distanceSegment(milieu,q.a,q.b))[0];
    if(largeur<.3||distanceSegment(a,pan.a,pan.b)>.1||distanceSegment(b,pan.a,pan.b)>.1)refuser('scan-ouverture');
    const position=dot(milieu.map((v,i)=>v-pan.centre[i]),pan.d)*pan.signePosition;
    if(Math.abs(position)+largeur/2>pan.long/2+.03||murs[pan.id].ouvertures.length>=6)refuser('scan-ouverture');
    murs[pan.id].ouvertures.push({type:o.type,position:rond(position),largeur:rond(largeur),hauteur:o.type==='porte'?Math.min(2.05,H):Math.min(1.2,H-.9),allege:o.type==='porte'?0:.9,confiance:.5,hauteurEstimee:true});
  }
  for (const s of ouvertures) {
    if (!['door', 'window', 'opening'].includes(s.category)) refuser('scan-format');
    const point = c.point(s.centre);
    const pan = c.contour ? [...pans].sort((a,b)=>distanceSegment(point,a.a,a.b)-distanceSegment(point,b.a,b.b))[0] : pans.find(p=>p.id===murDe(c,s.centre));
    if (distanceSegment(point,pan.a,pan.b) > .3) refuser('scan-ouverture');
    const mur = pan.id, long = pan.long;
    const axeLocal = [dot(s.axe,c.u),dot(s.axe,c.v)];
    if (Math.abs(dot(axeLocal,pan.d)) < .985) refuser('scan-repere');
    const position = dot(point.map((v,i)=>v-pan.centre[i]),pan.d)*pan.signePosition, largeur = s.size[0], hauteur = s.size[1];
    const allege = s.category === 'window' ? Math.max(0, s.bas - c.sol) : 0;
    if (largeur < .3 || hauteur < .4 || Math.abs(position) + largeur / 2 > long / 2 + .1 || hauteur + allege > H + .15) refuser('scan-ouverture');
    if (murs[mur].ouvertures.length >= 6) refuser('scan-format');
    murs[mur].ouvertures.push({ type: { door: 'porte', window: 'fenetre', opening: 'passage' }[s.category],
      position: rond(Math.max(-long / 2 + largeur / 2, Math.min(long / 2 - largeur / 2, position))),
      largeur: rond(largeur), hauteur: rond(Math.min(hauteur, H - allege)), allege: rond(allege), confiance: confiance(s.confidence) });
  }
  const agencement = objets.map((s, i) => {
    if (s.size.some(v => v > 6)) refuser('scan-dimensions');
    const [x, z] = c.point(s.centre);
    if (!contientPoint(geometrie,x,z) && (c.contour || Math.abs(x) > c.L / 2 + .15 || Math.abs(z) > c.P / 2 + .15)) refuser('scan-objet');
    const [fam, nom] = (Object.hasOwn(CATEGORIES,s.category)?CATEGORIES[s.category]:null) || ['autre', 'Objet détecté'];
    const devant = [s.transform[8], s.transform[10]];
    return { id: 's' + (i + 1), origine: 'existant', x: rond(x), z: rond(z),
      rot: normaliserAngle(Math.atan2(dot(devant, c.u), dot(devant, c.v))), confiance: confiance(s.confidence), garde: true,
      p: { fam, nom, dim: [s.size[0], s.size[2], s.size[1]].map(rond), cols: ['#B8AFA2'], st: '',
        mat: 'tissu', metal: 'noir', bois: '', dimsLues: false } };
  });
  const sources = { largeur: 'scan', profondeur: 'scan', hauteur: apple ? 'scan' : hauteur != null ? 'mesure' : 'estimation' };
  const avertissements = ['Contrôlez les cotes et les ouvertures sur place avant de commander.'];
  if (!apple) avertissements.push(depuisPlan?'Le plan 2D ne fournit ni hauteur des ouvertures, ni mobilier, ni sens de battant : vérifiez et complétez ces éléments.':'Les portes, fenêtres et meubles ne sont pas détectés par ce relevé Android : ajoutez-les dans le plan.');
  if (hauteur == null) avertissements.push('La hauteur de 2,50 m est une estimation, pas une mesure AR.');
  if (apple && [...mursBruts, ...ouvertures, ...objets].some(s => s.confidence !== 'high')) avertissements.push('Certains éléments sont détectés avec une confiance moyenne ou faible : vérifiez-les.');
  const modele = { v: 1, ...(c.contour ? {contour:c.contour} : {}), dims: { largeur: rond(c.L), profondeur: rond(c.P), hauteur: rond(H), estimees: true, sources }, murs,
    sol: { matiere: 'autre', couleur: '#B9A58B' }, plafond: { couleur: '#F6F4EF' }, style: '', ambiance: '', remarques: avertissements,
    vue: { x: (murs.entree?.ouvertures || []).find(o => o.type === 'porte' || o.type === 'passage')?.position || 0,
      z: rond(c.P / 2 - .3), y: Math.min(1.5, H - .2), cx: 0, cy: 1.05, cz: 0, fov: 50 },
    capture: { version: VERSION_SCAN, source: scan.source, unites: 'm', metrique: true, aVerifier: true,
      ouverturesDetectees: apple||depuisPlan, mobilierDetecte: apple, nbMeubles: agencement.length,
      nbOuvertures: ouvertures.length+(depuisPlan?(scan.openings||[]).length:0) } };
  if(c.contour){const entree=pans.find(p=>(murs[p.id]?.ouvertures||[]).some(o=>['porte','passage'].includes(o.type)));const ouv=entree&&(murs[entree.id].ouvertures.find(o=>['porte','passage'].includes(o.type)));const prefere=entree?pointOuverture(entree,ouv.position).map((v,i)=>v+entree.n[i]*.3):[0,c.P/2-.3];const [x,z]=pointInterieur(modele,prefere),[cx,cz]=pointInterieur(modele);modele.vue={...modele.vue,x:rond(x),z:rond(z),cx:rond(cx),cz:rond(cz)};}
  return { modele, agencement };
}

export function champsDepuisScan(scan) {
  const { modele, agencement } = depuisScan(scan);
  return { modele, agencement, dims: { largeur: null, profondeur: null,
    hauteur: modele.dims.sources.hauteur === 'mesure' ? modele.dims.hauteur : null }, etat: 'prete', proposition: null, erreur: null };
}
