// Moteur de la scène d'accueil, chargé à la demande par PieceAccueil (three.js n'est pas dans le
// paquet initial). Un immeuble jouet de quatre appartements : des chiens, des chats, des tortues et des
// lapins y vivent comme des humains. L'histoire suit les chapitres de la page (défilement guidé) :
//   0 (héros) : l'immeuble s'assemble étage par étage, façade fermée ;
//   1 (Relever) : la façade s'ouvre comme une maison de poupée, le plan de chaque pièce se trace ;
//     chacun vit sa vie (un chien dort, l'autre joue à la balle, un chat dort sur son griffoir, l'autre
//     joue avec une pelote, une tortue arrose, l'autre se promène, un lapin grignote, l'autre gambade) ;
//   2 (Aménager) : les meubles changent de place sous leurs pattes : surprises, un lapin tombe, les
//     tortues rentrent dans leur carapace, le fauteuil boude ;
//   3 (Visiter), une visite par arrêt du défilement : on s'approche de chaque appartement (console, échecs,
//     lecture, série sous le plaid dans le noir), puis tout le monde salue et dit merci.
// Chaque animal se clique (il réagit et parle dans la bulle). En avançant d'un chapitre au suivant,
// l'histoire se joue ; en remontant ou en sautant, la scène rejoint l'état du chapitre. Rendu seulement
// à l'écran et onglet actif ; mouvement réduit : l'état de chaque chapitre, immobile.
import * as THREE from 'three';
import { initialiser, COURBES } from '@/components/mouvement/regles.js';
import { matieresMeubles, atelierOmbres, construireMeuble, preparer, fusion, bloc, cyl, facettes, assembler } from './maquette.js';
import { construireImmeuble, APPARTEMENTS, CENTRES, SOLS, AH } from './immeuble.js';
import {
  matieresAnimaux, creerAnimal, couronneEtoiles, nuageOrage, reserveCoeurs, ESPECES,
  bond, marcher, surprise, chute, relever, tournoyer, seCacher, coucou, proche
} from './animaux.js';

const RAD = Math.PI / 180, R = Math.PI / 2;
const REDUIT = '(prefers-reduced-motion: reduce)';
const T_FIXE = 1.234;   // mouvement réduit : la vie est figée à cet instant
const borne = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lisse = t => t * t * (3 - 2 * t);
const bosse = (t, p, d, decalage = 0) => { const x = ((t + decalage) % p + p) % p / d; return x < 1 ? Math.sin(x * Math.PI) : 0; };
const ECRASE = { x: 1.03, y: .93, z: 1.03 };   // amorti à la pose d'un meuble

// caméra : point visé (cx, cy, cz), direction depuis ce point (az : de +z vers +x, el : au-dessus de
// l'horizon, en degrés), demi-cadre à faire tenir (rx × ry, m), champ vertical (fov)
const CAM = {
  immeuble: { az: 30, el: 13, rx: 5.6, ry: 5, cx: 0, cy: 4.1, cz: .4, fov: 30 },
  ouvert: { az: 5, el: 7, rx: 5.15, ry: 3.1, cx: 0, cy: 4.05, cz: .8, fov: 30 },
  amenager: { az: 12, el: 15, rx: 5, ry: 3.1, cx: 0, cy: 3.95, cz: .6, fov: 30 },
  fin: { az: 4, el: 9, rx: 5.15, ry: 3.3, cx: 0, cy: 4.1, cz: .8, fov: 30 }
};
const VISITES = APPARTEMENTS.map((a, i) => ({ az: [4, 8, 10, 2][i], el: 11, rx: 2.3, ry: 1.6, cx: CENTRES[a.cote], cy: SOLS[a.etage] + 1, cz: .5, fov: 30 }));
const cadrage = (n, k) => (n === 0 ? CAM.immeuble : n === 1 ? CAM.ouvert : n === 2 ? CAM.amenager : k >= 4 ? CAM.fin : VISITES[k]);

// meubles de chaque appartement (repère de l'appartement, m) : [x, z, orientation] avant (A) et après (B)
const PIECES = [
  { // 0 chiens : avant, le canapé tourne le dos ; après, deux poufs devant la console
    tapis: { A: [.5, .25, .3], B: [-.5, .05, 0] },
    canape: { A: [-.85, .75, Math.PI], B: [.55, -1.3, 0] },
    meubleTV: { A: [1.35, -1.52, 0], B: [-1.6, -.1, R - .4] },
    pouf: { A: [1.85, 1.25, 0], B: [-.8, -.65, 0] },
    pouf2: { id: 'pouf', A: [-.6, -1.5, 0], B: [-.2, .1, 0] },
    panier: { A: [-1.65, -.7, 0], B: [1.6, 1, 0] },
    plante: { A: [1.95, .35, 0], B: [1.9, -1.45, 0] },
    lampadaire: { A: [-.05, -1.55, 0], B: [-1.9, -1.45, 0] }
  },
  { // 1 chats : après, un guéridon et son échiquier entre le fauteuil et le pouf
    tapisRond: { A: [.9, .5, 0], B: [0, .25, 0] },
    gueridon: { A: [1.6, 1.15, 0], B: [0, .2, 0] },
    fauteuil: { A: [-1.65, 1, .9], B: [-.85, .2, R - .35] },
    pouf: { A: [-.3, -1.45, 0], B: [.78, .2, 0] },
    etagere: { A: [-1.2, -1.58, 0], B: [1.35, -1.58, 0] },
    griffoir: { A: [1.75, -1.35, 0], B: [-1.8, -1.3, 0] },
    plante: { A: [-1.9, -.3, 0], B: [1.9, 1.2, 0] },
    lampadaire: { A: [.75, -1.55, 0], B: [-1.9, 1.2, 0] }
  },
  { // 2 tortues : après, le canapé face à nous, la table basse et le thé, la bibliothèque
    tapis: { A: [.4, .4, -.25], B: [-.2, -.45, 0] },
    canape: { A: [1.72, .3, -R], B: [-.2, -1.3, 0] },
    table: { A: [.6, 1.1, .4], B: [-.2, -.25, 0] },
    etagere: { A: [-1.25, -1.58, 0], B: [1.98, -.65, -R] },
    lampadaire: { A: [-1.9, 1.3, 0], B: [-1.75, -1.42, 0] },
    plante: { A: [1.55, -1.14, 0], B: [1.85, 1.25, 0] }
  },
  { // 3 lapins : avant, le canapé face au mur ; après, face à la télé
    tapis: { A: [-.3, .5, .2], B: [-.45, .2, 0] },
    canape: { A: [.3, -1.25, Math.PI], B: [.95, .1, -R + .45] },
    meubleTV: { A: [1.95, .6, -R], B: [-1.6, .05, R - .4] },
    etagere: { A: [-1.98, -.4, R], B: [-1.25, -1.58, 0] },
    lampadaire: { A: [-1, 1.35, 0], B: [1.9, -1.45, 0] },
    plante: { A: [1.9, -1.45, 0], B: [1.9, 1.3, 0] }
  }
];
// habitants (deux par appartement)
const HABITANTS = [
  [{ espece: 'chien', pelage: '#F1C08B', clair: '#FFF3E2', sombre: '#B9835A', accessoire: 'collier', couleurAcc: 'corail', graine: 0 },
    { espece: 'chien', pelage: '#FFF6EA', clair: '#FFFFFF', sombre: '#A0806C', accessoire: 'collier', couleurAcc: 'menthe', graine: 1 }],
  [{ espece: 'chat', pelage: '#F6B07A', clair: '#FFF0E0', accessoire: 'grelot', couleurAcc: 'lilas', graine: 2 },
    { espece: 'chat', pelage: '#B9B1CB', clair: '#F3F0F9', accessoire: 'grelot', couleurAcc: 'corail', graine: 3 }],
  [{ espece: 'tortue', pelage: '#A9D69E', clair: '#FBEFC4', carapace: '#78B98A', accessoire: 'lunettes', couverture: 'corail', graine: 4 },
    { espece: 'tortue', pelage: '#B5DCA6', clair: '#FBEFC4', carapace: '#E2B07A', accessoire: 'echarpe', couleurAcc: 'beurre', couverture: 'menthe', graine: 5 }],
  [{ espece: 'lapin', accessoire: 'echarpe', couleurAcc: 'menthe', graine: 6 },
    { espece: 'lapin', accessoire: 'noeud', couleurAcc: 'corail', graine: 7 }]
];
// où ils sont et ce qu'ils font : leur vie d'avant (chapitres 0 et 1), debout dans les pièces
// réaménagées (2), à leur activité (3). via : le chemin jusqu'au siège.
const VIE = [
  [{ x: -1.65, z: -.7, y: .1, r: .6, dort: 1, assis: 1 }, { x: .6, z: 1, r: 2.5, routine: 'balle' }],
  [{ x: 1.75, z: -1.35, y: 1.15, r: .3, dort: 1, assis: .5 }, { x: -.2, z: .25, r: .5, assis: .4, routine: 'pelote' }],
  [{ x: 1, z: -.9, r: 1.2, arrose: 1 }, { x: -.2, z: .7, r: -1.5, routine: 'promenade' }],
  [{ x: -.5, z: .45, r: .5, mange: 1, assis: 1 }, { x: .2, z: .9, r: 1, routine: 'gambade' }]
];
const DEBOUT = [
  [{ x: .25, z: -.45, r: .3 }, { x: -.05, z: .85, r: .2 }],
  [{ x: -.35, z: .95, r: .4 }, { x: .45, z: .95, r: -.3 }],
  [{ x: .45, z: .5, r: -.2 }, { x: -.75, z: .5, r: .2 }],
  [{ x: -.35, z: .85, r: .3 }, { x: .25, z: .95, r: -.3 }]
];
const ACTIVITE = [
  [{ x: -.8, z: -.65, y: .36, r: -.92, joue: 1, assis: 1, via: [[-.4, -.55]] }, { x: -.2, z: .1, y: .36, r: -1.35, joue: 1, assis: 1, via: [[.2, .25]] }],
  [{ x: -.775, z: .227, y: .44, r: 1.22, assis: 1, via: [[-.6, .8]] }, { x: .78, z: .2, y: .36, r: -1.22, assis: 1, via: [[.75, .75]] }],
  [{ x: .225, z: -1.18, y: .5, r: 0, lit: 1, assis: 1, via: [[.6, -.65]] }, { x: -.625, z: -1.18, y: .5, r: 0, lit: 1, assis: 1, via: [[-.95, -.65]] }],
  [{ x: .684, z: -.244, y: .5, r: -1.12, grignote: 1, assis: 1, via: [[.15, .02]] }, { x: 1.054, z: .522, y: .5, r: -1.12, grignote: 1, assis: 1, via: [[.52, .78]] }]
];
const BASE = { souffle: 1, salut: 0, arrose: 0, lit: 0, joue: 0, dort: 0, mange: 0, grignote: 0, pense: 0, pousse: 0, acclame: 0, assis: 0, cache: 0, remue: 0, teteX: 0, teteY: 0 };
const DRAPEAUX = ['arrose', 'lit', 'joue', 'dort', 'mange', 'grignote', 'assis'];
const drapeaux = p => Object.fromEntries(DRAPEAUX.map(k => [k, p[k] || 0]));
const poseDe = (h, n) => (n <= 1 ? VIE : n === 2 ? DEBOUT : ACTIVITE)[h.i][h.j];
// état de la scène attendu à chaque chapitre
const cible = (n, k) => ({
  ouvre: n ? 1 : 0, trace: n ? 2 : 0, rotW: n === 0 ? 1 : n === 3 && k >= 4 ? .35 : 0,
  nuit: n === 3 ? 1 : 0, tele0: n === 3 ? 1 : 0, tele3: n === 3 ? 1 : 0, plaid: n === 3 ? 1 : 0,
  balle: n <= 1 ? 1 : 0, pelote: n <= 1 ? 1 : 0
});
const JEU = ['#FFB4A2', '#A8E6CF', '#FFE08A', '#B9AEEA', '#8FCBEA'].map(c => new THREE.Color(c));
const SERIE = ['#9DB8F0', '#C3B5F5', '#8FD3E8', '#F5C7B8', '#A5C8F2'].map(c => new THREE.Color(c));
const NOIR = new THREE.Color('#2E2A33');
const NUIT = new THREE.Color('#2B2A4A');

// ombre ronde et douce sous un animal
function texOmbreRonde() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(80,50,40,.55)'); g.addColorStop(1, 'rgba(80,50,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// échiquier (sur le guéridon des chats) : damier 4 × 4, des pièces de chaque côté, une qui joue
function echiquier(m) {
  const groupe = new THREE.Group(), c = .1, clairs = [], fonces = [];
  groupe.position.y = .54;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) ((i + j) % 2 ? fonces : clairs).push(preparer(new THREE.BoxGeometry(c, .012, c).translate((i - 1.5) * c, .006, (j - 1.5) * c)));
  assembler(groupe, [['bois', bloc(.46, .01, .46, .004, 0, -.004, 0)]], m);
  groupe.add(new THREE.Mesh(fusion(clairs), m.clair), new THREE.Mesh(fusion(fonces), m.fonce));
  const piece = (mat, x, z, h = 1) => {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(new THREE.CylinderGeometry(.016, .024, .045 * h, 10).translate(0, .0225 * h, 0), mat));
    p.add(new THREE.Mesh(new THREE.SphereGeometry(.019, 10, 8).translate(0, .045 * h + .012, 0), mat));
    p.position.set(x, .012, z);
    groupe.add(p);
    return p;
  };
  piece(m.beurre, -.15, -.15); piece(m.beurre, -.15, .15, 1.5);
  piece(m.signal, .15, .15); piece(m.signal, .15, -.05, 1.5);
  return { groupe, mobiles: [piece(m.beurre, -.15, .05), piece(m.signal, .15, -.15)], cases: [[[-.15, .05], [-.05, .05]], [[.15, -.15], [.05, -.15]]] };
}
// deux tasses de thé fumantes sur la table basse des tortues
function tasses(m) {
  const groupe = new THREE.Group(), vapeurs = [];
  const matVapeur = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: .8, depthWrite: false });
  for (const x of [-.24, .22]) {
    assembler(groupe, [['clair', cyl(.06, .06, .008, x, .36, .08, 18)], ['clair', cyl(.04, .032, .07, x, .368, .08, 16)], ['bois', cyl(.034, .034, .004, x, .43, .08, 14)]], m);
    const anse = new THREE.Mesh(new THREE.TorusGeometry(.02, .006, 6, 12), m.clair);
    anse.position.set(x + .045, .405, .08);
    groupe.add(anse);
    for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), matVapeur); v.userData.x = x; v.visible = false; groupe.add(v); vapeurs.push(v); }
  }
  return { groupe, vapeurs, matVapeur };
}
// plaid rayé et bol de pop-corn, sur le canapé des lapins (repère du canapé) ; il grandit depuis son centre
function couverture(arete) {
  const plein = c => new THREE.MeshLambertMaterial({ color: c });
  const m = { plaid: plein('#FFB49C'), raie: plein('#FFE49A'), bol: plein('#9ECDA9'), mais: plein('#FFF6DC'), arete };
  const p = [['plaid', bloc(1.6, .27, .5, .1, 0, .52, .13)]];
  for (const x of [-.5, 0, .5]) p.push(['raie', bloc(.07, .29, .52, .02, x, .51, .13)]);
  p.push(['bol', cyl(.1, .075, .08, 0, .79, .3, 18)]);
  for (const [x, z] of [[-.04, .29], [.03, .27], [-.01, .34], [.04, .33], [-.06, .25], [.0, .3]]) p.push(['mais', facettes(.032, x, .885, z)]);
  const groupe = new THREE.Group();
  groupe.position.set(0, .66, .2);
  const contenu = assembler(new THREE.Group(), p, m);
  contenu.position.set(0, -.66, -.2);
  groupe.add(contenu);
  groupe.visible = false;
  return { groupe, m };
}

export function creerPiece({ toile, boite, bulle, textes = {}, chapitre = 0, visite = 0, surPrete, surPanne }) {
  const gsap = initialiser();
  const mq = matchMedia(REDUIT);
  let reduit = mq.matches;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, powerPreference: 'default' });
  let im, ma, ombres, mm;
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
    renderer.setClearColor(0x000000, 0);
    im = construireImmeuble();
    ma = matieresAnimaux();
    ombres = atelierOmbres();
    mm = APPARTEMENTS.map(def => matieresMeubles(def.meubles));
  } catch (e) {
    renderer.dispose();
    throw e;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 140);
  // lumière douce : ciel blanc, rebond pêche, un soleil d'avant droit (pas de carte d'ombres)
  scene.add(new THREE.HemisphereLight('#fffaf4', '#e9cdbd', .8 * Math.PI));
  const soleil = new THREE.DirectionalLight('#ffffff', .62 * Math.PI);
  soleil.position.set(3.5, 6, 4.5);
  scene.add(soleil, im.groupe);

  // ---------- les appartements : leurs meubles (une palette chacun) et leurs accessoires
  const apparts = APPARTEMENTS.map((def, i) => {
    const groupe = im.appartements[i].groupe, meubles = {};
    for (const [nom, d] of Object.entries(PIECES[i])) {
      const mb = construireMeuble(d.id || nom, mm[i], ombres);
      groupe.add(mb.objet);
      meubles[nom] = mb;
    }
    return { i, groupe, meubles, ordre: Object.keys(meubles), dispo: null };
  });
  const balle = new THREE.Group();
  balle.add(new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), ma.corail));
  const bandeBalle = new THREE.Mesh(new THREE.TorusGeometry(.07, .012, 6, 20), ma.beurre);
  balle.add(bandeBalle);
  apparts[0].groupe.add(balle);
  const pelote = new THREE.Group();
  pelote.add(new THREE.Mesh(new THREE.SphereGeometry(.075, 16, 12), ma.lilas));
  [0, 1.1, 2.2].forEach(a => { const f = new THREE.Mesh(new THREE.TorusGeometry(.074, .006, 5, 22), ma.zzz); f.rotation.set(a, a * .7, 0); pelote.add(f); });
  apparts[1].groupe.add(pelote);
  const echecs = echiquier(mm[1]);
  apparts[1].meubles.gueridon.objet.add(echecs.groupe);
  const the = tasses(mm[2]);
  apparts[2].meubles.table.objet.add(the.groupe);
  const plaid = couverture(mm[3].arete);
  apparts[3].meubles.canape.objet.add(plaid.groupe);
  // humeurs des meubles : le fauteuil des chats boude (nuage d'orage), le lampadaire des lapins est sonné
  const orage = nuageOrage(ma);
  orage.position.y = 1.1;
  apparts[1].meubles.fauteuil.objet.add(orage);
  const sonne = couronneEtoiles(ma, .24, 5);
  sonne.position.y = 1.78;
  apparts[3].meubles.lampadaire.objet.add(sonne);

  // ---------- les habitants
  const tOmbre = texOmbreRonde();
  const habitants = HABITANTS.map((liste, i) => liste.map((look, j) => {
    const a = creerAnimal(ma, look);
    const o = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tOmbre, transparent: true, opacity: .3, depthWrite: false }));
    o.renderOrder = 1;
    a.objet.add(o);
    a.ombre = o;
    apparts[i].groupe.add(a.objet);
    return { a, i, j, emu: false, occupe: 0, n: j };
  }));
  const tous = habitants.flat();
  const coeurs = reserveCoeurs(18);
  scene.add(coeurs.groupe);
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const coeursSur = (a, n = 2) => { a.tete.getWorldPosition(_v); coeurs.jaillir(gsap, _v.x, _v.y + .4, _v.z, n); };

  // la nuit chez les lapins : leurs meubles, eux et le plaid s'assombrissent, la télé les éclaire
  const sombres = [];
  const assombrir = m => { if (m?.color && m.emissive && !sombres.some(([x]) => x === m)) sombres.push([m, m.color.clone()]); };
  Object.entries(mm[3]).forEach(([cle, m]) => { if (cle !== 'arete' && cle !== 'ecran') assombrir(m); });
  habitants[3].forEach(h => Object.values(h.a.mats).forEach(assombrir));
  Object.values(plaid.m).forEach(assombrir);

  // état animé (GSAP)
  const etat = { ouvre: 0, trace: 0, rotW: 1, nuit: 0, tele0: 0, tele3: 0, plaid: 0, balle: 1, pelote: 1 };
  const act = apparts.map(() => ({ v: 0 }));   // activité de chaque appartement (chapitre 3)
  const cam = { ...CAM.immeuble };
  const tps = { rot: 0 };
  let courant = -1, visiteCourante = 0, voulu = chapitre, voulueVisite = visite;
  let introFaite = false, introTl = null, histoire = null, histoireNom = '', routines = [];
  let raf = 0, avant = 0, t = 0, detruit = false, premiere = false, visible = true, nuitVue = -1;
  let largeur = 1, hauteur = 1, px = 0, py = 0, vx = 0, vy = 0;

  // ---------- meubles
  // passage d'un agencement à l'autre : chaque meuble se soulève, glisse et retombe (en cascade)
  function disposer(ap, nom, instant) {
    ap.dispo = nom;
    ap.ordre.forEach((id, k) => {
      const o = ap.meubles[id].objet, [x, z, r] = PIECES[ap.i][id][nom];
      gsap.killTweensOf([o.position, o.rotation, o.scale]);
      if (instant) { o.position.set(x, 0, z); o.rotation.set(0, r, 0); o.scale.set(1, 1, 1); return; }
      const haut = id.startsWith('tapis') ? .2 : id === 'etagere' ? .35 : .45 + (k % 3) * .08;
      gsap.timeline({ delay: k * .06 })
        .to(o.position, { y: haut, duration: .32, ease: 'power2.out' }, 0)
        .to(o.position, { x, z, duration: .7, ease: COURBES.pivot }, .04)
        .to(o.rotation, { y: proche(o.rotation.y, r), duration: .7, ease: COURBES.pivot }, .04)
        .to(o.position, { y: 0, duration: .34, ease: 'power2.in' }, .52)
        .fromTo(o.scale, { ...ECRASE }, { x: 1, y: 1, z: 1, duration: .32, ease: 'power2.out', immediateRender: false }, .86);
    });
  }
  // le fauteuil boude, le lampadaire est sonné, puis tout se calme
  function bouder() {
    const f = apparts[1].meubles.fauteuil.objet;
    gsap.timeline()
      .set(orage, { visible: true }, 0)
      .to(orage.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(3)' }, 0)
      .to(orage.position, { y: 1.18, duration: .25, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0)
      .to(f.rotation, { z: .07, duration: .06, yoyo: true, repeat: 9, ease: 'sine.inOut' }, .1)
      .set(f.rotation, { z: 0 }, .7)
      .to(orage.scale, { x: .001, y: .001, z: .001, duration: .3, ease: 'power2.in' }, 2.1)
      .set(orage, { visible: false }, 2.4);
  }
  function sonner() {
    const lp = apparts[3].meubles.lampadaire.objet;
    gsap.timeline()
      .set(sonne, { visible: true }, 0)
      .to(sonne.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(3)' }, 0)
      .to(lp.rotation, { z: .14, duration: .22, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0)
      .to(lp.rotation, { x: .1, duration: .3, yoyo: true, repeat: 5, ease: 'sine.inOut' }, .1)
      .to(lp.rotation, { x: 0, z: 0, duration: .3 }, 1.9)
      .to(sonne.scale, { x: .001, y: .001, z: .001, duration: .3, ease: 'power2.in' }, 2.1)
      .set(sonne, { visible: false }, 2.4);
  }
  function calmer() {
    const f = apparts[1].meubles.fauteuil.objet, lp = apparts[3].meubles.lampadaire.objet;
    gsap.killTweensOf([orage, orage.scale, orage.position, sonne, sonne.scale, f.rotation, lp.rotation]);
    orage.visible = sonne.visible = false;
    orage.scale.setScalar(.001); sonne.scale.setScalar(.001); orage.position.y = 1.1;
    f.rotation.z = 0; lp.rotation.x = lp.rotation.z = 0;
  }

  // ---------- animaux
  function tuerAnimal(a) {
    gsap.killTweensOf([a.objet.position, a.objet.rotation, a.saut.position, a.saut.rotation, a.corps.scale, a.corps.rotation, a.tete.rotation, a.etat, a.alerte, a.alerte.scale, a.alerte.rotation, a.etoiles, a.etoiles.scale]);
  }
  function remettre(a, p, n, k) {
    a.objet.rotation.x = a.objet.rotation.z = 0;
    a.saut.position.set(0, 0, 0); a.saut.rotation.set(0, 0, 0);
    a.corps.scale.set(1, 1, 1); a.corps.rotation.set(0, 0, 0); a.tete.rotation.set(0, 0, 0);
    const salue = n === 3 && k >= 4;
    Object.assign(a.etat, BASE, drapeaux(p), { salut: salue ? 1 : 0 });
    a.regard(salue ? 'content' : 'normal');
    a.alerte.visible = false; a.alerte.scale.setScalar(.001);
    a.etoiles.visible = false; a.etoiles.scale.setScalar(.001);
  }
  // pose de fin de chapitre, d'un coup (la taille, saut.scale, est laissée à l'appelant)
  function poserAnimal(h, n, k) {
    const a = h.a, p = poseDe(h, n);
    tuerAnimal(a);
    a.objet.visible = true;
    a.objet.position.set(p.x, p.y || 0, p.z);
    a.objet.rotation.y = p.r;
    a.objet.userData.sol = p.y || 0;
    h.emu = false;
    remettre(a, p, n, k);
  }
  // fige un animal là où il est (sa vie d'avant interrompue) : il garde sa place
  function stabiliser(h) {
    const a = h.a, p = VIE[h.i][h.j];
    tuerAnimal(a);
    a.saut.scale.set(1, 1, 1);
    a.objet.position.y = p.y || 0;
    h.emu = false;
    remettre(a, p, 1, 0);
  }
  // vie d'avant : le chien joue à la balle, la tortue se promène, le lapin gambade (en boucle)
  function arreterRoutines() { routines.forEach(r => r.kill()); routines = []; }
  function lancerRoutines() {
    arreterRoutines();
    if (reduit) return;
    for (const h of tous) {
      const p = VIE[h.i][h.j], a = h.a;
      let tl = null;
      if (p.routine === 'balle') {
        tl = gsap.timeline({ repeat: -1, delay: .3 })
          .add(marcher(gsap, a, [[1.1, -.3]], { depuis: [p.x, p.z] }))
          .to(a.etat, { remue: 1, duration: .2 })
          .to(a.saut.position, { y: .12, duration: .14, yoyo: true, repeat: 3, ease: 'power1.out' })
          .to(a.etat, { remue: 0, duration: .3 })
          .add(marcher(gsap, a, [[p.x, p.z]], { depuis: [1.1, -.3] }), '+=.3')
          .to(a.etat, { remue: 1, duration: .2 })
          .to(a.etat, { remue: 0, duration: .3 }, '+=.8');
      } else if (p.routine === 'promenade') {
        tl = gsap.timeline({ repeat: -1, delay: .5 })
          .add(marcher(gsap, a, [[-1.3, .95]], { depuis: [p.x, p.z] }))
          .to(a.etat, { teteY: .5, duration: .6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '+=.3')
          .add(marcher(gsap, a, [[p.x, p.z]], { depuis: [-1.3, .95] }), '+=.4')
          .to({}, { duration: 1 });
      } else if (p.routine === 'gambade') {
        tl = gsap.timeline({ repeat: -1, delay: .2 })
          .add(marcher(gsap, a, [[.9, .25], [.15, -.35], [p.x, p.z]], { depuis: [p.x, p.z] }))
          .to(a.tete.rotation, { z: .22, duration: .3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '+=.2')
          .to({}, { duration: .9 });
      }
      if (tl) routines.push(tl);
    }
  }

  // ---------- bulle (HTML, au-dessus de qui parle)
  let bulleBase = null, bulleTemp = null, bulleVue = null, bulleTexte = '', bulleLarge = 160, minuterieBulle = 0;
  const haut = (v, y) => v.set(v.x, v.y + y, v.z);
  const ancreAppart = i => v => {
    habitants[i][0].a.tete.getWorldPosition(_a);
    habitants[i][1].a.tete.getWorldPosition(_b);
    return haut(v.copy(_a).add(_b).multiplyScalar(.5), .62);
  };
  const ancreAnimal = a => v => haut(a.tete.getWorldPosition(v), .62);
  const ancreFin = v => v.set(0, SOLS[1] + AH + .45, 1.4);
  function definirBase(n, k) {
    const texte = n === 3 ? (k < 4 ? textes.visites?.[k] : textes.merci) : '';
    bulleBase = texte ? { texte, ancre: k < 4 ? ancreAppart(k) : ancreFin } : null;
    afficherBulle();
  }
  function dire(texte, ancre, duree) {
    if (!texte) return;
    bulleTemp = { texte, ancre };
    clearTimeout(minuterieBulle);
    minuterieBulle = setTimeout(() => { bulleTemp = null; afficherBulle(); }, duree * 1000);
    afficherBulle();
  }
  function afficherBulle() {
    const b = bulleTemp || bulleBase;
    bulleVue = b;
    marquer();
    if (!bulle) return;
    if (!b) { bulle.classList.remove('is-visible'); return; }
    if (b.texte === bulleTexte && bulle.classList.contains('is-visible')) return;
    bulle.classList.remove('is-visible');
    bulle.firstChild.textContent = bulleTexte = b.texte;
    bulleLarge = bulle.firstChild.offsetWidth || bulleLarge;
    void bulle.offsetWidth;   // relance l'apparition
    bulle.classList.add('is-visible');
  }
  function placerBulle() {
    if (!bulle || !bulleVue) return;
    bulleVue.ancre(_v).project(camera);
    const x = borne((_v.x + 1) / 2 * largeur, bulleLarge / 2 + 8, largeur - bulleLarge / 2 - 8);
    const y = borne((1 - _v.y) / 2 * hauteur, 64, hauteur - 8);
    bulle.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  // ---------- chapitres
  // tout à l'état du chapitre n, d'un coup, sauf la caméra
  function figer(n, k) {
    arreterRoutines();
    calmer();
    const dispo = n < 2 ? 'A' : 'B';
    apparts.forEach(ap => disposer(ap, dispo, true));
    tous.forEach(h => { poserAnimal(h, n, k); h.a.saut.scale.set(1, 1, 1); });
    gsap.killTweensOf([etat, ...act]);
    Object.assign(etat, cible(n, k));
    act.forEach(x => { x.v = n === 3 ? 1 : 0; });
  }
  function poser(n, k) {
    figer(n, k);
    gsap.killTweensOf(cam);
    Object.assign(cam, cadrage(n, k));
    if (n === 0) tps.rot = t;
    if (n <= 1) lancerRoutines();
    definirBase(n, k);
    marquer();
  }
  // un pas après l'autre jusqu'à (points), puis se tourner vers r ; rend la fin
  function allerVers(tl, a, points, debut, r, o = {}) {
    const m = marcher(gsap, a, points, o);
    tl.add(m, debut);
    const fin = debut + m.duration();
    if (r !== undefined) tl.to(a.objet.rotation, { y: () => proche(a.objet.rotation.y, r), duration: .3 }, fin);
    return fin + .3;
  }

  // 0 → 1 : la façade s'ouvre, le plan se trace ; ceux qui ne dorment pas sursautent
  function ouvrir(propre) {
    if (!propre) figer(0, 0);
    gsap.killTweensOf([cam, etat]);
    apparts.forEach(ap => { if (ap.dispo !== 'A') disposer(ap, 'A', true); });
    if (!routines.length) lancerRoutines();
    const tl = gsap.timeline();
    tl.to(etat, { rotW: 0, duration: .8, ease: 'power1.inOut' }, 0)
      .to(cam, { ...CAM.ouvert, duration: 1.9, ease: COURBES.pivot }, 0)
      .to(etat, { ouvre: 1, duration: 1.6, ease: 'back.out(1.2)' }, .3)
      .fromTo(etat, { trace: 0 }, { trace: 2, duration: 3.8, ease: 'none', immediateRender: false }, 1.4);
    tous.forEach((h, j) => { if (!VIE[h.i][h.j].dort) tl.add(surprise(gsap, h.a, { haut: .16 }), 1.2 + j * .1); });
    return tl;
  }

  // 1 → 2 : les meubles changent de place sous leurs pattes ; chacun réagit à sa façon
  function demenager(propre) {
    arreterRoutines();
    gsap.killTweensOf([cam, etat, ...act]);
    calmer();
    if (!propre) figer(1, 0);
    else {
      apparts.forEach(ap => { if (ap.dispo !== 'A') disposer(ap, 'A', true); });
      tous.forEach(stabiliser);
    }
    const [d1, d2] = habitants[0].map(h => h.a), [c1, c2] = habitants[1].map(h => h.a);
    const [t1, t2] = habitants[2].map(h => h.a), [l1, l2] = habitants[3].map(h => h.a);
    const T = [.5, .95, 1.4, 1.85];
    const tl = gsap.timeline();
    tl.to(cam, { ...CAM.amenager, duration: 1.5, ease: COURBES.pivot }, 0)
      .to(etat, { ouvre: 1, trace: 2, rotW: 0, duration: .5 }, 0)
      .to(etat, { balle: 0, pelote: 0, duration: .35, ease: 'power2.in' }, .3);
    T.forEach((x, i) => tl.call(() => disposer(apparts[i], 'B', false), null, x));
    // chiens : celui qui dormait sort du panier d'un bond, l'autre sursaute puis tourne sur lui-même
    let x = T[0], D = DEBOUT[0];
    tl.to(d1.etat, { dort: 0, assis: 0, duration: .2 }, x - .3)
      .add(surprise(gsap, d1), x - .25)
      .add(bond(gsap, d1, -1.05, -.2, { hauteur: .28, duree: .42 }), x + .05)
      .call(() => { d1.objet.userData.sol = 0; }, null, x + .47)
      .add(surprise(gsap, d2, { haut: .12 }), x + .1)
      .add(tournoyer(gsap, d2), x + 1);
    allerVers(tl, d1, [[D[0].x, D[0].z]], x + 1.7, D[0].r, { depuis: [-1.05, -.2] });
    allerVers(tl, d2, [[D[1].x, D[1].z]], x + 1.8, D[1].r);
    // chats : le dormeur saute du griffoir, l'autre bondit ; le fauteuil boude
    x = T[1]; D = DEBOUT[1];
    tl.to(c1.etat, { dort: 0, assis: 0, duration: .2 }, x - .45)
      .add(surprise(gsap, c1, { haut: .3 }), x - .4)
      .add(bond(gsap, c1, 1.2, -.7, { hauteur: .3, duree: .45 }), x + .05)
      .call(() => { c1.objet.userData.sol = 0; }, null, x + .5)
      .to(c2.etat, { assis: 0, duration: .2 }, x)
      .add(surprise(gsap, c2, { haut: .34 }), x + .1)
      .call(bouder, null, x + 1);
    allerVers(tl, c1, [[D[0].x, D[0].z]], x + 1.7, D[0].r, { depuis: [1.2, -.7] });
    allerVers(tl, c2, [[D[1].x, D[1].z]], x + 1.8, D[1].r);
    // tortues : elles rentrent dans leur carapace, puis ressortent, tout doucement
    x = T[2]; D = DEBOUT[2];
    tl.to(t1.etat, { arrose: 0, duration: .25 }, x - .3)
      .add(seCacher(gsap, t1, 1.4), x - .05)
      .add(seCacher(gsap, t2, 1.3), x + .05);
    allerVers(tl, t1, [[D[0].x, D[0].z]], x + 2, D[0].r);
    allerVers(tl, t2, [[D[1].x, D[1].z]], x + 2.1, D[1].r);
    // lapins : le tapis part sous celui qui grignotait (il tombe), l'autre file ; le lampadaire est sonné
    x = T[3]; D = DEBOUT[3];
    const [fx, fz] = [l1.objet.position.x - .15, l1.objet.position.z - .25];
    tl.to(l1.etat, { mange: 0, assis: 0, duration: .2 }, x - .3)
      .add(surprise(gsap, l1, { revenir: false }), x - .25)
      .add(surprise(gsap, l2), x + .05)
      .add(chute(gsap, l1, -.15, -.25), x + .5)
      .call(sonner, null, x + .9)
      .add(relever(gsap, l1), x + 2);
    allerVers(tl, l2, [[D[1].x, D[1].z]], x + 1.2, D[1].r);
    allerVers(tl, l1, [[D[0].x, D[0].z]], x + 3.3, D[0].r, { depuis: [fx, fz] });
    // une fois installés : contents
    T.forEach((x, i) => tl.call(() => habitants[i].forEach(h => { h.a.regard('content'); coeursSur(h.a, 2); }), null, x + (i === 2 ? 5.6 : 4)));
    return tl;
  }

  // 2 → 3 : chacun s'installe à son activité ; chez les lapins, plaid et lumière éteinte
  function emmenager(k) {
    figer(2, k);
    const tl = gsap.timeline(), fins = [0, 0, 0, 0];
    tl.to(cam, { ...cadrage(3, k), duration: 1.7, ease: COURBES.pivot }, 0);
    habitants.forEach((liste, i) => liste.forEach((h, j) => {
      const a = h.a, q = ACTIVITE[i][j], debut = .15 + i * .2 + j * .15;
      tl.call(() => a.regard('content'), null, debut);
      const fin = allerVers(tl, a, q.via, debut + .1, undefined, { duree: ESPECES[a.espece].duree * .8 }) - .3;
      tl.add(bond(gsap, a, q.x, q.z, { y: q.y, hauteur: .3, duree: .45, roulis: 0 }), fin)
        .call(() => { a.objet.userData.sol = q.y; }, null, fin + .45)
        .to(a.objet.rotation, { y: () => proche(a.objet.rotation.y, q.r), duration: .35 }, fin + .45)
        .to(a.etat, { ...drapeaux(q), duration: .45 }, fin + .55)
        .call(() => a.regard('normal'), null, fin + 1);
      fins[i] = Math.max(fins[i], fin + 1);
    }));
    fins.forEach((f, i) => tl.to(act[i], { v: 1, duration: .6 }, f).call(() => habitants[i].forEach(h => coeursSur(h.a, 2)), null, f + .1));
    tl.to(etat, { tele0: 1, duration: .4 }, fins[0] - .4)
      .to(etat, { plaid: 1, duration: .55, ease: 'back.out(2)' }, fins[3] - .3)
      .to(etat, { nuit: 1, tele3: 1, duration: 1.2, ease: 'power2.inOut' }, fins[3] + .3)
      .call(() => definirBase(3, k), null, k < 4 ? fins[k] + .2 : Math.max(...fins) + .4);
    if (k >= 4) tous.forEach((h, j) => tl.to(h.a.etat, { salut: 1, duration: .3 }, Math.max(...fins) + j * .06).call(() => h.a.regard('content'), null, Math.max(...fins) + j * .06));
    return tl;
  }

  // dans le dernier chapitre : on passe d'un appartement à l'autre ; à la fin, tout le monde salue
  function visiter(k) {
    const tl = gsap.timeline(), salue = k >= 4;
    tl.call(() => definirBase(-1), null, 0)
      .to(cam, { ...cadrage(3, k), duration: 1.4, ease: COURBES.pivot }, 0)
      .to(etat, { rotW: salue ? .35 : 0, duration: 1 }, 0);
    tous.forEach((h, j) => {
      const d = salue ? .9 + j * .06 : .1;
      tl.to(h.a.etat, { salut: salue ? 1 : 0, duration: .3 }, d)
        .call(() => { h.emu = false; h.a.regard(salue ? 'content' : 'normal'); if (salue) coeursSur(h.a, 2); }, null, d);
    });
    tl.call(() => definirBase(3, k), null, 1.1);
    return tl;
  }

  // autre passage (on remonte, ou on saute un chapitre) : la scène rejoint l'état du chapitre ;
  // les animaux disparaissent d'un petit « pop » et réapparaissent à leur place
  function rejoindre(n, k) {
    arreterRoutines();
    calmer();
    definirBase(-1);
    gsap.killTweensOf([cam, etat, ...act]);
    if (n === 0) tps.rot = t;
    const tl = gsap.timeline();
    tl.to(cam, { ...cadrage(n, k), duration: 1.5, ease: COURBES.pivot }, 0)
      .to(etat, { ...cible(n, k), duration: 1.1, ease: 'power2.inOut' }, 0)
      .to(act, { v: n === 3 ? 1 : 0, duration: .8 }, .3);
    const dispo = n < 2 ? 'A' : 'B';
    apparts.forEach((ap, i) => { if (ap.dispo !== dispo) tl.call(() => disposer(ap, dispo, false), null, .25 + i * .15); });
    tous.forEach((h, j) => {
      const d = .05 + j * .03;
      tl.to(h.a.saut.scale, { x: .001, y: .001, z: .001, duration: .22, ease: 'power2.in' }, d)
        .call(() => poserAnimal(h, n, k), null, d + .25)
        .to(h.a.saut.scale, { x: 1, y: 1, z: 1, duration: .5, ease: 'back.out(2)' }, 1.2 + j * .04);
    });
    if (n <= 1) tl.call(lancerRoutines, null, 1.9);
    if (n === 3) tl.call(() => definirBase(3, k), null, 1.6);
    return tl;
  }

  function aller(n, k, instant) {
    const de = courant, propre = !histoire || !histoire.isActive(), nom = histoireNom;
    courant = n; visiteCourante = k;
    survoler(null);   // la caméra bouge : l'animal sous la souris n'est plus le même
    if (histoire) { histoire.kill(); histoire = null; }
    if (instant) { poser(n, k); return; }
    if (de === 0 && n === 1) { histoire = ouvrir(propre); histoireNom = 'ouvrir'; }
    else if (de === 1 && n === 2) { histoire = demenager(propre || nom === 'ouvrir'); histoireNom = 'demenager'; }
    else if (de === 2 && n === 3) { histoire = emmenager(k); histoireNom = 'emmenager'; }
    else if (de === 3 && n === 3) {
      // une installation interrompue : chacun file à sa place avant la visite suivante
      if (!propre && nom !== 'visiter') figer(3, k);
      histoire = visiter(k); histoireNom = 'visiter';
    } else { histoire = rejoindre(n, k); histoireNom = 'rejoindre'; }
    histoire.eventCallback('onUpdate', marquer);
  }
  // état final sans animation (mouvement réduit)
  function toutDeSuite(n, k) {
    if (introTl) { introTl.kill(); introTl = null; }
    if (histoire) { histoire.kill(); histoire = null; }
    introFaite = true;
    [im.rdc, ...im.etages, im.facade, im.sommet].forEach(o => o.position.set(0, 0, 0));
    im.socle.scale.set(1, 1, 1);
    courant = n; visiteCourante = k;
    poser(n, k);
  }

  // intro : l'île apparaît, puis les étages tombent l'un sur l'autre
  function intro() {
    if (introFaite || introTl || detruit) return;
    if (reduit) { toutDeSuite(voulu, voulueVisite); return; }
    tps.rot = t;
    const tl = gsap.timeline({ onUpdate: marquer, onComplete: finIntro });
    tl.fromTo(im.socle.scale, { x: .001, y: .001, z: .001 }, { x: 1, y: 1, z: 1, duration: .8, ease: 'back.out(1.7)' }, 0)
      .fromTo(cam, { az: 12, el: 5 }, { az: CAM.immeuble.az, el: CAM.immeuble.el, duration: 2.6, ease: 'power2.inOut' }, 0);
    [[im.rdc], [im.etages[0]], [im.etages[1], im.facade], [im.sommet]].forEach((liste, i) => {
      liste.forEach(o => tl.fromTo(o.position, { y: 12 }, { y: 0, duration: .75, ease: 'bounce.out' }, .35 + i * .3));
    });
    tl.to(etat, { rotW: 1, duration: 1.4, ease: 'power1.inOut' }, 2.2);
    introTl = tl;
  }
  function finIntro() {
    introTl = null;
    introFaite = true;
    courant = 0; visiteCourante = 0;
    if (voulu !== 0) aller(voulu, voulueVisite, reduit);
  }
  function choisir(n, k = 0) {
    if (detruit) return;
    voulu = n; voulueVisite = k;
    if (!introFaite) {
      // on fait défiler pendant l'intro : elle s'achève vite, puis la scène rejoint le chapitre
      if (n !== 0) { intro(); introTl?.timeScale(3); }
      return;
    }
    if (n !== courant || (n === 3 && k !== visiteCourante)) aller(n, k, reduit);
  }

  // ---------- la vie de chaque appartement, à chaque image (tt : temps de la scène)
  function vivreApparts(tt) {
    // chiens : la balle roule devant le second (avant) ; à la console, chacun son tour applaudit (après)
    const chien = habitants[0][1].a;
    balle.visible = etat.balle > .01;
    if (balle.visible) {
      const r = chien.objet.rotation.y, bx = chien.objet.position.x + Math.sin(r) * .34, bz = chien.objet.position.z + Math.cos(r) * .34;
      const d = Math.hypot(bx - balle.position.x, bz - balle.position.z);
      balle.position.set(bx, .07 * etat.balle, bz);
      balle.rotation.y = r;
      bandeBalle.rotation.x += d / .07;
      balle.scale.setScalar(Math.max(.001, etat.balle));
    }
    habitants[0].forEach((h, j) => {
      const v = act[0].v * bosse(tt, 5.5, 1.3, j * 2.75);
      h.a.etat.acclame = v;
      basculer(h, v > .35, 'content');
    });
    // chats : la pelote (avant) ; les échecs, chacun son tour : il réfléchit, puis avance une pièce (après)
    const [c1, c2] = habitants[1].map(h => h.a);
    pelote.visible = etat.pelote > .01;
    let batte = 0;
    if (pelote.visible) {
      const r = c2.objet.rotation.y, s = Math.sin(tt * 2.2), l = .36 + .16 * s, cote = .08 * Math.sin(tt * 1.1);
      pelote.position.set(c2.objet.position.x + Math.sin(r) * l + Math.cos(r) * cote, .075 * etat.pelote, c2.objet.position.z + Math.cos(r) * l - Math.sin(r) * cote);
      pelote.rotation.set(tt * 2.4, 0, tt * 1.3);
      pelote.scale.setScalar(Math.max(.001, etat.pelote));
      batte = Math.pow(Math.max(0, -s), 3) * etat.pelote;
    }
    const a1 = act[1].v, pense = [0, 0], pousse = [0, 0];
    if (a1 > .001) {
      const tour = Math.floor(tt / 4) % 2, p = (tt % 4) / 4;
      pense[tour] = a1 * (1 - lisse(borne((p - .55) / .12)));
      pousse[tour] = a1 * (p > .68 && p < .96 ? Math.sin((p - .68) / .28 * Math.PI) : 0);
      echecs.mobiles.forEach((pc, j) => {
        const tj = tt - j * 4, n = Math.floor(tj / 8), q = borne((((tj % 8) + 8) % 8 / 4 - .72) / .2);
        const [a, b] = echecs.cases[j], de = n % 2 ? b : a, vers = n % 2 ? a : b, k = lisse(q);
        pc.position.set(de[0] + (vers[0] - de[0]) * k, .012 + Math.sin(q * Math.PI) * .05, de[1] + (vers[1] - de[1]) * k);
      });
    }
    c1.etat.pense = pense[0]; c1.etat.pousse = pousse[0]; c1.etat.teteX = .2 * a1;
    c2.etat.pense = pense[1]; c2.etat.pousse = Math.max(pousse[1], batte); c2.etat.teteX = .2 * a1 + .3 * etat.pelote;
    // tortues : le thé fume
    const a2 = act[2].v;
    the.vapeurs.forEach((v, i) => {
      v.visible = a2 > .01;
      if (!v.visible) return;
      const p = (tt * .45 + (i % 3) / 3) % 1;
      v.position.set(v.userData.x + Math.sin(p * 7 + i) * .012, .44 + p * .26, .08);
      v.scale.setScalar(Math.max(.001, Math.sin(p * Math.PI) * a2 * (.7 + p * .6)));
    });
    // lapins : sous le plaid, un sursaut devant la série de temps en temps
    plaid.groupe.visible = etat.plaid > .01;
    plaid.groupe.scale.setScalar(Math.max(.001, etat.plaid));
    habitants[3].forEach((h, j) => basculer(h, act[3].v > .5 && bosse(tt, 9, .9, 4 + j * .12) > .15, 'surpris'));
  }
  // une émotion passagère (sauf pendant le salut final)
  function basculer(h, oui, nom) {
    if (oui === h.emu) return;
    h.emu = oui;
    if (h.a.etat.salut > .5) return;
    h.a.regard(oui ? nom : 'normal');
  }
  // écran de télé : couleurs qui changent (jeu : vite ; série : lentement), lueur
  function ecran(i, niveau, rythme, palette, tt) {
    const m = mm[i].ecran;
    if (niveau < .002) { m.color.copy(NOIR); m.emissive.setScalar(0); return null; }
    const c = palette[Math.floor(tt / rythme) % palette.length], scint = .86 + .14 * Math.sin(tt * 23) * Math.sin(tt * 7.3);
    m.color.copy(NOIR).lerp(c, niveau * scint);
    m.emissive.copy(c).multiplyScalar(.45 * niveau);
    return c;
  }
  function nuitLapins(k, lueur, force) {
    if (Math.abs(k - nuitVue) > .001) {
      nuitVue = k;
      im.nuit(3, k);
      for (const [m, jour] of sombres) m.color.copy(jour).lerp(NUIT, k * .66);
    }
    for (const [m] of sombres) {
      if (lueur && k > .01) m.emissive.copy(lueur).multiplyScalar(.2 * k * force);
      else m.emissive.setScalar(0);
    }
  }

  // ---------- rendu
  function placer() {
    const asp = largeur / hauteur;
    const az = (cam.az + etat.rotW * 8 * Math.sin(2 * Math.PI * (t - tps.rot) / 26) + px * 3) * RAD;
    const el = borne(cam.el - py * 3, -5, 89) * RAD;
    const tv = Math.tan(cam.fov * RAD / 2);
    const dist = Math.max(cam.ry / tv, cam.rx / (tv * asp));
    camera.fov = cam.fov;
    camera.aspect = asp;
    camera.updateProjectionMatrix();
    camera.position.set(cam.cx + dist * Math.sin(az) * Math.cos(el), cam.cy + dist * Math.sin(el), cam.cz + dist * Math.cos(az) * Math.cos(el));
    camera.lookAt(cam.cx, cam.cy, cam.cz);
  }
  function rendre() {
    const tt = reduit ? T_FIXE : t;
    placer();
    im.ouvrir(etat.ouvre);
    im.tracer(etat.trace);
    im.vivre(tt);
    ecran(0, etat.tele0, .32, JEU, tt);
    nuitLapins(etat.nuit, ecran(3, etat.tele3, 1.3, SERIE, tt), etat.tele3 * (.8 + .2 * Math.sin(tt * 17) * Math.sin(tt * 5.1)));
    vivreApparts(tt);
    // ombres de contact des meubles : restent au sol, s'élargissent et pâlissent quand le meuble est en l'air
    for (const ap of apparts) for (const id of ap.ordre) {
      const { objet: o, ombre } = ap.meubles[id];
      if (!ombre) continue;
      const h = Math.max(0, o.position.y), s = 1 + h * .6;
      ombre.position.y = -o.position.y / (o.scale.y || 1);
      ombre.scale.set(s, 1, s);
      ombre.material.opacity = ombre.userData.base * (1 - borne(h / 1.2));
    }
    for (const h of tous) {
      const a = h.a, sol = a.objet.userData.sol || 0, haut = Math.max(0, a.objet.position.y - sol + a.saut.position.y);
      a.vivre(tt);
      a.ombre.position.y = sol - a.objet.position.y + .012;
      a.ombre.scale.setScalar(1 + haut * .8);
      a.ombre.material.opacity = .3 * (1 - borne(haut / .6)) * a.saut.scale.x;
      a.ombre.visible = Math.abs(a.objet.rotation.x) < .3;
    }
    placerBulle();
    renderer.render(scene, camera);
    if (!premiere) { premiere = true; surPrete?.(); }
  }

  // ---------- boucle : seulement à l'écran, onglet actif ; 60 images/s au plus
  let sale = true;
  const actif = () => visible && !document.hidden && !detruit;
  function marquer() { sale = true; if (reduit) relancer(); }
  function relancer() { if (!raf && actif()) { avant = 0; raf = requestAnimationFrame(boucle); } }
  function boucle(now) {
    raf = 0;
    if (!actif()) return;
    if (reduit) { if (sale) { sale = false; rendre(); } return; }
    raf = requestAnimationFrame(boucle);
    if (avant && now - avant < 14) return;
    const dt = avant ? Math.min(.05, (now - avant) / 1000) : 0;
    avant = now;
    t += dt;
    const k = 1 - Math.exp(-dt * 4);
    px += (vx - px) * k;
    py += (vy - py) * k;
    // la scène vit en continu (animaux, nuages, télés) : on rend chaque image tant qu'elle est à l'écran
    sale = false;
    rendre();
  }

  // ---------- les animaux se cliquent (et se survolent à la souris)
  const _p = new THREE.Vector3();
  function viser(e) {
    if (etat.ouvre < .6) return null;
    const b = toile.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    const tv = Math.tan(camera.fov * RAD / 2);
    let choix = null, dmin = Infinity;
    for (const h of tous) {
      if (h.a.saut.scale.x < .5) continue;
      h.a.tete.getWorldPosition(_p);
      _p.y -= .12;
      const dist = camera.position.distanceTo(_p);
      _p.project(camera);
      if (_p.z > 1) continue;
      const sx = (_p.x + 1) / 2 * b.width, sy = (1 - _p.y) / 2 * b.height;
      const rayon = Math.max(18, .42 / (2 * dist * tv) * b.height);
      const d = Math.hypot(mx - sx, my - sy);
      if (d < rayon && d < dmin) { dmin = d; choix = h; }
    }
    return choix;
  }
  let survole = null;
  function survoler(h) {
    if (h === survole) return;
    survole = h;
    if (h) { toile.dataset.curseur = textes.coucou || '👋'; toile.style.cursor = 'pointer'; saluer(h); }
    else { delete toile.dataset.curseur; toile.style.cursor = ''; }
  }
  function saluer(h) {
    const a = h.a;
    if (reduit || a.etat.salut > .5 || gsap.isTweening(a.etat)) return;
    gsap.timeline().to(a.etat, { salut: .9, duration: .25 }).to(a.etat, { salut: 0, duration: .3 }, 1.2);
  }
  function reagir(h) {
    const a = h.a, maintenant = performance.now();
    if (maintenant < h.occupe) return;
    h.occupe = maintenant + 1500;
    if (!reduit) { coucou(gsap, a, a.etat.salut > .5); coeursSur(a, 3); }
    const phrases = textes.clic?.[a.espece] || [];
    if (phrases.length) dire(phrases[h.n++ % phrases.length], ancreAnimal(a), 2.6);
  }
  const surSurvol = e => { if (e.pointerType === 'mouse') survoler(viser(e)); };
  const surQuitte = () => survoler(null);
  const surClic = e => { const h = viser(e); if (h) reagir(h); };
  toile.addEventListener('pointermove', surSurvol, { passive: true });
  toile.addEventListener('pointerleave', surQuitte);
  toile.addEventListener('click', surClic);

  // ---------- taille, visibilité, pointeur, préférence, perte du contexte
  function mesurer() {
    largeur = Math.max(1, boite.clientWidth);
    hauteur = Math.max(1, boite.clientHeight);
    renderer.setSize(largeur, hauteur, false);
    marquer();
  }
  const ro = new ResizeObserver(mesurer);
  ro.observe(boite);
  const io = new IntersectionObserver(entrees => {
    visible = entrees[entrees.length - 1].isIntersecting;
    if (visible) relancer();
  }, { rootMargin: '120px' });
  io.observe(boite);
  const surVisibilite = () => { if (!document.hidden) relancer(); };
  document.addEventListener('visibilitychange', surVisibilite);
  // parallaxe : la souris fait pivoter la caméra de ±3°, pas de contrôle orbital
  const fin = matchMedia('(pointer: fine)').matches;
  const surPointeur = e => {
    if (reduit) return;
    vx = borne((e.clientX / innerWidth) * 2 - 1, -1, 1);
    vy = borne((e.clientY / innerHeight) * 2 - 1, -1, 1);
  };
  const surSortie = () => { vx = vy = 0; };
  if (fin) {
    addEventListener('pointermove', surPointeur, { passive: true });
    document.documentElement.addEventListener('pointerleave', surSortie);
  }
  const surPreference = () => {
    reduit = mq.matches;
    if (reduit) { vx = vy = px = py = 0; toutDeSuite(voulu, voulueVisite); }
    else { if (courant <= 1) lancerRoutines(); relancer(); }
  };
  mq.addEventListener?.('change', surPreference);
  const surPerte = e => { e.preventDefault(); surPanne?.(); };
  toile.addEventListener('webglcontextlost', surPerte);

  // ---------- départ : immeuble assemblé hors champ (les étages tombent à l'intro), vie d'avant
  figer(0, 0);
  if (reduit) toutDeSuite(voulu, voulueVisite);
  else {
    lancerRoutines();
    im.socle.scale.setScalar(.001);
    [im.rdc, ...im.etages, im.facade, im.sommet].forEach(o => { o.position.y = 40; });
  }
  mesurer();
  sale = false;
  rendre();
  relancer();

  function detruire() {
    if (detruit) return;
    detruit = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(minuterieBulle);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', surVisibilite);
    removeEventListener('pointermove', surPointeur);
    document.documentElement.removeEventListener('pointerleave', surSortie);
    mq.removeEventListener?.('change', surPreference);
    toile.removeEventListener('webglcontextlost', surPerte);
    toile.removeEventListener('pointermove', surSurvol);
    toile.removeEventListener('pointerleave', surQuitte);
    toile.removeEventListener('click', surClic);
    delete toile.dataset.curseur;
    toile.style.cursor = '';
    if (introTl) introTl.kill();
    introTl = null;
    if (histoire) histoire.kill();
    histoire = null;
    arreterRoutines();
    calmer();
    gsap.killTweensOf([cam, etat, ...act]);
    tous.forEach(h => { tuerAnimal(h.a); gsap.killTweensOf(h.a.saut.scale); h.a.liberer(); });
    apparts.forEach(ap => ap.ordre.forEach(id => { const o = ap.meubles[id].objet; gsap.killTweensOf([o.position, o.rotation, o.scale]); }));
    coeurs.cacher(gsap);
    im.liberer();
    coeurs.liberer();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    Object.values(ma).forEach(x => x.dispose());
    mm.forEach(m => Object.values(m).forEach(x => x.dispose()));
    Object.values(plaid.m).forEach(x => x.dispose());
    the.matVapeur.dispose();
    ombres.liberer();
    tOmbre.dispose();
    renderer.dispose();
    if (!toile.isConnected) { try { renderer.forceContextLoss(); } catch (_) { /* déjà perdu */ } }
  }

  return { intro, chapitre: choisir, detruire };
}
