# Aménagement et confort d’usage

La proposition de mobilier passe maintenant par deux contrôles complémentaires : le solveur géométrique existant, puis `optimiserAmenagement` dans `lib/confort.js`. Le second recherche une disposition plus pratique avec les mêmes produits. Il ne fait aucun appel réseau et ne consomme aucun crédit.

## Critères

- Relier les portes et les zones d’usage par un passage visant 90 cm. Une grille d’environ 18 cm teste les chemins en élargissant les obstacles ; éviter la porte seule ne suffit plus.
- Conserver du recul devant les rangements et bureaux, les côtés d’un lit double, le pied du lit et les chaises.
- Rapprocher la table basse du canapé et orienter les fauteuils vers le coin conversation.
- Écarter les meubles hauts des fenêtres, tout en autorisant les meubles sous l’allège.
- Faire suivre les objets posés sur leur support, ainsi que les tapis et suspensions de leur zone d’usage.
- Ne jamais déplacer les éléments fixes ou choisis « à garder ». Garder prévaut sur une demande contradictoire de remplacement, y compris pour un produit catalogue en mode « tout ».

La recherche est déterministe : deux passes de positions candidates, classement local puis vérification des chemins. Une pénalité limite les déplacements inutiles. Une amélioration ne peut pas ajouter de chevauchement, d’obstruction de porte ou de dépassement de la pièce. Les contraintes impossibles avec les éléments imposés sont signalées.

## Budget et interface

Le total du mobilier catalogue conservé est déduit du budget. Les ajouts essentiels sont prioritaires sur la décoration, les doublons non prévus sont écartés, et les prix inconnus sont signalés. Les pièces conservées ne sont jamais supprimées pour faire rentrer artificiellement le total dans le budget.

Le panneau « La pièce au quotidien » est présent dans les deux éditeurs. Il recalcule les repères après un déplacement. « Optimiser la disposition » ajuste le mobilier catalogue ; « Annuler l’ajustement » restaure la version précédente. Une modification manuelle ultérieure invalide cette annulation pour éviter d’effacer le travail du client.

## Limites et vérification

Les distances sont des repères d’usage sur une maquette rectangulaire, pas une certification d’accessibilité. Les formes sont approchées par des empreintes rectangulaires ; une photo ne fournit pas des mesures garanties. Sans porte reconnue, le panneau demande de vérifier la circulation au lieu de la déclarer dégagée. Les erreurs de dimensions ou d’ouvertures nécessitent une correction de la maquette.

`npm test` couvre notamment les passages coupés malgré deux portes dégagées, les accès au lit et au rangement, les fenêtres, les objets sur leur support, les éléments fixes, les limites du budget et l’absence de mutation des données d’entrée. `npm run build` vérifie l’intégration Next.js. Le parcours `python3 tests/maison.py demo-desktop` (ou `demo-mobile`) inclut le panneau et vérifie qu’optimiser ne consomme pas de crédit.

La génération de photo IA, ses modèles, ses routes et son système de crédits sont inchangés. Seules les consignes de proposition d’aménagement ont été enrichies dans `lib/claude.js`.
