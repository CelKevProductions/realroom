// Moteur de la scène d'accueil, chargé à la demande par PieceAccueil (three.js n'est pas dans le
// paquet initial). L'histoire suit les chapitres de la page :
//   0 (héros) : un petit immeuble pastel s'assemble étage par étage sur son île ;
//   1 (Relever) : la caméra monte le long de la façade, l'étage est découpé (le haut se soulève, les
//     façades tombent comme celles d'une maison de poupée), le plan se retrace, deux lapins entrent ;
//   2 (Aménager) : les meubles changent sous leurs pieds : surprise, un lapin tombe (étoiles), le
//     fauteuil boude, le lampadaire est sonné ;
//   3 (Visiter) : les lapins adorent leur nouvel appartement : cœurs, l'un regarde la télé, l'autre
//     arrose la plante, puis ils remercient le visiteur (bulle « Merci »).
// En avançant d'un chapitre au suivant, l'histoire se joue ; en remontant ou en sautant un chapitre,
// la scène rejoint simplement l'état du chapitre. Rendu seulement à l'écran et onglet actif ;
// mouvement réduit : l'état final de chaque chapitre, immobile.
import * as THREE from 'three';
import { initialiser, COURBES } from '@/components/mouvement/regles.js';
import { construirePiece, DISPOSITIONS, ORDRE, P } from './maquette.js';
import { construireImmeuble } from './immeuble.js';
import { matieresLapins, creerLapin, couronneEtoiles, nuageOrage, reserveCoeurs, bond, sautiller, surprise, chute, relever, cacherEtoiles } from './lapins.js';

const RAD = Math.PI / 180;
const REDUIT = '(prefers-reduced-motion: reduce)';
const borne = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lisse = t => t * t * (3 - 2 * t);
// rotation d'arrivée la plus proche de l'angle actuel (pas de tour complet)
const proche = (de, vers) => de + Math.atan2(Math.sin(vers - de), Math.cos(vers - de));
const ECRASE = { x: 1.03, y: .93, z: 1.03 };   // amorti à la pose d'un meuble

// caméra : point visé (cx, cy, cz), direction depuis ce point (az : de +z vers +x, el : au-dessus de
// l'horizon, en degrés), cadre à faire tenir (rx × ry, m) ou distance fixe (d, m), champ vertical (fov)
const CAM = {
  immeuble: { az: 36, el: 15, rx: 5.4, ry: 6.9, d: 0, cx: .2, cy: .1, cz: .2, fov: 30 },
  rue: { az: 26, el: 5, rx: 3.5, ry: 3, d: 0, cx: 0, cy: -4.1, cz: .4, fov: 30 },
  facade: { az: 30, el: 9, rx: 3.6, ry: 3.1, d: 0, cx: 0, cy: 1.3, cz: .2, fov: 30 },
  plan: { az: 0, el: 89.3, rx: 3.15, ry: 2.65, d: 0, cx: .29, cy: 0, cz: .31, fov: 30 },
  amenager: { az: 26, el: 42, rx: 3.55, ry: 2.9, d: 0, cx: 0, cy: .55, cz: 0, fov: 30 },
  vie: { az: 38, el: 30, rx: 3.25, ry: 2.6, d: 0, cx: -.15, cy: .5, cz: .1, fov: 30 }
};
// 0 immeuble, 1 Relever, 2 Aménager, 3 Visiter
// cotesA : cotes visibles ; grille ; mursA : murs pleins (1) ou réduits à leurs arêtes ; coupe : immeuble
// découpé (0 fermé, 1 ouvert) ; tele : écran allumé ; rotW, travW, scanW : tour lent, travelling, balayage
const CHAPITRES = [
  { cam: CAM.immeuble, dispo: 'A', etat: { cotesA: 0, grille: 0, mursA: 1, coupe: 0, tele: 0, rotW: 1, travW: 0, scanW: 0 } },
  { cam: CAM.plan, dispo: 'A', etat: { cotesA: 1, grille: 1, mursA: .07, coupe: 1, tele: 0, rotW: 0, travW: 0, scanW: 1 } },
  { cam: CAM.amenager, dispo: 'B', etat: { cotesA: 0, grille: .6, mursA: 1, coupe: 1, tele: 0, rotW: 0, travW: 0, scanW: 0 } },
  { cam: CAM.vie, dispo: 'B', etat: { cotesA: 0, grille: .25, mursA: 1, coupe: 1, tele: 1, rotW: .45, travW: 0, scanW: 0 } }
];
// où se tiennent les lapins à la fin de chaque chapitre (x, z, y, orientation, regard…) ; 0 : pas encore là
const FACE = 38 * RAD;   // vers la caméra du chapitre 3
const POSES = [
  null,
  [{ x: -1.05, z: .8, r: .6 }, { x: -.25, z: 1.4, r: .25 }],
  [{ x: -1.2, z: .55, r: .6, regard: 'etourdi', etoiles: true }, { x: -.55, z: 1.25, r: -2.2 }],
  [{ x: .22, z: -.3, y: .5, r: -Math.PI / 2, assis: true }, { x: 1.62, z: 1.18, r: .9, arrose: 1 }]
];
const PORTE = { x: -2.8, z: 1.25 };
const ECRAN = ['#BFD8F5', '#FFD3BD', '#DCD5F6', '#C5DDC9', '#FFE9A6'].map(c => new THREE.Color(c));
const NOIR = new THREE.Color('#2E2A33');
const TRACE_FINI = { sol: 1, plan: 1, ouv: 1, cotes: 1, murs: 1 };
const BALAYAGE = { passe: 2.8, cycle: 3.5 };   // secondes

// ombre ronde et douce sous un lapin
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

export function creerPiece({ toile, boite, bulle, lang = 'fr', chapitre = 0, surPrete, surPanne }) {
  const gsap = initialiser();
  const mq = matchMedia(REDUIT);
  let reduit = mq.matches;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, powerPreference: 'default' });
  let piece, im, ml;
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
    renderer.setClearColor(0x000000, 0);
    piece = construirePiece({ lang, anisotropie: Math.min(4, renderer.capabilities.getMaxAnisotropy()) });
    im = construireImmeuble({ arete: piece.m.arete });
    ml = matieresLapins();
  } catch (e) {
    renderer.dispose();
    throw e;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 120);
  // lumière douce : ciel blanc, rebond pêche, un soleil d'avant droit (pas de carte d'ombres)
  scene.add(new THREE.HemisphereLight('#fffaf4', '#e9cdbd', .8 * Math.PI));
  const soleil = new THREE.DirectionalLight('#ffffff', .62 * Math.PI);
  soleil.position.set(3.5, 6, 4.5);
  scene.add(soleil);
  const { m, meubles } = piece;

  // l'étage de la pièce : la maquette, ses deux façades et ses habitants, posés ensemble dans l'immeuble
  const etagePiece = new THREE.Group();
  etagePiece.add(piece.groupe, im.groupeCoque);
  scene.add(im.groupe, etagePiece);

  // les lapins
  const tOmbre = texOmbreRonde();
  const lapins = [creerLapin(ml, { accessoire: 'echarpe', graine: 0 }), creerLapin(ml, { accessoire: 'noeud', graine: 1 })];
  lapins.forEach(l => {
    l.objet.rotation.order = 'YXZ';   // la chute (x) se fait dans le sens du regard
    const o = new THREE.Mesh(new THREE.PlaneGeometry(.42, .42).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tOmbre, transparent: true, opacity: .32, depthWrite: false }));
    o.position.y = .012;
    o.renderOrder = 1;
    l.objet.add(o);
    l.ombre = o;
    l.objet.visible = false;
    piece.groupe.add(l.objet);
  });
  const [l1, l2] = lapins;
  const coeurs = reserveCoeurs(ml);
  piece.groupe.add(coeurs.groupe);
  // humeurs des meubles : le fauteuil boude (nuage d'orage), le lampadaire est sonné (étoiles)
  const orage = nuageOrage(ml);
  orage.position.y = 1.1;
  meubles.fauteuil.objet.add(orage);
  const sonne = couronneEtoiles(ml, .24, 5);
  sonne.position.y = 1.78;
  meubles.lampadaire.objet.add(sonne);

  // état animé (GSAP)
  const etat = { sol: 1, plan: 1, ouv: 1, cotes: 1, cotesA: 0, grille: 0, murs: 1, mursA: 1, coupe: 0, tele: 0, rotW: 0, travW: 0, scanW: 0, bulle: 0 };
  const cam = { ...CAM.immeuble };
  const tps = { rot: 0, trav: 0, scan: 0 };   // origine des mouvements lents
  let dispo = null, courant = -1, voulu = chapitre, introFaite = false, introTl = null, histoire = null;
  let raf = 0, avant = 0, t = 0, sale = true, detruit = false, premiere = false, visible = true;
  let largeur = 1, hauteur = 1, px = 0, py = 0, vx = 0, vy = 0;

  // ---------- agencement des meubles
  function objets() { return ORDRE.flatMap(id => { const o = meubles[id].objet; return [o, o.position, o.rotation, o.scale]; }); }
  function tuer() { gsap.killTweensOf([cam, etat, ...objets()]); }

  // passage d'un agencement à l'autre : chaque meuble se soulève, glisse et retombe (en cascade)
  function disposer(nom, instant) {
    dispo = nom;
    ORDRE.forEach((id, i) => {
      const o = meubles[id].objet, [x, z, r] = DISPOSITIONS[nom][id];
      gsap.killTweensOf([o.position, o.rotation, o.scale]);
      if (instant) { o.position.set(x, 0, z); o.rotation.set(0, r, 0); o.scale.set(1, 1, 1); return; }
      const haut = id === 'tapis' ? .22 : .5 + (i % 3) * .1;
      gsap.timeline({ delay: i * .045, onUpdate: marquer })
        .to(o.position, { y: haut, duration: .34, ease: 'power2.out' }, 0)
        .to(o.position, { x, z, duration: .66, ease: COURBES.pivot }, .04)
        .to(o.rotation, { y: proche(o.rotation.y, r), duration: .66, ease: COURBES.pivot }, .04)
        .to(o.position, { y: 0, duration: .36, ease: 'power2.in' }, .5)
        .fromTo(o.scale, { ...ECRASE }, { x: 1, y: 1, z: 1, duration: .32, ease: 'power2.out', immediateRender: false }, .86);
    });
  }
  // le fauteuil boude, le lampadaire est sonné, puis tout se calme
  function bouder() {
    const f = meubles.fauteuil.objet, lp = meubles.lampadaire.objet;
    return gsap.timeline({ onUpdate: marquer })
      .set(orage, { visible: true }, 0)
      .to(orage.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(3)' }, 0)
      .to(orage.position, { y: 1.18, duration: .25, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0)
      .to(f.rotation, { z: .07, duration: .06, yoyo: true, repeat: 9, ease: 'sine.inOut' }, .1)
      .set(f.rotation, { z: 0 }, .7)
      .to(orage.scale, { x: .001, y: .001, z: .001, duration: .3, ease: 'power2.in' }, 2.1)
      .set(orage, { visible: false }, 2.4)
      .set(sonne, { visible: true }, .2)
      .to(sonne.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(3)' }, .2)
      .to(lp.rotation, { z: .14, duration: .22, yoyo: true, repeat: 7, ease: 'sine.inOut' }, .2)
      .to(lp.rotation, { x: .1, duration: .3, yoyo: true, repeat: 5, ease: 'sine.inOut' }, .3)
      .to(lp.rotation, { x: 0, z: 0, duration: .3 }, 2.1)
      .to(sonne.scale, { x: .001, y: .001, z: .001, duration: .3, ease: 'power2.in' }, 2.3)
      .set(sonne, { visible: false }, 2.6);
  }
  function calmer() {
    gsap.killTweensOf([orage, orage.scale, orage.position, sonne, sonne.scale, meubles.fauteuil.objet.rotation, meubles.lampadaire.objet.rotation]);
    orage.visible = sonne.visible = false;
    orage.scale.setScalar(.001); sonne.scale.setScalar(.001); orage.position.y = 1.1;
    meubles.fauteuil.objet.rotation.z = 0;
    meubles.lampadaire.objet.rotation.x = meubles.lampadaire.objet.rotation.z = 0;
  }

  // ---------- lapins : pose de fin de chapitre
  function tuerLapins() {
    lapins.forEach(l => {
      gsap.killTweensOf([l.objet, l.objet.position, l.objet.rotation, l.corps.scale, l.tete.rotation, l.etat, l.etoiles, l.etoiles.scale, l.alerte, l.alerte.scale, l.alerte.rotation]);
      l.alerte.visible = false; l.alerte.scale.setScalar(.001);
    });
  }
  function poserLapins(n) {
    tuerLapins();
    lapins.forEach((l, i) => {
      const p = POSES[n]?.[i];
      l.objet.visible = !!p;
      if (!p) return;
      l.objet.position.set(p.x, p.y || 0, p.z);
      l.objet.rotation.set(0, p.r, 0);
      l.objet.userData.sol = p.y || 0;
      l.corps.scale.set(p.assis ? 1.05 : 1, p.assis ? .9 : 1, p.assis ? 1.05 : 1);
      l.tete.rotation.set(0, 0, 0);
      l.regard(p.regard || 'normal');
      l.etoiles.visible = !!p.etoiles;
      l.etoiles.scale.setScalar(p.etoiles ? 1 : .001);
      l.etat.salut = 0;
      l.etat.arrose = p.arrose || 0;
    });
  }
  // rejoindre la pose du chapitre par un bond (ou disparaître)
  function rejoindreLapins(n, tl, debut = 0) {
    lapins.forEach((l, i) => {
      const p = POSES[n]?.[i];
      if (!p) { tl.call(() => { l.objet.visible = false; }, null, debut + .4); return; }
      tl.call(() => {
        tuerLapinSeul(l);
        if (!l.objet.visible) {
          // arrivée directe (chapitre sauté) : il apparaît à sa place
          l.objet.visible = true;
          l.objet.position.set(p.x, p.y || 0, p.z);
          l.objet.rotation.set(0, p.r, 0);
          gsap.fromTo(l.objet.scale, { x: .001, y: .001, z: .001 }, { x: 1, y: 1, z: 1, duration: .45, ease: 'back.out(2)', onUpdate: marquer });
        }
        l.regard(p.regard || 'normal');
        l.etoiles.visible = !!p.etoiles;
        l.etoiles.scale.setScalar(p.etoiles ? 1 : .001);
        l.etat.salut = 0;
        gsap.to(l.etat, { arrose: p.arrose || 0, duration: .3 });
        gsap.to(l.objet.rotation, { x: 0, duration: .3 });
        gsap.to(l.corps.scale, { x: p.assis ? 1.05 : 1, y: p.assis ? .9 : 1, z: p.assis ? 1.05 : 1, duration: .3 });
        const b = bond(gsap, l, p.x, p.z, { y: p.y || 0, hauteur: .25, duree: .5 });
        b.eventCallback('onComplete', () => { l.objet.userData.sol = p.y || 0; gsap.to(l.objet.rotation, { y: proche(l.objet.rotation.y, p.r), duration: .3, onUpdate: marquer }); });
      }, null, debut + i * .12);
    });
  }
  function tuerLapinSeul(l) {
    gsap.killTweensOf([l.objet.position, l.objet.rotation, l.corps.scale, l.tete.rotation, l.etat]);
  }

  // ---------- bulle « Merci » (HTML, au-dessus des lapins)
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  function montrerBulle(oui) {
    etat.bulle = oui ? 1 : 0;
    if (bulle) bulle.classList.toggle('is-visible', oui);
    marquer();
  }
  function placerBulle() {
    if (!bulle || !etat.bulle) return;
    l1.tete.getWorldPosition(_v);
    l2.tete.getWorldPosition(_w);
    _v.add(_w).multiplyScalar(.5);
    _v.y += .62;
    _v.project(camera);
    const x = (_v.x + 1) / 2 * largeur, y = (1 - _v.y) / 2 * hauteur;
    bulle.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  // ---------- chapitres
  // caméra et état du chapitre n (tween), sans les lapins
  function versChapitre(n, duree = 1.2, sauf = []) {
    const c = CHAPITRES[n], e = { ...c.etat };
    sauf.forEach(k => delete e[k]);
    return gsap.timeline()
      .to(cam, { ...c.cam, duration: duree, ease: COURBES.pivot }, 0)
      .to(etat, { ...e, duration: duree, ease: 'power2.inOut' }, 0);
  }
  // état final d'un chapitre, sans animation
  function poser(n) {
    const c = CHAPITRES[n];
    gsap.killTweensOf([cam, etat]);
    Object.assign(cam, c.cam);
    Object.assign(etat, TRACE_FINI, c.etat);
    disposer(c.dispo, true);
    calmer();
    poserLapins(n);
    montrerBulle(n === 3 && reduit);
    marquer();
  }

  // 0 → 1 : on monte le long de la façade, l'étage est découpé, le plan se retrace, les lapins entrent
  function decouper() {
    poserLapins(0);
    const tl = gsap.timeline({ onUpdate: marquer });
    tl.to(etat, { rotW: 0, duration: .8, ease: 'power1.inOut' }, 0)
      .to(cam, { ...CAM.rue, duration: .8, ease: 'power2.inOut' }, 0)
      .to(cam, { ...CAM.facade, duration: 1.1, ease: 'power1.inOut' }, .8)
      .to(etat, { coupe: 1, duration: 1.9, ease: 'none' }, 1.6)
      .to(cam, { ...CAM.plan, duration: 1.3, ease: COURBES.pivot }, 3.2)
      .fromTo(etat, { plan: 0, ouv: 0, cotes: 0 }, { plan: 1, ouv: 1, cotes: 1, duration: 1.3, ease: 'power1.inOut', immediateRender: false }, 3.4)
      .to(etat, { cotesA: 1, grille: 1, mursA: .07, duration: 1, ease: 'power2.inOut' }, 3.3)
      .to(etat, { scanW: 1, duration: .6 }, 4.6)
      .call(() => { tps.scan = t; }, null, 4.6);
    lapins.forEach((l, i) => {
      const p = POSES[1][i], d = 4.2 + i * .35;
      // à la porte (encore cachés) avant de construire leurs bonds, qui partent de là
      l.objet.position.set(PORTE.x, 0, PORTE.z);
      l.objet.rotation.set(0, Math.PI / 2, 0);
      l.objet.userData.sol = 0;
      tl.call(() => {
        l.objet.visible = true;
        l.objet.position.set(PORTE.x, 0, PORTE.z);
        l.regard('normal');
      }, null, d)
        .add(sautiller(gsap, l, [[-2.05, PORTE.z], [p.x, p.z]]), d)
        .to(l.objet.rotation, { y: () => proche(l.objet.rotation.y, p.r), duration: .3 }, d + 2)
        // il regarde autour de lui
        .to(l.tete.rotation, { z: i ? -.22 : .22, duration: .3, ease: 'sine.inOut' }, d + 2.3)
        .to(l.tete.rotation, { z: 0, duration: .3, ease: 'sine.inOut' }, d + 2.9);
    });
    return tl;
  }

  // 1 → 2 : les meubles changent sous leurs pieds
  function demenager() {
    poserLapins(1);
    calmer();
    const tl = gsap.timeline({ onUpdate: marquer });
    tl.add(versChapitre(2, 1.4), 0)
      .call(() => disposer('B', false), null, .15)
      .add(surprise(gsap, l1), .05)
      .add(surprise(gsap, l2), .14)
      // le tapis arrive sous le premier lapin : il tombe à la renverse
      .add(chute(gsap, l1, -.15, -.25), .75)
      .add(bouder(), 1.35)
      // l'autre se baisse quand le canapé passe, puis court l'aider
      .to(l2.corps.scale, { y: .72, x: 1.12, z: 1.12, duration: .12, yoyo: true, repeat: 1 }, .62)
      .add(sautiller(gsap, l2, [[POSES[2][1].x, POSES[2][1].z]]), 1.7)
      .to(l2.objet.rotation, { y: () => proche(l2.objet.rotation.y, POSES[2][1].r), duration: .3 }, 2.2)
      .add(relever(gsap, l1, { garderEtoiles: true }), 2.7)
      .to(l1.objet.rotation, { y: () => proche(l1.objet.rotation.y, POSES[2][0].r), duration: .3 }, 3.7);
    return tl;
  }

  // 2 → 3 : ils adorent leur nouvel appartement, puis remercient le visiteur
  function emmenager() {
    poserLapins(2);
    const tl = gsap.timeline({ onUpdate: marquer });
    const [p1, p2] = POSES[3];
    tl.add(versChapitre(3, 1.6, ['tele']), 0)
      .add(cacherEtoiles(gsap, l1), .2)
      .call(() => { l1.regard('content'); l2.regard('content'); }, null, .45)
      .call(() => coeurs.jaillir(gsap, l1.objet.position.x, .75, l1.objet.position.z, 4, marquer), null, .55)
      .call(() => coeurs.jaillir(gsap, l2.objet.position.x, .75, l2.objet.position.z, 3, marquer), null, .75)
      .add(bond(gsap, l1, POSES[2][0].x, POSES[2][0].z, { hauteur: .22, tourne: false }), .6)
      .add(bond(gsap, l2, POSES[2][1].x, POSES[2][1].z, { hauteur: .22, tourne: false }), .7)
      .add(bond(gsap, l1, POSES[2][0].x, POSES[2][0].z, { hauteur: .22, tourne: false }), 1)
      .add(bond(gsap, l2, POSES[2][1].x, POSES[2][1].z, { hauteur: .22, tourne: false }), 1.1)
      .call(() => { l1.regard('normal'); l2.regard('normal'); }, null, 1.5)
      // le premier saute sur le canapé et allume la télé
      .add(sautiller(gsap, l1, [[-.45, .3]]), 1.6)
      .add(bond(gsap, l1, p1.x, p1.z, { y: p1.y, hauteur: .32, duree: .5 }), 2.75)
      .call(() => { l1.objet.userData.sol = p1.y; }, null, 3.25)
      .to(l1.objet.rotation, { y: () => proche(l1.objet.rotation.y, p1.r), duration: .35 }, 3.3)
      .to(l1.corps.scale, { y: .9, x: 1.05, z: 1.05, duration: .25 }, 3.35)
      .to(etat, { tele: 1, duration: .6 }, 3.6)
      // le second va arroser la plante, qui fait des cœurs
      .add(sautiller(gsap, l2, [[.6, 1.55], [p2.x, p2.z]]), 1.7)
      .to(l2.objet.rotation, { y: () => proche(l2.objet.rotation.y, p2.r), duration: .3 }, 4)
      .to(l2.etat, { arrose: 1, duration: .5 }, 4.2)
      .call(() => coeurs.jaillir(gsap, 2.1, 1.1, 1.55, 2, marquer), null, 5.1)
      // merci !
      .to(l2.etat, { arrose: 0, duration: .3 }, 6.1)
      .to(l1.objet.rotation, { y: () => proche(l1.objet.rotation.y, FACE), duration: .4 }, 6.1)
      .to(l2.objet.rotation, { y: () => proche(l2.objet.rotation.y, FACE), duration: .4 }, 6.2)
      .call(() => { l1.regard('content'); l2.regard('content'); }, null, 6.3)
      .to([l1.etat, l2.etat], { salut: 1, duration: .3 }, 6.45)
      .call(() => montrerBulle(true), null, 6.5)
      .call(() => coeurs.jaillir(gsap, (l1.objet.position.x + l2.objet.position.x) / 2, 1.1, (l1.objet.position.z + l2.objet.position.z) / 2, 3, marquer), null, 6.7)
      .to([l1.etat, l2.etat], { salut: 0, duration: .3 }, 9.4)
      .call(() => { montrerBulle(false); l1.regard('normal'); l2.regard('normal'); }, null, 9.8)
      .to(l1.objet.rotation, { y: () => proche(l1.objet.rotation.y, p1.r), duration: .4 }, 9.8)
      .to(l2.objet.rotation, { y: () => proche(l2.objet.rotation.y, p2.r), duration: .4 }, 9.9)
      .to(l2.etat, { arrose: 1, duration: .5 }, 10.3);
    return tl;
  }

  // autre passage (on remonte, ou on saute un chapitre) : la scène rejoint l'état du chapitre
  function rejoindre(n) {
    const c = CHAPITRES[n];
    calmer();
    montrerBulle(false);
    if (n === 0) tps.rot = t;
    if (n === 1) tps.scan = t;
    const tl = gsap.timeline({ onUpdate: marquer });
    tl.add(versChapitre(n, n === 0 ? 1.6 : 1.2), 0);
    if (c.dispo !== dispo) tl.call(() => disposer(c.dispo, false), null, .1);
    rejoindreLapins(n, tl, n === 0 ? 0 : .3);
    return tl;
  }

  function aller(n, instant) {
    const de = courant;
    courant = n;
    if (histoire) { histoire.kill(); histoire = null; }
    if (instant) { poser(n); return; }
    if (de === 0 && n === 1) histoire = decouper();
    else if (de === 1 && n === 2) histoire = demenager();
    else if (de === 2 && n === 3) histoire = emmenager();
    else histoire = rejoindre(n);
  }
  // état final sans animation (mouvement réduit)
  function toutDeSuite(n) {
    if (introTl) { introTl.kill(); introTl = null; }
    if (histoire) { histoire.kill(); histoire = null; }
    tuer();
    introFaite = true;
    [im.socle, im.rdc, im.premier, etagePiece, im.dernier, im.sommet].forEach(o => o.position.set(0, 0, 0));
    im.socle.scale.set(1, 1, 1);
    courant = n;
    poser(n);
  }

  // intro : l'île apparaît, puis les étages tombent l'un sur l'autre
  function intro() {
    if (introFaite || introTl || detruit) return;
    if (reduit) { toutDeSuite(voulu); return; }
    tps.rot = t;
    const tl = gsap.timeline({ onUpdate: marquer, onComplete: finIntro });
    tl.fromTo(im.socle.scale, { x: .001, y: .001, z: .001 }, { x: 1, y: 1, z: 1, duration: .8, ease: 'back.out(1.7)' }, 0)
      .fromTo(cam, { az: 14, el: 6 }, { az: CAM.immeuble.az, el: CAM.immeuble.el, duration: 2.6, ease: 'power2.inOut' }, 0);
    [im.rdc, im.premier, etagePiece, im.dernier, im.sommet].forEach((n, i) => {
      tl.fromTo(n.position, { y: 9 }, { y: 0, duration: .75, ease: 'bounce.out' }, .35 + i * .3);
    });
    tl.to(etat, { rotW: 1, duration: 1.4, ease: 'power1.inOut' }, 2.2);
    introTl = tl;
  }
  function finIntro() {
    introTl = null;
    introFaite = true;
    courant = 0;
    if (voulu !== 0) aller(voulu, reduit);
  }
  function choisir(n) {
    if (detruit) return;
    voulu = n;
    if (!introFaite) {
      // on fait défiler pendant l'intro : elle s'achève vite, puis la scène rejoint le chapitre
      if (n !== 0) { intro(); introTl?.timeScale(3); }
      return;
    }
    if (n !== courant) aller(n, reduit);
  }

  // ---------- rendu
  function tracer(ligne, f) {
    ligne.visible = f > 0;
    ligne.geometry.setDrawRange(0, Math.round(borne(f) * ligne.userData.n) * 2);
  }
  function placer() {
    const asp = largeur / hauteur;
    const phR = 2 * Math.PI * (t - tps.rot) / 26, phT = 2 * Math.PI * (t - tps.trav) / 22;
    const az = (cam.az + etat.rotW * 9 * Math.sin(phR) + etat.travW * 4 * Math.sin(phT) + px * 3) * RAD;
    const el = borne(cam.el - py * 3, -5, 89.4) * RAD;
    const tv = Math.tan(cam.fov * RAD / 2);
    const cadre = Math.max(cam.ry / tv, cam.rx / (tv * asp));
    const lat = etat.travW * .6 * Math.sin(phT);
    const dist = Math.max(.4, cam.d + cadre - etat.travW * .3 * (1 - Math.cos(phT)) / 2);
    const cx = cam.cx + lat * Math.cos(az), cz = cam.cz - lat * Math.sin(az);
    camera.fov = cam.fov;
    camera.aspect = asp;
    camera.updateProjectionMatrix();
    camera.position.set(cx + dist * Math.sin(az) * Math.cos(el), cam.cy + dist * Math.sin(el), cz + dist * Math.cos(az) * Math.cos(el));
    camera.lookAt(cx, cam.cy, cz);
  }
  function balayer() {
    const b = piece.balayage;
    const p = reduit ? .62 : ((t - tps.scan) % BALAYAGE.cycle) / BALAYAGE.passe;
    if (etat.scanW < .002 || p > 1) { b.visible = false; return; }
    const tete = -P / 2 + P * p, queue = Math.min(.75, tete + P / 2);
    const a = etat.scanW * Math.min(1, p / .04, (1 - p) / .1);
    piece.trainee.scale.z = Math.max(.001, queue);
    piece.trainee.position.z = tete - queue / 2;
    piece.ligne.position.z = tete;
    piece.trainee.material.opacity = piece.ligne.material.opacity = a;
    b.visible = true;
  }
  // découpe de l'étage : trait corail, le haut se soulève, les façades tombent puis s'effacent
  function decoupe() {
    const c = etat.coupe;
    const trait = borne(c / .15) * (1 - borne((c - .4) / .2));
    im.trait.visible = trait > .01;
    im.matCoupe.opacity = trait;
    im.trait.scale.set(.8 + .2 * lisse(borne(c / .2)), 1, .8 + .2 * lisse(borne(c / .2)));
    const leve = lisse(borne((c - .15) / .45));
    im.dessus.position.set(leve * 1.2, leve * 10, -leve * .6);
    im.dessus.rotation.z = leve * .1;
    im.dessus.visible = leve < .995;
    // chute avec un petit rebond à l'arrivée
    const x = borne((c - .4) / .4);
    const angle = x < .78 ? Math.pow(x / .78, 2) * Math.PI / 2 : Math.PI / 2 - Math.sin((x - .78) / .22 * Math.PI) * .1;
    im.coque.avant.rotation.x = angle;
    im.coque.droite.rotation.z = -angle;
    const efface = 1 - lisse(borne((c - .82) / .18));
    im.coque.avant.scale.setScalar(Math.max(.001, efface));
    im.coque.droite.scale.setScalar(Math.max(.001, efface));
    im.groupeCoque.visible = efface > .002;
    // la cheminée de l'immeuble entier ne se voit plus quand on est dans la pièce : l'île reste en bas
  }
  function ecran() {
    if (etat.tele < .002) { m.ecran.color.copy(NOIR); m.ecran.emissive?.setScalar(0); return; }
    const k = Math.floor(t / .9) % ECRAN.length, scint = .86 + .14 * Math.sin(t * 23) * Math.sin(t * 7.3);
    m.ecran.color.copy(NOIR).lerp(ECRAN[k], etat.tele * scint);
    m.ecran.emissive?.copy(ECRAN[k]).multiplyScalar(.35 * etat.tele);
  }
  function rendre(dt = 0) {
    placer();
    tracer(piece.contours, etat.plan);
    tracer(piece.ouvertures, etat.ouv);
    tracer(piece.cotes, etat.cotes);
    m.cote.opacity = .8 * etat.cotesA;
    const ea = etat.cotesA * lisse(borne((etat.cotes - .5) / .5));
    piece.etiquettes.forEach(e => { e.material.opacity = ea; e.visible = ea > .002; });
    m.grille.opacity = .085 * etat.grille;
    m.sol.opacity = m.socle.opacity = etat.sol;
    m.areteSocle.opacity = .5 * etat.sol;
    piece.socle.visible = etat.sol > .002;
    piece.murs.visible = etat.murs > .002;
    piece.murs.scale.y = Math.max(.002, etat.murs);
    m.mur.opacity = etat.mursA;
    m.mur.depthWrite = etat.mursA > .97;
    m.ao.opacity = etat.murs * etat.mursA;
    balayer();
    decoupe();
    ecran();
    im.vivre(t);
    // ombre de contact : reste au sol, s'élargit et pâlit quand le meuble est en l'air
    for (const id of ORDRE) {
      const { objet: o, ombre } = meubles[id];
      if (!ombre) continue;
      const h = Math.max(0, o.position.y), s = 1 + h * .6;
      ombre.position.y = -o.position.y / (o.scale.y || 1);
      ombre.scale.set(s, 1, s);
      ombre.material.opacity = ombre.userData.base * (1 - borne(h / 1.2));
    }
    for (const l of lapins) {
      if (!l.objet.visible) continue;
      if (!reduit) l.vivre(t, dt);
      const h = Math.max(0, l.objet.position.y - (l.objet.userData.sol || 0));
      l.ombre.position.y = .012 - h;
      l.ombre.scale.setScalar(1 + h * .8);
      l.ombre.material.opacity = .32 * (1 - borne(h / .6));
      l.ombre.visible = Math.abs(l.objet.rotation.x) < .3;
    }
    placerBulle();
    renderer.render(scene, camera);
    if (!premiere) { premiere = true; surPrete?.(); }
  }

  // ---------- boucle : seulement à l'écran, onglet actif ; 60 images/s au plus ; rien si rien ne bouge
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
    const glisse = Math.abs(vx - px) + Math.abs(vy - py) > .002;
    // la scène vit en continu (nuages, lapins, télé) : on rend chaque image tant qu'elle est à l'écran
    sale = false;
    rendre(dt, glisse);
  }

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
    if (reduit) { vx = vy = px = py = 0; toutDeSuite(voulu); }
    else relancer();
  };
  mq.addEventListener?.('change', surPreference);
  const surPerte = e => { e.preventDefault(); surPanne?.(); };
  toile.addEventListener('webglcontextlost', surPerte);
  // la police des cotes peut arriver après coup
  document.fonts?.load?.('600 88px "DM Sans Variable"').then(() => {
    if (detruit) return;
    piece.redessiner();
    marquer();
  }).catch(() => {});

  // ---------- départ : immeuble assemblé hors champ (les étages tombent à l'intro), agencement A
  disposer('A', true);
  poserLapins(0);
  calmer();
  if (m.ecran.emissive === undefined) m.ecran.emissive = new THREE.Color(0);
  if (reduit) toutDeSuite(voulu);
  else {
    im.socle.scale.setScalar(.001);
    [im.rdc, im.premier, etagePiece, im.dernier, im.sommet].forEach(o => { o.position.y = 40; });
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
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', surVisibilite);
    removeEventListener('pointermove', surPointeur);
    document.documentElement.removeEventListener('pointerleave', surSortie);
    mq.removeEventListener?.('change', surPreference);
    toile.removeEventListener('webglcontextlost', surPerte);
    if (introTl) introTl.kill();
    introTl = null;
    if (histoire) histoire.kill();
    histoire = null;
    tuer();
    tuerLapins();
    piece.liberer();
    im.liberer();
    coeurs.liberer();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    Object.values(ml).forEach(x => x.dispose());
    tOmbre.dispose();
    renderer.dispose();
    if (!toile.isConnected) { try { renderer.forceContextLoss(); } catch (_) { /* déjà perdu */ } }
  }

  return { intro, chapitre: choisir, detruire };
}
