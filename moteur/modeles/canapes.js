/* =================================================================
   RealRoom — modèles fidèles : canapés (d'après les photos produits)
   Origine au sol, centrée, face avant vers +z.
   ================================================================= */
import {
  THREE, M, groupe, place, mesh, TAU, clamp, lerp,
  coussin, boudin, panneau, formeBandeArc, surArc, matiere, ombreSol
} from './outils.js';

// géométrie d'un canapé en arc : rayons et angles pour une largeur l et une profondeur p
function arcCanape(l, p, e) {
  // rayon moyen choisi pour que la flèche + l'épaisseur donnent la profondeur
  let rm = 2.4;
  for (let i = 0; i < 30; i++) {
    const re = rm + e / 2, a = Math.asin(Math.min(.98, (l / 2 - e / 2) / rm)), ri = rm - e / 2;
    const prof = re - ri * Math.cos(a) + e / 2 * (1 - Math.cos(a));
    rm *= prof > p ? 1.06 : .97;
  }
  const re = rm + e / 2, ri = rm - e / 2, a = Math.asin(Math.min(.98, (l / 2 - e / 2) / rm));
  const zc = (re + ri * Math.cos(a)) / 2;
  return { rm, re, ri, a0: Math.PI / 2 - a, a1: Math.PI / 2 + a, zc };
}

export const CANAPES = {
  /* Mineral Cloud : canapé courbe sans pieds, velours marbré noir, bleu
     et sable ; gros boudin de dossier qui descend en accoudoirs ronds,
     assise épaisse, trois coussins */
  'mcs-01'(p) {
    const g = groupe('canape');
    const [L, D, H] = p.dim;
    const m = matiere('velours', '#2A2C38', { motif: 'mineral', couleurs: ['#16181F', '#3B4152', '#9C8D70', '#CDBFA0'], echelle: .5 });
    const e = Math.min(D, .95), A = arcCanape(L, D, e);
    const { re, ri, a0, a1, zc } = A, rm = (re + ri) / 2;
    // socle (assise) : bande en arc aux bouts ronds, arêtes très douces
    const bas = .06;
    panneau(g, formeBandeArc(ri + bas, re - bas, a0, a1, -zc), .27, m, 'sol', 0, 0, 0, { a: .09 });
    // remplissage sous le dossier
    panneau(g, formeBandeArc(re - .3, re - .05, a0 + .02, a1 - .02, -zc), .3, m, 'sol', 0, .2, 0, { a: .05 });
    // accoudoirs : pleins jusqu'au sol, bouts ronds
    const da = .27 / rm;
    panneau(g, formeBandeArc(ri + .06, re - .06, a0, a0 + da, -zc), .46, m, 'sol', 0, 0, 0, { a: .07 });
    panneau(g, formeBandeArc(ri + .06, re - .06, a1 - da, a1, -zc), .46, m, 'sol', 0, 0, 0, { a: .07 });
    // coussin d'assise d'un seul tenant entre les accoudoirs
    panneau(g, formeBandeArc(ri + .04, re - .26, a0 + da, a1 - da, -zc), .18, m, 'sol', 0, .25, 0, { a: .07 });
    // boudin du dossier : accoudoir gauche, dos, accoudoir droit
    const rA = ri + .11, rD = re - .14, yA = .47, yD = .63, pts = [];
    for (let i = 0; i <= 3; i++) pts.push(surArc(a0 + .06 / rm, lerp(rA, rD - .05, i / 3), yA + (yD - yA) * (i / 3) * .35, zc));
    for (let i = 1; i < 18; i++) { const t = i / 18; pts.push(surArc(lerp(a0, a1, t), rD, yA + (yD - yA) * (.35 + .65 * Math.sin(Math.PI * t)), zc)); }
    for (let i = 3; i >= 0; i--) pts.push(surArc(a1 - .06 / rm, lerp(rA, rD - .05, i / 3), yA + (yD - yA) * (i / 3) * .35, zc));
    boudin(g, pts, t => .13 + .025 * Math.sin(Math.PI * t), m, { plan: true, kv: 1.45, seg: 120, radial: 22, kb: .8 });
    // trois coussins de dossier, tournés vers le centre de l'arc
    [-.52, 0, .52].forEach((k, i) => {
      const an = Math.PI / 2 + k * (a1 - a0) / 2, [x, , z] = surArc(an, rD - .19, 0, zc);
      coussin(g, .44, .4, .16, m, x, .4, z, { rx: -.3, ry: Math.atan2(-Math.cos(an), Math.sin(an)), ordre: 'YXZ', r: .07, b: [.01, .02, .035] });
    });
    ombreSol(g, L + .4, D + .5);
    return g;
  }
};
