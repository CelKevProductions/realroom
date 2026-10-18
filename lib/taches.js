// File des tâches longues (table taches). Chaque transition tient en une requête : la tâche,
// le débit et le remboursement ne peuvent pas diverger, et un remboursement n'arrive qu'une
// fois (ref unique dans mouvements). Aucune tâche n'est effacée une fois payée.
import { createHash } from 'node:crypto';
import { sql, une, nouvelId } from './db.js';

export const ETATS_ACTIFS = ['attente', 'en_cours'];
export const cleDemande = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

// Nouvelle tâche payée, ou la tâche identique déjà en cours ou finie (sans second débit).
export async function creerTache({ uid, pieceId, type, cle, version, entree, credits }) {
  const id = nouvelId('t_');
  const r = await une(
    `WITH t AS (INSERT INTO taches (id, utilisateur_id, piece_id, type, cle, version, credits, entree)
                SELECT $1, $2, $3, $4, $5, $6, $7, $8::jsonb WHERE (SELECT credits FROM utilisateurs WHERE id = $2) >= $7
                ON CONFLICT (cle) WHERE etat IN ('attente', 'en_cours', 'fini') DO NOTHING RETURNING id, utilisateur_id),
          u AS (UPDATE utilisateurs SET credits = credits - $7 FROM t WHERE utilisateurs.id = t.utilisateur_id AND utilisateurs.credits >= $7 RETURNING utilisateurs.id),
          m AS (INSERT INTO mouvements (utilisateur_id, delta, motif, ref) SELECT id, -$7::int, $4, 'tache:' || $1 FROM u WHERE $7 > 0 RETURNING id)
     SELECT (SELECT count(*) FROM t)::int AS cree, (SELECT count(*) FROM u)::int AS debite`,
    [id, uid, pieceId, type, cle, version, credits, JSON.stringify(entree)]);
  if (r.cree && !r.debite) { await sql('DELETE FROM taches WHERE id = $1 AND etat = $2', [id, 'attente']); return { solde: false }; }
  if (r.cree) return { tache: await lireTache(uid, id), nouvelle: true };
  const existante = await une(`SELECT * FROM taches WHERE cle = $1 AND utilisateur_id = $2 AND etat IN ('attente', 'en_cours', 'fini')`, [cle, uid]);
  return existante ? { tache: existante, nouvelle: false } : { solde: false };
}

export const lireTache = (uid, id) => une('SELECT * FROM taches WHERE id = $1 AND utilisateur_id = $2', [id, uid]);
export const tachesDe = (uid, pieceId) => sql('SELECT * FROM taches WHERE piece_id = $1 AND utilisateur_id = $2 ORDER BY cree_le DESC LIMIT 20', [pieceId, uid]);

// Transition d'une tâche encore active (une tâche finie, annulée ou en erreur ne change plus).
export async function majTache(id, champs) {
  const cles = Object.keys(champs);
  const sets = cles.map((k, i) => `${k} = $${i + 2}${['progression', 'resultat'].includes(k) ? '::jsonb' : ''}`);
  const fin = ['fini', 'erreur', 'annule'].includes(champs.etat) ? ', fini_le = now()' : '';
  return une(`UPDATE taches SET ${sets.join(', ')}, maj_le = now()${fin} WHERE id = $1 AND etat IN ('attente', 'en_cours') RETURNING *`,
    [id, ...cles.map(k => (['progression', 'resultat'].includes(k) ? JSON.stringify(champs[k]) : champs[k]))]);
}

// Échec ou annulation : état final et remboursement, une seule fois.
export async function terminerSansResultat(id, etat, erreur) {
  const r = await une(
    `WITH t AS (UPDATE taches SET etat = $2, erreur = $3, maj_le = now(), fini_le = now() WHERE id = $1 AND etat IN ('attente', 'en_cours') RETURNING utilisateur_id, credits),
          m AS (INSERT INTO mouvements (utilisateur_id, delta, motif, ref) SELECT utilisateur_id, credits, 'remboursement', 'remb:tache:' || $1::text FROM t WHERE credits > 0 ON CONFLICT (ref) DO NOTHING RETURNING utilisateur_id, delta),
          u AS (UPDATE utilisateurs SET credits = credits + m.delta FROM m WHERE utilisateurs.id = m.utilisateur_id RETURNING utilisateurs.id)
     SELECT (SELECT count(*) FROM t)::int AS n`, [id, etat, String(erreur || etat).slice(0, 300)]);
  return !!(r && r.n);
}
