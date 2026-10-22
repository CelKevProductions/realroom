// Les chemins des animaux de l'accueil : dans un appartement meublé, ils contournent les meubles au lieu
// de les traverser. Une grille de 8 cm couvre la pièce ; l'emprise au sol de chaque meuble (élargie de
// la carrure d'un animal) la bouche ; A* trouve le chemin, puis on ne garde que les points où il faut
// tourner (on file tout droit tant que la ligne reste libre). Repère : celui de l'appartement (m).

const PAS = .08, X0 = -1.98, X1 = 1.98, Z0 = -1.5, Z1 = 1.42, CARRURE = .17;
const NX = Math.round((X1 - X0) / PAS) + 1, NZ = Math.round((Z1 - Z0) / PAS) + 1;
const VOISINS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

const cellule = (x, z) => [Math.round((Math.min(X1, Math.max(X0, x)) - X0) / PAS), Math.round((Math.min(Z1, Math.max(Z0, z)) - Z0) / PAS)];
const centre = (i, j) => [X0 + i * PAS, Z0 + j * PAS];

// la grille d'une disposition : emprises = [{ x, z, r, lx, lz }] (centre, rotation, emprise au sol)
export function grille(emprises) {
  const bloque = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const [x, z] = centre(i, j);
    for (const e of emprises) {
      const dx = x - e.x, dz = z - e.z, c = Math.cos(e.r), s = Math.sin(e.r);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.hypot(Math.max(Math.abs(lx) - e.lx / 2, 0), Math.max(Math.abs(lz) - e.lz / 2, 0)) < CARRURE) { bloque[j * NX + i] = 1; break; }
    }
  }
  return bloque;
}

const libre = (b, i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && !b[j * NX + i];
// la cellule libre la plus proche (en largeur d'abord)
function plusProche(b, i0, j0) {
  if (libre(b, i0, j0)) return [i0, j0];
  const vu = new Uint8Array(NX * NZ), file = [[i0, j0]];
  vu[j0 * NX + i0] = 1;
  while (file.length) {
    const [i, j] = file.shift();
    for (const [di, dj] of VOISINS) {
      const a = i + di, c = j + dj;
      if (a < 0 || c < 0 || a >= NX || c >= NZ || vu[c * NX + a]) continue;
      if (libre(b, a, c)) return [a, c];
      vu[c * NX + a] = 1;
      file.push([a, c]);
    }
  }
  return [i0, j0];
}
// la ligne droite reste-t-elle libre ?
function ligneLibre(b, x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (PAS * .5));
  for (let k = 1; k < n; k++) {
    const [i, j] = cellule(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n);
    if (!libre(b, i, j)) return false;
  }
  return true;
}

// le point libre le plus proche de (x, z)
export function pointLibre(b, x, z) {
  const [i, j] = cellule(x, z);
  return libre(b, i, j) ? [x, z] : centre(...plusProche(b, i, j));
}

// chemin de (de) à (vers), sans le point de départ : [[x, z], …] ; tout droit si rien ne gêne
export function chemin(b, de, vers) {
  if (!b || ligneLibre(b, de[0], de[1], vers[0], vers[1])) return [vers];
  const [si, sj] = plusProche(b, ...cellule(...de)), [ai, aj] = plusProche(b, ...cellule(...vers));
  const depart = sj * NX + si, arrivee = aj * NX + ai, n = NX * NZ;
  const g = new Float32Array(n).fill(Infinity), parent = new Int32Array(n).fill(-1), ferme = new Uint8Array(n);
  const h = k => Math.hypot(k % NX - ai, Math.floor(k / NX) - aj);
  const ouverts = [depart];
  g[depart] = 0;
  while (ouverts.length) {
    // la file est courte (quelques centaines de cellules) : un tri suffit
    let m = 0;
    for (let k = 1; k < ouverts.length; k++) if (g[ouverts[k]] + h(ouverts[k]) < g[ouverts[m]] + h(ouverts[m])) m = k;
    const k = ouverts.splice(m, 1)[0];
    if (k === arrivee) break;
    if (ferme[k]) continue;
    ferme[k] = 1;
    const i = k % NX, j = Math.floor(k / NX);
    for (const [di, dj, cout] of VOISINS) {
      const a = i + di, c = j + dj;
      if (!libre(b, a, c)) continue;
      // pas de coin coupé en diagonale
      if (di && dj && (!libre(b, i + di, j) || !libre(b, i, j + dj))) continue;
      const v = c * NX + a, ng = g[k] + cout;
      if (ng < g[v]) { g[v] = ng; parent[v] = k; ouverts.push(v); }
    }
  }
  if (parent[arrivee] < 0 && arrivee !== depart) return [vers];
  const cases = [];
  for (let k = arrivee; k >= 0; k = parent[k]) cases.unshift(centre(k % NX, Math.floor(k / NX)));
  // on tire des lignes droites : seuls restent les points où il faut tourner
  const points = [];
  let ici = de;
  for (let k = 1; k < cases.length; k++) {
    if (!ligneLibre(b, ici[0], ici[1], cases[k][0], cases[k][1])) { points.push(cases[k - 1]); ici = cases[k - 1]; }
  }
  points.push(vers);
  return points;
}
