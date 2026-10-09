# RealRoom : plan de fiabilisation du relevé et de l’aménagement

## Avis sur la discussion

La séparation proposée est adaptée : géométrie paramétrique corrigeable, sélection des produits selon le brief et le budget, puis optimisation géométrique. Le calcul du score et la recherche d’arrangements ne nécessitent aucun entraînement de modèle.

Quelques nuances changent l’implémentation : une vidéo panoramique de téléphone n’est pas une image sphérique 360° calibrée et ne suffit pas à obtenir une échelle métrique. RoomPlan est une API Swift utilisant le LiDAR ; un bouton dans un site web ne peut pas l’exécuter comme une fonctionnalité native iOS. Les règles de confort dépendent des usages (couchage, repas, travail…), même si elles sont réutilisables entre styles. Les valeurs de passage sont des objectifs indicatifs, pas une certification d’accessibilité. Les photos de référence peuvent aider à comprendre une composition et son ambiance ; elles ne remplacent pas les dimensions ni les contrôles d’accès.

Références primaires : [Apple RoomPlan](https://developer.apple.com/augmented-reality/roomplan/), [Merrell et al., Interactive Furniture Layout Using Interior Design Guidelines](https://graphics.cs.berkeley.edu/papers/Merrell-IFL-2011-08/). Ce dernier travail vient de Stanford et Berkeley, et non du MIT. Le moteur RealRoom s’inspire de cette séparation entre règles et recherche ; il ne reproduit pas intégralement l’algorithme du papier.

## Livré dans cette version

1. Reprise des corrections existantes de confort et du relevé photo sur le dernier `main`, en conservant les dernières modifications Shopify.
2. Plan 2D accessible depuis RealRoom et l’édition Maison Corleone : dimensions, confirmation de chaque mesure, ajout/retrait de portes et fenêtres, déplacement par glissement ou saisie numérique, correction des dimensions des meubles existants. Les dimensions catalogue ne sont pas modifiables.
3. Géométrie commune à l’API et à la démo. Les ouvertures restent bornées au mur et sous le plafond. Une correction de la pièce adapte les coordonnées et la caméra, conserve les observations et les décalages des objets posés sur un support. Aucun objet du relevé n’est supprimé pour cacher un conflit.
4. Compositions par groupes : lit et chevets, canapé et table basse, table et sièges. Les lampes et télévisions posées accompagnent leur support lors des translations et rotations.
5. Recherche déterministe : évaluation des murs et de plusieurs positions, conservation d’un départ par orientation, puis deux passes d’ajustement et contrôle des chemins. La tête de lit éloignée du mur est pénalisée ; la relation aux chevets et aux points focaux entre dans le score. Les éléments fixés et les installations restent verrouillés.
6. Comparaison de jusqu’à trois dispositions distinctes, de qualité comparable, avec les mêmes produits et prix. Les alternatives sont filtrées pour ne pas augmenter le nombre d’alertes géométriques ni de problèmes d’accès ou de circulation par rapport à la meilleure retenue. Elles ne sont pas promises quand la pièce ou les éléments conservés ne permettent pas plusieurs solutions. Choix et annulation sans appel IA ni crédit.
7. Contrôle du budget côté code, prix inconnus exposés, protection des fonctions utiles sans remplaçant, acceptation de deux exemplaires du même chevet avec leur coût réel.

La génération photo finale (`lib/generation.js` et routes de rendus) reste inchangée. Le solveur conserve les produits retenus ; il n’effectue pas une optimisation exhaustive de toutes les combinaisons du catalogue.

## Vérification

`npm test` : **48 tests réussis**, couvrant usages, ouvertures, mobilier fixé, budget, styles, lit de 140 × 160 cm, chevets et supports, variantes, calibration partielle et conservation des observations.

`npm run build` : **compilation Next.js réussie**.

`node tests/plan.mjs` : **parcours réussis**, après compilation, avec Playwright et Chromium. Le test utilise un compte, une base PGlite et des services simulés isolés : correction API → lecture en base → interface → rechargement ; puis plan, comparaison et annulation dans la démo sur ordinateur et téléphone ; enfin correction, mise à jour de la scène et rechargement dans Maison Corleone aux deux tailles d’écran. `CHROMIUM_EXECUTABLE_PATH` permet d’utiliser un navigateur déjà installé. Les clés et bases externes sont exclues du processus du serveur de test.

Ces vérifications ne mesurent pas la qualité du relevé IA sur de nouvelles photos réelles et ne déclenchent pas de génération photo payante. Cette qualité reste à évaluer sur le banc de pièces mesurées proposé ci-dessous.

## Suites proposées, dans cet ordre

1. Étendre la pièce rectangulaire à un contour polygonal : renfoncements, pièces en L, murs obliques. Adapter simultanément le rendu 3D, les collisions et la recherche de chemins. Ne pas prétendre que le plan actuel reconstruit ces géométries.
2. Ajouter la capture vidéo guidée, extraire des images complémentaires et demander une mesure réelle. Évaluer sa qualité sur des pièces mesurées ; garder les photos existantes et le plan correctif.
3. Importer une géométrie métrique issue d’un scan, puis prévoir un compagnon iOS RoomPlan si cette voie est utile aux clients. ARCore constitue une autre intégration native à étudier, sans supposer qu’il fournit directement la même API d’analyse de pièce.
4. Constituer un banc de pièces mesurées et de compositions approuvées par un décorateur. Affiner les pondérations et les patrons par usage et par forme de pièce, puis le rapprochement des produits et des références de style.
