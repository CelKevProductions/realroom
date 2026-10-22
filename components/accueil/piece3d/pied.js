// Le nom couché du pied de page de l'accueil, chargé à la demande par PiedAccueil : « RealRoom » en lettres
// de pâte à modeler posées à plat (contours de la police du site, lettres.js), sur lesquelles cinq
// habitants de l'immeuble sautent et jouent : ils sautent d'une lettre à l'autre (saltos, saute-mouton
// par-dessus un voisin), se passent une balle de la tête, le chien fait la toupie, la tortue rentre dans
// sa carapace quand on atterrit près d'elle. Les lettres plient sous leurs pattes.
// Survoler une lettre la fait sauter (ses voisines suivent en vague, les animaux dessus aussi), cliquer
// une lettre fait décoller ceux qui sont dessus, cliquer un animal le fait réagir. La toile ne prend pas
// la souris (elle déborde sur les liens du pied) : on écoute le pied de page entier.
// Rendu seulement à l'écran, onglet actif ; mouvement réduit : tout le monde à sa place, immobile.
import * as THREE from 'three';
import { initialiser } from '@/components/mouvement/regles.js';
import { matieresAnimaux, creerAnimal, tournoyer, seCacher, coucou, proche, cap } from './animaux.js';
import { GLYPHES } from './lettres.js';
import { definitionAdaptative } from './definition.js';

const S = 1 / 700;                                   // m par unité de la police
const MOT = 'RealRoom', SERRE = 40, EPAIS = 120, BISEAU = 24, BORD = 18;
const HAUT = (EPAIS + 2 * BISEAU) * S;               // dessus des lettres (m)
const MILIEU = 360;                                  // hauteur (unités) qui devient z = 0, une fois couchée
const ENCRE = '#2E2A33';                             // les lettres, toutes de la couleur de l'encre
const REDUIT = '(prefers-reduced-motion: reduce)';
const EL = 34 * Math.PI / 180;                       // la caméra regarde le mot d'un peu haut
// ce que la caméra cadre : le mot sur toute la largeur, posé en bas de la toile, et assez de ciel pour
// les sauts (x, y, z min et max, m)
const MOT_CADRE = [-3.52, 3.52, 0, HAUT, -.6, .6], CIEL = 1.8;
// les joueurs : leur allure, et leur place de départ (lettre, place sur la lettre)
const JOUEURS = [
  { look: { espece: 'lapin', graine: 6 }, k: 0, s: 0 },
  { look: { espece: 'chien', pelage: '#F1C08B', clair: '#FFF3E2', sombre: '#B9835A', graine: 0 }, k: 2, s: 1 },
  { look: { espece: 'tortue', pelage: '#AEC9A4', clair: '#F4ECD6', carapace: '#7FA48A', accessoire: 'lunettes', graine: 4 }, k: 3, s: 1 },
  { look: { espece: 'chat', pelage: '#B8B2AC', clair: '#F2EEEA', graine: 3 }, k: 5, s: 0 },
  { look: { espece: 'lapin', graine: 7 }, k: 7, s: 2 }
];

const hasard = (a, b) => a + Math.random() * (b - a);
const parmi = l => l[Math.floor(Math.random() * l.length)];

// un contour de lettres.js en formes three.js (le contour extérieur tourne en sens horaire)
function formes(d) {
  const p = new THREE.ShapePath(), t = d.match(/[MLQZ]|-?[\d.]+/g);
  let i = 0;
  const n = () => +t[i++];
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') p.moveTo(n(), n());
    else if (c === 'L') p.lineTo(n(), n());
    else if (c === 'Q') p.quadraticCurveTo(n(), n(), n(), n());
  }
  return p.toShapes(false);
}

// les lettres couchées : chacune dans un groupe centré (pour plier et sauter), avec ses places en m
function construireLettres(mobile) {
  const geos = {}, lettres = [];
  const total = [...MOT].reduce((s, c) => s + GLYPHES[c].l, 0) - SERRE * (MOT.length - 1);
  let x = 0;
  [...MOT].forEach((c, i) => {
    const g = GLYPHES[c];
    if (!geos[c]) {
      geos[c] = new THREE.ExtrudeGeometry(formes(g.d), { depth: EPAIS, bevelEnabled: true, bevelThickness: BISEAU, bevelSize: BORD, bevelSegments: mobile ? 2 : 3, curveSegments: mobile ? 4 : 6 });
      // centrée, à l'échelle, couchée : la hauteur de la lettre part vers le fond, l'épaisseur monte
      geos[c].translate(-g.l / 2, -MILIEU, BISEAU).scale(S, S, S).rotateX(-Math.PI / 2);
    }
    const mesh = new THREE.Mesh(geos[c], new THREE.MeshLambertMaterial({ color: ENCRE }));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.k = i;
    const groupe = new THREE.Group();
    groupe.add(mesh);
    const cx = (x + g.l / 2 - total / 2) * S;
    groupe.position.x = cx;
    lettres.push({ groupe, mesh, places: g.places.map(([px, py]) => [cx + (px - g.l / 2) * S, -(py - MILIEU) * S]) });
    x += g.l - SERRE;
  });
  return { lettres, geos: Object.values(geos) };
}

export function creerPied({ toile, boite, zone, textes = {}, surPrete, surPanne }) {
  const gsap = initialiser();
  const mq = matchMedia(REDUIT);
  let reduit = mq.matches;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, powerPreference: 'low-power' });
  let mot, ma;
  try {
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mot = construireLettres(mobile);
    ma = matieresAnimaux();
  } catch (e) {
    renderer.dispose();
    throw e;
  }
  const { lettres } = mot;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 60);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cdbff2', .9 * Math.PI));
  const soleil = new THREE.DirectionalLight('#fff4ea', .72 * Math.PI);
  soleil.position.set(-2.5, 7, 4.5);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  Object.assign(soleil.shadow.camera, { left: -5, right: 5, top: 3.4, bottom: -3.4, near: 2, far: 16 });
  soleil.shadow.bias = -.0005;
  soleil.shadow.normalBias = .02;
  scene.add(soleil);
  // le sol ne se voit pas : seulement les ombres, sur le fond lilas du pied
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(14, 7).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: '#3d3270', opacity: .2 }));
  sol.receiveShadow = true;
  scene.add(sol);
  lettres.forEach(l => scene.add(l.groupe));

  // ---------- les joueurs
  const joueurs = JOUEURS.map(({ look, k, s }) => {
    const a = creerAnimal(ma, look);
    a.objet.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const [x, z] = lettres[k].places[s];
    a.objet.position.set(x, HAUT, z);
    a.objet.rotation.y = hasard(-.5, .5);
    scene.add(a.objet);
    return { a, sur: k, s, vers: null, occupe: false, tl: null, prochain: hasard(.5, 2.5) };
  });
  // la balle qu'ils se passent de la tête
  const balle = new THREE.Group();
  balle.add(new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), ma.corail));
  const bande = new THREE.Mesh(new THREE.TorusGeometry(.09, .014, 6, 20), ma.beurre);
  balle.add(bande);
  balle.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(balle);
  const ballon = { chez: joueurs[1], vol: false, depuis: 0 };

  let t = 0, largeur = 1, hauteur = 1, visible = false, detruit = false, raf = 0, avant = 0, entre = false, premiere = false;
  // avant l'arrivée : les lettres attendent dans le ciel, les animaux et la balle sont cachés
  if (!reduit) {
    lettres.forEach(l => { l.groupe.position.y = 3.2; });
    joueurs.forEach(j => { j.a.objet.visible = false; });
    balle.visible = false;
  }
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();

  // ---------- cadrage : le mot sur toute la largeur, en bas de la toile ; reculer si le ciel manque
  const coins = [];
  for (const x of MOT_CADRE.slice(0, 2)) for (const y of MOT_CADRE.slice(2, 4)) for (const z of MOT_CADRE.slice(4)) coins.push(new THREE.Vector3(x, y, z));
  const ciel = new THREE.Vector3(0, HAUT + CIEL, MOT_CADRE[4]);
  function poserCamera(d, cy) {
    camera.position.set(0, cy + d * Math.sin(EL), d * Math.cos(EL));
    camera.lookAt(0, cy, 0);
    camera.updateMatrixWorld();
  }
  function etendue() {
    let x = 0, y0 = Infinity;
    for (const c of coins) { _v.copy(c).project(camera); x = Math.max(x, Math.abs(_v.x)); y0 = Math.min(y0, _v.y); }
    return { x, y0, y1: _v.copy(ciel).project(camera).y };
  }
  function cadrer() {
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
    let cy = .5, d = 8;
    for (let n = 0; n < 4; n++) {
      // la distance où le mot prend toute la largeur (ou tout le ciel tient), puis la visée qui le pose en bas
      let lo = 1.5, hi = 60;
      for (let i = 0; i < 22; i++) { d = (lo + hi) / 2; poserCamera(d, cy); const e = etendue(); if (e.x <= .96 && e.y1 <= .98) hi = d; else lo = d; }
      d = hi;
      poserCamera(d, cy);
      cy += (etendue().y0 + .95) * d * Math.tan(camera.fov * Math.PI / 360) * .9;
    }
    poserCamera(d, cy);
  }

  // ---------- gestes
  const dessus = k => HAUT * lettres[k].groupe.scale.y + lettres[k].groupe.position.y;
  // la lettre plie sous les pattes, puis revient en rebondissant
  function plier(k, f) {
    const g = lettres[k]?.groupe;
    if (!g || gsap.isTweening(g.position)) return;
    gsap.timeline()
      .to(g.position, { y: -f, duration: .07, ease: 'power2.out' }, 0)
      .to(g.scale, { y: 1 - f * 2.5, duration: .07, ease: 'power2.out' }, 0)
      .to(g.position, { y: 0, duration: .7, ease: 'elastic.out(1, .3)' }, .07)
      .to(g.scale, { y: 1, duration: .7, ease: 'elastic.out(1, .3)' }, .07);
  }
  // salto autour du ventre (le pivot est aux pieds : on le compense)
  function salto(a, duree, sens = 1) {
    const p = { r: 0 }, c = .33;
    return gsap.to(p, {
      r: sens * Math.PI * 2, duration: duree, ease: 'power1.inOut',
      onUpdate: () => { a.saut.rotation.x = p.r; a.saut.position.y = c - c * Math.cos(p.r); a.saut.position.z = -c * Math.sin(p.r); },
      onComplete: () => { a.saut.rotation.x = 0; a.saut.position.set(0, 0, 0); }
    });
  }
  // saut de sa place à la place s de la lettre k (en arc, il se ramasse, il atterrit en s'écrasant)
  function sauter(j, k, s, o = {}) {
    const a = j.a, ob = a.objet, [x1, z1] = lettres[k].places[s];
    let x0 = 0, y0 = 0, z0 = 0;
    const d = Math.hypot(x1 - ob.position.x, z1 - ob.position.z);
    const haut = o.haut ?? .28 + d * .2, duree = o.duree ?? .34 + d * .12 + haut * .2, depart = j.sur;
    const p = { u: 0 };
    j.vers = [k, s];
    const tl = gsap.timeline({ delay: o.delai || 0 });
    if (d > .05) tl.to(ob.rotation, { y: () => proche(ob.rotation.y, cap(x1 - ob.position.x, z1 - ob.position.z)), duration: .16, ease: 'power2.out' }, 0);
    tl.to(a.corps.scale, { x: 1.14, y: .78, z: 1.14, duration: .12, ease: 'power2.out' }, 0)
      .call(() => { x0 = ob.position.x; y0 = ob.position.y; z0 = ob.position.z; j.sur = -1; plier(depart, .03); }, null, .12)
      .to(p, {
        u: 1, duration: duree, ease: 'none',
        onUpdate: () => { const u = p.u; ob.position.set(x0 + (x1 - x0) * u, y0 + (dessus(k) - y0) * u + 4 * haut * u * (1 - u), z0 + (z1 - z0) * u); }
      }, .12)
      .to(a.corps.scale, { x: .9, y: 1.16, z: .9, duration: .14, ease: 'power2.out' }, .12)
      .to(a.corps.scale, { x: 1, y: 1, z: 1, duration: .25, ease: 'sine.inOut' }, .26)
      .call(() => { j.sur = k; j.s = s; j.vers = null; plier(k, .045 + haut * .02); atterrissage(j); }, null, .12 + duree)
      .to(a.corps.scale, { x: 1.15, y: .8, z: 1.15, duration: .07, ease: 'power2.out' }, .12 + duree)
      .to(a.corps.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(3)' }, .19 + duree);
    if (o.salto) tl.add(salto(a, duree * .86, o.salto), .12 + duree * .06);
    return tl;
  }
  // un voisin atterrit tout près : la tortue rentre dans sa carapace, les autres sursautent un peu
  function atterrissage(j) {
    for (const v of joueurs) {
      if (v === j || v.occupe || v.sur < 0) continue;
      const d = Math.hypot(v.a.objet.position.x - j.a.objet.position.x, v.a.objet.position.z - j.a.objet.position.z);
      if (d > .75) continue;
      if (v.a.espece === 'tortue') occuper(v, seCacher(gsap, v.a, .7));
      else occuper(v, gsap.timeline().call(() => v.a.regard('surpris')).to(v.a.saut.position, { y: .12, duration: .12, ease: 'power2.out', yoyo: true, repeat: 1 }).call(() => v.a.regard('normal'), null, .7));
    }
  }
  // il se baisse : un autre lui saute par-dessus
  function baisser(j, delai) {
    if (j.occupe || j.sur < 0) return;
    occuper(j, gsap.timeline({ delay: delai })
      .call(() => j.a.regard('surpris'))
      .to(j.a.corps.scale, { y: .68, x: 1.12, z: 1.12, duration: .12, ease: 'power2.out' })
      .to(j.a.corps.scale, { y: 1, x: 1, z: 1, duration: .45, ease: 'back.out(3)' }, '+=.35')
      .call(() => j.a.regard('content'), null, '-=.2')
      .call(() => j.a.regard('normal'), null, '+=.8'));
  }
  // les places libres d'une lettre (personne dessus, personne en route)
  // (ni trop près d'un autre : on se serre moins)
  const prise = (k, s, sauf) => {
    const [x, z] = lettres[k].places[s];
    return joueurs.some(v => {
      if (v === sauf) return false;
      const c = v.vers ? lettres[v.vers[0]].places[v.vers[1]] : [v.a.objet.position.x, v.a.objet.position.z];
      return Math.hypot(c[0] - x, c[1] - z) < .5;
    });
  };
  const libres = (k, j) => lettres[k].places.map((_, s) => s).filter(s => !prise(k, s, j));
  // une place libre à moins de « portee » lettres (plus loin d'abord si loin)
  function viser(j, min, max) {
    const options = [];
    for (let d = -max; d <= max; d++) {
      const k = j.sur + d;
      if (Math.abs(d) < min || k < 0 || k >= lettres.length) continue;
      for (const s of libres(k, j)) options.push([k, s]);
    }
    return options.length ? parmi(options) : null;
  }
  // un bond vers une autre lettre ; par-dessus un voisin s'il est sur le chemin (il se baisse)
  function bondir(j, min, max, o = {}) {
    const c = viser(j, min, max);
    if (!c) return null;
    const [x1, z1] = lettres[c[0]].places[c[1]], x0 = j.a.objet.position.x, z0 = j.a.objet.position.z;
    const l = Math.hypot(x1 - x0, z1 - z0) || 1;
    const dessous = joueurs.find(v => {
      if (v === j || v.sur < 0) return false;
      const px = v.a.objet.position.x - x0, pz = v.a.objet.position.z - z0, u = (px * (x1 - x0) + pz * (z1 - z0)) / (l * l);
      return u > .12 && u < .88 && Math.abs(px * (z1 - z0) - pz * (x1 - x0)) / l < .35;
    });
    if (dessous) { o = { ...o, haut: (o.haut ?? .28 + l * .2) + .55 }; baisser(dessous, .2); }
    return sauter(j, c[0], c[1], o);
  }
  // ce qu'il fait maintenant (encore : autant de bonds d'une lettre à la suivante après, un salto au
  // dernier de temps en temps) ; une nouvelle action interrompt l'ancienne (jamais en plein vol)
  function occuper(j, tl, encore = 0) {
    lacher(j);
    j.occupe = true;
    j.tl = tl;
    tl.eventCallback('onComplete', () => {
      if (j.tl !== tl) return;
      j.tl = null;
      const b = encore > 0 && bondir(j, 1, 1, encore === 1 && Math.random() < .4 ? { salto: 1 } : {});
      if (b) { occuper(j, b, encore - 1); return; }
      j.occupe = false;
      j.prochain = t + hasard(.5, 2);
    });
  }
  function lacher(j) {
    if (!j.tl) return;
    const a = j.a;
    j.tl.kill();
    j.tl = null;
    j.vers = null;
    gsap.killTweensOf([a.corps.scale, a.saut.position, a.saut.rotation, a.etat]);
    a.corps.scale.set(1, 1, 1);
    a.saut.position.set(0, 0, 0);
    a.saut.rotation.set(0, 0, 0);
    Object.assign(a.etat, { cache: 0, assis: 0, salut: 0, remue: 0, parle: 0 });
  }

  // ---------- la balle : sur la tête de celui qui l'a, en vol entre deux têtes
  const surTete = (j, out) => j.a.tete.localToWorld(out.set(0, .4, 0));
  function passer(j) {
    const autres = joueurs.filter(r => r !== j && !r.occupe && r.sur >= 0 && (r.a.espece !== 'tortue' || Math.random() < .3));
    if (!autres.length) return false;
    const r = parmi(autres);
    const pj = j.a.objet.position, pr = r.a.objet.position;
    const d = Math.hypot(pr.x - pj.x, pr.z - pj.z), duree = .55 + d * .1, haut = .7 + d * .12;
    const p = { u: 0 }, de = new THREE.Vector3();
    occuper(r, gsap.timeline()
      .to(r.a.objet.rotation, { y: proche(r.a.objet.rotation.y, cap(pj.x - pr.x, pj.z - pr.z)), duration: .3, ease: 'power2.out' })
      .call(() => r.a.regard('content'))
      .to({}, { duration: duree + .2 })
      // il la reprend de la tête
      .to(r.a.corps.scale, { y: .85, x: 1.08, z: 1.08, duration: .06, ease: 'power2.out' })
      .to(r.a.corps.scale, { y: 1, x: 1, z: 1, duration: .3, ease: 'back.out(3)' })
      .call(() => r.a.regard('normal'), null, '+=.4'));
    occuper(j, gsap.timeline()
      .to(j.a.objet.rotation, { y: proche(j.a.objet.rotation.y, cap(pr.x - pj.x, pr.z - pj.z)), duration: .3, ease: 'power2.out' })
      .to(j.a.saut.position, { y: .16, duration: .14, ease: 'power2.out' })
      .call(() => {
        surTete(j, de);
        ballon.vol = true;
        ballon.chez = null;
        gsap.to(p, {
          u: 1, duration: duree, ease: 'none',
          onUpdate: () => { const u = p.u; surTete(r, _w); balle.position.set(de.x + (_w.x - de.x) * u, de.y + (_w.y - de.y) * u + 4 * haut * u * (1 - u), de.z + (_w.z - de.z) * u); balle.rotation.x += .25; },
          onComplete: () => { ballon.vol = false; ballon.chez = r; ballon.depuis = t; }
        });
      })
      .to(j.a.saut.position, { y: 0, duration: .2, ease: 'power2.in' }));
    return true;
  }

  // ce que chacun fait quand il a fini : selon son espèce, un peu au hasard
  function agir(j) {
    const a = j.a, x = Math.random();
    if (ballon.chez === j) {
      if (t - ballon.depuis > hasard(1, 2.4) && passer(j)) return;
      j.prochain = t + .4;
      return;
    }
    let tl = null, encore = 0;
    if (a.espece === 'lapin') { tl = x < .75 ? bondir(j, 1, 1) : bondir(j, 2, 3, { salto: 1 }); if (x < .75) encore = Math.floor(Math.random() * 3); }
    else if (a.espece === 'chat') tl = x < .45 ? bondir(j, 2, 3, { salto: Math.random() < .6 ? 1 : 0 }) : x < .75 ? bondir(j, 1, 1) : gsap.timeline().to(a.etat, { assis: 1, duration: .3 }).to(a.etat, { assis: 0, duration: .3 }, '+=2.2');
    else if (a.espece === 'chien') {
      tl = x < .35
        ? gsap.timeline().call(() => a.regard('content')).add(tournoyer(gsap, a, 1 + Math.floor(Math.random() * 2))).to(a.etat, { remue: 1, parle: 1, duration: .1 }, 0).to(a.etat, { remue: 0, parle: 0, duration: .3 }, 1).call(() => a.regard('normal'))
        : bondir(j, 1, 2);
      if (x >= .35 && x < .7) encore = 1 + Math.floor(Math.random() * 2);
    } else if (a.espece === 'bonhomme') tl = x < .45 ? bondir(j, 1, 2) : x < .7 ? bondir(j, 2, 3, { salto: Math.random() < .5 ? 1 : 0 }) : gsap.timeline().to(a.etat, { assis: 1, duration: .3 }).to(a.etat, { assis: 0, duration: .3 }, '+=2');
    else tl = x < .6 ? bondir(j, 1, 1, { haut: .2 }) : seCacher(gsap, a, 1);
    if (tl) occuper(j, tl, encore);
    else j.prochain = t + 1;
  }

  // ---------- jouer : survol d'une lettre (vague), clic sur une lettre (décollage), clic sur un animal
  const rayon = new THREE.Raycaster(), _ndc = new THREE.Vector2(), mesh = lettres.map(l => l.mesh);
  const souris = { x: 0, y: 0, dedans: false, neuf: false };
  const marque = boite.parentElement || boite;   // le curseur compagnon lit data-curseur sous la souris
  let survolee = -1;
  function toucher(cx, cy) {
    const b = toile.getBoundingClientRect();
    const mx = cx - b.left, my = cy - b.top;
    if (mx < 0 || my < 0 || mx > b.width || my > b.height) return null;
    // un animal : son ventre à l'écran, à moins de son rayon
    let choix = null, dmin = Infinity;
    for (const j of joueurs) {
      const o = j.a.objet;
      _v.set(o.position.x, o.position.y + .38, o.position.z);
      const dist = camera.position.distanceTo(_v);
      _v.project(camera);
      const sx = (_v.x + 1) / 2 * b.width, sy = (1 - _v.y) / 2 * b.height;
      const r = .42 / (dist * Math.tan(camera.fov * Math.PI / 360)) * b.height / 2;
      const dd = Math.hypot(mx - sx, my - sy);
      if (dd < r && dist < dmin) { dmin = dist; choix = j; }
    }
    if (choix) return { joueur: choix };
    _ndc.set(mx / b.width * 2 - 1, -(my / b.height) * 2 + 1);
    rayon.setFromCamera(_ndc, camera);
    const hit = rayon.intersectObjects(mesh, false)[0];
    return hit ? { lettre: hit.object.userData.k } : null;
  }
  function vague(k) {
    lettres.forEach((l, i) => {
      const d = Math.abs(i - k);
      if (d > 2 || gsap.isTweening(l.groupe.position)) return;
      gsap.timeline({ delay: d * .06 })
        .to(l.groupe.position, { y: .16 / (d + 1), duration: .2, ease: 'power2.out' })
        .to(l.groupe.position, { y: 0, duration: .9, ease: 'elastic.out(1, .35)' });
    });
  }
  // toute la lettre décolle : ceux qui sont dessus s'envolent en salto et retombent à leur place
  function catapulter(k) {
    const g = lettres[k].groupe;
    gsap.killTweensOf([g.position, g.scale]);
    gsap.timeline()
      .to(g.position, { y: -.06, duration: .08, ease: 'power2.out' }).to(g.scale, { y: .8, duration: .08, ease: 'power2.out' }, 0)
      .to(g.position, { y: .42, duration: .2, ease: 'power2.out' }).to(g.scale, { y: 1.12, duration: .2 }, '<')
      .to(g.position, { y: 0, duration: .7, ease: 'bounce.out' }).to(g.scale, { y: 1, duration: .5, ease: 'elastic.out(1, .4)' }, '<');
    joueurs.forEach(j => {
      if (j.sur !== k) return;
      occuper(j, gsap.timeline({ delay: .14 }).call(() => j.a.regard('content')).add(sauter(j, k, j.s, { haut: 1.15, duree: .9, salto: Math.random() < .5 ? 1 : -1 })).call(() => j.a.regard('normal'), null, '+=.6'));
    });
  }
  function surBouge(e) {
    souris.x = e.clientX; souris.y = e.clientY; souris.dedans = true; souris.neuf = true;
    relancer();
  }
  function surSort() { souris.dedans = false; souris.neuf = true; }
  function surClic(e) {
    if (reduit || !entre || e.target.closest?.('a, button')) return;
    const h = toucher(e.clientX, e.clientY);
    if (!h) return;
    if (h.joueur) {
      const j = h.joueur;
      if (j.sur < 0) return;
      occuper(j, gsap.timeline().add(Math.random() < .5 ? coucou(gsap, j.a) : sauter(j, j.sur, j.s, { haut: .7, duree: .6, salto: 1 })));
    } else catapulter(h.lettre);
  }
  // au survol : la lettre saute en vague ; sur un animal, le curseur dit bonjour
  function suivreSouris() {
    if (!souris.neuf) return;
    souris.neuf = false;
    const h = souris.dedans && entre && !reduit ? toucher(souris.x, souris.y) : null;
    const k = h?.lettre ?? -1;
    if (k !== survolee && k >= 0) vague(k);
    survolee = k;
    if (h) { marque.dataset.curseur = h.joueur ? textes.animal || '👋' : textes.lettre || 'Hop !'; zone.style.cursor = 'pointer'; }
    else { delete marque.dataset.curseur; zone.style.cursor = ''; }
  }
  // les yeux suivent la souris (ou la balle en vol)
  function regarder() {
    const b = toile.getBoundingClientRect();
    for (const j of joueurs) {
      const o = j.a.objet;
      if (!souris.dedans && !ballon.vol) { j.a.viser(0, 0); continue; }
      _v.set(o.position.x, o.position.y + .6, o.position.z).project(camera);
      const sx = (_v.x + 1) / 2 * b.width + b.left, sy = (1 - _v.y) / 2 * b.height + b.top;
      let tx = souris.x, ty = souris.y;
      if (ballon.vol) { _w.copy(balle.position).project(camera); tx = (_w.x + 1) / 2 * b.width + b.left; ty = (1 - _w.y) / 2 * b.height + b.top; }
      j.a.viser((tx - sx) / 260, (ty - sy) / 260);
    }
  }

  // ---------- arrivée : les lettres tombent du ciel une à une, puis les animaux atterrissent dessus
  function arriver() {
    if (entre) return;
    entre = true;
    if (reduit) return;
    const tl = gsap.timeline();
    lettres.forEach((l, i) => tl.to(l.groupe.position, { y: 0, duration: .8, ease: 'bounce.out' }, i * .07));
    joueurs.forEach((j, i) => {
      const o = j.a.objet, k = j.sur;
      j.sur = -1;
      j.occupe = true;
      o.position.y = 4;
      tl.set(o, { visible: true }, .9 + i * .16)
        .call(() => j.a.regard('surpris'), null, .9 + i * .16)
        .to(o.position, { y: () => dessus(k), duration: .5, ease: 'power2.in' }, .9 + i * .16)
        .call(() => { j.sur = k; plier(k, .07); }, null, 1.4 + i * .16)
        .fromTo(j.a.corps.scale, { x: 1.2, y: .7, z: 1.2 }, { x: 1, y: 1, z: 1, duration: .45, ease: 'back.out(3)', immediateRender: false }, 1.4 + i * .16)
        .call(() => { j.a.regard('content'); j.occupe = false; j.prochain = t + hasard(.6, 2); }, null, 1.5 + i * .16)
        .call(() => j.a.regard('normal'), null, 2.6 + i * .16);
      if (ballon.chez === j) tl.set(balle, { visible: true }, 1.4 + i * .16);
    });
  }

  // ---------- boucle : seulement à l'écran ; 60 images/s au plus
  function rendre() {
    for (const j of joueurs) {
      if (j.sur >= 0) j.a.objet.position.y = dessus(j.sur);
      j.a.vivre(reduit ? 1.234 : t);
    }
    if (ballon.chez) {
      surTete(ballon.chez, balle.position);
      balle.position.y += Math.abs(Math.sin(t * 5.5)) * .14;   // il jongle
      balle.rotation.z = Math.sin(t * 5.5) * .4;
    }
    renderer.render(scene, camera);
  }
  const actif = () => visible && !document.hidden && !detruit;
  function relancer() { if (!raf && actif()) { avant = 0; raf = requestAnimationFrame(boucle); } }
  // le nom HTML s'efface à la première image où le mot 3D se voit (en mouvement : quand il tombe)
  function peindre() {
    rendre();
    if (!premiere && (entre || reduit)) { premiere = true; surPrete?.(); }
  }
  function boucle(now) {
    raf = 0;
    if (!actif()) return;
    if (reduit) { peindre(); return; }
    raf = requestAnimationFrame(boucle);
    if (avant && now - avant < 14) return;
    const dt = avant ? Math.min(.05, (now - avant) / 1000) : 0;
    if (avant) definition(now - avant);
    avant = now;
    t += dt;
    if (entre) for (const j of joueurs) if (!j.occupe && j.sur >= 0 && t >= j.prochain) agir(j);
    suivreSouris();
    regarder();
    peindre();
  }

  // ---------- taille, visibilité, préférence, perte du contexte
  function mesurer() {
    largeur = Math.max(1, toile.clientWidth);
    hauteur = Math.max(1, toile.clientHeight);
    renderer.setSize(largeur, hauteur, false);
    cadrer();
    if (reduit) relancer();
  }
  const ro = new ResizeObserver(mesurer);
  ro.observe(toile);
  const definition = definitionAdaptative(renderer, Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5), mesurer);
  const io = new IntersectionObserver(entrees => {
    const e = entrees[entrees.length - 1];
    visible = e.isIntersecting;
    if (visible && e.intersectionRatio > .25) arriver();
    if (visible) relancer();
  }, { threshold: [0, .25, .5] });
  io.observe(toile);
  const surVisibilite = () => { if (!document.hidden) relancer(); };
  document.addEventListener('visibilitychange', surVisibilite);
  zone.addEventListener('pointermove', surBouge, { passive: true });
  zone.addEventListener('pointerleave', surSort);
  zone.addEventListener('click', surClic);
  const surPreference = () => { reduit = mq.matches; relancer(); };
  mq.addEventListener?.('change', surPreference);
  const surPerte = e => { e.preventDefault(); surPanne?.(); };
  toile.addEventListener('webglcontextlost', surPerte);
  mesurer();

  function detruire() {
    if (detruit) return;
    detruit = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', surVisibilite);
    zone.removeEventListener('pointermove', surBouge);
    zone.removeEventListener('pointerleave', surSort);
    zone.removeEventListener('click', surClic);
    zone.style.cursor = '';
    delete marque.dataset.curseur;
    mq.removeEventListener?.('change', surPreference);
    toile.removeEventListener('webglcontextlost', surPerte);
    joueurs.forEach(j => { j.tl?.kill(); gsap.killTweensOf([j.a.objet.position, j.a.objet.rotation, j.a.corps.scale, j.a.saut.position, j.a.saut.rotation, j.a.etat]); j.a.liberer(); });
    lettres.forEach(l => { gsap.killTweensOf([l.groupe.position, l.groupe.scale]); l.mesh.material.dispose(); });
    mot.geos.forEach(g => g.dispose());
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    sol.material.dispose();
    Object.values(ma).forEach(x => x.dispose());
    renderer.dispose();
    if (!toile.isConnected) { try { renderer.forceContextLoss(); } catch (_) { /* déjà perdu */ } }
  }
  return { detruire };
}
