# Compagnon RoomPlan RealRoom / Maison Corleone

Ce projet Swift utilise **réellement RoomPlan**, pas une estimation métrique de photo.
RoomPlan exécute ses réseaux Apple sur l’appareil et emploie ARKit / LiDAR.
Il n’est pas exposé à Safari : le site importe le relevé JSON du compagnon.

## Construction et état de vérification

- Ouvrir `RealRoomScan.xcodeproj` sur un Mac avec Xcode et le SDK iOS.
- Choisir votre équipe de signature et votre identifiant de bundle : `fr.realroom.scan` est un identifiant provisoire, pas une application déjà publiée.
- Choisir un **iPhone/iPad physique équipé de LiDAR**, iOS/iPadOS 16 minimum.
- Compiler, autoriser la caméra, scanner lentement une seule pièce bien éclairée et toucher **Terminer**. RoomCaptureView conserve son guidage et sa prévisualisation 3D officiels.
- Vérifier le récapitulatif des murs, portes, fenêtres, passages et objets. Les éléments de confiance moyenne/faible sont signalés, sans inventer de mesure certifiée.
- **Enregistrer ou partager le relevé** → Enregistrer dans Fichiers → dans le site, Apple · LiDAR → **Importer un relevé métrique**.
- Vérifier le plan, portes, fenêtres et mobilier, puis aménager. Ajouter une photo d’entrée uniquement pour le rendu final, en ajustant le point de vue de la maquette si nécessaire.

Vérification de compilation sans signature, sur Mac :

```sh
xcodebuild -project native/ios/RealRoomScan.xcodeproj -scheme RealRoomScan \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Le workflow [.github/workflows/ios-roomplan.yml](../../.github/workflows/ios-roomplan.yml) exécute sur macOS 15 / Xcode 16.4 : compilation iOS Simulator, compilation appareil sans signature, puis test de l'encodeur Swift et import de son fichier réel par `lib/scan.js`. Ces quatre étapes ont **réussi** sur le commit `a32d25cd55ed524ae403af100917a54617ed0e96` : [exécution GitHub Actions du 10 octobre 2026](https://github.com/CelKevProductions/realroom/actions/runs/38010974859). Le minimum iOS 16 est conservé, avec un arrêt de session adapté à la disponibilité de l'API iOS 17.

La fixture Swift représente une pièce synthétique de 4 × 5 × 2,60 m, tournée et translatée, avec un lit de 140 × 160 cm, porte et fenêtre. Le test vérifie les axes, l'allège et la confiance dans l'import JavaScript ; cinq autres cas refusent un contour incomplet, une matrice non rigide, une cote non finie, trop d'objets ou un fichier trop gros. Aucun de ces cas n'est un scan matériel.

Le simulateur permet de compiler, **pas de valider un scan LiDAR**. Cette session locale Linux ne dispose ni de Xcode/SDK Apple ni de téléphone LiDAR. Aucune signature, installation client, publication TestFlight ou App Store n’a été effectuée. Ces étapes requièrent votre environnement Apple et une décision de distribution.

## Parcours et récupération

- Compatibilité vérifiée par `RoomCaptureSession.isSupported` ; aucun bouton de scan actif sur appareil incompatible. Le site propose un retour direct aux photos guidées tant que le compagnon n'est pas distribué.
- Demande caméra protégée contre les doubles démarrages ; après refus, bouton **Ouvrir Réglages** et nouvelle tentative. Une restriction système est distinguée d'un refus.
- **Terminer** attend une session démarrée. La préparation ne reste pas indéfiniment bloquée : après 45 secondes sans résultat, un message propose de reprendre.
- Une sortie en arrière-plan pendant la capture/préparation invalide le scan ; les callbacks tardifs ne peuvent pas remplacer un nouveau relevé. **Annuler** et **Nouveau relevé** demandent confirmation avant d'abandonner le brouillon local.
- Les contours incomplets, cotes non finies, matrices non rigides et exports trop volumineux sont refusés avant le partage. Le site refait la validation complète, notamment le contour polygonal fermé et les ouvertures.
- Texte défilant et Dynamic Type, messages VoiceOver et retour haptique pour succès/erreur. L'aperçu du site reçoit le focus et signale les éléments incertains. Le brouillon temporaire est supprimé en recommençant ; les copies déjà enregistrées dans Fichiers restent intactes.

## Données et sécurité

`MetricExport.swift` écrit `realroom-scan-v1`, en mètres, avec les surfaces et objets reconnus. Les matrices sont rigides, colonne majeure, +Y vertical. Dimensions natives `[largeur, hauteur, profondeur]` ; dimensions RealRoom `[largeur, profondeur, hauteur]`.

Aucun film, photo, nuage de points ni mesh n’est exporté. Le fichier reste local tant que le client ne le partage pas. Le code natif ne contient ni compte serveur, ni token, ni URL de téléversement automatique.

Le navigateur montre un aperçu sans sauvegarde ; `POST /api/pieces/:id/scan` refait toute la validation, exige le compte propriétaire et protège le remplacement concurrent. Les quotas de relevés Maison Corleone restent applicables. Les unités ambiguës, matrices non rigides, étages différents et contours croisés ou ouverts sont refusés. Les meubles détectés sont des observations, pas des produits boutique ni des mesures certifiées.

Le contrat et les adaptateurs sont testés avec des **données synthétiques**, distinctes d’un vrai scan matériel. Tester sur plusieurs pièces mesurées avant distribution, notamment vitres, miroirs, occultations, mobilier bas et confiance faible.

Références officielles : [RoomPlan](https://developer.apple.com/augmented-reality/roomplan/), [recherche Apple](https://machinelearning.apple.com/research/roomplan), [RoomCaptureViewDelegate](https://developer.apple.com/documentation/roomplan/roomcaptureviewdelegate), [isSupported](https://developer.apple.com/documentation/roomplan/roomcapturesession/issupported).

Le site prend maintenant en charge les contours polygonaux fermés. Le transfert par QR et les applications iOS tierces sont documentés dans [capture-polygones-transfert.md](../../docs/capture-polygones-transfert.md).
