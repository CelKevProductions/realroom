# RealRoom · un service KPW

Le client relève une pièce par photos guidées, par 3 à 32 coins au sol avec WebXR/ARCore sur Android compatible, ou par import JSON Apple RoomPlan/LiDAR (application tierce existante ou compagnon natif). Un QR code permet le transfert temporaire depuis le téléphone. RealRoom affiche un plan polygonal à vérifier et une maquette 3D avec les meubles existants. Il propose ensuite un aménagement avec de vrais meubles du catalogue Maison Corleone : selon la fonction, le style et le budget, avec patrons paramétriques et recherche géométrique. Enfin, une photo d’entrée sert au rendu photo réaliste (fal.ai, Nano Banana Pro), puis à la visite 3D (World Labs, Marble). Les générations se paient en crédits (Stripe). Le compagnon iOS compile en CI macOS pour simulateur et appareil sans signature ; son export Swift est testé avec l'import du site. Il n'est pas encore distribué et les captures matérielles restent à valider sur appareil.

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
| `lib/geometrie.js`, `components/piece/PlanPiece.js` | Plan 2D corrigeable : mesures confirmées, ouvertures et tailles des meubles existants, enregistrement commun à l’API et à la démo. |
| `lib/confort.js` | Score expliqué, recuit simulé reproductible, accès et circulation ; jusqu’à trois dispositions aux mêmes produits et prix. |
| `lib/references.js` | Sources, préférences de composition et inspirations, séparées du relevé métrique. |
| `lib/scan.js`, `components/piece/Acquisition.js`, `moteur/releveAR.js` | Contrat métrique validé, aperçu/import commun aux deux éditions, coins au sol WebXR/ARCore. Android ne reconnaît pas automatiquement mobilier et ouvertures. |
| `native/ios` | Compagnon RoomPlan Swift/Xcode : murs, ouvertures et objets ; export JSON sans vidéo, images ni maillage. Compilation CI et contrat Swift/JavaScript vérifiés ; signature, distribution et essais LiDAR restent à faire sur appareil. |
| `lib/composition.js`, `lib/patrons.js`, `lib/budget.js` | Choix sémantiques séparés des coordonnées, neuf départs paramétriques et sac à dos par emplacement avec alternatives éligibles du même usage. |
| `lib/profils.js`, `lib/styles-index.js`, `scripts/styles_catalogue.py` | Onze styles combinables, profil neutre et indices visuels OpenCLIP calculés hors ligne sur les photos publiques du catalogue ; repli textuel si l'image n'est pas indexée. |
| `moteur` | Moteur 3D du navigateur |
| `components` | Interface React |
| `outils`, `scripts` | Catalogue (export Shopify, familles et dimensions), assemblage des maquettes |
| `tests` | Tests unitaires du solveur, parcours complet Playwright (services simulés), banc d'essai 3D |

## En local

```bash
npm install
npm run build
REALROOM_SIMULATION=1 REALROOM_ESSAIS=1 npm start   # services des comptes simulés ; démo d'aménagement exige une clé IA
# ou, pendant le développement : REALROOM_SIMULATION=1 npm run dev
```

En local seulement (jamais sur Vercel) : sans `RESEND_API_KEY`, le code de connexion s'affiche sur la page, et sans Stripe l'achat de crédits est simulé. Sans `DATABASE_URL`, la base est créée dans `.data/pglite`.

Les démos `/fr/demo` et `/fr/maison-corleone/demo` appellent réellement l'IA pour aménager via `/api/demo/amenager`. Fournir `FAL_KEY` ou `ANTHROPIC_API_KEY` côté serveur ; sur Vercel, donner aussi à la preview sa propre base et son propre `SESSION_SECRET`. Le plan et les inspirations choisies sont transmis au moteur, sans compte ni débit de crédit image. Par défaut : dix demandes par IP et trente au total sur 24 h, configurables via `.env.example`. Sans ces services, l'interface conserve la pièce et affiche une indisponibilité, sans proposition simulée. `GET /api/demo/amenager` expose la disponibilité de configuration, sans tester le fournisseur ni révéler de clé.

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

## Édition Maison Corleone (« Chez vous »)

`/fr/maison-corleone` : l'aménagement offert aux clients de maisoncorleone.com, avec leur compte client de la boutique. Préchargement (celui de la visite privée, aux couleurs de la boutique), intro 3D dirigée par le défilement (`moteur/intro.js`), parcours guidé (pièce, budget, style, priorité, photos ou relevé métrique), chargement 3D (`moteur/chargeur.js`), puis la pièce en 3D avec l'éditeur de RealRoom. Les scans passent par le même plan correctif, le score et le moteur de disposition. Avec un scan, la photo d’entrée peut être ajoutée seulement au moment du rendu, sans refaire la proposition. Deux rendus photo réalistes offerts par client, une seule fois. Démo sans compte : `/fr/maison-corleone/demo` (stockage navigateur, aménagement IA serveur ; analyse photo et rendus simulés). Code : `components/maison`, `lib/maison.js`, `app/api/mc`.

Connexion : comptes clients Shopify (Customer Account API, OAuth 2.0 / OpenID Connect).

1. Admin Shopify → *Canaux de vente* → installer **Headless** → créer une vitrine.
2. Dans la vitrine : *Customer Account API* → *Paramètres de l'application* : type de client **confidentiel**, puis :
   - URI de rappel : `https://<domaine>/api/mc/retour`
   - Origine JavaScript : `https://<domaine>`
   - URL de déconnexion : `https://<domaine>/fr/maison-corleone`
3. Copier l'identifiant client et le secret dans Vercel : `MC_CLIENT_ID`, `MC_CLIENT_SECRET` (sensible), puis redéployer.

Section pour la boutique : `shopify/mc-piece-3d.liquid` (« Pièce en 3D (Chez vous) » dans l'éditeur de thème). Quand elle arrive à l'écran, une chambre se dessine en plan, se relève en 3D et se meuble avec quatre pièces de la boutique, puis la vue plonge dans la vraie photo réaliste de la même chambre ; un curseur compare ensuite la maquette et la photo. La maquette est construite en CSS 3D par le script de la section et animée avec GSAP (le cœur seul, environ 28 Ko compressés, chargé depuis jsDelivr seulement quand la section approche) ; la section pèse environ 12 Ko compressés. Si les animations sont réduites, GSAP n'est pas chargé et la comparaison s'affiche directement. Images : `chez-vous-photo.jpg` et `chez-vous-maquette.jpg` dans *Contenu* → *Fichiers* de la boutique (à défaut, `chambre-rendu-*.jpg` et `chambre-maquette-*.jpg` de RealRoom). Réglages : textes, produits liés aux étiquettes (prix, lien vers la fiche), lien du bouton (vide : `/fr/maison-corleone` sur RealRoom, ou `/en/` si la boutique s'affiche en anglais). Installation dans un thème : *Modifier le code* → `sections` → ajouter `mc-piece-3d.liquid`, puis *Personnaliser* → *Ajouter une section*.

Sans `MC_CLIENT_ID`, la page indique que la connexion ouvre bientôt et propose la démo (en local, la connexion est simulée). Réglages facultatifs : `MC_BOUTIQUE` (`maisoncorleone.com`), `MC_RENDUS_OFFERTS` (2), `MC_ANALYSES_MAX` (6 pièces analysées au total par client), `MC_NOUVEAUX_PAR_JOUR` (300 nouveaux clients servis en rendus offerts par jour). Les liens vers les fiches produits portent `utm_source=chez-vous`.

## Coûts par opération (ordres de grandeur)

| Opération | Coût API | Prix client |
| --- | --- | --- |
| Analyse d'une pièce (Claude Sonnet 5 avec réflexion, 4 à 6 photos) | ≈ 0,08 à 0,15 $ | gratuite (30 par jour et par compte) |
| Proposition d'aménagement (Claude avec réflexion) | ≈ 0,05 à 0,12 $ | gratuite (60 par jour) |
| Rendu photo (Nano Banana Pro, 2K) | ≈ 0,15 $ | 1 crédit |
| Visite 3D (Marble 1.1) | ≈ 1,26 $ | 5 crédits |

Les packs sont réglables dans `lib/config.js` (10 crédits à 9 €, 30 à 24 €, 100 à 69 € ; 3 offerts à l'inscription, une seule fois par adresse). Des plafonds quotidiens limitent les crédits offerts (en tout et par domaine d'e-mail, hors grands fournisseurs), ainsi que les analyses et aménagements des comptes qui n'ont encore rien acheté (variables `*_PAR_JOUR` et `BIENVENUES_PAR_DOMAINE`). Quand un plafond global est atteint, un message l'indique dans les journaux Vercel ; les crédits offerts refusés ce jour-là sont versés à une connexion suivante. Pensez aussi aux plafonds de dépense dans les tableaux de bord Anthropic, fal.ai et World Labs.

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
npm run build && node tests/plan.mjs        # plan, scans, inspirations, score, reprise du rendu : API/base/UI, desktop/mobile
npm run build && npm run test:api          # cas limites de l'API : envois simultanés, crédits offerts, codes faux…
python3 tests/e2e.py                       # parcours complet, services simulés (aussi : mobile)
python3 tests/maison.py compte             # édition Maison Corleone : connexion simulée, parcours guidé, pièce 3D, rendu
python3 tests/maison.py demo-mobile        # sa démo, sans serveur (aussi : demo-desktop ; --mouvement joue les animations)
python3 tests/harnais/essai-editeur.py     # moteur 3D seul (après : npx esbuild tests/harnais/editeur.js --bundle …)
```

Plan d’amélioration du relevé et du placement : [docs/plan-mistral-realroom.md](docs/plan-mistral-realroom.md).

Construction et limites du compagnon Apple : [native/ios/README.md](native/ios/README.md). Les fixtures de scan des tests sont synthétiques : elles ne valident ni la précision ARCore/LiDAR ni la compilation Swift.

Le détail du scan polygonal, de l’import Apple, du transfert QR et des références de style figure dans [capture-polygones-transfert.md](docs/capture-polygones-transfert.md).
