# Préserver les fonctions essentielles — 14 octobre 2026

Une chambre de 16 m² pouvait ne conserver que du rangement après l’échec du premier ensemble de couchage. Un salon de 30 m² avec un budget de 1 200 € pouvait financer le repas et des compléments en supprimant canapé et télévision. Les deux défauts se reproduisaient avec les références SSR activées et désactivées.

## Corrections

- Le programme identifie le meuble principal de chaque fonction de pièce. Le budget privilégie sa présence avant le score cumulé des compléments ; la réservation d’un repas ne peut plus sacrifier ce meuble. Les éléments de finition passent après le mobilier fonctionnel.
- Les alternatives compactes couvrent aussi lits, armoires, buffets et supports TV. Si l’usage principal disparaît au placement, deux nouvelles compositions au plus sont essayées autour de produits compacts compatibles. Chevets, lampes et supports sont recomposés ensemble, notamment quand le premier lit comportait des chevets intégrés.
- Une télévision explicitement demandée dans une chambre fait partie du programme. La pose murale est privilégiée ; une demande de pose sur meuble ajoute le support nécessaire. L’écran de mise en scène peut compléter le programme sans devenir un produit vendu. Les refus de télévision restent respectés.
- Un support de TV de mise en scène réserve aussi l’encombrement de l’écran avant la pose d’une lampe catalogue. La lampe peut rejoindre la table basse.
- L’audit final distingue validité géométrique et programme complet. Un usage obligatoire manquant empêche le statut « composé » ; un plan spatialement favorable reste « à compléter » si son programme est incomplet. Le score affiche aussi son caractère partiel.

Les reprises utilisent les mêmes cotes catalogue, limites budgétaires, verrous et contrôles des ouvertures et des passages. Les références SSR restent actives. Le module de génération d’images IA n’est pas modifié.

## Résultats

| Cas synthétique, proposition locale sans IA | Avant | Après |
| --- | --- | --- |
| Chambre 4 × 4 m, épurée, télévision et rangement | Deux rangements, aucun lit ni TV | Lit, deux chevets et lampes, armoire, banc, deux tableaux et TV murale ; programme complet |
| Salon 6 × 5 m, repas à quatre, 1 200 € | Repas, aucun canapé ni TV | Canapé, table basse, support et TV, repas à quatre et éclairage ; 1 195 € de mobilier retenu |

Le salon à 1 200 € reste explicitement « à compléter » : sa suspension obligatoire n’entre pas dans le budget. Les essais activant et désactivant SSR vérifient les deux cas sans collision détectée, avec accès et circulation favorables. Une demande de repas dans un salon étroit reste signalée comme incomplète ; un manque de place ou de budget ne devient pas une réussite artificielle.

## Vérification

- 261 tests unitaires passent, dont six nouveaux tests de programme, budget, placement, TV et complétude.
- Les 21 scénarios API passent. Le nouveau scénario vérifie chambre et salon, leurs télévisions, le budget, la sauvegarde puis la relecture, sans modification de la géométrie relevée.
- Six scénarios locaux ont été rejoués, avec interdiction de toute requête réseau ; les vues 3D sous deux angles et les plans ont été examinés sur les cas corrigés et le plan polygonal de contrôle.
- Le build Next.js normal passe.

Les maquettes de contrôle utilisent des volumes simplifiés aux cotes des produits. Elles vérifient les usages et les proportions ; elles ne constituent pas des photos de produits ni une appréciation esthétique indépendante. Les tests API utilisent une base locale et des fournisseurs simulés.
