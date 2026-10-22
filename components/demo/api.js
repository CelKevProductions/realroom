// Démo sans compte : réponses de l'API servies dans le navigateur, avec les mêmes formes que les
// vraies routes (app/api). L'assistant utilise le moteur local ; l'option IA appelle le serveur.
// l'analyse photo, le rendu (vue de la maquette), la visite 3D et les paiements sont simulés.
import { lire, ecrire, remettreAZero, piece as pieceDe, projet as projetDe, publique, renduPublic, rendusDe, listeProjets, projetComplet, id as nouvelId } from '@/components/demo/magasin.js';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { simulerAnalyse } from '@/lib/simulation.js';
import { pieceDepuisAnalyse } from '@/lib/amenagement.js';
import { dimsValides } from '@/lib/piece.js';
import { moteurGuideActif } from '@/lib/moteur-guide.js';
import { finitionActive } from '@/lib/finition.js';
import { compositionSurfaceActive } from '@/lib/composition-surface.js';
import { referencesSpatialesActives } from '@/lib/ameublement-reference.js';
import { amenagerParIA } from './ia.js';
import { assistantEnArrierePlan } from './assistant.js';
import { verifier } from '@/lib/agencement.js';
import { corrigerPiece, mesuresConfirmees } from '@/lib/geometrie.js';
import { CREDITS, PACKS, FONCTIONS, ROLES_PHOTO, LIMITES } from '@/lib/config.js';
import { placePhoto } from '@/lib/references.js';
import { champsDepuisScan, ErreurScan } from '@/lib/scan.js';
import {optionsRendu} from '@/lib/rendu-options.js';
import { normaliserParcours, agencementAvecContraintes, etatVide } from '@/lib/parcours.js';
import { etatVariantes } from '@/lib/variation-disposition.js';
import { piecesDuParcours } from '@/components/demo/magasin.js';

const pause = ms => new Promise(r => setTimeout(r, ms));
const maintenant = () => new Date().toISOString();
const ok = (corps = {}, statut = 200) => ({ ...corps, ok: true, statut });
const non = (erreur, statut) => ({ ok: false, erreur, statut });
const lireFichier = blob => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(blob); });
const toucher = p => { p.maj_le = maintenant(); const pr = projetDe(p.projet_id); if (pr) pr.maj_le = p.maj_le; };

export async function repondre(url, { method = 'GET', corps, formulaire } = {}) {
  await pause(180);
  const u = new URL(url, location.origin);
  const [, , type, idRes, sous] = u.pathname.split('/');   // /api/<type>/<id>/<sous>
  const langue = lire().langue || 'fr';
  try {
    // --- édition Maison Corleone : profil (rendus offerts restants, pièces aménagées), déconnexion
    if (type === 'mc') {
      if (idRes === 'profil') {
        const e = lire();
        const pieces = e.pieces.filter(p => p.modele).sort((a, b) => (a.maj_le < b.maj_le ? 1 : -1)).slice(0, 6);
        return ok({ profil: { prenom: null, rendus: e.credits, projetId: (e.projets[0] && e.projets[0].id) || null, pieces: pieces.map(p => ({ id: p.id, nom: p.nom, fonction: p.fonction, maj_le: p.maj_le })) } });
      }
      return ok();
    }
    // --- compte et crédits
    if (type === 'moi') return ok({ connecte: true, email: 'demo@realroom.app', credits: lire().credits, langue });
    if (type === 'auth') return ok();
    if (type === 'compte' && method === 'GET') return ok({ email: 'demo@realroom.app', credits: lire().credits, historique: lire().mouvements });
    if (type === 'compte' && method === 'DELETE') { remettreAZero(langue); return ok(); }
    if (type === 'credits' && idRes === 'achat') {
      const pack = PACKS.find(p => p.id === (corps && corps.pack));
      if (!pack) return non('pack', 400);
      if (!corps.consentement) return non('consentement', 400);
      await pause(700);
      const e = ecrire(e => { e.credits += pack.credits; e.mouvements.unshift({ delta: pack.credits, motif: 'achat', cree_le: maintenant() }); });
      return ok({ credits: e.credits, historique: e.mouvements });
    }
    if (type === 'credits' && idRes === 'retour') return ok({ credits: lire().credits });

    // --- projets
    if (type === 'projets' && !idRes) {
      if (method === 'GET') return ok({ projets: listeProjets() });
      if (lire().projets.length >= LIMITES.projetsParCompte) return non('limite-projets', 409);
      const p = { id: nouvelId('p_'), nom: String((corps && corps.nom) || 'Projet').slice(0, 80), cree_le: maintenant(), maj_le: maintenant() };
      ecrire(e => { e.projets.push(p); });
      return ok({ projet: { id: p.id, nom: p.nom, maj_le: p.maj_le } }, 201);
    }
    if (type === 'projets') {
      if (!projetDe(idRes)) return non('introuvable', 404);
      if (sous === 'pieces' && method === 'POST') {
        const n = lire().pieces.filter(x => x.projet_id === idRes).length;
        if (n >= LIMITES.piecesParProjet) return non('limite-pieces', 409);
        const fonction = FONCTIONS.includes(corps && corps.fonction) ? corps.fonction : 'autre';
        const p = { id: nouvelId('r_'), projet_id: idRes, nom: String((corps && corps.nom) || 'Pièce').slice(0, 80), fonction, etat: 'photos', dims: null, photos: [], notes: '', modele: null, agencement: [], proposition: null, erreur: null, cree_le: maintenant(), maj_le: maintenant() };
        ecrire(e => { e.pieces.push(p); toucher(p); });
        return ok({ piece: { id: p.id, nom: p.nom, fonction: p.fonction, etat: p.etat } }, 201);
      }
      if (sous === 'parcours') return parcours(idRes, method, corps || {});
      if (method === 'GET') return ok({ projet: projetComplet(idRes) });
      if (method === 'PATCH') {
        ecrire(() => { const p = projetDe(idRes); p.nom = String(corps.nom || p.nom).trim().slice(0, 80) || p.nom; p.maj_le = maintenant(); });
        return ok({ projet: { id: idRes, nom: projetDe(idRes).nom } });
      }
      if (method === 'DELETE') {
        ecrire(e => {
          const ids = new Set(e.pieces.filter(x => x.projet_id === idRes).map(x => x.id));
          e.projets = e.projets.filter(p => p.id !== idRes);
          e.pieces = e.pieces.filter(x => !ids.has(x.id));
          e.rendus = e.rendus.filter(r => !ids.has(r.piece_id));
        });
        return ok();
      }
    }

    // --- approfondissement simulé (comme en préversion sans service GPU)
    if (type === 'taches') return tacheDemo(idRes, method);

    // --- suivi d'un rendu
    if (type === 'rendus') {
      const r = lire().rendus.find(x => x.id === idRes);
      if (!r) return non('introuvable', 404);
      if (r.etat === 'en_cours' && Date.now() >= r.pret_a) {
        ecrire(() => {
          r.etat = 'fini'; r.fini_le = maintenant();
          r.resultat = r.type === 'monde' ? { monde: { id: 'demo', url: null, simulation: true } } : { image: r.capture, simulation: true };
        });
      }
      if (r.etat === 'en_cours') return ok({ id: r.id, type: r.type, etat: 'en_cours' });
      return ok(renduPublic(r));
    }

    // --- pièces
    if (type === 'pieces') {
      const p = pieceDe(idRes);
      if (!p) return non('introuvable', 404);
      if (!sous) {
        if (method === 'GET') return ok({ piece: publique(p), rendus: rendusDe(p.id) });
        if (method === 'DELETE') { ecrire(e => { e.pieces = e.pieces.filter(x => x.id !== p.id); e.rendus = e.rendus.filter(r => r.piece_id !== p.id); }); return ok(); }
        if (method === 'PATCH') return ok(await modifier(p, corps || {}));
      }
      if (sous === 'photos') return ok({ piece: publique(await photos(p, method, u, formulaire)) });
      if (sous === 'scan' && method === 'POST') {
        if (p.etat === 'analyse') return non('en-cours', 409);
        if (p.modele && corps?.remplacer !== true) return non('scan-remplacement', 409);
        if (p.modele && corps?.revision !== p.maj_le) return non('scan-conflit', 409);
        let champs;
        try { champs = champsDepuisScan(corps?.scan); }
        catch (e) { if (e instanceof ErreurScan) return non(e.code, 400); throw e; }
        ecrire(() => { Object.assign(p, champs); p.version_scene = (p.version_scene || 0) + 1; toucher(p); });
        return ok({ piece: publique(p) });
      }
      if (sous === 'analyse') return analyser(p, langue);
      if (sous === 'amenager') return amenager(p, corps || {}, langue);
      if (sous === 'variantes' && method === 'POST') return variantes(p, corps || {}, langue);
      if (sous === 'approfondir') return approfondir(p, method);
      if (sous === 'rendus') {
        if (method === 'GET') return ok({ rendus: rendusDe(p.id) });
        return generer(p, corps || {});
      }
    }
    return non('introuvable', 404);
  } catch (e) {
    if (e && e.statut) return non(e.code, e.statut);
    if (['scan-forme','scan-coins','scan-dimensions','scan-repere'].includes(e?.message)) return non(e.message,400);
    console.error('démo', e);
    return non('serveur', 500);
  }
}

const erreur = (statut, code) => Object.assign(new Error(code), { statut, code });

async function modifier(p, b) {
  let alertes = [];
  const produits = (await chargerCatalogue()).produits;
  ecrire(() => {
    if (typeof b.nom === 'string') p.nom = b.nom.trim().slice(0, 80) || p.nom;
    if (FONCTIONS.includes(b.fonction)) p.fonction = b.fonction;
    if (typeof b.notes === 'string') p.notes = b.notes.slice(0, 1000);
    if (b.dims) {
      const d = dimsValides(b.dims);
      p.dims = d;
    }
    if ((b.dims || b.geometrie) && p.modele) {
      Object.assign(p, corrigerPiece(p.modele, Array.isArray(b.agencement) ? b.agencement.slice(0, 80) : p.agencement || [], b.geometrie || { dims: b.dims }, produits));
      p.dims = mesuresConfirmees(p.modele);
      if (p.proposition) p.proposition = { ...p.proposition, confort: null, densite: null, staging: (b.dims || b.geometrie) ? null : p.proposition.staging };
    }
    if (Array.isArray(b.agencement) && p.modele && !b.dims && !b.geometrie) p.agencement = b.agencement.slice(0, 80);
    if (Array.isArray(b.agencement) && p.proposition) p.proposition = { ...p.proposition, confort: null, densite: null, staging: (b.dims || b.geometrie) ? null : p.proposition.staging };
    if (b.vue && p.modele) p.modele = { ...p.modele, vue: { ...p.modele.vue, ...b.vue } };
    toucher(p);
    if (p.modele) alertes = verifier(p.modele, p.agencement || [], produits);
  });
  return { piece: publique(p), alertes };
}

async function photos(p, method, u, formulaire) {
  if (method === 'DELETE') {
    const url = u.searchParams.get('url');
    if (!p.photos.some(f => f.url === url)) throw erreur(404, 'introuvable');
    ecrire(() => { p.photos = p.photos.filter(f => f.url !== url); toucher(p); });
    return p;
  }
  const fichier = formulaire && formulaire.get('photo');
  if (!fichier || typeof fichier.arrayBuffer !== 'function') throw erreur(400, 'photo');
  const role = ROLES_PHOTO.includes(formulaire.get('role')) ? formulaire.get('role') : 'detail';
  if (!placePhoto(p.photos, role, LIMITES).possible) throw erreur(409, 'limite-photos');
  const photo = { url: await lireFichier(fichier), role, largeur: Math.round(+formulaire.get('largeur')) || null, hauteur: Math.round(+formulaire.get('hauteur')) || null };
  const meuble = formulaire.get('meuble');
  if (role === 'detail' && typeof meuble === 'string' && (p.agencement || []).some(it => it.id === meuble && it.origine === 'existant')) photo.meuble = meuble;
  ecrire(() => {
    const { remplace: i, possible } = placePhoto(p.photos, role, LIMITES);
    if (!possible) throw erreur(409, 'limite-photos');
    if (i >= 0) p.photos[i] = photo; else p.photos.push(photo);
    p.photos.sort((a, b) => ROLES_PHOTO.indexOf(a.role) - ROLES_PHOTO.indexOf(b.role));
    toucher(p);
  });
  return p;
}

async function analyser(p, langue) {
  if (!p.photos.some(f => f.role === 'entree')) return non('photo-entree', 400);
  if (p.etat === 'analyse') return non('en-cours', 409);
  ecrire(() => { p.etat = 'analyse'; p.erreur = null; toucher(p); });
  await pause(2200);
  const { analyse } = simulerAnalyse({ dims: p.dims || undefined, fonction: p.fonction, langue, demo: true });
  const { modele, agencement } = pieceDepuisAnalyse(analyse, p.dims, (await chargerCatalogue()).produits);
  ecrire(() => { Object.assign(p, { etat: 'prete', modele, agencement, proposition: null, erreur: null }); toucher(p); });
  return ok({ piece: publique(p) });
}

async function amenager(p, b, langue) {
  if (!p.modele) return non('pas-de-modele', 409);
  const revision = p.maj_le;
  const r = await amenagerParIA(p, { ...b, moteurGuide: moteurGuideActif(b.moteurGuide), compositionDetails: finitionActive(b.compositionDetails), compositionSurface: compositionSurfaceActive(b.compositionSurface),referencesSpatiales:referencesSpatialesActives(b.referencesSpatiales) }, langue);
  if (!r.ok) return r;
  if (pieceDe(p.id) !== p || p.maj_le !== revision) return non('amenagement-conflit', 409);
  ecrire(() => { p.agencement = r.agencement; p.proposition = r.proposition; toucher(p); });
  return ok({ piece: publique(p) });
}

async function variantes(p, b, langue) {
  if (!p.modele) return non('pas-de-modele', 409);
  if (p.etat === 'analyse') return non('en-cours', 409);
  const revision = p.maj_le, produits = (await chargerCatalogue()).produits;
  let resultat;
  // refus de l'assistant (aucune disposition, budget, meubles conservés) : même réponse que le serveur
  try { resultat = await assistantEnArrierePlan({ piece: structuredClone(p), demande: { ...b, langue }, produits }); }
  catch (e) { if (e?.code) return non(e.code, e.statut || 409); throw e; }
  if (pieceDe(p.id) !== p || p.maj_le !== revision) return non('amenagement-conflit', 409);
  ecrire(() => { p.agencement = resultat.agencement; p.proposition = resultat.proposition; toucher(p); });
  return ok({ piece: publique(p), assistant: resultat.assistant });
}

async function generer(p, b) {
  if (!p.modele) return non('pas-de-modele', 409);
  const monde = b.type === 'monde';
  const cout = monde ? CREDITS.monde : CREDITS.rendu;
  let source = null;
  let options=null;
  if (monde) {
    source = lire().rendus.find(r => r.id === b.rendu && r.piece_id === p.id && r.type === 'image' && r.etat === 'fini');
    if (!source) return non('rendu', 400);
  } else {
    if (!/^data:image\/jpeg;base64,/.test(String(b.capture || ''))) return non('capture', 400);
    try{options=optionsRendu(p,b);}catch(e){return non(e.code,400);}
    if(lire().rendus.some(r=>r.type==='image'&&r.etat==='en_cours'))return non('rendu-en-cours',409);
  }
  if (lire().credits < cout) return non('credits', 402);
  const r = {
    id: nouvelId('g_'), piece_id: p.id, type: monde ? 'monde' : 'image', angle: monde ? null : options.angle,vue:options?.vue,ambiance:options?.ambiance,reference:options?.photo?.url||null,referenceLargeur:options?.photo?.largeur,referenceHauteur:options?.photo?.hauteur, etat: 'en_cours', credits: cout, source: source ? source.id : null,
    capture: monde ? null : b.capture, resultat: null, erreur: null, cree_le: maintenant(), fini_le: null, pret_a: Date.now() + (monde ? 5000 : 3000)
  };
  ecrire(e => {
    e.credits -= cout;
    e.mouvements.unshift({ delta: -cout, motif: monde ? 'monde' : 'rendu', cree_le: maintenant() });
    e.rendus.push(r);
  });
  return ok({ id: r.id }, 201);
}

// Parcours guidé : même contrat que app/api/projets/[id]/parcours (état, révision, pièces).
function parcours(projetId, method, b) {
  const lireEtat = () => { const r = lire().parcours?.[projetId]; return { etat: r ? normaliserParcours(r.etat, piecesDuParcours(projetId)) : etatVide(), revision: r ? r.maj_le : null }; };
  if (method === 'GET') return ok({ ...lireEtat(), pieces: piecesDuParcours(projetId) });
  if (method === 'PUT') {
    const actuel = lire().parcours?.[projetId];
    if (actuel && (b.revision || null) !== actuel.maj_le) return { ...non('parcours-conflit', 409), ...lireEtat(), pieces: piecesDuParcours(projetId) };
    const etat = normaliserParcours(b.etat, piecesDuParcours(projetId)), revision = new Date(Math.max(Date.now(), actuel ? Date.parse(actuel.maj_le) + 1 : 0)).toISOString();
    ecrire(e => { e.parcours = { ...e.parcours, [projetId]: { etat, maj_le: revision } }; });
    return ok({ etat, revision });
  }
  const p = lire().pieces.find(x => x.id === b.piece && x.projet_id === projetId);
  if (!p) return non('introuvable', 404);
  if (b.action === 'valider') {
    if (!p.modele) return non('pas-de-modele', 409);
    if (!p.version_scene) ecrire(() => { p.version_scene = 1; toucher(p); });
  } else if (b.action === 'contraintes') {
    const { etat } = lireEtat();
    ecrire(() => { p.agencement = agencementAvecContraintes(etat, publique(p)); toucher(p); });
  } else return non('action', 400);
  return ok({ pieces: piecesDuParcours(projetId) });
}

// « Affiner mon aménagement » dans la démo : quelques secondes de calcul simulé, crédits débités
// une fois et la proposition rendue telle quelle (comme la simulation du serveur).
const DUREE_APPROFONDISSEMENT = 6000;
const tachePublique = t => ({ id: t.id, type: 'approfondissement', etat: t.etat, version: t.version, credits: t.credits, progression: t.progression || null,
  resultat: t.resultat, erreur: t.erreur || null, cree_le: t.cree_le, fini_le: t.fini_le || null });
function avancer(t) {
  if (!['attente', 'en_cours'].includes(t.etat)) return t;
  const ecoule = Date.now() - Date.parse(t.cree_le);
  ecrire(e => {
    if (ecoule < DUREE_APPROFONDISSEMENT) { t.etat = 'en_cours'; t.progression = { etape: ecoule < DUREE_APPROFONDISSEMENT / 2 ? 1 : 2, total: 3 }; return; }
    const p = e.pieces.find(x => x.id === t.piece_id);
    t.etat = 'fini'; t.fini_le = maintenant(); t.progression = null;
    t.resultat = { simulation: true, obsolete: !p || (p.version_scene || 0) !== t.version, rapport: { appliques: 0, refuses: [], ignores: 0 } };
    if (p && !t.resultat.obsolete) p.approfondie = t.version;
  });
  return t;
}
function approfondir(p, method) {
  if (method === 'GET') return ok({ taches: (lire().taches || []).filter(t => t.piece_id === p.id).map(t => tachePublique(avancer(t))) });
  const contexte = etatVariantes(p);
  if (!contexte || contexte.obsolete) return non('assistant-obsolete', 409);
  const active = (lire().taches || []).find(t => t.piece_id === p.id && ['attente', 'en_cours'].includes(t.etat));
  if (active) return ok({ tache: tachePublique(avancer(active)) });
  const cout = CREDITS.approfondissement;
  if (lire().credits < cout) return non('credits', 402);
  const t = { id: nouvelId('t_'), piece_id: p.id, etat: 'attente', version: p.version_scene || 0, credits: cout, cree_le: maintenant() };
  ecrire(e => { e.credits -= cout; e.mouvements.unshift({ delta: -cout, motif: 'approfondissement', cree_le: maintenant() }); e.taches = [...(e.taches || []), t]; });
  return ok({ tache: tachePublique(t) });
}
function tacheDemo(id, method) {
  const t = (lire().taches || []).find(x => x.id === id);
  if (!t) return non('introuvable', 404);
  if (method === 'DELETE' && ['attente', 'en_cours'].includes(t.etat)) {
    ecrire(e => { t.etat = 'annule'; t.fini_le = maintenant(); e.credits += t.credits; e.mouvements.unshift({ delta: t.credits, motif: 'remboursement', cree_le: maintenant() }); });
    return ok({ tache: tachePublique(t) });
  }
  return ok({ tache: tachePublique(avancer(t)) });
}
