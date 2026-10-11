# Aménagement et confort d’usage

Le modèle choisit les usages, les produits et leurs alternatives, sans fournir de coordonnées. `lib/composition.js` crée les départs paramétriques ; le solveur géométrique puis `optimiserAmenagement` dans `lib/confort.js` cherchent une disposition plus pratique avec les produits retenus. Cette recherche ne fait aucun appel réseau et ne consomme aucun crédit.

## Critères

- Relier les portes et les zones d’usage par un passage visant 90 cm. Une grille d’environ 18 cm teste les chemins en élargissant les obstacles ; éviter la porte seule ne suffit plus.
- Conserver du recul devant les rangements et bureaux, les côtés d’un lit double, le pied du lit et les chaises.
- Rapprocher la table basse du canapé et orienter les fauteuils vers le coin conversation.
- Écarter les meubles hauts et les lits des fenêtres, même si une tête de lit basse passe sous l’allège. Conserver un dégagement indicatif devant les radiateurs ; les distances du fabricant restent à confirmer.
- Faire suivre les objets posés sur leur support, ainsi que les tapis et suspensions de leur zone d’usage.
- Ne jamais déplacer les éléments fixes ou choisis « à garder ». Garder prévaut sur une demande contradictoire de remplacement, y compris pour un produit catalogue en mode « tout ».

La recherche utilise des départs par groupes, deux passes locales et un recuit simulé à graine stable, puis une vérification des chemins. Des états intermédiaires moins bons sont acceptés pour élargir la recherche ; ils ne sont pas proposés sans revalidation. Chaque catégorie de conflit ou de difficulté d'accès doit rester au plus au niveau du départ. Une pénalité limite les déplacements inutiles. Une amélioration ne peut pas ajouter de chevauchement, d’obstruction de porte ou de dépassement de la pièce. Les contraintes impossibles avec les éléments imposés sont signalées.

## Score et inspirations

Neuf patrons paramétriques de `lib/patrons.js` fournissent aussi des départs à la recherche : trois chambres, trois salons, deux coins repas et un bureau. Ils ne créent ni produits ni objets fictifs, et n’écrasent pas les meubles verrouillés. Les mêmes contrôles d’accès, de chemins et de collisions filtrent leurs candidats avant choix. Ce sont des heuristiques RealRoom, pas neuf compositions déjà validées par un décorateur.

Le score décompose dix critères : encombrement/ouvertures, circulation, usage, groupes de meubles, orientation/vue, conversation, équilibre visuel, alignement, symétrie et tapis/éclairage. Les pondérations visuelles sont définies dans `lib/references.js` et la version est enregistrée. Une conversation privilégie la proximité et l'orientation mutuelle des sièges ; une composition symétrique augmente le poids de la symétrie des chevets. L'équilibre utilise une approximation du centre des empreintes, avec un poids faible. Les contraintes et accès sont contrôlés avant de départager les préférences.

Les onze styles et le profil neutre partagent les règles géométriques. `lib/profils.js` définit leurs préférences éditoriales, les compléments utiles et l'ordre des patrons ; un brief peut mélanger trois styles. Ces réglages ne sont pas un modèle entraîné ni une validation par un décorateur. Les indices visuels OpenCLIP du catalogue apportent un bonus limité, avec repli textuel pour les images non indexées : voir [les styles visuels](styles-visuels.md).

La note de chaque critère visuel est `100 / (1 + pénalité / 150)`, arrondie. Les critères non applicables sont omis de la moyenne pondérée. Les conflits géométriques plafonnent le total à 49 ; une difficulté de chemin le plafonne à 69. Sans entrée identifiée, la note est partielle. Sans mobilier au sol, aucun total n'est attribué. Ce score RealRoom n'est pas une mesure objective de beauté.

Les photos de rôle `inspiration` sont séparées des vues du relevé : quota de trois, aucune utilisation lors de l'analyse des murs et mesures. Leurs images accompagnent l'appel de proposition existant, avec un schéma sémantique borné (style, composition, palette, matières, résumé). Les envies explicites prévalent. Les sources scientifiques et les limites de l'adaptation sont décrites dans [le plan Mistral](plan-mistral-realroom.md).

## Budget et interface

Le total du mobilier catalogue conservé est déduit du budget. `lib/budget.js` compare au plus 24 emplacements et huit options par emplacement : produit proposé, alternatives du modèle et produits éligibles du même usage. Le sac à dos couvre d'abord les fonctions, puis départage style et compléments, en centimes et quantités réelles. Les usages conservés sont pris en compte. Au-delà de 4 096 états, une borne limite le temps et le diagnostic indique l'approximation. Il ne s'agit pas d'une recherche exhaustive sur tout le catalogue. Les alternatives trop grandes ou incompatibles sont exclues. Les doublons non prévus sont écartés, les prix inconnus sont signalés et les pièces conservées ne sont jamais supprimées pour faire rentrer artificiellement le total dans le budget. Un remplacement abandonné restaure la fonction existante, sauf suppression explicitement demandée. Le diagnostic expose les substitutions retenues.

Le panneau « La pièce au quotidien » est présent dans les deux éditeurs. Il recalcule les repères après un déplacement. « Optimiser la disposition » ajuste le mobilier catalogue ; « Annuler l’ajustement » restaure la version précédente. Une modification manuelle ultérieure invalide cette annulation pour éviter d’effacer le travail du client.

Si un couchage est conservé, un nouveau lit proposé est écarté avec un avertissement, sauf demande explicite d’ajouter un deuxième lit. Cela évite un achat et une disposition redondants malgré une sortie contradictoire du modèle ; « lit double » n’est pas une demande de lit supplémentaire.

## Limites et vérification

Le même moteur reçoit désormais les imports RoomPlan et les contours métriques WebXR/ARCore de 3 à 32 coins et les plans DXF dans RealRoom et Maison Corleone. Les cotes de capteur restent de source `scan`, et non `mesure` humaine. Sans hauteur saisie sur Android, 2,50 m reste une estimation. Le plan permet d’ajouter les meubles et ouvertures non détectés ; un meuble existant saisi ne devient pas un produit du catalogue. Les contours simples concaves et obliques sont conservés ; les formes croisées restent refusées. La photo d’entrée peut être ajoutée ultérieurement pour le rendu, sans relancer l’analyse ni effacer le relevé.

Les distances sont des repères d’usage sur une maquette paramétrique, pas une certification d’accessibilité. Les formes sont approchées par des empreintes rectangulaires ; une photo ne fournit pas des mesures garanties. Sans porte reconnue, le panneau demande de vérifier la circulation au lieu de la déclarer dégagée. Les erreurs de dimensions ou d’ouvertures nécessitent une correction de la maquette.

`npm test` couvre notamment les passages coupés malgré deux portes dégagées, les accès au lit et au rangement, les fenêtres, les objets sur leur support, les éléments fixes, les limites du budget et l’absence de mutation des données d’entrée. `npm run build` vérifie l’intégration Next.js. Le parcours `python3 tests/maison.py demo-desktop` (ou `demo-mobile`) inclut le panneau et vérifie qu’optimiser ne consomme pas de crédit.

La demande du 10 octobre ajoute le choix d’un angle et d’une photo correspondante, avec aperçu et déclenchement explicite ; les modèles, coûts et suivi/remboursement sont conservés. Voir `parcours-guide.md`. Les consignes de relevé et de proposition d’aménagement sont enrichies dans `lib/claude.js`.

## Correction du cas de la chambre (5 octobre 2026)

Le retour utilisateur montrait un lit devant une fenêtre, la disparition du radiateur et des fonctions de rangement/coiffeuse, ainsi qu'un éclairage trop ornemental pour une demande « épuré ».

- Le relevé conserve désormais ses observations : le solveur ne déplace ni ne supprime les meubles détectés pour forcer une maquette sans collision. Les erreurs restent à confirmer, et ne sont pas transformées en faits.
- Les radiateurs, cuisines intégrées et cheminées sont des installations fixes. Les anciens radiateurs classés `autre` restent reconnus par leur nom. La TV murale a une famille et une hauteur de pose distinctes.
- Les murs non vus sont identifiés ; une consigne de prise de vue n'est plus une preuve de présence d'une porte. Les remarques et les incertitudes de relevé sont transmises à la proposition et présentées dans le panneau.
- La sélection « épuré » utilise les descriptions visuelles et pénalise les volumes chargés ; elle exclut les ornements manifestes. Cette règle éditoriale est une amélioration du filtre textuel, pas un classement visuel appris. Les briefs mixtes (par exemple épuré et classique) ne subissent pas cette exclusion stricte.
- Les lits candidats doivent laisser une marge d'usage. Les fonctions existantes de couchage, rangement, vêtements, travail/coiffeuse et TV sont conservées si aucun remplacement adapté n'est retenu, sauf suppression explicitement demandée. Un chevet ne remplace pas une commode.
- Les vues complémentaires portent leur rôle réel. Le client peut préciser les contraintes et les usages à préserver ; les notes sont enregistrées avant l'analyse.

`tests/fixtures/chambre-fenetre.js` est une annotation manuelle inspirée du cas, avec des **dimensions fictives de test**. Les tests contrôlent la conservation des installations et usages, l'absence de lit devant la fenêtre, les meubles trop grands et le filtre de style. Ils ne mesurent pas la qualité de détection du modèle IA sur la photo réelle. La photo de l'utilisateur n'est pas ajoutée au dépôt.

Pour valider la qualité réelle, comparer sur plusieurs pièces : photos de plusieurs côtés, largeur/profondeur mesurées, dimensions d'un meuble de référence, inventaire corrigé et deux ou trois inspirations de style. Une porte hors champ ou une cote inconnue doit rester explicitement incertaine. L'appellation « épuré » seule ne définit pas toutes les préférences esthétiques.
