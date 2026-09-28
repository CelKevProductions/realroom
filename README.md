# RealRoom · un service KPW

Le client photographie une pièce (ou tout un logement) et donne des mesures approximatives. RealRoom la reproduit en maquette 3D avec ses meubles actuels (Claude lit les photos). Il propose ensuite un aménagement avec de vrais meubles du catalogue Maison Corleone : automatiquement selon la fonction de la pièce, ou d'après les envies du client. Enfin, il en tire un rendu photo réaliste de la vraie pièce (fal.ai, Nano Banana Pro) et une visite 3D (World Labs, Marble). Les générations se paient en crédits (Stripe).

## Pile

| Élément | Choix |
| --- | --- |
| Site et API | Next.js 16 (App Router, JavaScript), hébergé sur Vercel |
| Base | Postgres : Neon en ligne ; PGlite (Postgres embarqué) en local et pour les essais |
| Fichiers | Vercel Blob (privé), ou dossier `.data/fichiers` en local |
| Connexion | Code à 6 chiffres par e-mail (Resend), session dans un cookie signé |
| IA | Claude (`claude-sonnet-5`) pour l'analyse et l'aménagement ; fal.ai pour le rendu ; World Labs pour la 3D |
| 3D | three.js : `moteur/editeur.js` (pièce, sélection, déplacement, capture) et `moteur/meubles.js` (maquettes des meubles) |
| Paiement | Stripe Checkout et webhook, packs de crédits |

## Dossiers

| Dossier | Contenu |
| --- | --- |
| `app/[lang]/(site)` | Pages publiques : accueil (SEO, FR/EN), connexion, pages légales |
| `app/[lang]/(app)/app` | Application : projets, pièces (photos, maquette, aménagement, résultat), compte |
| `app/api` | Routes : connexion, projets, pièces, photos, analyse, aménagement, rendus, crédits, webhook Stripe |
| `lib` | Serveur : base, sessions, stockage, crédits, Claude, fal.ai / Marble, Stripe, catalogue, agencement |
| `lib/agencement.js` | Repère de la pièce, empreintes au sol, solveur (dans la pièce, sans chevauchement, portes libres). Il tourne aussi dans le navigateur. |
| `moteur` | Moteur 3D du navigateur |
| `components` | Interface React |
| `outils`, `scripts` | Catalogue (export Shopify, familles et dimensions), assemblage des maquettes |
| `tests` | Tests unitaires du solveur, parcours complet Playwright (services simulés), banc d'essai 3D |

## En local

```bash
npm install
npm run build
REALROOM_SIMULATION=1 npm start     # sans aucune clé : analyse, aménagement, rendus et paiement simulés
```

En local seulement (jamais sur Vercel) : sans `RESEND_API_KEY`, le code de connexion s'affiche sur la page, et sans Stripe l'achat de crédits est simulé. Sans `DATABASE_URL`, la base est créée dans `.data/pglite`.

## Mise en ligne (Vercel)

1. Relier le dépôt au projet Vercel. Chaque push déploie.
2. Ajouter depuis *Storage* une base **Neon** (elle fournit `DATABASE_URL`) et un **Blob** privé (`BLOB_READ_WRITE_TOKEN`).
3. Renseigner les variables d'environnement de `.env.example`, **pour la production seulement** (une prévisualisation ne doit pas partager la base, les fichiers ni `SESSION_SECRET` de la production ; pour tester une prévisualisation, lui donner sa propre branche Neon et son propre secret) :
   - `SESSION_SECRET` : 32 caractères aléatoires ;
   - `ANTHROPIC_API_KEY`, `FAL_KEY`, `WLT_API_KEY` ;
   - `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` ;
   - `RESEND_API_KEY` et `EMAIL_EXPEDITEUR` (obligatoires sur Vercel : sans eux, personne ne peut se connecter) ;
   - `SITE_URL`, `CONTACT_EMAIL`.
4. Stripe :
   - créer un webhook vers `https://<domaine>/api/stripe/webhook` ;
   - événements : `checkout.session.completed` et `checkout.session.async_payment_succeeded` (et, pour être prévenu dans les journaux, `charge.refunded` et `charge.dispute.created`) ;
   - un remboursement ne retire pas les crédits automatiquement : les ajuster à la main dans la base (table `utilisateurs`, avec une ligne dans `mouvements`).
5. Resend : vérifier le domaine d'envoi (enregistrements DNS).
6. Compléter les mentions légales, les CGV et la politique de confidentialité. Les passages à compléter sont surlignés en jaune (`lib/legal.js`), et le tout est à faire relire.

## Coûts par opération (ordres de grandeur)

| Opération | Coût API | Prix client |
| --- | --- | --- |
| Analyse d'une pièce (Claude Sonnet 5 avec réflexion, 4 à 6 photos) | ≈ 0,08 à 0,15 $ | gratuite (30 par jour et par compte) |
| Proposition d'aménagement (Claude avec réflexion) | ≈ 0,05 à 0,12 $ | gratuite (60 par jour) |
| Rendu photo (Nano Banana Pro, 2K) | ≈ 0,15 $ | 1 crédit |
| Visite 3D (Marble 1.1) | ≈ 1,26 $ | 5 crédits |

Les packs sont réglables dans `lib/config.js` (10 crédits à 9 €, 30 à 24 €, 100 à 69 € ; 3 offerts à l'inscription, une seule fois par adresse). Des plafonds quotidiens globaux limitent les crédits offerts, les analyses et les aménagements (variables `*_PAR_JOUR`). Pensez aussi aux plafonds de dépense dans les tableaux de bord Anthropic, fal.ai et World Labs.

## Fiabilité des générations

- Le débit des crédits crée la ligne du rendu dans la même requête. Tout échec (prestataire, délai dépassé, envoi interrompu) rembourse une seule fois.
- Les appels aux prestataires ont tous un délai maximal. L'analyse et l'aménagement (Claude, réflexion adaptative, effort `medium`) disposent de 300 s ; une analyse restée bloquée plus de 6 minutes peut être relancée.
- La visite 3D part de la copie du rendu gardée chez nous, et elle est visible par qui a le lien (non publique).

## Catalogue

`data/catalogue.json` (serveur) et `public/catalogue.json` (navigateur) sont générés. Pour les mettre à jour :

```bash
SHOPIFY_BOUTIQUE=xxx.myshopify.com SHOPIFY_JETON=shpat_… python3 outils/export_shopify.py
python3 outils/catalogue.py && npm run catalogue
```

Les pièces choisies à la main (`outils/sources/produits.js`) gardent leur maquette 3D détaillée. Les autres reçoivent une maquette générique déduite de leur fiche : famille, style, dimensions, couleurs, matière.

## Essais

```bash
npm test                                   # solveur d'agencement, crédits (base PGlite temporaire)
npm run build && npm run test:api          # cas limites de l'API : envois simultanés, crédits offerts, codes faux…
python3 tests/e2e.py                       # parcours complet, services simulés (aussi : mobile)
python3 tests/harnais/essai-editeur.py     # moteur 3D seul (après : npx esbuild tests/harnais/editeur.js --bundle …)
```
