# Backend GPU — préparation expérimentale

État au 23 octobre 2026 : job de validation L4 arrêté lors de la reprise de conversation, corrections de démarrage conservées et vérifiées sur CPU. **Le parcours complet et le chat restent non validés avec les vrais modèles.**

L’extrait transmis par Kevin rapporte une génération SemLayoutDiff réussie, puis le chargement des poids Qwen (~12,7 Gio) après correction du démarrage et du tokenizer. Ces observations ne sont pas accompagnées d’un résultat exporté accessible dans cette reprise : elles ne constituent ni une mesure de qualité ni une validation de bout en bout.

Le job Hugging Face `CelKev/6ada9990c191903149a7750a`, nommé `realroom-l4-validation`, a été retrouvé actif sur une seule L4, puis annulé le 23 octobre. Son statut `CANCELED` et l’absence de jobs actifs ont été vérifiés. L’accès aux processus et fichiers du sandbox retournait `403 invalid or missing X-Sandbox-Token` dans la nouvelle session ; ses résultats internes et les modifications non sauvegardées n’ont pas pu être récupérés. Aucun GPU ni appel d’inférence payant supplémentaire n’a été lancé.

**Consigne conservée : limiter le travail à l’essai indispensable, sauvegarder les corrections et arrêter la L4.** Le « lets go » avait autorisé l’essai précédent ; il ne faut plus présenter celui-ci comme jamais lancé. Les commandes `--start-l4` et `--generate` ci-dessous sont des actions payantes distinctes, pas des étapes automatiques de vérification locale.

## Ce qui est prêt et ce qui ne l’est pas

Le code conserve l’interface, les meubles et le moteur de rendu de RealRoom. Le nouvel endpoint ne réutilise pas son ancien générateur de placement. Il comprend une file de calcul, l’annulation, les identifiants de requêtes, le transport vers un serveur de modèle, le contrôle des dimensions et les rendus de plans pour analyse visuelle.

Le service utilise désormais **SemLayoutDiff pour les implantations initiales**. Le code des réseaux SLDN et APM est inclus sans modification, à la révision officielle `6b12bc4c42aa8377445af108093539073f0495c1`, avec licence MIT et empreintes des sources. Le worker charge les vrais checkpoints publiés, exécute les étapes de diffusion conditionnées par l’architecture et le prédicteur d’attributs. Il n’a pas besoin de charger 3D-FRONT ni les meshes 3D-FUTURE.

Le code est intégré et les tests locaux passent. L’essai précédent rapporte une inférence spatiale et le chargement des poids Qwen ; **aucune sortie complète récupérable ne valide encore l’enchaînement, le chat, les performances ou la qualité**. Le Dockerfile complet n’a pas été reconstruit pendant la reprise. Un nom de modèle dans un rapport de test simulé ne constitue pas une inférence réelle.

Qwen `RedHatAI/Qwen3.5-9B-FP8-dynamic` via `vllm/vllm-openai:v0.18.1` interprète le brief, choisit une palette et un inventaire, complète les usages/décors, critique les plans et traite les retouches. **Il ne crée plus seul l’implantation initiale du service Hugging Face.** Le chemin Responses et la fonction sans moteur spatial restent disponibles pour comparaison, mais l’API web exige par défaut le backend spatial : aucune clé de session résiduelle ne peut le contourner. Sans service raccordé, la génération reste indisponible. Le mode de comparaison historique exige explicitement `REALROOM_DESIGN_ENGINE=language-comparison` côté serveur, sans service spatial configuré.

MiDiffusion, LayoutVLM et Function2Scene ne sont ni intégrés ni exécutés. Voir `docs/choix-moteur-ameublement.md`. Le code MIT de SemLayoutDiff ne prouve pas les droits sur tous ses poids ou données : aucune licence de checkpoint n’est explicitée dans la fiche Hugging Face consultée. Clarifier ce point avant une exploitation commerciale.

## Corrections de démarrage conservées

- vLLM 0.18.1 expose `--no-enable-log-requests` ; l’ancienne option `--disable-log-requests` est retirée de la commande. Les contenus des demandes restent exclus des journaux du modèle.
- Les poids restent `RedHatAI/Qwen3.5-9B-FP8-dynamic`. Leur configuration de tokenizer déclare `TokenizersBackend`, exporté avec Transformers 5, alors que vLLM 0.18.1 dépend de Transformers `<5`. Le runtime utilise explicitement `Qwen/Qwen3.5-9B` comme tokenizer.
- `REALROOM_TOKENIZER` et `REALROOM_TOKENIZER_REVISION` permettent une configuration explicite. Le bootstrap résout séparément les révisions du modèle et du tokenizer, les transmet à vLLM et les expose dans `/health` et le rapport d’essai. Changer de modèle n’hérite pas implicitement du tokenizer Qwen.
- Contrôle réel du tokenizer sur CPU avec Transformers 4.57.6 : l’erreur `Tokenizer class TokenizersBackend does not exist or is not currently imported` est reproduite sur le dépôt FP8. Le tokenizer officiel se charge en `Qwen2TokenizerFast` ; les 248 077 entrées de vocabulaire (tokens ajoutés inclus) correspondent exactement à celles du fichier FP8. Le modèle de message avec une image et `enable_thinking=false` est rendu et encodé correctement. Aucun poids de réseau n’a été téléchargé pour ce contrôle. Révisions : FP8 `790f0576d2d77dd5322aa0603a470bd9e3a3d1f6`, tokenizer `c202236235762e1c871ad0ccb60c8ee5ba337b9a`.
- Vérification locale de reprise : 49 tests Node de transport/placement/runtime et 9 tests Python CPU passent ; compilation de `start.py` et contrôle du diff réussis. Les modèles des tests d’orchestration restent simulés. Aucun nouveau build web n’est revendiqué.

Sources de compatibilité : [arguments officiels vLLM 0.18.1](https://docs.vllm.ai/en/v0.18.1/cli/serve/), [dépendances Transformers de cette version](https://github.com/vllm-project/vllm/blob/v0.18.1/requirements/common.txt), [tokenizer FP8](https://huggingface.co/RedHatAI/Qwen3.5-9B-FP8-dynamic/blob/790f0576d2d77dd5322aa0603a470bd9e3a3d1f6/tokenizer_config.json), [tokenizer officiel](https://huggingface.co/Qwen/Qwen3.5-9B/blob/c202236235762e1c871ad0ccb60c8ee5ba337b9a/tokenizer_config.json).

## Enchaînement de l’ameublement

1. Import DXF, vérification des unités et ouvertures, conversion métrique. Le plan exact reste l’autorité.
2. Raster architectural fixe de 12 × 12 m, 120 × 120 pixels : extérieur 0, sol 1, portes 2, fenêtres 3. On centre la pièce sans la déformer. Le réseau reçoit le type de pièce et la condition architecture, pas un simple rectangle englobant.
3. SLDN génère six implantations par défaut, une à la fois. APM prédit les dimensions/hauteurs et orientations des instances. L’empreinte sémantique et la hauteur prédite servent à rechercher les objets, comme dans l’exporteur officiel. Les attributs bruts restent disponibles pour diagnostic.
4. Le processus spatial se termine, puis vLLM démarre sur **la même carte**. Qwen prépare le programme à partir des envies et du catalogue.
5. Recherche des SKU réels selon catégorie, dimensions, matières et programme. Ajustement local maximal de 30 cm par axe pour les faire tenir ; aucun redimensionnement des meubles. Sélection de trois candidats selon conflits et couverture des usages. Ce tri ne mesure pas l’esthétique.
6. Qwen enrichit ces implantations : lecture, piano, éclairage, murs, sols et décoration. Les IDs et SKU du noyau spatial sont conservés ; ses déplacements restent dans un rayon de 65 cm de chaque ancrage. Les ajouts sont contrôlés comme les autres meubles.
7. Contrôle métrique, jusqu’à trois réparations, comparaison visuelle des plans exacts. Les vues 3D de RealRoom peuvent déclencher une révision supplémentaire. Les conflits restent visibles et empêchent l’application.
8. Le chat peut ensuite déplacer/remplacer/supprimer les objets selon la demande du client, avec respect des verrouillages. Les ancrages sont actualisés pour qu’une révision visuelle n’annule pas la retouche.

SemLayoutDiff ne conditionne pas nativement ce checkpoint sur les envies textuelles. Le programme filtre les catégories, intervient dans la recherche de meubles, puis dans l’enrichissement. Les usages absents de son vocabulaire, comme le piano, sont ajoutés à cette étape ; ils ne sont pas attribués au réseau spatial. Les hauteurs d’allège, débattements et circulations sont mesurés côté RealRoom, car le masque 2D n’en porte pas toutes les informations.

**Périmètre initial : salons, chambres et salles à manger, emprise ≤ 11,80 m par axe.** Autres types et plans trop grands donnent une erreur explicite avant chargement d’un modèle. Ni réduction artificielle du plan ni substitution silencieuse par un générateur généraliste. La diffusion ne conditionne pas les meubles existants verrouillés ; ils sont conservés à la récupération et dans tous les contrôles.

## Une seule carte, des étapes successives

Le service Node écoute sur 7860. Le modèle de dialogue écoute seulement sur `127.0.0.1:8000`. Node démarre le worker spatial dans un interpréteur isolé PyTorch 2.4.1, attend sa fin et la libération de ses processus, puis démarre vLLM. Une nouvelle génération termine d’abord vLLM ; une retouche seule peut réutiliser le modèle de dialogue. Aucun autoscaling, aucun deuxième GPU, aucun appel payant externe de secours.

Une seule demande s’exécute ; quatre peuvent attendre. Limite de calcul par défaut : 45 minutes, configurable par `REALROOM_JOB_TIMEOUT_MS` (maximum 120 minutes). Chaque appel de modèle garde une limite de 10 minutes. `REALROOM_LAYOUT_SAMPLES` règle le nombre de propositions spatiales (1–12, défaut 6). Ces limites sont des budgets de calcul, pas des temps mesurés. Arrêter les processus ne suspend pas la facturation du matériel Hugging Face : il faut mettre le Space en pause pour cela.

L’interface soumet un job puis interroge sa progression : aucune fonction web ne doit rester ouverte pendant toute la génération. Les résultats sont conservés 24 heures sur le disque du service. Un redémarrage du processus conserve les résultats si le disque est intact et marque les calculs interrompus en échec. **Le disque d’un Space étant éphémère, une reconstruction ou un remplacement du conteneur peut perdre ces résultats.** Une production multi-utilisateur nécessite un stockage durable et une autorisation par projet ; le code d’accès partagé correspond à la démo.

## Préparer les fichiers sans démarrer de ressource

Depuis la racine du dépôt :

```bash
node --test tests/design.test.mjs tests/furnishing.test.mjs tests/semlayout.test.mjs
python3 -m unittest discover -s tests -p 'semlayout_geometry_test.py' -v
node scripts/prepare-hf-space.mjs outputs/hf-space
```

Le dossier de sortie doit être nouveau. Le script copie une liste explicite de fichiers sans secrets ni historique Git. Les tests CPU nécessitent Python 3, NumPy, SciPy et Pillow, sans PyTorch ni GPU. Le Dockerfile sépare les dépendances spatiales de celles de vLLM. Au build, `semlayout/assets.py` télécharge les deux fichiers officiels depuis une même révision immuable du Hub, vérifie les SHA-256 LFS et prépare un manifeste local. `SEMLAYOUT_HUB_REVISION` permet de reproduire ce build avec la révision du manifeste. Aucune donnée client, aucun token ni checkpoint volumineux n’est ajouté au dépôt Git. Le chargement des poids utilise `weights_only=True`; les arguments pickle n’acceptent que `argparse.Namespace`. Un checkpoint incompatible échoue explicitement.

## Raccordement serveur

Configurer côté application RealRoom, jamais dans des variables `NEXT_PUBLIC_*` :

| Variable | Valeur |
|---|---|
| `REALROOM_FURNISHING_URL` | URL HTTPS du service, sans `/v1` final |
| `REALROOM_FURNISHING_KEY` | Secret aléatoire d’au moins 32 caractères, identique à `REALROOM_SERVICE_KEY` du service |
| `REALROOM_HF_TOKEN` | Jeton autorisé à accéder au Space privé ; envoyé uniquement à un domaine `.hf.space` |
| `REALROOM_DESIGN_ACCESS_CODE` | Code d’accès à saisir dans la démo |

Le navigateur ne reçoit ni le jeton Hugging Face ni le secret du service. Les clés de session OpenAI de l’ancienne intégration expérimentale restent un chemin distinct ; elles ne sont pas transmises au service Hugging Face.

Le script `scripts/deploy-hf-space.py OWNER/SPACE DOSSIER` charge le code dans un Space privé puis le met en pause. La création d’un Space peut nécessiter un abonnement selon le compte ; ce script n’a pas été exécuté ici. `--start-l4` demande explicitement du matériel payant. `--pause` arrête un Space existant. Aucun déploiement ni reprise automatique n’est ajouté au dépôt.

## Contrat HTTP du service

| Route | Effet |
|---|---|
| `GET /health` | HTTP 200 quand les fichiers de poids et interpréteurs existent ; sinon 503. Ne charge aucun modèle et ne prouve pas une inférence réussie |
| `POST /v1/jobs` | Valide le projet puis retourne HTTP 202 avec un ID |
| `GET /v1/jobs/:id` | Retourne `queued`, `running`, `succeeded`, `failed` ou `cancelled` |
| `POST /v1/jobs/:id/cancel` | Annule la file ou arrête le groupe de processus actif avant de libérer le GPU |
| `POST /v1/design` | Variante NDJSON pour clients qui préfèrent le streaming |

Les routes `/v1/*` exigent `x-realroom-service-key`. Un Space privé exige en plus l’authentification Hugging Face. `Idempotency-Key` évite de lancer deux fois une demande identique ; réutiliser la même clé avec un autre projet retourne 409.

L’application expose `POST /api/design` pour créer, `GET /api/design?job=ID` pour suivre, `DELETE /api/design?job=ID` pour annuler. Ces routes utilisent le code d’accès. `/api/connection` vérifie l’état du service. Les URLs des fournisseurs viennent exclusivement de la configuration serveur.

## Vérification réelle restant à terminer

Les secrets sont lus dans l’environnement ; ne pas les placer dans les arguments de commande ni dans les logs.

```bash
node scripts/check-furnishing.mjs
# Les lignes suivantes déclenchent des inférences payantes si le service est hébergé sur GPU.
node scripts/check-furnishing.mjs --generate --edit --output outputs/salon-check.json
node scripts/check-furnishing.mjs --generate --room-l --output outputs/l-check.json
```

Le test sauvegarde les sorties réelles, les deux modèles, leurs révisions, la graine spatiale, les appels, les erreurs de géométrie et les usages manquants. Un résultat sans provenance SemLayoutDiff, sans candidat géométriquement valide couvrant les usages vérifiables, ou avec une retouche ratée donne un code de sortie d’échec. La qualité esthétique est explicitement marquée non évaluée : elle nécessite une comparaison humaine sur les mêmes pièces et les mêmes briefs.

Références de configuration : [modèle RedHatAI](https://huggingface.co/RedHatAI/Qwen3.5-9B-FP8-dynamic), [sorties structurées vLLM](https://docs.vllm.ai/en/v0.18.0/features/structured_outputs/), [configuration Spaces](https://huggingface.co/docs/hub/spaces-config-reference), [gestion et pause des Spaces](https://huggingface.co/docs/huggingface_hub/guides/manage-spaces).
