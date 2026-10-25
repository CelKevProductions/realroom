// Moteur de la scène d'accueil, chargé à la demande par PieceAccueil (three.js n'est pas dans le
// paquet initial). Une tour en maquette, un appartement par étage, qu'on remonte en faisant défiler la
// page : chaque étage est une étape de RealRoom (chapitres de la page, défilement guidé) :
//   0 (héros) : en bas de la tour, devant le hall ; les stores des étages sont baissés ;
//   1 (Relever), 1er étage : le store remonte sur une pièce brute et vide, que deux lapins relèvent au
//     téléphone (l'un tourne sur lui-même, l'autre fait le tour des murs) pendant que le plan se trace ;
//   2 (Aménager), 2e étage : les meubles de la première proposition arrivent chez les chiens ;
//   3 (Shuffle), 3e étage : chez les chats, Shuffle change les meubles de place sous leurs pattes (le
//     fauteuil boude) ; on reclique sur « Shuffle » : une autre idée ;
//   4 (Rendu photo IA), 4e étage : une lame de lumière traverse le salon des tortues et la maquette devient
//     une photo (rendu.js) ; second arrêt : on recule pour voir toute la tour, tout le monde salue.
// En avançant d'un arrêt au suivant, l'histoire se joue ; en remontant ou en sautant, la scène rejoint
// l'état voulu. On peut jouer avec les habitants : un clic (ou un doigt posé) et ils répondent ; on les
// attrape (glisser à la souris, appui long au doigt) : il pend à la main et se balance ; on le secoue
// (les meubles sautent, les voisins sursautent, l'animal finit étourdi), on le lance (il rebondit sur les
// meubles, roule, bascule, puis rentre à sa place : physique.js) ; on les caresse en frottant la souris
// dessus. Ils contournent les meubles en marchant (chemins.js). Rendu seulement à l'écran et onglet actif ;
// mouvement réduit : l'état de chaque chapitre, immobile, et seulement le clic.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initialiser, COURBES } from '@/components/mouvement/regles.js';
import { matieresMeubles, atelierOmbres, construireMeuble, preparer, fusion, bloc, cyl, assembler, MEUBLES } from './maquette.js';
import { construireImmeuble, ETAGES, SOLS, AH, TOIT } from './immeuble.js';
import {
  matieresAnimaux, creerAnimal, nuageOrage, reserveCoeurs,
  bond, marcher, surprise, cacherEtoiles, seCacher, coucou, proche
} from './animaux.js';
import { grille, chemin, pointLibre } from './chemins.js';
import { avancer, boitesDe, corpsDebout, pieds as piedsDu, CENTRE, PRISE } from './physique.js';
import { definitionAdaptative } from './definition.js';
import { creerRendu } from './rendu.js';

const RAD = Math.PI / 180, R = Math.PI / 2;
const REDUIT = '(prefers-reduced-motion: reduce)';
const T_FIXE = 1.234;   // mouvement réduit : la vie est figée à cet instant
const borne = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ECRASE = { x: 1.03, y: .93, z: 1.03 };   // amorti à la pose d'un meuble

// caméra : point visé (cx, cy, cz), direction depuis ce point (az : de +z vers +x, el : au-dessus de
// l'horizon, en degrés), demi-cadre à faire tenir (rx × ry, m), champ vertical (fov)
const CAM = {
  // au pied de la tour, un peu en contre-plongée : le hall, et les étages qui montent
  bas: { az: 26, el: -2, rx: 5.2, ry: 5.3, cx: 0, cy: 4.5, cz: .4, fov: 32 },
  // toute la tour, pour finir
  tour: { az: 22, el: 7, rx: 5.4, ry: 8.1, cx: 0, cy: 6.9, cz: .3, fov: 30 }
};
const ETAGE = SOLS.map((y, f) => ({ az: [6, -5, 7, -4][f], el: 9, rx: 2.75, ry: 1.75, cx: 0, cy: y + 1.08, cz: .7, fov: 30 }));
// chapitre n (0 héros, 1 à 4 un étage chacun ; au 4, le second arrêt k = 1 : toute la tour)
const cadrage = (n, k) => (n === 0 ? CAM.bas : n === 4 && k >= 1 ? CAM.tour : ETAGE[n - 1]);
// la pièce (repère d'un appartement) : un animal tenu ou lancé y reste
const MURS = { x: 1.85, zMin: -1.45, zMax: 1.3, plafond: 1.1 };

// meubles de chaque étage (repère de l'appartement, m) : [x, z, orientation] de la première proposition
// (A) et de celle de Shuffle (B). Le 1er étage reste brut et vide (on le relève). Quand on reclique sur
// « Shuffle », une autre idée (C) : B en miroir (coord)
const PIECES = [
  {},
  { // 2e, chiens : la première proposition, le canapé contre le mur de gauche face à la console
    tapis: { A: [.1, -.1, 0], B: [-.5, .05, 0] },
    canape: { A: [-1.7, 0, R], B: [.55, -1.3, 0] },
    meubleTV: { A: [1.95, -.1, -R], B: [-1.6, -.1, R - .4] },
    pouf: { A: [-.85, -1.4, 0], B: [-.8, -.65, 0] },
    pouf2: { id: 'pouf', A: [-.85, 1.35, 0], B: [-.2, .1, 0] },
    plante: { A: [-1.85, -1.45, 0], B: [1.9, -1.45, 0] },
    lampadaire: { A: [-1.85, 1.4, 0], B: [-1.9, -1.45, 0] }
  },
  { // 3e, chats : A, un coin lecture (fauteuil, lampe, guéridon) ; B, le guéridon et son échiquier entre le fauteuil et le pouf
    tapisRond: { A: [.9, -.4, 0], B: [0, .25, 0] },
    gueridon: { A: [.55, -.95, 0], B: [0, .2, 0] },
    fauteuil: { A: [1.45, -1, -.6], B: [-.85, .2, R - .35] },
    pouf: { A: [-1, .5, 0], B: [.78, .2, 0] },
    etagere: { A: [-1.05, -1.58, 0], B: [1.35, -1.58, 0] },
    plante: { A: [-1.9, -1.45, 0], B: [1.9, 1.2, 0] },
    lampadaire: { A: [1.95, -1.5, 0], B: [-1.9, 1.2, 0] }
  },
  { // 4e, tortues : le canapé face à nous, la table basse et le thé (B, la pièce terminée)
    tapis: { A: [-.2, -.45, 0], B: [-.2, -.45, 0] },
    canape: { A: [-.2, -1.3, 0], B: [-.2, -1.3, 0] },
    table: { A: [-.2, -.25, 0], B: [-.2, -.25, 0] },
    etagere: { A: [1.98, -.65, -R], B: [1.98, -.65, -R] },
    lampadaire: { A: [-1.75, -1.42, 0], B: [-1.75, -1.42, 0] },
    plante: { A: [1.85, 1.25, 0], B: [1.85, 1.25, 0] }
  }
];
// habitants (deux par étage), aux couleurs douces
const HABITANTS = [
  [{ espece: 'lapin', pelage: '#EDE6DD', clair: '#FBF8F3', graine: 6 }, { espece: 'lapin', pelage: '#C9B7A4', clair: '#F3ECE3', graine: 7 }],
  [{ espece: 'chien', pelage: '#E6BE93', clair: '#FBF1E4', sombre: '#A9825F', graine: 0 },
    { espece: 'chien', pelage: '#F4EEE6', clair: '#FFFFFF', sombre: '#9B8273', graine: 1 }],
  [{ espece: 'chat', pelage: '#D9A27C', clair: '#F7EDE2', graine: 2 }, { espece: 'chat', pelage: '#A8A39E', clair: '#EFEBE7', graine: 3 }],
  [{ espece: 'tortue', pelage: '#A9BC9F', clair: '#EFE7D4', carapace: '#7E9682', accessoire: 'lunettes', graine: 4 },
    { espece: 'tortue', pelage: '#B4C2A8', clair: '#EFE7D4', carapace: '#B39274', graine: 5 }]
];
// où ils sont et ce qu'ils font. 1er : le relevé (routines) ; 2e : la pièce vide, puis debout parmi les
// meubles ; 3e : debout dans la première proposition, puis dans celle de Shuffle ; 4e : assises sur le
// canapé, elles lisent. via : le chemin jusqu'au siège ; etapes : les murs que l'on relève ([x, z, r]).
const Q = Math.PI / 2;
const VIE = [{ x: -.6, z: .4, r: .5, scanne: 1, routine: 'tour' }, { x: .3, z: .8, r: 1, scanne: 1, routine: 'releve', etapes: [[.8, .2, Q], [-.1, -.35, 2 * Q]] }];
const ATTENTE = [{ x: -.5, z: .5, r: .5 }, { x: .5, z: .7, r: -.4 }];
const DEBOUT_A = [null, [{ x: .35, z: .45, r: -.5 }, { x: -.45, z: -.35, r: .6 }], [{ x: .3, z: .95, r: .3 }, { x: -.4, z: 1, r: -.2 }], null];
const DEBOUT_B = [{ x: -.35, z: .95, r: .4 }, { x: .45, z: .95, r: -.3 }];
const ASSISES = [{ x: .225, z: -1.18, y: .5, r: 0, lit: 1, assis: 1, via: [[.6, -.65]] }, { x: -.625, z: -1.18, y: .5, r: 0, lit: 1, assis: 1, via: [[-.95, -.65]] }];
const BASE = { souffle: 1, salut: 0, arrose: 0, lit: 0, joue: 0, dort: 0, mange: 0, grignote: 0, pense: 0, pousse: 0, acclame: 0, assis: 0, cache: 0, remue: 0, teteX: 0, teteY: 0, scanne: 0 };
const DRAPEAUX = ['arrose', 'lit', 'joue', 'dort', 'mange', 'grignote', 'assis', 'scanne'];
const drapeaux = p => Object.fromEntries(DRAPEAUX.map(k => [k, p[k] || 0]));
// C, l'autre idée de Shuffle : B en miroir (les meubles comme les poses)
const coord = (i, id, nom) => { const d = PIECES[i][id]; if (nom !== 'C') return d[nom]; const [x, z, r] = d.B; return [-x, z, -r]; };
const miroir = p => ({ ...p, x: -p.x, r: -p.r, via: p.via?.map(([x, z]) => [-x, z]) });
const deboutDe = (nom, i, j) => (nom === 'A' ? DEBOUT_A[i][j] : i !== 2 ? DEBOUT_A[i][j] : nom === 'C' ? miroir(DEBOUT_B[j]) : DEBOUT_B[j]);
// pose d'un habitant au chapitre n (v : la disposition de Shuffle en cours, B ou C)
const poseDe = (h, n, k, v) => (h.i === 0 ? VIE[h.j] : h.i === 1 ? (n >= 2 ? DEBOUT_A[1][h.j] : ATTENTE[h.j])
  : h.i === 2 ? deboutDe(n >= 3 ? v : 'A', 2, h.j) : ASSISES[h.j]);
// disposition des meubles d'un étage au chapitre n : aucune (pièce vide), la première proposition, Shuffle
const dispoDe = (i, n, v) => (i === 0 ? null : i === 1 ? (n >= 2 ? 'A' : null) : i === 2 ? (n >= 3 ? v : 'A') : 'B');
const fin = (n, k) => n === 4 && k >= 1;
// état de la scène attendu à chaque chapitre : stores remontés jusqu'à l'étage atteint, relevé tracé,
// rendu photo fait
const cible = (n, k) => ({ s0: n >= 1 ? 1 : 0, s1: n >= 2 ? 1 : 0, s2: n >= 3 ? 1 : 0, s3: n >= 4 ? 1 : 0, trace: n >= 1 ? 2 : 0, rendu: n >= 4 ? 1 : 0, rotW: n === 0 || fin(n, k) ? 1 : 0 });
const STORE = ['s0', 's1', 's2', 's3'];

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

export function creerPiece({ toile, boite, bulle, textes = {}, chapitre = 0, visite = 0, surPrete, surPanne }) {
  const gsap = initialiser();
  const mq = matchMedia(REDUIT);
  let reduit = mq.matches;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, powerPreference: 'default' });
  let im, ma, ombres, mm, environnement, pmrem;
  try {
    renderer.setClearColor(0x000000, 0);
    // rendu « maquette d'architecte » : tons neutres conservés, lumière d'atelier, coupes du rendu photo
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    pmrem = new THREE.PMREMGenerator(renderer);
    environnement = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    im = construireImmeuble();
    ma = matieresAnimaux();
    ombres = atelierOmbres();
    mm = ETAGES.map(def => matieresMeubles(def.meubles));
  } catch (e) {
    pmrem?.dispose();
    renderer.dispose();
    throw e;
  }

  const scene = new THREE.Scene();
  scene.environment = environnement;
  scene.environmentIntensity = .42;
  // la caméra n'approche jamais à moins de 6 m : un plan proche loin de l'œil garde la profondeur précise
  // (sinon les surfaces très proches, comme un tapis sur le sol, scintillent)
  const camera = new THREE.PerspectiveCamera(30, 1, 1.5, 120);
  // lumière d'atelier : ciel clair, rebond chaud, une grande source douce d'avant droit
  scene.add(new THREE.HemisphereLight('#FFF9F2', '#D8CABD', 1.25));
  const soleil = new THREE.DirectionalLight('#FFF4E8', 1.55);
  soleil.position.set(4, 7, 6);
  scene.add(soleil, im.groupe);

  // ---------- les appartements : leurs meubles (une palette par étage) et leurs accessoires
  const apparts = ETAGES.map((def, i) => {
    const groupe = im.appartements[i].groupe, meubles = {};
    for (const [nom, d] of Object.entries(PIECES[i])) {
      const mb = construireMeuble(d.id || nom, mm[i], ombres);
      groupe.add(mb.objet);
      meubles[nom] = mb;
    }
    return { i, groupe, meubles, ordre: Object.keys(meubles), dispo: null };
  });
  const echecs = echiquier(mm[2]);
  apparts[2].meubles.gueridon.objet.add(echecs.groupe);
  const the = tasses(mm[3]);
  apparts[3].meubles.table.objet.add(the.groupe);
  // humeur des meubles : le fauteuil des chats boude (nuage d'orage) quand Shuffle le déplace
  const orage = nuageOrage(ma);
  orage.position.y = 1.1;
  apparts[2].meubles.fauteuil.objet.add(orage);
  // le dernier étage est meublé dès le départ (sa disposition ne change pas) : on y prépare le rendu photo
  placerDirect(apparts[3], 'B');
  const rendu = creerRendu({ ap: apparts[3], mm: mm[3], scene, environnement });

  // ---------- les habitants
  const tOmbre = texOmbreRonde();
  const habitants = HABITANTS.map((liste, i) => liste.map((look, j) => {
    const a = creerAnimal(ma, look);
    // son ombre est posée dans l'appartement (elle ne tourne pas quand il roule)
    const o = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tOmbre, transparent: true, opacity: .3, depthWrite: false }));
    o.renderOrder = 1;
    a.ombre = o;
    apparts[i].groupe.add(a.objet, o);
    // au dernier étage, elles posent pour la photo : elles portent une vraie ombre
    if (i === 3) a.objet.traverse(x => { if (x.isMesh) x.castShadow = true; });
    // tenu, vol, retour : on joue avec lui (attrapé, lancé, il rentre à sa place) ; phys : son corps
    // (physique.js) tant qu'on joue avec lui ; parleFin : sa bouche bouge
    return { a, i, j, emu: false, occupe: 0, n: j, tenu: null, vol: null, retour: null, phys: null, parleFin: 0, sursaut: 0, caresse: 0 };
  }));
  const tous = habitants.flat();
  const coeurs = reserveCoeurs(18);
  scene.add(coeurs.groupe);
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const coeursSur = (a, n = 2) => { a.tete.getWorldPosition(_v); coeurs.jaillir(gsap, _v.x, _v.y + .4, _v.z, n); };

  // l'éclair de l'appareil photo, à la fin du rendu
  const eclair = document.createElement('div');
  eclair.setAttribute('aria-hidden', 'true');
  Object.assign(eclair.style, { position: 'absolute', inset: 0, background: '#FFFDF8', opacity: 0, pointerEvents: 'none' });
  boite.appendChild(eclair);

  // état animé (GSAP)
  const etat = { s0: 0, s1: 0, s2: 0, s3: 0, trace: 0, rendu: 0, rotW: 1 };
  const cam = { ...CAM.bas };
  const tps = { rot: 0 };
  let courant = -1, visiteCourante = 0, voulu = chapitre, voulueVisite = visite, variante = 'B';
  let introFaite = false, introTl = null, histoire = null, histoireNom = '', routines = [];
  let raf = 0, avant = 0, t = 0, detruit = false, premiere = false, visible = true;
  let largeur = 1, hauteur = 1, px = 0, py = 0, vx = 0, vy = 0, tremble = 0, fete = 0;
  const enJeu = h => !!(h.tenu || h.vol || h.retour);

  function placerDirect(ap, nom) {
    ap.dispo = nom;
    ap.ordre.forEach(id => {
      const o = ap.meubles[id].objet, [x, z, r] = coord(ap.i, id, nom);
      o.visible = true; o.position.set(x, 0, z); o.rotation.set(0, r, 0); o.scale.set(1, 1, 1);
    });
  }

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
    const f = apparts[2].meubles.fauteuil.objet;
    gsap.timeline()
      .set(orage, { visible: true }, 0)
      .to(orage.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(3)' }, 0)
      .to(orage.position, { y: 1.18, duration: .25, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0)
      .to(f.rotation, { z: .07, duration: .06, yoyo: true, repeat: 9, ease: 'sine.inOut' }, .1)
      .set(f.rotation, { z: 0 }, .7)
      .to(orage.scale, { x: .001, y: .001, z: .001, duration: .3, ease: 'power2.in' }, 2.1)
      .set(orage, { visible: false }, 2.4);
  }
  function calmer() {
    const f = apparts[2].meubles.fauteuil.objet;
    gsap.killTweensOf([orage, orage.scale, orage.position, f.rotation]);
    orage.visible = false;
    orage.scale.setScalar(.001); orage.position.y = 1.1;
    f.rotation.z = 0;
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
    const salue = fin(n, k);
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
  // le relevé du 1er étage, en boucle : l'un tourne sur lui-même un quart de tour à la fois, l'autre
  // va d'un mur à l'autre, s'y tourne et le balaie de son faisceau
  function arreterRoutines() { routines.forEach(r => r.tl.kill()); routines = []; }
  function arreterRoutine(h) { routines = routines.filter(r => (r.h === h ? (r.tl.kill(), false) : true)); }
  function lancerRoutines() {
    arreterRoutines();
    if (reduit) return;
    habitants[0].forEach(lancerRoutine);
  }
  function lancerRoutine(h) {
    arreterRoutine(h);
    if (reduit || enJeu(h) || h.i !== 0) return;
    const p = VIE[h.j], a = h.a;
    let tl = null;
    if (p.routine === 'tour') {
      tl = gsap.timeline({ repeat: -1, delay: .6 });
      for (let q = 0; q < 4; q++) tl.to(a.objet.rotation, { y: `+=${Q}`, duration: 1.6, ease: 'sine.inOut' }).to({}, { duration: .9 });
    } else if (p.routine === 'releve') {
      tl = gsap.timeline({ repeat: -1, delay: .3 });
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

  // ---------- bulle (HTML, au-dessus de qui parle)
  let bulleBase = null, bulleTemp = null, bulleVue = null, bulleTexte = '', bulleLarge = 160, minuterieBulle = 0;
  const haut = (v, y) => v.set(v.x, v.y + y, v.z);
  const ancreAppart = i => v => {
    habitants[i][0].a.tete.getWorldPosition(_a);
    habitants[i][1].a.tete.getWorldPosition(_b);
    return haut(v.copy(_a).add(_b).multiplyScalar(.5), .62);
  };
  const ancreAnimal = a => v => haut(a.tete.getWorldPosition(v), .62);
  const ancreFin = v => v.set(0, TOIT + .9, .6);
  const ancreEtage = f => v => v.set(0, SOLS[f] + AH - .15, 1.4);
  // la phrase posée de chaque arrêt : celle de l'étage atteint (relevé, meubles, rendu), merci à la fin
  function definirBase(n, k) {
    const texte = n >= 1 && n <= 4 ? (fin(n, k) ? textes.merci : n === 3 ? '' : textes.etapes?.[n - 1]) : '';
    bulleBase = texte ? { texte, ancre: fin(n, k) ? ancreFin : ancreAppart(n - 1) } : null;
    if (texte) (fin(n, k) ? tous : [habitants[n - 1][0]]).forEach(h => { h.parleFin = t + 1.3; });
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
    apparts.forEach(ap => placerMeubles(ap, dispoDe(ap.i, n, variante), true));
    tous.forEach(h => { poserAnimal(h, n, k); h.a.saut.scale.set(1, 1, 1); });
    gsap.killTweensOf([etat, eclair.style]);
    eclair.style.opacity = 0;
    Object.assign(etat, cible(n, k));
  }
  function poser(n, k) {
    figer(n, k);
    gsap.killTweensOf(cam);
    Object.assign(cam, cadrage(n, k));
    if (n === 0 || fin(n, k)) tps.rot = t;
    lancerRoutines();
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
  // on monte d'un étage : la caméra suit la façade, le store de l'étage remonte
  function monter(tl, n, k, debut = 0) {
    tl.call(() => definirBase(-1), null, debut)
      .to(cam, { ...cadrage(n, k), duration: 2, ease: COURBES.pivot }, debut)
      .to(etat, { rotW: 0, duration: .8, ease: 'power1.inOut' }, debut);
    if (n >= 1 && n <= 4) tl.to(etat, { [STORE[n - 1]]: 1, duration: 1.2, ease: 'power2.inOut' }, debut + .55);
    return tl;
  }

  // 0 → 1, 1er étage : le store remonte sur une pièce vide ; deux lapins la relèvent au téléphone et le
  // plan se trace au sol
  function releve(propre) {
    if (!propre) figer(0, 0);
    gsap.killTweensOf([cam, etat]);
    if (!routines.length) lancerRoutines();
    const tl = monter(gsap.timeline(), 1, 0);
    tl.fromTo(etat, { trace: 0 }, { trace: 2, duration: 4, ease: 'none', immediateRender: false }, 1.5);
    habitants[0].forEach((h, j) => tl.add(surprise(gsap, h.a, { haut: .14 }), 1.5 + j * .15));
    tl.call(() => definirBase(1, 0), null, 2.2);
    return tl;
  }

  // 1 → 2, 2e étage : les meubles de la première proposition arrivent dans la pièce vide ; les chiens
  // s'écartent, puis viennent voir, contents
  function livrer(propre) {
    gsap.killTweensOf([cam, etat]);
    calmer();
    if (!propre) figer(1, 0);
    else {
      if (apparts[1].dispo) retirerMeubles(apparts[1], true);
      habitants[1].forEach(h => stabiliser(h, ATTENTE[h.j]));
    }
    const tl = monter(gsap.timeline(), 2, 0), x = 1.5;
    tl.to(etat, { s0: 1, trace: 2, duration: .4 }, 0)
      .call(() => livrerMeubles(apparts[1], 'A', false), null, x);
    habitants[1].forEach((h, j) => {
      const a = h.a, d = x + .3 + j * .12, q = DEBOUT_A[1][j];
      tl.add(surprise(gsap, a, { haut: .18 }), d);
      const f = allerVers(tl, h, [[q.x, q.z]], d + .9, q.r, 'A');
      tl.call(() => { a.regard('content'); coeursSur(a, 2); }, null, f)
        .to(a.etat, { acclame: 1, duration: .25, yoyo: true, repeat: 1 }, f);
    });
    tl.call(() => definirBase(2, 0), null, x + 2.6);
    return tl;
  }

  // 2 → 3, 3e étage : Shuffle ! chez les chats, les meubles passent de la disposition de à vers (B, ou C
  // quand on reclique) sous leurs pattes : ils bondissent, le fauteuil boude, puis tout le monde est content
  function melanger(propre, de, vers, ici = false) {
    gsap.killTweensOf([cam, etat]);
    calmer();
    if (!propre) figer(ici ? 3 : 2, 0);
    else habitants[2].forEach(h => stabiliser(h, deboutDe(de, 2, h.j)));
    if (!ici) placerMeubles(apparts[2], de, true);
    const [c1, c2] = habitants[2];
    const D = habitants[2].map(h => deboutDe(vers, 2, h.j));
    const tl = ici ? gsap.timeline() : monter(gsap.timeline(), 3, 0);
    const x = ici ? .3 : 1.6;
    tl.to(etat, { s0: 1, s1: 1, trace: 2, duration: .4 }, 0)
      .call(() => dire(textes.shuffle, ancreEtage(2), 1.8), null, x - .25)
      .call(() => disposer(apparts[2], vers, false), null, x);
    if (ici) tl.to(cam, { ...ETAGE[2], rx: ETAGE[2].rx * .96, ry: ETAGE[2].ry * .96, duration: .35, ease: 'power2.out' }, 0)
      .to(cam, { ...ETAGE[2], duration: .7, ease: 'power2.inOut' }, .4);
    tl.add(surprise(gsap, c1.a, { haut: .3 }), x)
      .add(surprise(gsap, c2.a, { haut: .36 }), x + .25)
      .call(bouder, null, x + 1);
    allerVers(tl, c1, [[D[0].x, D[0].z]], x + 1.5, D[0].r, vers);
    allerVers(tl, c2, [[D[1].x, D[1].z]], x + 1.7, D[1].r, vers);
    tl.call(() => habitants[2].forEach(h => { h.a.regard('content'); coeursSur(h.a, 2); }), null, x + 3.2)
      .to(habitants[2].map(h => h.a.etat), { acclame: 1, duration: .25, yoyo: true, repeat: 1 }, x + 3.2);
    return tl;
  }

  // 3 → 4, 4e étage : le rendu photo. Les tortues lisent ; une lame de lumière traverse la pièce et la
  // maquette devient photo (rendu.js), puis l'éclair de l'appareil
  function photographier(propre) {
    if (!propre) figer(3, 0);
    gsap.killTweensOf([cam, etat, eclair.style]);
    const tl = monter(gsap.timeline(), 4, 0);
    tl.to(etat, { s0: 1, s1: 1, s2: 1, trace: 2, duration: .4 }, 0)
      .fromTo(etat, { rendu: 0 }, { rendu: 1, duration: 2.8, ease: 'power1.inOut', immediateRender: false }, 2)
      .fromTo(eclair.style, { opacity: 0 }, { opacity: .8, duration: .08, ease: 'none', immediateRender: false }, 4.85)
      .to(eclair.style, { opacity: 0, duration: .7, ease: 'power2.out' }, 4.95)
      .call(() => habitants[3].forEach(h => { h.a.regard('content'); coeursSur(h.a, 2); }), null, 5)
      .call(() => definirBase(4, 0), null, 5.1);
    return tl;
  }

  // second arrêt du 4e étage : on recule pour voir toute la tour ; tout le monde salue et dit merci
  function conclure() {
    const tl = gsap.timeline();
    tl.call(() => definirBase(-1), null, 0)
      .to(cam, { ...CAM.tour, duration: 2.2, ease: COURBES.pivot }, 0)
      .to(etat, { ...cible(4, 1), duration: 1 }, 0)
      .call(() => { tps.rot = t; }, null, 1.6);
    tous.forEach((h, j) => {
      const d = 1.2 + j * .06;
      tl.to(h.a.etat, { salut: 1, duration: .3 }, d)
        .call(() => { h.emu = false; h.a.regard('content'); coeursSur(h.a, 2); }, null, d);
    });
    tl.call(() => definirBase(4, 1), null, 1.6);
    return tl;
  }
  // on revient du dernier arrêt vers le 4e étage
  function revenirEtage() {
    const tl = gsap.timeline();
    tl.call(() => definirBase(-1), null, 0)
      .to(cam, { ...ETAGE[3], duration: 1.6, ease: COURBES.pivot }, 0)
      .to(etat, { ...cible(4, 0), duration: .8 }, 0);
    tous.forEach(h => tl.to(h.a.etat, { salut: 0, duration: .3 }, .2).call(() => h.a.regard('normal'), null, .2));
    tl.call(() => definirBase(4, 0), null, 1.4);
    return tl;
  }

  // autre passage (on redescend, ou on saute un chapitre) : la scène rejoint l'état du chapitre ;
  // les animaux disparaissent d'un petit « pop » et réapparaissent à leur place
  function rejoindre(n, k) {
    arreterRoutines();
    calmer();
    definirBase(-1);
    gsap.killTweensOf([cam, etat, eclair.style]);
    eclair.style.opacity = 0;
    if (n === 0 || fin(n, k)) tps.rot = t;
    const tl = gsap.timeline();
    tl.to(cam, { ...cadrage(n, k), duration: 1.8, ease: COURBES.pivot }, 0)
      .to(etat, { ...cible(n, k), duration: 1.2, ease: 'power2.inOut' }, 0);
    apparts.forEach((ap, i) => {
      const dispo = dispoDe(i, n, variante);
      if (ap.dispo !== dispo) tl.call(() => placerMeubles(ap, dispo, false), null, .25 + i * .12);
    });
    tous.forEach((h, j) => {
      const d = .05 + j * .03;
      tl.to(h.a.saut.scale, { x: .001, y: .001, z: .001, duration: .22, ease: 'power2.in' }, d)
        .call(() => poserAnimal(h, n, k), null, d + .25)
        .to(h.a.saut.scale, { x: 1, y: 1, z: 1, duration: .5, ease: 'back.out(2)' }, 1.2 + j * .04);
    });
    tl.call(lancerRoutines, null, 1.9)
      .call(() => definirBase(n, k), null, 1.6);
    return tl;
  }

  function aller(n, k, instant) {
    const de = courant, kDe = visiteCourante, propre = !histoire || !histoire.isActive();
    survoler(null);   // la caméra bouge : l'animal sous la souris n'est plus le même
    finirJeux();      // l'histoire reprend la main sur les animaux avec qui on jouait
    courant = n; visiteCourante = k;
    if (histoire) { histoire.kill(); histoire = null; }
    if (instant) { poser(n, k); return; }
    if (de === 0 && n === 1) { histoire = releve(propre); histoireNom = 'releve'; }
    else if (de === 1 && n === 2) { histoire = livrer(propre); histoireNom = 'livrer'; }
    else if (de === 2 && n === 3) { histoire = melanger(propre, 'A', variante); histoireNom = 'melanger'; }
    else if (de === 3 && n === 4 && k === 0) { histoire = photographier(propre); histoireNom = 'photographier'; }
    else if (de === 4 && kDe === 0 && n === 4 && k >= 1) {
      if (!propre) figer(4, 0);
      histoire = conclure(); histoireNom = 'conclure';
    } else if (de === 4 && kDe >= 1 && n === 4 && k === 0) { histoire = revenirEtage(); histoireNom = 'revenir'; }
    else { histoire = rejoindre(n, k); histoireNom = 'rejoindre'; }
    histoire.eventCallback('onUpdate', marquer);
  }
  // on reclique sur « Shuffle » alors qu'on y est déjà : une autre idée (B ↔ C)
  function encore() {
    if (detruit || !introFaite || courant !== 3) return;
    const de = variante, propre = !histoire || !histoire.isActive();
    survoler(null);
    finirJeux();
    if (histoire) { histoire.kill(); histoire = null; }
    if (!propre) figer(3, 0);
    variante = de === 'B' ? 'C' : 'B';
    if (reduit) { poser(3, 0); return; }
    histoire = melanger(true, de, variante, true);
    histoireNom = 'melanger';
    histoire.eventCallback('onUpdate', marquer);
  }
  // état final sans animation (mouvement réduit)
  function toutDeSuite(n, k) {
    if (introTl) { introTl.kill(); introTl = null; }
    if (histoire) { histoire.kill(); histoire = null; }
    introFaite = true;
    [im.rdc, ...im.etages, im.sommet].forEach(o => o.position.set(0, 0, 0));
    im.socle.scale.set(1, 1, 1);
    courant = n; visiteCourante = k;
    poser(n, k);
  }

  // intro : le socle se pose, puis les étages se posent l'un sur l'autre, du hall au toit
  function intro() {
    if (introFaite || introTl || detruit) return;
    if (reduit) { toutDeSuite(voulu, voulueVisite); return; }
    tps.rot = t;
    const tl = gsap.timeline({ onUpdate: marquer, onComplete: finIntro });
    tl.fromTo(im.socle.scale, { x: .001, y: .001, z: .001 }, { x: 1, y: 1, z: 1, duration: .9, ease: 'expo.out' }, 0)
      .fromTo(cam, { az: 8, el: -9 }, { az: CAM.bas.az, el: CAM.bas.el, duration: 2.8, ease: 'power2.inOut' }, 0);
    [im.rdc, ...im.etages, im.sommet].forEach((o, i) => {
      tl.fromTo(o.position, { y: 6 }, { y: 0, duration: .7, ease: 'power3.out' }, .3 + i * .17);
    });
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
    if (n !== courant || (n === 4 && k !== visiteCourante)) aller(n, k, reduit);
  }

  // ---------- la vie des étages, à chaque image (tt : temps de la scène) : le thé des tortues fume ; à
  // la fin, des cœurs jaillissent ici et là
  function vivre(tt) {
    const a = borne(etat.s3 * 1.5);
    the.vapeurs.forEach((v, i) => {
      v.visible = a > .01;
      if (!v.visible) return;
      const p = (tt * .45 + (i % 3) / 3) % 1;
      v.position.set(v.userData.x + Math.sin(p * 7 + i) * .012, .44 + p * .26, .08);
      v.scale.setScalar(Math.max(.001, Math.sin(p * Math.PI) * a * (.7 + p * .6)));
    });
    if (fin(courant, visiteCourante) && !reduit && tt > fete) {
      fete = tt + 2.6;
      const h = tous[Math.floor(Math.random() * tous.length)];
      if (!enJeu(h)) coeursSur(h.a, 2);
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
    STORE.forEach((s, f) => im.ouvrir(f, etat[s]));
    im.tracer(etat.trace);
    rendu.appliquer(etat.rendu);
    rendu.ombres(etat.rendu > .001 && etat.s3 > .5);
    vivre(tt);
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
    const b = toile.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    const tv = Math.tan(camera.fov * RAD / 2);
    let choix = null, dmin = Infinity;
    for (const h of tous) {
      if (h.a.saut.scale.x < .5 || etat[STORE[h.i]] < .6) continue;   // on peut le rattraper en plein vol
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
      lancerRoutine(h);
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
      .to(a.etat, { ...drapeaux(p), salut: fin(courant, visiteCourante) ? 1 : 0, duration: .4 })
      .call(() => {
        if (a.regardCourant !== 'normal' && a.regardCourant !== 'content') a.regard('normal');
        if (fin(courant, visiteCourante)) a.regard('content');
        h.retour = null;
        if (p.routine) lancerRoutine(h);
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
    if (reduit || !fine) return;
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
  const fine = matchMedia('(pointer: fine)').matches;
  const surPointeur = e => {
    if (reduit) return;
    vx = borne((e.clientX / innerWidth) * 2 - 1, -1, 1);
    vy = borne((e.clientY / innerHeight) * 2 - 1, -1, 1);
  };
  const surSortie = () => { vx = vy = 0; };
  if (fine) {
    addEventListener('pointermove', surPointeur, { passive: true });
    document.documentElement.addEventListener('pointerleave', surSortie);
  }
  const surPreference = () => {
    reduit = mq.matches;
    toucher();
    if (reduit) { annulerPrise(); vx = vy = px = py = 0; tremble = 0; toutDeSuite(voulu, voulueVisite); }
    else { lancerRoutines(); relancer(); }
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
    [im.rdc, ...im.etages, im.sommet].forEach(o => { o.position.y = 40; });
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
    gsap.killTweensOf([cam, etat, eclair.style]);
    eclair.remove();
    tous.forEach(h => { h.retour?.kill(); tuerAnimal(h.a); gsap.killTweensOf(h.a.saut.scale); h.a.liberer(); });
    apparts.forEach(ap => ap.ordre.forEach(id => { const o = ap.meubles[id].objet; gsap.killTweensOf([o.position, o.rotation, o.scale]); }));
    coeurs.cacher(gsap);
    im.liberer();
    coeurs.liberer();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    Object.values(ma).forEach(x => x.dispose());
    mm.forEach(m => Object.values(m).forEach(x => x.dispose()));
    rendu.liberer();
    the.matVapeur.dispose();
    ombres.liberer();
    tOmbre.dispose();
    environnement.dispose();
    pmrem.dispose();
    renderer.dispose();
    if (!toile.isConnected) { try { renderer.forceContextLoss(); } catch (_) { /* déjà perdu */ } }
  }

  return { intro, chapitre: choisir, encore, detruire };
}

