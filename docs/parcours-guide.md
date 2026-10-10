# Parcours photos, Android et Lagarsoft

Le client relève sa pièce, vérifie le plan 2D, conserve les meubles importants, choisit budget et style, compare les dispositions et prépare sa photo finale. Ce parcours est partagé entre RealRoom et Maison Corleone, en français et anglais.

## Imports et données

`lib/plans.js` lit les DXF ASCII R12 POLYLINE/VERTEX et LWPOLYLINE linéaires fermées. L'en-tête `$INSUNITS` ou la déclaration Lagarsoft « Units: metres » fixe l'échelle. Sans unité reconnue, l'utilisateur doit la choisir. Calques FLOOR/ROOM/SOL prioritaires, DOORS et WINDOWS pour les ouvertures ; une maison avec plusieurs contours propose un sélecteur de pièce. Des murs LINE fermant une boucle simple sont aussi acceptés. Limites : 5 Mo, 20 000 entités, 40 pièces et 32 coins par pièce. Pas d'INSERT/blocs, bulges/courbes ou boucles avec trous ; choisir dans ce cas le tracé sur PDF/image.

Les calques de sol sont choisis avant l'analyse des sommets : un meuble ou une annotation courbe ne fait pas refuser un sol linéaire valide. Une coordonnée incomplète ou une abscisse dupliquée reste refusée. L'interface n'affiche que le résultat du dernier fichier choisi, annonce la lecture et guide explicitement le choix des unités absentes ou la réexportation d'un fichier incompatible.

Le contrat `realroom-scan-v1` reçoit les sources `plan-dxf` et `plan-dessine` en plus des scans existants. Chaque import passe dans `depuisScan`, d'abord pour l'aperçu puis côté serveur avant sauvegarde. DXF 2D ne fournit ni hauteur, ni volume mobilier, ni charnière de porte : ces éléments restent à compléter. L'origine des cotes et l'incertitude restent visibles. L'import conserve photos et rendus et refuse un écrasement concurrent.

`PlanTrace` affiche les PDF/images localement, avec une longueur réelle pour l'échelle. Le client trace les coins en ordre. Le worker PDF est copié par `scripts/prepare-assets.mjs` lors de `npm run build`, et n'est pas téléchargé d'un CDN. `proxy.js` exclut `/guides/` et `/pdf/` des redirections linguistiques.

## Guides animés

Trois tutoriels, en français et anglais : Lagarsoft 35 s, Android Chrome 30 s, parcours général 30 s. Fichiers MP4 H.264 avec faststart, posters SVG, sous-titres VTT, commandes natives et transcription textuelle. Chargement uniquement à la lecture (`preload="none"`), aucun autoplay. Les animations sont dessinées pour expliquer des étapes précises, sans incorporer la vidéo ou les captures privées du client.

Regénérer hors du build Vercel avec Python, Pillow, FFmpeg, DejaVu Sans : `python3 scripts/guides-motion.py`. Les vidéos livrées ne demandent ni moteur vidéo externe ni crédit Fal pour être lues. Le QR Lagarsoft est produit par `/api/guides/lagarsoft` et pointe directement vers l'application App Store vérifiée, distinct du QR de transfert de relevé.

## Rendus

`lib/cadrages.js` définit les quatre vues autorisées. La caméra et sa cible restent à l'intérieur des contours concaves. Le client ajoute une photo correspondant à cette vue, voit l'aperçu, puis déclenche explicitement la génération. L'angle reste dans `suivi.angle`, déjà JSONB ; les anciennes images sont associées à la vue d'entrée par défaut. Le comparateur conserve un aspect ratio explicite pour éviter un résultat réduit à une ligne lors du chargement des photos.

## Vérification

`tests/unitaires/plans.test.js` contrôle unités absentes/manuelles, mm, DXF R12/moderne, plusieurs pièces, ouvertures obliques, courbes refusées, export, caméra dans un L et repli. `tests/unitaires/protocole.test.js` contrôle la référence complète et la proposition de cinq meubles. `tests/parcours-guide.mjs` contrôle QR décodé, six vidéos, import/sauvegarde/relecture, PDF/échelle/tracé, angle sans photo refusé sans débit, persistance de l'angle et budget libre sur les deux tailles d'écran Maison Corleone. Les rendus des tests API sont simulés ; cela valide l'intégration et les crédits, pas la fidélité du fournisseur de génération.

Le banc, ses limites et les choix critiques du protocole sont dans [DECISIONS.md](../DECISIONS.md) et [validation-ameublement.json](validation-ameublement.json). Les capteurs physiques Android doivent encore être vérifiés sur un appareil compatible. L'export DXF Lagarsoft réel fourni est vérifié ; l'application native RealRoom conservée dans le dépôt est une alternative et n'est pas requise pour ce parcours.

Les corrections et les limites de la dernière passe DXF sont décrites dans [le rapport des imports](qa-parcours-2026-10-10/report.md).
