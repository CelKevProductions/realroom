# Vérification des imports DXF — RealRoom / Maison Corleone

| Champ | Valeur |
|-------|--------|
| Date | 10 octobre 2026 |
| Version initiale | `a429b5c0af410959e8eedc4ea43aad46309dd219` |
| Parcours concernés | `/fr/demo` et `/fr/maison-corleone/demo` |
| Portée vérifiée | Lecteur DXF, choix du fichier, messages et compilation de l'interface partagée |
| Méthode | Reproduction sur données synthétiques, revue ciblée et tests unitaires |

L'exploration visuelle prévue n'a pas pu démarrer : le daemon agent-browser reçoit « Failed to bind socket: Operation not permitted ». Aucun écran n'a été ouvert ou capturé pendant cette passe. La vérification a donc été limitée aux reproductions locales et aux tests ci-dessous, sans fournisseur externe ni fichier privé du client.

## Résumé

| Gravité | Nombre |
|---------|--------|
| Critique | 0 |
| Élevée | 0 |
| Moyenne | 2 |
| Faible | 0 |
| **Total** | **2 corrigés** |

Les deux défauts ci-dessous sont reproduits sur le lecteur de la version initiale et corrigés dans cette passe. La lecture asynchrone et les messages de l'interface ont également été renforcés ; leur effet visuel sur téléphone reste à vérifier.

## Constats

### DXF-01 — Un meuble arrondi fait refuser une pièce valide

**Gravité : moyenne.** Un DXF ASCII en mètres contient un sol rectangulaire de 4 × 3 m sur le calque `FLOOR`, puis une polyligne fermée sur `FURNITURE` avec un bulge (`42 = 0.5`). L'ancien lecteur analyse la courbe du meuble avant de filtrer les calques et refuse tout le fichier avec `plan-courbe`.

Le lecteur choisit désormais les calques de sol avant d'analyser leurs sommets. Les annotations et meubles n'interrompent plus l'import d'un sol valide. Quand un calque de sol explicite existe, les contours d'autres calques ne sont pas utilisés comme pièces. Une courbe sur le sol lui-même reste refusée, avec proposition de tracé en segments depuis un PDF/image.

Preuve locale avant/après : `decorCourbe` → refus `plan-courbe` sur la version initiale ; une pièce de **12 m²** sur la version corrigée. Le test couvre également une annotation R12 et un calque décoratif, ainsi que le maintien du refus d'un sol courbe.

### DXF-02 — Une abscisse dupliquée est silencieusement ignorée

**Gravité : moyenne.** Dans une `LWPOLYLINE`, remplacer la première paire `10 = 0, 20 = 0` par `10 = 99, 10 = 0, 20 = 0`. L'ancien lecteur écrase la première abscisse et importe la pièce comme si le fichier était correct.

Une seconde abscisse avant son ordonnée est désormais refusée avec `plan-format`. Les coordonnées manquantes sont aussi refusées ; aucune géométrie de remplacement n'est inventée.

Preuve locale avant/après : `coordDupliquee` → accepté, **12 m²**, sur la version initiale ; refus `plan-format` sur la version corrigée. Le test couvre abscisse dupliquée, ordonnée sans abscisse et abscisse sans ordonnée.

## Fiabilisation du choix et de l'aide

- Seul le dernier fichier choisi peut modifier l'aperçu. Un résultat ou un échec tardif d'un ancien fichier est ignoré. Le démontage du composant invalide les lectures en attente.
- La limite de 5 Mo est contrôlée avant de lire le contenu du fichier.
- Un état de lecture est annoncé, et un fichier sans unités propose explicitement leur choix. Les libellés indiquent mètres, centimètres ou millimètres plutôt qu'une simple abréviation.
- Les erreurs précisent l'action possible : réexporter un plan 2D, réduire le fichier, choisir les unités ou tracer la pièce sur un PDF/image. Ces messages existent en français et anglais.
- Le fichier DXF brut reste dans le navigateur. Seul le plan choisi et validé peut être transmis par le parcours existant.

## Validation exécutée

| Vérification | Résultat |
|-------------|----------|
| Reproduction avant/après des deux défauts | Corrigés, sans modification des données synthétiques |
| `node --test tests/unitaires/plans.test.js` | 12 tests réussis |
| `npm test` | 115 tests réussis, aucun échec ni test ignoré |
| `npm run build` | Compilation et génération des pages réussies, sortie 0 |
| `git diff --check` | Aucun problème d'espacement |

La compilation inclut les deux éditions, les vidéos et le worker PDF locaux. Les tests de lecture asynchrone couvrent un ancien résultat lent, un ancien échec, l'annulation, le fichier trop volumineux et une erreur active.

## Limites

Cette passe ne certifie pas l'affichage dans un navigateur, l'accès HTTP authentifié à la preview Vercel, les capteurs Android/iOS, le bandeau système Android ou la qualité d'un rendu photoréaliste réel. Les vérifications navigateur antérieures restent documentées dans `docs/rapport-validation-2026-10-10.md` ; elles ne doivent pas être présentées comme une nouvelle exploration visuelle de ces corrections.

