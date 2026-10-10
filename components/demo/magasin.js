// Démo sans compte : les projets, pièces, rendus et crédits du visiteur vivent dans son navigateur
// (sessionStorage : la démo repart de zéro quand l'onglet se ferme). Rien n'est envoyé au serveur.
import { pieceDepuisAnalyse } from '@/lib/amenagement.js';
import { simulerAnalyse } from '@/lib/simulation.js';
import { CREDITS } from '@/lib/config.js';

// deux démos : RealRoom (/fr/demo, avec un appartement témoin) et l'édition Maison Corleone
// (/fr/maison-corleone/demo : 2 rendus offerts, le parcours guidé crée sa propre pièce)
const edition = () => (typeof location !== 'undefined' && location.pathname.includes('/maison-corleone') ? 'mc' : 'rr');
const RENDUS_OFFERTS_MC = 2;
const cle = () => (edition() === 'mc' ? 'mc-demo-1' : 'realroom-demo-1');
const PHOTO_EXEMPLE = { url: '/images/demo-salon.jpg', role: 'entree', largeur: 1200, hauteur: 800 };
let etat = null;
const abonnes = new Set();

const maintenant = () => new Date().toISOString();
export const id = prefixe => prefixe + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// pièce d'exemple déjà analysée (le salon de la photo d'exemple)
function pieceExemple(langue, projetId) {
  const dims = { largeur: 4.2, profondeur: 5.2, hauteur: 2.6 };
  const { analyse } = simulerAnalyse({ dims, fonction: 'salon', langue, demo: true });
  const { modele, agencement } = pieceDepuisAnalyse(analyse, dims, {});
  return {
    id: 'r_demo_salon', projet_id: projetId, nom: langue === 'en' ? 'Living room' : 'Salon', fonction: 'salon', etat: 'prete',
    dims, photos: [PHOTO_EXEMPLE], notes: '', modele, agencement, proposition: null, erreur: null, cree_le: maintenant(), maj_le: maintenant()
  };
}

function depart(langue) {
  if (edition() === 'mc') {
    return {
      langue, edition: 'mc',
      credits: RENDUS_OFFERTS_MC,
      mouvements: [{ delta: RENDUS_OFFERTS_MC, motif: 'offert-mc', cree_le: maintenant() }],
      projets: [{ id: 'p_mc', nom: 'Maison Corleone', cree_le: maintenant(), maj_le: maintenant() }],
      pieces: [],
      rendus: []
    };
  }
  const projetId = 'p_demo';
  return {
    langue,
    credits: CREDITS.bienvenue || 3,
    mouvements: [{ delta: CREDITS.bienvenue || 3, motif: 'bienvenue', cree_le: maintenant() }],
    projets: [{ id: projetId, nom: langue === 'en' ? 'Sample flat' : 'Appartement témoin', cree_le: maintenant(), maj_le: maintenant() }],
    pieces: [
      pieceExemple(langue, projetId),
      { id: 'r_demo_chambre', projet_id: projetId, nom: langue === 'en' ? 'Bedroom' : 'Chambre', fonction: 'chambre', etat: 'photos', dims: null, photos: [], notes: '', modele: null, agencement: [], proposition: null, erreur: null, cree_le: maintenant(), maj_le: maintenant() }
    ],
    rendus: []
  };
}

export function lire(langue = 'fr') {
  if (etat) return etat;
  try {
    const brut = sessionStorage.getItem(cle());
    if (brut) etat = JSON.parse(brut);
  } catch (_) { etat = null; }
  if (!etat || !Array.isArray(etat.pieces)) etat = depart(langue);
  return etat;
}

// enregistre (au mieux : si la place manque, la démo continue en mémoire) et prévient les pages
export function ecrire(f) {
  const e = lire();
  f(e);
  try { sessionStorage.setItem(cle(), JSON.stringify(e)); } catch (_) { /* quota dépassé : en mémoire seulement */ }
  abonnes.forEach(a => a());
  return e;
}

export function remettreAZero(langue) {
  etat = depart(langue || (etat && etat.langue) || 'fr');
  try { sessionStorage.removeItem(cle()); } catch (_) {}
  abonnes.forEach(a => a());
}

export function abonner(f) { abonnes.add(f); return () => abonnes.delete(f); }

export const piece = idPiece => lire().pieces.find(p => p.id === idPiece) || null;
export const projet = idProjet => lire().projets.find(p => p.id === idProjet) || null;

// mêmes formes que les réponses de l'API (voir lib/projets.js)
export function publique(p) {
  const pr = projet(p.projet_id);
  return {
    id: p.id, nom: p.nom, fonction: p.fonction, etat: p.etat, projet_id: p.projet_id, projet_nom: pr ? pr.nom : '',
    dims: p.dims, photos: p.photos.map(f => ({ url: f.url, role: f.role, largeur: f.largeur, hauteur: f.hauteur })), notes: p.notes,
    modele: p.modele, agencement: p.agencement || [], proposition: p.proposition, erreur: p.erreur, maj_le: p.maj_le
  };
}
export const renduPublic = r => ({ id: r.id, type: r.type, angle: r.angle || 'entree', etat: r.etat, credits: r.credits, resultat: r.resultat, erreur: r.erreur, cree_le: r.cree_le, fini_le: r.fini_le, source: r.source || null });
export const rendusDe = idPiece => lire().rendus.filter(r => r.piece_id === idPiece).sort((a, b) => (a.cree_le < b.cree_le ? 1 : -1)).map(renduPublic);

export function listeProjets() {
  const e = lire();
  return e.projets.slice().sort((a, b) => (a.maj_le < b.maj_le ? 1 : -1)).map(p => {
    const pieces = e.pieces.filter(x => x.projet_id === p.id);
    const apercu = pieces.flatMap(x => x.photos).find(photo => photo.role !== 'inspiration');
    return { id: p.id, nom: p.nom, nb: pieces.length, apercu: apercu?.url || null };
  });
}

export function projetComplet(idProjet) {
  const e = lire(), p = projet(idProjet);
  if (!p) return null;
  return {
    id: p.id, nom: p.nom, maj_le: p.maj_le,
    pieces: e.pieces.filter(x => x.projet_id === p.id).sort((a, b) => (a.cree_le > b.cree_le ? 1 : -1)).map(x => {
      const rendu = e.rendus.filter(r => r.piece_id === x.id && r.type === 'image' && r.etat === 'fini').sort((a, b) => (a.fini_le < b.fini_le ? 1 : -1))[0];
      return {
        id: x.id, nom: x.nom, fonction: x.fonction, etat: x.etat, photos: x.photos.map(f => ({ url: f.url, role: f.role })), dims: x.dims,
        erreur: x.erreur, maj_le: x.maj_le, nb_meubles: (x.agencement || []).length, dernier_rendu: rendu ? rendu.resultat.image : null
      };
    })
  };
}
