# RealRoom : plan de fiabilisation du relevé et de l’aménagement

## Avis sur la discussion

La séparation proposée est adaptée : géométrie paramétrique corrigeable, sélection des produits selon le brief et le budget, puis optimisation géométrique. Le calcul du score et la recherche d’arrangements ne nécessitent aucun entraînement de modèle.

Quelques nuances changent l’implémentation : une vidéo panoramique de téléphone n’est pas une image sphérique 360° calibrée et ne suffit pas à obtenir une échelle métrique. RoomPlan est une API Swift utilisant le LiDAR ; un bouton dans un site web ne peut pas l’exécuter comme une fonctionnalité native iOS. Les règles de confort dépendent des usages (couchage, repas, travail…), même si elles sont réutilisables entre styles. Les valeurs de passage sont des objectifs indicatifs, pas une certification d’accessibilité. Les photos de référence peuvent aider à comprendre une composition et son ambiance ; elles ne remplacent pas les dimensions ni les contrôles d’accès.

Références primaires vérifiées :

- [Merrell et al., Interactive Furniture Layout Using Interior Design Guidelines, SIGGRAPH 2011](https://graphics.stanford.edu/projects/furniture/) — Stanford et Berkeley, pas le MIT. Les règles fonctionnelles et visuelles alimentent un échantillonnage Monte-Carlo ; les pièces peuvent être verrouillées et les suggestions diversifiées.
- [Yu et al., Make It Home, SIGGRAPH 2011](https://web.cs.ucla.edu/~dt/papers/siggraph11/siggraph11.pdf) — relations et préférences issues d'exemples 3D, optimisation par recuit simulé. Accepter seulement une amélioration à chaque pas, comme dans le pseudo-code simplifié de Mistral, ne suffit pas à reproduire le recuit.
- [Co-Layout, AAAI 2026, version du 6 mars 2026](https://arxiv.org/abs/2511.12474) — un LLM formule des contraintes, puis une programmation entière sur grille cherche une disposition. C'est une justification de la séparation sémantique/géométrie ; RealRoom n'implémente pas ce solveur exact.
- [Apple RoomPlan](https://developer.apple.com/augmented-reality/roomplan/) pour une éventuelle acquisition métrique native.

| Proposition de Mistral | Décision | Application et limite |
| --- | --- | --- |
| Géométrie corrigible et mesures réelles | Retenue | Plan paramétrique déjà livré ; photos estimées distinguées des axes mesurés. |
| Règles d'usage et score de composition | Retenue | Neuf critères expliqués ; les contraintes et les accès précèdent les préférences. |
| Recherche globale plutôt que seul placement glouton | Retenue | Départs par groupes, recuit à graine stable, puis contrôles complets. Aucun optimum garanti. |
| Patrons et références de composition | Retenue avec adaptation | Relations lit/chevets, canapé/table, repas/sièges ; conversation, équilibre, alignement et symétrie configurables. Patrons RealRoom à calibrer, pas une bibliothèque déjà approuvée par des décorateurs. |
| Photos d'inspiration | Retenue | Jusqu'à trois images dans l'appel de proposition existant. Palette, matières et composition deviennent des préférences bornées ; aucune cote ni ouverture n'en est extraite. |
| Uniquement des règles différentes pour chaque style | Nuancée | Les passages et usages restent communs. Le style et la composition modulent les critères visuels. |
| Sélection des produits et budget | Retenue | Budget contrôlé et fonctions utiles préservées. Pas encore d'optimisation exhaustive des combinaisons du catalogue. |
| Vidéo 360°, scan AR, modèle appris | À valider séparément | Ne sont pas nécessaires pour appliquer le score et la recherche. Une vidéo seule ne donne pas l'échelle réelle. |

Les distances, coefficients, seuils de score et patrons sont des choix d'implémentation RealRoom, inspirés des principes des travaux. Ils ne sont ni copiés intégralement des algorithmes publiés ni validés comme des normes. Aucun entraînement, service CLIP supplémentaire ou appel IA lors d'une comparaison locale.

## Livré dans cette version

1. Reprise des corrections existantes de confort et du relevé photo sur le dernier `main`, en conservant les dernières modifications Shopify.
2. Plan 2D accessible depuis RealRoom et l’édition Maison Corleone : dimensions, confirmation de chaque mesure, ajout/retrait de portes et fenêtres, déplacement par glissement ou saisie numérique, correction des dimensions des meubles existants. Les dimensions catalogue ne sont pas modifiables.
3. Géométrie commune à l’API et à la démo. Les ouvertures restent bornées au mur et sous le plafond. Une correction de la pièce adapte les coordonnées et la caméra, conserve les observations et les décalages des objets posés sur un support. Aucun objet du relevé n’est supprimé pour cacher un conflit.
4. Compositions par groupes : lit et chevets, canapé et table basse, table et sièges. Les lampes et télévisions posées accompagnent leur support lors des translations et rotations.
5. Recherche reproductible : départs par orientation et deux passes locales, puis jusqu'à deux chaînes de recuit de 192 à 384 perturbations chacune. Translation, rotation et échange de groupes ; probabilité d'accepter un état moins bon `exp(-delta/temperature)` et température décroissante. Les candidats retenus repassent par les contrôles de chemins. Aucune catégorie de collision, ouverture, accès ou circulation ne peut augmenter par rapport au départ. Les verrous et les produits sont conservés. Une variation visuelle minime ne provoque pas de déplacement supplémentaire.
6. Comparaison de jusqu’à trois dispositions distinctes, de qualité comparable, avec les mêmes produits et prix. Les alternatives sont filtrées pour ne pas augmenter le nombre d’alertes géométriques ni de problèmes d’accès ou de circulation par rapport à la meilleure retenue. Elles ne sont pas promises quand la pièce ou les éléments conservés ne permettent pas plusieurs solutions. Choix et annulation sans appel IA ni crédit.
7. Contrôle du budget côté code, prix inconnus exposés, protection des fonctions utiles sans remplaçant, acceptation de deux exemplaires du même chevet avec leur coût réel.

8. Score visible dans les deux éditeurs et sur les variantes : géométrie, chemins, usages, groupes, orientation/vue, conversation, équilibre visuel, alignement, symétrie. Une entrée inconnue reste « à vérifier », une pièce vide n'est pas notée. Les conflits limitent le total ; une préférence visuelle ne masque pas les alertes. La note est indicative, utile pour comparer les mêmes produits dans la même pièce, pas pour certifier la beauté.
9. Inspirations dans RealRoom et à l'étape style de Maison Corleone : ajout/retrait, quotas indépendants des huit vues de la pièce, persistance, interprétation via Anthropic ou fal dans l'appel de proposition. La demande explicite du client prévaut. Les préférences normalisées, la version du score et les diagnostics de recherche sont enregistrés avec la proposition. Dans la démo, l'interprétation des images est explicitement simulée.

La génération photo finale (`lib/generation.js` et routes de rendus) reste inchangée. Le solveur conserve les produits retenus ; il n’effectue pas une optimisation exhaustive de toutes les combinaisons du catalogue.

## Vérification

`npm test` : **56 tests réussis**, couvrant usages, ouvertures, mobilier fixé, budget, styles, lit de 140 × 160 cm, chevets et supports, variantes, calibration partielle et conservation des observations. Les nouveaux cas couvrent le score, les critères non applicables, la conversation, les références bornées, le gain du recuit sur un cas synthétique et le contrat vision des deux fournisseurs sans requête réseau.

`npm run build` : **compilation Next.js réussie**.

`node tests/plan.mjs` : **parcours réussis**, après compilation, avec Playwright et Chromium. Le test utilise un compte, une base PGlite et des services simulés isolés : correction API → lecture en base → interface → rechargement ; puis plan, comparaison et annulation dans la démo sur ordinateur et téléphone ; enfin correction, mise à jour de la scène et rechargement dans Maison Corleone aux deux tailles d’écran. Le même parcours contrôle les inspirations (quota concurrent, huit vues de pièce indépendantes, photo d'entrée obligatoire, ajout dans l'interface et sauvegarde), les préférences et le score après proposition/rechargement, et l'ajout d'une inspiration avant le relevé dans Maison Corleone. `CHROMIUM_EXECUTABLE_PATH` permet d’utiliser un navigateur déjà installé. Les clés et bases externes sont exclues du processus du serveur de test.

Ces vérifications ne mesurent pas la qualité du relevé IA sur de nouvelles photos réelles et ne déclenchent pas de génération photo payante. Cette qualité reste à évaluer sur le banc de pièces mesurées proposé ci-dessous.

## Suites proposées, dans cet ordre

1. Étendre la pièce rectangulaire à un contour polygonal : renfoncements, pièces en L, murs obliques. Adapter simultanément le rendu 3D, les collisions et la recherche de chemins. Ne pas prétendre que le plan actuel reconstruit ces géométries.
2. Ajouter la capture vidéo guidée, extraire des images complémentaires et demander une mesure réelle. Évaluer sa qualité sur des pièces mesurées ; garder les photos existantes et le plan correctif.
3. Importer une géométrie métrique issue d’un scan, puis prévoir un compagnon iOS RoomPlan si cette voie est utile aux clients. ARCore constitue une autre intégration native à étudier, sans supposer qu’il fournit directement la même API d’analyse de pièce.
4. Constituer un banc de pièces mesurées et de compositions approuvées par un décorateur. Affiner les pondérations et les patrons par usage et par forme de pièce, puis le rapprochement des produits et des références de style.
