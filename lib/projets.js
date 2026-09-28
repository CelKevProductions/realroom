// Projets et pièces d'un utilisateur (toujours filtrés par son identifiant).
import { sql, une, nouvelId } from './db.js';
import { FONCTIONS, LIMITES } from './config.js';
import { ErreurHTTP } from './http.js';
import { supprimer as supprimerFichiers } from './stockage.js';

const nomValide = (s, def) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, 80) : def);

export async function listerProjets(uid) {
  return sql(`SELECT p.id, p.nom, p.maj_le,
      (SELECT count(*)::int FROM pieces x WHERE x.projet_id = p.id) AS nb,
      (SELECT x.photos->0 FROM pieces x WHERE x.projet_id = p.id AND jsonb_array_length(x.photos) > 0 ORDER BY x.cree_le LIMIT 1) AS apercu
    FROM projets p WHERE p.utilisateur_id = $1 ORDER BY p.maj_le DESC`, [uid]);
}

export async function creerProjet(uid, nom) {
  const n = await une('SELECT count(*)::int AS n FROM projets WHERE utilisateur_id = $1', [uid]);
  if (n.n >= LIMITES.projetsParCompte) throw new ErreurHTTP(409, 'limite-projets');
  return une('INSERT INTO projets (id, utilisateur_id, nom) VALUES ($1, $2, $3) RETURNING id, nom, maj_le', [nouvelId('p_'), uid, nomValide(nom, 'Projet')]);
}

export async function projet(uid, id) {
  const p = await une('SELECT id, nom, maj_le FROM projets WHERE id = $1 AND utilisateur_id = $2', [id, uid]);
  if (!p) throw new ErreurHTTP(404, 'introuvable');
  p.pieces = (await sql(`SELECT id, nom, fonction, etat, photos, dims, erreur, maj_le,
      jsonb_array_length(agencement) AS nb_meubles,
      (SELECT r.resultat->>'image' FROM rendus r WHERE r.piece_id = pieces.id AND r.type = 'image' AND r.etat = 'fini' ORDER BY r.fini_le DESC LIMIT 1) AS dernier_rendu
    FROM pieces WHERE projet_id = $1 ORDER BY cree_le`, [id])).map(x => (analyseBloquee(x) ? { ...x, etat: 'erreur', erreur: 'analyse' } : x));
  return p;
}

// une analyse qui ne s'est jamais terminée (fonction arrêtée en route) : on la considère en échec,
// ce qui permet de la relancer (les routes d'analyse s'arrêtent au plus tard après 300 s)
const ANALYSE_MAX_MS = 6 * 60e3;
export const analyseBloquee = p => p.etat === 'analyse' && Date.now() - new Date(p.maj_le).getTime() > ANALYSE_MAX_MS;
// passe la pièce en analyse, sauf si une analyse récente tourne déjà (en une requête : deux clics
// simultanés ne lancent qu'une analyse) ; true si c'est à nous de la faire
export async function demarrerAnalyse(uid, id) {
  const r = await une(`UPDATE pieces SET etat = 'analyse', erreur = NULL, maj_le = now()
    WHERE id = $1 AND utilisateur_id = $2 AND (etat <> 'analyse' OR maj_le < now() - ($3 || ' milliseconds')::interval) RETURNING id`, [id, uid, String(ANALYSE_MAX_MS)]);
  return !!r;
}

export async function renommerProjet(uid, id, nom) {
  const p = await une('UPDATE projets SET nom = $3, maj_le = now() WHERE id = $1 AND utilisateur_id = $2 RETURNING id, nom', [id, uid, nomValide(nom, 'Projet')]);
  if (!p) throw new ErreurHTTP(404, 'introuvable');
  return p;
}

// fichiers d'une liste de pièces : photos, captures et rendus copiés
async function fichiersDe(clause, params) {
  const pieces = await sql(`SELECT photos FROM pieces WHERE ${clause}`, params);
  const rendus = await sql(`SELECT suivi, resultat FROM rendus WHERE piece_id IN (SELECT id FROM pieces WHERE ${clause})`, params);
  const refs = [];
  pieces.forEach(p => (p.photos || []).forEach(f => refs.push(f)));
  rendus.forEach(r => { if (r.suivi && r.suivi.capture) refs.push(r.suivi.capture); if (r.resultat && r.resultat.fichier) refs.push(r.resultat.fichier); });
  return refs;
}

export async function supprimerProjet(uid, id) {
  const refs = await fichiersDe('projet_id = $1 AND utilisateur_id = $2', [id, uid]);
  const p = await une('DELETE FROM projets WHERE id = $1 AND utilisateur_id = $2 RETURNING id', [id, uid]);
  if (!p) throw new ErreurHTTP(404, 'introuvable');
  await supprimerFichiers(refs);
}

export async function creerPiece(uid, projetId, { nom, fonction }) {
  const p = await une('SELECT id FROM projets WHERE id = $1 AND utilisateur_id = $2', [projetId, uid]);
  if (!p) throw new ErreurHTTP(404, 'introuvable');
  const n = await une('SELECT count(*)::int AS n FROM pieces WHERE projet_id = $1', [projetId]);
  if (n.n >= LIMITES.piecesParProjet) throw new ErreurHTTP(409, 'limite-pieces');
  const f = FONCTIONS.includes(fonction) ? fonction : 'autre';
  const piece = await une('INSERT INTO pieces (id, projet_id, utilisateur_id, nom, fonction) VALUES ($1, $2, $3, $4, $5) RETURNING id, nom, fonction, etat',
    [nouvelId('r_'), projetId, uid, nomValide(nom, 'Pièce'), f]);
  await sql('UPDATE projets SET maj_le = now() WHERE id = $1', [projetId]);
  return piece;
}

export async function piece(uid, id) {
  const p = await une(`SELECT x.*, pr.nom AS projet_nom FROM pieces x JOIN projets pr ON pr.id = x.projet_id WHERE x.id = $1 AND x.utilisateur_id = $2`, [id, uid]);
  if (!p) throw new ErreurHTTP(404, 'introuvable');
  return p;
}

// les photos ne passent pas par ici (voir majPhotos : plusieurs envois peuvent arriver en même temps)
const CHAMPS = ['nom', 'fonction', 'etat', 'dims', 'notes', 'modele', 'agencement', 'proposition', 'erreur'];
const JSONB = new Set(['dims', 'modele', 'agencement', 'proposition']);
export async function majPiece(uid, id, champs) {
  const cles = Object.keys(champs).filter(k => CHAMPS.includes(k));
  if (!cles.length) return piece(uid, id);
  const sets = cles.map((k, i) => `${k} = $${i + 3}${JSONB.has(k) ? '::jsonb' : ''}`);
  const vals = cles.map(k => (JSONB.has(k) ? JSON.stringify(champs[k]) : champs[k]));
  const p = await une(`UPDATE pieces SET ${sets.join(', ')}, maj_le = now() WHERE id = $1 AND utilisateur_id = $2 RETURNING id, projet_id`, [id, uid, ...vals]);
  if (!p) throw new ErreurHTTP(404, 'introuvable');
  await sql('UPDATE projets SET maj_le = now() WHERE id = $1', [p.projet_id]);
  return piece(uid, id);
}

// photos d'une pièce : fn(photos) -> { photos, retirees } est appliquée à la liste actuelle, et le
// résultat n'est écrit que si la liste n'a pas changé entre-temps (sinon on recommence). fn peut lever
// une ErreurHTTP. nouveaux : fichiers déjà envoyés pour cette modification, supprimés si elle n'est
// pas écrite ; une fois écrite, rien n'est plus défait (les fichiers retirés sont supprimés ensuite).
export async function majPhotos(uid, id, fn, nouveaux = []) {
  let fait = null, retirees = [];
  try {
    for (let essai = 0; essai < 8 && !fait; essai++) {
      if (essai) await new Promise(r => setTimeout(r, 30 + Math.random() * 150));
      const p = await piece(uid, id);
      const avant = p.photos || [];
      const n = fn(avant);
      retirees = n.retirees || [];
      fait = await une(`UPDATE pieces SET photos = $3::jsonb, maj_le = now() WHERE id = $1 AND utilisateur_id = $2 AND photos = $4::jsonb RETURNING projet_id`,
        [id, uid, JSON.stringify(n.photos), JSON.stringify(avant)]);
    }
    if (!fait) throw new ErreurHTTP(409, 'occupe');
  } catch (e) {
    await supprimerFichiers(nouveaux);
    throw e;
  }
  try {
    await sql('UPDATE projets SET maj_le = now() WHERE id = $1', [fait.projet_id]);
    await supprimerFichiers(retirees);
  } catch (e) { console.error('photos : suite de la mise à jour', id, e && e.message); }
  return piece(uid, id);
}

export async function supprimerPiece(uid, id) {
  const refs = await fichiersDe('id = $1 AND utilisateur_id = $2', [id, uid]);
  const p = await une('DELETE FROM pieces WHERE id = $1 AND utilisateur_id = $2 RETURNING projet_id', [id, uid]);
  if (!p) throw new ErreurHTTP(404, 'introuvable');
  await supprimerFichiers(refs);
}

export async function rendusDe(uid, pieceId) {
  return sql(`SELECT id, type, etat, credits, resultat, erreur, cree_le, fini_le, suivi->>'source' AS source FROM rendus WHERE piece_id = $1 AND utilisateur_id = $2 ORDER BY cree_le DESC LIMIT 30`, [pieceId, uid]);
}

// la pièce vue par le navigateur : pas de chemins internes de stockage
export function publique(p) {
  const photo = f => f && { url: f.url, role: f.role, largeur: f.largeur, hauteur: f.hauteur };
  const bloquee = analyseBloquee(p);
  return {
    id: p.id, nom: p.nom, fonction: p.fonction, etat: bloquee ? 'erreur' : p.etat, projet_id: p.projet_id, projet_nom: p.projet_nom,
    dims: p.dims, photos: (p.photos || []).map(photo), notes: p.notes, modele: p.modele, agencement: p.agencement || [],
    proposition: p.proposition, erreur: bloquee ? 'analyse' : p.erreur, maj_le: p.maj_le
  };
}

// un rendu vu par le navigateur : ni chemin de stockage, ni lien d'origine chez le prestataire
export const renduPublic = r => ({ ...r, resultat: r.resultat && { ...r.resultat, fichier: undefined, source: undefined } });
