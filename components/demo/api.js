// Démo sans compte : réponses de l'API servies dans le navigateur, avec les mêmes formes que les
// vraies routes (app/api). L'analyse et l'aménagement sont simulés (lib/simulation.js) mais passent
// par le même solveur ; le « rendu » est la vue de la maquette, la visite 3D est simulée.
import { lire, ecrire, remettreAZero, piece as pieceDe, projet as projetDe, publique, renduPublic, rendusDe, listeProjets, projetComplet, id as nouvelId } from '@/components/demo/magasin.js';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { simulerAnalyse, simulerAmenagement } from '@/lib/simulation.js';
import { pieceDepuisAnalyse, preparerAmenagement, appliquerProposition } from '@/lib/amenagement.js';
import { choisirCandidats } from '@/lib/selection.js';
import { versClaude, dimsValides } from '@/lib/piece.js';
import { resoudre, verifier } from '@/lib/agencement.js';
import { CREDITS, PACKS, FONCTIONS, ROLES_PHOTO, LIMITES } from '@/lib/config.js';

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
      if (sous === 'analyse') return analyser(p, langue);
      if (sous === 'amenager') return amenager(p, corps || {}, langue);
      if (sous === 'rendus') {
        if (method === 'GET') return ok({ rendus: rendusDe(p.id) });
        return generer(p, corps || {});
      }
    }
    return non('introuvable', 404);
  } catch (e) {
    if (e && e.statut) return non(e.code, e.statut);
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
      if (p.modele) {
        p.modele = { ...p.modele, dims: { ...p.modele.dims, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)) } };
        p.agencement = resoudre(p.modele, p.agencement || [], produits, { jeu: 0 }).items;
      }
    }
    if (Array.isArray(b.agencement) && p.modele) p.agencement = b.agencement.slice(0, 80);
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
  const i = role !== 'detail' ? p.photos.findIndex(f => f.role === role) : -1;
  if (i < 0 && p.photos.length >= LIMITES.photosParPiece) throw erreur(409, 'limite-photos');
  const photo = { url: await lireFichier(fichier), role, largeur: Math.round(+formulaire.get('largeur')) || null, hauteur: Math.round(+formulaire.get('hauteur')) || null };
  ecrire(() => {
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
  await pause(1600);
  const produits = (await chargerCatalogue()).produits;
  const prep = preparerAmenagement(p.agencement || [], b);
  const cands = choisirCandidats(produits, { dims: p.modele.dims, fonction: p.fonction, envies: prep.envies, budget: prep.budget });
  const { proposition } = simulerAmenagement({ piece: versClaude(p.modele, prep.base, produits), mode: prep.mode, aRemplacer: prep.aRemplacer, candidats: cands, langue, demo: true });
  const r = appliquerProposition({ modele: p.modele, prep, proposition, produits });
  ecrire(() => { p.agencement = r.agencement; p.proposition = r.proposition; toucher(p); });
  return ok({ piece: publique(p) });
}

async function generer(p, b) {
  if (!p.modele) return non('pas-de-modele', 409);
  const monde = b.type === 'monde';
  const cout = monde ? CREDITS.monde : CREDITS.rendu;
  let source = null;
  if (monde) {
    source = lire().rendus.find(r => r.id === b.rendu && r.piece_id === p.id && r.type === 'image' && r.etat === 'fini');
    if (!source) return non('rendu', 400);
  } else {
    if (!/^data:image\/jpeg;base64,/.test(String(b.capture || ''))) return non('capture', 400);
    if (!p.photos.some(f => f.role === 'entree')) return non('photo-entree', 400);
  }
  if (lire().credits < cout) return non('credits', 402);
  const r = {
    id: nouvelId('g_'), piece_id: p.id, type: monde ? 'monde' : 'image', etat: 'en_cours', credits: cout, source: source ? source.id : null,
    capture: monde ? null : b.capture, resultat: null, erreur: null, cree_le: maintenant(), fini_le: null, pret_a: Date.now() + (monde ? 5000 : 3000)
  };
  ecrire(e => {
    e.credits -= cout;
    e.mouvements.unshift({ delta: -cout, motif: monde ? 'monde' : 'rendu', cree_le: maintenant() });
    e.rendus.push(r);
  });
  return ok({ id: r.id }, 201);
}
