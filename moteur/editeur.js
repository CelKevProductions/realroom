/* =================================================================
   RealRoom — éditeur 3D d'une pièce
   La pièce (murs, portes, fenêtres, sol, plafond) d'après le modèle issu
   des photos, ses meubles (relevés sur les photos ou choisis dans le
   catalogue), deux vues (maquette vue de dessus, vue de la photo),
   sélection, déplacement au doigt ou à la souris, capture pour le rendu.
   Mouvements de caméra : arrivée d'en haut à l'ouverture, glissé jusqu'au
   meuble choisi puis lent tour autour de lui, quart de tour qui dévoile un
   nouvel aménagement. Le moindre geste rend la main.
   Repère et conventions : lib/agencement.js.
   ================================================================= */
import {
  THREE, RoomEnvironment, M, std, bloc, cyl, sphere, groupe, cuire, graine,
  definirProduits, construireProduit, construireCatalogue, CAT_GENERIQUE, canvasTex, LUMINEUX
} from './meubles.js';
import './modeles/index.js';
import { contourDe, segmentsDe, aireSignee, contientPoint, contientBoite } from '../lib/contour.js';   // modèles fidèles d'après les photos des produits
import {vuePourAngle} from '../lib/cadrages.js';
import { produitDe, estMural, estSuspendu, estPlat, estAdosse, estPosable, porteurDe, demiEmpreinte, placerAuMur, normaliserAngle } from '../lib/agencement.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const EPAISSEUR = .12;
const ACCENT = '#B8411D';
// courbes des mouvements de caméra
const COURBES = {
  sortie: k => 1 - Math.pow(1 - k, 4),
  douce: k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
};

/* ---------------------------------------------------------------
   Textures de sol teintées (planches, carreaux, béton)
   --------------------------------------------------------------- */
function couleurVariee(base, k) {
  const c = new THREE.Color(base), hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, clamp(hsl.l + k, 0, 1));
  return '#' + c.getHexString();
}
const TEX_SOL = new Map();
function textureSol(matiere, couleur) {
  const cle = matiere + couleur;
  if (TEX_SOL.has(cle)) return TEX_SOL.get(cle);
  let t;
  if (matiere === 'parquet') {
    t = canvasTex(512, 512, (x, n) => {
      const r = graineLocale(hash(cle));
      for (let i = 0; i < 8; i++) {
        let y = 0;
        while (y < n) {
          const l = 90 + r() * 260;
          x.fillStyle = couleurVariee(couleur, (r() - .5) * .08);
          x.fillRect(i * n / 8, y, n / 8, l);
          x.fillStyle = 'rgba(0,0,0,.18)';
          x.fillRect(i * n / 8, y, n / 8, 1.5);
          y += l;
        }
        x.fillStyle = 'rgba(0,0,0,.22)';
        x.fillRect(i * n / 8, 0, 1.5, n);
      }
    });
  } else if (matiere === 'carrelage' || matiere === 'marbre') {
    t = canvasTex(512, 512, (x, n) => {
      const r = graineLocale(hash(cle));
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        x.fillStyle = couleurVariee(couleur, (r() - .5) * (matiere === 'marbre' ? .05 : .025));
        x.fillRect(i * n / 4, j * n / 4, n / 4, n / 4);
      }
      if (matiere === 'marbre') {
        x.strokeStyle = 'rgba(90,80,70,.12)'; x.lineWidth = 1.2;
        for (let k = 0; k < 14; k++) { x.beginPath(); let px = r() * n, py = r() * n; x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (r() - .3) * 90; py += (r() - .5) * 60; x.lineTo(px, py); } x.stroke(); }
      }
      x.fillStyle = 'rgba(0,0,0,.14)';
      for (let i = 0; i <= 4; i++) { x.fillRect(i * n / 4 - 1, 0, 2, n); x.fillRect(0, i * n / 4 - 1, n, 2); }
    });
  } else {
    t = canvasTex(256, 256, (x, n) => {
      const r = graineLocale(hash(cle));
      x.fillStyle = couleur; x.fillRect(0, 0, n, n);
      for (let k = 0; k < 900; k++) { x.fillStyle = 'rgba(' + (r() > .5 ? '255,255,255' : '0,0,0') + ',' + (r() * .035) + ')'; x.fillRect(r() * n, r() * n, 2 + r() * 3, 2 + r() * 3); }
    });
  }
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  TEX_SOL.set(cle, t);
  return t;
}
function graineLocale(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------------------------------------------------------------
   Meubles relevés sur les photos qui n'ont pas de maquette dans le
   catalogue : maquettes simples mais lisibles
   --------------------------------------------------------------- */
const mCouleur = (p, i = 0, rough = .85) => std((p.cols && p.cols[i]) || '#B8AFA2', rough);
const PLUS = {
  chaise(p) {
    const g = groupe('chaise'), [w, d, h] = p.dim, m = mCouleur(p), pied = p.mat === 'bois' ? M('chene') : M('noir');
    const as = Math.min(.47, h * .55);
    bloc(g, w, .05, d * .9, m, 0, as - .05, 0, .01);
    bloc(g, w, h - as, .05, m, 0, as, -d / 2 + .05, .01);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, .014, .014, as - .05, pied, a * (w / 2 - .04), 0, b * (d / 2 - .06), 8));
    return g;
  },
  tapis(p) {
    const g = groupe('tapis');
    const t = mesh3(new THREE.BoxGeometry(p.dim[0], .012, p.dim[1]), std((p.cols && p.cols[0]) || '#CFC3B0', 1));
    t.position.y = .006; t.castShadow = false; g.add(t);
    return g;
  },
  plante(p) {
    const g = groupe('plante'), [w, , h] = p.dim;
    cyl(g, w * .28, w * .22, Math.min(.45, h * .3), std('#C9BBA6', .9), 0, 0, 0, 20);
    const r = graineLocale(hash(p.nom || 'plante'));
    for (let i = 0; i < 7; i++) sphere(g, w * (.22 + r() * .12), M('plante:' + couleurVariee('#4F6B3A', (r() - .5) * .12)), (r() - .5) * w * .5, h * (.45 + r() * .45), (r() - .5) * w * .5, 1, 1.2, 1, 10);
    return g;
  },
  tv(p) {
    const g = groupe('tv'), [w, d, h] = p.dim;
    if (h > .9) { bloc(g, w, .45, Math.max(.35, d), mCouleur(p, 1, .6), 0, 0, 0, .01); bloc(g, Math.min(w, 1.4), .8, .05, M('noir'), 0, .5, 0, .01); }
    else bloc(g, w, h, Math.max(.04, d), M('noir'), 0, 0, 0, .01);
    return g;
  },
  'tv-murale'(p) {
    const g = groupe('tv-murale'), [w, d, h] = p.dim;
    bloc(g, w, h, Math.max(.04, d), M('noir'), 0, -h / 2, d / 2, .01);
    return g;
  },
  radiateur(p) {
    const g = groupe('radiateur'), [w, d, h] = p.dim, m = mCouleur(p, 0, .5);
    bloc(g, w, h * .9, d, m, 0, h * .1, 0, .015);
    const n = Math.max(4, Math.round(w / .055));
    for (let i = 1; i < n; i++) bloc(g, .007, h * .8, .006, std('#C9C7C3', .8), -w / 2 + i * w / n, h * .15, d / 2);
    return g;
  },
  etagere(p) {
    const g = groupe('etagere'), [w, d, h] = p.dim, m = mCouleur(p, 0, .7);
    [-1, 1].forEach(k => bloc(g, .03, h, d, m, k * (w / 2 - .015), 0, 0));
    const n = Math.max(2, Math.round(h / .38));
    for (let i = 0; i <= n; i++) bloc(g, w, .025, d, m, 0, Math.min(h - .025, i * h / n), 0);
    return g;
  },
  bureau(p) { return CAT_GENERIQUE.table ? CAT_GENERIQUE.table({ ...p, st: p.st || 'rect' }) : boiteGenerique(p); },
  armoire(p) { return CAT_GENERIQUE.meuble ? CAT_GENERIQUE.meuble({ ...p, st: p.st || 'armoire' }) : boiteGenerique(p); },
  commode(p) { return CAT_GENERIQUE.meuble ? CAT_GENERIQUE.meuble(p) : boiteGenerique(p); },
  rideau(p) { return boiteGenerique({ ...p, dim: [p.dim[0], .08, p.dim[2]] }); },
  autre: boiteGenerique
};
PLUS.bibliotheque = PLUS.etagere;
PLUS.console = PLUS.commode;
PLUS.chevet = PLUS.commode;
PLUS.buffet = PLUS.commode;
// le tapis du catalogue était un panneau mural : ici il est posé au sol
CAT_GENERIQUE.tapis = PLUS.tapis;
function mesh3(geo, m) { const me = new THREE.Mesh(geo, m); me.castShadow = true; me.receiveShadow = true; return me; }
function boiteGenerique(p) {
  const g = groupe('meuble');
  bloc(g, p.dim[0], p.dim[2], p.dim[1], mCouleur(p), 0, 0, 0, Math.min(.04, p.dim[0] / 10));
  return g;
}

/* ---------------------------------------------------------------
   L'éditeur
   --------------------------------------------------------------- */
export function creerEditeur(canvas, opts = {}) {
  const catalogue = opts.produits || {};
  definirProduits(catalogue);
  const rappel = { selection: opts.surSelection || (() => {}), deplacement: opts.surDeplacement || (() => {}), vue: opts.surVue || (() => {}), cadre: opts.surCadre || (() => {}) };
  // mouvement réduit demandé : la caméra saute directement à sa place, sans tour automatique
  const reduit = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 indisponible');
  const dprMax = Math.min(window.devicePixelRatio || 1, opts.dprMax || 2);
  renderer.setPixelRatio(dprMax);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.fond || '#EFEBE3');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .55;
  const hemi = new THREE.HemisphereLight('#FFF7EC', '#BDAF9C', 1.05);
  const soleil = new THREE.DirectionalLight('#FFF1DE', 2.1);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  soleil.shadow.bias = -.0004;
  soleil.shadow.normalBias = .02;
  soleil.shadow.radius = 4;
  scene.add(hemi, soleil, soleil.target);

  const camera = new THREE.PerspectiveCamera(45, 1, .05, 200);
  const racine = groupe('piece');       // murs, sol, plafond
  const meublesG = groupe('meubles');   // un porteur par meuble
  const aides = groupe('aides');        // contour de sélection
  scene.add(racine, meublesG, aides);

  const E = {
    modele: null, items: new Map(), murs: [], plafond: null, selection: null, mode: 'dessus',
    orbite: { theta: .55, phi: .92, r: 9, cible: new THREE.Vector3() },
    regard: { yaw: 0, pitch: 0 },
    anim: null, sale: true, ombres: true, raf: 0, detruit: false,
    tween: null,     // glissé de l'orbite (angle, hauteur, distance, point visé)
    auto: null,      // tour lent autour du meuble cadré
    cadre: null,     // meuble cadré
    dernier: 0,
    amb: { k: 0, de: 0, cible: 0, t0: 0, duree: 0 },          // 0 : jour, 1 : soir
    decal: { x: 0, y: 0, cx: 0, cy: 0 }                        // décalage de la vue (part de l'écran)
  };

  /* ---------- la pièce ---------- */
  function viderGroupe(g) {
    while (g.children.length) {
      const o = g.children.pop();
      o.traverse(x => { if (x.geometry) x.geometry.dispose(); });
    }
  }
  function construirePiece(modele) {
    viderGroupe(racine);
    E.murs = [];
    const { largeur: L, profondeur: P, hauteur: H } = modele.dims;
    const sol = modele.sol || {}, couleurSol = sol.couleur || '#B9A58B';
    const matiere = ['parquet', 'carrelage', 'marbre'].includes(sol.matiere) ? sol.matiere : 'uni';
    const t = textureSol(matiere, couleurSol).clone();
    t.needsUpdate = true;
    const pas = matiere === 'parquet' ? 1.6 : matiere === 'uni' ? 2.5 : 2.4;
    t.repeat.set(L / pas, P / pas);
    const mSol = std('#FFFFFF', sol.matiere === 'moquette' ? 1 : matiere === 'marbre' ? .3 : matiere === 'carrelage' ? .45 : .72, 0, { map: t });
    const contour = contourDe(modele);
    const formeSol = new THREE.Shape(contour.map(([x,z])=>new THREE.Vector2(x,-z)));
    const geometrieSol = new THREE.ShapeGeometry(formeSol);
    const uv = geometrieSol.attributes.uv, positions = geometrieSol.attributes.position;
    for(let i=0;i<uv.count;i++) uv.setXY(i,(positions.getX(i)+L/2)/L,(positions.getY(i)+P/2)/P);
    const plan = mesh3(geometrieSol, mSol);
    plan.rotation.x = -Math.PI / 2; plan.castShadow = false;
    racine.add(plan);
    // socle discret sous la pièce (maquette posée)
    const socle = mesh3(new THREE.BoxGeometry(L + 2 * EPAISSEUR + .3, .2, P + 2 * EPAISSEUR + .3), std('#E4DED2', .95));
    socle.position.y = -.1 - .002; socle.castShadow = false;
    racine.add(socle);

    const couleurMur = m => (modele.murs && modele.murs[m] && modele.murs[m].couleur) || modele.couleurMurs || '#F1EDE6';
    // chaque mur : largeur intérieure, extrudé vers l'extérieur ; u = abscisse le long du mur
    // (fond en z = -P/2, entrée en z = +P/2 : voir lib/agencement.js)
    let defs = {
      fond: { a: [L / 2, -P / 2], d: [-1, 0], n: [0, -1], long: L, u: pos => L / 2 - pos },
      entree: { a: [-L / 2, P / 2], d: [1, 0], n: [0, 1], long: L, u: pos => pos + L / 2 },
      gauche: { a: [-L / 2, -P / 2], d: [0, 1], n: [-1, 0], long: P, u: pos => pos + P / 2 },
      droite: { a: [L / 2, P / 2], d: [0, -1], n: [1, 0], long: P, u: pos => P / 2 - pos }
    };
    if (modele.contour) {const sens=Math.sign(aireSignee(contour));defs=Object.fromEntries(segmentsDe(modele).map(p=>[p.id,{a:sens>0?p.b:p.a,d:p.d.map(v=>-sens*v),n:p.n.map(v=>-v),long:p.long,u:pos=>p.long/2-sens*pos}]));}
    for (const [nom, c] of Object.entries(defs)) {
      const ouv = ((modele.murs && modele.murs[nom] && modele.murs[nom].ouvertures) || []).map(o => ({ ...o, u: c.u(o.position) }))
        .filter(o => o.largeur > .1 && o.u - o.largeur / 2 > -.01 && o.u + o.largeur / 2 < c.long + .01);
      const sh = new THREE.Shape();
      sh.moveTo(-EPAISSEUR, 0); sh.lineTo(c.long + EPAISSEUR, 0); sh.lineTo(c.long + EPAISSEUR, H); sh.lineTo(-EPAISSEUR, H); sh.closePath();
      ouv.forEach(o => {
        const y0 = clamp(o.allege || 0, 0, H - .3), y1 = clamp(y0 + (o.hauteur || 1.2), y0 + .2, H - .05);
        const u0 = clamp(o.u - o.largeur / 2, .02, c.long - .1), u1 = clamp(o.u + o.largeur / 2, u0 + .1, c.long - .02);
        const tr = new THREE.Path(); tr.moveTo(u0, y0); tr.lineTo(u1, y0); tr.lineTo(u1, y1); tr.lineTo(u0, y1); tr.closePath();
        sh.holes.push(tr);
        o.u0 = u0; o.u1 = u1; o.y0 = y0; o.y1 = y1;
      });
      const geo = new THREE.ExtrudeGeometry(sh, { depth: EPAISSEUR, bevelEnabled: false });
      const mat = std(couleurMur(nom), .93);
      const me = mesh3(geo, mat);
      // repère du mur : x le long de d, y vers le haut, z vers l'extérieur (n)
      const bx = new THREE.Vector3(c.d[0], 0, c.d[1]), bz = new THREE.Vector3(c.n[0], 0, c.n[1]);
      me.matrixAutoUpdate = false;
      me.matrix.makeBasis(bx, new THREE.Vector3(0, 1, 0), bz).setPosition(c.a[0], 0, c.a[1]);
      racine.add(me);
      // plinthe côté pièce
      const plinthe = mesh3(new THREE.BoxGeometry(c.long, .07, .012), std('#F6F3EE', .6));
      plinthe.castShadow = false;
      const centre = new THREE.Vector3(c.a[0] + bx.x * c.long / 2 - bz.x * .006, .035, c.a[1] + bx.z * c.long / 2 - bz.z * .006);
      plinthe.position.copy(centre); plinthe.rotation.y = Math.atan2(bx.z, bx.x) * -1;
      racine.add(plinthe);
      const menuiseries = groupe('ouvertures-' + nom);
      menuiseries.matrixAutoUpdate = false;
      menuiseries.matrix.copy(me.matrix);
      ouv.forEach(o => ouverture(menuiseries, o));
      racine.add(menuiseries);
      E.murs.push({ nom, me, menuiseries, plinthe, n: bz, centre: new THREE.Vector3(c.a[0] + bx.x * c.long / 2, H / 2, c.a[1] + bx.z * c.long / 2), op: 1 });
    }
    // plafond (vu seulement de l'intérieur)
    const pl = mesh3(new THREE.ShapeGeometry(formeSol), std((modele.plafond && modele.plafond.couleur) || '#F7F5F0', .95));
    pl.rotation.x = -Math.PI / 2; pl.material.side = THREE.BackSide; pl.position.y = H; pl.castShadow = false;
    racine.add(pl);
    E.plafond = pl;
    // contour du sol (repère quand les murs s'effacent)
    const bord = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(contour.map(([x, z]) => new THREE.Vector3(x, .004, z))), new THREE.LineBasicMaterial({ color: '#8F8577', transparent: true, opacity: .55 }));
    racine.add(bord);

    // lumière du jour : soleil au-dessus d'une fenêtre s'il y en a, ombres cadrées sur la pièce
    const r = Math.max(L, P) * .75 + 1;
    const fen = ['fond', 'gauche', 'droite', 'entree'].find(m => ((modele.murs && modele.murs[m] && modele.murs[m].ouvertures) || []).some(o => o.type === 'fenetre' || o.type === 'baie'));
    const dir = { fond: [0, -1], gauche: [-1, 0], droite: [1, 0], entree: [0, 1] }[fen || 'fond'];
    soleil.position.set(dir[0] * r * 1.2 + r * .35, H + r * 1.6, dir[1] * r * 1.2 + r * .25);
    soleil.target.position.set(0, 0, 0);
    const sc = soleil.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = .5; sc.far = r * 6;
    sc.updateProjectionMatrix();
    E.ombres = true;
  }
  function ouverture(parent, o) {
    const ep = EPAISSEUR, w = o.u1 - o.u0, h = o.y1 - o.y0, uc = (o.u0 + o.u1) / 2;
    const cadre = new THREE.Group(); cadre.position.set(uc, 0, 0); parent.add(cadre);
    if (o.type === 'porte') {
      [-1, 1].forEach(k => bloc(cadre, .05, h, ep + .02, M('laque:#EFEBE4'), k * (w / 2 + .01), o.y0, ep / 2));
      bloc(cadre, w + .12, .05, ep + .02, M('laque:#EFEBE4'), 0, o.y1, ep / 2);
      bloc(cadre, w - .02, h - .01, .04, M('laque:' + (o.couleur || '#E7E1D6')), 0, o.y0, ep * .55);
      const poignee = cyl(cadre, .012, .012, .12, M('chrome'), w / 2 - .09, o.y0 + 1.02, ep * .55 - .04, 8);
      poignee.rotation.x = Math.PI / 2;
      return;
    }
    if (o.type === 'passage') {
      [-1, 1].forEach(k => bloc(cadre, .04, h, ep + .02, M('laque:#EFEBE4'), k * (w / 2 + .005), o.y0, ep / 2));
      const fond = mesh3(new THREE.PlaneGeometry(w, h), std('#6F675D', .95)); fond.position.set(0, o.y0 + h / 2, ep + .6); fond.castShadow = false;
      cadre.add(fond);
      return;
    }
    // fenêtre ou baie : dormant, croisillons, vitre, ciel derrière
    const noir = M('laque:#F2F0EB');
    [-1, 1].forEach(k => bloc(cadre, .05, h, .07, noir, k * (w / 2 - .025), o.y0, ep / 2));
    bloc(cadre, w, .05, .07, noir, 0, o.y0, ep / 2);
    bloc(cadre, w, .05, .07, noir, 0, o.y1 - .05, ep / 2);
    const nb = Math.max(1, Math.round(w / 1));
    for (let i = 1; i < nb; i++) bloc(cadre, .04, h, .06, noir, -w / 2 + i * w / nb, o.y0, ep / 2);
    if (o.y0 > .05) bloc(cadre, w + .1, .03, .18, M('laque:#F2F0EB'), 0, o.y0 - .03, -.05);
    const vitre = new THREE.Mesh(new THREE.PlaneGeometry(w - .06, h - .06), M('verre'));
    vitre.position.set(0, o.y0 + h / 2, ep / 2); vitre.renderOrder = 4;
    cadre.add(vitre);
    // ciel à la taille de la baie, contre la face extérieure du mur : on ne le voit qu'à travers la vitre
    const ciel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M('fenetre'));
    ciel.position.set(0, o.y0 + h / 2, ep + .01);
    ciel.rotation.y = Math.PI;
    cadre.add(ciel);
  }

  /* ---------- les meubles ---------- */
  function optionsDe(p) {
    const H = E.modele.dims.hauteur;
    if (estSuspendu(p.fam)) { const hMax = clamp(H - 1.95, .35, 2.2); return { hMax, h: Math.min(hMax * .65, .9) }; }
    return {};
  }
  function modeleDe(item, p) {
    graine(hash(item.sku || item.id));
    let g = null;
    try {
      if (item.sku && catalogue[item.sku]) g = construireProduit(item.sku, optionsDe(p));
      else if (PLUS[p.fam] && !(CAT_GENERIQUE[p.fam] && p.fam !== 'tapis')) g = PLUS[p.fam](p);
      else g = construireCatalogue(p, optionsDe(p));
    } catch (err) { console.warn('maquette', p.fam, err); }
    if (!g || !g.children.length) g = boiteGenerique(p);
    cuire(g);
    return g;
  }
  function poser(item) {
    const p = produitDe(item, catalogue);
    if (!p || !p.dim) return null;
    const porteur = new THREE.Group();
    porteur.name = 'meuble-' + item.id;
    const modele = modeleDe(item, p);
    porteur.add(modele);
    porteur.traverse(o => { o.userData.itemId = item.id; });
    meublesG.add(porteur);
    const e = { item: { ...item }, p, porteur, modele, fantome: false };
    placerPorteur(e);
    appliquerFantome(e);
    return e;
  }
  // petits objets posés sur un meuble bas (télévision sur son meuble, lampe sur une table) : même règle que le solveur
  const posable = e => !!e.p && estPosable(e.p.fam, e.p.dim);
  function hauteurPose(e) {
    if (!posable(e)) return 0;
    const autres = [];
    for (const o of E.items.values()) if (o !== e && !o.fantome && o.p) autres.push({ it: o.item, p: o.p });
    const sur = porteurDe(e.item, e.p, autres);
    return sur ? sur.p.dim[2] : 0;
  }
  function placerPorteur(e) {
    const { item, p, porteur } = e, H = E.modele.dims.hauteur;
    const y = estSuspendu(p.fam) ? H : estMural(p.fam) ? (item.y ?? 1.55) : hauteurPose(e);
    porteur.position.set(item.x || 0, y, item.z || 0);
    porteur.rotation.y = item.rot || 0;
    porteur.updateMatrixWorld(true);
  }
  // un meuble actuel retiré (garde: false) disparaît de la maquette ; il reste dans la liste pour être remis
  function appliquerFantome(e) {
    const f = e.item.garde === false;
    if (f === e.fantome) return;
    e.fantome = f;
    e.porteur.visible = !f;
    E.ombres = true;
  }
  function retirer(id) {
    const e = E.items.get(id);
    if (!e) return;
    meublesG.remove(e.porteur);
    e.porteur.traverse(o => { if (o.geometry && o.geometry !== undefined) o.geometry.dispose(); });
    E.items.delete(id);
  }
  function majItems(items) {
    const vus = new Set();
    for (const it of items) {
      vus.add(it.id);
      const e = E.items.get(it.id);
      const produit = it.sku || JSON.stringify(it.p && [it.p.fam, it.p.dim, it.p.cols, it.p.st]);
      if (e && e.produit === produit) {
        e.item = { ...it };
        placerPorteur(e);
        appliquerFantome(e);
      } else {
        if (e) retirer(it.id);
        const n = poser(it);
        if (n) { n.produit = produit; E.items.set(it.id, n); }
      }
    }
    for (const id of [...E.items.keys()]) if (!vus.has(id)) retirer(id);
    for (const e of E.items.values()) if (posable(e)) placerPorteur(e);
    if (E.cadre && !E.items.has(E.cadre)) ensemble();
    if (E.amb.k > 0 || E.amb.cible > 0) { majFeux(); appliquerAmbiance(E.amb.k); }
    if (E.selection && !E.items.has(E.selection)) selectionner(null);
    else majContour();
    E.ombres = true;
    demander();
    prechauffer();
  }

  /* ---------- sélection ---------- */
  const matContour = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: .95, depthTest: false });
  function majContour() {
    viderGroupe(aides);
    const e = E.selection && E.items.get(E.selection);
    if (!e) { demander(); return; }
    const { p, item } = e;
    let pts;
    if (estMural(p.fam)) {
      const l = p.dim[0] / 2 + .05, h = p.dim[2] / 2 + .05;
      pts = [[-l, -h], [l, -h], [l, h], [-l, h]].map(([u, v]) => new THREE.Vector3(u, v, .06));
    } else {
      const [hx, hz] = demiEmpreinte(p.dim, 0);
      const m = .06;
      pts = [[-hx - m, -hz - m], [hx + m, -hz - m], [hx + m, hz + m], [-hx - m, hz + m]].map(([x, z]) => new THREE.Vector3(x, .01, z));
    }
    const c = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), matContour);
    c.renderOrder = 10;
    const porteur = new THREE.Group();
    const H = E.modele.dims.hauteur;
    porteur.position.set(item.x, estMural(p.fam) ? (item.y ?? 1.55) : 0, item.z);
    porteur.rotation.y = item.rot || 0;
    porteur.add(c);
    if (estSuspendu(p.fam)) {
      const tige = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, .01, 0), new THREE.Vector3(0, H - .05, 0)]), matContour);
      porteur.add(tige);
    }
    aides.add(porteur);
    demander();
  }
  function selectionner(id, emettre = false) {
    E.selection = id && E.items.has(id) ? id : null;
    majContour();
    if (emettre) rappel.selection(E.selection);
  }

  /* ---------- caméra ---------- */
  function poseDessus() {
    const { largeur: L, profondeur: P, hauteur: H } = E.modele.dims;
    const o = E.orbite;
    const x = o.cible.x + o.r * Math.sin(o.phi) * Math.sin(o.theta);
    const y = o.cible.y + o.r * Math.cos(o.phi);
    const z = o.cible.z + o.r * Math.sin(o.phi) * Math.cos(o.theta);
    return { px: x, py: y, pz: z, tx: o.cible.x, ty: o.cible.y, tz: o.cible.z, fov: 42, L, P, H };
  }
  function vuePhoto() {
    const { largeur: L, profondeur: P } = E.modele.dims;
    const v = E.modele.vue || {};
    const px = clamp(v.x ?? 0, -L / 2 + .1, L / 2 - .1), pz = clamp(v.z ?? P / 2 - .25, -P / 2 + .1, P / 2 - .05);
    return { px, py: v.y ?? 1.5, pz, tx: v.cx ?? 0, ty: v.cy ?? 1.05, tz: v.cz ?? -P / 2, fov: v.fov || 60 };
  }
  function poseCourante() {
    if (E.mode === 'photo') {
      const b = vuePhoto();
      // regarder autour sans bouger
      const dir = new THREE.Vector3(b.tx - b.px, b.ty - b.py, b.tz - b.pz);
      const s = new THREE.Spherical().setFromVector3(dir);
      s.theta += E.regard.yaw; s.phi = clamp(s.phi - E.regard.pitch, .4, 2.6);
      dir.setFromSpherical(s);
      return { px: b.px, py: b.py, pz: b.pz, tx: b.px + dir.x, ty: b.py + dir.y, tz: b.pz + dir.z, fov: b.fov };
    }
    return poseDessus();
  }
  let poseAffichee = null;
  function appliquerPose(p) {
    camera.position.set(p.px, p.py, p.pz);
    camera.lookAt(p.tx, p.ty, p.tz);
    if (Math.abs(camera.fov - p.fov) > .01) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
    poseAffichee = p;
  }
  function vue(mode, anime = true) {
    if (!E.modele) return;
    const depart = poseAffichee ? { ...poseAffichee } : null;
    E.mode = mode === 'photo' ? 'photo' : 'dessus';
    E.regard.yaw = E.regard.pitch = 0;
    // changer de vue quitte le cadrage : retour à la vue d'ensemble (même angle)
    E.tween = null; E.auto = null;
    if (E.cadre) { E.cadre = null; rappel.cadre(null); poserOrbite({ ...orbiteDefaut(), theta: E.orbite.theta }); }
    const arrivee = poseCourante();
    if (!anime || !depart || reduit) { E.anim = null; appliquerPose(arrivee); demander(); rappel.vue(E.mode); return; }
    E.anim = { depart, t0: performance.now(), duree: 1150 };
    rappel.vue(E.mode);
    demander();
  }

  /* ---------- mouvements de caméra (vue maquette) ---------- */
  const etatOrbite = () => ({ theta: E.orbite.theta, phi: E.orbite.phi, r: E.orbite.r, cx: E.orbite.cible.x, cy: E.orbite.cible.y, cz: E.orbite.cible.z });
  function poserOrbite(v) {
    const o = E.orbite;
    o.theta = v.theta; o.phi = v.phi; o.r = v.r; o.cible.set(v.cx, v.cy, v.cz);
  }
  function orbiteDefaut() {
    const { largeur: L, profondeur: P, hauteur: H } = E.modele.dims;
    return { theta: .55, phi: .92, r: Math.max(L, P) * 1.55 + 2, cx: 0, cy: H * .25, cz: 0 };
  }
  // glisse l'orbite vers une nouvelle position (le plus court chemin en angle)
  function glisser(vers, duree, courbe = 'douce', fin) {
    const de = etatOrbite(), cible = { ...de, ...vers };
    cible.theta = de.theta + Math.atan2(Math.sin(cible.theta - de.theta), Math.cos(cible.theta - de.theta));
    if (reduit || E.mode !== 'dessus') { E.tween = null; poserOrbite(cible); if (fin) fin(); demander(); return; }
    E.tween = { de, vers: cible, t0: performance.now(), duree, courbe: COURBES[courbe], fin };
    demander();
  }
  // arrivée : la caméra descend d'en haut en tournant, jusqu'à la vue d'ensemble
  function intro() {
    if (!E.modele || reduit || E.mode !== 'dessus') return;
    const d = orbiteDefaut();
    poserOrbite({ ...d, theta: d.theta - 1.15, phi: .3, r: d.r * 1.75, cy: d.cy + .5 });
    glisser(d, 2600, 'sortie');
    E.tween.vers.theta = d.theta;   // l'arc complet, pas le plus court chemin
  }
  // cadre un meuble : la caméra glisse jusqu'à lui, de trois quarts face, puis en fait lentement le tour
  // (les appliques et miroirs : un balancement devant le mur plutôt qu'un tour complet)
  function cadrer(id) {
    const e = E.items.get(id);
    if (!e || e.fantome || E.mode !== 'dessus' || !E.modele) return false;
    const b = new THREE.Box3().setFromObject(e.modele);
    if (b.isEmpty()) return false;
    const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const taille = Math.max(s.x, s.y, s.z, .3);
    const mural = estMural(e.p.fam), suspendu = estSuspendu(e.p.fam);
    const rot = e.item.rot || 0;
    const vers = {
      cx: c.x, cy: clamp(c.y, .2, E.modele.dims.hauteur - .3), cz: c.z,
      r: clamp(taille * 2.1 + .8, 1.5, 7),
      phi: suspendu ? 1.32 : mural ? 1.25 : .98,
      theta: mural ? rot : suspendu ? E.orbite.theta : rot + .6
    };
    E.cadre = id; E.auto = null;
    rappel.cadre(id);
    glisser(vers, 1400, 'douce', () => {
      if (E.cadre !== id || reduit) return;
      E.auto = mural ? { type: 'balancier', base: vers.theta, t0: performance.now() } : { type: 'tour', vitesse: .17 };
      demander();
    });
    return true;
  }
  function ensemble() {
    if (!E.modele) return;
    const avait = E.cadre;
    E.cadre = null; E.auto = null;
    if (avait) rappel.cadre(null);
    // retour à la vue de départ (depuis l'entrée), la plus lisible
    glisser(orbiteDefaut(), 1500, 'douce');
  }
  // nouvel aménagement : un lent quart de tour qui le dévoile
  function balayer() {
    if (!E.modele || E.mode !== 'dessus') return;
    E.cadre = null; E.auto = null;
    rappel.cadre(null);
    const d = orbiteDefaut();
    glisser({ ...d, theta: E.orbite.theta + .95 }, 2800, 'douce');
    if (E.tween) E.tween.vers.theta = E.orbite.theta + .95;
  }
  // le moindre geste rend la main
  function interrompre() { E.tween = null; E.auto = null; }

  /* ---------- ambiance : jour ou soir (luminaires allumés, lumière du jour qui baisse) ---------- */
  const FONDS = { jour: new THREE.Color(opts.fond || '#EFEBE3'), soir: new THREE.Color(opts.fondSoir || '#251C14') };
  const LUMINAIRES = new Set(['suspension', 'lustre', 'plafonnier', 'lampadaire', 'lampe', 'applique']);
  // six lumières créées d'avance, cachées le jour : leur nombre ne change jamais, et leurs shaders
  // sont compilés en tâche de fond après le chargement (passer au soir ne fige pas l'écran)
  const feux = Array.from({ length: 6 }, () => { const l = new THREE.PointLight('#FFB46E', 0, 6.5, 2); l.visible = false; scene.add(l); return { l, i: 0 }; });
  const allumer = oui => { for (const f of feux) f.l.visible = oui; };
  let prechauffe = 0;
  function prechauffer() {
    clearTimeout(prechauffe);
    prechauffe = setTimeout(() => {
      if (E.detruit || !E.modele) return;
      const allumees = feux[0].l.visible;
      allumer(true);
      renderer.compileAsync(scene, camera).catch(() => {});
      allumer(allumees);
    }, 1200);
  }
  function majFeux() {
    const sources = [];
    for (const e of E.items.values()) {
      if (e.fantome || !e.p || !LUMINAIRES.has(e.p.fam)) continue;
      const b = new THREE.Box3().setFromObject(e.modele), c = b.getCenter(new THREE.Vector3());
      if (['suspension', 'lustre', 'plafonnier'].includes(e.p.fam)) c.y = b.min.y + .12;
      else if (e.p.fam === 'applique') c.add(new THREE.Vector3(Math.sin(e.item.rot || 0), 0, Math.cos(e.item.rot || 0)).multiplyScalar(.22));
      else c.y = b.max.y - .18;
      sources.push({ c, i: e.p.fam === 'applique' ? 1.6 : e.p.fam === 'lampe' ? 2 : 4.5 });
      if (sources.length >= 6) break;
    }
    feux.forEach((f, n) => { const s = sources[n]; f.i = s ? s.i : 0; if (s) f.l.position.copy(s.c); });
  }
  const cAmb = new THREE.Color();
  function appliquerAmbiance(k) {
    for (const Lu of LUMINEUX) {
      const v = Lu.jour + (Lu.soir - Lu.jour) * k;
      if (Lu.champ === 'opacite') Lu.m.opacity = v;
      else if (Lu.champ === 'couleur') { if (Lu.m.userData.base) Lu.m.color.copy(Lu.m.userData.base).multiplyScalar(v); }
      else Lu.m.emissiveIntensity = v;
    }
    hemi.intensity = lerp(1.05, .26, k);
    hemi.color.set('#FFF7EC').lerp(cAmb.set('#7F88A8'), k);
    soleil.intensity = lerp(2.1, .16, k);
    soleil.color.set('#FFF1DE').lerp(cAmb.set('#8E9AC8'), k);
    scene.environmentIntensity = lerp(.55, .16, k);
    scene.background.copy(FONDS.jour).lerp(FONDS.soir, k);
    const s = k * k * (3 - 2 * k);
    feux.forEach(f => { f.l.intensity = f.i * s; });
    allumer(k > .001);
  }
  // ambiance(1) : le soir, en glissant (duree en ms)
  function ambiance(k, duree = 1100) {
    const a = E.amb;
    a.de = a.k; a.cible = clamp(k, 0, 1); a.t0 = performance.now(); a.duree = reduit ? 0 : duree;
    majFeux();
    demander();
  }
  // décalage de la vue : la pièce se range à côté d'un panneau (x, y : part de la largeur, de la hauteur)
  function decalage(x = 0, y = 0, instant = false) {
    E.decal.x = x; E.decal.y = y;
    if (instant || reduit) { E.decal.cx = x; E.decal.cy = y; appliquerDecalage(); }
    demander();
  }
  let tailleVue = { w: 1, h: 1 };
  function appliquerDecalage() {
    const { w, h } = tailleVue, d = E.decal;
    if (Math.abs(d.cx) < 1e-4 && Math.abs(d.cy) < 1e-4) camera.clearViewOffset();
    else camera.setViewOffset(w, h, -d.cx * w, -d.cy * h, w, h);
  }

  /* ---------- murs qui s'effacent (vue de dessus) ---------- */
  function majMurs(cam, force) {
    if (!E.modele) return false;
    const { largeur: L, profondeur: P, hauteur: H } = E.modele.dims;
    const dedans = contientPoint(E.modele,cam.position.x,cam.position.z) && cam.position.y < H;
    let change = false;
    E.plafond.visible = dedans;
    for (const w of E.murs) {
      const d = new THREE.Vector3().subVectors(cam.position, w.centre).dot(w.n);
      const cible = force ? 1 : (!dedans && d > 0 ? 0 : 1);
      if (w.op !== cible) {
        w.op = cible;
        w.me.material.opacity = cible ? 1 : 0;
        w.me.visible = cible > 0;
        w.menuiseries.visible = cible > 0;
        w.plinthe.visible = cible > 0;
        w.me.material.depthWrite = true;
        change = true;
      }
    }
    if (change) E.ombres = true;
    return change;
  }

  /* ---------- rendu à la demande ---------- */
  function demander() { if (!E.raf && !E.detruit) E.raf = requestAnimationFrame(rendre); }
  function rendre(t) {
    E.raf = 0;
    if (!E.modele) return;
    const maintenant = performance.now();
    const dt = E.dernier ? Math.min(.05, (maintenant - E.dernier) / 1000) : 0;
    E.dernier = maintenant;
    let encore = false;
    if (E.tween && E.mode === 'dessus') {
      const tw = E.tween, k = clamp((maintenant - tw.t0) / tw.duree, 0, 1), s = tw.courbe(k);
      poserOrbite({ theta: lerp(tw.de.theta, tw.vers.theta, s), phi: lerp(tw.de.phi, tw.vers.phi, s), r: lerp(tw.de.r, tw.vers.r, s), cx: lerp(tw.de.cx, tw.vers.cx, s), cy: lerp(tw.de.cy, tw.vers.cy, s), cz: lerp(tw.de.cz, tw.vers.cz, s) });
      if (k >= 1) { E.tween = null; if (tw.fin) tw.fin(); } else encore = true;
    } else if (E.auto && E.mode === 'dessus') {
      // un tour complet (ou une demi-minute de balancement), puis la caméra s'arrête
      if (E.auto.type === 'tour') { E.orbite.theta += E.auto.vitesse * dt; E.auto.cumul = (E.auto.cumul || 0) + E.auto.vitesse * dt; }
      else E.orbite.theta = E.auto.base + Math.sin((maintenant - E.auto.t0) / 1000 * .45) * .55;
      encore = true;
      if (E.auto.cumul >= Math.PI * 2 || maintenant - (E.auto.t0 || maintenant) > 28000) E.auto = null;
    }
    const a = E.amb;
    if (a.k !== a.cible) {
      const k = a.duree ? clamp((maintenant - a.t0) / a.duree, 0, 1) : 1;
      a.k = k >= 1 ? a.cible : lerp(a.de, a.cible, k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
      appliquerAmbiance(a.k);
      if (a.k !== a.cible) encore = true;
    }
    const d = E.decal;
    if (Math.abs(d.cx - d.x) > 1e-4 || Math.abs(d.cy - d.y) > 1e-4) {
      const f = 1 - Math.exp(-(dt || .016) * 7);
      d.cx += (d.x - d.cx) * f; d.cy += (d.y - d.cy) * f;
      if (Math.abs(d.cx - d.x) < 1e-3 && Math.abs(d.cy - d.y) < 1e-3) { d.cx = d.x; d.cy = d.y; }
      appliquerDecalage();
      encore = true;
    }
    if (encore) demander(); else E.dernier = 0;
    if (E.anim) {
      const k = clamp((performance.now() - E.anim.t0) / E.anim.duree, 0, 1), s = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const a = E.anim.depart, b = poseCourante();
      appliquerPose({ px: lerp(a.px, b.px, s), py: lerp(a.py, b.py, s), pz: lerp(a.pz, b.pz, s), tx: lerp(a.tx, b.tx, s), ty: lerp(a.ty, b.ty, s), tz: lerp(a.tz, b.tz, s), fov: lerp(a.fov, b.fov, s) });
      if (k >= 1) E.anim = null; else demander();
    } else appliquerPose(poseCourante());
    majMurs(camera);
    if (E.ombres) { renderer.shadowMap.needsUpdate = true; E.ombres = false; }
    renderer.render(scene, camera);
  }

  /* ---------- pointeur : sélection, déplacement, orbite, zoom ---------- */
  const ray = new THREE.Raycaster();
  const pointeurs = new Map();
  let geste = null;
  function versNDC(e) {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function viser(e) {
    ray.setFromCamera(versNDC(e), camera);
    const hits = ray.intersectObject(meublesG, true).filter(h => {
      const e = h.object.userData.itemId && E.items.get(h.object.userData.itemId);
      return e && !e.fantome && h.object.visible && !h.object.isSprite;
    });
    return hits.length ? hits[0].object.userData.itemId : null;
  }
  const planSol = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pointSol(e, y = 0) {
    ray.setFromCamera(versNDC(e), camera);
    planSol.constant = -y;
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(planSol, p) ? p : null;
  }
  canvas.addEventListener('pointerdown', e => {
    if (!E.modele) return;
    interrompre();
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
    if (pointeurs.size === 2) { const [a, b] = [...pointeurs.values()]; geste = { type: 'pince', d: Math.hypot(a.x - b.x, a.y - b.y), r: E.orbite.r, fov: camera.fov }; return; }
    const id = opts.lectureSeule ? null : viser(e);
    if (id) {
      const it = E.items.get(id);
      const sol = pointSol(e, 0);
      geste = { type: 'meuble', id, x: e.clientX, y: e.clientY, bouge: 0, dx: sol ? it.item.x - sol.x : 0, dz: sol ? it.item.z - sol.z : 0, depart: { x: it.item.x, z: it.item.z, y: it.item.y } };
      if (E.selection !== id) selectionner(id, true);
    } else geste = { type: 'vue', x: e.clientX, y: e.clientY, bouge: 0 };
    canvas.classList.add('is-geste');
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointeurs.has(e.pointerId)) {
      if (!geste && E.modele && !opts.lectureSeule && e.pointerType === 'mouse') canvas.style.cursor = viser(e) ? 'grab' : '';
      return;
    }
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!geste) return;
    if (geste.type === 'pince' && pointeurs.size >= 2) {
      const [a, b] = [...pointeurs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), k = geste.d / Math.max(20, d);
      if (E.mode === 'photo') { camera.fov = clamp(geste.fov * k, 30, 80); camera.updateProjectionMatrix(); if (E.modele.vue) E.modele.vue = { ...E.modele.vue, fov: camera.fov }; }
      else E.orbite.r = clamp(geste.r * k, 1.5, 30);
      demander();
      return;
    }
    const dx = e.clientX - geste.x, dy = e.clientY - geste.y;
    geste.x = e.clientX; geste.y = e.clientY; geste.bouge += Math.abs(dx) + Math.abs(dy);
    if (geste.type === 'vue') {
      if (E.mode === 'photo') { E.regard.yaw = clamp(E.regard.yaw + dx * .004, -1.2, 1.2); E.regard.pitch = clamp(E.regard.pitch + dy * .003, -.5, .5); }
      else { E.orbite.theta -= dx * .006; E.orbite.phi = clamp(E.orbite.phi - dy * .005, .12, 1.45); }
      demander();
      return;
    }
    if (geste.type === 'meuble' && geste.bouge > 4) {
      const it = E.items.get(geste.id);
      if (!it) return;
      canvas.classList.add('is-deplace');
      const { largeur: L, profondeur: P, hauteur: H } = E.modele.dims;
      if (estMural(it.p.fam)) {
        const sol = pointSol(e, it.item.y ?? 1.55);
        if (!sol) return;
        const place = placerAuMur(E.modele, { ...it.item, x: sol.x, z: sol.z, mur: undefined }, it.p.dim);
        Object.assign(it.item, { x: place.x, z: place.z, rot: place.rot, mur: place.mur });
      } else {
        const sol = pointSol(e, estSuspendu(it.p.fam) ? 0 : 0);
        if (!sol) return;
        const [hx, hz] = demiEmpreinte(it.p.dim, it.item.rot || 0);
        const avantPosition={x:it.item.x,z:it.item.z};
        it.item.x = Math.round(clamp(sol.x + geste.dx, -L / 2 + hx, L / 2 - hx) * 100) / 100;
        it.item.z = Math.round(clamp(sol.z + geste.dz, -P / 2 + hz, P / 2 - hz) * 100) / 100;
        if(E.modele.contour && !contientBoite(E.modele,{x0:it.item.x-hx,x1:it.item.x+hx,z0:it.item.z-hz,z1:it.item.z+hz}))Object.assign(it.item,avantPosition);
      }
      placerPorteur(it);
      majContour();
      E.ombres = true;
      demander();
      void H;
    }
  });
  function finGeste(e) {
    pointeurs.delete(e.pointerId);
    canvas.classList.remove('is-geste', 'is-deplace');
    if (!geste) return;
    if (geste.type === 'meuble') {
      const it = E.items.get(geste.id);
      if (it && geste.bouge > 4) rappel.deplacement({ id: geste.id, x: it.item.x, z: it.item.z, rot: it.item.rot, mur: it.item.mur, y: it.item.y });
    } else if (geste.type === 'vue' && geste.bouge < 5) selectionner(null, true);
    if (pointeurs.size === 0) geste = null;
  }
  canvas.addEventListener('pointerup', finGeste);
  canvas.addEventListener('pointercancel', finGeste);
  canvas.addEventListener('wheel', e => {
    if (!E.modele) return;
    e.preventDefault();
    interrompre();
    const k = Math.exp(e.deltaY * .0012);
    if (E.mode === 'photo') { camera.fov = clamp(camera.fov * k, 30, 80); camera.updateProjectionMatrix(); E.modele.vue = { ...(E.modele.vue || {}), fov: camera.fov }; }
    else E.orbite.r = clamp(E.orbite.r * k, 1.5, 30);
    demander();
  }, { passive: false });

  /* ---------- taille ---------- */
  function redimensionner() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    tailleVue = { w, h };
    appliquerDecalage();
    camera.updateProjectionMatrix();
    demander();
  }
  const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redimensionner) : null;
  if (obs) obs.observe(canvas);

  /* ---------- capture (rendu réaliste) : la vue de la photo, sans aides ni fantômes ---------- */
  function capture(o = {}) {
    if (!E.modele) return null;
    const w = o.largeur || 1536, h = o.hauteur || 1024;
    const v=o.angle&&o.angle!=='entree'?vuePourAngle(E.modele,o.angle):null;
    const p = v?{px:v.x,py:v.y,pz:v.z,tx:v.cx,ty:v.cy,tz:v.cz,fov:v.fov}:vuePhoto();
    const cam = new THREE.PerspectiveCamera(o.fov || p.fov, w / h, .05, 200);
    cam.position.set(p.px, p.py, p.pz); cam.lookAt(p.tx, p.ty, p.tz); cam.updateMatrixWorld();
    const avant = { taille: renderer.getSize(new THREE.Vector2()), dpr: renderer.getPixelRatio() };
    // le rendu réaliste part de la photo, prise de jour : la capture se fait toujours en lumière du jour
    const kAmb = E.amb.k;
    if (kAmb > 0) appliquerAmbiance(0);
    aides.visible = false;
    majMurs(cam, true);
    E.plafond.visible = true;
    renderer.shadowMap.needsUpdate = true;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.render(scene, cam);
    const url = canvas.toDataURL('image/jpeg', o.qualite || .9);
    renderer.setPixelRatio(avant.dpr);
    renderer.setSize(avant.taille.x, avant.taille.y, false);
    if (kAmb > 0) appliquerAmbiance(kAmb);
    aides.visible = true;
    E.murs.forEach(w2 => { w2.op = -1; });
    E.ombres = true;
    rendre();
    return url;
  }

  /* ---------- API ---------- */
  function charger(modele, items = []) {
    E.modele = JSON.parse(JSON.stringify(modele));
    for (const id of [...E.items.keys()]) retirer(id);
    construirePiece(E.modele);
    E.tween = null; E.auto = null; E.cadre = null;
    poserOrbite(orbiteDefaut());
    majItems(items);
    redimensionner();
    vue(E.mode, false);
  }
  return {
    charger,
    majItems,
    majVuePhoto(v) { if (!E.modele) return; E.modele.vue = { ...(E.modele.vue || {}), ...v }; if (E.mode === 'photo') vue('photo', false); },
    selectionner: id => selectionner(id, false),
    vue,
    intro,
    cadrer,
    ensemble,
    balayer,
    ambiance,
    decalage,
    get mode() { return E.mode; },
    capture,
    // position à l'écran (px, dans le canevas) du haut d'un meuble : barre d'outils flottante
    projeter(id) {
      const e = E.items.get(id);
      if (!e) return null;
      const b = new THREE.Box3().setFromObject(e.modele);
      const v = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2).project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: (v.x * .5 + .5) * r.width, y: (-v.y * .5 + .5) * r.height, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
    },
    tourner(id, delta) {
      const e = E.items.get(id);
      if (!e || estMural(e.p.fam)) return null;
      e.item.rot = normaliserAngle((e.item.rot || 0) + delta);
      const { largeur: L, profondeur: P } = E.modele.dims;
      const [hx, hz] = demiEmpreinte(e.p.dim, e.item.rot);
      e.item.x = clamp(e.item.x, -L / 2 + hx, L / 2 - hx); e.item.z = clamp(e.item.z, -P / 2 + hz, P / 2 - hz);
      placerPorteur(e); majContour(); E.ombres = true; demander();
      return { id, x: e.item.x, z: e.item.z, rot: e.item.rot };
    },
    redimensionner,
    rendre: () => rendre(),
    detruire() {
      E.detruit = true;
      clearTimeout(prechauffe);
      if (E.amb.k > 0) appliquerAmbiance(0);
      if (E.raf) cancelAnimationFrame(E.raf);
      if (obs) obs.disconnect();
      viderGroupe(racine); viderGroupe(meublesG); viderGroupe(aides);
      renderer.dispose();
    },
    adossable: fam => estAdosse(fam)
  };
}
