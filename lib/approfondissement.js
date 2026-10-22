// Approfondissement d'une proposition (« Affiner mon aménagement ») : tâche longue payée,
// suivie depuis Vercel, exécutée par le service GPU. Le résultat s'ajoute aux propositions de
// la pièce s'il a été calculé sur le plan et la disposition encore en place ; sinon il est
// gardé à part, sans remplacer quoi que ce soit.
import { CREDITS } from './config.js';
import { ErreurHTTP } from './http.js';
import { piece as lirePiece, majAmenagement } from './projets.js';
import { etatVariantes, signatureAgencement } from './variation-disposition.js';
import { verifierResultat, memoriser, ErreurAssistant } from './assistant-amenagement.js';
import { archiverProposition } from './versions-scene.js';
import { cleDemande, creerTache, lireTache, majTache, terminerSansResultat } from './taches.js';
import { configSceneWeaver, formeDe, formesAcceptees, entreeApprofondissement, soumettre, suivre, annuler, agencementDepuisScene } from './moteurs/sceneweaver.js';

const DELAI_MAX_MS = 45 * 60e3;

export const tachePublique = t => t && { id: t.id, type: t.type, etat: t.etat, version: t.version, credits: t.credits, progression: t.progression,
  resultat: t.resultat && { ...t.resultat, scene: undefined }, erreur: t.erreur, cree_le: t.cree_le, fini_le: t.fini_le };

export async function lancer(uid, pieceId, produits, langue) {
  const cfg = configSceneWeaver();
  if (!cfg.actif) throw new ErreurHTTP(503, 'approfondissement-indisponible');
  const p = await lirePiece(uid, pieceId);
  if (!p.modele) throw new ErreurHTTP(409, 'pas-de-modele');
  const contexte = etatVariantes(p);
  if (!contexte || contexte.obsolete) throw new ErreurHTTP(409, 'assistant-obsolete');
  const forme = formeDe(p.modele);
  if (!(await formesAcceptees(cfg)).includes(forme)) throw new ErreurHTTP(422, 'forme-non-supportee', forme);
  const entree = { ...entreeApprofondissement(p, p.agencement, produits, langue), base: { variante: contexte.courante.id, signature: signatureAgencement(p.agencement) } };
  const cle = cleDemande('approfondir', p.id, p.version_scene || 0, entree.base.signature);
  const r = await creerTache({ uid, pieceId: p.id, type: 'approfondir', cle, version: p.version_scene || 0, entree, credits: CREDITS.approfondissement });
  if (r.solde === false) throw new ErreurHTTP(402, 'credits');
  return r.nouvelle ? envoyer(cfg, r.tache) : r.tache;
}

async function envoyer(cfg, t) {
  try {
    const { externe } = await soumettre(cfg, t);
    return (await majTache(t.id, { etat: 'en_cours', externe: String(externe) })) || t;
  } catch (e) {
    // service injoignable : la tâche reste en attente, le prochain suivi la renvoie (même clé d'idempotence)
    console.error('Approfondissement : envoi', t.id, e.statut || e.message);
    return t;
  }
}

// Fait avancer une tâche active ; renvoie son état à jour. Appelé à chaque suivi (reprise après
// rechargement de la page ou depuis un autre appareil).
export async function avancer(uid, t, produits) {
  if (!['attente', 'en_cours'].includes(t.etat)) return t;
  const cfg = configSceneWeaver();
  if (Date.now() - new Date(t.cree_le).getTime() > DELAI_MAX_MS) {
    await annuler(cfg, t);
    await terminerSansResultat(t.id, 'erreur', 'delai');
    return lireTache(uid, t.id);
  }
  if (!t.externe) return envoyer(cfg, t);
  let suivi;
  try { suivi = await suivre(cfg, t); } catch (e) { console.error('Approfondissement : suivi', t.id, e.statut || e.message); return t; }
  if (suivi.etat === 'erreur') { await terminerSansResultat(t.id, 'erreur', suivi.erreur || 'service'); return lireTache(uid, t.id); }
  if (suivi.etat !== 'fini') return (await majTache(t.id, { etat: 'en_cours', progression: suivi.progression || null })) || lireTache(uid, t.id);
  return appliquer(uid, t, suivi, produits);
}

async function appliquer(uid, t, suivi, produits) {
  const p = await lirePiece(uid, t.piece_id);
  const contexte = etatVariantes(p);
  // déjà appliqué par un suivi précédent interrompu avant la fin : on ne l'ajoute pas deux fois
  const deja = contexte?.etat.liste.find(v => v.proposition?.moteur?.tache === t.id);
  if (deja) return (await majTache(t.id, { etat: 'fini', resultat: { applique: true, variante: deja.id } })) || lireTache(uid, t.id);
  const aJour = (p.version_scene || 0) === t.version && contexte && !contexte.obsolete && signatureAgencement(p.agencement) === t.entree.base.signature;
  const { agencement, rapport } = agencementDepuisScene(p.agencement, suivi.scene, produits);
  const moteur = { type: 'sceneweaver', mode: 'leger', ...(suivi.simulation ? { simulation: true } : {}), tache: t.id, rapport };
  if (!aJour) {
    // calculé sur un plan ou une disposition qui ont changé depuis : gardé, jamais appliqué
    await archiverProposition(uid, { ...p, version_scene: t.version }, 'approfondie', agencement, produits, { ...moteur, obsolete: true });
    return (await majTache(t.id, { etat: 'fini', resultat: { applique: false, obsolete: true, rapport } })) || lireTache(uid, t.id);
  }
  const { etat, courante } = contexte;
  try { verifierResultat(p, { agencement, proposition: courante.proposition }, produits, etat.brief, etat.source); }
  catch (e) {
    if (!(e instanceof ErreurAssistant)) throw e;
    // résultat inutilisable (circulation, accès, contraintes) : remboursé
    await terminerSansResultat(t.id, 'erreur', 'resultat-' + e.code);
    return lireTache(uid, t.id);
  }
  const resultat = memoriser({ agencement, proposition: { ...courante.proposition, moteur } }, etat, Math.max(1, etat.prochaineGraine));
  try { await majAmenagement(uid, p.id, resultat, p); }
  catch (e) { if (e.code === 'amenagement-conflit') return lireTache(uid, t.id); throw e; }
  await archiverProposition(uid, p, 'approfondie', agencement, produits, moteur);
  return (await majTache(t.id, { etat: 'fini', resultat: { applique: true, variante: resultat.proposition.variantes.selection, rapport } })) || lireTache(uid, t.id);
}

export async function abandonner(uid, t) {
  if (!['attente', 'en_cours'].includes(t.etat)) return t;
  await annuler(configSceneWeaver(), t);
  await terminerSansResultat(t.id, 'annule', 'annule');
  return lireTache(uid, t.id);
}
