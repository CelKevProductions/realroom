# Ameublement à partir des données SSR — 13 octobre 2026

Le moteur utilise désormais des repères issus des scènes fournies pour choisir des proportions adaptées et affiner les ensembles de meubles. La géométrie relevée, les produits conservés, les cotes du catalogue, les limites budgétaires et le module original de génération d’images IA sont préservés.

## Données effectivement utilisées

| Fichier | Scènes |
|---|---:|
| Train | 12 055 |
| Val | 1 465 |
| Test | 1 472 |
| Total et archive brute correspondante | 14 992 |

Les deux tomes joints sont identiques aux fichiers de la mission 5. Leur base reste utilisée en complément des statistiques.

Le jeu partage des logements entre ses fichiers. La calibration exclut du train tous les logements présents en val/test ; la validation exclut ceux du test. Il reste 8 033 scènes candidates de train, dont 5 935 retenues : 3 081 chambres, 2 485 salons, 321 bureaux et 48 salles à manger. Aucun logement ne subsiste dans deux partitions après ce filtrage. Les annotations logiques `*_train` des fichiers val/test ne servent pas au réglage.

L’archive a été comparée à chaque ligne des Parquet : les 14 992 scènes correspondent. Les descriptions servent à reconnaître le premier meuble nommé. Les coordonnées, les dimensions et les quaternions sont contrôlés avant de produire des quantiles agrégés. Le profil est reproductible à l’identique. [Analyse](ameublement-reference/analyse.json).

## Changements dans le moteur

- Le choix des candidats tient compte des tailles observées par fonction et surface, avec réservation des alternatives compactes et économiques.
- Le choix d’une table basse ou d’un chevet prend aussi en compte le canapé ou le lit réellement retenu.
- Une proposition de réglage affine le centrage, le recul et les rapprochements à partir des relations observées. Les objets posés suivent leur support et les meubles fixés restent intacts.
- La recherche protège ses contraintes et le score relationnel déjà atteint. Elle compare les choix de mobilier quand ils changent ou que la composition est incomplète ; elle conserve la proposition qui préserve le mieux les accès, les fonctions et la quantité de mobilier.
- Les tables de repas et les sièges répondent au nombre de convives. Le support TV garde ses contraintes. Un coin bureau utilise ses contraintes de coin, sans prendre automatiquement les proportions d’un bureau entier.
- Le repli traverse le navigateur, la démo anonyme et le serveur. Les scénarios API couvrent explicitement `referencesSpatiales: false`.

Le dataset fournit des exemples de composition, sans portes ni fenêtres. Les ouvertures et les dégagements de la pièce réelle continuent donc à être contrôlés par le moteur existant. Aucun SKU 3D-FUTURE, aucun maillage ou poids de modèle n’est importé. Les données brutes et les instantanés complets restent hors du dépôt.

## Vérification et portée des résultats

**240 tests unitaires, quatre tests du parser et 19 scénarios API passent.** Le build Next.js normal passe. Les flux de rendu et de visite existants restent testés avec fournisseur simulé et base locale isolée.

Une comparaison avant/après couvre six pièces synthétiques et douze contours provenant du fichier test, non utilisés pour la calibration. Elle utilise le même catalogue, le même brief et les mêmes contraintes, avec le complément désactivé puis activé. Deux cas gagnent sur le score relationnel appris ; seize sont conservés. Aucune télévision, table de repas ou activité présente avant ne disparaît. Aucune collision supplémentaire n’est introduite. [Résultats détaillés](ameublement-reference/comparaison.json).

Le score mesure la conformité aux repères appris, pas une préférence esthétique humaine indépendante. Les gains sont modestes sur les cas déjà bien composés. Les contours sans ouvertures restent à vérifier. Des besoins impossibles avec la place, le budget ou le catalogue disponibles restent signalés ; la comparaison ne transforme pas un ancien diagnostic incomplet en validation complète. Le séjour de 89 m² est conservé dans ce protocole, et son audit global reste à vérifier.

Les figures utilisent des volumes indicatifs aux cotes des pièces et des caméras identiques ; elles ne sont pas des photos de produits. Les maquettes sont des fixtures indépendantes, sans photo ou plan client : [séjour de 30 m²](ameublement-reference/sejour-30-comparaison.jpg), [contrôle du séjour de 89 m²](ameublement-reference/sejour-89-comparaison.jpg).

## Version et essai

Branche de travail : `codex/realroom-mission5-encyclopedie-2026-10-12`, PR nº 3, preview uniquement. [Ouvrir la démo](https://realroom-git-codex-realroom-mission5-encyclopedie-2-d55d2e-kpw4.vercel.app/fr/maison-corleone/demo), puis relancer un réaménagement pour appliquer le nouveau moteur à une pièce enregistrée. Aucun merge, changement de base de production ou modification de la protection Vercel.

[Activation et reproduction](../data/ameublement/README.md). [Logs](ameublement-reference/logs/README.md).
