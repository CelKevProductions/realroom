# Objets génériques et caméra Photo — 11 octobre 2026

## Comportement

RealRoom et Maison Corleone proposent 44 objets génériques supplémentaires, en plus des 341 références commerciales. Ils complètent les usages et les tailles absents de la boutique : six tables basses de 60 à 140 cm, tables d’appoint, chevets, tables et chaises adultes de repas, bureaux, rangements, tapis, luminaires, plantes, miroir, bancs, pouf et fauteuil compact.

Ces objets ont leurs propres modèles 3D paramétriques et leurs vignettes originales. Leur emprise et leur hauteur correspondent aux dimensions enregistrées. Ils sont disponibles dans « Ajouter des meubles → Objets génériques » et dans la composition automatique. Relancer l’aménagement applique le nouveau catalogue à une pièce existante ; un agencement enregistré n’est pas rempli automatiquement à son ouverture.

Un objet générique est identifié comme tel. Son prix est une provision indicative, précédée de « ~ », prise en compte dans le plafond budgétaire. Le total devient « Total estimé » lorsque nécessaire. Il n’a ni photo commerciale ni lien d’achat. Aucune référence, cote, offre ou quantité de stock Maison Corleone n’est modifiée.

## Composition et rendu

Le catalogue serveur et celui du navigateur utilisent le même module d’objets. Les usages autorisés sont explicites : une chaise de bureau ne complète pas le repas, un chevet ne devient pas une table basse et les objets intérieurs ne sont pas utilisés sur une terrasse. La composition préfère les références commerciales pour les alternatives de même usage ; les objets génériques offrent aussi des tailles compactes et des provisions plus faibles. Le plafond, les accès, les zones et les vérifications géométriques existants restent appliqués.

Les objets génériques sont décrits au fournisseur de rendu depuis leur maquette 3D, avec leurs dimensions et matériaux. Leur vignette SVG n’est pas présentée comme une photo de produit. Le modèle d’image et son nombre d’appels restent inchangés.

## Caméra libre

En vue Photo, les flèches haut/bas avancent et reculent ; gauche/droite déplacent la caméra latéralement. Glisser sur la pièce change le regard. Quatre boutons maintenables offrent les mêmes déplacements au tactile. Les côtés et coins préexistants restent sélectionnables.

Le déplacement conserve la hauteur et le champ de vision, normalise les diagonales et reste dans le vrai contour, y compris concave. Les raccourcis ne capturent pas les touches d’un champ, d’un bouton ou d’un lien, et sont suspendus pendant les dialogues et le rendu. Relâcher les touches, perdre le focus ou démonter l’éditeur arrête le mouvement.

À l’ouverture de « Rendu réaliste », la position, le regard, le champ de vision et le rapport largeur/hauteur de la caméra actuelle sont figés. L’aperçu et la capture finale utilisent ce même cadrage. Une photo réelle ajoutée ensuite ne change plus ce rapport. Si l’éditeur n’est pas prêt, le panneau attend puis indique de revenir à Photo, sans inventer un cadrage d’entrée. Le fournisseur reçoit cette vue comme référence ; un résultat génératif n’est pas une garantie métrique.

## Vérification

- 164 tests unitaires réussis, aucun échec ni test ignoré. Les contrôles ajoutés couvrent les 44 modèles et leurs dimensions réelles, les usages autorisés, la sélection, le budget, les déplacements dans un contour concave, le clavier et le cadrage figé.
- 12 scénarios API réussis sur le port isolé 3237, fournisseur simulé : sauvegarde d’un objet générique, rejet des données produit forgées, caméra libre et aspect conservés dans le rendu, concurrence, références privées et nettoyage. Le DXF fourni reste local.
- Build Next/Turbopack réussi, 48 pages générées ; `git diff --check` réussi.
- Essai local du grand DXF avec le vrai catalogue, budget de 12 000 € : 16 éléments, dont six chaises et sept objets génériques, pour 6 873,99 € de produits et provisions. Quatre ensembles salon/repas/lecture/rangement ; audit d’accès et géométrie admissible. Les compléments non logés restent signalés. Ce test appelle directement la composition, sans fournisseur IA payant, et ne prédit pas toutes les propositions en ligne.
- Les vignettes ont été produites depuis les mêmes géométries Three.js puis plusieurs exemples inspectés après rendu local. Un test API a révélé une redirection de `/generiques/` vers une route de langue ; le matcher du proxy exclut désormais ce dossier public. La série API complète passe après correction.

La session navigateur demeure bloquée par « Failed to bind socket: Operation not permitted ». Aucun nouvel essai interactif navigateur, fournisseur réel ou matériel AR n’est revendiqué. Les contrôles fonctionnels exécutés sont unitaires, API et build.

Même branche `codex/realroom-plan-optimisation-2026-10-09` et PR nº 2. Aucun merge, promotion ni migration de production. Aucun fichier client ou coordonnées de son DXF dans le dépôt.
