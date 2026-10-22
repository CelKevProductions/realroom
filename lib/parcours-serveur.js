// Parcours guidé : lecture et enregistrement côté serveur (toujours filtrés par l'utilisateur).
import { sql, une } from './db.js';
import { projet, publique } from './projets.js';
import { ErreurHTTP } from './http.js';
import { etatVide, normaliserParcours } from './parcours.js';

// Pièces du projet avec ce qu'il faut au parcours (plan, meubles, photos, version du plan).
export async function piecesDuParcours(uid, projetId) {
  await projet(uid, projetId);
  const lignes = await sql(`SELECT x.*, pr.nom AS projet_nom,
      EXISTS (SELECT 1 FROM scenes s WHERE s.piece_id = x.id AND s.type = 'approfondie' AND s.version = x.version_scene) AS approfondie
    FROM pieces x JOIN projets pr ON pr.id = x.projet_id WHERE x.projet_id = $1 AND x.utilisateur_id = $2 ORDER BY x.cree_le`, [projetId, uid]);
  return lignes.map(p => ({ ...publique(p), approfondie: p.approfondie }));
}

export async function lireParcours(uid, projetId, pieces) {
  const r = await une('SELECT etat, maj_le FROM parcours WHERE projet_id = $1 AND utilisateur_id = $2', [projetId, uid]);
  return { etat: r ? normaliserParcours(r.etat, pieces) : etatVide(), revision: r ? new Date(r.maj_le).toISOString() : null };
}

// Enregistrement : une révision plus ancienne que celle de la base (autre onglet) est refusée.
export async function ecrireParcours(uid, projetId, etat, revision) {
  const r = await une(`INSERT INTO parcours (projet_id, utilisateur_id, etat) VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (projet_id) DO UPDATE SET etat = EXCLUDED.etat, maj_le = now()
    WHERE parcours.utilisateur_id = $2 AND ($4::timestamptz IS NULL OR parcours.maj_le = $4::timestamptz)
    RETURNING maj_le`, [projetId, uid, JSON.stringify(etat), revision]);
  if (!r) throw new ErreurHTTP(409, 'parcours-conflit');
  return new Date(r.maj_le).toISOString();
}

// Contraintes de conservation écrites sur l'agencement, sans écraser une édition arrivée entre-temps.
export async function ecrireAgencement(uid, piece, agencement) {
  const r = await une(`UPDATE pieces SET agencement = $3::jsonb, maj_le = now() WHERE id = $1 AND utilisateur_id = $2 AND agencement = $4::jsonb RETURNING id`,
    [piece.id, uid, JSON.stringify(agencement), JSON.stringify(piece.agencement || [])]);
  if (!r) throw new ErreurHTTP(409, 'amenagement-conflit');
}
