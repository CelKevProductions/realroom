// Contrat de la démo : envoyer le plan et le brief, sans compte, rendu ni photo de relevé.
import { FONCTIONS } from './config.js';
import { FAMILLES_RELEVEES } from './piece.js';
import { segmentsDe, validerContour } from './contour.js';

export class ErreurDemoIA extends Error {
  constructor(code = 'demande-demo') { super(code); this.code = code; }
}
const refuser = () => { throw new ErreurDemoIA(); };
const objet = x => x && typeof x === 'object' && !Array.isArray(x);
const nombre = (x, min, max) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const texte = (x, max) => typeof x === 'string' && x.length <= max;
const idValide = x => typeof x === 'string' && /^[a-z0-9_-]{1,40}$/i.test(x);

export function demandeDemoIA(piece, choix, langue, inspirations = []) {
  return {
    piece: { fonction: piece.fonction, modele: piece.modele, agencement: piece.agencement || [], notes: piece.notes || '' },
    choix: { mode: choix.mode || 'tout', envies: choix.envies || '', budget: choix.budget || 0, garder: choix.garder || [], aRemplacer: choix.aRemplacer || [], moteurGuide: choix.moteurGuide !== false },
    langue: langue === 'en' ? 'en' : 'fr', inspirations
  };
}

export function validerDemoIA(b, produits) {
  if (!objet(b) || !objet(b.piece) || !objet(b.piece.modele) || !FONCTIONS.includes(b.piece.fonction)) refuser();
  const p = b.piece, m = p.modele, d = m.dims;
  if (!objet(d) || !nombre(d.largeur, 1.2, 30) || !nombre(d.profondeur, 1.2, 30) || !nombre(d.hauteur, 1.9, 8)) refuser();
  const modele = { dims: { largeur: d.largeur, profondeur: d.profondeur, hauteur: d.hauteur, estimees: d.estimees === true }, murs: {} };
  if (m.contour !== undefined) {
    try { modele.contour = validerContour(m.contour).map(pt => [...pt]); } catch (_) { refuser(); }
    const xs = modele.contour.map(pt => pt[0]), zs = modele.contour.map(pt => pt[1]);
    if (Math.max(...xs) - Math.min(...xs) > d.largeur + .02 || Math.max(...zs) - Math.min(...zs) > d.profondeur + .02) refuser();
  }
  if (!objet(m.murs)) refuser();
  const murs = new Set(segmentsDe(modele).map(s => s.id));
  for (const id of murs) {
    const mur = m.murs[id];
    if (!objet(mur) || !Array.isArray(mur.ouvertures) || mur.ouvertures.length > 12) refuser();
    const ouvertures = mur.ouvertures.map(o => {
      if (!objet(o) || !['porte', 'fenetre', 'baie', 'passage'].includes(o.type) || !nombre(o.position, -30, 30) || !nombre(o.largeur, .01, 30) || !nombre(o.hauteur, .01, 8) || (o.allege !== undefined && !nombre(o.allege, 0, 8))) refuser();
      return { type: o.type, position: o.position, largeur: o.largeur, hauteur: o.hauteur, allege: o.allege || 0,
        ...(nombre(o.confiance, 0, 1) ? { confiance: o.confiance } : {}),
        ...(o.battant === 'gauche' || o.battant === 'droite' ? { battant: o.battant } : {}) };
    });
    modele.murs[id] = { ouvertures, observe: typeof mur.observe === 'boolean' ? mur.observe : null, couleur: /^#[0-9a-f]{6}$/i.test(mur.couleur || '') ? mur.couleur : '#EFEAE2' };
  }
  if (m.style !== undefined && !texte(m.style, 120)) refuser();
  modele.style = m.style || '';
  if (m.remarques !== undefined && (!Array.isArray(m.remarques) || m.remarques.length > 10 || m.remarques.some(x => !texte(x, 300)))) refuser();
  modele.remarques = m.remarques || [];
  if (objet(m.sol)) modele.sol = Object.fromEntries(Object.entries(m.sol).filter(([k, v]) => ['matiere', 'couleur'].includes(k) && texte(v, 80)));
  if (!Array.isArray(p.agencement) || p.agencement.length > 80 || !texte(p.notes, 1000)) refuser();
  const ids = new Set();
  const agencement = p.agencement.map(it => {
    if (!objet(it) || !idValide(it.id) || ids.has(it.id) || !nombre(it.x, -30, 30) || !nombre(it.z, -30, 30) || !nombre(it.rot, -100, 100) || (it.y !== undefined && !nombre(it.y, 0, 8)) || (it.mur !== undefined && !murs.has(it.mur))) refuser();
    ids.add(it.id);
    const n = { id: it.id, origine: it.origine, x: it.x, z: it.z, rot: it.rot, garde: it.garde !== false };
    if (it.y !== undefined) n.y = it.y;
    if (it.mur !== undefined) n.mur = it.mur;
    if (it.origine === 'catalogue') {
      if (!idValide(it.sku) || !Object.hasOwn(produits, it.sku)) refuser();
      n.sku = it.sku; // prix et dimensions viennent exclusivement du catalogue serveur
    } else if (it.origine === 'existant') {
      const q = it.p;
      if (!objet(q) || !texte(q.nom, 80) || !FAMILLES_RELEVEES.includes(q.fam) || !Array.isArray(q.dim) || q.dim.length !== 3 || q.dim.some(v => !nombre(v, .01, 8))) refuser();
      n.p = { nom: q.nom, fam: q.fam, dim: [...q.dim], st: texte(q.st, 40) ? q.st : '', mat: texte(q.mat, 40) ? q.mat : 'autre', cols: Array.isArray(q.cols) ? q.cols.filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 3) : [] };
    } else refuser();
    return n;
  });
  const c = b.choix;
  if (!objet(c) || !['tout', 'partiel'].includes(c.mode) || !texte(c.envies, 1200) || !nombre(c.budget, 0, 1e6)) refuser();
  for (const k of ['garder', 'aRemplacer']) if (!Array.isArray(c[k]) || c[k].length > 80 || c[k].some(x => !idValide(x))) refuser();
  const inspirations = b.inspirations || [];
  if (!Array.isArray(inspirations) || inspirations.length > 3 || inspirations.some(i => !objet(i) || !texte(i.dataUri, 400000) || !/^data:image\/(?:jpeg;base64,\/9j\/|png;base64,iVBORw0KGgo|webp;base64,UklGR)/.test(i.dataUri))) throw new ErreurDemoIA('inspiration-demo');
  return { piece: { fonction: p.fonction, modele, agencement, notes: p.notes }, choix: { mode: c.mode, envies: c.envies, budget: c.budget, garder: [...c.garder], aRemplacer: [...c.aRemplacer], moteurGuide: c.moteurGuide !== false }, langue: b.langue === 'en' ? 'en' : 'fr', inspirations: inspirations.map(i => ({ dataUri: i.dataUri })) };
}
