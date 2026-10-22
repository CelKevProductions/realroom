// Les deux lapins de l'accueil, en pâte à modeler, construits en code (aucun modèle ni texture externe).
// Un lapin : corps, tête, oreilles, bras, pieds et queue, sur des pivots qu'on anime (GSAP pour les
// gestes, une petite vie continue pour respirer, cligner des yeux et bouger les oreilles).
// Expressions : normal, content (yeux fermés en arc), surpris (grands yeux, bouche ronde), étourdi
// (yeux en spirale, couronne d'étoiles). Accessoires : écharpe menthe ou nœud corail, arrosoir.
// Émotes (« ! », cœurs, étoiles, nuage d'orage) partagées par la scène.
import * as THREE from 'three';

const COULEURS = {
  pelage: '#FFFDFB', rose: '#FFB7C5', joue: '#FF9DB4', oeil: '#26232B', reflet: '#FFFFFF',
  corail: '#F2613F', menthe: '#9ECDA9', beurre: '#FFE08A', eau: '#8FCBEA', orage: '#8D86A3'
};

export function matieresLapins() {
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  return {
    pelage: mat(COULEURS.pelage), rose: mat(COULEURS.rose), corail: mat(COULEURS.corail), menthe: mat(COULEURS.menthe),
    beurre: mat(COULEURS.beurre), orage: mat(COULEURS.orage),
    joue: new THREE.MeshBasicMaterial({ color: COULEURS.joue, transparent: true, opacity: .75, depthWrite: false }),
    oeil: new THREE.MeshBasicMaterial({ color: COULEURS.oeil }),
    reflet: new THREE.MeshBasicMaterial({ color: COULEURS.reflet }),
    eau: new THREE.MeshBasicMaterial({ color: COULEURS.eau, transparent: true, opacity: .9 })
  };
}

const boule = (r, m, x = 0, y = 0, z = 0, s = [1, 1, 1], n = 20) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, n, Math.round(n * .75)), m);
  o.position.set(x, y, z); o.scale.set(...s);
  return o;
};
const pivot = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };

// étoile à cinq branches, en relief
function geoEtoile(r = .045) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: r * .35, bevelEnabled: true, bevelThickness: r * .12, bevelSize: r * .1, bevelSegments: 2 }).center();
}
// cœur dodu
function geoCoeur(r = .06) {
  const s = new THREE.Shape(), k = r / 6;
  s.moveTo(0, -5 * k);
  s.bezierCurveTo(-1 * k, -3.6 * k, -6 * k, -1.2 * k, -6 * k, 2 * k);
  s.bezierCurveTo(-6 * k, 4.6 * k, -3 * k, 6 * k, 0, 3.4 * k);
  s.bezierCurveTo(3 * k, 6 * k, 6 * k, 4.6 * k, 6 * k, 2 * k);
  s.bezierCurveTo(6 * k, -1.2 * k, 1 * k, -3.6 * k, 0, -5 * k);
  return new THREE.ExtrudeGeometry(s, { depth: r * .4, bevelEnabled: true, bevelThickness: r * .15, bevelSize: r * .12, bevelSegments: 3, curveSegments: 10 }).center();
}
// spirale d'œil étourdi
function geoSpirale() {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 4, r = .004 + i / 40 * .02; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .0045, 5, false);
}

// couronne de petites étoiles qui tourne au-dessus d'une tête (lapin étourdi, lampe sonnée)
export function couronneEtoiles(mat, rayon = .17, n = 4) {
  const groupe = new THREE.Group(), geo = geoEtoile();
  for (let i = 0; i < n; i++) {
    const e = new THREE.Mesh(geo, mat.beurre), a = i / n * Math.PI * 2;
    e.position.set(Math.cos(a) * rayon, Math.sin(a * 2) * .02, Math.sin(a) * rayon);
    groupe.add(e);
  }
  groupe.visible = false;
  groupe.scale.setScalar(.001);
  return groupe;
}
// « ! » corail
export function exclamation(mat) {
  const g = new THREE.Group();
  const trait = new THREE.Mesh(new THREE.CapsuleGeometry(.024, .085, 4, 10), mat.corail);
  trait.position.y = .09;
  g.add(trait, boule(.026, mat.corail, 0, -.02, 0, [1, 1, 1], 12));
  g.visible = false;
  g.scale.setScalar(.001);
  return g;
}
// petit nuage d'orage avec son éclair (meuble qui boude)
export function nuageOrage(mat) {
  const g = new THREE.Group();
  g.add(boule(.11, mat.orage, 0, 0, 0, [1, .8, 1], 14), boule(.08, mat.orage, -.11, -.02, 0, [1, .8, 1], 12), boule(.085, mat.orage, .11, -.02, .01, [1, .8, 1], 12));
  const s = new THREE.Shape();
  [[.02, 0], [-.04, -.09], [.0, -.09], [-.03, -.19], [.06, -.06], [.02, -.06], [.05, 0]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const eclair = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: false }), mat.beurre);
  eclair.position.set(0, -.07, -.01);
  g.add(eclair);
  g.visible = false;
  g.scale.setScalar(.001);
  return g;
}
// réserve de cœurs : jaillir(x, y, z) en lance quelques-uns qui montent et s'effacent
export function reserveCoeurs(mat, n = 10) {
  const geo = geoCoeur(), groupe = new THREE.Group(), coeurs = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.MeshLambertMaterial({ color: i % 3 ? COULEURS.joue : COULEURS.corail, transparent: true, opacity: 0 });
    const c = new THREE.Mesh(geo, m);
    c.visible = false;
    groupe.add(c);
    coeurs.push(c);
  }
  let suivant = 0;
  return {
    groupe,
    jaillir(gsap, x, y, z, combien = 3, surMaj) {
      for (let i = 0; i < combien; i++) {
        const c = coeurs[suivant++ % n], dx = (Math.random() - .5) * .3, dz = (Math.random() - .5) * .2;
        gsap.killTweensOf([c.position, c.scale, c.material, c.rotation]);
        c.visible = true;
        c.position.set(x + dx * .3, y, z + dz * .3);
        c.rotation.set(0, 0, (Math.random() - .5) * .6);
        c.scale.setScalar(.001);
        c.material.opacity = 1;
        const d = i * .12;
        gsap.to(c.scale, { x: 1, y: 1, z: 1, duration: .35, delay: d, ease: 'back.out(3)' });
        gsap.to(c.position, { x: x + dx, y: y + .55 + Math.random() * .2, z: z + dz, duration: 1.4, delay: d, ease: 'power1.out', onUpdate: surMaj });
        gsap.to(c.material, { opacity: 0, duration: .5, delay: d + .95, onComplete: () => { c.visible = false; } });
      }
    },
    liberer() { geo.dispose(); coeurs.forEach(c => c.material.dispose()); }
  };
}

// arrosoir menthe, tenu par la patte droite ; ses gouttes tombent quand on arrose
function arrosoir(mat) {
  const g = new THREE.Group();
  const corps = new THREE.Mesh(new THREE.CylinderGeometry(.055, .062, .1, 16), mat.menthe);
  const bec = new THREE.Mesh(new THREE.CylinderGeometry(.01, .014, .13, 8), mat.menthe);
  bec.position.set(.08, .03, 0); bec.rotation.z = -1;
  const anse = new THREE.Mesh(new THREE.TorusGeometry(.035, .009, 6, 14, Math.PI), mat.menthe);
  anse.position.set(-.02, .05, 0);
  g.add(corps, bec, anse);
  const gouttes = [];
  for (let i = 0; i < 5; i++) { const d = boule(.011, mat.eau, 0, 0, 0, [1, 1.3, 1], 8); d.visible = false; g.add(d); gouttes.push(d); }
  g.userData.gouttes = gouttes;
  g.userData.bout = new THREE.Vector3(.14, .07, 0);
  g.visible = false;
  return g;
}

// Un lapin. Repère : posé à y = 0, face vers +z. accessoire : 'echarpe' (menthe) ou 'noeud' (corail).
export function creerLapin(mat, { accessoire = 'echarpe', graine = 0 } = {}) {
  const objet = new THREE.Group();
  const corps = pivot(0, 0, 0);
  objet.add(corps);
  // le ventre respire (vivre) ; corps est réservé aux gestes (GSAP)
  const ventre = boule(.165, mat.pelage, 0, .19, 0, [1, 1.04, .94]);
  corps.add(ventre);
  corps.add(boule(.05, mat.pelage, 0, .15, -.16));   // queue
  const pieds = [-1, 1].map(s => { const p = boule(.058, mat.pelage, s * .08, .028, .06, [1, .55, 1.45], 14); objet.add(p); return p; });
  const bras = [-1, 1].map(s => {
    const b = pivot(s * .13, .27, .02);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(.033, .06, 4, 10), mat.pelage);
    m.position.y = -.055;
    b.add(m);
    b.rotation.z = s * .45;
    corps.add(b);
    return b;
  });
  // tête : pivot au cou
  const tete = pivot(0, .33, .01);
  corps.add(tete);
  tete.add(boule(.165, mat.pelage, 0, .15, 0, [1.08, .94, 1]));
  // museau et nez
  tete.add(boule(.06, mat.pelage, 0, .09, .125, [1.2, .8, .7], 14));
  tete.add(boule(.014, mat.rose, 0, .115, .17, [1.2, 1, 1], 10));
  // joues
  [-1, 1].forEach(s => { const j = boule(.036, mat.joue, s * .1, .1, .13, [1, .75, .35], 12); j.rotation.y = s * .55; tete.add(j); });
  // yeux : normaux, contents (arcs), étourdis (spirales)
  const yeux = new THREE.Group(), contents = new THREE.Group(), spirales = new THREE.Group();
  const arc = new THREE.TorusGeometry(.021, .0065, 6, 14, Math.PI), spi = geoSpirale();
  [-1, 1].forEach(s => {
    const o = pivot(s * .066, .17, .142);
    o.add(boule(.025, mat.oeil, 0, 0, 0, [1, 1.12, .6], 12));
    o.add(boule(.008, mat.reflet, .008, .011, .014, [1, 1, 1], 8));
    yeux.add(o);
    const a = new THREE.Mesh(arc, mat.oeil); a.position.set(s * .066, .162, .147); contents.add(a);
    const sp = new THREE.Mesh(spi, mat.oeil); sp.position.set(s * .066, .17, .15); sp.rotation.z = s * 1.3; spirales.add(sp);
  });
  contents.visible = spirales.visible = false;
  const bouche = new THREE.Mesh(new THREE.TorusGeometry(.016, .006, 6, 14), mat.oeil);
  bouche.position.set(0, .068, .162);
  bouche.visible = false;
  tete.add(yeux, contents, spirales, bouche);
  // oreilles : pivot à la base, l'intérieur rose devant
  const oreilles = [-1, 1].map(s => {
    const o = pivot(s * .07, .28, -.01);
    const ext = new THREE.Mesh(new THREE.CapsuleGeometry(.043, .2, 4, 12), mat.pelage);
    ext.scale.z = .66; ext.position.y = .14;
    const int = new THREE.Mesh(new THREE.CapsuleGeometry(.024, .15, 4, 10), mat.rose);
    int.scale.z = .45; int.position.set(0, .14, .02);
    o.add(ext, int);
    o.rotation.z = -s * .14;
    tete.add(o);
    return o;
  });
  // accessoire
  if (accessoire === 'echarpe') {
    const e = new THREE.Mesh(new THREE.TorusGeometry(.118, .03, 10, 28), mat.menthe);
    e.rotation.x = Math.PI / 2; e.position.y = .335; e.scale.set(1, .92, 1);
    const pan = new THREE.Mesh(new THREE.CapsuleGeometry(.026, .08, 4, 8), mat.menthe);
    pan.position.set(.06, .27, .11); pan.rotation.z = .35;
    corps.add(e, pan);
  } else {
    const n = pivot(-.02, .2, .03);
    n.add(boule(.03, mat.corail, 0, 0, 0, [1, 1, .8], 10), boule(.04, mat.corail, -.045, 0, 0, [1.2, .8, .6], 10), boule(.04, mat.corail, .045, 0, 0, [1.2, .8, .6], 10));
    oreilles[1].add(n);
  }
  const outil = arrosoir(mat);
  outil.position.set(.06, -.13, .05);
  bras[1].add(outil);
  // émotes au-dessus de la tête
  const etoiles = couronneEtoiles(mat);
  etoiles.position.y = .42;
  const alerte = exclamation(mat);
  alerte.position.set(.12, .5, 0);
  tete.add(etoiles, alerte);

  // état animé (GSAP) : amplitude de la respiration, salut, arrosage
  const etat = { souffle: 1, salut: 0, arrose: 0 };
  let regardCourant = 'normal', prochainClin = 1.5 + graine * 1.3, clinDebut = -1;

  function regard(nom) {
    regardCourant = nom;
    yeux.visible = nom === 'normal' || nom === 'surpris';
    contents.visible = nom === 'content';
    spirales.visible = nom === 'etourdi';
    bouche.visible = nom === 'surpris';
    const k = nom === 'surpris' ? 1.4 : 1;
    yeux.children.forEach(o => o.scale.setScalar(k));
  }

  // petite vie continue (t : secondes de la scène)
  function vivre(t, dt) {
    const ph = t * 2.2 + graine * 2.1;
    const respire = Math.sin(ph) * .018 * etat.souffle;
    ventre.scale.set(1 - respire * .5, 1.04 * (1 + respire), .94 * (1 - respire * .5));
    tete.position.y = .33 + respire * .2;
    // oreilles : léger balancement, se dressent (surprise) ou retombent (étourdi)
    const tombe = regardCourant === 'etourdi' ? .55 : 0, dresse = regardCourant === 'surpris' ? -.1 : 0;
    oreilles.forEach((o, i) => {
      const s = i ? 1 : -1;
      o.rotation.z = -s * (.14 + tombe + dresse) + Math.sin(t * 1.7 + i + graine) * .05 * etat.souffle;
      o.rotation.x = -.08 + Math.sin(t * 1.3 + i * 1.7 + graine) * .04 + tombe * .4;
    });
    // clin d'œil de temps en temps
    if (t > prochainClin && clinDebut < 0) { clinDebut = t; prochainClin = t + 2.6 + ((graine * 7.3 + t * 3.1) % 2.4); }
    let ouvert = 1;
    if (clinDebut >= 0) { const p = (t - clinDebut) / .16; ouvert = p >= 1 ? 1 : Math.abs(1 - 2 * p) * .9 + .1; if (p >= 1) clinDebut = -1; }
    const k = regardCourant === 'surpris' ? 1.4 : 1;
    yeux.children.forEach(o => o.scale.set(k, k * ouvert, k));
    // salut du bras gauche, arrosoir
    if (etat.salut > 0) bras[0].rotation.z = -(.45 + etat.salut * 2.1) + Math.sin(t * 9) * .35 * etat.salut;
    else bras[0].rotation.z = -.45;
    bras[1].rotation.z = .45 + etat.arrose * .9;
    bras[1].rotation.x = -etat.arrose * .6;
    outil.visible = etat.arrose > .01;
    outil.rotation.z = -etat.arrose * .5;
    const gouttes = outil.userData.gouttes;
    gouttes.forEach((g, i) => {
      g.visible = etat.arrose > .6;
      if (!g.visible) return;
      const p = (t * 1.6 + i / gouttes.length) % 1;
      g.position.set(outil.userData.bout.x + p * .05, outil.userData.bout.y - p * .32, (i % 2 - .5) * .02);
    });
    // couronne d'étoiles
    if (etoiles.visible) { etoiles.rotation.y = t * 4.5; etoiles.rotation.z = Math.sin(t * 3) * .15; }
  }

  return { objet, corps, tete, oreilles, bras, pieds, etoiles, alerte, outil, etat, regard, vivre, get regardCourant() { return regardCourant; } };
}

/* ---------- gestes (rendent des timelines GSAP) ---------- */

// angle de y qui fait regarder vers (dx, dz)
export const cap = (dx, dz) => Math.atan2(dx, dz);
const proche = (de, vers) => de + Math.atan2(Math.sin(vers - de), Math.cos(vers - de));

// un bond d'un point à un autre
export function bond(gsap, l, x, z, { hauteur = .14, duree = .34, y = 0, tourne = true } = {}) {
  const o = l.objet, tl = gsap.timeline();
  // cap et hauteur lus au départ du bond (pas à sa création) : il peut suivre un autre geste
  const loin = () => Math.abs(x - o.position.x) + Math.abs(z - o.position.z) > .01;
  if (tourne) tl.to(o.rotation, { y: () => loin() ? proche(o.rotation.y, cap(x - o.position.x, z - o.position.z)) : o.rotation.y, duration: .14, ease: 'power2.out' }, 0);
  tl.to(o.position, { x, z, duration: duree, ease: 'none' }, 0)
    .to(o.position, { y: () => Math.max(o.position.y, y) + hauteur, duration: duree / 2, ease: 'power2.out' }, 0)
    .to(o.position, { y, duration: duree / 2, ease: 'power2.in' }, duree / 2)
    .fromTo(l.corps.scale, { y: 1.12, x: .94, z: .94 }, { y: 1, x: 1, z: 1, duration: duree * .6, ease: 'power2.out', immediateRender: false }, 0)
    .to(l.corps.scale, { y: .82, x: 1.1, z: 1.1, duration: .06, ease: 'power2.out' }, duree)
    .to(l.corps.scale, { y: 1, x: 1, z: 1, duration: .18, ease: 'back.out(3)' }, duree + .06);
  return tl;
}
// une suite de bonds le long de points [[x, z], …] (un bond tous les 35 cm environ)
export function sautiller(gsap, l, points, { pas = .36, duree = .3, hauteur = .12 } = {}) {
  const tl = gsap.timeline();
  let { x, z } = l.objet.position;
  for (const [px, pz] of points) {
    const n = Math.max(1, Math.round(Math.hypot(px - x, pz - z) / pas));
    for (let i = 1; i <= n; i++) tl.add(bond(gsap, l, x + (px - x) * i / n, z + (pz - z) * i / n, { duree, hauteur }));
    x = px; z = pz;
  }
  return tl;
}
// surprise : petit saut sur place, grands yeux, « ! »
export function surprise(gsap, l) {
  const o = l.objet;
  return gsap.timeline()
    .call(() => l.regard('surpris'))
    .to(l.corps.scale, { y: .8, x: 1.12, z: 1.12, duration: .08 }, 0)
    .to(o.position, { y: o.position.y + .24, duration: .2, ease: 'power2.out' }, .08)
    .to(l.corps.scale, { y: 1.14, x: .92, z: .92, duration: .14 }, .08)
    .to(o.position, { y: o.position.y, duration: .2, ease: 'power2.in' }, .28)
    .to(l.corps.scale, { y: 1, x: 1, z: 1, duration: .25, ease: 'back.out(3)' }, .48)
    .set(l.alerte, { visible: true }, .1)
    .to(l.alerte.scale, { x: 1, y: 1, z: 1, duration: .3, ease: 'back.out(3)' }, .1)
    .to(l.alerte.rotation, { z: .25, duration: .08, yoyo: true, repeat: 5 }, .3)
    .to(l.alerte.scale, { x: .001, y: .001, z: .001, duration: .2, ease: 'power2.in' }, 1.5)
    .set(l.alerte, { visible: false }, 1.7);
}
// chute sur le dos, étoiles qui tournent
export function chute(gsap, l, dx = 0, dz = 0) {
  const o = l.objet;
  return gsap.timeline()
    .call(() => l.regard('surpris'))
    .to(o.position, { x: o.position.x + dx, z: o.position.z + dz, duration: .45, ease: 'power2.out' }, 0)
    .to(o.position, { y: .2, duration: .18, ease: 'power2.out' }, 0)
    .to(o.position, { y: .05, duration: .25, ease: 'bounce.out' }, .18)
    .to(o.rotation, { x: -1.35, duration: .4, ease: 'power2.in' }, .02)
    .call(() => l.regard('etourdi'), null, .4)
    .set(l.etoiles, { visible: true }, .42)
    .to(l.etoiles.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(3)' }, .42)
    .to(l.corps.scale, { y: .85, duration: .08, yoyo: true, repeat: 1 }, .4);
}
// se relève en secouant la tête ; garderEtoiles : encore un peu sonné
export function relever(gsap, l, { garderEtoiles = false } = {}) {
  const o = l.objet, tl = gsap.timeline()
    .to(o.rotation, { x: 0, duration: .45, ease: 'back.out(2)' }, 0)
    .to(o.position, { y: 0, duration: .3, ease: 'power2.out' }, 0)
    .to(l.tete.rotation, { z: .25, duration: .09, yoyo: true, repeat: 5, ease: 'sine.inOut' }, .45)
    .set(l.tete.rotation, { z: 0 }, 1);
  if (!garderEtoiles) tl.add(cacherEtoiles(gsap, l), 1.1).call(() => l.regard('normal'), null, 1.2);
  return tl;
}
export function cacherEtoiles(gsap, l) {
  return gsap.timeline().to(l.etoiles.scale, { x: .001, y: .001, z: .001, duration: .3, ease: 'power2.in' }).set(l.etoiles, { visible: false });
}
