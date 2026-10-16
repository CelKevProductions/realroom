# Encyclopédie d’aménagement — données et exécution

Les deux tomes fournis sont conservés en données structurées avec leurs identifiants et leur provenance. Les données éditoriales ne remplacent jamais les mesures d’un produit marchand.

| Collection | Entrées |
|---|---:|
| Zones | 100 |
| Dispositions source | 521 |
| Meubles et références de meubles | 242 |
| Props décrits dans les tomes | 155 |
| Règles | 81 |
| Signature moments | 55 |

`base.json` conserve les tables, les paragraphes, les sources et les diagnostics. `runtime.json` contient les collections utilisées par le moteur, sans les copies redondantes des tableaux. Les deux empreintes SHA-256 et les 702 + 928 lignes couvertes figurent dans `documents`.

Chaque entrée a un `uid` avec le code de pièce. L’`id` original reste inchangé : `SL:1.1` conserve `id: "1.1"`, `CH:CH-1.01` conserve `id: "CH-1.01"`. Les préfixes abrégés des annexes sont développés, avec la ligne originale conservée dans la base complète. Les dimensions sont dans l’ordre largeur, profondeur, hauteur, en mètres. Un triplet incomplet reste `null`. Pour les prototypes, la borne inférieure d’un triplet de plages complet constitue la spécification ; elle ne devient pas une cote marchande.

Les zones exposent `surfaceMin`, `conditions`, `meubles`, `dispositions` et les renvois entre tomes. Les dispositions gardent géométrie, conditions, avantages et limites. Certains liens de meubles sont implicites : `referencesImplicites` le signale. Les noms cités sans fiche complète deviennent des références non cotées. `trous` liste les neuf zones sans disposition, les six dispositions sans meuble explicite et les 204 dimensions incomplètes.

`dispositions-operations.json` est le manifeste des 521 lignes : 34 interpréteurs disponibles, 107 lignes demandant une installation, un mécanisme ou une validation, et 380 autres lignes sans interpréteur ou modèle compatible. Les noms génériques d’opération servent au tri ; ils ne rendent pas une ligne exécutable. Les préconditions inconnues ne sont jamais remplacées silencieusement par un placement standard avec le même ID.

Le programme conserve les paliers de surface antérieurs, puis relie ses zones aux minima et conditions des tomes. Les compléments café et bibliothèque du brief utilisent les zones source et des prototypes S. L’îlot reste un équipement de mise en scène : sa présence ne valide pas un raccordement de plomberie. Les zones rares, les formes de lit particulières et les installations non relevées restent dans la liste des manques.

Les graines métriques utilisent les dimensions des objets réellement choisis, puis passent les contrôles de contour, portes, ouvertures, dégagements et circulation. Le recuit affine ce placement. `dispositionSource` et `dispositionUid` identifient la graine, et ne constituent pas une certification de la pièce. Le bureau est réservé avant les ensembles plus libres dans l’expérimentation, pour garder les orientations compatibles avec les fenêtres. La comparaison des dispositions propose au plus trois placements distincts, avec les mêmes produits et les mêmes accès vérifiés.

Les 119 dispositions de chambre réellement présentes deviennent 256 contextes, sans doublons d’identifiant. Le texte annonce 128, mais ses tableaux en contiennent 119. Chaque ligne reçoit une variation avant qu’une autre en reçoive deux ; profils et orientations de fenêtre sont croisés automatiquement. Ce sont des contextes de candidature, pas 256 nouvelles géométries source. Les géométries équivalentes sont éliminées avant la recherche macro. Les comptes par zone figurent dans `docs/encyclopedie/acceptation.json` et le détail dans `docs/encyclopedie/variantes.json`.

Les règles gardent `statutSource` et `statut`. Les contrôles géométriques PMR, les garde-corps et les conditions de couchage haut sont bloquants dans leur contexte. L’INRS reste une recommandation ergonomique ; `ergonomieStricte` la rend bloquante comme politique de conception, sans la présenter comme une loi. Une mesure requise absente est refusée en mode strict. Une hauteur de couchage de 40–50 cm est une cible de confort : elle n’est pas imposée à tous les logements par l’article 13 de l’arrêté du 24/12/2015. Les contrôles ne certifient pas la résistance mécanique d’un lit ou d’un garde-corps. `certification` reste `false`.

Le score mesure les règles compatibles avec les usages et les informations disponibles : proportions, espacements, hauteurs de plans, assises documentées et suspensions. `mesures` et `ecarts` donnent le résultat ; `nonMesurees` explique les autres règles. Une hauteur totale de fauteuil ne remplace pas sa hauteur d’assise, et la géométrie ne permet pas de déduire une distance œil-écran ou un triangle de cuisine dont les équipements ne sont pas relevés.

`modeles.json` décrit huit prototypes, douze jeux de matériaux, les emprises, les dégagements, les surfaces utiles et les spécifications. Aucun n’a de SKU marchand, de prix ou d’offre d’achat. Ils restent `classe: "S"`, `vendu: false`, `validationProduit: false`. Même un objet B dans le tome reste S tant qu’un produit réel et validé ne le couvre pas. La promotion en produit vendable nécessite la décision du propriétaire.

## Reproduction

Depuis la racine du dépôt, avec Node ≥20.9 et Python 3 :

```bash
python3 scripts/parser-encyclopedie.py /chemin/tome-1.md /chemin/tome-2.md
node scripts/compiler-dispositions.mjs
node scripts/modeles-encyclopedie.mjs
node scripts/controler-modeles-encyclopedie.mjs
npm test
npm run build
PORT=3281 node tests/api.mjs
node scripts/valider-encyclopedie.mjs
node scripts/illustrer-encyclopedie.mjs
```

La validation avant/après lit la référence de la mission 4 sous `.data/staging-modeles/89-apres.json`. Les instantanés complets restent locaux ; la fixture indépendante est `tests/fixtures/staging.js`. La boucle vision utilise des JPEG de ces fixtures, sans photo ni plan client. Les appels sont facultatifs et facturables ; la vérification des archives ne fait pas d’appel réseau.

## Activation expérimentale

Le défaut est désactivé. Le corps d’aménagement accepte `encyclopedie: true`. Pour une preview dédiée : `REALROOM_ENCYCLOPEDIE=1` et `NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE=1` avant le build. La configuration les active automatiquement pour `VERCEL_ENV=preview` et la seule branche `codex/realroom-mission5-encyclopedie-2026-10-12`. En production ou sur une autre branche, le défaut reste désactivé. Pour un essai dans le navigateur : `localStorage.setItem('rr-encyclopedie','1')`. Un choix `false`, une variable à `0` ou `rr-encyclopedie=0` arrête l’expérimentation. Sans choix local, le navigateur respecte le drapeau du build. Le module de génération des images IA reste inchangé.
