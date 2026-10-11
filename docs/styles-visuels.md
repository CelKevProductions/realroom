# Styles du catalogue et inspirations

Le moteur utilise les onze profils proposés dans Maison Corleone et un profil libre. Les passages, les ouvertures et les accès restent communs. Les configurations de `lib/profils.js` changent les préférences visuelles, le classement des patrons et l'utilité des compléments. Jusqu'à trois styles explicites peuvent être combinés ; ils priment sur les images d'ambiance. Les mots du brief, les matières et la palette restent pris en compte.

## Index visuel réellement calculé

`scripts/styles_catalogue.py` exécute **OpenCLIP ViT-B-32, poids LAION `laion2b_s34b_b79k`**, sur les images publiques du catalogue, en CPU. Il ne s'entraîne pas. Les descriptions anglaises regroupées dans `data/style-prompts.json` servent de références textuelles ; leurs embeddings sont comparés à celui de chaque image. `data/styles-visuels.json` contient les similarités cosinus, l'URL et l'empreinte de l'image, la version du modèle et des descriptions. Aucune photo de client n'entre dans cet index.

Les similarités ne sont **pas des probabilités** de style. Toutes les entrées restent `aVerifier: true` : une expertise éditoriale et une évaluation du catalogue restent utiles. Le classement n'utilise qu'un bonus limité, après les usages et les contraintes. Les noms de style ne sont transmis au modèle de proposition que si le meilleur indice dépasse 0,20 et devance le suivant de 0,015 ; ce sont des seuils heuristiques RealRoom, pas une calibration scientifique. Une description ornée reste exclue d'un brief minimal même si son image a des couleurs neutres.

Le serveur et le navigateur utilisent le même index. Si l'URL d'une image change, son ancienne entrée n'est plus utilisée. Un chargement indisponible dans le navigateur conserve le classement éditorial. Aucun appel ML, crédit ou téléchargement de poids ne se produit pendant l'aménagement du client. La génération photo finale est inchangée.

L'index livré couvre **278 des 341 produits**. Le téléchargement des 63 dernières images a été refusé par le réseau de cette session (HTTP 403) ; leurs produits restent disponibles avec le classement textuel, sans score inventé. La liste des images en échec est enregistrée dans `generation.erreurs` et le script peut reprendre leur traitement lorsque leur accès est autorisé.

## Recalcul

Installer PyTorch et torchvision **CPU compatibles** dans un environnement Python séparé, puis :

```sh
python -m pip install -r scripts/requirements-styles.txt
python scripts/styles_catalogue.py --dry-run
python scripts/styles_catalogue.py --limit 8
python scripts/styles_catalogue.py
```

Le téléchargement des poids officiels nécessite Internet et environ 605 Mo. L'option `--weights` accepte leur fichier local après vérification SHA-256 `1bd3c7172de5b207ceac554f5ab5266166f3b9baccc9af5989bc801016d080ad`. Les téléchargements d'images sont parallèles et bornés, le modèle est exécuté en CPU avec deux threads, l'index est enregistré atomiquement tous les dix produits. Les images déjà indexées sont reprises sans recalcul ; `--force` recalcule après modification des descriptions. Une image en erreur n'obtient jamais un score inventé. Après génération, versionner l'index et redéployer pour actualiser les deux éditions.

Un petit contrôle visuel de deux images réelles a confirmé un signal contemporain/Art déco pour le lit orange sculptural Royal Curve et des scores proches pour Essential Comfort ; cette seconde image reste ambiguë. Ce contrôle ne constitue pas une mesure de précision sur les 341 références. Le banc recommandé doit comparer le classement à des appréciations de décorateurs, avec une catégorie « indéterminé », avant d'augmenter son poids.

Références : [implémentation OpenCLIP](https://github.com/mlfoundations/open_clip), [poids pré-entraînés](https://github.com/mlfoundations/open_clip/blob/main/docs/PRETRAINED.md), [fiche du modèle LAION](https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K).
