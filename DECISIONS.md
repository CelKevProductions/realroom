# Décisions — parcours guidé et moteur, 10 octobre 2026

## Portée et sources

La demande actuelle prévaut sur les restrictions contradictoires du protocole joint : modifier la capture, guider Maison Corleone, ajouter le budget libre et choisir la vue du rendu sont expressément demandés. Les changements restent sur `codex/realroom-plan-optimisation-2026-10-09`, en preview, sans merge, promotion ou migration de production.

Sources consultées : [Merrell et al., 2011](https://graphics.stanford.edu/projects/furniture/), [Yu et al., 2011](https://web.cs.ucla.edu/~dt/papers/siggraph11/siggraph11.pdf), [Kán, 2018](https://www.peterkan.com/download/ieeevr2018.pdf), [Apple RoomPlan](https://developer.apple.com/augmented-reality/roomplan/), [fiche Lagarsoft](https://apps.apple.com/app/id6779339424), [PDF.js](https://mozilla.github.io/pdf.js/examples/). Merrell est référencé depuis Stanford, et non présenté comme un « moteur MIT » officiel. Les repères et coefficients RealRoom sont une adaptation, pas une transcription de normes ou une certification.

## Capture

- Trois choix principaux : photos, Scan Android, Scan Apple. L'import d'un plan est un lien séparé. Les informations secondaires et tutoriels sont repliés.
- Les photos donnent une géométrie plus incertaine. Le scan améliore l'échelle et le contour ; il ne garantit pas la beauté ni la fidélité de la photo IA finale. Les mentions de qualité décrivent donc la fidélité du plan.
- Lagarsoft reste une application iOS sur appareil LiDAR compatible. Safari ne propose pas de permission RoomPlan. Le parcours Apple est application → Export → DXF · 2D floorplan → Fichiers → retour au site. Aucun compte externe ou abonnement souscrit.
- Android utilise le vrai WebXR/ARCore dans Chrome. Polygones simples de 3 à 32 coins, concaves et obliques, sans exigence d'angles droits ; un contour croisé, plusieurs niveaux de sol, des trous ou des murs courbes exacts restent hors contrat. Une pièce n'est jamais remplacée par son rectangle englobant.
- Le DXF réel fourni a été lu localement : 8 coins, 2 portes, environ 13,14 m². Il n'est pas copié dans le dépôt. Lecture déterministe des unités et calques ; pas de conversion IA de coordonnées métriques. Fal n'est pas nécessaire pour DXF → JSON.
- PDF/image : choisir une page, calibrer une longueur connue, tracer une seule pièce puis ajouter les ouvertures. Aucune reconnaissance automatique des cotes n'est prétendue. PDF.js et son worker sont locaux, en version `legacy` pour les navigateurs mobiles ; document non envoyé à un tiers.
- Le QR App Store est distinct du lien privé de transfert. Le transfert existant garde ses secrets distincts, durée de 15 minutes et confirmation sur ordinateur. Les exports Android JSON et DXF sont proposés dans l'aperçu.

## Mobilier et optimisation

Audit : 341 produits avec des dimensions numériques ; 322 ont `dimsLues`, 19 restent estimés et sont désormais signalés. Ces cotes ne sont pas une mesure indépendante du modèle 3D. 334 prix sont renseignés, 7 doivent être confirmés. Le catalogue ne contient pas d'armoire ou commode identifiée comme telle : les dimensions du test de référence sont une fixture synthétique, jamais un nouveau produit vendu.

Une description commerciale peut citer un chevet sans que le produit soit un chevet. Les fauteuils, appliques, suspensions et salons de jardin ne sont plus reclassés en tables d'appoint par ce seul mot. Le banc réel utilise Nordic Duo (1,70 × 2,10), deux petites tables Nordic (0,40 × 0,40) et Évasion Tropicale (1,50 × 0,42), avec les dimensions présentes au catalogue.

Diagnostic du premier banc : la résolution séquentielle écartait un chevet et l'armoire du scénario de référence avant l'optimisation. Une composition géométriquement admissible de trois meubles donnait alors une note élevée, mais échouait au besoin de cinq meubles. Correctif : optimiser l'ensemble en cas de conflit avant d'écarter un ajout. Les contrôles géométriques restent ensuite obligatoires.

Les mouvements groupent lit/chevets et suivent les supports. Les huit meilleurs mouvements locaux, au lieu de quatre, sont recontrôlés avec les chemins. Les instantanés du recuit sont désormais classés avec le bilan complet de circulation. Un départ difficile dispose d'un budget borné de 768 à 1 536 itérations par départ, les cas simples conservent le budget court. Aucun entraînement ni apprentissage entre clients.

Les 20 000–60 000 itérations et la température « 2 → 0 » du protocole ne sont pas recopiées : les pénalités RealRoom ont une autre échelle et le moteur fonctionne aussi sur téléphone. Le banc complet mesuré prend environ 0,5–2,1 s par chambre sur cette machine ; ce n'est pas une garantie de temps mobile. Jusqu'à trois variantes sont proposées si elles diffèrent assez et n'aggravent aucun contrôle, avec moins de variantes lorsqu'aucune autre n'est admissible.

## Style, budget et rendu

Les onze styles, patrons et références éditoriales existants sont conservés. L'index OpenCLIP réellement calculé couvre 278/341 produits ; aucun score n'est inventé pour les autres. Les inspirations influencent les préférences sémantiques et le choix des produits, jamais les dimensions. Cela suit la demande explicite de mieux adapter et étiqueter les styles, malgré la phrase du protocole qui les réserve au seul rendu. Aucun scraping Pinterest ni copie de photos protégées.

Le budget se saisit librement, en euros et centimes. Le sac à dos existant garde quantités, usages et alternatives ; les pièces conservées ne disparaissent pas pour masquer un dépassement.

Quatre vues : entrée, fond, gauche, droite. Aperçu 3D approximatif et photo du même rôle, sans déduire une calibration exacte. Une référence absente et un angle invalide sont refusés avant débit. Ouvrir la fenêtre Maison Corleone ne déclenche plus une génération ; le client clique après le choix de vue. L'angle est conservé dans les métadonnées JSON du rendu, sans changement de schéma, et l'avant/après retrouve la photo correspondante. Modèles, coût unitaire et suivi/remboursement existants sont conservés.

## Contrôle et repli

Le scénario de référence sans fenêtre ajoutée (la fenêtre n'est pas spécifiée dans le protocole) passe avec les cinq meubles : tête adossée, deux chevets alignés, aucune collision, porte dégagée, rangement accessible, côtés du lit et chemins utilisables. Un test distinct vérifie la vraie fonction de proposition.

Le banc de dix chambres de 9 à 20 m² expose aussi ses échecs : 10/10 sans collision, débordement ni porte occupée selon le vérificateur géométrique ; 9/10 sans conflit supplémentaire de fenêtre ; 6/10 satisfont tous les repères d'usage, 8/10 conservent les quatre meubles proposés. Les quatre cas difficiles restent avertis, pas certifiés. Ces tests ne démontrent ni un optimum global ni la précision de l'analyse photographique.

Une comparaison visuelle bornée complète les tests. Elle utilise le même mobilier et les mêmes dimensions ; elle n'est pas une auto-certification esthétique. L'instruction d'itérer sans fin en générant des photos est remplacée par un contrôle limité : un modèle vision ou un rendu photoréaliste peut inventer des meubles, des passages et des cotes. Aucune modification automatique des poids d'accès sur la seule base d'un avis vision.

`docs/comparaison-ameublement.png` montre le cas synthétique de 20 m² : mêmes quatre meubles et même point de vue. Le lit passe du centre, avec rangement au pied gênant, à un groupe adossé ; le rangement rejoint un mur et les passages sont mieux séparés. La paroi droite est coupée dans cette vue de maquette et peut masquer le deuxième chevet : le dessin seul ne prouve pas les dégagements. L'envoi au CDN Fal pour une critique Nemotron a été refusé par le contrôle automatique, qui jugeait le fichier potentiellement privé et l'autorisation externe insuffisante. Aucun envoi, appel de génération/vision ni dépense Fal n'a été effectué ; le contrôle visuel est local. Cette partie de la boucle vision externe du protocole n'est donc pas exécutée et ne doit pas être présentée comme validée par un autre modèle.

Repli : `REALROOM_MOTEUR_GUIDE=0` côté serveur et `NEXT_PUBLIC_REALROOM_MOTEUR_GUIDE=0` au build côté client. Pour essayer immédiatement la preview : `localStorage.setItem('rr-moteur-guide','0')`, puis recharger ; supprimer cette clé pour réactiver. Les nouvelles propositions et boutons d'optimisation respectent le drapeau. Le relevé, les achats existants, la sélection budgétaire et les contrôles géométriques restent utilisables. Ce repli désactive l'optimisation, pas la sécurité ni une pièce déjà enregistrée.

Reproduction : `npm ci`, `npm test`, `node scripts/valider-ameublement.mjs`, `npm run build`, puis `node tests/plan.mjs` et `GUIDES_SEULS=1 node tests/plan.mjs` avec Playwright/Chromium disponibles. Le JSON du banc garde avant/après, meubles écartés, alertes et paramètres ; les positions et scores sont déterministes, les durées dépendent de la machine.
