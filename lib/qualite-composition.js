// Qualité de composition d'un séjour : ce qui distingue un plan agréable d'un plan seulement admissible.
// Les contraintes dures (collisions, accès, circulation) restent ailleurs ; ici, uniquement des pénalités
// lisibles, en points : meubles adossés loin d'un mur, canapé et télévision qui ne se font pas face,
// fauteuils tournés vers l'extérieur du salon.
import { produitDe, estPosable, porteurDe, boite, estAuSol, estPlat } from './agencement.js';
import { segmentsDe, distanceSegment, contourDe, aireSignee } from './contour.js';
import { roleFonctionDe } from './roles.js';

const face = it => [Math.sin(it.rot || 0), Math.cos(it.rot || 0)];
const local = (it, x, z) => [it.x + Math.cos(it.rot || 0) * x + Math.sin(it.rot || 0) * z, it.z - Math.sin(it.rot || 0) * x + Math.cos(it.rot || 0) * z];
const vers = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1; return { u: [dx / d, dz / d], d }; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const dansBoite = (q, e) => { const b = boite(e.it, e.p.dim); return q[0] > b.x0 && q[0] < b.x1 && q[1] > b.z0 && q[1] < b.z1; };

// distance entre le dos d'un meuble et le mur qui lui fait dos (Infinity s'il n'y en a pas)
export function distanceAuMur(modele, it, dim) {
  const dos = local(it, 0, -dim[1] / 2), f = face(it);
  let min = Infinity;
  for (const s of segmentsDe(modele)) if (dot(f, s.n) > .7) min = Math.min(min, distanceSegment(dos, s.a, s.b));
  return min;
}

// centre du sol : barycentre du contour (dans une pièce en L, le centre du cadre peut tomber hors du sol)
function centreSol(modele) {
  if (!modele.contour) return [0, 0];
  const ps = contourDe(modele), A = aireSignee(ps);
  if (Math.abs(A) < 1e-6) return [0, 0];
  let cx = 0, cz = 0;
  ps.forEach((p, i) => { const q = ps[(i + 1) % ps.length], k = p[0] * q[1] - q[0] * p[1]; cx += (p[0] + q[0]) * k; cz += (p[1] + q[1]) * k; });
  return [cx / (6 * A), cz / (6 * A)];
}

// usages du programme qui vont contre un mur ; les meubles hors programme ne sont pas notés ici
const ADOSSES = new Set(['rangement', 'buffet', 'bibliotheque', 'commode', 'armoire', 'etagere']);

export function noteComposition(modele, items, catalogue, { equilibre = true } = {}) {
  const es = items.filter(it => it.garde !== false).map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p?.dim)
    .map(e => ({ ...e, role: roleFonctionDe(e.it, e.p) }));
  const termes = { murs: 0, focal: 0, assises: 0, equilibre: 0, ecartAssises: 0 };
  const loin = (e, poids) => { const d = distanceAuMur(modele, e.it, e.p.dim); termes.murs += poids * Math.min(2, Math.max(0, d - .05)); };
  // la télévision est portée par son meuble (meuble TV, buffet, commode…) : c'est ce meuble qui doit être au mur
  const meubleTV = es.find(e => e.it.usageProgramme === 'meuble-tv');
  const ecran = es.find(e => ['tv', 'tv-murale'].includes(e.p.fam) || e.it.usageProgramme === 'television');
  const focal = meubleTV || (ecran && porteurDe(ecran.it, ecran.p, es)) || ecran || null;
  if (focal && focal.p.fam !== 'tv-murale') loin(focal, 60);
  for (const e of es) if (e !== focal && ADOSSES.has(e.it.usageProgramme)) loin(e, 30);
  const canape = es.find(e => e.it.usageProgramme === 'canape');
  if (canape) {
    // un canapé peut flotter dos à un autre espace ; on le préfère quand même près d'un mur
    loin(canape, 8);
    if (focal) {
      const { u, d } = vers([canape.it.x, canape.it.z], [focal.it.x, focal.it.z]);
      termes.focal += 50 * Math.max(0, .9 - dot(face(canape.it), u)) + 50 * Math.max(0, .9 - dot(face(focal.it), [-u[0], -u[1]]));
      termes.focal += 25 * (Math.max(0, 1.8 - d) + Math.max(0, d - 3.6));
    }
  }
  // fauteuils : tournés vers le cœur du salon (entre le canapé et l'écran, ou la table basse)
  const table = es.find(e => e.it.usageProgramme === 'table-basse');
  const coeur = table ? [table.it.x, table.it.z] : canape && focal ? [(canape.it.x + focal.it.x) / 2, (canape.it.z + focal.it.z) / 2] : null;
  if (coeur) for (const e of es.filter(e => e.it.usageProgramme === 'fauteuil-salon')) {
    const { u, d } = vers([e.it.x, e.it.z], coeur);
    termes.assises += 30 * Math.max(0, .5 - dot(face(e.it), u)) + 15 * Math.max(0, d - 2.2);
    termes.ecartAssises += 1 - dot(face(e.it), u);   // départage seulement : hors pénalité
    // un fauteuil derrière le canapé ne fait pas partie du salon, même tourné vers la table
    if (canape && [.3, .5, .7].some(t => dansBoite([e.it.x + (coeur[0] - e.it.x) * t, e.it.z + (coeur[1] - e.it.z) * t], canape))) termes.assises += 45;
  }
  // équilibre : le mobilier ne doit pas s'entasser dans une moitié de la pièce
  // (à ne mesurer que sur un plan complet : un ensemble seul serait poussé au centre)
  const sol = es.filter(e => estAuSol(e.p.fam) && !estPlat(e.p.fam) && !(estPosable(e.p.fam, e.p.dim) && porteurDe(e.it, e.p, es)));
  const masse = sol.reduce((s, e) => s + e.p.dim[0] * e.p.dim[1], 0);
  if (equilibre && sol.length >= 4 && masse && sol.every(e => e.it.zoneId)) {
    const L = modele.dims.largeur, P = modele.dims.profondeur;
    const cx = sol.reduce((s, e) => s + e.p.dim[0] * e.p.dim[1] * e.it.x, 0) / masse, cz = sol.reduce((s, e) => s + e.p.dim[0] * e.p.dim[1] * e.it.z, 0) / masse;
    const [x0, z0] = centreSol(modele);
    termes.equilibre = 150 * Math.max(0, Math.hypot((cx - x0) / L, (cz - z0) / P) - .05);
  }
  const penalite = termes.murs + termes.focal + termes.assises + termes.equilibre;
  return { penalite: Math.round(penalite * 10) / 10, note: Math.round(100 * Math.exp(-penalite / 120)), termes };
}

// Dernière passe : tourner chaque fauteuil du salon vers le cœur du salon (pas de 45°), si cela
// n'ajoute aucun problème. On essaie les huit orientations de la mieux notée à la moins bien notée
// (à pénalité égale, la plus franchement tournée vers le cœur) ; `controle(items)` renvoie le nombre
// de problèmes (contraintes, accès, circulation, zones du plan).
export function orienterAssises(modele, items, catalogue, controle) {
  const mesure = liste => { const n = noteComposition(modele, liste, catalogue); return { penalite: n.penalite, ecart: n.termes.ecartAssises }; };
  let courant = items, note = mesure(courant), base = null;
  for (const f of items.filter(it => it.garde !== false && it.usageProgramme === 'fauteuil-salon' && !it.fixe)) {
    const essais = Array.from({ length: 8 }, (_, k) => {
      const rot = -Math.PI + (k + 1) * Math.PI / 4;   // ]-π, π]
      const liste = courant.map(it => (it.id === f.id ? { ...it, rot } : it));
      return { liste, ...mesure(liste) };
    }).filter(e => e.penalite < note.penalite - .5 || (e.penalite <= note.penalite && e.ecart < note.ecart - .1))
      .sort((a, b) => a.penalite - b.penalite || a.ecart - b.ecart);
    for (const e of essais) {
      if (base === null) base = controle(courant);
      const n = controle(e.liste);
      if (n <= base) { courant = e.liste; note = e; base = n; break; }
    }
  }
  return courant;
}
