// Petite physique des animaux de l'accueil qu'on attrape et qu'on lance. Un animal est un corps rigide
// en deux boules (le ventre, la tête) qui tourne dans le plan de l'écran : il tombe, rebondit sur le
// sol, les murs, le plafond et les meubles (le canapé et les poufs font trampoline), roule, bascule sur
// le côté ; il ne traverse ni le sol ni les meubles. Tenu, il pend à la main par le haut de la tête
// (un ressort amorti) et se balance. Repère : celui de l'appartement (m), y vers le haut.
// Le corps : c = { x, y, z (centre de gravité), vx, vy, vz, a (rotation autour de z), w (sa vitesse) }.

const G = 9.8, MASSE = 1, INERTIE = .05;
export const CENTRE = .35;                       // hauteur du centre de gravité au-dessus des pieds (debout)
const BOULES = [[-.12, .2], [.23, .2]];          // [décalage le long du corps depuis le centre, rayon] : ventre, tête
export const PRISE = .45;                        // on le tient par le haut de la tête
const SOUS_PAS = 1 / 240;

// boîtes de collision de chaque meuble (repère du meuble, face avant vers +z) :
// [x, z, largeur, profondeur, bas, haut, rebond] ; les pieds fins et les tapis ne comptent pas
export const BOITES = {
  canape: [[0, .1, 2.1, .7, 0, .53, .85], [0, -.35, 2.1, .2, 0, .84, .5], [-.95, .1, .2, .7, .53, .62, .6], [.95, .1, .2, .7, .53, .62, .6]],
  fauteuil: [[0, .06, .8, .66, 0, .48, .75], [0, -.3, .8, .18, 0, .79, .5], [-.325, .06, .15, .66, .48, .57, .5], [.325, .06, .15, .66, .48, .57, .5]],
  pouf: [[0, 0, .46, .46, 0, .36, .8]],
  table: [[0, 0, 1, .55, .31, .36, .35]],
  gueridon: [[0, 0, .62, .62, .5, .54, .3], [0, 0, .06, .06, 0, .5, .3]],
  lampadaire: [[0, 0, .04, .04, 0, 1.4, .3], [0, 0, .36, .36, 1.38, 1.68, .4]],
  etagere: [[0, 0, 1, .34, 0, 1.9, .3]],
  plante: [[0, 0, .36, .36, 0, .36, .3], [0, 0, .55, .55, .72, 1.45, .5]],
  meubleTV: [[0, 0, 1.6, .44, 0, .45, .3], [0, -.07, 1.16, .06, .45, 1.24, .3]],
  panier: [[0, 0, .9, .9, 0, .16, .6]],
  griffoir: [[0, 0, .5, .5, 0, .05, .3], [0, 0, .14, .14, 0, 1.15, .3], [0, 0, .42, .42, .55, .6, .4], [0, 0, .46, .46, 1.1, 1.15, .4]]
};

const borne = (v, a, b) => Math.min(b, Math.max(a, v));

// le corps d'un animal debout, pieds en (x, y, z)
export function corpsDebout(x, y, z) {
  return { x, y: y + CENTRE, z, vx: 0, vy: 0, vz: 0, a: 0, w: 0 };
}
// où mettre les pieds (objet de l'animal) pour ce corps
export function pieds(c, out) {
  out.x = c.x + CENTRE * Math.sin(c.a);
  out.y = c.y - CENTRE * Math.cos(c.a);
  out.z = c.z;
  return out;
}

// boîtes d'un meuble placé (x, z, rotation r, y : soulevé) ; rend des boîtes prêtes à tester
export function boitesDe(type, x, y, z, r, cle) {
  return (BOITES[type] || []).map(([bx, bz, lx, lz, y0, y1, e]) => {
    const c = Math.cos(r), s = Math.sin(r);
    return { x: x + bx * c + bz * s, z: z - bx * s + bz * c, hx: lx / 2, hz: lz / 2, y0: y + y0, y1: y + y1, c, s, e, cle };
  });
}

// une impulsion au point de contact (rx, ry depuis le centre), normale n ; rend la vitesse d'impact
function choc(c, nx, ny, nz, rx, ry, e, mu) {
  let vcx = c.vx - c.w * ry, vcy = c.vy + c.w * rx, vcz = c.vz;
  const vn = vcx * nx + vcy * ny + vcz * nz;
  if (vn >= 0) return 0;
  const impact = -vn, rebond = impact < .8 ? 0 : e;
  const rn = rx * ny - ry * nx;
  const jn = -(1 + rebond) * vn / (1 / MASSE + rn * rn / INERTIE);
  c.vx += jn * nx / MASSE; c.vy += jn * ny / MASSE; c.vz += jn * nz / MASSE;
  c.w += rn * jn / INERTIE;
  // frottement : il roule plutôt qu'il ne glisse
  vcx = c.vx - c.w * ry; vcy = c.vy + c.w * rx; vcz = c.vz;
  const v2 = vcx * nx + vcy * ny + vcz * nz;
  const tx = vcx - v2 * nx, ty = vcy - v2 * ny, tz = vcz - v2 * nz, vt = Math.hypot(tx, ty, tz);
  if (vt > 1e-4) {
    const ux = tx / vt, uy = ty / vt, uz = tz / vt, rt = rx * uy - ry * ux;
    const jt = Math.max(-vt / (1 / MASSE + rt * rt / INERTIE), -mu * jn);
    c.vx += jt * ux / MASSE; c.vy += jt * uy / MASSE; c.vz += jt * uz / MASSE;
    c.w += rt * jt / INERTIE;
  }
  return impact;
}

// une boule (px, py, pz, rayon) contre une boîte : rend [nx, ny, nz, enfoncement] ou null
function contreBoite(b, px, py, pz, r) {
  const dx = px - b.x, dz = pz - b.z;
  const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
  const qx = borne(lx, -b.hx, b.hx), qy = borne(py, b.y0, b.y1), qz = borne(lz, -b.hz, b.hz);
  let ex = lx - qx, ey = py - qy, ez = lz - qz;
  const d = Math.hypot(ex, ey, ez);
  if (d >= r) return null;
  let pen;
  if (d > 1e-6) { ex /= d; ey /= d; ez /= d; pen = r - d; }
  else {
    // le centre est dedans : on sort par le côté le plus proche
    const cotes = [[b.hx - lx, 1, 0, 0], [lx + b.hx, -1, 0, 0], [b.y1 - py, 0, 1, 0], [py - b.y0, 0, -1, 0], [b.hz - lz, 0, 0, 1], [lz + b.hz, 0, 0, -1]];
    const m = cotes.reduce((p, q) => (q[0] < p[0] ? q : p));
    [, ex, ey, ez] = m;
    pen = m[0] + r;
  }
  // retour au repère de l'appartement
  return [ex * b.c + ez * b.s, ey, -ex * b.s + ez * b.c, pen];
}

// Avance le corps de dt. monde = { murs: [xmin, xmax], plafond, z: [zmin, zmax], boites, autres:
// [{ x, y, z, r, cle }] } ; tenu = { x, y, z } (où la main tient le haut de la tête) ou null.
// Rend { appui (il repose sur quelque chose : hauteur du dessus, ou -1), chocs: [{ cle, vitesse }] }.
export function avancer(c, dt, monde, tenu) {
  const res = { appui: -1, chocs: [] };
  const n = Math.max(1, Math.ceil(dt / SOUS_PAS)), h = dt / n;
  const vus = new Map();
  for (let k = 0; k < n; k++) {
    c.vy -= G * h;
    if (tenu) {
      // ressort amorti entre la main et le haut de la tête : il pend et se balance
      const sa = Math.sin(c.a), ca = Math.cos(c.a);
      const gx = -PRISE * sa, gy = PRISE * ca;
      const vgx = c.vx - c.w * gy, vgy = c.vy + c.w * gx;
      let fx = 260 * (tenu.x - (c.x + gx)) - 24 * vgx, fy = 260 * (tenu.y - (c.y + gy)) - 24 * vgy;
      const fz = 260 * (tenu.z - c.z) - 30 * c.vz;
      const f = Math.hypot(fx, fy);
      if (f > 420) { fx *= 420 / f; fy *= 420 / f; }
      c.vx += fx * h / MASSE; c.vy += fy * h / MASSE; c.vz += fz * h / MASSE;
      c.w += (gx * fy - gy * fx) * h / INERTIE;
      c.w *= Math.exp(-h * 2.5);
    } else {
      c.w *= Math.exp(-h * .15);
    }
    c.vx *= Math.exp(-h * .05); c.vz *= Math.exp(-h * (tenu ? 0 : 1.5));
    c.x += c.vx * h; c.y += c.vy * h; c.z += c.vz * h; c.a += c.w * h;

    const sa = Math.sin(c.a), ca = Math.cos(c.a);
    for (const [off, r] of BOULES) {
      const px = c.x - off * sa, py = c.y + off * ca, pz = c.z;
      const rx = px - c.x, ry = py - c.y;
      // sol
      let pen = r - py;
      if (pen > 0) {
        c.y += pen;
        const v = choc(c, 0, 1, 0, rx, ry - r, .45, .7);
        res.appui = Math.max(res.appui, 0);
        if (v > 1.2) vus.set('sol', Math.max(vus.get('sol') || 0, v));
      }
      // murs, plafond, avant et fond de la pièce
      pen = monde.murs[0] - (px - r);
      if (pen > 0) { c.x += pen; const v = choc(c, 1, 0, 0, rx - r, ry, .5, .4); if (v > 1.2) vus.set('mur', Math.max(vus.get('mur') || 0, v)); }
      pen = px + r - monde.murs[1];
      if (pen > 0) { c.x -= pen; const v = choc(c, -1, 0, 0, rx + r, ry, .5, .4); if (v > 1.2) vus.set('mur', Math.max(vus.get('mur') || 0, v)); }
      pen = py + r - monde.plafond;
      if (pen > 0) { c.y -= pen; choc(c, 0, -1, 0, rx, ry + r, .3, .3); }
      pen = monde.z[0] - (pz - r);
      if (pen > 0) { c.z += pen; choc(c, 0, 0, 1, rx, ry, .3, .3); }
      pen = pz + r - monde.z[1];
      if (pen > 0) { c.z -= pen; choc(c, 0, 0, -1, rx, ry, .3, .3); }
      // meubles
      for (const b of monde.boites) {
        const t = contreBoite(b, c.x - off * Math.sin(c.a), c.y + off * Math.cos(c.a), c.z, r);
        if (!t) continue;
        const [nx, ny, nz, p] = t;
        c.x += nx * p; c.y += ny * p; c.z += nz * p;
        const v = choc(c, nx, ny, nz, rx - nx * r, ry - ny * r, b.e, .6);
        if (ny > .7) res.appui = Math.max(res.appui, b.y1);
        if (v > .9) vus.set(b.cle, Math.max(vus.get(b.cle) || 0, v));
      }
      // les autres animaux (immobiles pour lui) : on les bouscule
      for (const o of monde.autres) {
        const dx = c.x - off * Math.sin(c.a) - o.x, dy = c.y + off * Math.cos(c.a) - o.y, dz = c.z - o.z, d = Math.hypot(dx, dy, dz);
        if (d >= r + o.r || d < 1e-6) continue;
        const nx = dx / d, ny = dy / d, nz = dz / d, p = r + o.r - d;
        c.x += nx * p; c.y += ny * p; c.z += nz * p;
        const v = choc(c, nx, ny, nz, rx - nx * r, ry - ny * r, .5, .3);
        if (v > .6) vus.set(o.cle, Math.max(vus.get(o.cle) || 0, v));
      }
    }
  }
  vus.forEach((vitesse, cle) => res.chocs.push({ cle, vitesse }));
  return res;
}
