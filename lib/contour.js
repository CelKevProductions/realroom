// Contour métrique ordonné. Les dimensions sont son cadre, jamais un substitut au sol.
export const aireSignee = ps => ps.reduce((s, p, i) => { const q = ps[(i + 1) % ps.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
export function lettreMur(index) {
  let n=index+1,texte='';
  do {n--;texte=String.fromCharCode(65+n%26)+texte;n=Math.floor(n/26);} while(n>0);
  return texte;
}
const croix = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function distanceSegment(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
export function seCroisent(a, b, c, d) {
  const x = croix(a, b, c), y = croix(a, b, d), z = croix(c, d, a), w = croix(c, d, b);
  return x * y < -1e-12 && z * w < -1e-12;
}
export function validerContour(ps) {
  if (!Array.isArray(ps) || ps.length < 3 || ps.length > 32 || ps.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(v => Number.isFinite(v) && Math.abs(v) <= 30))) throw new Error('scan-coins');
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i], b = ps[(i + 1) % ps.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .2) throw new Error('scan-coins');
    for (let j = i + 1; j < ps.length; j++) {
      if (j === i + 1 || (i === 0 && j === ps.length - 1)) continue;
      const c = ps[j], d = ps[(j + 1) % ps.length];
      if (seCroisent(a, b, c, d) || distanceSegment(a, c, d) < .005 || distanceSegment(b, c, d) < .005 || distanceSegment(c, a, b) < .005) throw new Error('scan-forme');
    }
  }
  if (Math.abs(aireSignee(ps)) < 1) throw new Error('scan-forme');
  return ps;
}
export function contourDe(m) {
  if (m.contour) return m.contour;
  const L = m.dims.largeur / 2, P = m.dims.profondeur / 2;
  return [[-L,-P], [L,-P], [L,P], [-L,P]];
}
export function contientPoint(m, x, z, marge = 0) {
  const ps = contourDe(m), p = [x, z]; let dedans = false;
  for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) {
    const a = ps[j], b = ps[i], d = distanceSegment(p, a, b);
    if (d <= 1e-7) return marge <= 0;
    if (marge > 0 && d < marge - 1e-7) return false;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) dedans = !dedans;
  }
  return dedans;
}
export function contientBoite(m, b) {
  if (!m.contour) return b.x0 >= -m.dims.largeur / 2 - .005 && b.x1 <= m.dims.largeur / 2 + .005 && b.z0 >= -m.dims.profondeur / 2 - .005 && b.z1 <= m.dims.profondeur / 2 + .005;
  const coins = [[b.x0,b.z0], [b.x1,b.z0], [b.x1,b.z1], [b.x0,b.z1]], ps = contourDe(m);
  return coins.every(p => contientPoint(m, ...p)) && coins.every((a, i) => !ps.some((c, j) => seCroisent(a, coins[(i+1)%4], c, ps[(j+1)%ps.length])))
    && ps.every(p => !(p[0] > b.x0 + .005 && p[0] < b.x1 - .005 && p[1] > b.z0 + .005 && p[1] < b.z1 - .005));
}
export function segmentsDe(m) {
  if (!m.contour) {
    const L = m.dims.largeur, P = m.dims.profondeur;
    return [
      {id:'fond', a:[-L/2,-P/2], b:[L/2,-P/2]}, {id:'droite',a:[L/2,-P/2],b:[L/2,P/2]},
      {id:'entree',a:[L/2,P/2],b:[-L/2,P/2]}, {id:'gauche',a:[-L/2,P/2],b:[-L/2,-P/2]}
    ].map(s => segment(s, 1, ['entree','gauche'].includes(s.id) ? -1 : 1));
  }
  const ps = contourDe(m), sens = Math.sign(aireSignee(ps));
  return ps.map((a,i) => segment({id:`pan_${i+1}`,a,b:ps[(i+1)%ps.length]}, sens, 1));
}
function segment(s, sens, signePosition) {
  const long = Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]), d = [(s.b[0]-s.a[0])/long,(s.b[1]-s.a[1])/long];
  const n = [-d[1]*sens,d[0]*sens], centre = [(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2];
  return {...s,long,d,n,centre,signePosition};
}
export function pointOuverture(s, position = 0) { return s.centre.map((v,i) => v+s.d[i]*position*s.signePosition); }
export function zoneOuverture(s, o, profondeur, marge = 0) {
  const p = pointOuverture(s, o.position), w = (o.largeur || .9)/2+marge;
  const ps = [-1,1].flatMap(k => [0,profondeur].map(t => p.map((v,i) => v+k*w*s.d[i]+t*s.n[i])));
  return {x0:Math.min(...ps.map(p=>p[0])),x1:Math.max(...ps.map(p=>p[0])),z0:Math.min(...ps.map(p=>p[1])),z1:Math.max(...ps.map(p=>p[1]))};
}
export function poseAuPan(s, it, dim, offset = 0) {
  const u = offset*Math.max(0,(s.long-dim[0])/2), p = pointOuverture(s,u);
  return {...it,x:p[0]+s.n[0]*(dim[1]/2+.04),z:p[1]+s.n[1]*(dim[1]/2+.04),rot:Math.atan2(s.n[0],s.n[1])};
}
// Point intérieur proche d'une préférence (caméra/cible), même si le centre du cadre est dans le vide.
export function pointInterieur(m, preference=[0,0], marge=.15) {
  if(contientPoint(m,...preference,marge))return preference;
  const L=m.dims.largeur,P=m.dims.profondeur,pas=Math.max(.15,Math.sqrt(L*P/1600));let meilleur=null,distance=Infinity;
  for(let x=-L/2+pas/2;x<L/2;x+=pas)for(let z=-P/2+pas/2;z<P/2;z+=pas){const d=Math.hypot(x-preference[0],z-preference[1]);if(d<distance&&contientPoint(m,x,z,marge)){meilleur=[x,z];distance=d;}}
  return meilleur || segmentsDe(m)[0].centre;
}
