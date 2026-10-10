// Repères d'usage indicatifs en mètres, calculés sur la maquette (pas des normes d'accessibilité).
// La recherche pseudo-aléatoire utilise une graine stable et conserve les produits retenus.
import { boite, demiEmpreinte, estAdosse, estAuSol, estPlat, estSuspendu, normaliserAngle, porteurDe, produitDe, zonesPortes } from './agencement.js';
import { contientBoite, contientPoint, segmentsDe, zoneOuverture, distanceSegment, poseAuPan } from './contour.js';
import { estInstallation, familleReleve, usageDe } from './usages.js';
import { preferencesDe, poidsComposition, VERSION_REGLES } from './references.js';
import { instancierPatrons } from './patrons.js';
import { moteurGuideActif } from './moteur-guide.js';

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
  return segmentsDe(modele).flatMap(pan=>(modele.murs?.[pan.id]?.ouvertures||[]).filter(o=>o.type==='fenetre'||(o.type==='baie'&&o.allege>.05)).map(o=>({...zoneOuverture(pan,o,.4),allege:o.allege||0,mur:pan.id})));
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
    libre[i] = contientPoint(modele,p.x,p.z,rayon) && Math.abs(p.x) <= L / 2 - rayon && Math.abs(p.z) <= P / 2 - rayon && !obstacles.some(b => pointDans(p, b)) ? 1 : 0;
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

function evaluer(modele, items, catalogue, avecChemins = true, preferences = preferencesDe()) {
  const es = donnees(items, catalogue), L = modele.dims.largeur, P = modele.dims.profondeur;
  const piece = { x0: -L / 2, x1: L / 2, z0: -P / 2, z1: P / 2 };
  const sol = es.filter(e => estAuSol(e.p.fam) && !estPlat(e.p.fam) && !porteurDe(e.it, e.p, es));
  const portes = zonesPortes(modele), ouvertures = fenetres(modele), soucis = [], ajouter = (type, ids) => soucis.push({ type, ids });
  const radiateurs = sol.filter(e => e.role === 'radiateur').map(e => ({ id: e.it.id, zone: zone(e.it, 0, e.p.dim[1] / 2 + .2, e.p.dim[0] + .15, .4) }));
  let cout = 0, usage = 0;
  const termes = { relations: 0, orientation: 0, conversation: 0, equilibre: 0, alignement: 0, symetrie: 0, tapisLumiere: 0 };
  const poids = poidsComposition(preferences);
  for (const e of sol) {
    if (modele.contour ? !contientBoite(modele,e.b) : surface(e.b) - intersection(e.b, piece) > .006) { cout += 100000; ajouter('limites', [e.it.id]); }
    if (portes.some(b => intersection(e.b, b) > .001)) { cout += 100000; ajouter('porte', [e.it.id]); }
    if (e.role !== 'radiateur' && ouvertures.some(b => (e.p.dim[2] > b.allege + .08 || e.role === 'lit') && intersection(e.b, b) > .005)) { cout += 24000; ajouter('fenetre', [e.it.id]); }
    if (radiateurs.some(r => r.id !== e.it.id && intersection(e.b, r.zone) > .005)) { cout += 24000; ajouter('radiateur', [e.it.id]); }
    if (e.role === 'lit') {
      const tete = local(e.it, 0, -e.p.dim[1] / 2);
      const murs = { gauche: tete.x + L / 2, droite: L / 2 - tete.x, fond: tete.z + P / 2, entree: P / 2 - tete.z };
      const r = e.it.rot || 0;
      const mur = Math.abs(Math.cos(r)) >= Math.abs(Math.sin(r)) ? Math.cos(r) >= 0 ? 'fond' : 'entree' : Math.sin(r) >= 0 ? 'gauche' : 'droite';
      const recul = modele.contour ? Math.min(...segmentsDe(modele).map(p=>distanceSegment([tete.x,tete.z],p.a,p.b))) : murs[mur];
      // Une tête de lit au milieu de la chambre n'est plus équivalente à une tête adossée.
      termes.relations += Math.max(0, recul - .08) * 420 + (modele.contour ? 0 : Math.abs(Math.sin(r * 2)) * 180);
      if (recul < .35 && modele.murs?.[mur]?.observe === false) termes.relations += 600;
    }
    for (const q of sol) if (q.it.id > e.it.id && intersection(e.b, q.b, .025) > .0001) { cout += 100000; ajouter('chevauchement', [e.it.id, q.it.id]); }
    let gene = 0;
    for (const besoin of acces(e)) {
      const valeurs = besoin.zones.map(b => {
        const obstacles = sol.filter(q => q.it.id !== e.it.id && !(besoin.repas && ['chaise', 'tabouret', 'fauteuil'].includes(q.role)));
        return (modele.contour && !contientBoite(modele,b) ? surface(b) : Math.max(0, surface(b) - intersection(b, piece))) + obstacles.reduce((s, q) => s + intersection(b, q.b), 0);
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
        termes.relations += Math.abs(ecart - REPERES.tableBasse) * 160 + Math.max(0, lateral - .15) * 120;
        if (ecart < .33 || ecart > .6 || lateral > s.p.dim[0] / 2) ajouter('salon', [e.it.id, s.it.id]);
      }
    }
    if (e.role === 'appoint') {
      const lits = sol.filter(q => q.role === 'lit');
      if (lits.length) {
        const lit = lits.reduce((a, b) => distance(e.it, a.it) < distance(e.it, b.it) ? a : b);
        const w = lit.p.dim[0] / 2 + e.p.dim[0] / 2 + .06;
        const z = -lit.p.dim[1] / 2 + e.p.dim[1] / 2 + .05;
        termes.relations += Math.min(distance(e.it, local(lit.it, -w, z)), distance(e.it, local(lit.it, w, z))) * 240;
      }
    }
    if (e.role === 'canape' || e.role === 'lit') {
      // Le confort ne doit pas être gagné en tournant le dos à une télévision conservée.
      const pointsFocaux = es.filter(q => ['tv', 'tv-murale', 'cheminee'].includes(q.role));
      if (pointsFocaux.length) {
        const cible = pointsFocaux.reduce((a, b) => distance(e.it, a.it) <= distance(e.it, b.it) ? a : b);
        const r = e.it.rot || 0, d = distance(e.it, cible.it);
        const alignement = ((cible.it.x - e.it.x) * Math.sin(r) + (cible.it.z - e.it.z) * Math.cos(r)) / Math.max(.01, d);
        termes.orientation += Math.max(0, .85 - alignement) * (e.role === 'canape' ? 400 : 140);
        const obstrue = sol.some(q => q.it.id !== e.it.id && q.it.id !== cible.it.id && q.p.dim[2] > .8
          && [.25, .4, .55, .7, .85].some(t => pointDans({ x: e.it.x + (cible.it.x - e.it.x) * t, z: e.it.z + (cible.it.z - e.it.z) * t }, q.b)));
        if (obstrue) termes.orientation += 220;
      }
    }
    if (e.role === 'fauteuil') {
      const ancrages = sol.filter(q => q.role === 'table-basse' || q.role === 'canape');
      if (ancrages.length) {
        const cible = ancrages.reduce((a, b) => distance(e.it, a.it) <= distance(e.it, b.it) ? a : b);
        const d = distance(e.it, cible.it), r = e.it.rot || 0;
        const align = ((cible.it.x - e.it.x) * Math.sin(r) + (cible.it.z - e.it.z) * Math.cos(r)) / Math.max(.01, d);
        termes.orientation += Math.max(0, .65 - align) * 90 + Math.max(0, d - 2.4) * 50;
      }
    }
  }
  // Les repères visuels restent secondaires et ne changent jamais les cotes d'usage.
  const sieges = sol.filter(e => ['canape', 'fauteuil', 'meridienne'].includes(e.role));
  const face = (a, b) => ((b.it.x - a.it.x) * Math.sin(a.it.rot || 0) + (b.it.z - a.it.z) * Math.cos(a.it.rot || 0)) / Math.max(.01, distance(a.it, b.it));
  for (let i = 0; i < sieges.length; i++) for (let j = i + 1; j < sieges.length; j++) {
    const a = sieges[i], b = sieges[j], d = distance(a.it, b.it);
    // Deux salons éloignés ne forment pas automatiquement un seul groupe.
    if (d > 4) continue;
    termes.conversation += (Math.max(0, 1.2 - d) + Math.max(0, d - 2.4)) * 70
      + (Math.max(0, .3 - face(a, b)) + Math.max(0, .3 - face(b, a))) * 45;
  }
  const masse = sol.reduce((s, e) => s + surface(e.b), 0);
  if (sol.length >= 3 && masse) {
    const x = sol.reduce((s, e) => s + surface(e.b) * e.it.x, 0) / masse;
    const z = sol.reduce((s, e) => s + surface(e.b) * e.it.z, 0) / masse;
    termes.equilibre = Math.hypot(x / L, z / P) * 100;
  }
  for (const e of sol) {
    if (!['fauteuil', 'chaise', 'tabouret'].includes(e.role)) termes.alignement += Math.abs(Math.sin((e.it.rot || 0) * 2)) * 60;
    if (e.role !== 'lit') continue;
    const chevets = sol.filter(q => q.role === 'appoint' && distance(e.it, q.it) < 2);
    if (chevets.length === 2) {
      const r = e.it.rot || 0;
      const relatif = q => ({ x: (q.it.x - e.it.x) * Math.cos(r) - (q.it.z - e.it.z) * Math.sin(r), z: (q.it.x - e.it.x) * Math.sin(r) + (q.it.z - e.it.z) * Math.cos(r) });
      const [a, b] = chevets.map(relatif);
      termes.symetrie += (Math.abs(a.x + b.x) + Math.abs(a.z - b.z)) * 160;
    }
  }
  // Regrouper les tapis et les éclairages avec un usage ; aucun bonus pour leur nombre.
  for (const e of es.filter(e => e.role === 'tapis' || ['lampe', 'lampadaire', 'applique', 'suspension', 'lustre', 'plafonnier'].includes(e.role))) {
    const ancres = es.filter(q => e.role === 'tapis' ? ['lit', 'canape', 'table-basse'].includes(q.role)
      : ['suspension', 'lustre', 'plafonnier'].includes(e.role) ? ['repas', 'lit', 'canape'].includes(q.role) : ['bureau', 'fauteuil', 'lit', 'canape'].includes(q.role));
    if (!ancres.length) continue;
    const a = ancres.reduce((a, b) => distance(e.it, a.it) <= distance(e.it, b.it) ? a : b);
    const d = distance(e.it, a.it), limite = e.role === 'tapis' ? .5 : Math.max(a.p.dim[0], a.p.dim[1]) / 2 + .8;
    termes.tapisLumiere += Math.max(0, d - limite) * 100;
  }
  const composition = Object.entries(termes).reduce((s, [k, v]) => s + v * poids[k], 0);
  const chemins = avecChemins ? circulation(modele, sol, portes) : null;
  if (chemins) {
    cout += chemins.portesBloquees * 12000 + chemins.inaccessibles.length * 2200;
    if (chemins.portesBloquees) ajouter('circulation', []);
    chemins.inaccessibles.forEach(id => ajouter('chemin', [id]));
  }
  const uniques = [...new Map(soucis.map(s => [s.type + ':' + s.ids.join(','), s])).values()];
  const contraintes = uniques.filter(s => ['limites', 'porte', 'chevauchement', 'fenetre', 'radiateur'].includes(s.type)).length;
  const comptes = Object.fromEntries(['limites', 'porte', 'chevauchement', 'fenetre', 'radiateur', 'acces', 'circulation', 'chemin'].map(type => [type, uniques.filter(s => s.type === type).length]));
  return { cout: cout + usage + composition, contraintes, soucis: uniques, chemins, usage, composition, termes, poids, comptes,
    nombreSol: sol.length, nombreUsages: sol.filter(e => acces(e).length > 0).length,
    applicables: { relations: sol.some(e => ['lit', 'appoint', 'table-basse'].includes(e.role)), orientation: sol.some(e => e.role === 'fauteuil') || (sieges.length > 0 && es.some(e => ['tv', 'tv-murale', 'cheminee'].includes(e.role))),
      conversation: sieges.length >= 2, equilibre: sol.length >= 3, alignement: sol.length > 0, symetrie: sol.some(e => e.role === 'lit') && sol.filter(e => e.role === 'appoint').length >= 2,
      tapisLumiere: es.some(e => e.role === 'tapis' || ['lampe', 'lampadaire', 'applique', 'suspension', 'lustre', 'plafonnier'].includes(e.role)) && sol.some(e => ['lit', 'canape', 'repas', 'bureau', 'fauteuil'].includes(e.role)) } };
}

// Une note lisible pour comparer le même mobilier et les mêmes mesures ; pas une note de beauté.
function scoreDe(r, preferences) {
  const criteres = [
    { id: 'geometrie', note: r.nombreSol ? r.contraintes ? Math.max(0, 100 - r.contraintes * 30) : 100 : null, problemes: r.contraintes, poids: 4 },
    { id: 'circulation', note: r.chemins.portesConnues ? Math.max(0, 100 - r.comptes.circulation * 60 - r.comptes.chemin * 25) : null, problemes: r.comptes.circulation + r.comptes.chemin, poids: 3 },
    { id: 'usage', note: r.nombreUsages ? Math.round(100 / (1 + r.usage / 160)) : null, problemes: r.comptes.acces, poids: 3 },
    ...Object.entries(r.termes).map(([id, penalite]) => ({ id, note: r.applicables[id] && r.poids[id] > 0 ? Math.round(100 / (1 + penalite / 150)) : null,
      penalite: rond(penalite), poids: r.poids[id] }))
  ];
  const actifs = criteres.filter(c => c.note !== null);
  let total = r.nombreSol && actifs.length ? Math.round(actifs.reduce((s, c) => s + c.note * c.poids, 0) / actifs.reduce((s, c) => s + c.poids, 0)) : null;
  if (total === 100 && actifs.some(c => c.note < 100)) total = 99;
  if (r.contraintes) total = Math.min(49, total);
  if (r.comptes.circulation || r.comptes.chemin) total = Math.min(69, total);
  return { version: VERSION_REGLES, total, contraintes: r.contraintes, cout: rond(r.cout), criteres, preferences,
    incomplet: !r.chemins.portesConnues || !r.nombreSol };
}
// On n'échange pas un problème de porte contre un problème de fenêtre, ni un accès contre du style.
function admissible(r, base) {
  return Object.keys(base.comptes).every(type => r.comptes[type] <= base.comptes[type]);
}
function comparerBilans(a, b) {
  for (const k of ['contraintes']) if (a[k] !== b[k]) return a[k] - b[k];
  for (const k of ['circulation', 'chemin', 'acces']) if (a.comptes[k] !== b.comptes[k]) return a.comptes[k] - b.comptes[k];
  return a.cout - b.cout;
}
function aleatoireDe(valeur) {
  let etat = 2166136261;
  for (const c of JSON.stringify(valeur)) etat = Math.imul(etat ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => { etat += 0x6D2B79F5; let t = etat; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const libelles = {
  fr: { limites: 'Un meuble dépasse les dimensions de la pièce.', porte: 'Dégagez l’ouverture de la porte.', fenetre: 'Un lit ou un meuble haut empiète sur la zone de la fenêtre.', radiateur: 'Laissez le devant du radiateur dégagé ; vérifiez le recul requis par son fabricant.', chevauchement: 'Deux meubles se chevauchent.', acces: 'Prévoyez plus de recul pour utiliser ce meuble.', salon: 'Rapprochez la table basse du canapé en gardant environ 35 à 50 cm.', circulation: 'Un passage entre les portes reste trop étroit.', chemin: 'L’accès à ce meuble reste difficile depuis l’entrée.' },
  en: { limites: 'A piece extends beyond the room.', porte: 'Keep the doorway clear.', fenetre: 'A bed or tall piece obstructs the window area.', radiateur: 'Keep the front of the radiator clear; check the clearance required by its manufacturer.', chevauchement: 'Two pieces overlap.', acces: 'Leave more room to use this piece.', salon: 'Bring the coffee table within reach, with a gap of about 35–50 cm.', circulation: 'A route between doorways is still too narrow.', chemin: 'This piece is difficult to reach from the entrance.' }
};
export function bilanConfort(modele, items, catalogue, langue = 'fr', opts = {}) {
  const preferences = preferencesDe(opts.envies, opts.preferences);
  const r = evaluer(modele, items, catalogue, true, preferences), noms = new Map(donnees(items, catalogue).map(e => [e.it.id, e.p.nom || e.it.id]));
  return {
    passageCible: REPERES.passage,
    score: scoreDe(r, preferences),
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
  if (e.role === 'appoint') for (const lit of es.filter(q => q.role === 'lit')) {
    for (const cote of [-1, 1]) liste.push({ ...local(lit.it, cote * (lit.p.dim[0] / 2 + e.p.dim[0] / 2 + .06), -lit.p.dim[1] / 2 + e.p.dim[1] / 2 + .05), rot: lit.it.rot || 0 });
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
  const preferences = preferencesDe(opts.envies, opts.preferences);
  if (!moteurGuideActif(opts.moteurGuide)) {
    const bilan = { items: items.map(it => ({...it})), confort: bilanConfort(modele, items, catalogue, opts.langue, {...opts, preferences}), recherche: {methode:'repli-sans-optimisation', iterations:0, candidatsVerifies:0, patronsEssayes:[]} };
    return {...bilan, ...(opts.variantes ? {variantes:[{items:bilan.items,confort:bilan.confort}]} : {})};
  }
  const evaluation = (liste, chemins = true) => evaluer(modele, liste, catalogue, chemins, preferences);
  const recherche = { methode: 'recuit-simule', iterations: 0, acceptationsMoinsBonnes: 0, candidatsVerifies: 0, patronsEssayes: [] };
  const initial = items.map(it => ({ ...it }));
  const initiaux = new Map(initial.map(it => [it.id, it]));
  const es = donnees(initial, catalogue), supports = new Map();
  for (const e of es) { const support = porteurDe(e.it, e.p, es); if (support) supports.set(e.it.id, support.it.id); }
  const verrouilles = new Set(es.filter(e => e.it.fixe || estInstallation(e.it) || opts.garder?.includes(e.it.id)).map(e => e.it.id));
  for (const [id, support] of supports) if (verrouilles.has(id)) verrouilles.add(support);
  // Groupes fonctionnels : les chevets et la table basse accompagnent leur ancrage.
  // Les objets posés (lampe, TV…) suivent ensuite leur propre support, même dans un groupe tourné.
  const attaches = new Map();
  for (const e of es) {
    if (verrouilles.has(e.it.id) || supports.has(e.it.id)) continue;
    const ancres = es.filter(q => e.role === 'appoint' ? q.role === 'lit' : e.role === 'table-basse' ? q.role === 'canape'
      : ['chaise', 'tabouret'].includes(e.role) ? q.role === 'repas' : false);
    if (ancres.length) {
      const a = ancres.reduce((a, b) => distance(e.it, a.it) <= distance(e.it, b.it) ? a : b);
      if (e.role === 'appoint' || distance(e.it, a.it) < 3) attaches.set(e.it.id, a.it.id);
    }
  }
  const mobiles = es.filter(e => !verrouilles.has(e.it.id) && !supports.has(e.it.id) && estAuSol(e.p.fam) && !estPlat(e.p.fam));
  const rang = e => ['canape', 'lit', 'repas', 'bureau', 'rangement', 'table-basse', 'fauteuil'].indexOf(e.role);
  mobiles.sort((a,b) => (rang(a) < 0 ? 99 : rang(a)) - (rang(b) < 0 ? 99 : rang(b)) || a.it.id.localeCompare(b.it.id));
  function deplacer(liste, id, position) {
    const avant = liste.find(it => it.id === id), angle = position.rot - (avant.rot || 0);
    let apres = liste.map(it => {
      if (it.id === id) return { ...it, ...position };
      if (attaches.get(it.id) !== id || verrouilles.has(it.id)) return it;
      const p = produitDe(it, catalogue), ancre = produitDe(avant, catalogue);
      if (roleDe(p) === 'appoint' && ancre.fam === 'lit') {
        const chevets = liste.filter(q => attaches.get(q.id) === id && roleDe(produitDe(q, catalogue)) === 'appoint');
        const index = chevets.findIndex(q => q.id === it.id);
        const cote = chevets.length > 1 ? index % 2 ? 1 : -1
          : (it.x - avant.x) * Math.cos(avant.rot || 0) - (it.z - avant.z) * Math.sin(avant.rot || 0) >= 0 ? 1 : -1;
        return { ...it, ...local({ ...avant, ...position }, cote * (ancre.dim[0] / 2 + p.dim[0] / 2 + .06), -ancre.dim[1] / 2 + p.dim[1] / 2 + .05), rot: position.rot };
      }
      if (roleDe(p) === 'table-basse' && ancre.fam === 'canape') {
        return { ...it, ...local({ ...avant, ...position }, 0, ancre.dim[1] / 2 + p.dim[1] / 2 + REPERES.tableBasse), rot: position.rot };
      }
      const dx = it.x - avant.x, dz = it.z - avant.z;
      return { ...it, x: rond(position.x + Math.cos(angle) * dx + Math.sin(angle) * dz), z: rond(position.z - Math.sin(angle) * dx + Math.cos(angle) * dz), rot: normaliserAngle((it.rot || 0) + angle) };
    });
    for (let tour = 0; tour < 2; tour++) {
      const positions = new Map(apres.map(it => [it.id, it]));
      apres = apres.map(it => {
        const sid = supports.get(it.id);
        if (!sid || verrouilles.has(it.id)) return it;
        const sAvant = liste.find(q => q.id === sid), sApres = positions.get(sid), original = liste.find(q => q.id === it.id);
        const a = (sApres.rot || 0) - (sAvant.rot || 0), dx = original.x - sAvant.x, dz = original.z - sAvant.z;
        return { ...it, x: rond(sApres.x + Math.cos(a) * dx + Math.sin(a) * dz), z: rond(sApres.z - Math.sin(a) * dx + Math.cos(a) * dz), rot: normaliserAngle((original.rot || 0) + a) };
      });
    }
    return apres.map(it => verrouilles.has(it.id) ? it : { ...it, x: rond(it.x), z: rond(it.z) });
  }
  const stabilite = liste => liste.reduce((s,it) => {
    const a = initiaux.get(it.id);return s + (a && !it.fixe ? distance(a,it) * 3 + Math.abs(normaliserAngle((a.rot || 0) - (it.rot || 0))) : 0);
  },0);
  function affiner(depart, garderOrientation = false) {
    let resultat = depart;
    for (let tour = 0; tour < 2; tour++) for (const entree of mobiles) {
    const actuels = donnees(resultat, catalogue), e = actuels.find(q => q.it.id === entree.it.id);
    const essais = candidats(e, actuels, modele).filter(c => !garderOrientation || e.it.id !== ancre.it.id
      || Math.abs(normaliserAngle(c.rot - depart.find(it => it.id === ancre.it.id).rot)) < .01).map(position => {
      const liste = deplacer(resultat, e.it.id, position);
      return { liste, local: evaluation(liste, false).cout + stabilite(liste) };
    }).sort((a,b) => a.local - b.local).slice(0, 8);
    const bilan = evaluation(resultat);
    let contraintes = bilan.contraintes, meilleur = bilan.cout + stabilite(resultat);
    for (const essai of essais) {
      const bilanEssai = evaluation(essai.liste), cout = bilanEssai.cout + stabilite(essai.liste);
      if (admissible(bilanEssai, bilan) && bilanEssai.contraintes <= contraintes && cout < meilleur - .001) { resultat = essai.liste; meilleur = cout; contraintes = bilanEssai.contraintes; }
    }
  }
    return resultat;
  }
  // Plusieurs compositions complètes évitent de rester coincé dans un mauvais placement initial.
  // Les patrons sont partagés par les styles : le choix des produits reste en amont.
  const departs = [initial];
  const ancre = mobiles.find(e => ['lit', 'canape', 'repas', 'bureau'].includes(e.role));
  if (opts.mode !== 'partiel' && opts.patrons !== false) {
    for (const patron of instancierPatrons(modele, mobiles.filter(e => !attaches.has(e.it.id)), es, preferences)) {
      let liste = initial;
      for (const slot of patron.slots) liste = deplacer(liste, slot.id, slot.position);
      departs.push(liste); recherche.patronsEssayes.push(patron.id);
    }
  }
  if (ancre && opts.mode !== 'partiel') {
    const L = modele.dims.largeur, P = modele.dims.profondeur;
    if (modele.contour) for (const pan of segmentsDe(modele)) for (const t of [-.5,0,.5]) departs.push(deplacer(initial,ancre.it.id,poseAuPan(pan,ancre.it,ancre.p.dim,t)));
    for (const rot of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const essais = [];
      const [hx, hz] = demiEmpreinte(ancre.p.dim, rot);
      if (2 * hx > L || 2 * hz > P) continue;
      for (const t of [-.6, -.3, 0, .3, .6]) {
        const lateral = Math.abs(Math.sin(rot)) > .5;
        const position = ancre.role === 'repas'
          ? { x: t * (L / 2 - hx - .8), z: 0, rot }
          : { x: lateral ? -Math.sign(Math.sin(rot)) * (L / 2 - hx - .02) : t * Math.max(0, L / 2 - hx - .6),
            z: lateral ? t * Math.max(0, P / 2 - hz - .6) : -Math.sign(Math.cos(rot)) * (P / 2 - hz - .02), rot };
        const liste = deplacer(initial, ancre.it.id, position);
        essais.push({ liste, cout: evaluation(liste, false).cout });
      }
      essais.sort((a, b) => a.cout - b.cout);
      departs.push(essais[0].liste);
    }
  }
  const bilanInitial = evaluation(initial);
  const bilanRapideInitial = evaluation(initial, false);
  const resultats = departs.map((depart, i) => affiner(depart, i > 0)).map(liste => ({ liste, bilan: evaluation(liste) }))
    .filter(r => admissible(r.bilan, bilanInitial));
  // Recuit à graine stable : translations, rotations et échanges de groupes.
  // Les états intermédiaires peuvent être moins bons ; seuls les états revalidés sont proposés.
  if (mobiles.length && opts.recuit !== false) {
    const random = aleatoireDe({ modele, items: initial, preferences });
    const snapshots = new Map();
    const retenir = liste => {
      const rapide = evaluation(liste, false);
      if (!admissible(rapide, bilanRapideInitial)) return;
      // Une position prometteuse doit aussi être accessible, avant de conserver son instantané.
      const bilan = evaluation(liste);
      if (!admissible(bilan, bilanInitial)) return;
      const cle = liste.map(it => [it.id, it.x, it.z, it.rot].join(':')).join('|');
      snapshots.set(cle, { liste, bilan, cout: bilan.cout + stabilite(liste) });
      if (snapshots.size > 16) {
        const pire = [...snapshots.entries()].sort((a, b) => comparerBilans(b[1].bilan, a[1].bilan) || b[1].cout - a[1].cout)[0]; snapshots.delete(pire[0]);
      }
    };
    const bases = [...resultats].sort((a, b) => comparerBilans(a.bilan, b.bilan)).slice(0, 2);
    for (const base of bases) {
      let courant = base.liste, cout = evaluation(courant, false).cout + stabilite(courant);
      let meilleur = cout;
      const difficile = base.bilan.contraintes || base.bilan.comptes.chemin || base.bilan.comptes.circulation || base.bilan.comptes.acces;
      const iterations = difficile ? Math.min(1536, 768 + mobiles.length * 64) : Math.min(384, 192 + mobiles.length * 24);
      for (let i = 0; i < iterations; i++) {
        recherche.iterations++;
        const fraction = i / Math.max(1, iterations - 1), temperature = 350 * Math.pow(2 / 350, fraction);
        const entree = mobiles[Math.floor(random() * mobiles.length)], actuels = donnees(courant, catalogue), e = actuels.find(q => q.it.id === entree.it.id);
        const choix = random();
        let essai;
        if (choix < .14 && mobiles.length > 1 && !attaches.has(e.it.id)) {
          const autres = mobiles.filter(q => q.it.id !== e.it.id && !attaches.has(q.it.id));
          const autre = autres[Math.floor(random() * autres.length)];
          if (!autre) continue;
          const p = courant.find(q => q.id === autre.it.id), avant = e.it;
          essai = deplacer(deplacer(courant, avant.id, { x: p.x, z: p.z, rot: p.rot || 0 }), p.id, { x: avant.x, z: avant.z, rot: avant.rot || 0 });
        } else {
          let position;
          if (choix < .4) {
            const cs = candidats(e, actuels, modele); position = cs[Math.floor(random() * cs.length)];
          } else {
            const amplitude = .06 + (1 - fraction) * .95;
            const rot = normaliserAngle((e.it.rot || 0) + (random() < .18 ? (random() < .5 ? 1 : -1) * Math.PI / 2 : 0));
            const [hx, hz] = demiEmpreinte(e.p.dim, rot), { largeur: L, profondeur: P } = modele.dims;
            if (2 * hx > L || 2 * hz > P) continue;
            position = { x: rond(clamp(e.it.x + (random() * 2 - 1) * amplitude, -L / 2 + hx, L / 2 - hx)),
              z: rond(clamp(e.it.z + (random() * 2 - 1) * amplitude, -P / 2 + hz, P / 2 - hz)), rot };
          }
          if (!position) continue;
          essai = deplacer(courant, e.it.id, position);
        }
        const nouveau = evaluation(essai, false).cout + stabilite(essai), delta = nouveau - cout;
        if (delta <= 0 || random() < Math.exp(-delta / temperature)) {
          if (delta > .001) recherche.acceptationsMoinsBonnes++;
          courant = essai; cout = nouveau;
          if (cout < meilleur || i % 32 === 0) { retenir(courant); meilleur = Math.min(meilleur, cout); }
        }
      }
      retenir(courant);
    }
    for (const { liste } of [...snapshots.values()].sort((a, b) => comparerBilans(a.bilan,b.bilan) || a.cout - b.cout).slice(0, 8)) {
      const fin = affiner(liste), bilan = evaluation(fin); recherche.candidatsVerifies++;
      if (admissible(bilan, bilanInitial)) resultats.push({ liste: fin, bilan });
    }
  }
  resultats.push({ liste: initial, bilan: bilanInitial });
  resultats.sort((a, b) => comparerBilans({ ...a.bilan, cout: a.bilan.cout + stabilite(a.liste) }, { ...b.bilan, cout: b.bilan.cout + stabilite(b.liste) }));
  // Une amélioration visuelle imperceptible ne justifie pas de déplacer à nouveau une pièce saine.
  const best = resultats[0];
  if (admissible(bilanInitial, best.bilan) && bilanInitial.cout <= best.bilan.cout + 5) {
    const i = resultats.findIndex(r => r.liste === initial);
    resultats.unshift(...resultats.splice(i, 1));
  }
  const premier = resultats[0].bilan;
  const soucisUsage = bilan => bilan.soucis.filter(s => ['acces', 'chemin', 'circulation'].includes(s.type)).length;

  // Les tapis et suspensions accompagnent leur zone de vie, sans consommer de passage au sol.
  function accompagner(resultat) {
    const fin = donnees(resultat, catalogue);
    return resultat.map(it => {
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
  }
  const distinctes = [];
  const different = (a, b) => mobiles.some(e => {
    const x = a.find(it => it.id === e.it.id), y = b.find(it => it.id === e.it.id);
    return distance(x, y) >= .4 || Math.abs(normaliserAngle((x.rot || 0) - (y.rot || 0))) >= Math.PI / 3;
  });
  for (const r of resultats) {
    if (distinctes.length >= Math.max(1, Math.min(3, opts.variantes || 1))) break;
    if (!admissible(r.bilan, bilanInitial)) continue;
    if (opts.variantes ? !admissible(r.bilan, premier) || r.bilan.cout > premier.cout + 80 || r.bilan.contraintes > premier.contraintes || soucisUsage(r.bilan) > soucisUsage(premier)
      : r.bilan.cout > bilanInitial.cout + .001) continue;
    const liste = accompagner(r.liste);
    if (distinctes.every(v => different(liste, v.items))) distinctes.push({ items: liste, confort: bilanConfort(modele, liste, catalogue, opts.langue, { ...opts, preferences }) });
  }
  const meilleur = distinctes[0] || { items: initial, confort: bilanConfort(modele, initial, catalogue, opts.langue, { ...opts, preferences }) };
  return { ...meilleur, recherche, ...(opts.variantes ? { variantes: distinctes.length ? distinctes : [meilleur] } : {}) };
}
