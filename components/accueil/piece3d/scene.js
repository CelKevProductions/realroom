// Moteur de la pièce d'accueil, chargé à la demande par PieceAccueil (three.js n'est pas dans le
// paquet initial). Une intro (le plan se trace, les murs montent, les meubles tombent), puis quatre
// états de chapitre animés avec GSAP. Rendu seulement à l'écran et onglet actif, et seulement quand
// quelque chose bouge ; mouvement réduit : la pièce finale, immobile, changements instantanés.
import * as THREE from 'three';
import { initialiser, COURBES } from '@/components/mouvement/regles.js';
import { construirePiece, DISPOSITIONS, ORDRE, P } from './maquette.js';

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
  plan: { az: 0, el: 89.3, rx: 3.15, ry: 2.65, d: 0, cx: .29, cy: 0, cz: .31, fov: 30 },
  heros: { az: 38, el: 30, rx: 3.2, ry: 2.7, d: 0, cx: .05, cy: .8, cz: .05, fov: 30 },
  amenager: { az: 26, el: 42, rx: 3.15, ry: 2.75, d: 0, cx: 0, cy: .55, cz: 0, fov: 30 },
  // à hauteur d'œil : 1,15 + 3,4 × sin 7° ≈ 1,6 m
  visite: { az: 48, el: 7, rx: 0, ry: 0, d: 3.4, cx: -1.2, cy: 1.15, cz: -1, fov: 52 }
};
// 0 héros, 1 Relever, 2 Aménager, 3 Visiter
// cotesA : cotes visibles ; grille ; mursA : murs pleins (1) ou réduits à leurs arêtes ;
// rotW, travW, scanW : poids du tour lent, du travelling et du balayage
const CHAPITRES = [
  { cam: CAM.heros, dispo: 'A', etat: { cotesA: 0, grille: .5, mursA: 1, rotW: 1, travW: 0, scanW: 0 } },
  { cam: CAM.plan, dispo: 'A', etat: { cotesA: 1, grille: 1, mursA: .07, rotW: 0, travW: 0, scanW: 1 } },
  { cam: CAM.amenager, dispo: 'B', etat: { cotesA: 0, grille: .6, mursA: 1, rotW: 0, travW: 0, scanW: 0 } },
  { cam: CAM.visite, dispo: 'B', etat: { cotesA: 0, grille: .3, mursA: 1, rotW: 0, travW: 1, scanW: 0 } }
];
const TRACE_FINI = { sol: 1, plan: 1, ouv: 1, cotes: 1, murs: 1 };
const BALAYAGE = { passe: 2.8, cycle: 3.5 };   // secondes

export function creerPiece({ toile, boite, lang = 'fr', chapitre = 0, surPrete, surPanne }) {
  const gsap = initialiser();
  const mq = matchMedia(REDUIT);
  let reduit = mq.matches;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, powerPreference: 'default' });
  let piece;
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
    renderer.setClearColor(0x000000, 0);
    piece = construirePiece({ lang, anisotropie: Math.min(4, renderer.capabilities.getMaxAnisotropy()) });
  } catch (e) {
    renderer.dispose();
    throw e;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 80);
  // lumière douce : ciel blanc, rebond papier, un soleil d'avant droit (pas de carte d'ombres)
  scene.add(new THREE.HemisphereLight('#ffffff', '#cdc9bf', .78 * Math.PI));
  const soleil = new THREE.DirectionalLight('#ffffff', .62 * Math.PI);
  soleil.position.set(3.5, 6, 4.5);
  scene.add(soleil, piece.groupe);
  const { m, meubles } = piece;

  // état animé (GSAP) ; avant l'intro, rien n'est tracé
  const etat = { sol: 0, plan: 0, ouv: 0, cotes: 0, cotesA: 0, grille: 0, murs: 0, mursA: 1, rotW: 0, travW: 0, scanW: 0 };
  const cam = { ...CAM.plan };
  const tps = { rot: 0, trav: 0, scan: 0 };   // origine des mouvements lents
  let dispo = null, courant = -1, voulu = chapitre, introFaite = false, introTl = null;
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
      if (instant) { o.position.set(x, 0, z); o.rotation.y = r; o.scale.set(1, 1, 1); return; }
      const haut = id === 'tapis' ? .22 : .5 + (i % 3) * .1;
      gsap.timeline({ delay: i * .045, onUpdate: marquer })
        .to(o.position, { y: haut, duration: .34, ease: 'power2.out' }, 0)
        .to(o.position, { x, z, duration: .66, ease: COURBES.pivot }, .04)
        .to(o.rotation, { y: proche(o.rotation.y, r), duration: .66, ease: COURBES.pivot }, .04)
        .to(o.position, { y: 0, duration: .36, ease: 'power2.in' }, .5)
        .fromTo(o.scale, { ...ECRASE }, { x: 1, y: 1, z: 1, duration: .32, ease: 'power2.out', immediateRender: false }, .86);
    });
  }
  // même agencement : les meubles retombent sur place
  function sautiller() {
    ORDRE.forEach((id, i) => {
      if (id === 'tapis') return;
      const o = meubles[id].objet;
      gsap.killTweensOf([o.position, o.scale]);
      gsap.timeline({ delay: i * .05, onUpdate: marquer })
        .to(o.position, { y: .42, duration: .3, ease: 'power2.out' }, 0)
        .to(o.position, { y: 0, duration: .34, ease: 'power2.in' }, .3)
        .fromTo(o.scale, { ...ECRASE }, { x: 1, y: 1, z: 1, duration: .32, ease: 'power2.out', immediateRender: false }, .64);
    });
  }
  function chute(o, depuis) {
    return gsap.timeline()
      .set(o, { visible: true })
      .fromTo(o.position, { y: depuis }, { y: 0, duration: .46, ease: 'power2.in', immediateRender: false })
      .fromTo(o.scale, { ...ECRASE }, { x: 1, y: 1, z: 1, duration: .34, ease: 'power2.out', immediateRender: false });
  }

  // ---------- chapitres
  function aller(n, instant) {
    const c = CHAPITRES[n];
    courant = n;
    // un mouvement lent repart de zéro s'il était éteint (pas de saut)
    if (n === 0 && etat.rotW < .01) tps.rot = t;
    if (n === 1 && etat.scanW < .01) tps.scan = t;
    if (n === 3 && etat.travW < .01) tps.trav = t;
    if (instant) {
      gsap.killTweensOf([cam, etat]);
      Object.assign(cam, c.cam);
      Object.assign(etat, c.etat);
      disposer(c.dispo, true);
      marquer();
      return;
    }
    gsap.to(cam, { ...c.cam, duration: 1.2, ease: COURBES.pivot, overwrite: 'auto', onUpdate: marquer });
    gsap.to(etat, { ...c.etat, duration: 1.2, ease: 'power2.inOut', overwrite: 'auto', onUpdate: marquer });
    if (c.dispo !== dispo) disposer(c.dispo, false);
    else if (n === 2) sautiller();
  }
  // état final sans animation (mouvement réduit)
  function toutDeSuite(n) {
    if (introTl) { introTl.kill(); introTl = null; }
    tuer();
    introFaite = true;
    Object.assign(etat, TRACE_FINI);
    ORDRE.forEach(id => { meubles[id].objet.visible = true; });
    dispo = null;
    aller(n, true);
  }

  function intro() {
    if (introFaite || introTl || detruit) return;
    if (reduit) { toutDeSuite(voulu); return; }
    tps.rot = t;
    const tl = gsap.timeline({ onUpdate: marquer, onComplete: finIntro });
    tl.to(etat, { sol: 1, duration: .45, ease: 'power1.out' }, 0)
      .to(etat, { plan: 1, duration: 1, ease: 'power1.inOut' }, .1)
      .to(etat, { grille: 1, duration: .6, ease: 'power1.out' }, .2)
      .to(etat, { ouv: 1, duration: .5, ease: 'power1.inOut' }, .55)
      .to(etat, { cotesA: 1, duration: .2 }, .55)
      .to(etat, { cotes: 1, duration: .6, ease: 'power1.inOut' }, .6)
      // les murs montent pendant que la caméra bascule en vue 3/4
      .to(etat, { murs: 1, duration: .85, ease: COURBES.arrivee }, 1.05)
      .to(cam, { ...CAM.heros, duration: 1.15, ease: COURBES.pivot }, 1)
      .to(etat, { cotesA: 0, grille: CHAPITRES[0].etat.grille, duration: .5, ease: 'power1.inOut' }, 1.45)
      .to(etat, { rotW: 1, duration: 1.4, ease: 'power1.inOut' }, 2.3);
    ORDRE.forEach((id, i) => tl.add(chute(meubles[id].objet, id === 'tapis' ? .5 : 1.1), 1.6 + i * .12));
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
      // on fait défiler pendant l'intro : elle s'achève vite, puis la pièce rejoint le chapitre
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
    // travelling : glissement latéral et léger avancé, à hauteur d'œil
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
  function rendre() {
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
    // ombre de contact : reste au sol, s'élargit et pâlit quand le meuble est en l'air
    for (const id of ORDRE) {
      const { objet: o, ombre } = meubles[id];
      if (!ombre) continue;
      const h = Math.max(0, o.position.y), s = 1 + h * .6;
      ombre.position.y = -o.position.y / (o.scale.y || 1);   // le plan d'ombre garde sa hauteur au sol
      ombre.scale.set(s, 1, s);
      ombre.material.opacity = ombre.userData.base * (1 - borne(h / 1.2));
    }
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
    if (sale || glisse || etat.rotW > .001 || etat.travW > .001 || etat.scanW > .001) { sale = false; rendre(); }
  }

  // ---------- taille, visibilité, pointeur, préférence, perte du contexte
  function mesurer() {
    // taille de mise en page (une transformation CSS du héros ne change pas la définition)
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
  document.fonts?.load?.('500 88px "Geist Mono Variable"').then(() => {
    if (detruit) return;
    piece.redessiner();
    marquer();
  }).catch(() => {});

  // ---------- départ : agencement A, meubles cachés jusqu'à leur chute ; première image tout de suite
  disposer('A', true);
  ORDRE.forEach(id => { meubles[id].objet.visible = false; });
  if (reduit) toutDeSuite(voulu);
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
    tuer();
    piece.liberer();
    renderer.dispose();
    // canevas retiré de la page : on rend le contexte tout de suite (sinon il attend le ramasse-miettes)
    if (!toile.isConnected) { try { renderer.forceContextLoss(); } catch (_) { /* déjà perdu */ } }
  }

  return { intro, chapitre: choisir, detruire };
}
