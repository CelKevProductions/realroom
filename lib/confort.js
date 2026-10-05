// Repères d'usage indicatifs en mètres, calculés sur la maquette (pas des normes d'accessibilité).
// Le placement reste déterministe et ne choisit ni de nouveaux produits ni de nouveaux rendus.
import { boite, demiEmpreinte, estAdosse, estAuSol, estPlat, estSuspendu, normaliserAngle, porteurDe, produitDe, zonesPortes } from './agencement.js';
import { estInstallation, familleReleve, usageDe } from './usages.js';

export const REPERES = Object.freeze({ passage: .9, tableBasse: .42, lit: .6, rangement: .8, travail: .8 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rond = v => Math.round(v * 100) / 100;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const valide = p => p?.dim?.length === 3 && p.dim.every(v => Number.isFinite(v) && v > 0);
const surface = b => Math.max(0, b.x1 - b.x0) * Math.max(0, b.z1 - b.z0);
function intersection(a, b, marge = 0) {
  return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + marge)
    * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) + marge);
}
const dilater = (b, d) => ({ x0: b.x0 - d, x1: b.x1 + d, z0: b.z0 - d, z1: b.z1 + d });
const pointDans = (p, b) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
function donnees(items, catalogue) {
  return items.filter(it => it.garde !== false).map(it => ({ it, p: produitDe(it, catalogue) }))
    .filter(e => valide(e.p) && Number.isFinite(e.it.x) && Number.isFinite(e.it.z))
    .map(e => ({ ...e, b: boite(e.it, e.p.dim), role: roleDe(e.p) }));
}
export function roleDe(p) {
  if (usageDe(p) === 'travail') return 'bureau';
  if (usageDe(p) === 'chevet') return 'appoint';
  if (familleReleve({ ...p, famille: p.fam }) === 'radiateur') return 'radiateur';
  if (p.fam === 'table') {
    if (/chevet|bedside|appoint|side table/i.test([p.nom, p.st, p.titre].join(' '))) return 'appoint';
    return p.dim[2] < .59 ? 'table-basse' : 'repas';
  }
  if (['armoire', 'dressing', 'commode', 'buffet', 'bibliotheque', 'etagere', 'meuble'].includes(p.fam)) return 'rangement';
  return p.fam;
}
function local(it, x, z) {
  const r = it.rot || 0, c = Math.cos(r), s = Math.sin(r);
  return { x: it.x + c * x + s * z, z: it.z - s * x + c * z };
}
function zone(it, x, z, w, d) { return boite({ ...local(it, x, z), rot: it.rot || 0 }, [w, d, 1]); }

function acces(e) {
  const { it, p, role } = e, [w, d] = p.dim;
  if (role === 'lit') {
    const avant = zone(it, 0, d / 2 + .325, w, .65);
    const cote = Math.max(.4, d - .65);
    const gauche = zone(it, -w / 2 - .3, .325, .6, cote);
    const droite = zone(it, w / 2 + .3, .325, .6, cote);
    return [{ zones: [avant] }, { zones: [gauche, droite], choix: w < 1.3 }];
  }
  const profondeur = role === 'rangement' ? REPERES.rangement : role === 'bureau' ? REPERES.travail : ['canape', 'fauteuil', 'meridienne'].includes(role) ? .32 : 0;
  if (profondeur) return [{ zones: [zone(it, 0, d / 2 + profondeur / 2, w * .88, profondeur)] }];
  if (role === 'repas') return [{ zones: [zone(it, 0, d / 2 + .4, w, .8), zone(it, 0, -d / 2 - .4, w, .8), zone(it, -w / 2 - .4, 0, .8, d), zone(it, w / 2 + .4, 0, .8, d)], repas: true }];
  if (role === 'chaise') return [{ zones: [zone(it, 0, -d / 2 - .275, w, .55)] }];
  return [];
}
function fenetres(modele) {
  const L = modele.dims.largeur, P = modele.dims.profondeur;
  return Object.entries(modele.murs || {}).flatMap(([mur, m]) => (m.ouvertures || [])
    .filter(o => o.type === 'fenetre' || (o.type === 'baie' && o.allege > .05))
    .map(o => {
      const a = (o.position || 0) - o.largeur / 2, b = (o.position || 0) + o.largeur / 2;
      const zone = mur === 'fond' ? { x0: a, x1: b, z0: -P / 2, z1: -P / 2 + .4 }
        : mur === 'entree' ? { x0: a, x1: b, z0: P / 2 - .4, z1: P / 2 }
        : mur === 'gauche' ? { x0: -L / 2, x1: -L / 2 + .4, z0: a, z1: b }
        : { x0: L / 2 - .4, x1: L / 2, z0: a, z1: b };
      return { ...zone, allege: o.allege || 0, mur };
    }));
}

// La grille élargit les obstacles d'un demi-passage : un simple espace de 4 cm ne devient pas un chemin.
function circulation(modele, sol, portes) {
  const { largeur: L, profondeur: P } = modele.dims;
  const pas = Math.max(.18, Math.sqrt(L * P / 3200)), rayon = REPERES.passage / 2;
  const nx = Math.max(1, Math.floor(L / pas)), nz = Math.max(1, Math.floor(P / pas));
  const dx = L / nx, dz = P / nz, cellules = nx * nz, libre = new Uint8Array(cellules);
  const obstacles = sol.map(e => dilater(e.b, rayon));
  const coord = i => ({ x: -L / 2 + (i % nx + .5) * dx, z: -P / 2 + (Math.floor(i / nx) + .5) * dz });
  for (let i = 0; i < cellules; i++) {
    const p = coord(i);
    libre[i] = Math.abs(p.x) <= L / 2 - rayon && Math.abs(p.z) <= P / 2 - rayon && !obstacles.some(b => pointDans(p, b)) ? 1 : 0;
  }
  const proche = (p, limite = .42) => {
    let meilleur = -1, min = limite;
    for (let i = 0; i < cellules; i++) if (libre[i]) { const d = distance(p, coord(i)); if (d < min) { min = d; meilleur = i; } }
    return meilleur;
  };
  const entrees = portes.map(b => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }));
  // Sans porte détectée, on peut seulement contrôler la connexion à une zone libre centrale.
  const seeds = entrees.length ? entrees.map(p => proche(p)) : [proche({ x: 0, z: 0 }, Math.max(L, P))];
  const vu = new Uint8Array(cellules), file = new Int32Array(cellules);
  let debut = 0, fin = 0;
  if (seeds[0] >= 0) { file[fin++] = seeds[0]; vu[seeds[0]] = 1; }
  while (debut < fin) {
    const i = file[debut++], x = i % nx, z = Math.floor(i / nx);
    for (const j of [x ? i - 1 : -1, x < nx - 1 ? i + 1 : -1, z ? i - nx : -1, z < nz - 1 ? i + nx : -1]) {
      if (j >= 0 && libre[j] && !vu[j]) { vu[j] = 1; file[fin++] = j; }
    }
  }
  const atteint = p => { const i = proche(p, .35); return i >= 0 && vu[i] === 1; };
  const inaccessibles = [];
  for (const e of sol) {
    const [w, d] = e.p.dim, r = e.role;
    let cibles = [];
    if (r === 'lit') cibles = [local(e.it, -w / 2 - .4, .25), local(e.it, w / 2 + .4, .25), local(e.it, 0, d / 2 + .4)];
    else if (['canape', 'fauteuil', 'meridienne'].includes(r)) cibles = [local(e.it, -w / 2 - .4, d / 2), local(e.it, w / 2 + .4, d / 2), local(e.it, 0, d / 2 + .4)];
    else if (['rangement', 'bureau'].includes(r)) cibles = [-.25, 0, .25].map(x => local(e.it, x * w, d / 2 + .45));
    else if (r === 'repas') cibles = [local(e.it, 0, d / 2 + .95), local(e.it, 0, -d / 2 - .95), local(e.it, -w / 2 - .95, 0), local(e.it, w / 2 + .95, 0)];
    if (cibles.length && !cibles.some(atteint)) inaccessibles.push(e.it.id);
  }
  return { portesBloquees: seeds.filter(i => i < 0 || !vu[i]).length, inaccessibles, portesConnues: portes.length > 0, surfaceLibre: fin * dx * dz };
}

function evaluer(modele, items, catalogue, avecChemins = true) {
  const es = donnees(items, catalogue), L = modele.dims.largeur, P = modele.dims.profondeur;
  const piece = { x0: -L / 2, x1: L / 2, z0: -P / 2, z1: P / 2 };
  const sol = es.filter(e => estAuSol(e.p.fam) && !estPlat(e.p.fam) && !porteurDe(e.it, e.p, es));
  const portes = zonesPortes(modele), ouvertures = fenetres(modele), soucis = [], ajouter = (type, ids) => soucis.push({ type, ids });
  const radiateurs = sol.filter(e => e.role === 'radiateur').map(e => ({ id: e.it.id, zone: zone(e.it, 0, e.p.dim[1] / 2 + .2, e.p.dim[0] + .15, .4) }));
  let cout = 0, usage = 0, composition = 0;
  for (const e of sol) {
    if (surface(e.b) - intersection(e.b, piece) > .006) { cout += 100000; ajouter('limites', [e.it.id]); }
    if (portes.some(b => intersection(e.b, b) > .001)) { cout += 100000; ajouter('porte', [e.it.id]); }
    if (e.role !== 'radiateur' && ouvertures.some(b => (e.p.dim[2] > b.allege + .08 || e.role === 'lit') && intersection(e.b, b) > .005)) { cout += 24000; ajouter('fenetre', [e.it.id]); }
    if (radiateurs.some(r => r.id !== e.it.id && intersection(e.b, r.zone) > .005)) { cout += 24000; ajouter('radiateur', [e.it.id]); }
    if (e.role === 'lit') {
      const tete = local(e.it, 0, -e.p.dim[1] / 2);
      const murs = { gauche: tete.x + L / 2, droite: L / 2 - tete.x, fond: tete.z + P / 2, entree: P / 2 - tete.z };
      const [mur, recul] = Object.entries(murs).sort((a,b) => a[1] - b[1])[0];
      if (recul < .35 && modele.murs?.[mur]?.observe === false) composition += 600;
    }
    for (const q of sol) if (q.it.id > e.it.id && intersection(e.b, q.b, .025) > .0001) { cout += 100000; ajouter('chevauchement', [e.it.id, q.it.id]); }
    let gene = 0;
    for (const besoin of acces(e)) {
      const valeurs = besoin.zones.map(b => {
        const obstacles = sol.filter(q => q.it.id !== e.it.id && !(besoin.repas && ['chaise', 'tabouret', 'fauteuil'].includes(q.role)));
        return Math.max(0, surface(b) - intersection(b, piece)) + obstacles.reduce((s, q) => s + intersection(b, q.b), 0);
      });
      gene += besoin.choix ? Math.min(...valeurs) : valeurs.reduce((a, b) => a + b, 0);
    }
    if (gene > .025) ajouter('acces', [e.it.id]);
    usage += gene * 500;
    if (e.role === 'table-basse') {
      const canapes = sol.filter(q => q.role === 'canape');
      if (canapes.length) {
        const s = canapes.reduce((a, b) => distance(e.it, a.it) <= distance(e.it, b.it) ? a : b);
        const r = s.it.rot || 0, vx = e.it.x - s.it.x, vz = e.it.z - s.it.z;
        const front = vx * Math.sin(r) + vz * Math.cos(r), lateral = Math.abs(vx * Math.cos(r) - vz * Math.sin(r));
        const demi = demiEmpreinte(e.p.dim, (e.it.rot || 0) - r)[1];
        const ecart = front - s.p.dim[1] / 2 - demi;
        composition += Math.abs(ecart - REPERES.tableBasse) * 160 + Math.max(0, lateral - .15) * 120;
        if (ecart < .33 || ecart > .6 || lateral > s.p.dim[0] / 2) ajouter('salon', [e.it.id, s.it.id]);
      }
    }
    if (e.role === 'canape') {
      // Le confort ne doit pas être gagné en tournant le dos à une télévision conservée.
      const pointsFocaux = es.filter(q => ['tv', 'tv-murale', 'cheminee'].includes(q.role));
      if (pointsFocaux.length) {
        const cible = pointsFocaux.reduce((a, b) => distance(e.it, a.it) <= distance(e.it, b.it) ? a : b);
        const r = e.it.rot || 0, d = distance(e.it, cible.it);
        const alignement = ((cible.it.x - e.it.x) * Math.sin(r) + (cible.it.z - e.it.z) * Math.cos(r)) / Math.max(.01, d);
        composition += Math.max(0, .85 - alignement) * 400;
      }
    }
    if (e.role === 'fauteuil') {
      const ancrages = sol.filter(q => q.role === 'table-basse' || q.role === 'canape');
      if (ancrages.length) {
        const cible = ancrages.reduce((a, b) => distance(e.it, a.it) <= distance(e.it, b.it) ? a : b);
        const d = distance(e.it, cible.it), r = e.it.rot || 0;
        const align = ((cible.it.x - e.it.x) * Math.sin(r) + (cible.it.z - e.it.z) * Math.cos(r)) / Math.max(.01, d);
        composition += Math.max(0, .65 - align) * 90 + Math.max(0, d - 2.4) * 50;
      }
    }
  }
  const chemins = avecChemins ? circulation(modele, sol, portes) : null;
  if (chemins) {
    cout += chemins.portesBloquees * 12000 + chemins.inaccessibles.length * 2200;
    if (chemins.portesBloquees) ajouter('circulation', []);
    chemins.inaccessibles.forEach(id => ajouter('chemin', [id]));
  }
  const uniques = [...new Map(soucis.map(s => [s.type + ':' + s.ids.join(','), s])).values()];
  const contraintes = uniques.filter(s => ['limites', 'porte', 'chevauchement', 'fenetre', 'radiateur'].includes(s.type)).length;
  return { cout: cout + usage + composition, contraintes, soucis: uniques, chemins, usage, composition };
}

const libelles = {
  fr: { limites: 'Un meuble dépasse les dimensions de la pièce.', porte: 'Dégagez l’ouverture de la porte.', fenetre: 'Un lit ou un meuble haut empiète sur la zone de la fenêtre.', radiateur: 'Laissez le devant du radiateur dégagé ; vérifiez le recul requis par son fabricant.', chevauchement: 'Deux meubles se chevauchent.', acces: 'Prévoyez plus de recul pour utiliser ce meuble.', salon: 'Rapprochez la table basse du canapé en gardant environ 35 à 50 cm.', circulation: 'Un passage entre les portes reste trop étroit.', chemin: 'L’accès à ce meuble reste difficile depuis l’entrée.' },
  en: { limites: 'A piece extends beyond the room.', porte: 'Keep the doorway clear.', fenetre: 'A bed or tall piece obstructs the window area.', radiateur: 'Keep the front of the radiator clear; check the clearance required by its manufacturer.', chevauchement: 'Two pieces overlap.', acces: 'Leave more room to use this piece.', salon: 'Bring the coffee table within reach, with a gap of about 35–50 cm.', circulation: 'A route between doorways is still too narrow.', chemin: 'This piece is difficult to reach from the entrance.' }
};
export function bilanConfort(modele, items, catalogue, langue = 'fr') {
  const r = evaluer(modele, items, catalogue), noms = new Map(donnees(items, catalogue).map(e => [e.it.id, e.p.nom || e.it.id]));
  return {
    passageCible: REPERES.passage,
    circulation: r.chemins.portesConnues ? !r.chemins.portesBloquees && !r.chemins.inaccessibles.length : null,
    acces: !r.soucis.some(s => ['acces', 'chemin', 'chevauchement', 'limites', 'radiateur'].includes(s.type)),
    ouvertures: !r.soucis.some(s => ['fenetre', 'porte'].includes(s.type)),
    alertes: r.soucis.map(s => ({ ...s, texte: (libelles[langue] || libelles.fr)[s.type] + (s.ids.length ? ' (' + s.ids.map(id => noms.get(id)).join(', ') + ')' : '') })),
    mesuresEstimees: Boolean(modele.dims.estimees)
  };
}

function candidats(e, es, modele) {
  const L = modele.dims.largeur, P = modele.dims.profondeur, it = e.it;
  const liste = [{ x: it.x, z: it.z, rot: it.rot || 0 }];
  for (const d of [.3, -.3, .65, -.65]) liste.push({ ...it, x: it.x + d }, { ...it, z: it.z + d });
  if (estAdosse(e.p.fam)) {
    for (const r of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
      const [hx, hz] = demiEmpreinte(e.p.dim, r);
      for (const t of [-.25, 0, .25]) liste.push({ x: Math.abs(Math.sin(r)) > .5 ? -Math.sign(Math.sin(r)) * (L / 2 - hx - .02) : L * t, z: Math.abs(Math.cos(r)) > .5 ? -Math.sign(Math.cos(r)) * (P / 2 - hz - .02) : P * t, rot: r });
    }
  }
  if (e.role === 'table-basse') for (const s of es.filter(q => q.role === 'canape')) {
    for (const ecart of [.37, .45, .55]) liste.push({ ...local(s.it, 0, s.p.dim[1] / 2 + e.p.dim[1] / 2 + ecart), rot: s.it.rot || 0 });
  }
  if (e.role === 'fauteuil') for (const a of es.filter(q => q.role === 'table-basse' || q.role === 'canape').slice(0, 2)) {
    for (const r of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
      const d = Math.max(a.p.dim[0], a.p.dim[1]) / 2 + Math.max(e.p.dim[0], e.p.dim[1]) / 2 + .45;
      liste.push({ x: a.it.x - Math.sin(r) * d, z: a.it.z - Math.cos(r) * d, rot: r });
    }
    liste.push({ ...it, rot: Math.atan2(a.it.x - it.x, a.it.z - it.z) });
  }
  const uniques = new Map();
  for (const c of liste) {
    const rot = normaliserAngle(c.rot || 0), [hx, hz] = demiEmpreinte(e.p.dim, rot);
    if (hx * 2 > L || hz * 2 > P) continue;
    const q = { x: rond(clamp(c.x, -L / 2 + hx, L / 2 - hx)), z: rond(clamp(c.z, -P / 2 + hz, P / 2 - hz)), rot };
    uniques.set([q.x, q.z, q.rot].join('|'), q);
  }
  return [...uniques.values()];
}

export function optimiserAmenagement(modele, items, catalogue, opts = {}) {
  let resultat = items.map(it => ({ ...it }));
  const initiaux = new Map(resultat.map(it => [it.id, it]));
  const es = donnees(resultat, catalogue), supports = new Map();
  for (const e of es) { const support = porteurDe(e.it, e.p, es); if (support) supports.set(e.it.id, support.it.id); }
  const verrouilles = new Set(es.filter(e => e.it.fixe || estInstallation(e.it) || opts.garder?.includes(e.it.id)).map(e => e.it.id));
  for (const [id, support] of supports) if (verrouilles.has(id)) verrouilles.add(support);
  const mobiles = es.filter(e => !verrouilles.has(e.it.id) && !supports.has(e.it.id) && estAuSol(e.p.fam) && !estPlat(e.p.fam));
  const rang = e => ['canape', 'lit', 'repas', 'bureau', 'rangement', 'table-basse', 'fauteuil'].indexOf(e.role);
  mobiles.sort((a,b) => (rang(a) < 0 ? 99 : rang(a)) - (rang(b) < 0 ? 99 : rang(b)) || a.it.id.localeCompare(b.it.id));
  function deplacer(liste, id, position) {
    const avant = liste.find(it => it.id === id), angle = position.rot - (avant.rot || 0);
    return liste.map(it => {
      if (it.id === id) return { ...it, ...position };
      if (supports.get(it.id) !== id) return it;
      const dx = it.x - avant.x, dz = it.z - avant.z;
      return { ...it, x: rond(position.x + Math.cos(angle) * dx + Math.sin(angle) * dz), z: rond(position.z - Math.sin(angle) * dx + Math.cos(angle) * dz), rot: normaliserAngle((it.rot || 0) + angle) };
    });
  }
  const stabilite = liste => liste.reduce((s,it) => {
    const a = initiaux.get(it.id);return s + (a && !it.fixe ? distance(a,it) * 3 + Math.abs(normaliserAngle((a.rot || 0) - (it.rot || 0))) : 0);
  },0);
  for (let tour = 0; tour < 2; tour++) for (const entree of mobiles) {
    const actuels = donnees(resultat, catalogue), e = actuels.find(q => q.it.id === entree.it.id);
    const essais = candidats(e, actuels, modele).map(position => {
      const liste = deplacer(resultat, e.it.id, position);
      return { liste, local: evaluer(modele, liste, catalogue, false).cout + stabilite(liste) };
    }).sort((a,b) => a.local - b.local).slice(0, 4);
    const bilan = evaluer(modele, resultat, catalogue);
    let contraintes = bilan.contraintes, meilleur = bilan.cout + stabilite(resultat);
    for (const essai of essais) {
      const evaluation = evaluer(modele, essai.liste, catalogue), cout = evaluation.cout + stabilite(essai.liste);
      if (evaluation.contraintes <= contraintes && cout < meilleur - .001) { resultat = essai.liste; meilleur = cout; contraintes = evaluation.contraintes; }
    }
  }
  // Les tapis et suspensions accompagnent leur zone de vie, sans consommer de passage au sol.
  const fin = donnees(resultat, catalogue);
  resultat = resultat.map(it => {
    const p = produitDe(it,catalogue);
    if (verrouilles.has(it.id) || it.garde === false || !valide(p) || !(estPlat(p.fam) || estSuspendu(p.fam))) return it;
    const ancres = fin.filter(e => estPlat(p.fam) ? ['table-basse','canape','lit'].includes(e.role) : e.role === 'repas');
    if (!ancres.length) return it;
    const a = ancres.reduce((a,b) => distance(it,a.it) <= distance(it,b.it) ? a : b);
    if (distance(it,a.it) > 1.5) return it;
    const [hx,hz] = demiEmpreinte(p.dim, a.it.rot || 0), L = modele.dims.largeur, P = modele.dims.profondeur;
    if (2*hx > L || 2*hz > P) return it;
    return { ...it, x:rond(clamp(a.it.x,-L/2+hx,L/2-hx)), z:rond(clamp(a.it.z,-P/2+hz,P/2-hz)), rot:a.it.rot || 0 };
  });
  return { items: resultat, confort: bilanConfort(modele, resultat, catalogue, opts.langue) };
}
