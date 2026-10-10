/* =================================================================
   Agencement d'une pièce : conventions, empreintes au sol, et solveur
   (dans la pièce, sans chevauchement, portes dégagées, dos au mur).
   Pur JavaScript : sert au serveur (après Claude) comme à l'éditeur.

   Repère de la pièce (mètres, celui de three.js) : origine au centre du sol, y vers le haut.
     x de -largeur/2 (mur de gauche) à +largeur/2 (mur de droite), vus depuis l'entrée ;
     z de -profondeur/2 (mur du fond) à +profondeur/2 (mur d'entrée) : depuis l'entrée,
       on regarde vers -z, comme la caméra de three.js.
   Meubles : face avant vers +z quand rot = 0 (ils regardent l'entrée) ;
     rot = PI : ils regardent le fond ; PI/2 : la droite ; -PI/2 : la gauche.
   Dimensions d'un meuble : dim = [largeur, profondeur, hauteur].
   ================================================================= */

import { segmentsDe, distanceSegment, contientBoite, contientPoint, zoneOuverture, pointOuverture, poseAuPan } from './contour.js';
import { estInstallation } from './usages.js';

export const ANGLES = { entree: 0, fond: Math.PI, droite: Math.PI / 2, gauche: -Math.PI / 2 };
export const MURS = ['fond', 'gauche', 'droite', 'entree'];

// familles posées au mur, suspendues, à plat au sol, adossées à un mur
const MURAL = new Set(['applique', 'miroir', 'tableau', 'tv-murale', 'panneau']);
const SUSPENDU = new Set(['suspension', 'lustre', 'plafonnier']);
const PLAT = new Set(['tapis']);
const ADOSSE = new Set(['lit', 'canape', 'meuble', 'buffet', 'commode', 'armoire', 'etagere', 'bibliotheque', 'tv', 'bureau', 'console', 'meridienne', 'banc', 'cuisine', 'dressing', 'radiateur', 'cheminee']);
export const estMural = fam => MURAL.has(fam);
export const estSuspendu = fam => SUSPENDU.has(fam);
export const estPlat = fam => PLAT.has(fam);
export const estAdosse = fam => ADOSSE.has(fam);
export const estAuSol = fam => !MURAL.has(fam) && !SUSPENDU.has(fam);

// petits objets qui se posent sur un meuble bas (télévision sur son meuble, lampe sur une table)
const POSABLE = new Set(['tv', 'lampe', 'sculpture', 'plante', 'deco']);
const PORTEUR = new Set(['meuble', 'buffet', 'commode', 'table', 'bureau', 'console', 'etagere', 'chevet']);
export const estPosable = (fam, dim) => POSABLE.has(fam) && Array.isArray(dim) && dim[2] <= 1.05 && dim[1] <= .7;
export const estPorteur = (fam, dim) => PORTEUR.has(fam) && Array.isArray(dim) && dim[2] >= .3 && dim[2] <= 1.3;
// le meuble bas sous un objet posable (celui qui contient son centre ; le plus haut s'il y en a plusieurs)
// autres : [{ it, p }] ; renvoie l'entrée trouvée ou null
export function porteurDe(it, p, autres) {
  if (!p || !estPosable(p.fam, p.dim)) return null;
  let r = null;
  for (const o of autres) {
    if (!o || o.it === it || o.it.id === it.id || !o.p || !estPorteur(o.p.fam, o.p.dim) || o.it.garde === false) continue;
    const b = boite(o.it, o.p.dim);
    if (it.x > b.x0 && it.x < b.x1 && it.z > b.z0 && it.z < b.z1 && (!r || o.p.dim[2] > r.p.dim[2])) r = o;
  }
  return r;
}

const r2 = v => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// angle ramené dans ]-PI, PI]
export function normaliserAngle(a) {
  let t = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  if (t <= -Math.PI + 1e-9) t = Math.PI;
  return t;
}
// orientation (« entree », « fond »…) ou angle en degrés -> radians
export function angleDe(o) {
  if (typeof o === 'number') return normaliserAngle(o * Math.PI / 180);
  return ANGLES[o] ?? 0;
}

// produit (catalogue) ou meuble relevé sur la photo : mêmes champs (fam, dim, cols…)
export function produitDe(item, catalogue) {
  if (item.sku && catalogue && catalogue[item.sku]) return catalogue[item.sku];
  return item.p || null;
}

// demi-empreinte au sol d'un meuble tourné de rot
export function demiEmpreinte(dim, rot) {
  const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  const w = dim[0] / 2, d = dim[1] / 2;
  return [c * w + s * d, s * w + c * d];
}
export function boite(item, dim) {
  const [hx, hz] = demiEmpreinte(dim, item.rot || 0);
  return { x0: item.x - hx, x1: item.x + hx, z0: item.z - hz, z1: item.z + hz };
}
function chevauchement(a, b, marge = 0) {
  const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + marge;
  const dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) + marge;
  return dx > 0 && dz > 0 ? { dx, dz } : null;
}

// zones à garder libres devant les portes et passages (0,9 m dans la pièce)
export function zonesPortes(modele) {
  const zones = [];
  for (const pan of segmentsDe(modele)) for (const o of modele.murs?.[pan.id]?.ouvertures || []) {
    if (o.type === 'porte' || o.type === 'passage' || (o.type === 'baie' && !(o.allege > .05))) zones.push({...zoneOuverture(pan,o,.9,.1),mur:pan.id,type:o.type});
  }
  return zones;
}

// mur le plus proche d'un point, et position le long de ce mur
export function murProche(modele, x, z) {
  if (modele.contour) return segmentsDe(modele).sort((a,b)=>distanceSegment([x,z],a.a,a.b)-distanceSegment([x,z],b.a,b.b))[0].id;
  const { largeur: L, profondeur: P } = modele.dims;
  const d = { gauche: x + L / 2, droite: L / 2 - x, fond: z + P / 2, entree: P / 2 - z };
  return Object.keys(d).reduce((a, b) => (d[a] <= d[b] ? a : b));
}

// meuble mural : collé au mur, face vers la pièce ; y = hauteur de son centre
export function placerAuMur(modele, item, dim, mur) {
  const { largeur: L, profondeur: P, hauteur: H } = modele.dims;
  mur = mur || item.mur || murProche(modele, item.x, item.z);
  if (modele.contour) {
    const pan = segmentsDe(modele).find(p=>p.id===mur) || segmentsDe(modele)[0];
    let u = (item.x-pan.centre[0])*pan.d[0]+(item.z-pan.centre[1])*pan.d[1];
    const demi=dim[0]/2, min=-pan.long/2+demi, max=pan.long/2-demi;
    u=clamp(u,min,max);
    const genes=(modele.murs?.[pan.id]?.ouvertures||[]).map(o=>[o.position-o.largeur/2-demi-.08,o.position+o.largeur/2+demi+.08]);
    const libre=v=>v>=min && v<=max && !genes.some(([a,b])=>v>a && v<b);
    if (!libre(u)) {const essais=genes.flat().concat([min,max]).filter(libre);if(essais.length) u=essais.sort((a,b)=>Math.abs(a-u)-Math.abs(b-u))[0];}
    const p=pointOuverture(pan,u);
    return {...item,mur:pan.id,x:r2(p[0]),z:r2(p[1]),rot:Math.atan2(pan.n[0],pan.n[1]),y:r2(clamp(item.y??1.5,dim[2]/2+.1,H-dim[2]/2-.05))};
  }
  const demi = dim[0] / 2;
  const y = clamp(item.y ?? (dim[2] > 1.2 ? 1.5 : 1.55), dim[2] / 2 + .1, H - dim[2] / 2 - .05);
  const long = mur === 'fond' || mur === 'entree' ? L : P;
  // position le long du mur (x pour fond et entrée, z pour les côtés), hors des fenêtres et portes
  let u = clamp(mur === 'fond' || mur === 'entree' ? item.x : item.z, -long / 2 + demi, long / 2 - demi);
  const genes = ((modele.murs && modele.murs[mur] && modele.murs[mur].ouvertures) || [])
    .filter(o => (o.allege || 0) < y + dim[2] / 2 && (o.allege || 0) + (o.hauteur || 2) > y - dim[2] / 2)
    .map(o => [o.position - o.largeur / 2 - demi - .08, o.position + o.largeur / 2 + demi + .08]);
  const libre = v => v >= -long / 2 + demi - 1e-6 && v <= long / 2 - demi + 1e-6 && !genes.some(([a, b]) => v > a && v < b);
  if (!libre(u)) {
    const essais = genes.flatMap(([a, b]) => [a, b]).concat([-long / 2 + demi, long / 2 - demi]).filter(libre);
    if (essais.length) u = essais.reduce((m, v) => (Math.abs(v - u) < Math.abs(m - u) ? v : m));
  }
  if (mur === 'fond') return { ...item, mur, x: r2(u), z: r2(-P / 2), rot: 0, y: r2(y) };
  if (mur === 'entree') return { ...item, mur, x: r2(u), z: r2(P / 2), rot: Math.PI, y: r2(y) };
  if (mur === 'gauche') return { ...item, mur, x: r2(-L / 2), z: r2(u), rot: Math.PI / 2, y: r2(y) };
  return { ...item, mur: 'droite', x: r2(L / 2), z: r2(u), rot: -Math.PI / 2, y: r2(y) };
}

/* Solveur. items : [{ id, sku | p, x, z, rot, fixe?, garde? }]
   - meubles retirés (garde === false) : ignorés
   - au sol : dans la pièce, sans chevauchement (les tapis passent dessous), hors des zones de porte
   - adossés : dos contre le mur s'ils en sont à moins de 35 cm
   - muraux : collés au mur le plus proche ; suspendus : dans la pièce
   - posables (télévision, lampe…) : sur le meuble bas qui est sous eux, sinon au sol comme les autres
   Les meubles « fixe » (existants gardés) ne bougent pas ; un nouveau meuble qui ne trouve pas
   sa place est retiré, avec une alerte. */
export function resoudre(modele, items, catalogue, opts = {}) {
  const { largeur: L, profondeur: P } = modele.dims;
  const jeu = opts.jeu ?? .04;                 // écart minimal entre deux meubles
  const alertes = [];
  const portes = zonesPortes(modele);
  const sortie = [];
  const places = [];                            // [{ it, p, b, pose? }] déjà placés (pose : sur un meuble)
  const nomDe = (it, p) => (p && p.nom) || it.id;

  // ordre : fixes d'abord, puis les plus grands ; les objets posables après les meubles qui peuvent les porter
  const liste = items.filter(it => it.garde !== false).map(it => ({ it: { ...it, ...(estInstallation(it) ? { fixe: true } : {}) }, p: produitDe(it, catalogue) }))
    .filter(e => e.p && Array.isArray(e.p.dim));
  const fixes = liste.filter(e => e.it.fixe);
  const rang = e => (e.it.fixe ? 0 : estPosable(e.p.fam, e.p.dim) ? 2 : 1);
  liste.sort((a, b) => rang(a) - rang(b) || b.p.dim[0] * b.p.dim[1] - a.p.dim[0] * a.p.dim[1]);
  // obstacles au sol pour les meubles à placer : pas les tapis, ni les objets posés sur un meuble
  const obstacles = () => places.filter(q => !estPlat(q.p.fam) && !q.pose);

  for (const { it, p } of liste) {
    const dim = p.dim, fam = p.fam;
    // Un meuble conservé reste exactement à sa place, y compris mural ou suspendu.
    if (it.fixe) {
      if (estAuSol(fam)) places.push({ it, p, b: boite(it, dim), pose: Boolean(porteurDe(it, p, fixes)) });
      sortie.push(it);
      continue;
    }
    it.rot = normaliserAngle(it.rot || 0);
    if (estMural(fam)) { sortie.push(placerAuMur(modele, it, dim)); continue; }
    // objet posé sur un meuble bas : il y reste, rentré dans son plateau autant que possible
    const sur = porteurDe(it, p, it.fixe ? fixes : places);
    if (sur) {
      if (!it.fixe) {
        const b = boite(sur.it, sur.p.dim), [hx, hz] = demiEmpreinte(dim, it.rot);
        it.x = b.x1 - b.x0 >= 2 * hx ? clamp(it.x, b.x0 + hx, b.x1 - hx) : (b.x0 + b.x1) / 2;
        it.z = b.z1 - b.z0 >= 2 * hz ? clamp(it.z, b.z0 + hz, b.z1 - hz) : (b.z0 + b.z1) / 2;
        it.x = r2(it.x); it.z = r2(it.z);
      }
      places.push({ it, p, b: boite(it, dim), pose: true });
      sortie.push(it);
      continue;
    }
    if (estSuspendu(fam)) {
      const [hx, hz] = demiEmpreinte(dim, 0);
      const pose = { ...it, x: r2(clamp(it.x, -L / 2 + hx, L / 2 - hx)), z: r2(clamp(it.z, -P / 2 + hz, P / 2 - hz)) };
      if (contientBoite(modele,boite(pose,dim))) sortie.push(pose);
      else alertes.push({type:'place',id:it.id,texte:nomDe(it,p)+' ne tient pas dans le contour.'});
      continue;
    }
    // trop grand pour la pièce, même tourné
    const [hx0, hz0] = demiEmpreinte(dim, it.rot);
    if (2 * hx0 > L + .01 || 2 * hz0 > P + .01) {
      const [hx1, hz1] = demiEmpreinte(dim, it.rot + Math.PI / 2);
      if (!it.fixe && 2 * hx1 <= L && 2 * hz1 <= P) it.rot = normaliserAngle(it.rot + Math.PI / 2);
      else if (!it.fixe) { alertes.push({ type: 'trop-grand', id: it.id, texte: nomDe(it, p) + ' ne tient pas dans la pièce.' }); continue; }
    }
    const [hx, hz] = demiEmpreinte(dim, it.rot);
    const dansPiece = () => {
      it.x = clamp(it.x, -L / 2 + hx, L / 2 - hx);
      it.z = clamp(it.z, -P / 2 + hz, P / 2 - hz);
    };
    if (!it.fixe) {
      dansPiece();
      // dos au mur : le mur derrière le meuble (opposé à sa face avant)
      if (estAdosse(fam) && !modele.contour) {
        const fx = Math.sin(it.rot), fz = Math.cos(it.rot);
        if (Math.abs(fz) > .7) {
          const mur = fz > 0 ? -P / 2 : P / 2, bord = fz > 0 ? it.z - hz : it.z + hz;
          if (Math.abs(bord - mur) < .35) it.z = fz > 0 ? mur + hz + .01 : mur - hz - .01;
        } else if (Math.abs(fx) > .7) {
          const mur = fx > 0 ? -L / 2 : L / 2, bord = fx > 0 ? it.x - hx : it.x + hx;
          if (Math.abs(bord - mur) < .35) it.x = fx > 0 ? mur + hx + .01 : mur - hx - .01;
        }
      }
      if (!estPlat(fam)) {
        // écarte des meubles déjà placés et des portes, par petites poussées
        for (let essai = 0; essai < 60; essai++) {
          const b = boite(it, dim);
          let pousse = null;
          for (const q of obstacles()) {
            const c = chevauchement(b, q.b, jeu);
            if (c) { pousse = { c, q: q.b }; break; }
          }
          if (!pousse) for (const z of portes) { const c = chevauchement(b, z); if (c) { pousse = { c, q: z }; break; } }
          if (!pousse) break;
          const { c, q } = pousse;
          const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, qx = (q.x0 + q.x1) / 2, qz = (q.z0 + q.z1) / 2;
          // d'abord l'axe le plus court ; s'il bute sur un mur, l'autre
          const essaiX = () => { it.x += (cx >= qx ? 1 : -1) * (c.dx + .005); };
          const essaiZ = () => { it.z += (cz >= qz ? 1 : -1) * (c.dz + .005); };
          const avant = { x: it.x, z: it.z };
          if (c.dx <= c.dz) essaiX(); else essaiZ();
          dansPiece();
          if (Math.abs(it.x - avant.x) < .002 && Math.abs(it.z - avant.z) < .002) {
            if (c.dx <= c.dz) essaiZ(); else essaiX();
            dansPiece();
            // coincé contre un mur : on part de l'autre côté de l'obstacle
            if (Math.abs(it.x - avant.x) < .002 && Math.abs(it.z - avant.z) < .002) {
              if (c.dx <= c.dz) it.x += (cx >= qx ? -1 : 1) * ((b.x1 - b.x0) + (q.x1 - q.x0) + jeu);
              else it.z += (cz >= qz ? -1 : 1) * ((b.z1 - b.z0) + (q.z1 - q.z0) + jeu);
              dansPiece();
            }
          }
        }
        const b = boite(it, dim);
        const gene = obstacles().some(q => chevauchement(b, q.b, jeu - .02)) || portes.some(z => chevauchement(b, z, -.02));
        if (gene) { alertes.push({ type: 'place', id: it.id, texte: 'Pas assez de place pour ' + nomDe(it, p) + '.' }); continue; }
      }
    }
    if (modele.contour) {
      const libre = pose => contientBoite(modele,boite(pose,dim)) && (estPlat(fam) || (!obstacles().some(q=>chevauchement(boite(pose,dim),q.b,jeu-.02)) && !portes.some(q=>chevauchement(boite(pose,dim),q,-.02))));
      if (!libre(it)) {
        const essais = segmentsDe(modele).flatMap(pan=>[-.7,-.35,0,.35,.7].map(t=>poseAuPan(pan,it,dim,t)));
        const pas=Math.max(.2,Math.sqrt(L*P/1200));
        for(let x=-L/2+hx;x<=L/2-hx;x+=pas) for(let z=-P/2+hz;z<=P/2-hz;z+=pas) essais.push({...it,x,z});
        const valide=essais.filter(libre).sort((a,b)=>Math.hypot(a.x-it.x,a.z-it.z)-Math.hypot(b.x-it.x,b.z-it.z))[0];
        if (!valide) {alertes.push({type:'place',id:it.id,texte:'Pas assez de place pour '+nomDe(it,p)+'.'});continue;}
        Object.assign(it,valide);
      }
    }
    it.x = r2(it.x); it.z = r2(it.z);
    places.push({ it, p, b: boite(it, dim) });
    sortie.push(it);
  }
  // meubles retirés : conservés tels quels (l'éditeur les montre en fantôme)
  items.filter(it => it.garde === false).forEach(it => sortie.push({ ...it }));
  return { items: sortie, alertes };
}

// contrôle léger d'un agencement (après un déplacement à la main) : chevauchements et portes
export function verifier(modele, items, catalogue) {
  const portes = zonesPortes(modele), alertes = [];
  const tous = items.filter(it => it.garde !== false).map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p && e.p.dim);
  // les objets posés sur un meuble bas ne comptent pas au sol
  const sol = tous.filter(e => estAuSol(e.p.fam) && !estPlat(e.p.fam) && !porteurDe(e.it, e.p, tous))
    .map(e => ({ ...e, b: boite(e.it, e.p.dim) }));
  for (let i = 0; i < sol.length; i++) {
    if (!contientBoite(modele,sol[i].b)) alertes.push({type:'limites',ids:[sol[i].it.id]});
    for (let j = i + 1; j < sol.length; j++) if (chevauchement(sol[i].b, sol[j].b, -.03)) alertes.push({ type: 'chevauchement', ids: [sol[i].it.id, sol[j].it.id] });
    for (const z of portes) if (chevauchement(sol[i].b, z, -.03)) alertes.push({ type: 'porte', ids: [sol[i].it.id] });
  }
  return alertes;
}
