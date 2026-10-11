// Géométrie paramétrique corrigée par le client, commune à l'API et à la démo.
// Une correction ne relance pas l'IA et ne supprime jamais un meuble du relevé.
import { MURS, produitDe, porteurDe, normaliserAngle } from './agencement.js';
import { segmentsDe, validerContour, contientPoint } from './contour.js';
import { dimsValides, FAMILLES_RELEVEES } from './piece.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rond = v => Math.round(v * 100) / 100;
const nombre = (v, def) => typeof v === 'number' && Number.isFinite(v) ? v : def;
export const longueurMur = (dims, mur, modele) => modele?.contour ? segmentsDe(modele).find(p=>p.id===mur)?.long || .3 : ['fond', 'entree'].includes(mur) ? dims.largeur : dims.profondeur;
export const mesuresConfirmees = modele => Object.fromEntries(['largeur', 'profondeur', 'hauteur'].map(k => [k,
  modele.dims.sources?.[k] === 'mesure' ? modele.dims[k] : null
]));

export function corrigerGeometrie(modele, correction = {}) {
  const valeurs = dimsValides(correction.dims) || {};
  const sources = Object.fromEntries(['largeur', 'profondeur', 'hauteur'].map(k => [k,
    ['photo', 'scan', 'estimation', 'mesure'].includes(correction.sources?.[k]) ? correction.sources[k]
      : valeurs[k] ? 'mesure' : modele.dims.sources?.[k] || (modele.dims.estimees === false ? 'mesure' : 'photo')
  ]));
  const dims = { ...modele.dims, ...Object.fromEntries(Object.entries(valeurs).filter(([, v]) => v)), sources };
  dims.estimees = Object.values(sources).some(s => s !== 'mesure');
  let contour;
  if (correction.contour !== undefined) { validerContour(correction.contour); contour=correction.contour.map(p=>p.map(rond)); }
  else if (modele.contour) contour=modele.contour.map(([x,z])=>[rond(x*dims.largeur/modele.dims.largeur),rond(z*dims.profondeur/modele.dims.profondeur)]);
  if (contour) {
    validerContour(contour);
    const xs=contour.map(p=>p[0]), zs=contour.map(p=>p[1]);
    const L=Math.max(...xs)-Math.min(...xs),P=Math.max(...zs)-Math.min(...zs);
    if(L<1.2||P<1.2||L>30||P>30) throw new Error('scan-dimensions');
    // Le cadre conserve le repère de la pièce ; des coins hors du cadre demandent sa correction.
    if(xs.some(x=>Math.abs(x)>dims.largeur/2+.02)||zs.some(z=>Math.abs(z)>dims.profondeur/2+.02)) throw new Error('scan-dimensions');
  }
  const geometrie={...modele,dims,...(contour?{contour}:{})};
  const murs = {};
  for (const {id:mur} of segmentsDe(geometrie)) {
    const ancien = modele.murs?.[mur] || { couleur: '#EFEAE2', observe: null, ouvertures: [] };
    const saisie = correction.murs?.[mur];
    const edite = Array.isArray(saisie?.ouvertures);
    const long = longueurMur(dims, mur, geometrie);
    const rapport = long / (longueurMur(modele.dims, mur, modele) || long);
    const ouvertures = (edite ? saisie.ouvertures : ancien.ouvertures || []).filter(o => o && typeof o === 'object').slice(0, 6).map(o => {
      const type = ['fenetre', 'porte', 'baie', 'passage'].includes(o.type) ? o.type : 'fenetre';
      const largeur = rond(clamp(nombre(o.largeur, .9), .3, long - .1));
      const position = rond(clamp(nombre(o.position, 0) * (edite ? 1 : rapport), -long / 2 + largeur / 2, long / 2 - largeur / 2));
      const allege = ['porte', 'passage'].includes(type) ? 0 : rond(clamp(nombre(o.allege, type === 'baie' ? 0 : .9), 0, dims.hauteur - .45));
      const hauteur = rond(clamp(nombre(o.hauteur, type === 'porte' ? 2.04 : 1.2), .4, dims.hauteur - allege - .03));
      return { type, largeur, position, allege, hauteur, confiance: edite ? 1 : nombre(o.confiance, .6) };
    });
    murs[mur] = { ...ancien, ouvertures, ...(edite ? { observe: true } : {}) };
  }
  const rx = dims.largeur / modele.dims.largeur, rz = dims.profondeur / modele.dims.profondeur;
  const vue = modele.vue && { ...modele.vue,
    x: rond(nombre(modele.vue.x, 0) * rx), z: rond(nombre(modele.vue.z, 0) * rz),
    cx: rond(nombre(modele.vue.cx, 0) * rx), cz: rond(nombre(modele.vue.cz, 0) * rz),
    y: rond(clamp(nombre(modele.vue.y, 1.5), .8, dims.hauteur - .15))
  };
  return { ...modele, ...(contour?{contour}:{}), dims, murs, ...(vue ? { vue } : {}) };
}

export function corrigerPiece(modele, items, correction, catalogue = {}) {
  const nouveau = corrigerGeometrie(modele, correction);
  const rx = nouveau.dims.largeur / modele.dims.largeur, rz = nouveau.dims.profondeur / modele.dims.profondeur;
  const mesures = new Map((Array.isArray(correction.meubles) ? correction.meubles : []).slice(0, 40)
    .filter(m => m && typeof m.id === 'string' && Array.isArray(m.dim) && m.dim.length === 3
      && m.dim.every(v => typeof v === 'number' && Number.isFinite(v) && v >= .01 && v <= 6))
    .map(m => [m.id, m.dim.map(rond)]));
  let agencement = items.map(it => {
    const dim = it.origine === 'existant' && mesures.get(it.id);
    return { ...it, x: rond(it.x * rx), z: rond(it.z * rz),
      ...(dim && it.p ? { p: { ...it.p, dim, dimsLues: true }, confiance: 1 } : {})
    };
  });
  // Un objet posé sur un plateau conserve son décalage réel par rapport au support.
  const avant = items.filter(it => it.garde !== false).map(it => ({ it, p: produitDe(it, catalogue) })).filter(e => e.p?.dim);
  const apres = new Map(agencement.map(it => [it.id, it]));
  agencement = agencement.map(it => {
    const entree = avant.find(e => e.it.id === it.id);
    const support = entree && porteurDe(entree.it, entree.p, avant);
    if (!support) return it;
    const s = apres.get(support.it.id);
    return { ...it, x: rond(s.x + entree.it.x - support.it.x), z: rond(s.z + entree.it.z - support.it.z) };
  });
  // Le relevé Android ne reconnaît pas le mobilier. Le client peut noter les objets à conserver.
  // Identifiants propres, mesures bornées, pas de produit catalogue ni de contenu arbitraire.
  const ids = new Set(agencement.map(it => it.id));
  for (const m of (Array.isArray(correction.ajouts) ? correction.ajouts : []).slice(0, Math.max(0, Math.min(40, 80 - agencement.length)))) {
    if (!m || typeof m.id !== 'string' || !/^m_[a-z0-9_-]{1,32}$/i.test(m.id) || ids.has(m.id)
      || !FAMILLES_RELEVEES.includes(m.fam) || !Array.isArray(m.dim) || m.dim.length !== 3
      || !m.dim.every(v => typeof v === 'number' && Number.isFinite(v) && v >= .01 && v <= 6)
      || ![m.x, m.z, m.rot].every(v => typeof v === 'number' && Number.isFinite(v))
      || !contientPoint(nouveau,m.x,m.z)) continue;
    agencement.push({ id: m.id, origine: 'existant', x: rond(m.x), z: rond(m.z), rot: normaliserAngle(m.rot), garde: true, confiance: 1,
      p: { nom: typeof m.nom === 'string' ? m.nom.trim().slice(0, 80) || m.fam : m.fam, fam: m.fam,
        dim: m.dim.map(rond), cols: ['#B8AFA2'], mat: 'tissu', metal: 'noir', bois: '', st: '', dimsLues: true } });
    ids.add(m.id);
  }
  return { modele: nouveau, agencement };
}
