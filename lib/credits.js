// Crédits : solde dans utilisateurs.credits, chaque mouvement dans mouvements (ref unique :
// un paiement Stripe ou un rendu ne compte jamais deux fois). Chaque opération tient en une
// seule requête (CTE) : solde et historique ne peuvent pas diverger.
import { sql, une } from './db.js';

// débit atomique ; false si le solde ne suffit pas
export async function debiter(uid, n, motif, ref) {
  const r = await une(
    `WITH u AS (UPDATE utilisateurs SET credits = credits - $2 WHERE id = $1 AND credits >= $2 RETURNING id),
          m AS (INSERT INTO mouvements (utilisateur_id, delta, motif, ref) SELECT id, -$2::int, $3, $4 FROM u RETURNING id)
     SELECT (SELECT count(*) FROM u)::int AS n`, [uid, n, motif, ref]);
  return !!(r && r.n);
}

// crédit idempotent (ref déjà vue : rien ne se passe) ; renvoie true si ajouté
export async function crediter(uid, n, motif, ref) {
  const r = await une(
    `WITH m AS (INSERT INTO mouvements (utilisateur_id, delta, motif, ref) VALUES ($1, $2, $3, $4) ON CONFLICT (ref) DO NOTHING RETURNING utilisateur_id, delta),
          u AS (UPDATE utilisateurs SET credits = credits + m.delta FROM m WHERE utilisateurs.id = m.utilisateur_id RETURNING utilisateurs.id)
     SELECT (SELECT count(*) FROM u)::int AS n`, [uid, n, motif, ref]);
  return !!(r && r.n);
}

export async function historique(uid, limite = 50) {
  return sql('SELECT delta, motif, cree_le FROM mouvements WHERE utilisateur_id = $1 ORDER BY cree_le DESC, id DESC LIMIT $2', [uid, limite]);
}
