/* =================================================================
   RealRoom — modèles fidèles : lits (d'après les photos produits)
   Origine au sol, centrée, tête de lit vers -z, pied vers +z.
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, clamp, lerp,
  coussin, boudin, tambour, panneau, matiere, ombreSol, literie
} from './outils.js';

// literie (matelas, couette, oreillers) centrée en (0, y, z) pour un couchage w × l
function draps(g, w, l, y, z, accent) {
  const s = groupe(); s.position.z = z; g.add(s);
  literie(s, w, l, y, accent);
  return s;
}

export const LITS = {
  /* Cloud Bubble : bouclette ivoire ; tête de lit large en tubes verticaux
     qui accueille deux chevets ronds, cadre en « bulles » sur trois côtés */
  'cbb-03'(p, o = {}) {
    const g = groupe('lit');
    const [W, D, H] = p.dim;
    const m = matiere('boucle', '#ECE5D4');
    const ep = .25, Wf = clamp(W - .9, 1.6, 2.2), zt = -D / 2, et = .24;
    // tête de lit : tubes verticaux jointifs sur toute la largeur
    const n = Math.max(7, Math.round(W / .27)), wc = W / n;
    for (let i = 0; i < n; i++) coussin(g, wc - .004, H, et, m, -W / 2 + wc * (i + .5), 0, zt + et / 2, { r: wc * .47, b: [0, .004, .022], seg: 8 });
    // cadre en bulles : pied, puis les deux côtés
    const hb = .36, zp = D / 2 - ep / 2, nP = Math.max(4, Math.round(Wf / .33)), wp = Wf / nP;
    for (let i = 0; i < nP; i++) coussin(g, wp - .006, hb, ep, m, -Wf / 2 + wp * (i + .5), 0, zp, { r: .11, b: [.016, .018, .02], seg: 8 });
    const z0 = zt + et - .02, z1 = D / 2 - ep, nC = Math.max(3, Math.round((z1 - z0) / .33)), lc = (z1 - z0) / nC;
    [-1, 1].forEach(k => { for (let i = 0; i < nC; i++) coussin(g, ep, hb, lc - .006, m, k * (Wf / 2 - ep / 2), 0, z0 + lc * (i + .5), { r: .11, b: [.02, .018, .016], seg: 8 }); });
    // sommier sombre et literie
    coussin(g, Wf - 2 * ep + .02, .12, z1 - z0, M('noirMat'), 0, .1, (z0 + z1) / 2, { r: .01, b: [0, 0, 0] });
    draps(g, Wf - 2 * ep - .02, Math.min(2.02, z1 - z0 - .02), .22, (z0 + z1) / 2, o.accent === undefined ? null : o.accent);
    // chevets ronds devant les ailes de la tête de lit
    const rc = clamp((W - Wf) / 2 / 2 - .01, .17, .25);
    [-1, 1].forEach(k => tambour(g, rc, .5, m, k * (W / 2 - (W - Wf) / 4), 0, zt + et + rc + .03, { b: .012, ah: .06, ab: .02, dome: .006 }));
    ombreSol(g, W + .4, D + .4);
    return g;
  }
};
