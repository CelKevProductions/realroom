# Approfondissement (SceneWeaver) : service GPU

« Affiner mon aménagement » tourne sur un service GPU séparé. Vercel ne fait que piloter la
tâche (lib/approfondissement.js, lib/moteurs/sceneweaver.js) : création payée, envoi, suivi,
annulation, contrôle et application du résultat. Ce service n'existe pas encore : sans
`SCENEWEAVER_URL`, la fonction est indisponible en production et simulée en local.

**Licences** : code SceneWeaver sous BSD-3-Clause, mais il dépend de Blender/Infinigen, d'un
LLM (GPT dans le dépôt d'origine), de Stable Diffusion 3.5 et de bases d'objets 3D
(3D-FUTURE, Objaverse) dont les licences sont à vérifier avant tout usage commercial.

## Contrat HTTP (Authorization: Bearer SCENEWEAVER_JETON)

| Appel | Réponse |
| --- | --- |
| `GET /capacites` | `{ formes: ['rectangle', 'polygone'?], version }` |
| `POST /taches` (en-tête `Idempotency-Key` = id de tâche RealRoom) corps `{ scene, consignes }` | `{ externe }` ; la même clé renvoie la même tâche |
| `GET /taches/{externe}` | `{ etat: 'attente' \| 'en_cours' \| 'fini' \| 'erreur', progression?: { etape, total }, scene?, erreur? }` |
| `DELETE /taches/{externe}` | 204 |

`scene` suit le format `realroom-scene-v1` (lib/scene.js) : mètres, origine au centre du sol, +y
en haut, +z vers l'entrée, rotation en radians autour de +y, face avant +z. La scène rendue garde
les mêmes identifiants d'objets ; seuls `position` et `rot` sont repris. Un objet aux dimensions
changées, ou qui viole ses contraintes (position ou rotation fixe), est refusé. En mode léger, une
forme de pièce non déclarée dans `formes` est refusée avant tout débit : une pièce en L n'est
jamais envoyée comme son rectangle englobant.

## Côté RealRoom

- File durable : table `taches` (état, clé de demande, version du plan, crédits, progression).
- Une demande identique (même pièce, même version du plan, même disposition) en cours ou finie
  n'est ni relancée ni payée deux fois ; débit et remboursement passent par `mouvements` avec
  une référence unique (`tache:<id>`, `remb:tache:<id>`).
- Suivi à chaque lecture (`GET /api/taches/:id`, `GET /api/pieces/:id/approfondir`) : la tâche
  reprend après un rechargement ou depuis un autre appareil ; un envoi raté est renvoyé avec la
  même clé d'idempotence ; au-delà de 45 minutes, elle échoue et est remboursée.
- Résultat inutilisable (circulation, accès, contraintes) : échec remboursé. Résultat calculé sur
  un plan ou une disposition qui ont changé : gardé dans `scenes` (type `approfondie`), jamais
  appliqué.
