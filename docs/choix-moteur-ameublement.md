# Choix du générateur d’ameublement — décisions ouvertes

Objectif : remplacer le moteur de placement qui produit des compositions insatisfaisantes, en conservant l’interface, le catalogue et le rendu de RealRoom. Une intégration techniquement exécutable ne démontre pas une meilleure qualité d’aménagement.

Vérification des sources officielles le 23 octobre 2026. Aucun de ces systèmes spécialisés n’a été exécuté dans cette session.

| Projet | Rôle envisageable | Éléments vérifiés et limites |
|---|---|---|
| **MiDiffusion** | Générateur de propositions spatiales conditionnées par le contour ; son mode `furniture_arrangement` conditionne aussi sur catégories et dimensions. | Code et liens de checkpoints fournis. Dépendance `threed_front`, configurations et statistiques à préparer. Licence du dépôt CC BY-NC 4.0 : ne pas l’intégrer comme composant commercial sans traiter cette restriction. Les ouvertures demandent un contrôle explicite côté RealRoom. |
| **LayoutVLM** | Raisonnement sur les relations spatiales et optimisation des placements. | Framework qui appelle un modèle de langage/vision et un optimiseur ; ce n’est pas un checkpoint autonome. Le code publié requiert une clé OpenAI, des assets GLB et leurs métadonnées, ainsi qu’une extension CUDA Rotated IoU. Aucune licence racine repérée dans l’arbre consulté. Adapter le fournisseur, les données et les contraintes DXF reste du travail à faire. |
| **Function2Scene** | Méthode pour passer des besoins d’usage à des contraintes contextualisées puis à une boucle de mesure et de réparation. | Article et démonstrateur disponibles. Le compte GitHub consulté affiche zéro dépôt public ; aucun runtime directement installable vérifié. Une réimplémentation inspirée de l’article doit être annoncée comme telle, sans prétendre exécuter leur code ni reproduire leurs résultats. |
| **SemLayoutDiff** | Candidat supplémentaire pour générer les implantations initiales à partir d’un masque architectural incluant portes et fenêtres. | Dépôt MIT, poids SLDN et APM liés sur Hugging Face. Conditionnement par type de pièce : chambre, salon, salle à manger. Prévoit une recherche d’objets après prédiction des catégories et dimensions ; adapter au catalogue RealRoom, conserver les tailles réelles et vérifier les conditions des poids/données restent nécessaires. Compatibilité L4 non testée. |
| **Qwen3.5‑9B FP8** | Compréhension du brief, chat, critique visuelle et configuration de comparaison. | Adaptateur préparé. L’utiliser seul comme générateur final était un choix prématuré ; aucun résultat réel n’a encore été obtenu. |

La sélection finale doit comparer sur les mêmes DXF : respect des portes et fenêtres, absence de conflits, couverture des usages personnalisés, qualité du regroupement, équilibre visuel, stabilité des retouches et dimensions des meubles conservées. Les métriques géométriques et le jugement esthétique doivent rester distincts.

Architecture à évaluer : plan normalisé et brief → programme fonctionnel → générateur spatial spécialisé → correspondance avec les meubles réels → optimisation et contrôles → critique visuelle → proposition éditable. Les modèles alternatifs doivent être comparés séparément avant de décider s’il est utile de les combiner. Ne pas faire tourner tous les modèles par défaut.

Sources officielles :

- [MiDiffusion — code et installation](https://github.com/MIT-SPARK/MiDiffusion), [licence](https://github.com/MIT-SPARK/MiDiffusion/blob/main/LICENSE).
- [LayoutVLM — code et format de scène](https://github.com/sunfanyunn/LayoutVLM), [article](https://arxiv.org/abs/2412.02193).
- [Function2Scene — méthode et outils](https://function2scene.github.io/), [article](https://arxiv.org/abs/2605.30819), [compte GitHub consulté](https://github.com/function2scene/).
- [SemLayoutDiff — projet](https://3dlg-hcvc.github.io/SemLayoutDiff/), [code et liens des poids](https://github.com/3dlg-hcvc/SemLayoutDiff).
