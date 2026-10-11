# Relevé mobile, contour et inspirations (10 octobre 2026)

Le scan est un brouillon métrique à contrôler, pas un mesurage certifié. Le client confirme son import, puis corrige le plan avant de commander.

## Android

Chrome/WebXR sur appareil ARCore compatible, HTTPS et autorisation de caméra. Pointer **3 à 32 coins consécutifs**, faire le tour du contour, puis terminer sans répéter le premier point. Le contour peut être concave (pièce en L), triangulaire, oblique ou légèrement imparfait. Pas de contrainte d'angle droit. Les points de sol peuvent différer de 15 cm au maximum ; une marche ou un étage différent ne constitue pas une pièce à sol plat. Les côtés inférieurs à 20 cm, contours croisés/redondants et surfaces inférieures à 1 m² sont refusés.

Les commandes gardent au moins 96 px / 12 % de hauteur de viewport sous elles en portrait, et 96 px en paysage, plus la safe area. Ce n'est pas une détection du bandeau système Android, inaccessible au site. Le panneau est défilable et les actions restent en bas du panneau. Le dernier segment affiche sa longueur. Portes, fenêtres, meubles et hauteur restent à compléter.

## Apple sans publication de notre application

[RoomPlan](https://developer.apple.com/augmented-reality/roomplan/) est un framework Swift natif, pas une API HTTP ni une permission de caméra Safari. Il requiert un [appareil avec LiDAR](https://developer.apple.com/documentation/RoomPlan/RoomCaptureSession/isSupported).

Le parcours principal est désormais **Scan Apple → Lagarsoft → DXF**, avec QR App Store et tutoriel animé. L'export réel fourni est validé : huit coins, deux portes, unités mètres. Aucun export JSON spécifique d'une application tierce n'est promis. La hauteur, les volumes du mobilier et le sens de porte sont à compléter après le DXF 2D. Voir [le parcours guidé](parcours-guide.md).

L'adaptateur JSON Apple `CapturedRoom` est conservé dans une section avancée, avec le contrat `realroom-scan-v1`. Sa compatibilité est testée avec l'encodeur Swift RealRoom ; champs inconnus, maillage et photos privées sont éliminés. USDZ/OBJ/GLB seuls ne deviennent pas un plan paramétrique. RoomPlan reste natif, et le DXF Lagarsoft évite la publication d'une application RealRoom sur l'App Store.

Les murs Apple non rectangulaires sont chaînés par leurs extrémités, avec rapprochement maximal de 35 cm ; le polygone résultant est revalidé. Un contour ouvert ou ambigu est refusé. Les scans multi-pièces et sols à plusieurs niveaux restent hors périmètre.

## QR et transfert

Sur RealRoom et Maison Corleone, y compris leurs démos, « Scanner avec mon téléphone » crée un QR décodable vers `/fr/releve` ou `/en/releve`. Le téléphone n'a pas besoin du compte du propriétaire. Le jeton d'envoi est dans le fragment d'URL ; la clé de lecture différente reste uniquement sur l'ordinateur. Les clés de 256 bits sont stockées par empreinte SHA-256. Ni pièce existante ni compte ne sont lisibles avec ce lien.

Le téléphone contrôle l'aperçu, puis envoie une fois son JSON métrique. L'ordinateur interroge le brouillon toutes les 2,5 secondes et affiche un aperçu, sans remplacer automatiquement la pièce. Envoi atomique unique, limite de création par adresse réseau, expiration après 15 minutes, contrôle d'origine, corps borné et validation serveur identique au navigateur. La réception/annulation supprime le brouillon ; les brouillons expirés sont purgés à la prochaine création (pas de promesse d'effacement physique à la milliseconde de l'expiration). Le scan de la démo est donc une exception explicite à son fonctionnement habituellement local : ce transfert temporaire utilise le serveur.

## Plan et moteur

`modele.contour` contient les vertices `[x,z]` ordonnés, dans le repère métrique centré. Les dimensions largeur/profondeur restent le cadre englobant. Chaque côté porte l'identifiant `pan_1…pan_32`, ses ouvertures et sa couleur. Les anciens rectangles gardent leurs quatre noms de murs.

Le plan SVG, le sol et le plafond 3D, les murs, les ouvertures, les contrôles de limites, la grille de circulation et les départs du solveur utilisent le contour réel. L'enveloppe des meubles est conservatrice : les rotations obliques peuvent écarter une position qui aurait tenu avec un test de polygones orientés plus fin, mais ne créent pas un sol fictif dans le renfoncement.

L'éditeur propose déplacement tactile des coins, coordonnées chiffrées, longueur des côtés, ajout/retrait de coins et portes/fenêtres sur chaque pan. Un changement du nombre de coins efface explicitement les ouvertures à replacer, annoncé dans l'interface. Le mobilier observé est conservé. Les contours invalides ne peuvent pas être enregistrés. Modifier largeur/profondeur redimensionne le contour et les observations ; vérifier les autres cotes après correction.

## Styles

Onze références publiques IKEA, Muuto et V&A sont enregistrées dans `lib/references-styles.js` : source, date, styles associés, indices descriptifs et affinités de composition. Ce sont des interprétations éditoriales, pas des coordonnées déduites des images ni des annotations de décorateur. Aucun catalogue photo tiers n'est recopié ni utilisé pour prétendre entraîner une IA.

Les indices enrichissent les étiquettes textuelles des produits et apportent un bonus plafonné dans leur sélection ; l'index OpenCLIP existant reste distinct et conserve sa couverture réelle de 278/341. Les exemples modifient également le classement des patrons, avec moyenne en cas de styles mélangés. Les contraintes géométriques et budgétaires priment. Les liens d'inspiration sont consultables dans le panneau de confort des deux éditions.

## Vérifications

101 tests unitaires, compilation Next.js, parcours complet `tests/plan.mjs` et parcours QR/polygones `TRANSFERTS_SEULS=1 node tests/plan.mjs`. Le QR PNG est décodé par une bibliothèque indépendante, avec son URL réelle ; le téléphone est un second navigateur sans cookie du compte. Les tests contrôlent lecture/envoi séparés, envoi concurrent unique, expiration, rejet de contours invalides, persistance, lit effectivement retenu dans un L et parcours ordinateur/mobile dans les deux éditions. Les capteurs physiques Android restent à vérifier sur appareil ; le DXF Lagarsoft réel fourni est validé. Les tests du nouveau parcours sont décrits dans `parcours-guide.md`.
