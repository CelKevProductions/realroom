// Les habitants de l'immeuble de l'accueil, en pâte à modeler, construits en code (aucun modèle ni
// texture externe) : lapins, chiens, chats et tortues, sur un même squelette (corps, tête, oreilles,
// bras, pieds, queue) qu'on anime de deux façons :
//  - GSAP pour les déplacements et les gestes (objet, saut, corps.scale, corps.rotation, tete.rotation.z) ;
//  - vivre(t) à chaque image pour le reste : respiration, clin d'œil, oreilles, queue, bras, accessoires,
//    selon l'état (etat.lit, joue, dort, salut…, de 0 à 1, que la scène fait varier avec GSAP).
// Ils vivent comme des humains : ils lisent (livre, lunettes), jouent à la console (manette), dorment
// (Zzz), arrosent, grignotent (carotte, pop-corn), réfléchissent (échecs), applaudissent, saluent,
// relèvent une pièce au téléphone (scanne : un faisceau balaie la pièce devant eux).
// Expressions : normal, content (sourire ouvert), surpris (bouche ronde), étourdi, amoureux (yeux en
// cœur), endormi ; la bouche bouge quand ils parlent. Émotes partagées : « ! », étoiles, cœurs, nuage d'orage.
// Pour qu'ils aient l'air vivants : les yeux suivent ce qu'on leur montre (viser), oreilles et queue ont
// de l'inertie (ressorts), les pieds marchent pour de vrai, et, quand ils n'ont rien à faire, ils bâillent,
// font leur toilette (chat), penchent la tête (chien), remuent le nez (lapin), tendent le cou (tortue).
// Tenus en l'air (etat.tenu), ils agitent bras et jambes.
import * as THREE from 'three';

const COULEURS = {
  oeil: '#26232B', reflet: '#FFFFFF', joue: '#FF9DB4', rose: '#FFB7C5', corail: '#F2613F', menthe: '#9ECDA9',
  beurre: '#FFE08A', lilas: '#B9AEEA', orage: '#8D86A3', eau: '#8FCBEA', papier: '#FFFBF3', carotte: '#F79A5B',
  vert: '#7DBE8C', zzz: '#9C8FD0', clair: '#FFFBF6', popcorn: '#FFF6DC', ecran: '#D2F5DF', scan: '#5FD39C'
};
// allure de chaque espèce : longueur, durée et hauteur d'un pas, roulis du corps
export const ESPECES = {
  lapin: { pas: .36, duree: .3, hauteur: .12, roulis: 0 },
  chien: { pas: .2, duree: .15, hauteur: .05, roulis: .07 },
  chat: { pas: .22, duree: .19, hauteur: .035, roulis: .04 },
  tortue: { pas: .13, duree: .32, hauteur: .015, roulis: .13 }
};
export const ECHELLE = 1.2;

export function matieresAnimaux() {
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const m = {};
  for (const k of ['rose', 'corail', 'menthe', 'beurre', 'lilas', 'orage', 'papier', 'carotte', 'vert', 'zzz', 'clair', 'popcorn']) m[k] = mat(COULEURS[k]);
  m.papier.side = THREE.DoubleSide;
  m.joue = new THREE.MeshBasicMaterial({ color: COULEURS.joue, transparent: true, opacity: .75, depthWrite: false });
  m.oeil = new THREE.MeshBasicMaterial({ color: COULEURS.oeil });
  m.reflet = new THREE.MeshBasicMaterial({ color: COULEURS.reflet });
  m.eau = new THREE.MeshBasicMaterial({ color: COULEURS.eau, transparent: true, opacity: .9 });
  m.trait = new THREE.LineBasicMaterial({ color: COULEURS.oeil, transparent: true, opacity: .55 });
  m.ecran = new THREE.MeshBasicMaterial({ color: COULEURS.ecran });
  return m;
}

const boule = (r, m, x = 0, y = 0, z = 0, s = [1, 1, 1], n = 16) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, n, Math.round(n * .75)), m);
  o.position.set(x, y, z); o.scale.set(...s);
  return o;
};
const gelule = (r, l, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m);
  o.position.set(x, y, z);
  return o;
};
const pivot = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };
const borne = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lisse = t => t * t * (3 - 2 * t);
// bosse 0 → 1 → 0 de durée d, toutes les p secondes
const bosse = (t, p, d, decalage = 0) => { const x = ((t + decalage) % p + p) % p / d; return x < 1 ? Math.sin(x * Math.PI) : 0; };
const melange = (a, b, w) => a + (b - a) * w;

/* ---------- émotes ---------- */

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
function geoCoeur(r = .06) {
  const s = new THREE.Shape(), k = r / 6;
  s.moveTo(0, -5 * k);
  s.bezierCurveTo(-1 * k, -3.6 * k, -6 * k, -1.2 * k, -6 * k, 2 * k);
  s.bezierCurveTo(-6 * k, 4.6 * k, -3 * k, 6 * k, 0, 3.4 * k);
  s.bezierCurveTo(3 * k, 6 * k, 6 * k, 4.6 * k, 6 * k, 2 * k);
  s.bezierCurveTo(6 * k, -1.2 * k, 1 * k, -3.6 * k, 0, -5 * k);
  return new THREE.ExtrudeGeometry(s, { depth: r * .4, bevelEnabled: true, bevelThickness: r * .15, bevelSize: r * .12, bevelSegments: 3, curveSegments: 10 }).center();
}
function geoSpirale() {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 4, r = .004 + i / 40 * .02; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .0045, 5, false);
}
function geoZ(r = .035) {
  const s = new THREE.Shape();
  [[-1, 1], [1, 1], [1, .6], [-.35, -.6], [1, -.6], [1, -1], [-1, -1], [-1, -.6], [.35, .6], [-1, .6]].forEach(([x, y], i) => (i ? s.lineTo(x * r, y * r) : s.moveTo(x * r, y * r)));
  return new THREE.ExtrudeGeometry(s, { depth: r * .3, bevelEnabled: false }).center();
}

// couronne de petites étoiles qui tourne au-dessus d'une tête (animal étourdi, lampe sonnée)
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
export function exclamation(mat) {
  const g = new THREE.Group();
  g.add(gelule(.024, .085, mat.corail, 0, .09, 0), boule(.026, mat.corail, 0, -.02, 0, [1, 1, 1], 12));
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
// réserve de cœurs : jaillir(x, y, z) en lance quelques-uns qui montent et s'effacent (repère du groupe)
export function reserveCoeurs(n = 14) {
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
    jaillir(gsap, x, y, z, combien = 3) {
      for (let i = 0; i < combien; i++) {
        const c = coeurs[suivant++ % n], dx = (Math.random() - .5) * .4, dz = (Math.random() - .5) * .2;
        gsap.killTweensOf([c.position, c.scale, c.material, c.rotation]);
        c.visible = true;
        c.position.set(x + dx * .3, y, z + dz * .3);
        c.rotation.set(0, 0, (Math.random() - .5) * .6);
        c.scale.setScalar(.001);
        c.material.opacity = 1;
        const d = i * .12;
        gsap.to(c.scale, { x: 1.3, y: 1.3, z: 1.3, duration: .35, delay: d, ease: 'back.out(3)' });
        gsap.to(c.position, { x: x + dx, y: y + .6 + Math.random() * .25, z: z + dz, duration: 1.4, delay: d, ease: 'power1.out' });
        gsap.to(c.material, { opacity: 0, duration: .5, delay: d + .95, onComplete: () => { c.visible = false; } });
      }
    },
    cacher(gsap) { coeurs.forEach(c => { gsap.killTweensOf([c.position, c.scale, c.material]); c.visible = false; }); },
    liberer() { geo.dispose(); coeurs.forEach(c => c.material.dispose()); }
  };
}

/* ---------- accessoires tenus ---------- */

// arrosoir menthe (patte droite) ; ses gouttes tombent quand on arrose
function arrosoir(mat) {
  const g = new THREE.Group();
  const corps = new THREE.Mesh(new THREE.CylinderGeometry(.055, .062, .1, 14), mat.menthe);
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
// livre ouvert, tenu devant soi ; une page tourne de temps en temps
function livre(mat, couverture) {
  const g = new THREE.Group(), plat = new THREE.Group();
  for (const s of [-1, 1]) {
    const moitie = pivot();
    moitie.rotation.z = -s * .22;
    const c = new THREE.Mesh(new THREE.BoxGeometry(.1, .01, .145), couverture);
    c.position.x = s * .052;
    const p = new THREE.Mesh(new THREE.BoxGeometry(.092, .012, .132), mat.papier);
    p.position.set(s * .05, .008, 0);
    moitie.add(c, p);
    plat.add(moitie);
  }
  const page = pivot(0, .016, 0);
  const feuille = new THREE.Mesh(new THREE.PlaneGeometry(.09, .13).rotateX(-Math.PI / 2).translate(.047, 0, 0), mat.papier);
  page.add(feuille);
  page.visible = false;
  plat.add(page);
  plat.rotation.x = -1.05;
  g.add(plat);
  g.userData.page = page;
  g.visible = false;
  return g;
}
// manette de console, tenue à deux pattes
function manette(mat) {
  const g = new THREE.Group();
  const corps = boule(.05, mat.lilas, 0, 0, 0, [1.5, .45, .8], 14);
  g.add(corps, boule(.03, mat.lilas, -.06, -.008, .018, [1, 1, 1.2], 10), boule(.03, mat.lilas, .06, -.008, .018, [1, 1, 1.2], 10));
  g.add(boule(.011, mat.corail, .03, .022, -.005, [1, .6, 1], 8), boule(.011, mat.beurre, .045, .02, .01, [1, .6, 1], 8), boule(.014, mat.clair, -.035, .022, 0, [1, .5, 1], 8));
  g.rotation.x = -.5;
  g.visible = false;
  return g;
}
// téléphone (coque de la couleur de l'animal, écran tourné vers lui, objectif devant)
function telephone(mat, coque) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(.085, .15, .018), coque));
  const e = new THREE.Mesh(new THREE.PlaneGeometry(.068, .126), mat.ecran);
  e.position.z = -.0095; e.rotation.y = Math.PI;
  g.add(e, boule(.011, mat.oeil, -.022, .05, .011, [1, 1, .5], 8));
  g.visible = false;
  return g;
}
// faisceau du relevé : une pyramide translucide qui part du téléphone (sommet à l'origine, ouverte
// vers +z), et un cadre qui la parcourt (L : portée, R : demi-diagonale du bout)
const L_SCAN = .75, R_SCAN = .32;
function faisceau(scan, cadre) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';   // penché vers le sol, puis balayé de gauche à droite
  const cone = new THREE.Mesh(new THREE.ConeGeometry(R_SCAN, L_SCAN, 4, 1, true, Math.PI / 4).translate(0, -L_SCAN / 2, 0).rotateX(-Math.PI / 2), scan);
  const balai = new THREE.Mesh(new THREE.RingGeometry(.84, 1, 4, 1, Math.PI / 4), cadre);
  cone.renderOrder = balai.renderOrder = 2;
  g.add(cone, balai);
  g.userData.balai = balai;
  g.visible = false;
  return g;
}
function carotte(mat) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(.028, .13, 10), mat.carotte);
  c.rotation.x = Math.PI;
  g.add(c);
  [-.4, 0, .4].forEach(a => { const f = new THREE.Mesh(new THREE.ConeGeometry(.012, .07, 5), mat.vert); f.position.set(Math.sin(a) * .02, .09, 0); f.rotation.z = a; g.add(f); });
  g.visible = false;
  return g;
}

/* ---------- l'animal ---------- */

// look : { espece, pelage, clair, sombre, carapace, accessoire, couleurAcc, couverture, graine }
// accessoire : 'echarpe', 'noeud', 'collier', 'grelot', 'lunettes'. Repère : posé à y = 0, face vers +z.
export function creerAnimal(mat, look = {}) {
  const { espece = 'lapin', graine = 0, accessoire = '', couleurAcc = 'menthe', couverture = 'corail' } = look;
  const lapin = espece === 'lapin', chien = espece === 'chien', chat = espece === 'chat', tortue = espece === 'tortue';
  const lambert = c => new THREE.MeshLambertMaterial({ color: c });
  const mats = { pelage: lambert(look.pelage || '#FFFDFB') };
  mats.clair = look.clair ? lambert(look.clair) : mats.pelage;
  mats.sombre = look.sombre ? lambert(look.sombre) : mats.pelage;
  if (tortue) mats.carapace = new THREE.MeshLambertMaterial({ color: look.carapace || '#7FBF8F', flatShading: true });
  const P = mats.pelage, Cl = mats.clair, S = mats.sombre, acc = mat[couleurAcc] || mat.menthe;

  const objet = new THREE.Group();
  objet.rotation.order = 'YXZ';   // une chute (x) se fait dans le sens du regard
  const saut = new THREE.Group();          // petits bonds, pirouettes (clic, surprise)
  const echelle = new THREE.Group();       // taille, et penché de l'activité (vivre)
  echelle.scale.setScalar(ECHELLE);
  objet.add(saut);
  saut.add(echelle);
  const corps = pivot();
  echelle.add(corps);

  // corps : ventre (il respire), poitrail clair, carapace de la tortue
  const ventre = boule(.165, tortue ? Cl : P, 0, .19, 0, [1, 1.04, .94]);
  corps.add(ventre);
  if (chien || chat) corps.add(boule(.1, Cl, 0, .17, .095, [1, 1.25, .55], 12));
  if (tortue) {
    corps.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.19, 1).scale(1.02, 1.1, .62).translate(0, .21, -.085), mats.carapace));
    const bord = new THREE.Mesh(new THREE.TorusGeometry(.172, .02, 6, 26), Cl);
    bord.position.set(0, .2, -.035); bord.scale.set(1, 1.08, 1);
    corps.add(bord);
  }
  // queue
  const queue = pivot(0, lapin ? .15 : chat ? .1 : .16, -.15);
  corps.add(queue);
  if (lapin) queue.add(boule(.05, P));
  if (chien) { queue.add(gelule(.026, .11, P, 0, .07, 0)); queue.rotation.x = -.75; }
  if (chat) {
    const courbe = new THREE.CatmullRomCurve3([[0, 0, 0], [0, .03, -.08], [0, .14, -.13], [.03, .26, -.1], [.06, .31, -.03]].map(p => new THREE.Vector3(...p)));
    queue.add(new THREE.Mesh(new THREE.TubeGeometry(courbe, 20, .022, 8, false), P), boule(.024, P, .06, .31, -.03, [1, 1, 1], 10));
  }
  if (tortue) { const c = new THREE.Mesh(new THREE.ConeGeometry(.025, .07, 8), P); c.rotation.x = -1.9; c.position.set(0, -.07, -.02); queue.add(c); }
  // pieds (sur echelle : ils restent au sol quand le corps s'écrase)
  const pieds = [-1, 1].map(s => { const p = boule(.058, tortue ? P : (chien || chat) ? Cl : P, s * .08, .028, .06, [1, .55, lapin ? 1.45 : 1.25], 12); echelle.add(p); return p; });
  // bras : pivot à l'épaule
  const bras = [-1, 1].map(s => {
    const b = pivot(s * .13, .27, .02);
    b.add(gelule(.033, .06, P, 0, -.055, 0));
    b.rotation.z = s * .45;
    corps.add(b);
    return b;
  });

  // tête : pivot au cou ; visage (réduit pour la tortue) : crâne, museau, yeux, oreilles
  const tete = pivot(0, .33, .01);
  corps.add(tete);
  const visage = new THREE.Group();
  visage.scale.setScalar(tortue ? .86 : 1);
  tete.add(visage);
  visage.add(boule(.165, P, 0, .15, tortue ? .01 : 0, chat ? [1.15, .92, 1] : tortue ? [1, .92, 1.1] : [1.08, .94, 1], 18));
  let langue = null, sourire = null, nez = null;
  if (lapin) {
    nez = boule(.014, mat.rose, 0, .115, .17, [1.2, 1, 1], 8);
    visage.add(boule(.06, P, 0, .09, .125, [1.2, .8, .7], 12), nez);
  } else if (chien) {
    visage.add(boule(.075, Cl, 0, .085, .13, [1.25, .85, .95], 12), boule(.025, mat.oeil, 0, .118, .2, [1.3, 1, 1], 10));
    langue = gelule(.018, .025, mat.rose, 0, .03, .175);
    langue.scale.z = .5;
    visage.add(langue);
  } else if (chat) {
    visage.add(boule(.04, Cl, -.03, .085, .14, [1, .8, .8], 10), boule(.04, Cl, .03, .085, .14, [1, .8, .8], 10), boule(.014, mat.rose, 0, .11, .172, [1.3, 1, 1], 8));
    const m = [];
    for (const s of [-1, 1]) for (const d of [-.012, .006, .024]) m.push(s * .06, .09 + d, .15, s * .17, .09 + d * 2.2, .13);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(m, 3));
    visage.add(new THREE.LineSegments(g, mat.trait));
  } else {
    sourire = new THREE.Mesh(new THREE.TorusGeometry(.03, .006, 6, 14, Math.PI), mat.oeil);
    sourire.position.set(0, .1, .175); sourire.rotation.z = Math.PI;
    visage.add(sourire);
  }
  [-1, 1].forEach(s => { const j = boule(.036, mat.joue, s * .1, .1, .13, [1, .75, .35], 10); j.rotation.y = s * .55; visage.add(j); });
  // yeux : normaux, contents (arcs ∩), endormis (arcs ∪), étourdis (spirales) ; bouche ronde (surpris)
  const yeux = new THREE.Group(), arcs = new THREE.Group(), spirales = new THREE.Group();
  const arc = new THREE.TorusGeometry(.021, .0065, 6, 14, Math.PI), spi = geoSpirale();
  [-1, 1].forEach(s => {
    const o = pivot(s * .066, .17, .142);
    o.add(boule(.025, mat.oeil, 0, 0, 0, [1, 1.12, .6], 10));
    o.add(boule(.008, mat.reflet, .008, .011, .014, [1, 1, 1], 6));
    yeux.add(o);
    const a = new THREE.Mesh(arc, mat.oeil); a.position.set(s * .066, .162, .147); arcs.add(a);
    const sp = new THREE.Mesh(spi, mat.oeil); sp.position.set(s * .066, .17, .15); sp.rotation.z = s * 1.3; spirales.add(sp);
  });
  // yeux en cœur (amoureux)
  const coeursYeux = new THREE.Group(), gc = geoCoeur(.03);
  [-1, 1].forEach(s => { const c = new THREE.Mesh(gc, mat.corail); c.position.set(s * .066, .17, .15); coeursYeux.add(c); });
  arcs.visible = spirales.visible = coeursYeux.visible = false;
  // bouches : ronde (surpris, parle, bâille), sourire ouvert avec sa langue (content) ; sous le museau
  const B = lapin ? [0, .07, .168] : chien ? [0, .052, .19] : chat ? [0, .06, .158] : [0, .094, .178];
  const bouche = new THREE.Mesh(new THREE.CircleGeometry(.017, 16), mat.oeil);
  bouche.position.set(...B);
  bouche.rotation.x = chien || chat ? -.3 : -.1;
  bouche.visible = false;
  const sourireOuvert = new THREE.Group();
  sourireOuvert.add(new THREE.Mesh(new THREE.CircleGeometry(.03, 18, Math.PI, Math.PI), mat.oeil));
  const languette = new THREE.Mesh(new THREE.CircleGeometry(.016, 14, Math.PI, Math.PI), mat.rose);
  languette.position.set(0, -.013, .002);
  sourireOuvert.add(languette);
  sourireOuvert.position.set(B[0], B[1] + .012, B[2] + .002);
  sourireOuvert.rotation.x = bouche.rotation.x;
  sourireOuvert.visible = false;
  visage.add(yeux, arcs, spirales, coeursYeux, bouche, sourireOuvert);
  const baseYeux = yeux.children.map(o => o.position.clone());
  // oreilles : pivot à la base
  const oreilles = [];
  for (const s of [-1, 1]) {
    if (lapin) {
      const o = pivot(s * .07, .28, -.01);
      const ext = gelule(.043, .2, P, 0, .14, 0); ext.scale.z = .66;
      const int = gelule(.024, .15, mat.rose, 0, .14, .02); int.scale.z = .45;
      o.add(ext, int);
      oreilles.push(o);
    } else if (chien) {
      const o = pivot(s * .15, .24, 0);
      const e = gelule(.048, .1, S, 0, -.075, 0); e.scale.z = .5;
      o.add(e);
      oreilles.push(o);
    } else if (chat) {
      const o = pivot(s * .095, .265, 0);
      const ext = new THREE.Mesh(new THREE.ConeGeometry(.06, .12, 12), P); ext.position.y = .05; ext.scale.z = .6;
      const int = new THREE.Mesh(new THREE.ConeGeometry(.034, .075, 10), mat.rose); int.position.set(0, .04, .022); int.scale.z = .4;
      o.add(ext, int);
      oreilles.push(o);
    }
  }
  oreilles.forEach(o => visage.add(o));

  // accessoires portés
  if (accessoire === 'echarpe') {
    const e = new THREE.Mesh(new THREE.TorusGeometry(.118, .03, 8, 24), acc);
    e.rotation.x = Math.PI / 2; e.position.y = .335; e.scale.set(1, .92, 1);
    const pan = gelule(.026, .08, acc, .06, .27, .11); pan.rotation.z = .35;
    corps.add(e, pan);
  } else if (accessoire === 'noeud') {
    const n = lapin ? pivot(-.02, .2, .03) : pivot(.09, .29, .07);
    n.add(boule(.03, acc, 0, 0, 0, [1, 1, .8], 10), boule(.04, acc, -.045, 0, 0, [1.2, .8, .6], 10), boule(.04, acc, .045, 0, 0, [1.2, .8, .6], 10));
    (lapin ? oreilles[1] : visage).add(n);
  } else if (accessoire === 'collier' || accessoire === 'grelot') {
    const c = new THREE.Mesh(new THREE.TorusGeometry(.112, .02, 6, 24), acc);
    c.rotation.x = Math.PI / 2; c.position.y = .335;
    corps.add(c);
    if (accessoire === 'grelot') corps.add(boule(.024, mat.beurre, 0, .31, .115, [1, 1, 1], 10));
    else corps.add(boule(.02, mat.beurre, 0, .31, .112, [1, 1.2, .5], 8));
  } else if (accessoire === 'lunettes') {
    for (const s of [-1, 1]) { const v = new THREE.Mesh(new THREE.TorusGeometry(.036, .006, 6, 18), mat.oeil); v.position.set(s * .066, .17, .16); visage.add(v); }
    const pont = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .06, 5), mat.oeil);
    pont.rotation.z = Math.PI / 2; pont.position.set(0, .178, .168);
    visage.add(pont);
  }

  // accessoires tenus
  const outil = arrosoir(mat);
  outil.position.set(.06, -.13, .05);
  bras[1].add(outil);
  const croc = carotte(mat);
  croc.position.set(0, -.12, .04);
  croc.rotation.x = 1.4;
  bras[1].add(croc);
  const grain = boule(.022, mat.popcorn, 0, -.12, .02, [1, .9, 1], 8);
  grain.visible = false;
  bras[1].add(grain);
  const lecture = livre(mat, mat[couverture] || mat.corail);
  lecture.position.set(0, .21, .2);
  const jeu = manette(mat);
  jeu.position.set(0, .2, .19);
  const tel = telephone(mat, acc);
  tel.position.set(0, .28, .23);
  tel.rotation.x = .25;
  mats.scan = new THREE.MeshBasicMaterial({ color: COULEURS.scan, transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide });
  mats.cadre = new THREE.MeshBasicMaterial({ color: COULEURS.scan, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide });
  const releve = faisceau(mats.scan, mats.cadre);
  releve.position.set(0, .28, .25);
  releve.rotation.x = .32;
  corps.add(lecture, jeu, tel, releve);
  // émotes au-dessus de la tête
  const etoiles = couronneEtoiles(mat);
  etoiles.position.y = .42;
  const alerte = exclamation(mat);
  alerte.position.set(.12, .52, 0);
  const zzz = new THREE.Group(), gz = geoZ();
  for (let i = 0; i < 3; i++) zzz.add(new THREE.Mesh(gz, mat.zzz));
  zzz.position.set(.12, .34, 0);
  zzz.visible = false;
  tete.add(etoiles, alerte, zzz);

  // état animé par la scène (GSAP), de 0 à 1 sauf teteX, teteY (radians)
  // parle : la bouche bouge (bulle) ; tenu : on le tient en l'air (bras et jambes s'agitent) ;
  // scanne : il relève la pièce au téléphone
  const etat = {
    souffle: 1, salut: 0, arrose: 0, lit: 0, joue: 0, dort: 0, mange: 0, grignote: 0, pense: 0, pousse: 0,
    acclame: 0, assis: 0, cache: 0, remue: 0, teteX: 0, teteY: 0, parle: 0, tenu: 0, scanne: 0
  };
  let regardCourant = 'normal', vue = '', prochainClin = 1.5 + graine * 1.3, clinDebut = -1;
  const regard = nom => { regardCourant = nom; };
  function montrer(nom) {
    vue = nom;
    yeux.visible = nom === 'normal' || nom === 'surpris';
    arcs.visible = nom === 'content' || nom === 'dort';
    arcs.children.forEach(a => { a.rotation.z = nom === 'dort' ? Math.PI : 0; a.position.y = nom === 'dort' ? .178 : .162; });
    spirales.visible = nom === 'etourdi';
    coeursYeux.visible = nom === 'amoureux';
    sourireOuvert.visible = nom === 'content' || nom === 'amoureux';
    if (sourire) sourire.visible = !sourireOuvert.visible;
  }
  montrer('normal');
  // regard : où il regarde (−1 à 1, écran : x vers la droite, y vers le bas), suivi en douceur
  const vise = { x: 0, y: 0 }, regardVu = { x: 0, y: 0 };
  const viser = (x, y) => { vise.x = borne(x, -1, 1); vise.y = borne(y, -1, 1); };
  // inertie : ressorts des oreilles et de la queue, mouvement mesuré d'une image à l'autre
  const ressort = { y: 0, vy: 0, x: 0, vx: 0 };
  const suivi = { t: -1, x: 0, y: 0, z: 0, marche: 0, phase: 0 };

  // bras : [rotation.x, rotation.z] d'un bras (s : -1 gauche, 1 droit) selon l'état
  let gBaille = 0, gGeste = 0, marche = 0, phase = 0;
  function poseBras(s, t) {
    const e = etat;
    let x = Math.sin(phase + (s > 0 ? 0 : Math.PI)) * .55 * marche, z = s * .45;
    const tient = Math.max(e.lit, e.joue);
    if (tient > 0) {
      x = melange(x, -1.15 + Math.sin(t * 19 + s) * .07 * e.joue, tient);
      z = melange(z, -s * .28, tient);
    }
    if (e.scanne > 0) { x = melange(x, -1.4, e.scanne); z = melange(z, -s * .38, e.scanne); }
    if (s > 0) {
      if (e.arrose > 0) { x = melange(x, -.6, e.arrose); z = melange(z, .45 + .9, e.arrose); }
      const bouche = Math.max(e.mange * (.35 + .65 * bosse(t, 2.2, 1.1, graine)), e.grignote * bosse(t, 3.4, 1, graine * 1.3));
      if (bouche > 0) { x = melange(x, -2.05, bouche); z = melange(z, -.45, bouche); }
      if (e.pousse > 0) { x = melange(x, -1.45, e.pousse); z = melange(z, -.2, e.pousse); }
    } else if (e.pense > 0) {
      x = melange(x, -2.15, e.pense); z = melange(z, .55, e.pense);
    }
    if (e.acclame > 0) { x = melange(x, -.3, e.acclame); z = melange(z, s * (2.6 + Math.sin(t * 16 + s) * .25), e.acclame); }
    if (s < 0 && e.salut > 0) { x = melange(x, 0, e.salut); z = melange(z, -(.45 + 2.1) + Math.sin(t * 9) * .35, e.salut); }
    // petits gestes du repos : on s'étire en bâillant, le chat se lèche la patte
    if (gBaille > 0) { x = melange(x, -2.75, gBaille); z = melange(z, s * .3, gBaille); }
    if (chat && s > 0 && gGeste > 0) { x = melange(x, -2.2 + Math.sin(t * 14) * .12, gGeste); z = melange(z, -.4, gGeste); }
    // tenu en l'air : les bras s'agitent
    if (e.tenu > 0) { x = melange(x, -.3 + Math.sin(t * 13 + s) * .3, e.tenu); z = melange(z, s * (2.2 + Math.sin(t * 10 + s * 2) * .35), e.tenu); }
    return [x, z];
  }

  // petite vie continue (t : secondes de la scène)
  function vivre(t) {
    const e = etat;
    const nom = e.dort > .5 ? 'dort' : regardCourant;
    if (nom !== vue) montrer(nom);
    // mouvement depuis l'image précédente (repère de l'appartement) : vitesse, marche, ressorts
    const dt = suivi.t < 0 ? 0 : borne(t - suivi.t, 0, .05);
    const X = objet.position.x, Y = objet.position.y + saut.position.y, Z = objet.position.z;
    if (dt > 0) {
      const vx = (X - suivi.x) / dt, vy = (Y - suivi.y) / dt, vz = (Z - suivi.z) / dt;
      const cy = Math.cos(objet.rotation.y), sy = Math.sin(objet.rotation.y);
      const lateral = vx * cy - vz * sy, sol = Math.hypot(vx, vz);
      const g = ESPECES[espece], allure = g.pas / g.duree;
      suivi.marche += (borne(sol / (allure * .5)) * (1 - e.tenu) - suivi.marche) * (1 - Math.exp(-dt * 10));
      suivi.phase += sol * dt / g.pas * Math.PI;
      for (const [k, cible] of [['y', borne(vy * .3, -.9, .9)], ['x', borne(-lateral * .35, -.7, .7)]]) {
        const v = 'v' + k;
        ressort[v] += ((cible - ressort[k]) * 150 - ressort[v] * 9) * dt;
        ressort[k] += ressort[v] * dt;
      }
    }
    suivi.t = t; suivi.x = X; suivi.y = Y; suivi.z = Z;
    marche = suivi.marche; phase = suivi.phase;
    // repos : rien à faire et immobile ; alors il bâille de temps en temps, et a son petit geste
    const occupe = Math.max(e.lit, e.joue, e.dort, e.mange, e.grignote, e.pense, e.acclame, e.salut, e.arrose, e.cache, e.parle, e.tenu, e.pousse, e.scanne);
    const libre = (1 - occupe) * (1 - marche) * (nom === 'normal' || nom === 'content' ? 1 : 0);
    gBaille = libre * lisse(borne(bosse(t, 13 + graine % 4, 1.9, graine * 1.7) * 1.6));
    gGeste = gBaille > .01 ? 0 : libre * lisse(borne(bosse(t, 7 + graine % 3, 1.4, graine * 3.1) * 1.5));
    regardVu.x += (vise.x - regardVu.x) * (1 - Math.exp(-dt * 6));
    regardVu.y += (vise.y - regardVu.y) * (1 - Math.exp(-dt * 6));
    // yeux : ils suivent (sauf fermés)
    yeux.children.forEach((o, i) => o.position.set(baseYeux[i].x + regardVu.x * .013, baseYeux[i].y - regardVu.y * .011, baseYeux[i].z));
    const ph = t * (e.dort > .5 ? 1.2 : 2.2) + graine * 2.1;
    const respire = Math.sin(ph) * .018 * e.souffle * (1 + e.dort * .8);
    ventre.scale.set(1 - respire * .5, 1.04 * (1 + respire), .94 * (1 - respire * .5));
    // tête : respire, se rentre (tortue cachée), se penche (lecture, sommeil, réflexion)
    const c = e.cache;
    const cou = tortue ? gGeste : 0;   // la tortue tend le cou
    tete.position.set(0, .33 + respire * .2 - c * .14 + cou * .03, .01 - c * .08 + cou * .07);
    tete.scale.setScalar(1 - c * .6);
    const suit = (1 - e.dort) * (1 - e.lit * .6) * (1 - e.scanne * .6);
    // en relevant la pièce, le faisceau balaie de gauche à droite et la tête suit l'écran
    const balaye = Math.sin(t * 1.25 + graine * 2) * .55 * e.scanne;
    tete.rotation.x = e.teteX + .25 * e.lit + .35 * e.dort + .12 * e.pense + .1 * e.joue + .14 * e.scanne + Math.sin(t * .9 + graine) * .03
      + regardVu.y * .22 * suit - gBaille * .3 + (chat ? gGeste * .25 : 0) - e.tenu * .15;
    tete.rotation.y = e.teteY + Math.sin(t * .6 + graine * 3) * .07 * (1 - e.dort) + regardVu.x * .45 * suit - (chat ? gGeste * .35 : 0) + balaye * .4;
    // le chien penche la tête, curieux
    visage.rotation.z = chien ? gGeste * .38 : 0;
    bras.forEach(b => b.scale.setScalar(1 - c * .7));
    pieds.forEach(p => p.scale.set(1 - c * .5, .55 * (1 - c * .5), (lapin ? 1.45 : 1.25) * (1 - c * .5)));
    // penché : on joue (on se balance avec la manette), on réfléchit
    echelle.rotation.z = Math.sin(t * 2.3 + graine) * .07 * e.joue + Math.sin(t * .8 + graine) * .05 * e.pense;
    echelle.rotation.x = -.06 * e.joue;
    // assis : les pieds passent devant ; en marchant, un pied après l'autre (le lapin : les deux) ;
    // tenu : ils pendent et pédalent
    pieds.forEach((p, i) => {
      const ph = phase + (lapin ? 0 : i * Math.PI), pas = Math.sin(ph) * marche, pedale = Math.sin(t * 15 + i * Math.PI) * e.tenu;
      p.position.set((i ? 1 : -1) * .08, .028 + .05 * e.assis + Math.max(0, pas) * .035 - e.tenu * .03 + pedale * .02, .06 + .1 * e.assis + (lapin ? -Math.abs(pas) * .05 : pas * .05) + pedale * .03);
    });
    // oreilles
    const surpris = nom === 'surpris' ? 1 : 0, etourdi = nom === 'etourdi' ? 1 : 0;
    oreilles.forEach((o, i) => {
      const s = i ? 1 : -1;
      if (lapin) {
        const tombe = etourdi * .55 + e.dort * .35, dresse = surpris * -.1;
        const flic = i ? gGeste * Math.sin(t * 30) * .25 : 0;   // une oreille frémit avec le nez
        o.rotation.z = -s * (.14 + tombe + dresse) + Math.sin(t * 1.7 + i + graine) * .05 * e.souffle + ressort.x * .7 + flic;
        o.rotation.x = -.08 + Math.sin(t * 1.3 + i * 1.7 + graine) * .04 + tombe * .4 + ressort.y * 1.1;
      } else if (chien) {
        o.rotation.z = s * (.25 + surpris * .9 + e.acclame * .5 - e.dort * .12 - ressort.y * 1.3 + (i ? gGeste * .5 : 0)) + Math.sin(t * 1.9 + i + graine) * .05 + ressort.x * .6;
      } else {
        const frisson = bosse(t, 3.7, .25, i * .8 + graine) * .25;
        o.rotation.z = -s * (.22 + etourdi * .7 - surpris * .15 + frisson) + ressort.x * .3;
        o.rotation.x = ressort.y * .4;
      }
    });
    // queue
    if (chien) {
      const remue = Math.max(e.remue, nom === 'content' || nom === 'amoureux' ? 1 : 0, e.joue * .6, gGeste);
      queue.rotation.y = Math.sin(t * 15 + graine) * .55 * (.3 + .7 * remue) * (1 - e.dort) + ressort.x * .8;
      queue.rotation.x = -.75 - ressort.y * .6;
    } else if (chat) {
      queue.rotation.z = Math.sin(t * 1.3 + graine) * .28 + ressort.x * 1.1;
      queue.rotation.x = Math.sin(t * .9 + graine) * .1 - ressort.y * .5;
    } else if (lapin) {
      queue.scale.setScalar(1 + Math.max(0, ressort.y) * .3 + marche * Math.abs(Math.sin(phase)) * .15);
    }
    if (nez) nez.scale.set(1.2, 1 + Math.sin(t * 26) * .22 * (gGeste + .25 * (1 - e.dort)), 1);
    if (langue) langue.visible = nom === 'content' || e.joue > .5;
    // clin d'œil de temps en temps
    if (t > prochainClin && clinDebut < 0) { clinDebut = t; prochainClin = t + 2.6 + ((graine * 7.3 + t * 3.1) % 2.4); }
    let ouvert = 1;
    if (clinDebut >= 0) { const p = (t - clinDebut) / .16; ouvert = p >= 1 ? 1 : Math.abs(1 - 2 * p) * .9 + .1; if (p >= 1) clinDebut = -1; }
    // en bâillant, les yeux se ferment ; la tortue cligne lentement en tendant le cou
    ouvert *= 1 - gBaille * .9 - cou * .6 * bosse(t, 1.4, .7, graine);
    const k = nom === 'surpris' ? 1.4 : 1;
    yeux.children.forEach(o => o.scale.set(k, k * Math.max(.08, ouvert), k));
    if (coeursYeux.visible) coeursYeux.children.forEach((c, i) => c.scale.setScalar(1 + Math.sin(t * 9 + i) * .15));
    // bouche : ronde quand il est surpris, qu'il parle (elle s'ouvre et se ferme) ou qu'il bâille
    const parle = e.parle > .5 ? .35 + .65 * Math.abs(Math.sin(t * 11 + graine)) : 0;
    const ouverture = Math.max(nom === 'surpris' ? 1 : 0, parle, gBaille * 2.2);
    bouche.visible = ouverture > .05 && !sourireOuvert.visible || gBaille > .05;
    bouche.scale.set(1 + gBaille * .5, Math.max(.15, ouverture), 1);
    if (sourireOuvert.visible) sourireOuvert.scale.set(1, .8 + parle * .5, 1);
    // bras
    bras.forEach((b, i) => { const [x, z] = poseBras(i ? 1 : -1, t); b.rotation.x = x; b.rotation.z = z; });
    // accessoires tenus
    outil.visible = e.arrose > .01;
    outil.rotation.z = -e.arrose * .5;
    outil.userData.gouttes.forEach((g, i, l) => {
      g.visible = e.arrose > .6;
      if (!g.visible) return;
      const p = (t * 1.6 + i / l.length) % 1;
      g.position.set(outil.userData.bout.x + p * .05, outil.userData.bout.y - p * .32, (i % 2 - .5) * .02);
    });
    croc.visible = e.mange > .01;
    grain.visible = e.grignote > .01 && bosse(t, 3.4, 1, graine * 1.3) > .05;
    lecture.visible = e.lit > .01;
    lecture.scale.setScalar(Math.max(.001, e.lit));
    if (lecture.visible) {
      const p = (((t + graine * 1.7) % 4.5) + 4.5) % 4.5 / .7, page = lecture.userData.page;
      page.visible = p < 1;
      page.rotation.z = Math.PI * lisse(borne(p));
    }
    jeu.visible = e.joue > .01;
    jeu.scale.setScalar(Math.max(.001, e.joue));
    tel.visible = e.scanne > .01;
    tel.scale.setScalar(Math.max(.001, e.scanne));
    tel.rotation.y = balaye * .3;
    const f = lisse(borne((e.scanne - .4) / .6));
    releve.visible = f > .01;
    if (releve.visible) {
      releve.scale.setScalar(f);
      releve.rotation.y = balaye;
      const p = (t * .8 + graine * .37) % 1, b = releve.userData.balai;
      b.position.z = L_SCAN * p;
      b.scale.setScalar(Math.max(.001, R_SCAN * p));
      mats.cadre.opacity = .9 * (1 - p) * f;
      mats.scan.opacity = (.2 + .06 * Math.sin(t * 5 + graine)) * f;
    }
    // émotes
    if (etoiles.visible) { etoiles.rotation.y = t * 4.5; etoiles.rotation.z = Math.sin(t * 3) * .15; }
    zzz.visible = e.dort > .5;
    if (zzz.visible) zzz.children.forEach((z, i) => {
      const p = (t * .45 + i / 3) % 1;
      z.position.set(p * .12, p * .32, 0);
      z.rotation.z = Math.sin(t * 2 + i) * .3;
      z.scale.setScalar(Math.max(.001, Math.sin(p * Math.PI) * (.7 + i * .15)));
    });
  }

  return {
    espece, objet, saut, echelle, corps, tete, oreilles, bras, pieds, queue, etoiles, alerte, outil, etat, mats, regard, vivre, viser,
    get regardCourant() { return regardCourant; },
    liberer() { new Set(Object.values(mats)).forEach(x => x.dispose()); gc.dispose(); }
  };
}

/* ---------- gestes (rendent des timelines GSAP) ---------- */

// angle de y qui fait regarder vers (dx, dz)
export const cap = (dx, dz) => Math.atan2(dx, dz);
export const proche = (de, vers) => de + Math.atan2(Math.sin(vers - de), Math.cos(vers - de));

// un pas (ou un bond pour le lapin) d'un point à un autre, à l'allure de l'espèce
export function bond(gsap, a, x, z, o = {}) {
  const g = ESPECES[a.espece];
  const { hauteur = g.hauteur, duree = g.duree, y = 0, tourne = true, roulis = g.roulis, signe = 1 } = o;
  const ob = a.objet, tl = gsap.timeline(), ecrase = a.espece === 'lapin' ? 1 : .35;
  // cap et hauteur lus au départ du pas (pas à sa création) : il peut suivre un autre geste
  const loin = () => Math.abs(x - ob.position.x) + Math.abs(z - ob.position.z) > .01;
  if (tourne) tl.to(ob.rotation, { y: () => loin() ? proche(ob.rotation.y, cap(x - ob.position.x, z - ob.position.z)) : ob.rotation.y, duration: .14, ease: 'power2.out' }, 0);
  tl.to(ob.position, { x, z, duration: duree, ease: 'none' }, 0)
    .to(ob.position, { y: () => Math.max(ob.position.y, y) + hauteur, duration: duree / 2, ease: 'power2.out' }, 0)
    .to(ob.position, { y, duration: duree / 2, ease: 'power2.in' }, duree / 2)
    .fromTo(a.corps.scale, { y: 1 + .12 * ecrase, x: 1 - .06 * ecrase, z: 1 - .06 * ecrase }, { y: 1, x: 1, z: 1, duration: duree * .6, ease: 'power2.out', immediateRender: false }, 0)
    .to(a.corps.scale, { y: 1 - .18 * ecrase, x: 1 + .1 * ecrase, z: 1 + .1 * ecrase, duration: .06, ease: 'power2.out' }, duree)
    .to(a.corps.scale, { y: 1, x: 1, z: 1, duration: .18, ease: 'back.out(3)' }, duree + .06);
  if (roulis) tl.to(a.corps.rotation, { z: signe * roulis, duration: duree / 2, ease: 'sine.out' }, 0).to(a.corps.rotation, { z: 0, duration: duree / 2, ease: 'sine.in' }, duree / 2);
  return tl;
}
// une suite de pas le long de points [[x, z], …]
export function marcher(gsap, a, points, o = {}) {
  const g = ESPECES[a.espece], pas = o.pas || g.pas, tl = gsap.timeline();
  // départ : la position actuelle, ou o.depuis quand un geste précédent l'aura déplacé d'ici là
  let [x, z] = o.depuis || [a.objet.position.x, a.objet.position.z], signe = 1;
  for (const [px, pz] of points) {
    const n = Math.max(1, Math.round(Math.hypot(px - x, pz - z) / pas));
    for (let i = 1; i <= n; i++) tl.add(bond(gsap, a, x + (px - x) * i / n, z + (pz - z) * i / n, { ...o, signe: signe = -signe }));
    x = px; z = pz;
  }
  return tl;
}
// surprise : petit saut sur place, grands yeux, « ! »
export function surprise(gsap, a, { haut = .24, revenir = true } = {}) {
  const tl = gsap.timeline()
    .call(() => a.regard('surpris'))
    .to(a.corps.scale, { y: .8, x: 1.12, z: 1.12, duration: .08 }, 0)
    .to(a.saut.position, { y: haut, duration: .2, ease: 'power2.out' }, .08)
    .to(a.corps.scale, { y: 1.14, x: .92, z: .92, duration: .14 }, .08)
    .to(a.saut.position, { y: 0, duration: .2, ease: 'power2.in' }, .28)
    .to(a.corps.scale, { y: 1, x: 1, z: 1, duration: .25, ease: 'back.out(3)' }, .48)
    .set(a.alerte, { visible: true }, .1)
    .to(a.alerte.scale, { x: 1, y: 1, z: 1, duration: .3, ease: 'back.out(3)' }, .1)
    .to(a.alerte.rotation, { z: .25, duration: .08, yoyo: true, repeat: 5 }, .3)
    .to(a.alerte.scale, { x: .001, y: .001, z: .001, duration: .2, ease: 'power2.in' }, 1.5)
    .set(a.alerte, { visible: false }, 1.7);
  if (revenir) tl.call(() => a.regard('normal'), null, 1.4);
  return tl;
}
// chute sur le dos, étoiles qui tournent (couché, les pieds restent en l'air : le dos et la tête
// touchent le sol sans y entrer)
export function chute(gsap, a, dx = 0, dz = 0) {
  const o = a.objet;
  return gsap.timeline()
    .call(() => a.regard('surpris'))
    .to(o.position, { x: o.position.x + dx, z: o.position.z + dz, duration: .45, ease: 'power2.out' }, 0)
    .to(o.position, { y: .34, duration: .18, ease: 'power2.out' }, 0)
    .to(o.position, { y: .17, duration: .25, ease: 'bounce.out' }, .18)
    .to(o.rotation, { x: -1.35, duration: .4, ease: 'power2.in' }, .02)
    .call(() => a.regard('etourdi'), null, .4)
    .set(a.etoiles, { visible: true }, .42)
    .to(a.etoiles.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(3)' }, .42)
    .to(a.corps.scale, { y: .85, duration: .08, yoyo: true, repeat: 1 }, .4);
}
// se relève en secouant la tête
export function relever(gsap, a) {
  return gsap.timeline()
    .to(a.objet.rotation, { x: 0, duration: .45, ease: 'back.out(2)' }, 0)
    .to(a.objet.position, { y: 0, duration: .3, ease: 'power2.out' }, 0)
    .to(a.tete.rotation, { z: .25, duration: .09, yoyo: true, repeat: 5, ease: 'sine.inOut' }, .45)
    .set(a.tete.rotation, { z: 0 }, 1)
    .add(cacherEtoiles(gsap, a), 1.1)
    .call(() => a.regard('normal'), null, 1.2);
}
export function cacherEtoiles(gsap, a) {
  return gsap.timeline().to(a.etoiles.scale, { x: .001, y: .001, z: .001, duration: .3, ease: 'power2.in' }).set(a.etoiles, { visible: false });
}
// pirouette sur place (chien content ou surpris)
export function tournoyer(gsap, a, tours = 1) {
  return gsap.timeline()
    .to(a.saut.position, { y: .12, duration: .2, ease: 'power2.out', yoyo: true, repeat: 1 }, 0)
    .fromTo(a.saut.rotation, { y: 0 }, { y: Math.PI * 2 * tours, duration: .55 * tours, ease: 'power2.inOut', immediateRender: false }, 0)
    .set(a.saut.rotation, { y: 0 });
}
// la tortue rentre dans sa carapace, puis ressort
export function seCacher(gsap, a, duree = 1.2) {
  return gsap.timeline()
    .to(a.etat, { cache: 1, duration: .22, ease: 'power2.in' }, 0)
    .to(a.corps.scale, { y: .9, duration: .15, yoyo: true, repeat: 1 }, .15)
    .to(a.etat, { cache: 0, duration: .45, ease: 'back.out(2.5)' }, .22 + duree);
}
// réaction au clic : chacun à sa façon, sans quitter sa place (tout passe par « saut ») ;
// garderSalut : il saluait déjà (fin de l'histoire), il continue
export function coucou(gsap, a, garderSalut = false) {
  gsap.killTweensOf([a.saut.position, a.saut.rotation]);
  const tl = gsap.timeline(), avant = a.regardCourant;
  tl.call(() => a.regard('content'));
  if (a.espece === 'chien') tl.add(tournoyer(gsap, a), 0).to(a.etat, { remue: 1, duration: .2 }, 0).to(a.etat, { remue: 0, duration: .5 }, 1.4);
  else if (a.espece === 'tortue') tl.add(seCacher(gsap, a, .5), 0).to(a.saut.position, { y: .2, duration: .2, ease: 'power2.out', yoyo: true, repeat: 1 }, .95);
  else {
    const haut = a.espece === 'lapin' ? .34 : .26;
    tl.to(a.corps.scale, { y: .8, x: 1.12, z: 1.12, duration: .08 }, 0)
      .to(a.saut.position, { y: haut, duration: .22, ease: 'power2.out' }, .08)
      .to(a.corps.scale, { y: 1.15, x: .92, z: .92, duration: .14 }, .08)
      .to(a.saut.position, { y: 0, duration: .22, ease: 'power2.in' }, .3)
      .to(a.corps.scale, { y: 1, x: 1, z: 1, duration: .3, ease: 'back.out(3)' }, .52);
  }
  tl.to(a.etat, { salut: 1, duration: .25 }, .2).to(a.etat, { salut: garderSalut ? 1 : 0, duration: .3 }, 1.5)
    .call(() => a.regard(avant), null, 1.7);
  return tl;
}
