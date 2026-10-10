# Validation du parcours guidé — 10 octobre 2026

## Résultat local

- `npm test` : 110 tests, 110 réussis, aucun ignoré.
- `npm run build` : compilation et génération des routes réussies ; worker PDF local inclus.
- `node tests/plan.mjs` : parcours existants, API, base isolée, scans, plan, conservation du mobilier, inspirations, variantes, crédits et reprise dans les deux éditions, ordinateur et mobile.
- `GUIDES_SEULS=1 node tests/plan.mjs` : QR App Store décodé, six vidéos accessibles et lisibles, DXF à huit coins sauvegardé/rechargé, PDF calibré puis tracé, référence de vue obligatoire, un seul crédit et angle conservé après rechargement.
- `GUIDES_SEULS=1 GUIDES_DEPUIS=maison node tests/plan.mjs` : dernier contrôle des deux tailles d'écran Maison Corleone, budget de 2 123,45 € affiché et conservé, fenêtre de rendu ouverte sans débit, génération explicite. Comparaison 3D du banc enregistrée.
- `TRANSFERTS_SEULS=1 node tests/plan.mjs` : QR privé entre deux navigateurs, permissions distinctes, usage unique/expiration, relevé en L et aperçu/confirmation dans les deux éditions, ordinateur et mobile.
- `node scripts/valider-ameublement.mjs` : référence à cinq meubles complète ; banc de dix chambres et audit du catalogue consignés dans [validation-ameublement.json](validation-ameublement.json).

Les tests navigateur utilisent une base PGlite et des fournisseurs simulés isolés. Aucune modification de production, aucun crédit réel consommé. Chromium 138 est utilisé avec Playwright ; le budget de recherche du moteur est mesuré sur cette machine, pas garanti sur téléphone.

## Données réelles et limites

Le DXF Lagarsoft fourni est lu localement : 8 coins, 2 portes, environ 13,14 m². Les pièces privées, la vidéo du client et les captures fournies ne figurent pas dans Git. Les guides livrés sont des animations originales.

Les capteurs et le bandeau système Android restent à essayer sur un téléphone WebXR compatible. Le contrat accepte les polygones simples de 3 à 32 coins : concaves, obliques, triangulaires ou avec décrochement, mais pas les contours croisés, trous intérieurs ni plusieurs niveaux de sol. Lagarsoft exige un appareil Apple LiDAR compatible ; il ne devient pas une application Android ni une permission RoomPlan de Safari.

Le DXF est un plan 2D : hauteur, sens de porte et mobilier existant doivent être vérifiés. Les PDF/images nécessitent une mesure d'échelle et un tracé. La photo IA finale reste dépendante du fournisseur et de la référence choisie ; son résultat photoréaliste n'est pas certifié par les tests simulés.

Le banc n'est pas parfait : 6/10 cas respectent tous les repères d'usage, 8/10 gardent les quatre meubles, les cas difficiles exposent leurs alertes. Voir [DECISIONS.md](../DECISIONS.md) pour les critères, les références, le drapeau de repli et le refus automatique de l'envoi de comparaison à Fal.

## Publication

Travail destiné à la branche `codex/realroom-plan-optimisation-2026-10-09` et à sa preview Vercel. La PR contient le commit publié, la compilation Apple et les liens du déploiement exact. Aucun merge ni promotion de production n'est prévu par ce protocole.
