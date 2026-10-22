# Backend GPU — préparation expérimentale

État au 23 octobre 2026 : infrastructure et protocole testés localement avec des réponses simulées. Aucune inférence réelle ni qualité esthétique validée. Le premier essai Hugging Face a échoué au démarrage du conteneur (`python` absent ; la commande utilise maintenant `python3`). Le second a été annulé pendant l’attente du matériel. Aucun job ne reste actif.

**Consigne de cette session : ne lancer aucun GPU ni aucun appel d’inférence payant avant le « lets go » explicite de Kevin.** Les scripts de préparation et les tests locaux ne lancent pas de GPU. Les commandes de déploiement avec `--start-l4` et de test avec `--generate` sont des actions distinctes à exécuter seulement après cet accord.

## Ce qui est prêt et ce qui ne l’est pas

Le code conserve l’interface, les meubles et le moteur de rendu de RealRoom. Le nouvel endpoint ne réutilise pas son ancien générateur de placement. Il comprend une file de calcul, l’annulation, les identifiants de requêtes, le transport vers un serveur de modèle, le contrôle des dimensions et les rendus de plans pour analyse visuelle.

L’adaptateur Qwen est une **configuration de comparaison**, pas le moteur final retenu pour la qualité d’ameublement. Il utilise `RedHatAI/Qwen3.5-9B-FP8-dynamic` avec `vllm/vllm-openai:v0.18.1`. Son démarrage, sa consommation mémoire et ses résultats sur L4 restent à tester. Le modèle est généraliste ; aucune amélioration de qualité par rapport au moteur historique n’est démontrée. Sa révision est résolue au démarrage et exposée dans `/health` ; `REALROOM_MODEL_REVISION` permet de figer un commit après validation.

**MiDiffusion, LayoutVLM, Function2Scene et SemLayoutDiff ne sont pas intégrés ni exécutés.** Ne pas présenter leurs noms comme des composants fonctionnels du backend. Voir `docs/choix-moteur-ameublement.md` pour les rôles envisagés et les éléments vérifiés.

## Exécution de la configuration de comparaison

Le service Node accepte le plan normalisé en mètres issu de l’import DXF et le brief. Un modèle est appelé successivement pour préparer un programme d’usages, produire jusqu’à trois propositions, réviser leurs conflits géométriques et comparer leurs plans exacts. Les dimensions des SKU et les objets verrouillés sont conservés. Les propositions invalides restent identifiées par leur rapport de contrôle. Les vues 3D disponibles dans l’interface peuvent alimenter une révision supplémentaire.

Le processus vLLM écoute seulement sur `127.0.0.1:8000`. L’API RealRoom écoute sur le port `7860`. Une seule requête d’ameublement utilise le GPU à la fois ; quatre autres peuvent attendre. Chaque calcul a une limite de 20 minutes et chaque appel de modèle de 10 minutes. Ces limites évitent une exécution sans fin ; elles ne constituent pas une mesure du temps nécessaire au modèle, qui reste à tester.

L’interface soumet un job puis interroge sa progression : aucune fonction web ne doit rester ouverte pendant toute la génération. Les résultats sont conservés 24 heures sur le disque du service. Un redémarrage du processus conserve les résultats si le disque est intact et marque les calculs interrompus en échec. **Le disque d’un Space étant éphémère, une reconstruction ou un remplacement du conteneur peut perdre ces résultats.** Une production multi-utilisateur nécessite un stockage durable et une autorisation par projet ; le code d’accès partagé correspond à la démo.

## Préparer les fichiers sans démarrer de ressource

Depuis la racine du dépôt :

```bash
node --test tests/design.test.mjs tests/furnishing.test.mjs
node scripts/prepare-hf-space.mjs outputs/hf-space
```

Le dossier de sortie doit être nouveau. Le script copie une liste explicite de fichiers sans secrets ni historique Git. Le rendu des tests locaux nécessite Python 3 et Pillow. Le Dockerfile inclut le runtime vLLM et Node ; son build complet reste à vérifier après choix définitif du moteur.

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
| `GET /health` | HTTP 200 quand le modèle configuré apparaît dans `/v1/models`, sinon 503 ; aucune génération |
| `POST /v1/jobs` | Valide le projet puis retourne HTTP 202 avec un ID |
| `GET /v1/jobs/:id` | Retourne `queued`, `running`, `succeeded`, `failed` ou `cancelled` |
| `POST /v1/jobs/:id/cancel` | Annule la file ou propage l’annulation à l’appel de modèle |
| `POST /v1/design` | Variante NDJSON pour clients qui préfèrent le streaming |

Les routes `/v1/*` exigent `x-realroom-service-key`. Un Space privé exige en plus l’authentification Hugging Face. `Idempotency-Key` évite de lancer deux fois une demande identique ; réutiliser la même clé avec un autre projet retourne 409.

L’application expose `POST /api/design` pour créer, `GET /api/design?job=ID` pour suivre, `DELETE /api/design?job=ID` pour annuler. Ces routes utilisent le code d’accès. `/api/connection` vérifie l’état du service. Les URLs des fournisseurs viennent exclusivement de la configuration serveur.

## Vérification réelle, à lancer après accord

Les secrets sont lus dans l’environnement ; ne pas les placer dans les arguments de commande ni dans les logs.

```bash
node scripts/check-furnishing.mjs
# Les lignes suivantes déclenchent des inférences payantes si le service est hébergé sur GPU.
node scripts/check-furnishing.mjs --generate --edit --output outputs/salon-check.json
node scripts/check-furnishing.mjs --generate --room-l --output outputs/l-check.json
```

Le test sauvegarde les sorties réelles, le modèle, sa révision, les appels, les erreurs de géométrie et les usages manquants. Un résultat sans candidat valide donne un code de sortie d’échec. La qualité esthétique est explicitement marquée non évaluée : elle nécessite une comparaison humaine sur les mêmes pièces et les mêmes briefs.

Références de configuration : [modèle RedHatAI](https://huggingface.co/RedHatAI/Qwen3.5-9B-FP8-dynamic), [sorties structurées vLLM](https://docs.vllm.ai/en/v0.18.0/features/structured_outputs/), [configuration Spaces](https://huggingface.co/docs/hub/spaces-config-reference), [gestion et pause des Spaces](https://huggingface.co/docs/huggingface_hub/guides/manage-spaces).
