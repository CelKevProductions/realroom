// Assistant sans fournisseur externe. Chaque proposition est un résultat complet
// du même moteur de sélection, budget, placement et finition que l'aménagement IA.
import { preparerAmenagement, appliquerProposition } from './amenagement.js';
import { choisirCandidats } from './selection.js';
import { TYPES_PROGRAMME } from './programme.js';
import { verifier, produitDe } from './agencement.js';
import { ecartsContraintes } from './scene.js';
import { verifierHauteurs } from './hauteurs.js';
import { bilanConfort } from './confort.js';
import { posesStaging } from './staging.js';
import { ancresDisposition, dispositionsDistinctes, signaturePiece, etatVariantes } from './variation-disposition.js';

export class ErreurAssistant extends Error {
  constructor(code, statut = 409) { super(code); this.code = code; this.statut = statut; }
}
const manquants = p => new Set((p.programme?.manquants || []).filter(s => s.obligatoire && !s.substitut).map(s => s.id));
const sansHistorique = ({ variantes, ...proposition }) => proposition;

export function verifierResultat(piece, resultat, produits, brief, source) {
  const actifs = resultat.agencement.filter(it => it.garde !== false);
  const staging = posesStaging(actifs, resultat.proposition.staging, produits);
  const sol = [...actifs, ...staging.filter(it => !['surface_item', 'wall_item', 'ceiling_item'].includes(it.kind) && !actifs.some(a => a.id === it.id))];
  const tv = staging.filter(it => ['tv', 'tv-murale'].includes(produitDe(it, produits)?.fam) && !actifs.some(a => a.id === it.id));
  const confort = bilanConfort(piece.modele, sol, produits);
  if (verifier(piece.modele, actifs, produits).length || verifierHauteurs(piece.modele, [...actifs, ...tv], produits).length
    || confort.score.contraintes || !confort.acces || confort.circulation === false || resultat.proposition.planZones?.audit?.geometrieValide === false)
    throw new ErreurAssistant('assistant-disposition');
  const cout = actifs.filter(it => it.origine === 'catalogue').reduce((s, it) => s + (produits[it.sku]?.prix || 0), 0);
  if (brief.budget && cout > brief.budget + .001) throw new ErreurAssistant('assistant-budget');
  const gardes = source.filter(it => brief.garder.includes(it.id) || brief.mode === 'partiel' && !brief.aRemplacer.includes(it.id));
  // meubles gardés : même meuble, même place, sauf contrainte qui permet de le déplacer (lib/scene.js)
  if (ecartsContraintes(gardes, actifs, produits).length) throw new ErreurAssistant('assistant-conservation');
  return resultat;
}

function creerDisposition(piece, source, brief, produits, graine, eviter = []) {
  const garder = brief.mode === 'partiel' ? source.filter(it => !brief.aRemplacer.includes(it.id)).map(it => it.id) : brief.garder;
  const prep = preparerAmenagement(source, { ...brief, mode: 'tout', garder, moteurGuide: true });
  const candidats = choisirCandidats(produits, { modele: piece.modele, fonction: piece.fonction, ...prep });
  const proposition = { concept: brief.langue === 'en' ? 'A furnished room arranged around your chosen activities.' : 'Une pièce meublée autour des espaces et des usages que tu as choisis.',
    meubles: [], planVie: [], conseils: [], retirer: prep.base.filter(it => !prep.garder.includes(it.id)).map(it => it.id) };
  const resultat = appliquerProposition({ modele: piece.modele, fonction: piece.fonction, prep, candidats, produits, proposition,
    ...(graine ? { variation: { graine, eviter } } : {}) });
  resultat.proposition = { ...resultat.proposition, mode: brief.mode, garder: brief.garder, moteur: { type: 'assistant' } };
  return verifierResultat(piece, resultat, produits, brief, source);
}

export function memoriser(resultat, etat, graine) {
  const variante = { id: `v${graine}`, numero: Math.max(0, ...etat.liste.map(v => v.numero)) + 1, agencement: resultat.agencement, proposition: sansHistorique(resultat.proposition) };
  let liste = [...etat.liste, variante];
  // Garder la première proposition et les cinq dernières, sans références récursives.
  if (liste.length > 6) liste = [liste[0], ...liste.slice(-5)];
  while (liste.length > 2 && JSON.stringify(liste).length > 900000) liste.splice(1, 1);
  return { ...resultat, proposition: { ...variante.proposition, variantes: { ...etat, liste, selection: variante.id, prochaineGraine: graine + 1 } },
    assistant: { message: 'proposition', selection: variante.id } };
}

export function executerAssistant(piece, demande, produits) {
  if (!piece.modele) throw new ErreurAssistant('pas-de-modele');
  if (!TYPES_PROGRAMME.includes(piece.fonction)) throw new ErreurAssistant('assistant-fonction', 400);
  if (!demande || typeof demande !== 'object' || Array.isArray(demande)) throw new ErreurAssistant('assistant-demande', 400);
  const action = demande.action || 'generer';
  if (!['generer', 'shuffle', 'choisir'].includes(action)) throw new ErreurAssistant('assistant-demande', 400);
  if (action === 'generer') {
    // un meuble marqué « conserver » est gardé quel que soit le choix fait pour la pièce
    const conserves = source => source.filter(it => it.contraintes?.conserver === true).map(it => it.id);
    const source = structuredClone(piece.agencement || []);
    const choix = preparerAmenagement(source, { ...demande, garder: [...(Array.isArray(demande.garder) ? demande.garder : []), ...conserves(source)] });
    const brief = { mode: choix.mode, envies: choix.envies, budget: choix.budget, garder: choix.garder, aRemplacer: choix.aRemplacer,
      espaces: choix.espaces, placesRepas: choix.placesRepas, langue: choix.langue, compositionDetails: choix.compositionDetails,
      compositionSurface: choix.compositionSurface, staging: choix.staging, encyclopedie: choix.encyclopedie,
      referencesSpatiales: choix.referencesSpatiales, profilUsage: choix.profilUsage };
    const resultat = creerDisposition(piece, source, brief, produits, 0);
    return memoriser(resultat, { version: 1, session: globalThis.crypto.randomUUID(), signaturePiece: signaturePiece(piece), brief, source, liste: [] }, 0);
  }
  const contexte = etatVariantes(piece);
  if (!contexte || contexte.obsolete) throw new ErreurAssistant('assistant-obsolete');
  const etat = contexte.etat;
  if (demande.session && demande.session !== etat.session) throw new ErreurAssistant('assistant-obsolete');
  if (action === 'choisir') {
    const variante = etat.liste.find(v => v.id === demande.id);
    if (!variante) throw new ErreurAssistant('assistant-variante', 400);
    verifierResultat(piece, variante, produits, etat.brief, etat.source);
    return { agencement: variante.agencement, proposition: { ...variante.proposition, variantes: { ...etat, selection: variante.id } },
      assistant: { message: 'proposition', selection: variante.id } };
  }
  const eviter = etat.liste.map(v => ancresDisposition(v.agencement));
  const initial = manquants(contexte.courante.proposition);
  let graine = Math.max(1, etat.prochaineGraine);
  const essais = piece.modele.dims.largeur * piece.modele.dims.profondeur > 40 ? 1 : 3;
  for (let i = 0; i < essais; i++, graine++) {
    let resultat;
    try { resultat = creerDisposition(piece, etat.source, etat.brief, produits, graine, eviter); }
    catch (e) { if (e instanceof ErreurAssistant || e.code === 'REGLES_BLOQUANTES') continue; throw e; }
    if ([...manquants(resultat.proposition)].some(id => !initial.has(id))) continue;
    const ancres = ancresDisposition(resultat.agencement);
    if (!eviter.every(avant => dispositionsDistinctes(ancres, avant))) continue;
    return memoriser(resultat, etat, graine);
  }
  return { agencement: piece.agencement, proposition: { ...piece.proposition, variantes: { ...etat, prochaineGraine: graine } },
    assistant: { message: 'aucune-autre-variante', selection: etat.selection } };
}
