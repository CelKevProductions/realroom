# Assistant d’aménagement et Shuffle — 16 octobre 2026

L’atelier propose désormais une création automatique de pièce meublée, puis un bouton **Shuffle** pour chercher une autre organisation du même programme. Les mini-plans permettent de retrouver les propositions déjà calculées, avec leur statut et leur coût mobilier. Ce parcours est commun à RealRoom et Maison Corleone, dans les démos et les comptes connectés.

## Parcours

1. Le plan, les dimensions et la fonction viennent de la pièce créée ou importée.
2. Le dialogue recueille les espaces souhaités, le nombre de places à table, les idées et le style, le budget et les meubles à conserver.
3. « Créer ma pièce meublée » utilise directement le catalogue et le moteur de composition. Aucun fournisseur IA n’est appelé.
4. Shuffle cherche une disposition différente. Il ne valide pas une variante qui perd un usage obligatoire déjà présent dans la proposition courante.
5. Choisir un mini-plan restitue les meubles, leurs poses, les finitions et la mise en scène de cette proposition. La sélection est enregistrée ; elle reste disponible après rechargement.

L’option « Réaménager avec l’IA et mes inspirations » reste explicitement accessible. Un refus du fournisseur n’entraîne pas de bascule automatique vers l’assistant. Le module original de génération d’images n’est pas modifié.

L’assistant reprend les fonctions déjà couvertes par le moteur de programme : salon, chambre, salle à manger, bureau, salle de bain, entrée et terrasse. Pour une cuisine, une chambre d’enfant ou une pièce de fonction indéterminée, l’interface oriente explicitement vers l’option IA ; la route refuse de créer une proposition vide présentée comme un aménagement.

## Génération des variantes

La sélection respecte le catalogue, les préférences, les cotes, les dépendances et le budget du brief. La recherche de placements reçoit une graine explicite qui fait varier les préférences d’orientation et favorise les positions différentes des propositions précédentes. Les contrôles de limites, ouvertures, collisions, accès, circulation et hauteur restent obligatoires. Les ensembles se déplacent avec leurs objets associés ; l’optimisation et les finitions sont recalculées.

La diversité est mesurée sur les meubles qui organisent les activités : lit, canapé, table de repas, bureau ou fauteuil de lecture. Un changement de SKU, d’identifiant, de décoration ou de quelques centimètres ne suffit pas. Une ancre doit changer de position d’au moins 65 cm ou d’orientation d’au moins 45 degrés ; retourner une table de 180 degrés ne suffit pas.

Une recherche est bornée à trois graines par demande, ou une seule dans les grands plans pour contenir la durée. Si aucune proposition suffisamment différente et au moins aussi complète n’est trouvée, le résultat actuel est conservé et un message l’explique. Shuffle n’est donc pas une garantie d’un nombre illimité de solutions distinctes.

## Historique et sauvegarde

- Jusqu’à six propositions sont conservées : la première et les plus récentes, avec une limite de taille de l’historique.
- Chaque proposition conserve son mobilier et sa mise en scène, sans historique récursif.
- Un changement du plan, du mobilier ou des choix du brief demande de relancer l’assistant. Un simple changement de caméra n’invalide pas les propositions.
- Une identité de session distingue les générations successives.
- Sur un compte connecté, la sauvegarde compare le plan, le mobilier et la proposition lus avant le calcul : une modification concurrente n’est pas écrasée. La route exige la connexion et vérifie l’origine. Le réaffichage d’une proposition enregistrée ne consomme pas de recherche supplémentaire.
- Les démos exécutent le calcul dans un Worker et gardent les propositions dans leur stockage de session. Le retour vers une proposition déjà calculée évite une nouvelle génération.

Les objets génériques restent des modèles de projet à prix indicatifs. Le coût mobilier ne transforme pas la TV et les accessoires de mise en scène en offres commerciales.

## Banc synthétique sans IA

| Pièce et demande | Propositions distinctes | Programme et audit | Coût mobilier |
| --- | --- | --- | --- |
| Chambre 16 m², épurée, TV et rangement | 3 | Complets et valides | 3 052,99 € ; 3 002,99 € ; 2 572,99 € |
| Salon 25 m², TV et repas à quatre | 3 | Complets et valides | 3 669 € pour chacune |
| Salon 30 m², TV et repas à quatre, plafond 1 200 € | 3 | Complets et valides | 1 180 € pour chacune |

Les neuf propositions conservent leur géométrie et leur budget. Le retour à la première restitue exactement le mobilier et la mise en scène sérialisés. Les images de contrôle affichent deux vues 3D et un plan par proposition, avec des volumes simplifiés aux dimensions du catalogue.

## Vérification

La suite complète de 272 tests unitaires a été validée, puis les contrôles ciblés du moteur et de l’interface ont été rejoués après les dernières corrections, avec un test supplémentaire sur les fonctions non couvertes. Les 22 scénarios API locaux passent, ainsi que le build Next.js. Les tests API utilisent une base isolée et des fournisseurs simulés ; le nouveau parcours assistant n’appelle aucun fournisseur.

Les tests couvrent les variantes distinctes et complètes, le budget, le refus d’une diversité purement cosmétique, la conservation d’un lit verrouillé, l’absence d’amélioration fictive sous un budget insuffisant, les choix devenus obsolètes, le retour exact et la sérialisation. Le parcours des deux démos est exécuté sans appel fournisseur, puis relu dans un nouveau chargement du module client. Les contrôles d’interface vérifient le dialogue, les mini-plans, la sélection et le blocage après modification du brief ou du mobilier.

```sh
npm test
npm run build
node tests/api.mjs
node scripts/bench-assistant.mjs
```

Le banc écrit ses scènes et son résumé dans `.data/bench-assistant/`. Une sélection est possible : `node scripts/bench-assistant.mjs salon-25`. Les grands plans demandent davantage de calcul ; l’interface annonce la recherche en cours. Ces essais ne constituent pas une garantie esthétique ou une preuve que tous les logements disposent de plusieurs solutions.

## Références de conception

[Smart Wizard](https://planner5d.com/smart-wizard) et son [guide officiel](https://support.planner5d.com/en/articles/16127121-how-to-use-smart-wizard) documentent le comportement visé : une pièce meublée selon les dimensions, la fonction et le style, puis des variantes via Shuffle. Le code ci-dessus est une implémentation propre à RealRoom ; il ne prétend pas reproduire l’algorithme interne non publié de Planner 5D.
