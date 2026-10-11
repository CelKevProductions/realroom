import {segmentsDe,contourDe,aireSignee} from './contour.js';
// Modèle d'une pièce : passage entre le repère « naturel » donné à Claude (x depuis le centre,
// vers la droite ; p = profondeur mesurée depuis le mur d'entrée) et le repère 3D de l'éditeur
// (z = profondeur/2 - p ; voir lib/agencement.js), nettoyage des valeurs, meubles existants.
import { ANGLES, MURS, normaliserAngle, estMural } from './agencement.js';
import { familleReleve, estInstallation, usageDe } from './usages.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 100) / 100;
const num = (v, def) => (typeof v === 'number' && isFinite(v) ? v : def);
const hex = (c, def) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim().toUpperCase() : def);

// familles que Claude peut relever sur les photos -> famille des constructeurs 3D
export const FAMILLES_RELEVEES = ['lit', 'canape', 'fauteuil', 'chaise', 'table', 'bureau', 'meuble', 'commode', 'armoire', 'etagere', 'bibliotheque', 'tv', 'tv-murale', 'chevet', 'console', 'radiateur', 'cheminee', 'cuisine', 'tapis', 'plante', 'suspension', 'lustre', 'plafonnier', 'applique', 'lampadaire', 'lampe', 'miroir', 'tableau', 'baignoire', 'tabouret', 'banc', 'pouf', 'meridienne', 'autre'];
const MATIERES = { tissu: 'tissu', velours: 'velours', cuir: 'cuir', bois: 'bois', metal: 'laque', verre: 'laque', plastique: 'laque', pierre: 'laque', rotin: 'corde', autre: 'tissu' };

export const DIMS_DEFAUT = { largeur: 4, profondeur: 5, hauteur: 2.5 };

export function dimsValides(d) {
  if (!d) return null;
  const L = num(+d.largeur, NaN), P = num(+d.profondeur, NaN), H = num(+d.hauteur, NaN);
  const ok = v => isFinite(v) && v > 0;
  return {
    largeur: ok(L) ? clamp(L, 1.2, 30) : null,
    profondeur: ok(P) ? clamp(P, 1.2, 30) : null,
    hauteur: ok(H) ? clamp(H, 1.9, 8) : null
  };
}

// réponse de l'analyse (repère Claude) -> { modele, meubles } dans le repère 3D
export function depuisAnalyse(a, saisie = {}) {
  const d = a.dimensions || {};
  const L = r2(clamp(num(saisie.largeur, num(d.largeur, DIMS_DEFAUT.largeur)), 1.2, 30));
  const P = r2(clamp(num(saisie.profondeur, num(d.profondeur, DIMS_DEFAUT.profondeur)), 1.2, 30));
  const H = r2(clamp(num(saisie.hauteur, num(d.hauteur, DIMS_DEFAUT.hauteur)), 1.9, 8));
  const z = p => r2(clamp(P / 2 - p, -P / 2, P / 2));
  const murs = {};
  for (const m of MURS) {
    const src = (a.murs && a.murs[m]) || {};
    const long = m === 'fond' || m === 'entree' ? L : P;
    murs[m] = {
      couleur: hex(src.couleur, '#EFEAE2'),
      observe: typeof src.observe === 'boolean' ? src.observe : null,
      ouvertures: (Array.isArray(src.ouvertures) ? src.ouvertures : []).slice(0, 6).map(o => {
        const type = ['fenetre', 'porte', 'baie', 'passage'].includes(o.type) ? o.type : 'fenetre';
        const largeur = r2(clamp(num(o.largeur, .9), .3, long - .2));
        const brut = num(o.position, 0);
        // fond / entrée : x ; gauche / droite : profondeur depuis l'entrée -> z
        const pos = m === 'fond' || m === 'entree' ? clamp(brut, -L / 2 + largeur / 2 + .05, L / 2 - largeur / 2 - .05) : clamp(z(brut), -P / 2 + largeur / 2 + .05, P / 2 - largeur / 2 - .05);
        const allege = type === 'porte' || type === 'passage' ? 0 : r2(clamp(num(o.allege, type === 'baie' ? 0 : .9), 0, H - .5));
        const hauteur = r2(clamp(num(o.hauteur, type === 'porte' ? 2.04 : 1.35), .4, H - allege - .05));
        return { type, position: r2(pos), largeur, hauteur, allege, confiance: r2(clamp(num(o.confiance, .6), 0, 1)) };
      })
    };
  }
  const v = a.vue_principale || {};
  const vue = {
    x: r2(clamp(num(v.x, 0), -L / 2 + .15, L / 2 - .15)),
    z: z(clamp(num(v.p, .25), .05, P - .3)),
    y: r2(clamp(num(v.hauteur, 1.5), .8, Math.min(2.2, H - .2))),
    cx: r2(num(v.vise_x, 0)),
    cy: 1.05,
    cz: z(num(v.vise_p, P)),
    fov: r2(clamp(num(v.champ_vertical, 50), 30, 85))
  };
  const modele = {
    v: 1,
    dims: { largeur: L, profondeur: P, hauteur: H, estimees: !(saisie.largeur && saisie.profondeur && saisie.hauteur),
      sources: Object.fromEntries(['largeur', 'profondeur', 'hauteur'].map(k => [k, saisie[k] > 0 ? 'mesure' : 'photo'])) },
    murs,
    sol: { matiere: ['parquet', 'carrelage', 'marbre', 'moquette', 'beton', 'vinyle', 'autre'].includes(a.sol && a.sol.matiere) ? a.sol.matiere : 'parquet', couleur: hex(a.sol && a.sol.couleur, '#B9A58B') },
    plafond: { couleur: hex(a.plafond && a.plafond.couleur, '#F6F4EF') },
    style: String(a.style || '').slice(0, 120),
    ambiance: String(a.ambiance || '').slice(0, 300),
    remarques: (Array.isArray(a.remarques) ? a.remarques : []).slice(0, 4).map(s => String(s).slice(0, 200)),
    vue
  };
  const meubles = (Array.isArray(a.meubles) ? a.meubles : []).slice(0, 40).map((m, i) => existant(m, i, modele)).filter(Boolean);
  return { modele, meubles };
}

function existant(m, i, modele) {
  const { largeur: L, profondeur: P, hauteur: H } = modele.dims;
  const reconnue = familleReleve(m);
  const fam = FAMILLES_RELEVEES.includes(reconnue) ? reconnue : 'autre';
  const dim = [num(m.largeur, .8), num(m.profondeur, .6), num(m.hauteur, .8)].map(v => r2(clamp(v, .05, 6)));
  if (fam === 'tapis') dim[2] = .01;
  const cols = (Array.isArray(m.couleurs) ? m.couleurs : []).map(c => hex(c, null)).filter(Boolean).slice(0, 3);
  const rot = normaliserAngle(ANGLES[m.oriente_vers] ?? 0);
  const it = {
    id: 'e' + (i + 1),
    origine: 'existant',
    p: {
      nom: String(m.nom || 'Meuble').slice(0, 80), fam, st: String(m.style || '').slice(0, 40), dim, cols: cols.length ? cols : ['#B8AFA2'],
      couleurs: [], mat: MATIERES[m.matiere] || 'tissu', metal: 'noir', bois: m.matiere === 'bois' ? 'chene' : '', dimsLues: false
    },
    x: r2(clamp(num(m.x, 0), -L / 2, L / 2)),
    z: r2(clamp(P / 2 - num(m.p, P / 2), -P / 2, P / 2)),
    rot,
    confiance: r2(clamp(num(m.confiance, .6), 0, 1)),
    garde: true
  };
  if (estMural(fam)) {
    it.mur = MURS.includes(m.contre_mur) ? m.contre_mur : undefined;
    it.y = r2(clamp(num(m.hauteur_pose, fam === 'applique' ? 1.65 : 1.5), .4, H - .2));
    // Le relevé reste un constat : on ne déplace pas l'objet vers un autre pan de mur.
    if (it.mur === 'fond') { it.z = -P / 2; it.rot = ANGLES.entree; }
    if (it.mur === 'entree') { it.z = P / 2; it.rot = ANGLES.fond; }
    if (it.mur === 'gauche') { it.x = -L / 2; it.rot = ANGLES.droite; }
    if (it.mur === 'droite') { it.x = L / 2; it.rot = ANGLES.gauche; }
  }
  return it;
}

// vers le repère de Claude (aménagement) : x inchangé, p = profondeur depuis l'entrée
export function versClaude(modele, items, catalogue) {
  const { largeur: L, profondeur: P, hauteur: H } = modele.dims;
  const p = z => r2(P / 2 - z);
  const orient = rot => { const a = normaliserAngle(rot || 0); return Object.entries(ANGLES).reduce((m, [k, v]) => (Math.abs(normaliserAngle(a - v)) < Math.abs(normaliserAngle(a - ANGLES[m])) ? k : m), 'entree'); };
  const murs = {};
  for (const {id:m} of segmentsDe(modele)) {
    murs[m] = (modele.murs[m]?.ouvertures || []).map(o => ({ type: o.type, position: modele.contour || m === 'fond' || m === 'entree' ? o.position : p(o.position), largeur: o.largeur, hauteur: o.hauteur, allege: o.allege, confiance: o.confiance ?? null }));
  }
  const meubles = items.map(it => {
    const q = it.sku ? catalogue[it.sku] : it.p;
    if (!q) return null;
    return { id: it.id, nom: q.nom, famille: q.fam, usage: usageDe(q), immobile: estInstallation(it), confiance: it.confiance ?? null, dimensions_cm: q.dim.map(v => Math.round(v * 100)), x: it.x, p: p(it.z), oriente_vers: orient(it.rot), origine: it.origine, ...(it.mur ? { mur: it.mur, hauteur_pose: it.y } : {}) };
  }).filter(Boolean);
  return { dimensions: { largeur: L, profondeur: P, hauteur: H, estimees: modele.dims.estimees }, ...(modele.contour?{contour:contourDe(modele).map(([x,z])=>({x,p:p(z)})),surface_sol_m2:r2(Math.abs(aireSignee(contourDe(modele)))),cadre_englobant:true}:{}), murs_observes: Object.fromEntries(segmentsDe(modele).map(({id:m}) => [m, modele.murs[m]?.observe ?? null])), remarques_releve: modele.remarques || [], ouvertures: murs, sol: modele.sol, couleur_murs: Object.values(modele.murs)[0]?.couleur || '#EFEAE2', style_actuel: modele.style, meubles };
}

// un meuble proposé par Claude (repère Claude) -> élément d'agencement (repère 3D)
export function depuisProposition(m, modele, i) {
  const { profondeur: P, hauteur: H } = modele.dims;
  const it = {
    id: 'c' + Date.now().toString(36) + i,
    origine: 'catalogue',
    sku: m.produit,
    x: r2(num(m.x, 0)),
    z: r2(P / 2 - num(m.p, P / 2)),
    rot: normaliserAngle(ANGLES[m.oriente_vers] ?? 0),
    raison: String(m.raison || '').slice(0, 240)
  };
  if (MURS.includes(m.mur)) it.mur = m.mur;
  if (typeof m.hauteur_pose === 'number') it.y = r2(clamp(m.hauteur_pose, .4, H - .2));
  return it;
}
