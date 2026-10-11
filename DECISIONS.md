# Décisions — parcours guidé et moteur, 10 octobre 2026

## Portée et sources

La demande actuelle prévaut sur les restrictions contradictoires du protocole joint : modifier la capture, guider Maison Corleone, ajouter le budget libre et choisir la vue du rendu sont expressément demandés. Les changements restent sur `codex/realroom-plan-optimisation-2026-10-09`, en preview, sans merge, promotion ou migration de production.

Sources consultées : [Merrell et al., 2011](https://graphics.stanford.edu/projects/furniture/), [Yu et al., 2011](https://web.cs.ucla.edu/~dt/papers/siggraph11/siggraph11.pdf), [Kán, 2018](https://www.peterkan.com/download/ieeevr2018.pdf), [Apple RoomPlan](https://developer.apple.com/augmented-reality/roomplan/), [fiche Lagarsoft](https://apps.apple.com/app/id6779339424), [PDF.js](https://mozilla.github.io/pdf.js/examples/). Merrell est référencé depuis Stanford, et non présenté comme un « moteur MIT » officiel. Les repères et coefficients RealRoom sont une adaptation, pas une transcription de normes ou une certification.

## Capture

- Quatre choix principaux : photos, Scan Android, Scan Apple et Plan de la maison. Les informations secondaires et tutoriels sont repliés. Le QR de transfert Android et le QR App Store Apple sont affichés directement à côté de leur méthode sur ordinateur ; aucun QR dans les photos.
- Les photos donnent une géométrie plus incertaine. Le scan améliore l'échelle et le contour ; il ne garantit pas la beauté ni la fidélité de la photo IA finale. Les mentions de qualité décrivent donc la fidélité du plan.
- Lagarsoft reste une application iOS sur appareil LiDAR compatible. Safari ne propose pas de permission RoomPlan. Le parcours Apple est application → Export → DXF · 2D floorplan → Fichiers → retour au site. Aucun compte externe ou abonnement souscrit.
- Android utilise le vrai WebXR/ARCore dans Chrome. Polygones simples de 3 à 32 coins, concaves et obliques, sans exigence d'angles droits ; un contour croisé, plusieurs niveaux de sol, des trous ou des murs courbes exacts restent hors contrat. Une pièce n'est jamais remplacée par son rectangle englobant.
- Le DXF réel fourni a été lu localement : 8 coins, 2 portes, environ 13,14 m². Il n'est pas copié dans le dépôt. Lecture déterministe des unités et calques ; pas de conversion IA de coordonnées métriques. Fal n'est pas nécessaire pour DXF → JSON.
- PDF/image : choisir une page, calibrer une longueur connue, tracer une seule pièce puis ajouter les ouvertures. Aucune reconnaissance automatique des cotes n'est prétendue. PDF.js et son worker sont locaux, en version `legacy` pour les navigateurs mobiles ; document non envoyé à un tiers.
- Le QR App Store est distinct du lien privé de transfert. Le transfert existant garde ses secrets distincts, durée de 15 minutes et confirmation sur ordinateur. Les exports Android JSON et DXF sont proposés dans l'aperçu.
- Le téléphone ouvre un parcours compact Android ou Apple selon la plateforme. La compatibilité Android est vérifiée avec WebXR. Safari ne révèle pas le modèle matériel ni la présence de LiDAR : Lagarsoft vérifie son capteur, le site ne prétend pas déduire qu'un iPhone récent possède LiDAR.
- Cotes manuelles : pas de saisie libre (`step="any"`), y compris avec les bornes au millimètre d'un scan. Les murs sont nommés A, B, C… sur le plan et dans les champs sans changer les IDs enregistrés.

## Mobilier et optimisation

Audit : 341 produits avec des dimensions numériques ; 322 ont `dimsLues`, 19 restent estimés et sont désormais signalés. Ces cotes ne sont pas une mesure indépendante du modèle 3D. 334 prix sont renseignés, 7 doivent être confirmés. Le catalogue ne contient pas d'armoire ou commode identifiée comme telle : les dimensions du test de référence sont une fixture synthétique, jamais un nouveau produit vendu.

Une description commerciale peut citer un chevet sans que le produit soit un chevet. Les fauteuils, appliques, suspensions et salons de jardin ne sont plus reclassés en tables d'appoint par ce seul mot. Le banc réel utilise Nordic Duo (1,70 × 2,10), deux petites tables Nordic (0,40 × 0,40) et Évasion Tropicale (1,50 × 0,42), avec les dimensions présentes au catalogue.

Diagnostic du premier banc : la résolution séquentielle écartait un chevet et l'armoire du scénario de référence avant l'optimisation. Une composition géométriquement admissible de trois meubles donnait alors une note élevée, mais échouait au besoin de cinq meubles. Correctif : optimiser l'ensemble en cas de conflit avant d'écarter un ajout. Les contrôles géométriques restent ensuite obligatoires.

Les mouvements groupent lit/chevets et suivent les supports. Les huit meilleurs mouvements locaux, au lieu de quatre, sont recontrôlés avec les chemins. Les instantanés du recuit sont désormais classés avec le bilan complet de circulation. Un départ difficile dispose d'un budget borné de 768 à 1 536 itérations par départ, les cas simples conservent le budget court. Aucun entraînement ni apprentissage entre clients.

Les 20 000–60 000 itérations et la température « 2 → 0 » du protocole ne sont pas recopiées : les pénalités RealRoom ont une autre échelle et le moteur fonctionne aussi sur téléphone. Le banc complet mesuré prend environ 0,5–2,1 s par chambre sur cette machine ; ce n'est pas une garantie de temps mobile. Jusqu'à trois variantes sont proposées si elles diffèrent assez et n'aggravent aucun contrôle, avec moins de variantes lorsqu'aucune autre n'est admissible.

Les candidats réservent aussi un modèle compact par usage, en plus de l'alternative économique. Budget, formes et contrôles de circulation peuvent écarter les ajouts. Aucune dimension ou fiche produit inventée. Le Worker de simulation reste disponible pour les tests ; les deux démos publiques utilisent désormais l'IA et le solveur côté serveur.

La démo appelle `/api/demo/amenager` sans compte : plan métrique, mobilier courant, budget, envies, pièces à garder et au plus trois inspirations JPEG réduites. Aucune photo de relevé, de rendu, donnée de compte ou clé d'API n'est transmise depuis le navigateur. Le serveur utilise son catalogue et sa clé Fal/Anthropic, exige un appel réel même avec `REALROOM_SIMULATION=1`, puis applique le même moteur de contraintes. Il ne crée pas de projet en base et ne débite pas de crédit image ; la proposition est conservée dans le magasin du navigateur, avec source IA. Une révision locale protège contre l'écrasement d'une pièce modifiée pendant l'attente. Aucun repli vers une simulation en cas d'échec du fournisseur.

Les compteurs Postgres sont atomiques : dix demandes par adresse IP hachée et trente au total sur une fenêtre de 24 h par défaut (`DEMO_AMENAGEMENTS_PAR_JOUR`, `DEMO_AMENAGEMENTS_GLOBAUX_PAR_JOUR`). `DEMO_AMENAGEMENT_IA=0` désactive les appels. Sur Vercel, une base et un secret de cet environnement sont requis, en plus d'une clé IA. L'analyse photo, les rendus et les paiements de la démo restent simulés. La requête est bornée à 1,3 Mo et la sortie IA à 12 000 tokens ; les tentatives Fal partagent un délai total de 270 s. Ce sont des plafonds d'usage, pas une garantie de coût monétaire ou de réussite du modèle.

## Style, budget et rendu

Les onze styles, patrons et références éditoriales existants sont conservés. L'index OpenCLIP réellement calculé couvre 278/341 produits ; aucun score n'est inventé pour les autres. Les inspirations influencent les préférences sémantiques et le choix des produits, jamais les dimensions. Cela suit la demande explicite de mieux adapter et étiqueter les styles, malgré la phrase du protocole qui les réserve au seul rendu. Aucun scraping Pinterest ni copie de photos protégées.

Le budget se saisit librement, en euros et centimes. Le sac à dos existant garde quantités, usages et alternatives ; les pièces conservées ne disparaissent pas pour masquer un dépassement.

Vue Photo : quatre côtés et quatre coins, y compris dans une pièce concave, et regard libre sur 360°. Le rendu utilise l'instantané métrique de la caméra choisie, jamais un retour forcé à l'entrée. Étape 1 : cadrage et validation. Étape 2 : dépôt/prise de photo du même angle, lumière jour/nuit et clic de génération. Continuer sans photo exige un choix explicite et affiche une perte possible de réalisme. Pas de redirection vers la page de relevé.

Les autres angles de la vraie pièce complètent matériaux et détails. La consigne fixe la caméra et le mobilier à partir de la capture 3D ; les références sont plafonnées à dix images. Une photo de référence dédiée est indépendante des quotas de relevé/inspiration. Son instantané privé reste accessible dans l'historique après un remplacement, et est supprimé avec la pièce. Une seule génération photo active par compte : un contrôle de révision dans le débit atomique protège les demandes concurrentes. Modèles, coût unitaire et remboursement restent inchangés ; `num_images=1` et `limit_generations=true` demandent une seule sortie au fournisseur.

Les écrans fixes restent dans le viewport, avec défilement interne uniquement lorsque le contenu le nécessite. Capture centrée sous le titre et les méthodes ; blocs tutoriel 30 s et « La pièce au quotidien » retirés de la pièce meublée. La flèche de visite est cliquable, les transitions sont ralenties, et le rectangle filaire extérieur du chargement est supprimé.

## Contrôle et repli

Le scénario de référence sans fenêtre ajoutée (la fenêtre n'est pas spécifiée dans le protocole) passe avec les cinq meubles : tête adossée, deux chevets alignés, aucune collision, porte dégagée, rangement accessible, côtés du lit et chemins utilisables. Un test distinct vérifie la vraie fonction de proposition.

Le banc de dix chambres de 9 à 20 m² expose aussi ses échecs : 10/10 sans collision, débordement ni porte occupée selon le vérificateur géométrique ; 9/10 sans conflit supplémentaire de fenêtre ; 6/10 satisfont tous les repères d'usage, 8/10 conservent les quatre meubles proposés. Les quatre cas difficiles restent avertis, pas certifiés. Ces tests ne démontrent ni un optimum global ni la précision de l'analyse photographique.

Une comparaison visuelle bornée complète les tests. Elle utilise le même mobilier et les mêmes dimensions ; elle n'est pas une auto-certification esthétique. L'instruction d'itérer sans fin en générant des photos est remplacée par un contrôle limité : un modèle vision ou un rendu photoréaliste peut inventer des meubles, des passages et des cotes. Aucune modification automatique des poids d'accès sur la seule base d'un avis vision.

`docs/comparaison-ameublement.png` montre le cas synthétique de 20 m² : mêmes quatre meubles et même point de vue. Le lit passe du centre, avec rangement au pied gênant, à un groupe adossé ; le rangement rejoint un mur et les passages sont mieux séparés. La paroi droite est coupée dans cette vue de maquette et peut masquer le deuxième chevet : le dessin seul ne prouve pas les dégagements. L'envoi au CDN Fal pour une critique Nemotron a été refusé par le contrôle automatique, qui jugeait le fichier potentiellement privé et l'autorisation externe insuffisante. Aucun envoi, appel de génération/vision ni dépense Fal n'a été effectué ; le contrôle visuel est local. Cette partie de la boucle vision externe du protocole n'est donc pas exécutée et ne doit pas être présentée comme validée par un autre modèle.

Repli : `REALROOM_MOTEUR_GUIDE=0` côté serveur et `NEXT_PUBLIC_REALROOM_MOTEUR_GUIDE=0` au build côté client. Pour essayer immédiatement la preview : `localStorage.setItem('rr-moteur-guide','0')`, puis recharger ; supprimer cette clé pour réactiver. Les nouvelles propositions et boutons d'optimisation respectent le drapeau. Le relevé, les achats existants, la sélection budgétaire et les contrôles géométriques restent utilisables. Ce repli désactive l'optimisation, pas la sécurité ni une pièce déjà enregistrée.

Reproduction : `npm ci`, `npm test`, `node scripts/valider-ameublement.mjs`, `npm run build`, puis `node tests/plan.mjs` et `GUIDES_SEULS=1 node tests/plan.mjs` avec Playwright/Chromium disponibles. Le JSON du banc garde avant/après, meubles écartés, alertes et paramètres ; les positions et scores sont déterministes, les durées dépendent de la machine.

## Plan de zones — 11 octobre 2026

La composition précède désormais la géométrie : sept programmes par surface réelle, emplacements par usage, puis groupes salon/repas/lecture/sommeil/travail/rangement. L’appel IA existant reçoit cet inventaire et renvoie seulement les usages, priorités et raisons du plan de vie. Les coordonnées restent calculées localement. Le nouveau module macro compare des patrons de groupes dans le vrai polygone, puis le micro conserve chaque meuble dans sa zone. Les fauteuils de lecture ne sont plus regroupés avec le canapé.

Les emprises indicatives du protocole ne sont pas des contraintes fixes. Les vrais produits, accès, portes et chemins restent prioritaires. La cible de passage reste 90 cm ; une grille de coordonnées critiques évite les faux blocages de la grille uniforme. Test ciblé : 92 cm accepté, 86 cm refusé. Le micro vérifie encore les collisions, ouvertures et usages. Une composition dense est réduite par priorité, avec au plus six reprises, et chaque manque reste déclaré.

Le budget ne peut pas garantir une composition de base impossible à financer : on garde le plafond et on indique les ensembles incomplets. La capacité d’une table et le contrat de chevets intégrés sont conservés dans les alternatives. Aucune chaise adulte n’est remplacée par un tabouret enfant. L’ensemble Dining Contemporaine est exclu du placement automatique tant que seules les dimensions de sa table sont connues. Les usages absents du catalogue ne deviennent pas des SKU fictifs. Pour les salles de bain, petite surface et plomberie gardent leurs avertissements ; les positions techniques inconnues ne sont pas devinées.

Les références complètes chambre et salon passent. Banc de 10 chambres et 13 salons : 23/23 sans conflit géométrique, 9/10 et 10/13 plans partiels ou totaux admissibles, 5/10 et 6/13 programmes obligatoires complets. Un rangement seul dans une chambre ne compte pas comme une composition complète. Les sept inventaires sont contrôlés sur quatre surfaces chacun. 154 tests unitaires, build et 12 scénarios API réussis, avec fournisseur simulé et DXF client conservé localement. Aucun nouvel appel IA payant ni test matériel AR n’est revendiqué.

Le rapport `docs/plan-zones-2026-10-11.md`, ses logs JSON et la comparaison métrique documentent les résultats et les limites. Le comparatif utilise les mêmes onze produits synthétiques et le même salon, ancien commit `9099770` contre nouveau moteur. La ligne d’ensembles et les détails repliés sont partagés par RealRoom et Maison Corleone. Même branche et même PR, sans merge ni promotion en production.

## Objets génériques et caméra Photo — 11 octobre 2026

La demande de compléter les objets 3D autorise 44 références de projet génériques, distinctes des 341 produits commerciaux. Six tailles/formes de tables basses et les autres usages manquants disposent de modèles paramétriques originaux aux dimensions contrôlées. Le catalogue partagé serveur/navigateur les propose manuellement et automatiquement. Les usages sont restreints explicitement ; les alternatives préfèrent le mobilier de la boutique lorsqu’il convient. Les objets génériques ne deviennent pas des offres Maison Corleone : budget indicatif, « ~ », total estimé, aucune photo commerciale ni lien d’achat. Leurs provisions comptent dans le plafond.

Les flèches déplacent la caméra Photo à hauteur constante, relativement au regard, dans le contour réel. Des boutons tactiles complètent le clavier ; les champs, dialogues et pertes de focus sont protégés. Le rendu fige immédiatement la vue courante et son rapport d’image. Ajouter une photo réelle ne modifie plus le cadrage. Le fournisseur reçoit aussi les dimensions et matériaux des objets génériques présents dans la capture, sans nouvelle API ni appel payant.

164 tests unitaires, build et 12 scénarios API passent. Sur le grand DXF conservé localement, l’essai de composition produit 16 éléments dont six chaises, avec quatre ensembles, sous le budget testé et avec audit d’accès admissible. La redirection des nouvelles vignettes par le proxy a été corrigée puis la série API rejouée. Le rapport `docs/generiques-camera-2026-10-11.md` détaille ces contrôles. La validation interactive navigateur demeure indisponible ; même branche et PR, sans merge, promotion ni migration de production.
