// Géométrie verticale partagée par le solveur, l'éditeur et les contrôles.
// y / height = centre des objets muraux et suspendus ; les objets au sol ont leur base à 0.
import { segmentsDe, distanceSegment, contientBoite } from './contour.js';

const MURAUX = new Set(['applique', 'miroir', 'tableau', 'tv-murale', 'panneau', 'etagere-murale']);
const SUSPENDUS = new Set(['suspension', 'lustre', 'plafonnier']);
const POSABLES = new Set(['tv', 'lampe', 'sculpture', 'plante', 'deco']);
const PORTEURS = new Set(['meuble', 'buffet', 'commode', 'table', 'bureau', 'console', 'etagere', 'chevet']);
const recouvre = (a0, a1, b0, b1, jeu = 0) => Math.min(a1, b1) - Math.max(a0, b0) > jeu;
const projection = (it, pan) => (it.x - pan.centre[0]) * pan.d[0] + (it.z - pan.centre[1]) * pan.d[1];

// Les volumes muraux partent de la face du mur et avancent dans la pièce.
export function empreinteVolume(it, p) {
  const a = it.rot || 0, c = Math.cos(a), s = Math.sin(a), avance = MURAUX.has(p.fam) ? p.dim[1] / 2 : 0;
  const x = it.x + s * avance, z = it.z + c * avance;
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v]) => [x + c*u*p.dim[0]/2 + s*v*p.dim[1]/2, z - s*u*p.dim[0]/2 + c*v*p.dim[1]/2]);
}
export function chevaucheVolumes(a, b, jeu = .005) {
  for (const poly of [a,b]) for (let i=0;i<2;i++) {
    const q=poly[i], t=poly[i+1], nx=-(t[1]-q[1]), nz=t[0]-q[0], n=Math.hypot(nx,nz);
    const proj=p=>p.map(v=>(v[0]*nx+v[1]*nz)/n), pa=proj(a), pb=proj(b);
    if (!recouvre(Math.min(...pa),Math.max(...pa),Math.min(...pb),Math.max(...pb),jeu)) return false;
  }
  return true;
}
function tientSur(it,p,e) {
  const a=e.it.rot||0,c=Math.cos(a),s=Math.sin(a);
  return empreinteVolume(it,p).every(([x,z]) => Math.abs((x-e.it.x)*c-(z-e.it.z)*s)<=e.p.dim[0]/2+.005 && Math.abs((x-e.it.x)*s+(z-e.it.z)*c)<=e.p.dim[1]/2+.005);
}

export function porteurVolume(it, p, entrees) {
  if (!POSABLES.has(p.fam) || p.dim[2] > 1.05 || p.dim[1] > .7) return null;
  return entrees.filter(e => e.it.id !== it.id && e.it.garde !== false && PORTEURS.has(e.p.fam) && e.p.dim[2] >= .3 && e.p.dim[2] <= 1.3)
    .filter(e => {
      if (it.attach_to?.type === 'furniture' && it.attach_to.id !== e.it.id) return false;
      const a = e.it.rot || 0, x = (it.x - e.it.x) * Math.cos(a) - (it.z - e.it.z) * Math.sin(a), z = (it.x - e.it.x) * Math.sin(a) + (it.z - e.it.z) * Math.cos(a);
      return Math.abs(x) < e.p.dim[0] / 2 && Math.abs(z) < e.p.dim[1] / 2 && (p.fam !== 'tv' || tientSur(it,p,e));
    }).sort((a, b) => b.p.dim[2] - a.p.dim[2])[0] || null;
}

export function intervalleHauteur(it, p, modele, entrees = []) {
  const h = p.dim[2];
  if (MURAUX.has(p.fam)) { const y = it.y ?? it.height ?? 1.55; return { bas: y - h / 2, haut: y + h / 2 }; }
  if (SUSPENDUS.has(p.fam)) { const y = it.y ?? it.height ?? modele.dims.hauteur - h / 2; return { bas: y - h / 2, haut: y + h / 2 }; }
  const support = porteurVolume(it, p, entrees), bas = support ? support.p.dim[2] : 0;
  return { bas, haut: bas + h };
}

export function attacheMur(modele, it, p, mur = it.mur) {
  const pans = segmentsDe(modele), pan = pans.find(s => s.id === mur) || [...pans].sort((a, b) => distanceSegment([it.x, it.z], a.a, a.b) - distanceSegment([it.x, it.z], b.a, b.b))[0];
  if (!pan) return it;
  const height = it.y ?? it.height ?? 1.55;
  return { ...it, kind: 'wall_item', mur: pan.id, y: height, height,
    wall_offset: Math.round((projection(it, pan) + pan.long / 2) * 1000) / 1000,
    attach_to: { type: 'wall', id: pan.id } };
}

export function verifierHauteurs(modele, items, catalogue) {
  const es = items.filter(it => it.garde !== false).map(it => ({ it, p: it.sku ? catalogue[it.sku] : it.p })).filter(e => e.p?.dim);
  const pans = segmentsDe(modele), alertes = [];
  for (const e of es) {
    const v = intervalleHauteur(e.it, e.p, modele, es), mural = MURAUX.has(e.p.fam);
    if (v.bas < -.015 || v.haut > modele.dims.hauteur + .015) alertes.push({ type: 'hauteur', ids: [e.it.id] });
    if (e.p.fam === 'tv' && e.p.dim[2] <= 1.05 && (e.it.kind === 'surface_item' || e.it.usageProgramme === 'television') && !porteurVolume(e.it,e.p,es)) alertes.push({type:'support-tv',ids:[e.it.id]});
    if (SUSPENDUS.has(e.p.fam) && e.it.kind === 'ceiling_item') {
      const coins=empreinteVolume(e.it,e.p), b={x0:Math.min(...coins.map(q=>q[0])),x1:Math.max(...coins.map(q=>q[0])),z0:Math.min(...coins.map(q=>q[1])),z1:Math.max(...coins.map(q=>q[1]))};
      if (!contientBoite(modele,b)) alertes.push({type:'plafond-limites',ids:[e.it.id]});
      const support=e.it.attach_to?.type==='furniture' ? es.find(q=>q.it.id===e.it.attach_to.id) : null;
      if (v.bas<2.1 && (!support || !tientSur(e.it,e.p,support))) alertes.push({type:'suspension-passage',ids:[e.it.id]});
    }
    if (!mural) continue;
    const pan = pans.find(p => p.id === e.it.mur) || [...pans].sort((a, b) => distanceSegment([e.it.x, e.it.z], a.a, a.b) - distanceSegment([e.it.x, e.it.z], b.a, b.b))[0];
    const u = projection(e.it, pan), demi = e.p.dim[0] / 2;
    if (Math.abs(u) + demi > pan.long / 2 + .015 || distanceSegment([e.it.x, e.it.z], pan.a, pan.b) > .065) alertes.push({ type: 'mur-limites', ids: [e.it.id] });
    for (const o of modele.murs?.[pan.id]?.ouvertures || []) {
      const position = o.position * pan.signePosition;
      if (recouvre(u - demi, u + demi, position - o.largeur / 2, position + o.largeur / 2, -.025)
        && recouvre(v.bas, v.haut, o.allege || 0, (o.allege || 0) + (o.hauteur || 2), -.025))
        alertes.push({ type: o.type === 'fenetre' || o.type === 'baie' ? 'mur-fenetre' : 'mur-porte', ids: [e.it.id] });
    }
    for (const q of es) {
      if (q.it.id === e.it.id || SUSPENDUS.has(q.p.fam) || q.p.fam === 'tapis') continue;
      const w = intervalleHauteur(q.it, q.p, modele, es);
      if (!recouvre(v.bas, v.haut, w.bas, w.haut, .015)) continue;
      if (MURAUX.has(q.p.fam)) {
        if (q.it.id < e.it.id && (q.it.mur === pan.id ? recouvre(u - demi, u + demi, projection(q.it, pan) - q.p.dim[0] / 2, projection(q.it, pan) + q.p.dim[0] / 2, -.015) : chevaucheVolumes(empreinteVolume(e.it,e.p),empreinteVolume(q.it,q.p))))
          alertes.push({ type: 'mur-collision', ids: [e.it.id, q.it.id] });
      } else {
        const a = q.it.rot || 0, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
        const hx = (c * q.p.dim[0] + s * q.p.dim[1]) / 2, hz = (s * q.p.dim[0] + c * q.p.dim[1]) / 2;
        const rayon = Math.abs(pan.n[0]) * hx + Math.abs(pan.n[1]) * hz;
        const leLong = Math.abs(pan.d[0]) * hx + Math.abs(pan.d[1]) * hz;
        const recul = (q.it.x - pan.centre[0]) * pan.n[0] + (q.it.z - pan.centre[1]) * pan.n[1];
        if (recul - rayon < e.p.dim[1] + .035 && recouvre(u - demi, u + demi, projection(q.it, pan) - leLong, projection(q.it, pan) + leLong, .01))
          alertes.push({ type: 'mur-masque', ids: [e.it.id, q.it.id] });
      }
    }
  }
  // Les objets posés et suspendus sont contrôlés avec leur hauteur, pas comme des obstacles au sol.
  for (let i=0;i<es.length;i++) for (let j=i+1;j<es.length;j++) {
    const a=es[i],b=es[j];
    if (MURAUX.has(a.p.fam)||MURAUX.has(b.p.fam)||a.p.fam==='tapis'||b.p.fam==='tapis') continue;
    if (![a,b].some(e=>e.it.kind==='surface_item'||e.it.kind==='ceiling_item')) continue;
    const va=intervalleHauteur(a.it,a.p,modele,es),vb=intervalleHauteur(b.it,b.p,modele,es);
    if (recouvre(va.bas,va.haut,vb.bas,vb.haut,.015)&&chevaucheVolumes(empreinteVolume(a.it,a.p),empreinteVolume(b.it,b.p))) alertes.push({type:'volume-collision',ids:[a.it.id,b.it.id]});
  }
  return [...new Map(alertes.map(a => [a.type + ':' + a.ids.join(','), a])).values()];
}
