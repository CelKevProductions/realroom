/* =================================================================
   RealRoom — modèles fidèles : luminaires (d'après les photos produits)
   Suspensions et lustres : origine au plafond. Appliques : origine au
   mur, face vers +z. Lampadaires : origine au sol.
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, V3, clamp, lerp, alea,
  coussin, boudin, geoBoudin, tourne, panneau, rectCoins, matiere, lumineux, bosseler,
  ombreSol, halo, cable, rosace, geometrieSuspension, cyl, sphere, tore, LUMINEUX
} from './outils.js';

/* ---------- plumes d'autruche : rubans courbes, barbes en transparence ---------- */
let TEX_PLUME = null;
function texturePlume() {
  if (TEX_PLUME) return TEX_PLUME;
  const w = 128, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), r = alea(77);
  x.clearRect(0, 0, w, h);
  // barbes : de la tige vers les bords, inclinées vers la pointe (haut de l'image)
  for (let i = 0; i < 4200; i++) {
    const v = r(), y = h * (1 - v), cote = r() < .5 ? -1 : 1;
    const prof = Math.sin(Math.PI * Math.pow(v, .8)) * (.75 + r() * .3);
    const long = (w / 2) * prof * (.55 + r() * .5);
    const t = 230 + r() * 25 | 0;
    x.strokeStyle = `rgba(${t},${t - 6},${t - 18},${.5 + r() * .45})`;
    x.lineWidth = .6 + r() * 1.2;
    x.beginPath(); x.moveTo(w / 2, y);
    x.quadraticCurveTo(w / 2 + cote * long * .5, y - long * .15, w / 2 + cote * long, y - long * (.35 + r() * .3));
    x.stroke();
  }
  x.strokeStyle = 'rgba(225,215,195,.9)'; x.lineWidth = 2.2;
  x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, h * .03); x.stroke();
  TEX_PLUME = new THREE.CanvasTexture(c);
  TEX_PLUME.colorSpace = THREE.SRGBColorSpace; TEX_PLUME.anisotropy = 4;
  return TEX_PLUME;
}
const MAT_PLUMES = {};
function matPlume(couleur) {
  if (MAT_PLUMES[couleur]) return MAT_PLUMES[couleur];
  const m = new THREE.MeshStandardMaterial({ color: couleur, map: texturePlume(), alphaTest: .32, side: THREE.DoubleSide, roughness: 1, emissive: new THREE.Color('#FFD9A6'), emissiveMap: texturePlume(), emissiveIntensity: .1 });
  m.name = 'plume:' + couleur;
  LUMINEUX.push({ m, jour: .1, soir: .9 });
  MAT_PLUMES[couleur] = m;
  return m;
}
// une plume : part de o, monte vers dir puis retombe (chute en radians), largeur maxi w
function geoPlume(o, dir, long, w, chute, r) {
  const ns = 16, nw = 5, pos = [], uv = [], idx = [];
  const lat = V3().crossVectors(dir, V3(0, 1, 0)).normalize();
  if (lat.lengthSq() < .5) lat.set(1, 0, 0);
  let p = o.clone(), d = dir.clone().normalize();
  const axe = lat.clone(), pas = long / ns;
  for (let i = 0; i <= ns; i++) {
    const t = i / ns, larg = w * Math.sin(Math.PI * Math.min(1, Math.pow(t, .7) * .98 + .02)) * (t < .12 ? t / .12 : 1);
    const haut = V3().crossVectors(lat, d).normalize();
    for (let j = 0; j < nw; j++) {
      const u = j / (nw - 1), s = (u - .5) * larg, pli = (1 - Math.abs(u - .5) * 2) * larg * .12;
      pos.push(p.x + lat.x * s + haut.x * pli, p.y + lat.y * s + haut.y * pli, p.z + lat.z * s + haut.z * pli);
      uv.push(u, t);
    }
    // la plume ploie : la direction tourne vers le bas autour de l'axe latéral
    d.applyAxisAngle(axe, -chute / ns * (.4 + 1.2 * t)).normalize();
    p.addScaledVector(d, pas);
  }
  for (let i = 0; i < ns; i++) for (let j = 0; j < nw - 1; j++) { const a = i * nw + j, b = a + 1, c = a + nw, e = c + 1; idx.push(a, b, c, b, e, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export const LUMINAIRES = {
  /* Luna Stack : tige noire, boîtier, trois coupelles d'albâtre empilées, pointe */
  'lst-min-03'(p, o = {}) {
    const g = groupe('suspension');
    const { d } = geometrieSuspension(p, o);
    const noir = M('noir'), alb = lumineux('albatre', ['#F8EFE4', '#E0C4A6'], '#FFD6A8', .28, 2);
    const r = clamp(p.dim[0] / 2, .06, .1), hc = r * .84;
    rosace(g, .04, noir);
    cable(g, d, noir);
    let y = -d;
    cyl(g, .016, .016, .1, noir, 0, y - .1, 0, 16); y -= .1;
    cyl(g, .005, .005, .045, noir, 0, y - .045, 0, 8); y -= .045;
    for (let k = 0; k < 3; k++) {
      // coupelle : dessus plat, fond en demi-sphère
      const prof = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; prof.push([Math.sin(a) * r, -Math.cos(a) * hc]); }
      prof.push([r * .985, -.002], [r * .9, 0], [0, 0]);
      tourne(g, prof, alb, 0, y, 0, 40);
      y -= hc + .012;
      cyl(g, .005, .005, .012, noir, 0, y, 0, 8);
    }
    cyl(g, .005, .005, .05, noir, 0, y - .05, 0, 8);
    tourne(g, [[0, -.035], [.006, -.012], [.008, 0], [0, .001]], noir, 0, y - .05, 0, 10);
    halo(g, .7, 0, -d - .25, 0);
    return g;
  },

  /* Luna Balance : moyeu noir, trois bras horizontaux de longueurs
     différentes, montants, coupelles noires cerclées de laiton et grands
     disques d'opaline plats ; câbles fins jusqu'au plafond */
  'sus-lnb-34'(p, o = {}) {
    const g = groupe('suspension');
    const { d } = geometrieSuspension(p, o);
    const noir = M('noir'), opale = M('opale:#FFE6C4');
    const yh = -d - .34, rd = clamp(p.dim[0] * .22, .13, .2);
    rosace(g, .05, noir);
    cyl(g, .045, .045, .028, noir, 0, yh, 0, 24);
    // câble d'alimentation du moyeu, en courbe lâche
    boudin(g, [[0, yh + .028, 0], [.05, yh + .12, .03], [-.02, yh + .25, .05], [.03, -d * .5, .02], [0, 0, 0]], .003, noir, { seg: 40, radial: 5, bouts: false });
    const bras = [[2.55, .27, .12], [-.1, .34, .2], [4.35, .24, .3]];   // angle, longueur, hauteur du montant
    bras.forEach(([an, lg, hm]) => {
      const dx = Math.cos(an), dz = Math.sin(an), x = dx * lg, z = dz * lg;
      const b = place(g, mesh(new THREE.BoxGeometry(lg, .012, .012), noir), dx * lg / 2, yh + .014, dz * lg / 2);
      b.rotation.y = -an;
      cyl(g, .006, .006, hm, noir, x, yh + .014, z, 8);
      const yc = yh + .014 + hm;
      cyl(g, .042, .036, .045, noir, x, yc, z, 24);
      tore(g, .042, .004, M('laiton'), x, yc + .045, z);
      cyl(g, .03, .03, .004, M('led:#FFE2B8'), x, yc + .043, z, 20);
      const yd = yc + .085;
      cyl(g, rd, rd, .008, opale, x, yd, z, 48);
      cyl(g, .009, .009, .035, noir, x, yd + .008, z, 10);
      cable(g, -(yd + .043), noir, x, z);
    });
    halo(g, 1.4, 0, yh + .2, 0);
    return g;
  },

  /* Wood Orb Duo : plaque ovale en noyer, globe opalin au centre, deux
     demi-sphères en métal noir au-dessus et au-dessous */
  'wom-wall-2414'(p) {
    const g = groupe('applique');
    const w = clamp(p.dim[0], .1, .2), h = clamp(p.dim[2], .25, .45), ep = .028;
    const bois = matiere('bois', '#6E4A33', { couleurs: ['#7A5338', '#4B2E1E'], echelle: .35 });
    panneau(g, rectCoins(w - .01, h - .01, (w - .01) / 2), ep, bois, 'face', 0, 0, ep / 2, { a: .005 });
    const rg = w * .39;
    sphere(g, rg, M('opale:#FFE0B5'), 0, 0, ep + rg * .82, 1, 1, 1, 28);
    cyl(g, .018, .02, .012, M('noir'), 0, 0, ep, 16).rotation.x = Math.PI / 2;
    [-1, 1].forEach(k => tourne(g, [[0, 0], [.02, 0], [.019, .006], [.014, .013], [.007, .017], [0, .018]], M('noir'), 0, k * h * .33, ep, 20).rotation.x = Math.PI / 2);
    halo(g, .8, 0, 0, .12);
    return g;
  },

  /* Feather Palm : tronc doré noueux sur pied griffu, couronne de plumes
     d'autruche ivoire et champagne */
  'fpf-lamp-7705'(p) {
    const g = groupe('lampadaire');
    const H = clamp(p.dim[2], 1.3, 2), or = M('or'), r = alea(7705);
    const yc = H - .38;
    // tronc légèrement sinueux, plus épais en bas, surface noueuse, fourche sous la couronne
    const tronc = geoBoudin([[0, .05, 0], [.015, H * .25, .01], [-.012, H * .5, -.01], [.02, H * .72, .015], [.005, yc, 0]], t => .036 - .014 * t, { seg: 60, radial: 12, kb: .4 });
    g.add(mesh(bosseler(tronc, .005, 40, 3), or));
    const fourche = geoBoudin([[.018, yc - .36, .012], [-.03, yc - .22, .02], [-.07, yc - .08, .03], [-.075, yc + .01, .03]], t => .02 - .007 * t, { seg: 24, radial: 10, kb: .5 });
    g.add(mesh(bosseler(fourche, .003, 50, 4), or));
    // pied griffu : quatre orteils qui s'étalent au sol
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + .5, c = Math.cos(a), s = Math.sin(a);
      boudin(g, [[0, .12, 0], [c * .07, .06, s * .07], [c * .16, .02, s * .16], [c * .25, .012, s * .25]], t => .028 - .018 * t, or, { seg: 20, radial: 8 });
    }
    // couronne : plumes en corolle, dressées puis retombantes
    const tons = ['#F0E7D6', '#E7D7B6', '#DCC6A0', '#F4EEE2'], n = 68;
    tons.forEach((ton, iT) => {
      for (let i = iT; i < n; i += tons.length) {
        const phi = i * 2.39996, el = .35 + (i % 7) / 7 * 1.05 + r() * .12;
        const dir = V3(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
        const base = V3((r() - .5) * .06 - .03, yc + r() * .04, (r() - .5) * .06 + .015);
        g.add(mesh(geoPlume(base.addScaledVector(dir, .02), dir, .52 + r() * .18, .27 + r() * .08, 1.7 + r() * .8, r), matPlume(ton), false));
      }
    });
    sphere(g, .04, M('opale:#FFE0B5'), 0, yc + .02, 0);
    halo(g, 1.2, 0, yc + .05, 0);
    ombreSol(g, .7, .7);
    return g;
  }
};
