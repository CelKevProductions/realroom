# Atelier IA pour RealRoom

Cette expérimentation réutilise l’interface du dépôt : `Piece`, `Atelier`, `Acquisition`, `ImportPlan`, `PlanPiece`, `BriefReamenagement`, `BarreCommande`, `Editeur3D`, le catalogue et les modèles 3D. Le nouveau parcours est actif dans `/fr/demo` et `/en/demo`. Le moteur ReSpace et les parcours de production restent disponibles dans le dépôt.

## Essayer

Ouvrir `/fr/demo/pieces/r_demo_salon`. La pièce témoin démarre vide. Le bouton **Voir l’exemple aménagé · sans IA** permet de tester l’application d’une scène, les contrôles, le catalogue et les exports. Cet exemple est composé manuellement.

Pour une génération réelle, ouvrir **Connexion IA**, sélectionner un modèle accessible au compte et fournir une clé API de session. La clé reste uniquement en mémoire dans cet onglet ; elle transite par le serveur de la démo vers `https://api.openai.com`. Les projets, exports et journaux ne la contiennent pas. Les appels sont facturés par le fournisseur. Aucun appel réel n’a été exécuté lors de la validation initiale, faute de connexion configurée.

Une autre configuration possible est de fournir au serveur `OPENAI_API_KEY`, `REALROOM_DESIGN_ACCESS_CODE` et, facultativement, `REALROOM_MODEL`. Le client doit alors renseigner le code de la démo. Une clé serveur sans code d’accès n’active pas l’endpoint public. Pour une production multi-utilisateur, remplacer ce code partagé par l’authentification du compte, des quotas et des tâches persistantes. Ne jamais utiliser un préfixe `NEXT_PUBLIC_` pour une clé.

La démonstration stocke les pièces dans `sessionStorage` : exporter le projet avant de fermer l’onglet. Le rendu photoréaliste simulé de l’ancienne démo est désactivé ; l’éditeur utilise les maquettes 3D du dépôt.

## Du DXF à la composition

1. Le navigateur analyse le DXF ASCII, les unités, les contours et les ouvertures. Il développe les blocs `INSERT` et propose une association de calques. Il ne referme pas arbitrairement des murs interrompus.
2. Le client vérifie le contour, les dimensions, les fenêtres et les portes dans l’éditeur existant. L’adaptateur conserve le repère métrique et traduit les conventions de RealRoom : radians, position des ouvertures, centre vertical des objets muraux.
3. Le modèle reçoit le plan complet, le brief, les inspirations, le catalogue dimensionné et les éléments verrouillés. Il propose jusqu’à trois compositions avec zones, mobilier, éclairage et revêtements.
4. Le serveur contrôle les volumes orientés, les limites du polygone, les hauteurs, les supports, les portes, les fenêtres et une grille de circulation. Il contrôle aussi une couverture minimale des usages choisis et les prix connus.
5. Chaque proposition peut être corrigée jusqu’à trois fois. Une réparation plus conflictuelle est écartée. Une composition vide ne passe pas comme résultat réussi.
6. Si la révision est activée, le navigateur capture les plans et, lorsque WebGL fonctionne, deux vues de chaque maquette depuis le moteur RealRoom. Le modèle compare les propositions. Une révision géométriquement invalide ne remplace pas une proposition valide.
7. Le client compare les propositions, consulte les limites puis applique son choix. Le chat utilise la scène actuelle. Les changements restent proposés avant application ; la composition précédente peut être rétablie. Une modification concurrente du projet invalide la proposition en attente.

## Code

| Élément | Rôle |
| --- | --- |
| `lib/model.mjs` | Protocole Responses structuré, orchestration et corrections |
| `lib/design-http.mjs` | Contrôle des entrées, connexion, NDJSON, annulation |
| `lib/geometry.mjs`, `lib/validation.mjs` | Géométrie et contrôles indépendants du modèle |
| `lib/design-quality.mjs` | Couverture explicite des usages, sans note esthétique |
| `lib/design-adapter.mjs` | Conversion bidirectionnelle avec les scènes existantes |
| `lib/dxf.mjs` | Import ASCII, blocs et export métrique |
| `lib/catalog.mjs`, `lib/design-objects.js` | Catalogue du dépôt et objets de projet complémentaires |
| `components/piece/DesignerIA.js` | Connexion et propositions dans l’atelier existant |
| `components/piece/design-client.js` | Transport et captures exactes pour la révision |
| `tests/design.test.mjs` | Tests du nouveau moteur et du protocole |
| `scripts/evaluate-design.mjs` | Évaluations réelles reproductibles après configuration |

## Vérifications et limites

La validation initiale comprend les tests du nouveau moteur, une sélection des tests de régression du dépôt, la compilation et les parcours navigateur : exemple appliqué, connexion absente signalée et import d’un DXF en L jusqu’à l’éditeur de mesures. Le navigateur de test désactive WebGL : le rendu matériel 3D et la critique IA sur ces vues restent à vérifier sur un appareil compatible. Les tests du protocole utilisent des réponses contrôlées ; ce ne sont pas des résultats de modèles.

Les contrôles utilisent les volumes nominaux du catalogue. Ils ne certifient ni la réglementation d’accessibilité ni le confort réel d’un fauteuil ou l’ouverture d’un tiroir. Le cheminement utilise une grille d’au moins 12 cm ; le débattement inconnu d’une porte est traité de manière conservatrice. Les seuils sont des paramètres de prototype.

L’import de l’éditeur existant accepte jusqu’à 32 sommets. Les courbes doivent être segmentées, les DXF binaires convertis en ASCII et les ouvertures non reconnues corrigées. Le plan 2D ne détermine pas systématiquement les hauteurs, allèges ou sens d’ouverture.

Les meubles proviennent du catalogue existant et d’objets génériques de projet, dont un piano et des accessoires. Un objet générique n’est pas un produit commercial disponible. Les prix inconnus ou estimés sont signalés. Les meubles relevés sans référence du catalogue doivent être associés avant la génération ; aucune taille n’est inventée pour les remplacer. Les revêtements et maquettes sont des représentations simplifiées.

**La qualité esthétique du modèle n’a pas encore été mesurée.** Avant une mise en production, faire juger à l’aveugle les résultats par des professionnels sur des plans réels, mesurer les usages manquants, les conflits, le nombre de corrections et la stabilité du chat. Ne pas confondre « aucun conflit détecté » et « bon projet d’intérieur ».

## Reproduire les contrôles

```sh
npm run test:design
node --test tests/unitaires/brief-reamenagement.test.js tests/unitaires/brief-interface.test.js tests/unitaires/geometrie.test.js tests/unitaires/plans.test.js tests/unitaires/scan.test.js tests/unitaires/composition-hauteur.test.js tests/unitaires/orientation-plan.test.js
```

Après configuration d’un compte API, cette commande effectue des appels réels et enregistre les scènes, DXF, consommations et contrôles :

```sh
node scripts/evaluate-design.mjs
```

Le script peut recevoir un fichier JSON de cas `{name, room, brief}` puis un répertoire de sortie. Il ne réalise pas la révision visuelle du navigateur.

## Recherche ayant guidé le prototype

- [MiDiffusion](https://github.com/MIT-SPARK/MiDiffusion) : génération de scènes conditionnée, utile pour la recherche sur le placement. Non exécuté dans cette démo.
- [LayoutVLM](https://github.com/sunfanyunn/LayoutVLM) : conception spatiale avec modèles visuels et contraintes. Non exécuté ici.
- [PlanCraft, version 3](https://arxiv.org/html/2607.23491v3) : travail récent sur plans et scènes meublées ; le plan DXF est déjà fourni dans notre cas.
- [FuncRoom-Agent, version 2](https://arxiv.org/html/2608.29519v2) : raisonnement sur les usages et composition structurée.

Le prototype implémente sa propre orchestration autour d’une API multimodale. Il ne présente pas ces travaux comme des modèles chargés ou évalués localement.
# État du branchement Hugging Face

Un service GPU expérimental et son raccordement asynchrone sont préparés dans `services/furnishing/`. Voir [la configuration et les vérifications](./huggingface-backend.md) et [les choix de modèles encore ouverts](./choix-moteur-ameublement.md). Les modèles spécialisés ne sont pas encore intégrés. Aucune génération réelle sur L4 n’a été validée. Aucun calcul payant ne doit être lancé sans le « lets go » de Kevin.
