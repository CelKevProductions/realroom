# Aménagement vivant (12 octobre 2026)

Trois défauts relevés sur les plans proposés :

1. **Toujours la même disposition** : canapé droit face à la télévision, à chaque nouvel aménagement.
2. **Des coins posés au hasard** : chaque ensemble était bien composé, mais rien ne vérifiait qu'ils allaient ensemble (repas loin du salon, lecture dans l'axe de l'écran…).
3. **Une pièce mal remplie** : grands vides, masses d'un seul côté, murs nus, ensembles qui flottent loin des murs.

Ce travail part de la branche mission 5 (encyclopédie) et y ajoute l'harmonie d'ensemble (branche `harmonie-decoration`). L'encyclopédie reste **désactivée en production** : la preview de la branche `amenagement-vivant` l'active, comme celle de la mission 5.

## 1. Variété des dispositions

| Élément | Fichier | Rôle |
| --- | --- | --- |
| Graine de variation | `lib/variation.js` | entier tiré au sort par le navigateur à chaque « Aménager » (`components/api.js`, démo : `components/demo/ia.js`) ; validé côté serveur (`preparerAmenagement`, `validerDemoIA`). 0 = plan de référence, déterministe comme avant. |
| Nouvelles géométries | `lib/encyclopedie.js` | **SL:1.3 canapé sur le côté** : un fauteuil face à l'écran, le canapé perpendiculaire le long de la table basse (le second fauteuil se tourne de biais). **SL:1.6 vis-à-vis** : fauteuils face au canapé, écran sur le côté. **SL:1.24** canapé dos à la fenêtre, **SL:1.8** canapé d'angle calé dans un coin, **CH-1.05** lit en angle (petite chambre), **SL:4.3 / 4.4** lecture face ou le long d'une fenêtre. |
| Diversité conservée | `lib/zonage.js` | chaque disposition garde ses meilleures positions (`candidatsGroupe`) et ses meilleurs plans dans le faisceau ; un représentant de chaque combinaison est vérifié. |
| Tirage | `choisirPlan` (`lib/zonage.js`) | parmi les plans **aussi sûrs** que le meilleur (même rang : contraintes, accès, circulation) et à moins de 10 points : tirage à chances égales sur la disposition du coin principal, puis sur la combinaison des autres coins (les mieux notées d'abord). Chaque reprise de `planifierAvecAlternatives` tire avec sa propre graine. |
| Filet de sécurité | `appliquerProposition` | si le plan tiré ne passe pas l'audit final, le plan de référence est livré (`variationEcartee`). |
| Réglage fin | `lib/confort.js` | pour une disposition à écran latéral assumée (`dispositionStrategie`), le canapé doit voir l'écran de biais sans lui tourner le dos (seuil 0,2 au lieu de 0,85) : le recuit ne ramène plus l'écran face au canapé. |

## 2. Relations entre les coins (`lib/relations-zones.js`)

| Règle | Points | Déclencheur |
| --- | --- | --- |
| salon-repas-proches / éloignés | +4 / −6 | écart ≤ max(2,5 m ; √surface / 3) ; éloigné au-delà de +1,5 m |
| repas-cuisine-proches / éloignés | +5 / −6 | ≤ 2 m / > 3,5 m |
| bar-relie / bar-isole | +3 / −3 | à 2 m de la cuisine, du repas ou du salon |
| lecture-axe-ecran | −6 | coin lecture dans le couloir de vue canapé → écran |
| travail-axe-ecran | −5 | bureau dans ce même couloir |
| bureau-face-lit | −3 | l'assise du bureau regarde l'oreiller (chambre) |
| calme-contre-porte | −3 | lecture, travail (ou couchage hors chambre) à moins de 60 cm d'une porte |
| accueil-porte | +3 | accueil à moins de 1,5 m d'une porte |
| rangement-repas | +2 | buffet à 1,5 m du repas |

La note est gardée à part pendant la composition (un plan partiel ne doit pas évincer du faisceau les états qui laissent la place aux coins suivants) ; douze états « les mieux liés » rejoignent le faisceau, et la note compte pleinement à la vérification des plans complets.

## 3. Remplissage équilibré (`lib/remplissage.js`)

| Règle | Points | Déclencheur |
| --- | --- | --- |
| grand-vide | −0,6 par point de % au-delà de la tolérance | part du sol à plus de 1,5 m de tout meuble (1,7 m au-delà de 40 m², 1,9 m en épuré), hors abords des portes ; tolérance 8 % (16 % en épuré ou japandi) |
| desequilibre | −30 × (écart − 0,3) | centre des masses au sol écarté de plus de 30 % de la demi-pièce |
| mur-nu | −3 (−1,5 en épuré) | pan plein de 2 m ou plus sans rien à moins de 70 cm |
| coin-flottant | −5 | salon, lecture, travail, rangement… à plus de 1 m de tout mur et de 1,2 m de tout autre coin, sauf disposition qui l'assume (SL:1.2 flottant, etc.) |

Compléments de programme et de placement :

- dès 16 m², un buffet **facultatif** peut habiter un mur resté nu (écarté s'il gêne) ;
- le meuble TV est aussi essayé **adossé** au mur derrière lui ; pour un écran latéral, tout l'ensemble peut glisser vers ce mur. Sur le plan complet, un écran adossé gagne 3 points et un meuble TV planté au milieu de la pièce (plus de 60 cm de vide derrière) en perd 10 (`POIDS_ECRAN`) ;
- petite pièce : lit plus étroit (tolérance de 15 cm en longueur), table réduite à 4 puis 2 couverts plutôt que pas de repas (jamais si le client a fixé le nombre de places), lampes de chevet non exigées pour un lit à chevets intégrés ;
- le tapis recentré par le réglage fin reste dans le rectangle de son ensemble (l'audit final l'exigeait déjà).

## Mesures

Banc synthétique `scripts/banc-amenagement.mjs` (aucun plan client) : 10 pièces, 4 variations chacune, encyclopédie active.

```
node scripts/banc-amenagement.mjs .data/banc-amenagement 4            # tout le banc
node scripts/banc-amenagement.mjs .data/banc-amenagement 6 salon-18   # un cas
```

Il écrit un plan SVG vu du dessus par essai et `bilan.json` (plans distincts, dispositions, remplissage, relations, audits, manquants, durée).

Les valeurs avant/après sont dans le compte rendu de la branche ; les poids sont des hypothèses éditoriales RealRoom, à calibrer sur des plans réels.

## Limites connues

- Chambre de 10,5 m² : le lit tient désormais, mais l'armoire n'entre pas avec ses dégagements.
- Séjour de 89 m² : il reste une part de vide au centre (circulation large de 1,1 m) ; ~30 s de calcul, comme avant.
- Le tirage ne propose que des dispositions sûres : dans une pièce très contrainte, deux « Aménager » peuvent encore donner le même plan.
