# Logs de validation — mission 5

- [Tests unitaires](unitaires.txt) : 208 régressions + 20 tests de mission + 2 contrôles d’activation navigateur et preview, y compris les contraintes et le mode partiel.
- [Tests API](api.txt) : 19 scénarios sur un serveur local et des services simulés, sans base de production.
- [Build](build.txt).
- [Parsing](parser.txt) et [opérations](operations.txt).
- [Contrôles des modèles](modeles.txt), avec [les 96 mesures détaillées](../modeles/controles.json).
- [Intégration](../acceptation.json) : résultats sérialisés après les assertions, comptes des variantes par zone.
- [Vision](vision.txt) : vérification des empreintes et verdicts archivés, sans nouvel appel externe.

Reproduction : `npm test`, `npm run build`, `PORT=3281 node tests/api.mjs`, puis les scripts `parser-encyclopedie.py`, `compiler-dispositions.mjs`, `controler-modeles-encyclopedie.mjs`, `valider-encyclopedie.mjs`, `illustrer-encyclopedie.mjs` et `critiquer-encyclopedie.mjs`. Le parser prend les deux chemins source en arguments. Les cas géométriques complets restent locaux ; seuls les bilans et rendus des fixtures indépendantes sont suivis par Git.

- [Publication et preview](publication.json) : arbre public vérifié, commit, état READY et limite d’accès à la page protégée.
