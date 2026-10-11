// Grille de coordonnées critiques : les bords d'obstacles sont échantillonnés explicitement.
// Évite de déclarer bloqué un passage de 92 cm parce qu'aucune cellule régulière ne tombe dedans.
// Les obstacles restent dilatés de 45 cm ; aucun dégagement n'est réduit.
import { contientPoint, contientBoite } from './contour.js';
const dedans = (p, b) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const local = (it, x, z) => ({ x: it.x + Math.cos(it.rot || 0) * x + Math.sin(it.rot || 0) * z, z: it.z - Math.sin(it.rot || 0) * x + Math.cos(it.rot || 0) * z });
function ciblesDe(e) {
  const [w, d] = e.p.dim, role = e.role;
  if (role === 'lit') return [local(e.it, -w / 2 - .4, .25), local(e.it, w / 2 + .4, .25), local(e.it, 0, d / 2 + .4)];
  if (['canape', 'fauteuil', 'meridienne'].includes(role)) return [local(e.it, -w / 2 - .4, d / 2), local(e.it, w / 2 + .4, d / 2), local(e.it, 0, d / 2 + .4)];
  if (['rangement', 'bureau'].includes(role)) return [-.25, 0, .25].map(x => local(e.it, x * w, d / 2 + .45));
  if (role === 'repas') return [local(e.it, 0, d / 2 + .95), local(e.it, 0, -d / 2 - .95), local(e.it, -w / 2 - .95, 0), local(e.it, w / 2 + .95, 0)];
  return [];
}
export function circulationZones(modele, sol, portes, largeur = .9) {
  const L = modele.dims.largeur, P = modele.dims.profondeur, rayon = largeur / 2, eps = .003;
  const obstacles = sol.map(e => ({ x0: e.b.x0 - rayon, x1: e.b.x1 + rayon, z0: e.b.z0 - rayon, z1: e.b.z1 + rayon }));
  const entrees = portes.map(b => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }));
  const besoins = sol.map(e => ({ id: e.it.id, cibles: ciblesDe(e) }));
  const points = [...entrees, ...besoins.flatMap(e => e.cibles), { x: 0, z: 0 }];
  const axe = (cle, taille) => [...new Set([ -taille / 2 + rayon + eps, taille / 2 - rayon - eps,
    ...points.map(p => p[cle]), ...obstacles.flatMap(b => [b[`${cle}0`] - eps, b[`${cle}1`] + eps]),
    ...Array.from({ length: 12 }, (_, i) => -taille / 2 + rayon + (taille - 2 * rayon) * i / 11)
  ].filter(v => v >= -taille / 2 + rayon && v <= taille / 2 - rayon).map(v => Math.round(v * 10000) / 10000))].sort((a, b) => a - b);
  const xs = axe('x', L), zs = axe('z', P), nx = xs.length, n = nx * zs.length, libre = new Uint8Array(n), vu = new Uint8Array(n);
  const coord = i => ({ x: xs[i % nx], z: zs[Math.floor(i / nx)] });
  for (let i = 0; i < n; i++) { const p = coord(i); libre[i] = contientPoint(modele, p.x, p.z, rayon) && !obstacles.some(b => dedans(p, b)) ? 1 : 0; }
  const proche = (p, limite) => { let min = limite, idx = -1; for (let i = 0; i < n; i++) if (libre[i] && distance(p, coord(i)) < min) { min = distance(p, coord(i)); idx = i; } return idx; };
  const seeds = entrees.length ? entrees.map(p => proche(p, .42)) : [proche({ x: 0, z: 0 }, Math.max(L, P))];
  const file = []; if (seeds[0] >= 0) { file.push(seeds[0]); vu[seeds[0]] = 1; }
  function lien(a, b) {
    const p = coord(a), q = coord(b), x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), z0 = Math.min(p.z, q.z), z1 = Math.max(p.z, q.z);
    if (!contientBoite(modele, { x0: x0 - rayon, x1: x1 + rayon, z0: z0 - rayon, z1: z1 + rayon })) return false;
    return !obstacles.some(o => (x0 === x1 ? x0 > o.x0 && x0 < o.x1 && z1 > o.z0 && z0 < o.z1 : z0 > o.z0 && z0 < o.z1 && x1 > o.x0 && x0 < o.x1));
  }
  for (let k = 0; k < file.length; k++) { const i = file[k], x = i % nx, z = Math.floor(i / nx);
    for (const j of [x ? i - 1 : -1, x < nx - 1 ? i + 1 : -1, z ? i - nx : -1, z < zs.length - 1 ? i + nx : -1]) if (j >= 0 && libre[j] && !vu[j] && lien(i, j)) { vu[j] = 1; file.push(j); }
  }
  const atteint = p => { const i = proche(p, .35); return i >= 0 && vu[i] === 1; };
  return { portesBloquees: seeds.filter(i => i < 0 || !vu[i]).length, inaccessibles: besoins.filter(e => e.cibles.length && !e.cibles.some(atteint)).map(e => e.id), portesConnues: portes.length > 0, surfaceLibre: null };
}
