# Réaménagement : idées et espaces de vie

Cliquer sur **Réaménager automatiquement** ouvre désormais un dialogue dans RealRoom et Maison Corleone. Le client choisit les espaces à créer, leur capacité et ses nouvelles envies ; la validation envoie le brief à l’API, compose les ensembles et enregistre le résultat. Annuler laisse la pièce intacte.

Le formulaire reprend le budget et le brief précédents, propose un coin repas dans un grand salon, et affiche les choix adaptés à la fonction : repas, bureau, lecture, rangement. Le nombre de places est réglable à 2, 4, 6 ou 8. Une nouvelle idée écrite comme « une table à manger pour 6 personnes » coche le coin repas et ajuste sa capacité. Modifier seulement le style ne réactive pas une case décochée. Les espaces, places et nouveaux textes sont persistés ; une erreur de service conserve les idées pour réessayer.

Les cases explicites prennent le pas sur les anciennes envies. Les zones demandées restent prioritaires malgré une proposition IA qui les démoterait. « Table à manger » est reconnu aussi sans formulaire. La capacité demandée contraint les alternatives de table ; les chaises adultes ne sont pas remplacées par des fauteuils de salon. Si la recherche budgétaire bornée omet une partie d’un repas finançable, une réservation économique de table et chaises précède les autres achats.

Avant d’abandonner un espace, la composition tente les mêmes usages sans compléments facultatifs et avec des produits plus compacts du catalogue éligible. Trois reprises au plus, sans déplacer le mobilier gardé ni augmenter les prix quand un plafond est fixé. Les modèles, quantités, accès, ouvertures et hauteurs restent contrôlés. Aucun nouveau produit ni nouvel appel IA n’est introduit. Une impossibilité de budget, de place, de catalogue ou de pose est affichée avec les pièces manquantes, par espace, directement sous la composition.

| Frontière | Contrôle | Résultat |
|---|---|---|
| Dialogue | Rendu React FR/EN : formulaire natif, espaces, places, budget, envies, annulation et validation | Réussi |
| Client → API | Harnais des deux démos : transmission des espaces et places, conservation du plan en cas d’échec | Réussi |
| Validation | Choix connus uniquement ; quantités 2/4/6/8 ; champs normalisés pour les projets et validés pour la démo | Réussi |
| Composition | Repas sous budget contraint, table compacte dans le salon synthétique, six chaises et TV avec le catalogue partagé | Réussi |
| API → stockage → réponse | Nouveau texte/espaces/places persistés ; salon avec table et quatre chaises identiques après rechargement | Réussi |
| Navigateur déployé | L’aperçu redirige ce navigateur vers « Login – Vercel » | Bloqué par l’authentification |

Validation : **186 tests unitaires**, **build Next** et **14 scénarios API** avec fournisseur simulé, serveur isolé et base PGlite. Les données des tests et logs publiés viennent uniquement des fixtures synthétiques. Aucun scan, capture, résultat ou métrique client n’est inclus. Le rendu React vérifie le contenu du dialogue ; il ne constitue pas une validation visuelle ou interactive dans un navigateur.

Reproduction : `npm test`, `npm run build`, `env -u DXF_REGRESSION PORT=3237 node tests/api.mjs`. Logs dans [brief-reamenagement](brief-reamenagement/). Les pièces impossibles gardent un résultat partiel déclaré ; une table n’est jamais forcée dans un passage. Le mode partiel conserve les meubles en place et transmet les activités au fournisseur ; les reprises macro concernent le mode « tout ».

Même branche et PR nº 2 ; aperçu uniquement.
