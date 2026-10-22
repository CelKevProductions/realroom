// Moteur de la scène d'accueil, chargé à la demande par PieceAccueil (three.js n'est pas dans le
// paquet initial). Un immeuble jouet de quatre appartements : des chiens, des chats, des tortues et des
// lapins y vivent comme des humains. L'histoire suit les chapitres de la page (défilement guidé) :
//   0 (héros) : l'immeuble s'assemble étage par étage, façade fermée ;
//   1 (Relever) : la façade s'ouvre comme une maison de poupée, le plan de chaque pièce se trace ; les
//     pièces sont vides et leurs habitants les relèvent au téléphone (l'un tourne sur lui-même, l'autre
//     fait le tour des murs, un faisceau balaie la pièce devant eux) ;
//   2 (Aménager), deux arrêts : les meubles arrivent (première proposition), puis Shuffle les change de
//     place sous leurs pattes : surprises, un lapin tombe, les tortues rentrent dans leur carapace, le
//     fauteuil boude ; et tout le monde est content ;
//   3 (Visiter), une visite par arrêt du défilement : on s'approche de chaque appartement (console, échecs,
//     lecture, série sous le plaid dans le noir), puis tout le monde salue et dit merci.
// En avançant d'un arrêt au suivant, l'histoire se joue ; en remontant ou en sautant, la scène rejoint
// l'état voulu. On peut jouer avec les animaux : un clic (ou un doigt posé) et ils répondent ; on les
// attrape (glisser à la souris, appui long au doigt) : il pend à la main et se balance ; on le secoue
// (les meubles sautent, les voisins sursautent, l'animal finit étourdi), on le lance (il rebondit sur les
// meubles, roule, bascule, puis rentre à sa place : physique.js) ; on les caresse en frottant la souris
// dessus. Ils contournent les meubles en marchant (chemins.js). Rendu seulement à l'écran et onglet actif ;
// mouvement réduit : l'état de chaque chapitre, immobile, et seulement le clic.
import * as THREE from 'three';
import { initialiser, COURBES } from '@/components/mouvement/regles.js';
import { matieresMeubles, atelierOmbres, construireMeuble, preparer, fusion, bloc, cyl, facettes, assembler, MEUBLES } from './maquette.js';
import { construireImmeuble, APPARTEMENTS, CENTRES, SOLS, AH, AP } from './immeuble.js';
import {
  matieresAnimaux, creerAnimal, couronneEtoiles, nuageOrage, reserveCoeurs, ESPECES,
  bond, marcher, surprise, chute, relever, cacherEtoiles, tournoyer, seCacher, coucou, proche
} from './animaux.js';
import { grille, chemin, pointLibre } from './chemins.js';
import { avancer, boitesDe, corpsDebout, pieds as piedsDu, CENTRE, PRISE } from './physique.js';
import { definitionAdaptative } from './definition.js';

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
// la pièce (repère d'un appartement) : un animal tenu ou lancé y reste
const MURS = { x: 1.85, zMin: -1.45, zMax: 1.3, plafond: 1.1 };

// meubles de chaque appartement (repère de l'appartement, m) : [x, z, orientation] de la première
// proposition (A) et de celle de Shuffle (B) ; avant, les pièces sont vides. Quand on reclique sur
// « Shuffle », une autre idée (C) : B en miroir (coord)
const PIECES = [
  { // 0 chiens : A, le canapé contre le mur de gauche face à la console ; B, deux poufs devant la console
    tapis: { A: [.1, -.1, 0], B: [-.5, .05, 0] },
    canape: { A: [-1.7, 0, R], B: [.55, -1.3, 0] },
    meubleTV: { A: [1.95, -.1, -R], B: [-1.6, -.1, R - .4] },
    pouf: { A: [-.85, -1.4, 0], B: [-.8, -.65, 0] },
    pouf2: { id: 'pouf', A: [-.85, 1.35, 0], B: [-.2, .1, 0] },
    plante: { A: [-1.85, -1.45, 0], B: [1.9, -1.45, 0] },
    lampadaire: { A: [-1.85, 1.4, 0], B: [-1.9, -1.45, 0] }
  },
  { // 1 chats : A, un coin lecture (fauteuil, lampe, guéridon) ; B, le guéridon et son échiquier entre le fauteuil et le pouf
    tapisRond: { A: [.9, -.4, 0], B: [0, .25, 0] },
    gueridon: { A: [.55, -.95, 0], B: [0, .2, 0] },
    fauteuil: { A: [1.45, -1, -.6], B: [-.85, .2, R - .35] },
    pouf: { A: [-1, .5, 0], B: [.78, .2, 0] },
    etagere: { A: [-1.05, -1.58, 0], B: [1.35, -1.58, 0] },
    plante: { A: [-1.9, -1.45, 0], B: [1.9, 1.2, 0] },
    lampadaire: { A: [1.95, -1.5, 0], B: [-1.9, 1.2, 0] }
  },
  { // 2 tortues : A, le canapé contre le mur de gauche, la table devant ; B, le canapé face à nous, la table basse et le thé
    tapis: { A: [-.6, -.2, R], B: [-.2, -.45, 0] },
    canape: { A: [-1.7, -.2, R], B: [-.2, -1.3, 0] },
    table: { A: [-.85, -.2, R], B: [-.2, -.25, 0] },
    etagere: { A: [.6, -1.58, 0], B: [1.98, -.65, -R] },
    lampadaire: { A: [-1.85, -1.5, 0], B: [-1.75, -1.42, 0] },
    plante: { A: [1.85, -1.4, 0], B: [1.85, 1.25, 0] }
  },
  { // 3 lapins : A, la télé à gauche, le canapé à droite ; B, le canapé en biais face à la télé
    tapis: { A: [0, -.1, 0], B: [-.45, .2, 0] },
    canape: { A: [1.7, -.1, -R], B: [.95, .1, -R + .45] },
    meubleTV: { A: [-1.95, -.1, R], B: [-1.6, .05, R - .4] },
    etagere: { A: [.2, -1.58, 0], B: [-1.25, -1.58, 0] },
    lampadaire: { A: [1.9, 1.35, 0], B: [1.9, -1.45, 0] },
    plante: { A: [-1.9, -1.45, 0], B: [1.9, 1.3, 0] }
  }
];
// habitants (deux par appartement)
const HABITANTS = [
  [{ espece: 'chien', pelage: '#F1C08B', clair: '#FFF3E2', sombre: '#B9835A', graine: 0 },
    { espece: 'chien', pelage: '#FFF6EA', clair: '#FFFFFF', sombre: '#A0806C', graine: 1 }],
  [{ espece: 'chat', pelage: '#F6B07A', clair: '#FFF0E0', graine: 2 },
    { espece: 'chat', pelage: '#B8B2AC', clair: '#F2EEEA', graine: 3 }],
  [{ espece: 'tortue', pelage: '#AEC9A4', clair: '#F4ECD6', carapace: '#7FA48A', accessoire: 'lunettes', couverture: 'corail', graine: 4 },
    { espece: 'tortue', pelage: '#B9CFAE', clair: '#F4ECD6', carapace: '#C9A27A', couverture: 'menthe', graine: 5 }],
  [{ espece: 'lapin', graine: 6 },
    { espece: 'lapin', graine: 7 }]
];
// où ils sont et ce qu'ils font : le relevé des pièces vides (chapitres 0 et 1), debout parmi les
// meubles de la première proposition (2, premier arrêt) puis de Shuffle (2, second arrêt), à leur
// activité (3). via : le chemin jusqu'au siège ; etapes : les murs que l'on relève ([x, z, r]), assez
// loin pour que le faisceau ne les traverse pas.
const Q = Math.PI / 2;
const VIE = [
  [{ x: -.8, z: -.3, r: .9, scanne: 1, routine: 'tour' }, { x: .6, z: .7, r: 2.5, scanne: 1, routine: 'releve', etapes: [[.8, -.2, Q], [-.1, -.35, 2 * Q]] }],
  [{ x: .85, z: .45, r: -.6, scanne: 1, routine: 'tour' }, { x: -.3, z: .4, r: .5, scanne: 1, routine: 'releve', etapes: [[-.8, -.1, -Q], [.3, -.35, 2 * Q]] }],
  [{ x: .9, z: -.4, r: -.5, scanne: 1, routine: 'tour' }, { x: -.3, z: .7, r: -1.5, scanne: 1, routine: 'releve', etapes: [[-.8, .1, -Q], [0, -.35, 2 * Q]] }],
  [{ x: -.6, z: .4, r: .5, scanne: 1, routine: 'tour' }, { x: .3, z: .8, r: 1, scanne: 1, routine: 'releve', etapes: [[.8, .2, Q], [-.1, -.35, 2 * Q]] }]
];
const DEBOUT_A = [
  [{ x: .35, z: .45, r: -.5 }, { x: -.45, z: -.35, r: .6 }],
  [{ x: .3, z: .95, r: .3 }, { x: -.4, z: 1, r: -.2 }],
  [{ x: .55, z: .45, r: -.6 }, { x: -.15, z: .85, r: .3 }],
  [{ x: -.35, z: .3, r: .4 }, { x: .55, z: .75, r: -.3 }]
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
const BASE = { souffle: 1, salut: 0, arrose: 0, lit: 0, joue: 0, dort: 0, mange: 0, grignote: 0, pense: 0, pousse: 0, acclame: 0, assis: 0, cache: 0, remue: 0, teteX: 0, teteY: 0, scanne: 0 };
const DRAPEAUX = ['arrose', 'lit', 'joue', 'dort', 'mange', 'grignote', 'assis', 'scanne'];
const drapeaux = p => Object.fromEntries(DRAPEAUX.map(k => [k, p[k] || 0]));
// C, l'autre idée de Shuffle : B en miroir (les meubles comme les poses)
const coord = (i, id, nom) => { const d = PIECES[i][id]; if (nom !== 'C') return d[nom]; const [x, z, r] = d.B; return [-x, z, -r]; };
const miroir = p => ({ ...p, x: -p.x, r: -p.r, via: p.via?.map(([x, z]) => [-x, z]) });
const deboutDe = (nom, i, j) => (nom === 'A' ? DEBOUT_A[i][j] : nom === 'C' ? miroir(DEBOUT[i][j]) : DEBOUT[i][j]);
// v : la disposition de Shuffle en cours (B, ou C)
const poseDe = (h, n, k, v) => (n <= 1 ? VIE[h.i][h.j] : n === 2 ? deboutDe(k ? v : 'A', h.i, h.j) : v === 'C' ? miroir(ACTIVITE[h.i][h.j]) : ACTIVITE[h.i][h.j]);
// disposition des meubles à chaque arrêt : aucune (pièces vides), la première proposition, Shuffle
const dispoDe = (n, k, v) => (n <= 1 ? null : n === 2 && !k ? 'A' : v);
// état de la scène attendu à chaque chapitre
const cible = (n, k) => ({
  ouvre: n ? 1 : 0, trace: n ? 2 : 0, rotW: n === 0 ? 1 : n === 3 && k >= 4 ? .35 : 0,
  nuit: n === 3 ? 1 : 0, tele0: n === 3 ? 1 : 0, tele3: n === 3 ? 1 : 0, plaid: n === 3 ? 1 : 0
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
// plaid rayé sur les genoux des lapins (repère du canapé) : un drap souple qui épouse leurs genoux et
// retombe en plis devant l'assise, avec un bol de pop-corn posé dessus. Il se déplie depuis le centre.
const GENOUX = [-.425, .425];   // où sont assis les lapins (x du canapé)
function couverture(arete) {
  // les rayures : une petite texture peinte (corail, raies beurre, bordure)
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#FFB49C'; x.fillRect(0, 0, 256, 64);
  x.fillStyle = '#FFE49A';
  for (let k = 0; k < 7; k++) x.fillRect(14 + k * 36, 0, 10, 64);
  x.fillStyle = '#F7957A'; x.fillRect(0, 56, 256, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plein = col => new THREE.MeshLambertMaterial({ color: col });
  const m = { plaid: new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }), bol: plein('#9ECDA9'), mais: plein('#FFF6DC'), arete };
  // profil du drap (z, y), de sa lisière sous les ventres jusqu'au bord qui pend devant l'assise
  const profil = new THREE.SplineCurve([[.2, .64], [.33, .62], [.44, .58], [.5, .5], [.52, .36], [.53, .2]].map(([z, y]) => new THREE.Vector2(z, y)));
  const L = 1.5, NU = 40, NV = 26, g = new THREE.PlaneGeometry(1, 1, NU, NV), pos = g.attributes.position, _p = new THREE.Vector2();
  for (let k = 0; k < pos.count; k++) {
    const u = pos.getX(k) + .5, v = .5 - pos.getY(k), x = (u - .5) * L;
    profil.getPoint(v, _p);
    let z = _p.x, y = _p.y;
    const genoux = v < .55 ? Math.sin(Math.PI * v / .55) : 0;
    // il bombe sur les genoux, se creuse entre eux, tombe aux deux bouts
    y += genoux * (.08 * GENOUX.reduce((s, g0) => s + Math.exp(-(((x - g0) / .2) ** 2)), 0) - .03);
    y -= genoux * .07 * Math.max(0, (Math.abs(x) / (L / 2) - .75) / .25) ** 2;
    // des plis dans ce qui pend
    const pend = Math.max(0, (v - .55) / .45);
    z += pend * .025 * Math.sin(x * 22) + pend * pend * .03;
    pos.setXYZ(k, x, y, z);
  }
  g.computeVertexNormals();
  const drap = new THREE.Mesh(g, m.plaid);
  const p = [['bol', cyl(.1, .075, .08, 0, .6, .36, 18)]];
  for (const [bx, bz] of [[-.04, .35], [.03, .33], [-.01, .4], [.04, .39], [-.06, .31], [.0, .36]]) p.push(['mais', facettes(.032, bx, .695, bz)]);
  const groupe = new THREE.Group();
  groupe.position.set(0, .55, .4);
  const contenu = assembler(new THREE.Group(), p, m);
  contenu.add(drap);
  contenu.position.set(0, -.55, -.4);
  groupe.add(contenu);
  groupe.visible = false;
  return { groupe, m, tex };
}
// rideaux de la fenêtre des lapins : deux pans plissés sur une tringle ; ouverts le jour, fermés pour
// la série (c'est pour ça qu'il fait noir chez eux). Repère de l'appartement ; ferme(k) : 0 ouvert, 1 fermé
function rideaux(mat) {
  const groupe = new THREE.Group(), z = -AP / 2 + .24, pans = [];
  groupe.add(new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 2, 8).rotateZ(Math.PI / 2).translate(0, 2.2, z), mat.tringle));
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(1, 1.42, 30, 1), pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + .5;
      // pivot au bord extérieur, le pan s'étend vers le milieu ; ses plis se resserrent quand il s'ouvre
      pos.setXYZ(k, -s * x, pos.getY(k), .03 * Math.sin(x * 30));
    }
    g.computeVertexNormals();
    const pan = new THREE.Mesh(g, mat.rideau);
    pan.position.set(s * .95, 2.18 - .71, z);
    groupe.add(pan);
    pans.push(pan);
  }
  return {
    groupe,
    fermer(k) { pans.forEach(p => { p.scale.x = .24 + .76 * k; }); }
  };
}

export function creerPiece({ toile, boite, bulle, textes = {}, chapitre = 0, visite = 0, surPrete, surPanne }) {
  const gsap = initialiser();
  const mq = matchMedia(REDUIT);
  let reduit = mq.matches;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, powerPreference: 'default' });
  let im, ma, ombres, mm;
  try {
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
  // la caméra n'approche jamais à moins de 6 m : un plan proche loin de l'œil garde la profondeur précise
  // (sinon les surfaces très proches, comme un tapis sur le sol, scintillent)
  const camera = new THREE.PerspectiveCamera(30, 1, 1.5, 90);
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
  const echecs = echiquier(mm[1]);
  apparts[1].meubles.gueridon.objet.add(echecs.groupe);
  const the = tasses(mm[2]);
  apparts[2].meubles.table.objet.add(the.groupe);
  const plaid = couverture(mm[3].arete);
  apparts[3].meubles.canape.objet.add(plaid.groupe);
  const matRideaux = { rideau: new THREE.MeshLambertMaterial({ color: '#F6A08C', side: THREE.DoubleSide }), tringle: mm[3].fonce };
  const rideau = rideaux(matRideaux);
  apparts[3].groupe.add(rideau.groupe);
  rideau.fermer(0);
  im.appartements[3].lune.visible = false;   // rideaux fermés : pas de lune chez les lapins
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
    // son ombre est posée dans l'appartement (elle ne tourne pas quand il roule)
    const o = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tOmbre, transparent: true, opacity: .3, depthWrite: false }));
    o.renderOrder = 1;
    a.ombre = o;
    apparts[i].groupe.add(a.objet, o);
    // tenu, vol, retour : on joue avec lui (attrapé, lancé, il rentre à sa place) ; phys : son corps
    // (physique.js) tant qu'on joue avec lui ; parleFin : sa bouche bouge
    return { a, i, j, emu: false, occupe: 0, n: j, tenu: null, vol: null, retour: null, phys: null, parleFin: 0, sursaut: 0, caresse: 0 };
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
  assombrir(matRideaux.rideau);

  // état animé (GSAP)
  const etat = { ouvre: 0, trace: 0, rotW: 1, nuit: 0, tele0: 0, tele3: 0, plaid: 0 };
  const act = apparts.map(() => ({ v: 0 }));   // activité de chaque appartement (chapitre 3)
  const cam = { ...CAM.immeuble };
  const tps = { rot: 0 };
  let courant = -1, visiteCourante = 0, voulu = chapitre, voulueVisite = visite, variante = 'B';
  let introFaite = false, introTl = null, histoire = null, histoireNom = '', routines = [];
  let raf = 0, avant = 0, t = 0, detruit = false, premiere = false, visible = true, nuitVue = -1;
  let largeur = 1, hauteur = 1, px = 0, py = 0, vx = 0, vy = 0, tremble = 0, fete = 0;
  const enJeu = h => !!(h.tenu || h.vol || h.retour);

  // ---------- meubles
  const tuerMeuble = o => gsap.killTweensOf([o.position, o.rotation, o.scale]);
  // disposition voulue (null : pièce vide), d'un coup ou animée
  function placerMeubles(ap, nom, instant, delai = 0) {
    if (!nom) { if (ap.dispo || instant) retirerMeubles(ap, instant, delai); return; }
    if (!ap.dispo) livrerMeubles(ap, nom, instant, delai);
    else if (ap.dispo !== nom || instant) disposer(ap, nom, instant);
  }
  // pièce vidée : les meubles rapetissent et disparaissent
  function retirerMeubles(ap, instant, delai = 0) {
    ap.dispo = null;
    ap.ordre.forEach((id, k) => {
      const o = ap.meubles[id].objet;
      tuerMeuble(o);
      if (instant) { o.visible = false; o.scale.setScalar(.001); o.position.y = 0; o.rotation.x = o.rotation.z = 0; return; }
      gsap.timeline({ delay: delai + k * .04 })
        .to(o.scale, { x: .001, y: .001, z: .001, duration: .3, ease: 'back.in(2)' })
        .set(o, { visible: false });
    });
  }
  // les meubles arrivent : chacun apparaît sous le plafond, tombe à sa place et s'écrase un peu
  function livrerMeubles(ap, nom, instant, delai = 0) {
    ap.dispo = nom;
    ap.ordre.forEach((id, k) => {
      const o = ap.meubles[id].objet, [x, z, r] = coord(ap.i, id, nom);
      tuerMeuble(o);
      o.rotation.set(0, r, 0);
      if (instant) { o.visible = true; o.position.set(x, 0, z); o.scale.set(1, 1, 1); return; }
      const haut = id.startsWith('tapis') ? 1.1 : 1.5, d = delai + k * .13;
      o.position.set(x, haut, z);
      o.scale.setScalar(.001);
      gsap.timeline({ delay: d })
        .set(o, { visible: true })
        .to(o.scale, { x: 1, y: 1, z: 1, duration: .3, ease: 'back.out(2.2)' })
        .to(o.position, { y: 0, duration: .42, ease: 'power3.in' }, .18)
        .fromTo(o.scale, { ...ECRASE, y: .85 }, { x: 1, y: 1, z: 1, duration: .45, ease: 'elastic.out(1, .45)', immediateRender: false }, .6);
    });
  }
  // passage d'un agencement à l'autre : chaque meuble se soulève, glisse et retombe (en cascade)
  function disposer(ap, nom, instant) {
    ap.dispo = nom;
    ap.ordre.forEach((id, k) => {
      const o = ap.meubles[id].objet, [x, z, r] = coord(ap.i, id, nom);
      tuerMeuble(o);
      o.visible = true;
      o.rotation.x = o.rotation.z = 0;
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

  // ---------- chemins : chaque disposition a sa grille (chemins.js), calculée la première fois
  const grilles = apparts.map(() => ({}));
  const typeDe = (i, id) => PIECES[i][id].id || id;
  function grilleDe(i, nom) {
    if (!nom) return null;
    return (grilles[i][nom] ||= grille(apparts[i].ordre.filter(id => MEUBLES[typeDe(i, id)].pied).map(id => {
      const [x, z, r] = coord(i, id, nom), [lx, lz] = MEUBLES[typeDe(i, id)].pied;
      return { x, z, r, lx, lz };
    })));
  }
  // de (de) jusqu'au dernier des points, en passant par les autres, autour des meubles de la disposition nom
  function trajet(i, de, points, nom) {
    const b = grilleDe(i, nom), liste = [];
    let ici = de;
    for (const p of points) { liste.push(...chemin(b, ici, p)); ici = p; }
    return liste;
  }

  // ---------- animaux
  function tuerAnimal(a) {
    gsap.killTweensOf([a.objet.position, a.objet.rotation, a.saut.position, a.saut.rotation, a.corps.scale, a.corps.rotation, a.tete.rotation, a.etat, a.alerte, a.alerte.scale, a.alerte.rotation, a.etoiles, a.etoiles.scale]);
  }
  function remettre(a, p, n, k) {
    a.objet.rotation.x = a.objet.rotation.z = 0;
    a.objet.rotation.order = 'YXZ';
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
    const a = h.a, p = poseDe(h, n, k, variante);
    tuerAnimal(a);
    oublierJeu(h);
    a.objet.visible = true;
    a.objet.position.set(p.x, p.y || 0, p.z);
    a.objet.rotation.y = p.r;
    a.objet.userData.sol = p.y || 0;
    h.emu = false;
    remettre(a, p, n, k);
  }
  // fige un animal là où il est (ce qu'il faisait est interrompu) : il garde sa place, avec les
  // drapeaux de la pose p (sa vie dans la pièce vide, ou debout)
  function stabiliser(h, p) {
    const a = h.a;
    tuerAnimal(a);
    oublierJeu(h);
    a.saut.scale.set(1, 1, 1);
    a.objet.position.y = p.y || 0;
    h.emu = false;
    remettre(a, p, 1, 0);
  }
  // le relevé des pièces vides, en boucle : l'un tourne sur lui-même un quart de tour à la fois, l'autre
  // va d'un mur à l'autre, s'y tourne et le balaie de son faisceau
  function arreterRoutines() { routines.forEach(r => r.tl.kill()); routines = []; }
  function arreterRoutine(h) { routines = routines.filter(r => (r.h === h ? (r.tl.kill(), false) : true)); }
  function lancerRoutines() {
    arreterRoutines();
    if (reduit) return;
    tous.forEach(lancerRoutine);
  }
  function lancerRoutine(h) {
    arreterRoutine(h);
    if (reduit || enJeu(h)) return;
    {
      const p = VIE[h.i][h.j], a = h.a;
      let tl = null;
      if (p.routine === 'tour') {
        tl = gsap.timeline({ repeat: -1, delay: .6 + h.i * .15 });
        for (let q = 0; q < 4; q++) tl.to(a.objet.rotation, { y: `+=${Q}`, duration: 1.6, ease: 'sine.inOut' }).to({}, { duration: .9 });
      } else if (p.routine === 'releve') {
        tl = gsap.timeline({ repeat: -1, delay: .3 + h.i * .2 });
        let de = [p.x, p.z];
        for (const [x, z, r] of [...p.etapes, [p.x, p.z, p.r]]) {
          tl.add(marcher(gsap, a, [[x, z]], { depuis: de }))
            .to(a.objet.rotation, { y: () => proche(a.objet.rotation.y, r), duration: .5, ease: 'sine.inOut' })
            .to({}, { duration: 1.8 });
          de = [x, z];
        }
      }
      if (tl) routines.push({ h, tl });
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
  const ancreHaut = v => v.set(0, SOLS[1] + AH + .2, 1.6);
  function definirBase(n, k) {
    const texte = n === 3 ? (k < 4 ? textes.visites?.[k] : textes.merci) : '';
    bulleBase = texte ? { texte, ancre: k < 4 ? ancreAppart(k) : ancreFin } : null;
    // qui parle : le premier habitant de l'appartement visité, ou tout le monde à la fin
    if (texte) (k < 4 ? [habitants[k][0]] : tous).forEach(h => { h.parleFin = t + 1.3; });
    afficherBulle();
  }
  // h : l'animal qui parle (sa bouche bouge)
  function dire(texte, ancre, duree, h) {
    if (!texte) return;
    if (h) h.parleFin = t + Math.min(1.5, duree * .6);
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
    apparts.forEach(ap => placerMeubles(ap, dispoDe(n, k, variante), true));
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
  // un pas après l'autre jusqu'au dernier des points (en passant par les autres), en contournant les
  // meubles de la disposition dispo, puis se tourner vers r ; rend la fin
  function allerVers(tl, h, points, debut, r, dispo, o = {}) {
    const a = h.a, de = o.depuis || [a.objet.position.x, a.objet.position.z];
    const m = marcher(gsap, a, trajet(h.i, de, points, dispo), { ...o, depuis: de });
    tl.add(m, debut);
    const fin = debut + m.duration();
    if (r !== undefined) tl.to(a.objet.rotation, { y: () => proche(a.objet.rotation.y, r), duration: .3 }, fin);
    return fin + .3;
  }

  // 0 → 1 : la façade s'ouvre sur des pièces vides, le plan se trace pendant qu'ils les relèvent ; surpris,
  // ils sursautent
  function ouvrir(propre) {
    if (!propre) figer(0, 0);
    gsap.killTweensOf([cam, etat]);
    apparts.forEach(ap => { if (ap.dispo) retirerMeubles(ap, true); });
    if (!routines.length) lancerRoutines();
    const tl = gsap.timeline();
    tl.to(etat, { rotW: 0, duration: .8, ease: 'power1.inOut' }, 0)
      .to(cam, { ...CAM.ouvert, duration: 1.9, ease: COURBES.pivot }, 0)
      .to(etat, { ouvre: 1, duration: 1.6, ease: 'back.out(1.2)' }, .3)
      .fromTo(etat, { trace: 0 }, { trace: 2, duration: 3.8, ease: 'none', immediateRender: false }, 1.4);
    tous.forEach((h, j) => tl.add(surprise(gsap, h.a, { haut: .16 }), 1.2 + j * .1));
    return tl;
  }

  // 1 → 2, premier arrêt : les meubles arrivent dans les pièces vides (première proposition) ; chacun
  // interrompt ce qu'il faisait, s'écarte, puis vient voir, content
  function livrer(propre) {
    arreterRoutines();
    gsap.killTweensOf([cam, etat, ...act]);
    calmer();
    if (!propre) figer(1, 0);
    else {
      apparts.forEach(ap => { if (ap.dispo) retirerMeubles(ap, true); });
      tous.forEach(h => stabiliser(h, VIE[h.i][h.j]));
    }
    const T = [.45, .85, 1.25, 1.65];
    const tl = gsap.timeline();
    tl.to(cam, { ...CAM.amenager, duration: 1.6, ease: COURBES.pivot }, 0)
      .to(etat, { ouvre: 1, trace: 2, rotW: 0, duration: .5 }, 0);
    T.forEach((x, i) => {
      tl.call(() => livrerMeubles(apparts[i], 'A', false), null, x);
      habitants[i].forEach((h, j) => {
        const a = h.a, d = x + .3 + j * .12, q = DEBOUT_A[i][j];
        tl.to(a.etat, { dort: 0, mange: 0, lit: 0, assis: 0, scanne: 0, duration: .2 }, d - .1);
        if (a.espece === 'tortue') tl.add(seCacher(gsap, a, .7), d);
        else tl.add(surprise(gsap, a, { haut: a.etat.dort > .5 ? .3 : .18 }), d);
        const fin = allerVers(tl, h, [[q.x, q.z]], d + (a.espece === 'tortue' ? 1.3 : .9), q.r, 'A');
        tl.call(() => { a.regard('content'); coeursSur(a, 2); }, null, fin)
          .to(a.etat, { acclame: 1, duration: .25, yoyo: true, repeat: 1 }, fin);
      });
    });
    return tl;
  }

  // Shuffle ! les meubles passent de la disposition de à vers (B, ou C quand on reclique) sous leurs
  // pattes ; chacun réagit à sa façon, puis tout le monde est content
  function melanger(propre, de, vers) {
    arreterRoutines();
    gsap.killTweensOf([cam, etat, ...act]);
    calmer();
    if (!propre) figer(2, 0);
    else tous.forEach(h => stabiliser(h, deboutDe(de, h.i, h.j)));
    const [hd1, hd2] = habitants[0], [hc1, hc2] = habitants[1], [ht1, ht2] = habitants[2], [hl1, hl2] = habitants[3];
    const D = habitants.map(l => l.map(h => deboutDe(vers, h.i, h.j)));
    const T = [.5, .85, 1.2, 1.55];
    const tl = gsap.timeline();
    tl.call(() => dire(textes.shuffle, ancreHaut, 1.8), null, .05)
      .to(cam, { ...CAM.amenager, rx: CAM.amenager.rx * .95, ry: CAM.amenager.ry * .95, duration: .4, ease: 'power2.out' }, .1)
      .to(cam, { ...CAM.amenager, duration: .7, ease: 'power2.inOut' }, .5)
      .to(etat, { ouvre: 1, trace: 2, rotW: 0, duration: .4 }, 0);
    T.forEach((x, i) => tl.call(() => disposer(apparts[i], vers, false), null, x));
    const ici = h => [h.a.objet.position.x, h.a.objet.position.z];
    // chiens : l'un sursaute et s'écarte d'un bond, l'autre tourne sur lui-même, ravi
    let x = T[0];
    const [ex, ez] = pointLibre(grilleDe(0, vers), ici(hd1)[0] + .45, ici(hd1)[1] - .1);
    tl.add(surprise(gsap, hd1.a), x - .1)
      .add(bond(gsap, hd1.a, ex, ez, { hauteur: .26, duree: .4 }), x + .25)
      .add(tournoyer(gsap, hd2.a), x + .1);
    allerVers(tl, hd1, [[D[0][0].x, D[0][0].z]], x + 1.4, D[0][0].r, vers, { depuis: [ex, ez] });
    allerVers(tl, hd2, [[D[0][1].x, D[0][1].z]], x + 1.6, D[0][1].r, vers);
    // chats : le fauteuil leur fonce dessus, ils bondissent ; le fauteuil boude
    x = T[1];
    tl.add(surprise(gsap, hc1.a, { haut: .3 }), x)
      .add(surprise(gsap, hc2.a, { haut: .36 }), x + .25)
      .call(bouder, null, x + 1);
    allerVers(tl, hc1, [[D[1][0].x, D[1][0].z]], x + 1.5, D[1][0].r, vers);
    allerVers(tl, hc2, [[D[1][1].x, D[1][1].z]], x + 1.7, D[1][1].r, vers);
    // tortues : elles rentrent dans leur carapace, puis ressortent, tout doucement
    x = T[2];
    tl.add(seCacher(gsap, ht1.a, 1.3), x - .05)
      .add(seCacher(gsap, ht2.a, 1.2), x + .05);
    allerVers(tl, ht1, [[D[2][0].x, D[2][0].z]], x + 2, D[2][0].r, vers);
    allerVers(tl, ht2, [[D[2][1].x, D[2][1].z]], x + 2.1, D[2][1].r, vers);
    // lapins : le tapis part sous l'un (il tombe), l'autre sursaute ; le lampadaire est sonné
    x = T[3];
    const [fx, fz] = [ici(hl1)[0] - .15, ici(hl1)[1] - .25];
    tl.add(surprise(gsap, hl1.a, { revenir: false }), x - .25)
      .add(surprise(gsap, hl2.a), x + .05)
      .add(chute(gsap, hl1.a, -.15, -.25), x + .5)
      .call(sonner, null, x + .9)
      .add(relever(gsap, hl1.a), x + 2);
    allerVers(tl, hl2, [[D[3][1].x, D[3][1].z]], x + 1.2, D[3][1].r, vers);
    allerVers(tl, hl1, [[D[3][0].x, D[3][0].z]], x + 3.3, D[3][0].r, vers, { depuis: [fx, fz] });
    // une fois installés : contents, ils applaudissent
    T.forEach((x, i) => tl.call(() => habitants[i].forEach(h => { h.a.regard('content'); coeursSur(h.a, 2); }), null, x + (i === 2 ? 4.2 : i === 3 ? 5 : 3.2))
      .to(habitants[i].map(h => h.a.etat), { acclame: 1, duration: .25, yoyo: true, repeat: 1 }, x + (i === 2 ? 4.2 : i === 3 ? 5 : 3.2)));
    return tl;
  }

  // 2 → 3 : chacun s'installe à son activité ; chez les lapins, plaid et lumière éteinte
  function emmenager(k) {
    figer(2, 1);
    const tl = gsap.timeline(), fins = [0, 0, 0, 0];
    tl.to(cam, { ...cadrage(3, k), duration: 1.7, ease: COURBES.pivot }, 0);
    habitants.forEach((liste, i) => liste.forEach((h, j) => {
      const a = h.a, q = poseDe(h, 3, k, variante), debut = .15 + i * .2 + j * .15;
      tl.call(() => a.regard('content'), null, debut);
      const fin = allerVers(tl, h, q.via, debut + .1, undefined, variante, { duree: ESPECES[a.espece].duree * .8 }) - .3;
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
    const dispo = dispoDe(n, k, variante);
    apparts.forEach((ap, i) => { if (ap.dispo !== dispo) tl.call(() => placerMeubles(ap, dispo, false), null, .25 + i * .15); });
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
    const de = courant, kDe = visiteCourante, propre = !histoire || !histoire.isActive(), nom = histoireNom;
    survoler(null);   // la caméra bouge : l'animal sous la souris n'est plus le même
    finirJeux();      // l'histoire reprend la main sur les animaux avec qui on jouait
    courant = n; visiteCourante = k;
    if (histoire) { histoire.kill(); histoire = null; }
    if (instant) { poser(n, k); return; }
    if (de === 0 && n === 1) { histoire = ouvrir(propre); histoireNom = 'ouvrir'; }
    else if (de === 1 && n === 2 && k === 0) { histoire = livrer(propre || nom === 'ouvrir'); histoireNom = 'livrer'; }
    else if (de === 2 && kDe === 0 && n === 2 && k === 1) { histoire = melanger(propre, 'A', variante); histoireNom = 'melanger'; }
    else if (de === 2 && kDe === 1 && n === 3) { histoire = emmenager(k); histoireNom = 'emmenager'; }
    else if (de === 3 && n === 3) {
      // une installation interrompue : chacun file à sa place avant la visite suivante
      if (!propre && nom !== 'visiter') figer(3, k);
      histoire = visiter(k); histoireNom = 'visiter';
    } else { histoire = rejoindre(n, k); histoireNom = 'rejoindre'; }
    histoire.eventCallback('onUpdate', marquer);
  }
  // on reclique sur « Shuffle » alors qu'on y est déjà : une autre idée (B ↔ C)
  function encore() {
    if (detruit || !introFaite || courant !== 2 || visiteCourante !== 1) return;
    const de = variante, propre = !histoire || !histoire.isActive();
    survoler(null);
    finirJeux();
    if (histoire) { histoire.kill(); histoire = null; }
    if (!propre) figer(2, 1);
    variante = de === 'B' ? 'C' : 'B';
    if (reduit) { poser(2, 1); return; }
    histoire = melanger(true, de, variante);
    histoireNom = 'melanger';
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
    if (n !== courant || (n >= 2 && k !== visiteCourante)) aller(n, k, reduit);
  }

  // ---------- la vie de chaque appartement, à chaque image (tt : temps de la scène)
  function vivreApparts(tt) {
    // chiens : à la console, chacun son tour applaudit
    habitants[0].forEach((h, j) => {
      if (enJeu(h)) return;
      const v = act[0].v * bosse(tt, 5.5, 1.3, j * 2.75);
      if (act[0].v > .001) h.a.etat.acclame = v;
      basculer(h, v > .35, 'content');
    });
    // chats : les échecs, chacun son tour : il réfléchit, puis avance une pièce
    const [c1, c2] = habitants[1].map(h => h.a);
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
    if (!enJeu(habitants[1][0])) { c1.etat.pense = pense[0]; c1.etat.pousse = pousse[0]; c1.etat.teteX = .2 * a1; }
    if (!enJeu(habitants[1][1])) { c2.etat.pense = pense[1]; c2.etat.pousse = pousse[1]; c2.etat.teteX = .2 * a1; }
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
    habitants[3].forEach((h, j) => { if (!enJeu(h)) basculer(h, act[3].v > .5 && bosse(tt, 9, .9, 4 + j * .12) > .15, 'surpris'); });
    // à la fin, tout le monde est heureux : des cœurs jaillissent ici et là
    if (courant === 3 && visiteCourante >= 4 && !reduit && tt > fete) {
      fete = tt + 2.6;
      const h = tous[Math.floor(Math.random() * tous.length)];
      if (!enJeu(h)) coeursSur(h.a, 2);
    }
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
      rideau.fermer(borne(k * 1.7));   // les rideaux se ferment, puis la lumière baisse
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
    // tremble : on secoue un animal, la caméra tressaute
    const tr = tremble > .01 ? tremble : 0;
    const az = (cam.az + etat.rotW * 8 * Math.sin(2 * Math.PI * (t - tps.rot) / 26) + px * 3 + (Math.random() - .5) * tr) * RAD;
    const el = borne(cam.el - py * 3 + (Math.random() - .5) * tr * .7, -5, 89) * RAD;
    const tv = Math.tan(cam.fov * RAD / 2);
    const dist = Math.max(cam.ry / tv, cam.rx / (tv * asp));
    camera.fov = cam.fov;
    camera.aspect = asp;
    camera.updateProjectionMatrix();
    camera.position.set(cam.cx + dist * Math.sin(az) * Math.cos(el), cam.cy + dist * Math.sin(el), cam.cz + dist * Math.cos(az) * Math.cos(el));
    camera.lookAt(cam.cx, cam.cy, cam.cz);
    camera.updateMatrixWorld();
  }
  function rendre(dt = 0) {
    const tt = reduit ? T_FIXE : t;
    placer();
    jouer(dt);
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
      // l'ombre reste sous lui, au sol (ou sur son siège) ; en jeu, au sol de la pièce
      const a = h.a, o = a.objet, c = h.phys, sol = c ? 0 : o.userData.sol || 0;
      const haut = Math.max(0, (c ? c.y - CENTRE : o.position.y - sol) + a.saut.position.y);
      a.etat.parle = tt < h.parleFin ? 1 : 0;
      a.vivre(tt);
      a.ombre.position.set(c ? c.x : o.position.x, sol + .02, c ? c.z : o.position.z);
      a.ombre.scale.setScalar(1 + haut * .8);
      a.ombre.material.opacity = .3 * (1 - borne(haut / .8)) * a.saut.scale.x;
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
    if (avant) definition(now - avant);
    avant = now;
    t += dt;
    const k = 1 - Math.exp(-dt * 4);
    px += (vx - px) * k;
    py += (vy - py) * k;
    // la scène vit en continu (animaux, nuages, télés) : on rend chaque image tant qu'elle est à l'écran
    sale = false;
    rendre(dt);
  }

  // ---------- jouer avec les animaux : survol (il salue, ses yeux suivent la souris), clic (il répond),
  // caresse (frotter la souris dessus), attraper (glisser ; au doigt, appui long), secouer, lancer
  const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _w = new THREE.Vector3(), _ndc = new THREE.Vector2();
  const rayon = new THREE.Raycaster(), planTenu = new THREE.Plane(), AXE_Z = new THREE.Vector3(0, 0, 1);
  // position d'un animal à l'écran (px dans la toile), sa tête un peu plus bas que le sommet
  function aLEcran(h, b, out) {
    h.a.tete.getWorldPosition(_p);
    _p.y -= .12;
    const dist = camera.position.distanceTo(_p);
    _p.project(camera);
    if (_p.z > 1) return null;
    out.x = (_p.x + 1) / 2 * b.width; out.y = (1 - _p.y) / 2 * b.height; out.dist = dist;
    return out;
  }
  const _e = { x: 0, y: 0, dist: 0 };
  function viser(e) {
    if (etat.ouvre < .6) return null;
    const b = toile.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    const tv = Math.tan(camera.fov * RAD / 2);
    let choix = null, dmin = Infinity;
    for (const h of tous) {
      if (h.a.saut.scale.x < .5) continue;   // on peut le rattraper en plein vol
      if (!aLEcran(h, b, _e)) continue;
      const r = Math.max(18, .42 / (2 * _e.dist * tv) * b.height);
      const d = Math.hypot(mx - _e.x, my - _e.y);
      if (d < r && d < dmin) { dmin = d; choix = h; }
    }
    return choix;
  }
  let survole = null;
  function survoler(h) {
    if (h === survole) return;
    survole = h;
    frotte.chemin = 0; frotte.debut = t;
    if (h && !prise) { toile.dataset.curseur = textes.coucou || '👋'; toile.style.cursor = reduit ? 'pointer' : 'grab'; saluer(h); }
    else if (!prise) { delete toile.dataset.curseur; toile.style.cursor = ''; }
  }
  function saluer(h) {
    const a = h.a;
    if (reduit || enJeu(h) || a.etat.salut > .5 || gsap.isTweening(a.etat)) return;
    gsap.timeline().to(a.etat, { salut: .9, duration: .25 }).to(a.etat, { salut: 0, duration: .3 }, 1.2);
  }
  function reagir(h) {
    const a = h.a, maintenant = performance.now();
    if (maintenant < h.occupe || enJeu(h)) return;
    h.occupe = maintenant + 1500;
    if (!reduit) { coucou(gsap, a, a.etat.salut > .5); coeursSur(a, 3); }
    const phrases = textes.clic?.[a.espece] || [];
    if (phrases.length) dire(phrases[h.n++ % phrases.length], ancreAnimal(a), 2.6, h);
  }
  const phrase = (cle, a) => textes[cle]?.[a.espece] || '';
  // caresse : la souris frotte l'animal (quelques allers-retours) ; yeux en cœur, il ronronne ou remue la queue
  const frotte = { chemin: 0, debut: 0, x: 0, y: 0 };
  function caresser(h) {
    const a = h.a, maintenant = performance.now();
    if (enJeu(h) || maintenant < h.caresse || a.etat.dort > .5) return;
    h.caresse = maintenant + 2600;
    const avant = a.regardCourant;
    gsap.timeline()
      .call(() => a.regard('amoureux'))
      .to(a.etat, { remue: 1, duration: .2 }, 0)
      .to(a.corps.scale, { y: .92, x: 1.05, z: 1.05, duration: .18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0)
      .to(a.etat, { remue: 0, duration: .4 }, 1.6)
      .call(() => { if (a.regardCourant === 'amoureux') a.regard(avant === 'amoureux' ? 'normal' : avant); }, null, 1.8);
    coeursSur(a, 4);
    dire(phrase('caresse', a), ancreAnimal(a), 2, h);
  }

  // la main qui tient un animal est dans le plan vertical de sa position (repère de son appartement)
  function pointDansAppart(i, z, cx, cy, out) {
    const b = toile.getBoundingClientRect(), g = apparts[i].groupe;
    _ndc.set((cx - b.left) / b.width * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    rayon.setFromCamera(_ndc, camera);
    g.updateWorldMatrix(true, false);
    planTenu.setFromNormalAndCoplanarPoint(AXE_Z, g.localToWorld(_w.set(0, 0, z)));
    if (!rayon.ray.intersectPlane(planTenu, _t)) return null;
    return g.worldToLocal(out.copy(_t));
  }
  // on cesse de jouer avec lui (l'histoire va le replacer)
  function oublierJeu(h) {
    if (h.retour) { h.retour.kill(); h.retour = null; }
    if (h.tenu && prise?.h === h) prise = null;
    h.tenu = null; h.vol = null; h.phys = null;
    h.a.etat.tenu = 0;
    h.a.objet.rotation.z = 0;
    h.a.objet.rotation.order = 'YXZ';
    if (!tous.some(x => x.tenu)) { window.__rrSaisie = false; toile.style.cursor = ''; delete toile.dataset.curseurCache; }
  }
  // avant un changement de chapitre : ceux avec qui on jouait reprennent leur place d'un coup
  function finirJeux() {
    prise = null;
    for (const h of tous) {
      if (!enJeu(h) && !h.phys) continue;
      poserAnimal(h, courant < 0 ? 0 : courant, visiteCourante);
      h.a.saut.scale.set(1, 1, 1);
      if (courant <= 1) lancerRoutine(h);
    }
    window.__rrSaisie = false;
  }

  // le monde de l'animal en jeu (physique.js) : les murs de sa pièce, ses meubles là où ils sont à cet
  // instant (ils peuvent bouger), l'autre habitant
  function monde(h) {
    const ap = apparts[h.i], boites = [];
    if (ap.dispo) for (const id of ap.ordre) {
      const o = ap.meubles[id].objet;
      if (o.visible && o.scale.y > .5) boites.push(...boitesDe(typeDe(h.i, id), o.position.x, o.position.y, o.position.z, o.rotation.y, id));
    }
    const autres = habitants[h.i].filter(o => o !== h && !o.phys && o.a.saut.scale.x > .5)
      .map(o => ({ x: o.a.objet.position.x, y: o.a.objet.position.y + o.a.saut.position.y + .3, z: o.a.objet.position.z, r: .24, cle: o }));
    return { murs: [-2.17, 2.17], plafond: MURS.plafond + .8, z: [MURS.zMin, MURS.zMax], boites, autres };
  }
  // l'animal suit son corps (pieds, roulis) ; tenu, il se tourne vers nous
  const _q = { x: 0, y: 0, z: 0 };
  function suivreCorps(h, dt) {
    const o = h.a.objet;
    piedsDu(h.phys, _q);
    o.position.set(_q.x, _q.y, _q.z);
    o.rotation.z = h.phys.a;
    if (h.tenu) o.rotation.y += (proche(o.rotation.y, 0) - o.rotation.y) * (1 - Math.exp(-dt * 6));
  }
  // il heurte quelque chose : le meuble sursaute, l'autre animal aussi ; un mur, la pièce tremble
  function chocs(h, liste) {
    const a = h.a, maintenant = performance.now();
    for (const { cle, vitesse } of liste) {
      if (cle === 'sol' || cle === 'mur') {
        if (cle === 'mur' && vitesse > 2.5) tremble = Math.max(tremble, vitesse * .25);
        if (vitesse > 2 && !gsap.isTweening(a.corps.scale)) gsap.fromTo(a.corps.scale, { y: .78, x: 1.14, z: 1.14 }, { y: 1, x: 1, z: 1, duration: .35, ease: 'back.out(3)' });
      } else if (typeof cle === 'string') {
        const m = apparts[h.i].meubles[cle];
        if (m && vitesse > 1.4) cahoter(m.objet, Math.min(3, vitesse * .55), cle);
      } else if (cle?.a && maintenant > cle.sursaut && !enJeu(cle)) {
        cle.sursaut = maintenant + 1400;
        if (cle.a.espece === 'tortue') seCacher(gsap, cle.a, .8);
        else surprise(gsap, cle.a, { haut: .12 + Math.min(.2, vitesse * .04) });
      }
    }
  }
  function saisir(h, cx, cy) {
    const a = h.a, o = a.objet;
    arreterRoutine(h);
    tuerAnimal(a);
    if (h.retour) { h.retour.kill(); h.retour = null; }
    h.vol = null;
    a.saut.position.set(0, 0, 0); a.saut.rotation.set(0, 0, 0);
    a.corps.scale.set(1, 1, 1); a.corps.rotation.set(0, 0, 0); a.tete.rotation.set(0, 0, 0);
    Object.assign(a.etat, drapeaux({}), { salut: 0, pense: 0, pousse: 0, acclame: 0, teteX: 0, teteY: 0, cache: 0 });
    gsap.to(a.etat, { tenu: 1, duration: .2 });
    a.regard('surpris');
    a.alerte.visible = false;
    // son corps (physique.js), debout là où il est ; il tourne dans le plan de l'écran
    const z = borne(o.position.z, MURS.zMin + .1, MURS.zMax - .1);
    if (!h.phys) {
      h.phys = corpsDebout(o.position.x, o.position.y, z);
      o.rotation.x = o.rotation.z = 0;
      o.rotation.order = 'ZYX';
    }
    a.objet.userData.sol = 0;
    const c = h.phys;
    h.tenu = { z: c.z, cx, cy, tx: c.x, ty: c.y + PRISE, mx: c.x, my: c.y + PRISE, vx: 0, vy: 0, energie: 0, etourdi: !!h.vol?.etourdi, dernier: 0, duree: 0 };
    window.__rrSaisie = true;
    toile.style.cursor = 'grabbing';
    toile.dataset.curseurCache = '';   // la pastille du curseur compagnon cacherait l'animal tenu
    dire(phrase('saisie', a), ancreAnimal(a), 1.8, h);
  }
  function tenir(h, dt) {
    const a = h.a, s = h.tenu;
    if (pointDansAppart(h.i, s.z, s.cx, s.cy, _t)) { s.tx = borne(_t.x, -1.95, 1.95); s.ty = borne(_t.y, .6, MURS.plafond + .78); }
    // la main, lissée : sa vitesse et ses à-coups (la secousse)
    const k = 1 - Math.exp(-dt * 16), nx = s.mx + (s.tx - s.mx) * k, ny = s.my + (s.ty - s.my) * k;
    const vx = (nx - s.mx) / dt, vy = (ny - s.my) / dt, acc = Math.hypot(vx - s.vx, vy - s.vy) / dt;
    s.vx += (vx - s.vx) * .5; s.vy += (vy - s.vy) * .5;
    s.mx = nx; s.my = ny;
    // il pend à la main et se balance ; il bute contre les meubles et les murs
    chocs(h, avancer(h.phys, dt, monde(h), { x: s.mx, y: s.my, z: s.z }).chocs);
    suivreCorps(h, dt);
    s.energie = s.energie * Math.exp(-dt * 1.6) + Math.min(70, acc) * dt * .055;
    s.duree += dt;
    if (s.duree > .7 && !s.etourdi && a.regardCourant === 'surpris') a.regard('content');
    if (s.energie > 1 && t - s.dernier > .22) { s.dernier = t; secouer(h, s.energie); }
  }
  // secouer : la pièce tremble, les meubles sautent, les voisins sursautent ; l'animal finit étourdi
  function secouer(h, energie) {
    const f = Math.min(3, energie), a = h.a, s = h.tenu;
    tremble = Math.max(tremble, f * .9);
    apparts.forEach((ap, i) => {
      const force = i === h.i ? f : f * .3;
      if (force < .45 || !ap.dispo) return;
      ap.ordre.forEach(id => cahoter(ap.meubles[id].objet, force, id));
    });
    const maintenant = performance.now();
    for (const o of tous) {
      if (o === h || enJeu(o) || maintenant < o.sursaut || (o.i !== h.i && f < 2.2)) continue;
      o.sursaut = maintenant + 1600;
      if (o.a.espece === 'tortue') seCacher(gsap, o.a, .9);
      else surprise(gsap, o.a, { haut: .1 + f * .04 });
    }
    if (energie > 2 && !s.etourdi) {
      s.etourdi = true;
      a.regard('etourdi');
      gsap.set(a.etoiles, { visible: true });
      gsap.to(a.etoiles.scale, { x: 1, y: 1, z: 1, duration: .3, ease: 'back.out(3)' });
      dire(phrase('secoue', a), ancreAnimal(a), 1.8, h);
    }
  }
  // un meuble saute et vacille (le lampadaire se balance plus fort, le tapis frémit à peine)
  function cahoter(o, force, id) {
    if (gsap.isTweening(o.position)) return;
    const tapis = id.startsWith('tapis'), lampe = id === 'lampadaire';
    gsap.timeline()
      .to(o.position, { y: (tapis ? .012 : .045) * force * (.6 + Math.random() * .7), duration: .09, ease: 'power2.out' })
      .to(o.position, { y: 0, duration: .15, ease: 'power2.in' });
    if (tapis) return;
    const amp = (lampe ? .14 : .05) * force;
    gsap.timeline()
      .to(o.rotation, { z: (Math.random() < .5 ? -1 : 1) * amp, x: (Math.random() - .5) * amp, duration: .08, ease: 'sine.out' })
      .to(o.rotation, { z: 0, x: 0, duration: lampe ? 1.4 : .6, ease: 'elastic.out(1.2, .3)' });
  }
  // lâché : il garde son élan ; lancé fort, il part en vrille
  function lacherAnimal(h) {
    const s = h.tenu, c = h.phys, v = Math.hypot(c.vx, c.vy);
    h.tenu = null;
    if (!tous.some(x => x.tenu)) window.__rrSaisie = false;
    toile.style.cursor = survole ? 'grab' : '';
    delete toile.dataset.curseurCache;
    if (v > 3) c.w -= Math.sign(c.vx || 1) * (3 + v * 1.4);
    h.vol = { etourdi: s.etourdi || v > 5, repos: 0, duree: 0 };
    gsap.to(h.a.etat, { tenu: 0, duration: .4 });
  }
  function voler(h, dt) {
    const v = h.vol, c = h.phys;
    const r = avancer(c, dt, monde(h), null);
    chocs(h, r.chocs);
    suivreCorps(h, dt);
    v.duree += dt;
    // il s'arrête : posé sur le sol ou sur un meuble, presque immobile, un instant
    const calme = r.appui >= 0 && Math.hypot(c.vx, c.vy, c.vz) < .35 && Math.abs(c.w) < 1.6;
    v.repos = calme ? v.repos + dt : 0;
    if (v.repos > .25 || v.duree > 7) { h.vol = null; atterrir(h, Math.max(0, r.appui), v.etourdi); }
  }
  // à terre (ou sur un meuble) : couché sur le côté, il reste étourdi puis se relève d'un petit bond ;
  // debout, il est content (ou étourdi s'il a été secoué) ; puis il rentre à sa place
  function atterrir(h, appui, secoue) {
    const a = h.a, o = a.objet, c = h.phys, tl = gsap.timeline();
    c.a = Math.atan2(Math.sin(c.a), Math.cos(c.a));   // le tour le plus court pour se relever
    const couche = Math.abs(c.a) > .6, etourdi = couche || secoue;
    const corps = { a: c.a, y: c.y };
    const appliquer = () => { c.a = corps.a; c.y = corps.y; piedsDu(c, _q); o.position.set(_q.x, _q.y, _q.z); o.rotation.z = c.a; };
    const debout = () => { c.a = 0; c.vx = c.vy = c.vz = c.w = 0; o.rotation.z = 0; o.rotation.order = 'YXZ'; o.userData.sol = appui; h.phys = null; };
    tl.to(a.etat, { tenu: 0, duration: .25 }, 0);
    let fin = 0;
    if (couche) {
      tl.call(() => { a.regard('etourdi'); a.etoiles.visible = true; }, null, .05)
        .to(a.etoiles.scale, { x: 1, y: 1, z: 1, duration: .3, ease: 'back.out(3)' }, .05)
        .to(corps, { y: appui + CENTRE + .22, duration: .25, ease: 'power2.out', onUpdate: appliquer }, 1.3)
        .to(corps, { a: 0, duration: .4, ease: 'back.out(1.6)', onUpdate: appliquer }, 1.3)
        .to(corps, { y: appui + CENTRE, duration: .25, ease: 'power2.in', onUpdate: appliquer }, 1.55)
        .call(debout, null, 1.8)
        .fromTo(a.corps.scale, { y: .8, x: 1.12, z: 1.12 }, { y: 1, x: 1, z: 1, duration: .4, ease: 'back.out(3)', immediateRender: false }, 1.8)
        .to(a.tete.rotation, { z: .25, duration: .09, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 1.9)
        .set(a.tete.rotation, { z: 0 }, 2.45)
        .add(cacherEtoiles(gsap, a), 2.5)
        .call(() => a.regard('normal'), null, 2.6);
      fin = 2.8;
    } else {
      tl.to(corps, { a: 0, y: appui + CENTRE, duration: .18, ease: 'power2.out', onUpdate: appliquer }, 0)
        .call(debout, null, .18)
        .fromTo(a.corps.scale, { y: .75, x: 1.18, z: 1.18 }, { y: 1, x: 1, z: 1, duration: .45, ease: 'elastic.out(1, .4)', immediateRender: false }, 0);
      if (etourdi) {
        tl.call(() => a.regard('etourdi'), null, 0)
          .to(a.tete.rotation, { z: .28, duration: .1, yoyo: true, repeat: 7, ease: 'sine.inOut' }, .3)
          .set(a.tete.rotation, { z: 0 }, 1.1)
          .add(cacherEtoiles(gsap, a), 1.3)
          .call(() => a.regard('normal'), null, 1.4);
        fin = 1.6;
      } else {
        tl.call(() => { a.regard('content'); coeursSur(a, 2); dire(phrase('atterrit', a), ancreAnimal(a), 1.6, h); }, null, .1);
        fin = .8;
      }
    }
    tl.add(revenir(h, [c.x, c.z], appui), fin);
    h.retour = tl;
    tl.eventCallback('onComplete', () => { if (h.retour === tl) h.retour = null; });
  }
  // il rentre à sa place (la pose de l'arrêt en cours) en contournant les meubles, reprend ce qu'il faisait ;
  // monté sur un meuble, il saute d'abord à côté
  function revenir(h, depuis, sol) {
    const a = h.a, p = poseDe(h, courant < 0 ? 0 : courant, visiteCourante, variante), tl = gsap.timeline();
    const nom = apparts[h.i].dispo, b = grilleDe(h.i, nom);
    let de = depuis;
    if (sol > .02) {
      const [fx, fz] = b ? pointLibre(b, de[0], de[1]) : de;
      tl.add(bond(gsap, a, fx, fz, { y: 0, hauteur: .25, duree: .42, roulis: 0 })).call(() => { a.objet.userData.sol = 0; });
      de = [fx, fz];
    }
    const assise = (p.y || 0) > 0, chemin = assise && p.via ? p.via : [[p.x, p.z]];
    tl.add(marcher(gsap, a, trajet(h.i, de, chemin, nom), { depuis: de }));
    if (assise) tl.add(bond(gsap, a, p.x, p.z, { y: p.y, hauteur: .3, duree: .45, roulis: 0 })).call(() => { a.objet.userData.sol = p.y; });
    tl.to(a.objet.rotation, { y: () => proche(a.objet.rotation.y, p.r), duration: .35 })
      .to(a.etat, { ...drapeaux(p), salut: courant === 3 && visiteCourante >= 4 ? 1 : 0, duration: .4 })
      .call(() => {
        if (a.regardCourant !== 'normal' && a.regardCourant !== 'content') a.regard('normal');
        if (courant === 3 && visiteCourante >= 4) a.regard('content');
        h.retour = null;
        if (courant <= 1 && p.routine) lancerRoutine(h);
      });
    return tl;
  }

  // à chaque image : l'animal tenu suit, celui qu'on a lancé vole ; les yeux suivent la souris
  const curseurToile = { x: 0, y: 0, dedans: false };
  function jouer(dt) {
    tremble *= Math.exp(-dt * 7);
    for (const h of tous) {
      if (h.tenu && dt > 0) tenir(h, dt);
      else if (h.vol && dt > 0) voler(h, dt);
    }
    if (reduit || !fin) return;
    if (!curseurToile.dedans) { tous.forEach(h => h.a.viser(0, 0)); return; }
    const b = toile.getBoundingClientRect();
    for (const h of tous) {
      const a = h.a;
      if (h.tenu || h.vol || a.etat.dort > .5 || !aLEcran(h, b, _e)) { a.viser(0, 0); continue; }
      const dx = curseurToile.x - _e.x, dy = curseurToile.y - _e.y, d = Math.hypot(dx, dy);
      if (d > 360) a.viser(0, 0);
      else a.viser(dx / 240, dy / 240);
    }
  }

  // pointeur sur la toile : appui (sur un animal), déplacement, relâche
  let prise = null;
  function annulerPrise() {
    if (!prise) return;
    clearTimeout(prise.minuterie);
    try { toile.releasePointerCapture(prise.id); } catch (_) { /* déjà relâché */ }
    prise = null;
  }
  function commencer() {
    if (!prise || prise.actif) return;
    prise.actif = true;
    saisir(prise.h, prise.cx, prise.cy);
  }
  const surAppui = e => {
    if (reduit || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const h = viser(e);
    if (!h || prise) return;
    if (e.pointerType === 'mouse') e.preventDefault();   // pas de sélection de texte en glissant
    prise = { h, id: e.pointerId, x0: e.clientX, y0: e.clientY, cx: e.clientX, cy: e.clientY, actif: false, type: e.pointerType, minuterie: 0 };
    try { toile.setPointerCapture(e.pointerId); } catch (_) { /* pointeur déjà parti */ }
    // au doigt : un appui long attrape ; un glissé reste au défilement guidé
    if (e.pointerType !== 'mouse') prise.minuterie = setTimeout(commencer, 230);
  };
  const surDeplacement = e => {
    const b = toile.getBoundingClientRect();
    if (e.pointerType === 'mouse') { curseurToile.x = e.clientX - b.left; curseurToile.y = e.clientY - b.top; curseurToile.dedans = true; }
    if (prise && e.pointerId === prise.id) {
      prise.cx = e.clientX; prise.cy = e.clientY;
      const d = Math.hypot(e.clientX - prise.x0, e.clientY - prise.y0);
      if (!prise.actif) {
        if (prise.type === 'mouse' && d > 6) commencer();
        else if (prise.type !== 'mouse' && d > 12) annulerPrise();
      }
      if (prise?.actif && prise.h.tenu) { prise.h.tenu.cx = e.clientX; prise.h.tenu.cy = e.clientY; }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const h = viser(e);
    survoler(h);
    // caresse : du chemin parcouru sur le même animal, vite
    if (h && !reduit) {
      if (t - frotte.debut > 1.4) { frotte.chemin = 0; frotte.debut = t; }
      frotte.chemin += Math.hypot(e.clientX - frotte.x, e.clientY - frotte.y);
      if (frotte.chemin > 420) { frotte.chemin = 0; frotte.debut = t; caresser(h); }
    }
    frotte.x = e.clientX; frotte.y = e.clientY;
  };
  const surRelache = e => {
    if (!prise || e.pointerId !== prise.id) return;
    const p = prise, bouge = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
    annulerPrise();
    if (p.actif) { if (p.h.tenu) lacherAnimal(p.h); }
    else if (bouge < 12 && e.type === 'pointerup') reagir(p.h);   // un clic, un doigt posé
  };
  const surQuitte = e => { if (e.pointerType === 'mouse') curseurToile.dedans = false; if (!prise) survoler(null); };
  // mouvement réduit : le clic seul
  const surClic = e => { if (!reduit) return; const h = viser(e); if (h) reagir(h); };
  toile.addEventListener('pointerdown', surAppui);
  toile.addEventListener('pointermove', surDeplacement, { passive: true });
  toile.addEventListener('pointerup', surRelache);
  toile.addEventListener('pointercancel', surRelache);
  toile.addEventListener('pointerleave', surQuitte);
  toile.addEventListener('click', surClic);
  // on attrape au doigt sans faire défiler la page (le défilement guidé gère déjà les glissés)
  const toucher = () => { toile.style.touchAction = reduit ? '' : 'none'; };
  toucher();

  // ---------- taille, visibilité, pointeur, préférence, perte du contexte
  function mesurer() {
    largeur = Math.max(1, boite.clientWidth);
    hauteur = Math.max(1, boite.clientHeight);
    renderer.setSize(largeur, hauteur, false);
    marquer();
  }
  const ro = new ResizeObserver(mesurer);
  ro.observe(boite);
  // définition de l'écran plafonnée, puis baissée si les images arrivent trop lentement
  const definition = definitionAdaptative(renderer, Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5), mesurer);
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
    toucher();
    if (reduit) { annulerPrise(); vx = vy = px = py = 0; tremble = 0; toutDeSuite(voulu, voulueVisite); }
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
    annulerPrise();
    toile.removeEventListener('pointerdown', surAppui);
    toile.removeEventListener('pointermove', surDeplacement);
    toile.removeEventListener('pointerup', surRelache);
    toile.removeEventListener('pointercancel', surRelache);
    toile.removeEventListener('pointerleave', surQuitte);
    toile.removeEventListener('click', surClic);
    delete toile.dataset.curseur;
    delete toile.dataset.curseurCache;
    toile.style.cursor = '';
    toile.style.touchAction = '';
    window.__rrSaisie = false;
    if (introTl) introTl.kill();
    introTl = null;
    if (histoire) histoire.kill();
    histoire = null;
    arreterRoutines();
    calmer();
    gsap.killTweensOf([cam, etat, ...act]);
    tous.forEach(h => { h.retour?.kill(); tuerAnimal(h.a); gsap.killTweensOf(h.a.saut.scale); h.a.liberer(); });
    apparts.forEach(ap => ap.ordre.forEach(id => { const o = ap.meubles[id].objet; gsap.killTweensOf([o.position, o.rotation, o.scale]); }));
    coeurs.cacher(gsap);
    im.liberer();
    coeurs.liberer();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    Object.values(ma).forEach(x => x.dispose());
    mm.forEach(m => Object.values(m).forEach(x => x.dispose()));
    Object.values(plaid.m).forEach(x => x.dispose());
    plaid.tex.dispose();
    matRideaux.rideau.dispose();
    the.matVapeur.dispose();
    ombres.liberer();
    tOmbre.dispose();
    renderer.dispose();
    if (!toile.isConnected) { try { renderer.forceContextLoss(); } catch (_) { /* déjà perdu */ } }
  }

  return { intro, chapitre: choisir, encore, detruire };
}
