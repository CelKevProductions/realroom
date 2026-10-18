// Versions de la scène d'une pièce (table scenes). Le relevé brut, chaque plan validé, les
// brouillons et les versions approfondies restent séparés et datés ; rien n'est réécrit.
// La pièce porte le numéro de son plan validé courant (pieces.version_scene) : un résultat
// calculé sur un plan plus ancien n'est jamais appliqué à la pièce (voir majAmenagement, qui
// compare aussi le plan lui-même).
import { sql, une, nouvelId } from './db.js';
import { sceneDepuisPiece } from './scene.js';

export const TYPES_SCENE = ['scan', 'validee', 'brouillon', 'approfondie'];
const MAX_BROUILLONS = 60;   // par plan validé : au-delà, les nouveaux brouillons ne sont plus archivés

// Relevé tel qu'il est arrivé (déjà limité en taille par la route d'import).
export async function archiverScan(uid, pieceId, scan) {
  return une(`INSERT INTO scenes (id, piece_id, utilisateur_id, type, version, donnees)
    SELECT $1, id, utilisateur_id, 'scan', version_scene + 1, $4::jsonb FROM pieces WHERE id = $2 AND utilisateur_id = $3 RETURNING id, version`,
    [nouvelId('sc_'), pieceId, uid, JSON.stringify(scan)]);
}

// Nouveau plan validé : la pièce passe à la version suivante et la scène est archivée.
export async function validerScene(uid, piece, catalogue, parent = null) {
  const n = await une('UPDATE pieces SET version_scene = version_scene + 1 WHERE id = $1 AND utilisateur_id = $2 RETURNING version_scene',
    [piece.id, uid]);
  if (!n) return null;
  const donnees = sceneDepuisPiece(piece, catalogue, { version: n.version_scene });
  await sql(`INSERT INTO scenes (id, piece_id, utilisateur_id, type, version, parent, donnees) VALUES ($1, $2, $3, 'validee', $4, $5, $6::jsonb)`,
    [nouvelId('sc_'), piece.id, uid, n.version_scene, parent, JSON.stringify(donnees)]);
  return n.version_scene;
}

// Brouillon ou version approfondie, rattaché au plan validé sur lequel il a été calculé.
export async function archiverProposition(uid, piece, type, agencement, catalogue, moteur) {
  if (!['brouillon', 'approfondie'].includes(type)) throw new Error('type de scène');
  const version = piece.version_scene || 0;
  const donnees = sceneDepuisPiece({ modele: piece.modele, agencement }, catalogue, { version });
  return une(`INSERT INTO scenes (id, piece_id, utilisateur_id, type, version, donnees, moteur)
    SELECT $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb
    WHERE (SELECT count(*) FROM scenes WHERE piece_id = $2 AND type = $4 AND version = $5) < ${MAX_BROUILLONS} RETURNING id`,
    [nouvelId('sc_'), piece.id, uid, type, version, JSON.stringify(donnees), moteur ? JSON.stringify(moteur) : null]);
}

export async function listerScenes(uid, pieceId) {
  return sql(`SELECT id, type, version, parent, moteur, cree_le FROM scenes WHERE piece_id = $1 AND utilisateur_id = $2
    ORDER BY cree_le DESC LIMIT 200`, [pieceId, uid]);
}
