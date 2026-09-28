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

Sans `RESEND_API_KEY`, hors production, le code de connexion s'affiche sur la page. Sans `DATABASE_URL`, la base est créée dans `.data/pglite`.

## Mise en ligne (Vercel)

1. Relier le dépôt au projet Vercel. Chaque push déploie.
2. Ajouter depuis *Storage* une base **Neon** (elle fournit `DATABASE_URL`) et un **Blob** privé (`BLOB_READ_WRITE_TOKEN`).
3. Renseigner les variables d'environnement de `.env.example` :
   - `SESSION_SECRET` : 32 caractères aléatoires ;
   - `ANTHROPIC_API_KEY`, `FAL_KEY`, `WLT_API_KEY` ;
   - `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` ;
   - `RESEND_API_KEY` et `EMAIL_EXPEDITEUR` ;
   - `SITE_URL`, `CONTACT_EMAIL`.
4. Stripe :
   - créer un webhook vers `https://<domaine>/api/stripe/webhook` ;
   - événements : `checkout.session.completed` et `checkout.session.async_payment_succeeded`.
5. Resend : vérifier le domaine d'envoi (enregistrements DNS).
6. Compléter les mentions légales, les CGV et la politique de confidentialité. Les passages à compléter sont surlignés en jaune (`lib/legal.js`), et le tout est à faire relire.

## Coûts par opération (ordres de grandeur)

| Opération | Coût API | Prix client |
| --- | --- | --- |
| Analyse d'une pièce (Claude Sonnet 5, 4 à 6 photos) | ≈ 0,03 à 0,06 $ | gratuite (30 par jour et par compte) |
| Proposition d'aménagement (Claude) | ≈ 0,02 à 0,05 $ | gratuite (60 par jour) |
| Rendu photo (Nano Banana Pro, 2K) | ≈ 0,15 $ | 1 crédit |
| Visite 3D (Marble 1.1) | ≈ 1,26 $ | 5 crédits |

Les packs sont réglables dans `lib/config.js` (10 crédits à 9 €, 30 à 24 €, 100 à 69 € ; 3 offerts à l'inscription). Pensez aux plafonds de dépense dans les tableaux de bord Anthropic, fal.ai et World Labs.

## Catalogue

`data/catalogue.json` (serveur) et `public/catalogue.json` (navigateur) sont générés. Pour les mettre à jour :

```bash
SHOPIFY_BOUTIQUE=xxx.myshopify.com SHOPIFY_JETON=shpat_… python3 outils/export_shopify.py
python3 outils/catalogue.py && npm run catalogue
```

Les pièces choisies à la main (`outils/sources/produits.js`) gardent leur maquette 3D détaillée. Les autres reçoivent une maquette générique déduite de leur fiche : famille, style, dimensions, couleurs, matière.

## Essais

```bash
npm test                                   # solveur d'agencement
npm run build && python3 tests/e2e.py      # parcours complet, services simulés (aussi : mobile)
python3 tests/harnais/essai-editeur.py     # moteur 3D seul (après : npx esbuild tests/harnais/editeur.js --bundle …)
```
