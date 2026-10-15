# Compléter les pièces sans sacrifier leurs fonctions — 15 octobre 2026

Le banc local de 26 scénarios passe de **12 à 21 programmes complets**, avec audit final valide. Le lit ou le canapé principal est présent dans **25 cas contre 20**. Les 26 résultats conservent la géométrie et respectent le budget demandé ; les contrôles ne détectent ni collision ni obstruction des accès. Il s’agit d’un banc de régression construit pour ce projet, pas d’une mesure générale sur tous les logements.

## Origine des échecs

Le rectangle englobant un ensemble était traité comme un obstacle plein. Ses espaces vides interdisaient des placements pourtant possibles, notamment dans les pièces en L ou entre salon et repas. Une reprise pouvait ensuite supprimer tout un ensemble et laisser des compléments sans meuble principal. Enfin, un luminaire trop haut échouait sans essayer un autre modèle éligible.

Les essais avec et sans SSR ne montrent pas une opposition générale entre références spatiales et règles de confort. Les corrections portent sur les représentations géométriques, la recherche de solutions et les alternatives disponibles ; les règles d’accès restent appliquées.

## Corrections

- Les limites, ouvertures et collisions sont contrôlées sur les empreintes des meubles. À 90 cm, la recherche de chemins contourne les meubles réellement présents. Dans les grands séjours, les couloirs de 110 cm entre ensembles restent réservés.
- Les reprises privilégient le meuble principal avant le nombre de compléments. Les retraits nécessaires sont enregistrés dans le diagnostic.
- Une passe de complétion tente de replacer les éléments déjà sélectionnés, obligatoires en premier, autour des meubles conservés : chevets près du lit, lampes sur leurs supports, rangement et assises dans les emplacements encore disponibles. Chaque ajout repasse les contrôles de hauteur, d’accès et de circulation. Cette passe ne modifie pas le budget de sélection.
- Une suspension ou un objet mural incompatible peut être remplacé par une référence éligible. Avec un plafond budgétaire, son prix ne dépasse pas celui de la référence initiale.
- Les dégagements du repas tolèrent ses propres chaises, sans exempter les fauteuils du salon. Le placement initial et l’optimisation finale appliquent cette même règle.
- Cinq modèles génériques explicites complètent le catalogue : lits pour couchage 140 et 160 cm, canapés de 160 et 190 cm, suspension de 30 cm. Leurs cotes sont celles des maquettes ; leurs prix sont indicatifs. Les références commerciales ne sont ni redimensionnées ni présentées avec des offres inventées.

## Projets étudiés

- [Holodeck, page des auteurs](https://yueyang.ai/holodeck/) : le système formule des relations spatiales entre objets puis optimise leur disposition. Cette séparation inspire la conservation des relations fonctionnelles pendant les reprises.
- [ATISS, NVIDIA / Toronto](https://research.nvidia.com/labs/toronto-ai/ATISS/) : le modèle produit des objets en tenant compte d’une scène partielle et permet sa complétion. Ce principe inspire ici une passe déterministe conditionnée par les placements déjà valides.

Ces travaux servent de références de conception. Aucun de leurs modèles entraînés ni de leurs moteurs n’est intégré ; la validation présentée ci-dessous fonctionne sans IA.

## Résultats comparables

| Scénario synthétique | Avant | Après |
| --- | --- | --- |
| Chambre 9 m² | 1 élément, aucun lit ni TV | 5 éléments, lit, rangement et TV ; complet |
| Chambre 12,25 m², deux portes | 1 élément, aucun lit ni TV | 7 éléments, lit, rangement et TV ; complet |
| Chambre en L 16 m², deux portes | 2 éléments, aucun lit ni TV | 8 éléments avec couchage et TV ; complet |
| Salon 20 m², repas à quatre | 6 éléments, repas absent | 12 éléments, canapé, TV, table et quatre chaises ; complet |
| Salon 25 m², repas à quatre | 7 éléments, repas absent | 13 éléments avec salon et repas ; complet |
| Salon 30 m², budget 1 200 € | Suspension obligatoire absente | Éclairage du repas présent ; complet et budget respecté |

Les cinq cas incomplets restent signalés : chambre en L de 12 m², chambre à 500 €, salons de 14 et 16 m² avec repas à quatre, salon à 500 €. Le lit manque encore dans la chambre en L de 12 m². Les deux petits salons conservent canapé et TV, mais aucun repas à quatre n’a été trouvé. Cela ne prouve pas qu’aucun aménagement ne serait possible : la recherche est bornée et dépend des produits disponibles. Les deux budgets de 500 € ne financent pas le programme complet. Une TV de mise en scène n’est pas une offre commerciale incluse dans le coût du mobilier.

## Validation et reproduction

- 266 tests unitaires passent, dont cinq nouveaux cas de régression. Les grands séjours à cinq activités restent couverts.
- Les passages de 92 cm acceptés et de 86 cm refusés restent vérifiés ; les limites n’ont pas été réduites pour remplir les pièces.
- Les 21 scénarios API passent, notamment la sauvegarde puis la relecture des meubles, télévisions, budgets et attaches.
- Le build Next.js normal passe.
- Les 26 scénarios sont exécutés avec `fetch` interdit ; aucun appel IA ni requête réseau.
- Les maquettes de comparaison montrent les placements calculés, sous deux angles et en plan. Elles utilisent des volumes simplifiés aux cotes, sans génération d’image.

```sh
npm test
npm run build
node tests/api.mjs
node scripts/bench-essentiels.mjs
```

Le banc écrit les scènes et son bilan dans `.data/bench-essentiels/`. Pour un cas : `node scripts/bench-essentiels.mjs salon-5-5`. Le résumé synthétique avant/après est conservé dans [enrichissement-ameublement-2026-10-15.json](enrichissement-ameublement-2026-10-15.json). Les tests API utilisent une base locale et des fournisseurs simulés.
