# Compagnon RoomPlan RealRoom / Maison Corleone

Ce projet Swift utilise **réellement RoomPlan**, pas une estimation métrique de photo.
RoomPlan exécute ses réseaux Apple sur l’appareil et emploie ARKit / LiDAR.
Il n’est pas exposé à Safari : le site importe le relevé JSON du compagnon.

## Construction et état de vérification

- Ouvrir `RealRoomScan.xcodeproj` sur un Mac avec Xcode et le SDK iOS.
- Choisir votre équipe de signature et votre identifiant de bundle : `fr.realroom.scan` est un identifiant provisoire, pas une application déjà publiée.
- Choisir un **iPhone/iPad physique équipé de LiDAR**, iOS/iPadOS 16 minimum.
- Compiler, autoriser la caméra, scanner lentement une seule pièce et toucher **Terminer**.
- **Partager le JSON** → Enregistrer dans Fichiers → dans le site, Android/Apple → **Importer un relevé métrique**.
- Vérifier le plan, portes, fenêtres et mobilier, puis aménager. Ajouter une photo d’entrée uniquement pour le rendu final, en ajustant le point de vue de la maquette si nécessaire.

Vérification de compilation sans signature, sur Mac :

```sh
xcodebuild -project native/ios/RealRoomScan.xcodeproj -scheme RealRoomScan \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Le simulateur permet de compiler, **pas de valider un scan LiDAR**. Cette session de développement Linux ne dispose ni de Xcode/SDK Apple, ni de téléphone LiDAR : le source natif n’a pas été compilé ni essayé sur appareil ici. Aucune signature, installation client, publication TestFlight ou App Store n’a été effectuée. Ces étapes requièrent votre environnement Apple et une décision de distribution.

## Données et sécurité

`MetricExport.swift` écrit `realroom-scan-v1`, en mètres, avec les surfaces et objets reconnus. Les matrices sont rigides, colonne majeure, +Y vertical. Dimensions natives `[largeur, hauteur, profondeur]` ; dimensions RealRoom `[largeur, profondeur, hauteur]`.

Aucun film, photo, nuage de points ni mesh n’est exporté. Le fichier reste local tant que le client ne le partage pas. Le code natif ne contient ni compte serveur, ni token, ni URL de téléversement automatique.

Le navigateur montre un aperçu sans sauvegarde ; `POST /api/pieces/:id/scan` refait toute la validation, exige le compte propriétaire et protège le remplacement concurrent. Les quotas de relevés Maison Corleone restent applicables. Les unités ambiguës, matrices non rigides, étages différents et contours non rectangulaires sont refusés. Les meubles détectés sont des observations, pas des produits boutique ni des mesures certifiées.

Le contrat et les adaptateurs sont testés avec des **données synthétiques**, distinctes d’un vrai scan matériel. Tester sur plusieurs pièces mesurées avant distribution, notamment vitres, miroirs, occultations, mobilier bas et confiance faible.

Références officielles : [RoomPlan](https://developer.apple.com/augmented-reality/roomplan/), [recherche Apple](https://machinelearning.apple.com/research/roomplan), [RoomCaptureViewDelegate](https://developer.apple.com/documentation/roomplan/roomcaptureviewdelegate), [isSupported](https://developer.apple.com/documentation/roomplan/roomcapturesession/issupported).
