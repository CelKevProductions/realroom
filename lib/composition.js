// Le modèle choisit des produits et des zones ; toutes les coordonnées sont calculées ici.
// Les anciennes sorties x/p/mur/hauteur_pose sont ignorées, y compris en mode partiel.
import { segmentsDe, poseAuPan } from './contour.js';
import { demiEmpreinte, estMural, estSuspendu, murProche, placerAuMur, produitDe, normaliserAngle } from './agencement.js';
import { roleDe, bilanConfort } from './confort.js';
import { instancierPatrons } from './patrons.js';

export const ZONES = ['couchage', 'salon', 'repas', 'travail', 'rangement', 'lecture', 'eclairage', 'decoration'];
const rond = n => Math.round(n * 100) / 100;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const local = (it, x, z) => ({ x: rond(it.x + Math.cos(it.rot || 0) * x + Math.sin(it.rot || 0) * z), z: rond(it.z - Math.sin(it.rot || 0) * x + Math.cos(it.rot || 0) * z) });
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h.toString(36); };
function borne(it, p, dims) {
  const [hx, hz] = demiEmpreinte(p.dim, it.rot || 0);
  return { ...it, x: rond(clamp(it.x, -dims.largeur / 2 + hx, dims.largeur / 2 - hx)), z: rond(clamp(it.z, -dims.profondeur / 2 + hz, dims.profondeur / 2 - hz)) };
}
function auMur(it, p, mur, offset, dims) {
  const rot = { fond: 0, entree: Math.PI, gauche: Math.PI / 2, droite: -Math.PI / 2 }[mur];
  const [hx, hz] = demiEmpreinte(p.dim, rot), L = dims.largeur, P = dims.profondeur;
  return borne({ ...it, rot, x: mur === 'gauche' ? -L / 2 + hx + .04 : mur === 'droite' ? L / 2 - hx - .04 : offset * Math.max(0, L / 2 - hx),
    z: mur === 'fond' ? -P / 2 + hz + .04 : mur === 'entree' ? P / 2 - hz - .04 : offset * Math.max(0, P / 2 - hz) }, p, dims);
}

export function amorcerDisposition(modele, choix, existants, catalogue, opts = {}) {
  const ids = new Set(existants.map(it => it.id));
  const prefixe = hash(JSON.stringify([modele.dims, [...ids].sort(), choix.map(m => m.produit), opts.preferences]));
  const nouveaux = choix.map((m, i) => {
    let id = `c${prefixe}_${i}`;
    while (ids.has(id)) id += '_';
    ids.add(id);
    const p = catalogue[m.produit], role = roleDe(p);
    let it = { id, origine: 'catalogue', sku: m.produit, x: 0, z: 0, rot: 0, raison: String(m.raison || '').slice(0, 240) };
    const remplace = opts.mode === 'partiel' && existants.find(e => e.garde === false && roleDe(produitDe(e, catalogue)) === role);
    if (remplace) return { ...it, x: remplace.x, z: remplace.z, rot: remplace.rot || 0 };
    if (['lit', 'canape', 'rangement', 'bureau', 'baignoire', 'banc', 'meridienne'].includes(role)) {
      const mur = role === 'canape' || role === 'bureau' ? 'gauche' : role === 'rangement' ? 'droite' : 'fond';
      it = auMur(it, p, mur, role === 'bureau' ? .55 : role === 'rangement' ? -.5 : 0, modele.dims);
    }
    return it;
  });
  const fixe = existants.filter(it => it.garde !== false);
  const donnees = liste => [...fixe, ...liste].map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p)
    .map(e => ({ ...e, role: roleDe(e.p) }));
  const es = donnees(nouveaux), mobiles = es.filter(e => nouveaux.some(it => it.id === e.it.id));
  const patrons = opts.mode === 'partiel' ? [] : instancierPatrons(modele, mobiles, es, opts.preferences);
  const depart = [nouveaux, ...patrons.map(p => nouveaux.map(it => ({ ...it, ...(p.slots.find(s => s.id === it.id)?.position || {}) })))];
  // Même en partiel, un ajout ne doit pas être rejeté faute d'avoir essayé un autre mur.
  // Seuls les nouveaux éléments changent de départ ; toutes les observations restent fixées.
  const ancre = mobiles.find(e => ['lit', 'canape', 'bureau', 'rangement'].includes(e.role));
  if (ancre && modele.contour) for (const pan of segmentsDe(modele)) for (const offset of [-.45,0,.45]) depart.push(nouveaux.map(it=>it.id===ancre.it.id ? poseAuPan(pan,it,ancre.p.dim,offset) : it));
  if (ancre) for (const mur of ['fond', 'gauche', 'droite', 'entree']) for (const offset of [-.45, 0, .45]) {
    const pose = auMur(ancre.it, ancre.p, mur, offset, modele.dims);
    const [hx, hz] = demiEmpreinte(ancre.p.dim, pose.rot);
    if (2 * hx <= modele.dims.largeur && 2 * hz <= modele.dims.profondeur) depart.push(nouveaux.map(it => it.id === ancre.it.id ? pose : it));
  }

  function grouper(liste) {
    const poses = donnees(liste), compte = new Map();
    const trouver = roles => poses.find(e => roles.includes(e.role));
    return liste.map((it, i) => {
      const p = catalogue[it.sku], role = roleDe(p), zone = ZONES.includes(choix[i].zone) ? choix[i].zone : null;
      let ancre, dx = 0, dz = 0, rot;
      const rang = compte.get(role) || 0; compte.set(role, rang + 1);
      if (role === 'appoint') {
        ancre = trouver(['lit']);
        if (ancre) { dx = (rang % 2 ? 1 : -1) * (ancre.p.dim[0] / 2 + p.dim[0] / 2 + .06); dz = -ancre.p.dim[1] / 2 + p.dim[1] / 2 + .05; }
      } else if (role === 'table-basse') {
        ancre = trouver(['canape']); if (ancre) dz = ancre.p.dim[1] / 2 + p.dim[1] / 2 + .42;
      } else if (['chaise', 'tabouret'].includes(role)) {
        ancre = trouver(['repas']);
        if (ancre) { dx = (rang % 2 ? 1 : -1) * Math.max(.15, ancre.p.dim[0] / 2 - p.dim[0] / 2); dz = (rang % 4 < 2 ? 1 : -1) * (ancre.p.dim[1] / 2 + p.dim[1] / 2 + .1); rot = normaliserAngle(ancre.it.rot + (rang % 4 < 2 ? Math.PI : 0)); }
      } else if (role === 'fauteuil') {
        ancre = trouver(['canape', 'lit']);
        if (ancre) { dx = (rang % 2 ? 1 : -1) * (ancre.p.dim[0] / 2 + p.dim[0] / 2 + .5); dz = .8; }
      } else if (role === 'tapis' || estSuspendu(p.fam)) {
        ancre = trouver(estSuspendu(p.fam) ? ['repas', 'canape', 'lit'] : ['table-basse', 'canape', 'lit']);
      } else if (['lampadaire', 'lampe', 'applique'].includes(role)) {
        ancre = trouver(zone === 'travail' ? ['bureau'] : ['fauteuil', 'canape', 'lit', 'bureau']);
        if (ancre) { dx = (rang % 2 ? 1 : -1) * (ancre.p.dim[0] / 2 + p.dim[0] / 2 + .15); dz = -.15; }
      } else if (role === 'miroir') ancre = trouver(['rangement', 'bureau']);
      let pose = ancre ? { ...it, ...local(ancre.it, dx, dz), rot: rot ?? ancre.it.rot ?? 0 } : it;
      if (ancre && role === 'fauteuil') pose.rot = normaliserAngle(Math.atan2(ancre.it.x - pose.x, ancre.it.z - pose.z));
      if (estMural(p.fam)) {
        pose = placerAuMur(modele, { ...pose, y: role === 'applique' ? 1.65 : 1.5 }, p.dim, murProche(modele, pose.x, pose.z));
      } else pose = borne(pose, p, modele.dims);
      // Un tapis ou une lampe traité ensuite voit la table/le fauteuil déjà regroupé.
      const entree = poses.find(e => e.it.id === it.id);
      if (entree) entree.it = pose;
      return pose;
    });
  }
  const candidats = depart.map(grouper).map(items => ({ items, bilan: bilanConfort(modele, [...existants, ...items], catalogue, opts.langue, opts) }));
  candidats.sort((a, b) => a.bilan.score.contraintes - b.bilan.score.contraintes || a.bilan.score.cout - b.bilan.score.cout);
  return { items: candidats[0]?.items || [], diagnostic: { source: 'solveur', departSemantique: true, compositionsTestees: candidats.length } };
}
