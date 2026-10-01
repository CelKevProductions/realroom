/* =================================================================
   RealRoom — modèles fidèles : fauteuils (d'après les photos produits)
   Origine au sol, centrée, face avant vers +z.
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, clamp, lerp,
  coussin, boudin, tambour, geoTambour, panneau, coqueArc, rectCoins, formeLisse,
  matiere, ombreSol
} from './outils.js';

// passepoil : fin boudin sombre le long d'une arête
const passepoil = (g, pts, m, r = .0045) => boudin(g, pts, r, m, { radial: 6, seg: Math.max(8, pts.length * 6), bouts: false });

export const FAUTEUILS = {
  /* Terracotta : velours rouille, dossier de trois bourrelets empilés en
     fer à cheval qui deviennent les accoudoirs, grosse assise, socle noir */
  terracotta(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#9C3F17');
    coussin(g, W * .72, .055, D * .6, M('noirMat'), 0, 0, -.03, { r: .02, b: [0, 0, 0] });
    const n = 3, y0 = .05, rv = (H - y0) / (2 * n) * 1.02, rh = .118;
    const a = W / 2 - rh, zb = -D / 2 + rh, zc = -.04, bz = zc - zb, zf = D / 2 - rh * .95;
    for (let k = 0; k < n; k++) {
      const y = y0 + rv * (1 + 2 * k) * .97, pts = [];
      // bras gauche (de l'avant vers l'arrière), dos en demi-ellipse, bras droit
      for (let i = 0; i <= 4; i++) pts.push([-a, y, lerp(zf, zc, i / 4)]);
      for (let i = 1; i < 16; i++) { const t = Math.PI + i / 16 * Math.PI; pts.push([a * Math.cos(t), y, zc + bz * Math.sin(t)]); }
      for (let i = 0; i <= 4; i++) pts.push([a, y, lerp(zc, zf, i / 4)]);
      boudin(g, pts, rh, m, { plan: true, kv: rv / rh, seg: 90, radial: 22, kb: .55 });
    }
    // bouts des accoudoirs : un seul volume vertical arrondi, du sol au sommet
    [-1, 1].forEach(k => coussin(g, rh * 2, H - .045, .2, m, k * a, .03, zf - .035, { r: .095, b: [.01, .01, .02] }));
    // assise : un gros coussin entre les bras, glissé sous le dossier
    const li = 2 * (a - rh) + .03, zA = zb + rh * .4, zF = D / 2 - .035;
    coussin(g, li, .4, zF - zA, m, 0, y0, (zA + zF) / 2, { r: .09, b: [.008, .035, .03] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Abbraccio : assise tambour en cuir vert sauge pâle, coque de dossier
     à trois couches (cuir dedans, liseré laiton, galets beige dehors),
     coussin lombaire */
  abbraccio(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const cuir = matiere('cuir', '#A0A395'), galets = matiere('cuir', '#ADA28C', { grain: 'galets', echelle: .26, ns: 1.2 });
    const r = Math.min(W, D) / 2 - .04, hs = .46, zc = .035;
    tambour(g, r, hs, cuir, 0, 0, zc, { b: .028, ah: .085, ab: .035, dome: .012, seg: 56 });
    const R0 = r + .014, span = 3.25;
    coqueArc(g, R0, R0 + .026, span, H - .01, cuir, 0, 0, zc, .011);
    coqueArc(g, R0 + .026, R0 + .033, span + .004, H - .002, M('laiton'), 0, 0, zc, .003);
    coqueArc(g, R0 + .033, R0 + .066, span - .01, H - .006, galets, 0, 0, zc, .014);
    coussin(g, .44, .27, .12, cuir, 0, hs + .03, zc - R0 + .11, { rx: -.2, r: .05, b: [.008, .02, .028] });
    ombreSol(g, W + .3, D + .3);
    return g;
  },

  /* Terra : velours framboise, flancs pleins jusqu'au sol, assise
     suspendue entre les flancs, coussins d'assise et de dossier à liseré sombre */
  'fauteuil-velours-terracotta-pietement-plein-terra'(p) {
    const g = groupe('fauteuil');
    const [W, D, H] = p.dim;
    const m = matiere('velours', '#86302C'), lis = matiere('velours', '#5A1A17');
    const ep = .1, hb = .62, zd = -D / 2 + .1;
    // flancs : dalles épaisses arrondies, posées au sol
    // légèrement ouverts vers l'avant, le dessus roulé
    [-1, 1].forEach(k => coussin(g, ep, hb, D - .04, m, k * (W / 2 - ep / 2 - .015), 0, 0, { r: .048, b: [.012, .012, .006], ry: -k * .07 }));
    // dos : rejoint les flancs (fer à cheval vu de dessus)
    coussin(g, W - .02, hb - .2, .13, m, 0, .2, zd, { r: .05, b: [.004, .01, .012] });
    // caisse d'assise flottante et coussins
    const li = W - 2 * ep;
    coussin(g, li + .01, .13, D - .2, m, 0, .2, .04, { r: .04 });
    const ya = .33, za = .05, da = D - .24;
    coussin(g, li - .02, .12, da, m, 0, ya, za, { r: .045, b: [.006, .02, .01] });
    passepoil(g, [[-li / 2 + .02, ya + .118, za + da / 2 - .005], [li / 2 - .02, ya + .118, za + da / 2 - .005]], lis);
    passepoil(g, [[-li / 2 + .02, ya + .005, za + da / 2 - .005], [li / 2 - .02, ya + .005, za + da / 2 - .005]], lis);
    const cd = coussin(g, li - .05, .43, .14, m, 0, ya + .1, zd + .14, { rx: -.13, r: .06, b: [.008, .02, .03] });
    // liseré tout autour du coussin de dossier (dans son repère)
    const s = groupe(); s.position.copy(cd.position); s.rotation.copy(cd.rotation); g.add(s);
    const lw = (li - .05) / 2 - .03, lh = .43 / 2 - .03;
    passepoil(s, [[-lw, -lh, .075], [lw, -lh, .075], [lw + .025, 0, .075], [lw, lh, .075], [-lw, lh, .075], [-lw - .025, 0, .075], [-lw, -lh, .075]], lis);
    ombreSol(g, W + .3, D + .3);
    return g;
  }
};
