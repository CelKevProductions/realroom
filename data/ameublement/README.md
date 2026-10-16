# Repères d’ameublement SSR

`profils.json` contient des statistiques de dimensions et de relations spatiales calculées depuis les fichiers SSR-3DFRONT fournis. Il ne contient ni scène, ni description d’objet, ni identifiant d’asset 3D-FUTURE, ni maillage. Les références marchandes, les dimensions et les prix restent ceux du catalogue Maison Corleone.

Les 14 992 lignes des trois Parquet sont identiques aux 14 992 JSON de l’archive. Le réglage utilise uniquement le fichier train, après exclusion des logements présents dans val/test : 8 033 scènes candidates, puis 5 935 scènes retenues pour des fonctions et emprises suffisamment identifiables. Les partitions physiques priment sur les annotations `bedroom_train` ou `livingroom_train` présentes dans certains fichiers réservés. Les logements des trois partitions résultantes sont disjoints.

Les tailles source sont `[largeur, hauteur, profondeur]`, celles de l’application `[largeur, profondeur, hauteur]`. Les quaternions sont normalisés et projetés autour de Y. Les emprises orientées sont contrôlées dans les vrais polygones, avec 3 cm de tolérance et au moins 98,5 % de surface incluse. Les quantiles ne constituent pas des normes d’accessibilité ou des prescriptions de sécurité.

Les repères complètent les règles de l’encyclopédie : sélection de tailles courantes, proportions des chevets et tables basses, centrage, recul et orientation. Le nombre de convives, les sièges, le support TV, les petits espaces et les coins bureau gardent leurs critères fonctionnels. Une composition complète et accessible passe avant un meilleur score statistique. Les positions conservées et les cotes commerciales ne sont pas modifiées par la calibration.

L’application active le complément lors d’un nouveau réaménagement. Repli : `referencesSpatiales: false` dans la requête, les deux variables `REALROOM_REFERENCES_SPATIALES=0` / `NEXT_PUBLIC_REALROOM_REFERENCES_SPATIALES=0`, ou `localStorage.setItem('rr-references-spatiales','0')`. La démo et l’atelier transmettent ce choix au serveur. Les pièces déjà enregistrées conservent leur aménagement jusqu’à une nouvelle demande.

## Reproduction

L’analyse est hors serveur ; le site charge uniquement le petit JSON compilé.

```bash
python -m pip install -r scripts/requirements-ameublement.txt
python scripts/apprendre-ameublement.py /chemin/des/fichiers
python tests/analyse-ameublement.py
python scripts/preparer-bench-ameublement.py /chemin/des/fichiers
node scripts/bench-ameublement-reference.mjs --contours-test
node scripts/illustrer-ameublement-reference.mjs
```

Les scènes de contrôle détaillées restent dans `.data/`, hors Git. Le rapport et les résultats agrégés sont dans `docs/ameublement-reference-2026-10-13.md` et `docs/ameublement-reference/`.

Source : Bucher et Armeni, *ReSpace: Text-Driven Autoregressive 3D Indoor Scene Synthesis and Editing* (2025), [arXiv:2506.02459](https://arxiv.org/abs/2506.02459), [SSR-3DFRONT](https://huggingface.co/datasets/gradient-spaces/SSR-3DFRONT). La carte affiche MIT dans ses métadonnées et renvoie aussi aux conditions originales de 3D-FRONT. Cette mise à jour ne redistribue pas les fichiers du dataset et ne charge pas les poids SG-LLM.
