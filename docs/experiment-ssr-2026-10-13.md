# Essai privé : statistiques apprises sur 14 992 pièces (13 octobre 2026)

**Branche `experiment-ssr`, jamais à fusionner dans `main`.** Elle part de `amenagement-vivant`.

## Ce que c'est

Les 14 992 scènes de SSR-3DFRONT (dérivées de 3D-FRONT, licence **non commerciale**) ont été mesurées hors du dépôt. Seules des **distributions agrégées** (percentiles par taille de pièce) sont gardées ici, dans `data/experiment-ssr/priors.json` (environ 3 Ko, ni scène, ni meuble, ni identifiant 3D-FUTURE). Le moteur reste à règles : il n'apprend pas de poids par optimisation, il lit ces distributions comme une règle de mesure.

## Ce que le moteur en fait (preview de cette branche uniquement)

| Où | Effet | Source |
| --- | --- | --- |
| `lib/prior-ssr.js` `evaluerPrior` | note ajoutée au plan de salon : distance canapé-écran et canapé-table basse comparées aux pièces réelles de même taille (−6 / −4 au pire, +2 / +1 dans le cœur de la plage) | percentiles p10, p25, p75, p90 |
| `lib/remplissage.js` | seuil de déséquilibre des masses relevé de 0,30 à environ 0,5 (75ᵉ centile réel) | `desequilibre.p75` |
| `lib/programme.js` | armoire facultative sous 12 m² (53 % des chambres réelles en ont une, 38 % sous 9 m²) | `chambre.*.armoire` |

Ce que la base **ne** décide **pas** : la disposition. 96 % des salons réels ont le canapé face à l'écran ; s'y fier ruinerait la variété. Les dispositions restent celles de l'encyclopédie.

## Activation

`REALROOM_PRIOR_SSR=1` (et `NEXT_PUBLIC_REALROOM_PRIOR_SSR=1`). `next.config.mjs` les active pour la seule branche `experiment-ssr` en preview. `=0` les coupe. Sans variable, le comportement est celui d'`amenagement-vivant`.

## Avant toute mise en production

1. Ne pas fusionner cette branche ; retirer `data/experiment-ssr/`.
2. Refaire les statistiques avec une base dont la licence autorise l'usage commercial (plans réels de clients consentants, ou base à licence ouverte).
3. Relire le code et les poids de ReSpace avant d'en reprendre quoi que ce soit.

## Limites des mesures

Pièces dessinées par des designers, sans portes ni fenêtres ; classement des meubles par mots-clés (10 988 meubles non classés, surtout du décor) ; seuls 61 % des salons ont un canapé et une télé identifiés.
