# ReSpace : démo privée

RealRoom appelle ReSpace (`gradient-spaces/respace-sg-llm-1.5b`) sur un serveur GPU séparé, par une
API compatible OpenAI (`/v1/models`, `/v1/chat/completions`). Vercel n'exécute pas le modèle.

**Licence** : poids sous CC BY-NC-SA 4.0. Démo privée, non commerciale, jamais en production.

## Serveur (Inference Endpoint Hugging Face)

1. https://endpoints.huggingface.co/new?repository=gradient-spaces/respace-sg-llm-1.5b
2. GPU L4 ou T4, moteur vLLM, sécurité « Protected », mise en veille après 15 minutes.
3. Jeton Hugging Face à droits restreints (lecture, inférence sur l'endpoint).

Autre hôte possible : toute machine GPU avec `vllm serve gradient-spaces/respace-sg-llm-1.5b`.

## RealRoom (préversion seulement)

| Variable | Rôle |
| --- | --- |
| `RESPACE_DEMO=1` | accord explicite pour la démo non commerciale |
| `RESPACE_URL` | URL de l'endpoint (avec ou sans `/v1`) |
| `RESPACE_JETON` | jeton Hugging Face, envoyé en `Authorization: Bearer` |
| `RESPACE_CODE` | code d'accès demandé sur la page de démo |
| `RESPACE_ECHANTILLONS` | propositions demandées au modèle par meuble (4 par défaut) |

Pages : `/fr/demo/respace` (démo sans compte, pièces de la démo gardées dans le navigateur) et `/fr/app/respace` (compte connecté). Jamais actif en production (`VERCEL_ENV=production`). Il faut d'abord une première proposition de l'assistant dans l'atelier ;
ReSpace replace ses meubles et la nouvelle proposition s'ajoute à celles de Shuffle.

## Fonctionnement (lib/moteurs/respace.js)

- Le moteur choisit les meubles ; ReSpace les pose un à un, du plus grand au plus petit, sur le
  contour réel de la pièce, avec le format d'entrée de l'entraînement (prompt `<add>`, JSON au
  format Python). Les dimensions restent celles du catalogue.
- Chaque position est contrôlée (pièce, chevauchements, portes : ReSpace ne voit pas les portes),
  puis le solveur du moteur recolle les dos au mur et les objets attachés, et le contrôle complet
  de l'assistant (circulation, accès, hauteurs) s'applique. Un meuble mal placé garde la position
  du moteur ; la proposition indique combien de meubles ReSpace a placés.
- Mesures enregistrées : appels, durée médiane d'un appel, durée totale, réponses illisibles,
  positions refusées, distance médiane dos-mur des meubles adossés (contrôle des axes).
