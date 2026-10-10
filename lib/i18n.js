// Textes de RealRoom en français et en anglais. {nom} = variable remplacée à l'affichage.
const fr = {
  code: 'fr', locale: 'fr-FR', ogLocale: 'fr_FR',
  meta: {
    titre: 'RealRoom · Aménagez votre pièce en 3D avec de vrais meubles',
    description: 'Prenez votre pièce en photo : RealRoom la reproduit en 3D, la réaménage avec de vrais meubles design, puis en fait un rendu réaliste et une visite 3D. 3 rendus offerts.',
    motsCles: 'aménager sa pièce en 3D, simulateur décoration avec photo, home staging virtuel, réaménager son salon, visualiser un meuble chez soi, décoration intérieure IA'
  },
  demo: { badge: 'Démo', ia: 'IA', bandeau: 'Aménagement par IA : le plan, vos envies et les inspirations choisies sont envoyés au moteur. Analyse photo, rendus et paiements simulés.', creer: 'Créer mon compte', recommencer: 'Recommencer la démo', introuvable: 'Cette page de la démo n’existe plus.', retour: 'Retour à la démo', chargement: 'Chargement de la démo…', erreurs: {
    'limite-demo': 'Les essais IA de la démo sont épuisés pour aujourd’hui. Vous pouvez continuer à aménager à la main.',
    'ia-indisponible': 'L’aménagement IA est indisponible pour le moment. Votre pièce est conservée ; réessayez plus tard.',
    'amenagement-ia': 'L’IA n’a pas pu terminer la proposition. Votre pièce est conservée ; vous pouvez réessayer.',
    'demande-demo': 'Vérifiez le plan et les mesures avant de relancer l’aménagement.',
    'inspiration-demo': 'Une inspiration ne peut pas être lue. Remplacez-la par une image JPEG ou PNG, puis réessayez.',
    'amenagement-conflit': 'La pièce a changé pendant la proposition. Relancez l’IA depuis votre plan actuel.'
  } },
  nav: { comment: 'Comment ça marche', tarifs: 'Tarifs', faq: 'Questions', connexion: 'Se connecter', commencer: 'Essayer gratuitement', mesProjets: 'Mes projets', compte: 'Compte', credits: 'crédits', deconnexion: 'Se déconnecter', fil: 'Où vous êtes' },
  accueil: {
    surtitre: 'Réaménagement en 3D · meubles réels',
    titre: 'Votre pièce, réaménagée avec de vrais meubles.',
    intro: 'Photographiez votre pièce et donnez ses mesures : RealRoom la reproduit en 3D avec vos meubles actuels, vous propose un aménagement, puis vous montre le résultat en photo réaliste et en 3D.',
    cta: 'Essayer gratuitement',
    demo: 'Voir la démo',
    ctaNote: '3 rendus offerts · sans carte bancaire',
    etapesTitre: 'Quatre étapes, quelques minutes',
    etapes: [
      ['Photographiez la pièce', 'Quelques photos prises depuis l’entrée et les coins, et des longueurs approximatives. Plusieurs pièces à la fois si vous voulez.'],
      ['Elle apparaît en 3D', 'Murs, fenêtres, portes et vos meubles actuels sont reconstitués en maquette, que vous pouvez corriger.'],
      ['Réaménagez', 'Décrivez ce que vous voulez ou laissez faire : l’aménagement suit la fonction de la pièce, vos envies et votre budget. Gardez ce que vous aimez, changez le reste.'],
      ['Voyez le résultat', 'Un rendu photo réaliste de votre vraie pièce, puis une visite 3D. Chaque meuble a son prix et son lien d’achat.']
    ],
    pointsTitre: 'Ce qui change tout',
    points: [
      ['De vrais meubles', 'Chaque pièce proposée existe, aux bonnes dimensions, et s’achète : pas d’objets inventés par une IA.'],
      ['Votre pièce, pas une pièce type', 'La maquette part de vos photos et de vos mesures, avec vos meubles actuels.'],
      ['Tout ou seulement le canapé', 'Réaménagez toute la pièce, ou changez quelques meubles et gardez le reste.'],
      ['Tout le logement', 'Salon, chambres, bureau : toutes vos pièces dans un seul projet, analysées en même temps.']
    ],
    catalogueTitre: 'Les meubles de Maison Corleone',
    catalogueTexte: 'Canapés, fauteuils, lits, luminaires, baignoires : plus de 300 pièces de mobilier design, choisies pour leur dessin et leurs matières, avec leurs vraies dimensions.',
    tarifsTitre: 'Payez seulement ce que vous générez',
    tarifsTexte: 'Photos, maquette 3D et aménagement : gratuits. Un rendu photo réaliste : 1 crédit. Une visite 3D : 5 crédits. Les crédits n’expirent pas.',
    offerts: '3 crédits offerts à l’inscription',
    faqTitre: 'Questions fréquentes',
    faq: [
      ['Faut-il un plan ou des mesures précises ?', 'Non. Quelques photos et des longueurs à 20 cm près suffisent ; vous pourrez corriger la maquette ensuite.'],
      ['D’où viennent les meubles ?', 'Du catalogue Maison Corleone, maison de mobilier design. Chaque meuble proposé est disponible, avec son prix et sa fiche.'],
      ['Le rendu est-il fidèle ?', 'C’est une image générée par IA à partir de vos photos, de la maquette et des photos des produits. Elle est très proche, mais peut contenir des erreurs ou des incohérences : elle n’est pas contractuelle.'],
      ['Que deviennent mes photos ?', 'Elles servent uniquement à votre projet, restent privées et sont supprimées avec lui ou avec votre compte.'],
      ['Ça marche sur téléphone ?', 'Oui : prenez les photos directement depuis votre téléphone, la maquette 3D s’y manipule au doigt.']
    ],
    finTitre: 'Voyez votre pièce autrement.',
    finTexte: 'Créez votre premier projet en deux minutes.',
    // page d'accueil animée
    menu: { methode: 'Méthode', catalogue: 'Catalogue', tarifs: 'Tarifs', faq: 'Questions', aller: 'Aller au contenu', haut: 'Haut de page' },
    prechargement: 'Plan en cours',
    titreLignes: ['Votre pièce,', 'réaménagée avec', 'de vrais meubles.'],
    cote: '4,20 m',
    parcours: ['Photos', 'Maquette 3D', 'Aménagement', 'Rendu réaliste', 'Visite 3D'],
    visuelAlt: 'Rendu réaliste d’une chambre réaménagée avec des meubles Maison Corleone : lit Cloud Bubble en bouclette, fauteuil Terra, suspension Luna Stack et applique Wood Orb Duo',
    avantApresSurtitre: 'Maquette / photo',
    avantApresTitre: ['De la maquette', 'à la photo.'],
    avantApresTexte: 'Chaque meuble placé dans la maquette 3D existe vraiment. RealRoom en tire ensuite une photo réaliste de la pièce, sous le même angle, avec les vrais produits.',
    avant: 'Maquette 3D', apres: 'Rendu réaliste',
    avantAlt: 'Maquette 3D d’une chambre : lit en bouclette, fauteuil terracotta, bureau, suspension et applique',
    apresAlt: 'Rendu réaliste de la même chambre, sous le même angle, avec les meubles Maison Corleone',
    legendeMaquette: 'Chambre réaménagée avec Maison Corleone : à gauche la maquette 3D, à droite le rendu réaliste tiré d’elle (image générée par IA, non contractuelle).',
    etapesSurtitre: 'Méthode',
    etapesDurees: ['~ 2 min', '~ 1 min', 'aussitôt', '~ 1 min'],
    pointsSurtitre: 'Ce qui change tout',
    catalogueSurtitre: 'Catalogue',
    glisser: 'Glissez pour parcourir',
    ficheProduit: 'Voir la fiche',
    tarifsSurtitre: 'Tarifs',
    gratuit: 'Photos, maquette 3D et aménagement : gratuits',
    colonnes: { pack: 'Pack', credits: 'Crédits', prix: 'Prix', parCredit: 'Par crédit', rendus: 'Rendus photo', visites: 'Visites 3D' },
    faqSurtitre: 'Questions',
    manifeste: 'Chaque intérieur a d’abord été une photo.',
    heure: 'Paris'
  },
  tarifs: { essai: 'Essai', projet: 'Projet', pro: 'Pro', credits: '{n} crédits', parCredit: '{p} le crédit', conseille: 'Le plus choisi', acheter: 'Acheter', rendus: 'soit {n} rendus photo' },
  pied: { editeur: 'Un service KPW', meubles: 'Meubles : Maison Corleone', mentions: 'Mentions légales', cgv: 'Conditions de vente', confidentialite: 'Confidentialité' },
  connexion: {
    titre: 'Connexion', intro: 'Recevez un code par e-mail : pas de mot de passe à retenir.',
    titreInscription: 'Créer un compte', introInscription: 'Un code par e-mail suffit, sans mot de passe. 3 crédits offerts pour vos premiers rendus.',
    email: 'Adresse e-mail', envoyer: 'Recevoir un code', code: 'Code reçu par e-mail', verifier: 'Se connecter',
    envoye: 'Code envoyé à {email}. Il est valable 10 minutes.', autreEmail: 'Changer d’adresse', renvoyer: 'Renvoyer le code',
    erreurs: { email: 'Adresse e-mail invalide.', limite: 'Trop de demandes : réessayez plus tard.', envoi: 'L’e-mail n’a pas pu partir. Réessayez dans un instant.', code: 'Code incorrect.', expire: 'Code expiré ou trop d’essais : demandez-en un nouveau.' },
    cgu: 'En continuant, vous acceptez les conditions de vente et la politique de confidentialité.'
  },
  email: {
    sujet: '{code} · votre code RealRoom',
    texte: 'Votre code de connexion RealRoom : {code}\nIl est valable 10 minutes. Si vous n’avez rien demandé, ignorez cet e-mail.',
    html: '<div style="font-family:system-ui,sans-serif;font-size:16px;color:#1d1b18"><p>Votre code de connexion RealRoom :</p><p style="font-size:32px;letter-spacing:6px;font-weight:700">{code}</p><p style="color:#6b645b">Il est valable 10 minutes. Si vous n’avez rien demandé, ignorez cet e-mail.</p></div>'
  },
  projets: {
    titre: 'Mes projets', nouveau: 'Nouveau projet', nomDefaut: 'Mon logement', vide: 'Pas encore de projet. Commencez par un logement ou une pièce.',
    pieces: '{n} pièce{s}', ouvrir: 'Ouvrir', supprimer: 'Supprimer', confirmer: 'Supprimer ce projet et toutes ses pièces ?', renommer: 'Renommer'
  },
  projet: {
    ajouter: 'Ajouter une pièce', nomPiece: 'Nom de la pièce', fonction: 'Fonction', creer: 'Ajouter', vide: 'Ajoutez les pièces à réaménager : chacune aura ses photos et sa maquette.',
    etats: { photos: 'Photos à prendre', analyse: 'Analyse en cours…', prete: 'Maquette prête', erreur: 'Analyse à relancer' },
    analyserTout: 'Analyser les pièces prêtes', analyseLancee: 'Analyse lancée pour {n} pièce(s).', annuler: 'Annuler'
  },
  fonctions: { salon: 'Salon', chambre: 'Chambre', salle_a_manger: 'Salle à manger', bureau: 'Bureau', salle_de_bain: 'Salle de bain', cuisine: 'Cuisine', entree: 'Entrée', chambre_enfant: 'Chambre d’enfant', terrasse: 'Terrasse ou balcon', autre: 'Autre' },
  piece: {
    etapes: ['Photos et mesures', 'Maquette 3D', 'Résultat'],
    photosTitre: 'Photos de la pièce',
    photosIntro: 'Tenez le téléphone à l’horizontale, à hauteur de poitrine. La première photo est la plus importante : c’est elle qui sera transformée en rendu réaliste.',
    roles: { entree: ['Depuis l’entrée', 'Toute la pièce, vue depuis la porte'], fond: ['Depuis le fond', 'Vers l’entrée'], gauche: ['Mur de gauche', 'En vous tournant vers la gauche'], droite: ['Mur de droite', 'En vous tournant vers la droite'], detail: ['Autre vue', 'Un coin, un meuble à garder…'] },
    repereRendu: 'Photo du rendu',
    ajouterPhoto: 'Ajouter', prendre: 'Prendre ou choisir une photo', remplacer: 'Remplacer', retirer: 'Retirer', envoi: 'Envoi…',
    mesuresTitre: 'Mesures approximatives',
    mesuresIntro: 'À 20 cm près. Laissez vide si vous ne savez pas : on les estimera d’après les photos.',
    largeur: 'Largeur (de gauche à droite)', profondeur: 'Profondeur (de l’entrée au fond)', hauteur: 'Hauteur sous plafond',
    notes: 'Précisions (facultatif)', notesAide: 'Ex. : la porte-fenêtre donne sur le balcon, le radiateur est sous la fenêtre.',
    analyser: 'Créer la maquette 3D', analyseEnCours: 'Analyse des photos et création de la maquette…', analyseDuree: 'Environ une minute.',
    manquePhoto: 'Ajoutez au moins la photo prise depuis l’entrée.',
    vues: { dessus: 'Maquette', photo: 'Vue de la photo' }, comparer: 'Photo', ensemble: 'Vue d’ensemble',
    aide: 'Glissez pour tourner, molette pour zoomer, glissez un meuble pour le déplacer.',
    panneau: { amenager: 'Aménager', meubles: 'Meubles', resultat: 'Rendu IA' },
    modeTitre: 'Que voulez-vous faire ?', modes: { tout: ['Tout réaménager', 'On repart de zéro, en gardant ce que vous cochez'], partiel: ['Changer quelques meubles', 'Le reste de la pièce ne bouge pas'] },
    envies: 'Vos envies', enviesAide: 'Ex. : un salon chaleureux, un grand canapé pour recevoir, des tons terracotta, garder la bibliothèque.',
    suggestions: { salon: ['Canapé pour recevoir', 'Coin lecture', 'Tons chauds', 'Lumière douce'], chambre: ['Lit plus grand', 'Coin fauteuil', 'Ambiance hôtel', 'Lumière tamisée'], salle_de_bain: ['Baignoire îlot', 'Esprit spa', 'Miroir design'], salle_a_manger: ['Table pour 6', 'Suspension au-dessus de la table'], bureau: ['Fauteuil confortable', 'Lumière de travail'], terrasse: ['Salon d’extérieur', 'Balancelle'], autre: ['Épuré', 'Chaleureux'] },
    budget: 'Budget maximum (facultatif)', proposer: 'Proposer un aménagement', proposition: 'Proposition en cours…',
    garderTitre: 'Vos meubles actuels', garder: 'Garder', retirer2: 'Retirer', aRemplacer: 'À remplacer',
    aGarder: 'Meubles actuels à garder', aRemplacerTitre: 'Meubles actuels à remplacer', proposes: 'Meubles proposés',
    ajouterMeuble: 'Ajouter des meubles', ameublement: 'Aménager la pièce', reamenager: 'Réaménager automatiquement', reamenagerAide: 'Nouvelle proposition avec vos préférences et votre budget.', reamenage: 'Votre nouvel aménagement est prêt.',
    echanger: 'Échanger', supprimerMeuble: 'Retirer de la pièce', tourner: 'Tourner', voirFiche: 'Voir la fiche', acheter: 'Acheter',
    existant: 'Déjà dans la pièce', retire: 'Retiré', total: 'Total des meubles proposés', surDevis: 'sur devis',
    concept: 'L’idée', conseils: 'Conseils', alertes: 'À vérifier',
    renduTitre: 'Rendu photo réaliste (IA)', renduTexte: 'Validez le cadrage de la vue Photo, ajoutez une photo réelle du même angle ou choisissez de continuer sans photo. Environ une minute.',
    versRendu: 'Voir en rendu réaliste (IA)', renduIndispo: 'Le rendu réaliste par IA n’est pas encore activé sur ce site.',
    generer: 'Générer le rendu réaliste (IA)', coute: '{n} crédit{s}', renduEnCours: 'Génération du rendu…', avant: 'Avant', apres: 'Après',
    avertissement: 'Image générée par IA à partir de vos photos, de la maquette et des photos des produits : elle peut contenir des erreurs ou des incohérences (proportions, couleurs, détails). Elle n’est pas contractuelle ; seules les fiches produits font foi.',
    mondeTitre: 'Visite 3D', mondeTexte: 'Une pièce en 3D réaliste, à parcourir, générée à partir du rendu. Environ 5 minutes.',
    genererMonde: 'Créer la visite 3D', mondeEnCours: 'Création de la visite 3D… vous pouvez fermer la page, elle continue.', ouvrirMonde: 'Ouvrir la visite 3D',
    creditsManquants: 'Crédits insuffisants.', acheterCredits: 'Acheter des crédits', telecharger: 'Télécharger', historique: 'Rendus précédents',
    corriger: 'Corriger la maquette', dims: 'Dimensions de la pièce', appliquer: 'Appliquer', relancer: 'Refaire l’analyse',
    catalogue: { titre: 'Catalogue', recherche: 'Rechercher un meuble', tout: 'Tout', tientSeulement: 'Seulement ce qui tient dans la pièce', aucun: 'Aucun meuble ne correspond.', ajouter: 'Ajouter à la pièce', choisir: 'Échanger', dims: '{l} × {p} × {h} cm', fermer: 'Fermer le catalogue', fermerFiche: 'Fermer la fiche', vue3d: '3D', photo: 'Photo', tourner: 'Glissez pour tourner', resultats: '{n} meubles' }
  },
  compte: {
    titre: 'Compte', solde: 'Crédits disponibles', acheter: 'Acheter des crédits', historique: 'Historique', email: 'Adresse e-mail',
    motifs: { bienvenue: 'Crédits offerts', achat: 'Achat', rendu: 'Rendu photo', monde: 'Visite 3D', remboursement: 'Recrédité (échec)' },
    retractation: 'Je demande à pouvoir utiliser mes crédits tout de suite et je reconnais perdre mon droit de rétractation pour les crédits utilisés.',
    paiementOk: 'Paiement reçu : vos crédits sont ajoutés.', paiementAnnule: 'Paiement annulé.', cocher: 'Cochez d’abord la case sur le droit de rétractation.', supprimerCompte: 'Supprimer mon compte et mes données', confirmerSuppression: 'Supprimer définitivement votre compte, vos projets et vos photos ?'
  },
  tuto: {
    guide: 'Guide', passer: 'Passer', precedent: 'Précédent', suivant: 'Suivant', fin: 'C’est parti', etape: 'Étape {n} sur {t}',
    accueil: [
      { illu: 'projet', titre: 'Bienvenue sur RealRoom', texte: 'Un projet, c’est votre logement. Ajoutez-y la pièce à aménager : salon, chambre, salle à manger…' },
      { illu: 'photos', titre: 'Photographiez la pièce', texte: 'Une photo depuis l’entrée, puis une ou deux autres vues. Ajoutez des mesures approximatives si vous les avez.' },
      { illu: 'maquette', titre: 'Votre pièce en 3D', texte: 'L’analyse reconstruit les murs, les fenêtres et vos meubles actuels, à leurs vraies dimensions.' },
      { illu: 'amenager', titre: 'Aménagez avec Maison Corleone', texte: 'Décrivez vos envies : l’IA place de vrais meubles du catalogue. Déplacez-les, tournez-les, échangez-les à volonté.' },
      { illu: 'rendu', titre: 'Le rendu réaliste (IA)', texte: 'Dans l’onglet « Rendu IA », votre vraie photo est réaménagée avec les meubles choisis, à comparer avant / après. Environ une minute.' }
    ],
    atelier: [
      { illu: 'controles', titre: 'Votre maquette', texte: 'Glissez pour tourner autour, molette ou pincement pour zoomer. Cliquez sur un meuble pour le choisir, glissez-le pour le déplacer.' },
      { illu: 'onglets', titre: 'Trois étapes, à droite', texte: '1. Aménager : vos envies et votre budget. 2. Meubles : la liste, pour échanger ou retirer une pièce. 3. Rendu IA : la photo réaliste.' },
      { illu: 'rendu', titre: 'Le rendu réaliste (IA)', texte: 'Quand l’agencement vous plaît, générez le rendu : votre photo réaménagée, à comparer avec l’originale.' }
    ]
  },
  erreurs: { generique: 'Une erreur est survenue. Réessayez.', reseau: 'Connexion perdue. Réessayez.', introuvable: 'Page introuvable.', webgl: 'La 3D n’est pas disponible sur cet appareil.' }
};

const en = {
  code: 'en', locale: 'en-GB', ogLocale: 'en_GB',
  meta: {
    titre: 'RealRoom · Redesign your room in 3D with real furniture',
    description: 'Take photos of your room: RealRoom rebuilds it in 3D, refurnishes it with real designer furniture, then turns it into a realistic render and a 3D tour. 3 free renders.',
    motsCles: 'room planner 3D, redesign my room from photo, virtual staging, AI interior design, see furniture in my room, real furniture'
  },
  demo: { badge: 'Demo', ia: 'AI', bandeau: 'AI furnishing sends the plan, your wishes and selected inspirations to the engine. Photo analysis, renders and payments are simulated.', creer: 'Create my account', recommencer: 'Restart the demo', introuvable: 'This demo page no longer exists.', retour: 'Back to the demo', chargement: 'Loading the demo…', erreurs: {
    'limite-demo': 'Today’s demo AI allowance has been used. You can keep furnishing manually.',
    'ia-indisponible': 'AI furnishing is unavailable at the moment. Your room is preserved; try again later.',
    'amenagement-ia': 'The AI could not finish this proposal. Your room is preserved; you can try again.',
    'demande-demo': 'Check your plan and measurements before requesting another layout.',
    'inspiration-demo': 'An inspiration could not be read. Replace it with a JPEG or PNG, then try again.',
    'amenagement-conflit': 'The room changed during the request. Run AI furnishing again from your current plan.'
  } },
  nav: { comment: 'How it works', tarifs: 'Pricing', faq: 'FAQ', connexion: 'Sign in', commencer: 'Try it free', mesProjets: 'My projects', compte: 'Account', credits: 'credits', deconnexion: 'Sign out', fil: 'You are here' },
  accueil: {
    surtitre: '3D redesign · real furniture',
    titre: 'Your room, refurnished with real furniture.',
    intro: 'Take photos of your room and enter rough measurements: RealRoom rebuilds it in 3D with your current furniture, suggests a new layout, then shows you the result as a realistic photo and in 3D.',
    cta: 'Try it free',
    demo: 'See the demo',
    ctaNote: '3 free renders · no credit card',
    etapesTitre: 'Four steps, a few minutes',
    etapes: [
      ['Photograph the room', 'A few photos from the doorway and the corners, and rough measurements. Several rooms at once if you like.'],
      ['It appears in 3D', 'Walls, windows, doors and your current furniture are rebuilt as a model you can adjust.'],
      ['Redesign it', 'Describe what you want or let it happen: the layout follows the room’s purpose, your wishes and your budget. Keep what you love, change the rest.'],
      ['See the result', 'A realistic photo of your actual room, then a 3D tour. Every piece has its price and a link to buy it.']
    ],
    pointsTitre: 'What makes the difference',
    points: [
      ['Real furniture', 'Every piece suggested exists, at its real size, and can be bought: no objects made up by an AI.'],
      ['Your room, not a template', 'The model starts from your photos and measurements, with your current furniture.'],
      ['Everything, or just the sofa', 'Redesign the whole room, or swap a few pieces and keep the rest.'],
      ['Your whole home', 'Living room, bedrooms, office: all your rooms in one project, analysed at the same time.']
    ],
    catalogueTitre: 'Furniture by Maison Corleone',
    catalogueTexte: 'Sofas, armchairs, beds, lighting, bathtubs: more than 300 designer pieces, chosen for their design and materials, with their real dimensions.',
    tarifsTitre: 'Only pay for what you generate',
    tarifsTexte: 'Photos, 3D model and layout: free. A realistic photo render: 1 credit. A 3D tour: 5 credits. Credits never expire.',
    offerts: '3 free credits when you sign up',
    faqTitre: 'Frequently asked questions',
    faq: [
      ['Do I need a floor plan or exact measurements?', 'No. A few photos and measurements to within 20 cm are enough; you can adjust the model afterwards.'],
      ['Where does the furniture come from?', 'From the Maison Corleone catalogue, a designer furniture house. Every piece suggested is available, with its price and product page.'],
      ['Is the render accurate?', 'It is an AI-generated image based on your photos, the model and the product photos. It is very close, but it can contain errors or inconsistencies: it is not contractual.'],
      ['What happens to my photos?', 'They are only used for your project, stay private and are deleted with it or with your account.'],
      ['Does it work on a phone?', 'Yes: take the photos straight from your phone, and handle the 3D model with your fingers.']
    ],
    finTitre: 'See your room differently.',
    finTexte: 'Create your first project in two minutes.',
    // page d'accueil animée
    menu: { methode: 'Method', catalogue: 'Catalogue', tarifs: 'Pricing', faq: 'FAQ', aller: 'Skip to content', haut: 'Back to top' },
    prechargement: 'Drawing the plan',
    titreLignes: ['Your room,', 'refurnished with', 'real furniture.'],
    cote: '4.20 m',
    parcours: ['Photos', '3D model', 'Layout', 'Realistic render', '3D tour'],
    visuelAlt: 'Realistic render of a bedroom refurnished with Maison Corleone furniture: Cloud Bubble bouclé bed, Terra armchair, Luna Stack pendant and Wood Orb Duo wall light',
    avantApresSurtitre: 'Model / photo',
    avantApresTitre: ['From 3D model', 'to photo.'],
    avantApresTexte: 'Every piece placed in the 3D model really exists. RealRoom then turns it into a realistic photo of the room, from the same angle, with the actual products.',
    avant: '3D model', apres: 'Realistic render',
    avantAlt: '3D model of a bedroom: bouclé bed, terracotta armchair, desk, pendant light and wall light',
    apresAlt: 'Realistic render of the same bedroom, from the same angle, with the Maison Corleone furniture',
    legendeMaquette: 'Bedroom refurnished with Maison Corleone: the 3D model on the left, the realistic render made from it on the right (AI-generated image, for illustration only).',
    etapesSurtitre: 'Method',
    etapesDurees: ['~ 2 min', '~ 1 min', 'instant', '~ 1 min'],
    pointsSurtitre: 'What makes the difference',
    catalogueSurtitre: 'Catalogue',
    glisser: 'Drag to browse',
    ficheProduit: 'See the product',
    tarifsSurtitre: 'Pricing',
    gratuit: 'Photos, 3D model and layout: free',
    colonnes: { pack: 'Pack', credits: 'Credits', prix: 'Price', parCredit: 'Per credit', rendus: 'Photo renders', visites: '3D tours' },
    faqSurtitre: 'FAQ',
    manifeste: 'Every interior started as a photo.',
    heure: 'Paris'
  },
  tarifs: { essai: 'Starter', projet: 'Project', pro: 'Pro', credits: '{n} credits', parCredit: '{p} per credit', conseille: 'Most popular', acheter: 'Buy', rendus: '{n} photo renders' },
  pied: { editeur: 'A KPW service', meubles: 'Furniture: Maison Corleone', mentions: 'Legal notice', cgv: 'Terms of sale', confidentialite: 'Privacy' },
  connexion: {
    titre: 'Sign in', intro: 'Get a code by email: no password to remember.',
    titreInscription: 'Create an account', introInscription: 'A code by email is all it takes, no password. 3 free credits for your first renders.',
    email: 'Email address', envoyer: 'Get a code', code: 'Code from the email', verifier: 'Sign in',
    envoye: 'Code sent to {email}. It is valid for 10 minutes.', autreEmail: 'Use another address', renvoyer: 'Send the code again',
    erreurs: { email: 'Invalid email address.', limite: 'Too many requests: please try again later.', envoi: 'The email could not be sent. Try again in a moment.', code: 'Wrong code.', expire: 'Code expired or too many attempts: request a new one.' },
    cgu: 'By continuing, you accept the terms of sale and the privacy policy.'
  },
  email: {
    sujet: '{code} · your RealRoom code',
    texte: 'Your RealRoom sign-in code: {code}\nIt is valid for 10 minutes. If you did not ask for it, ignore this email.',
    html: '<div style="font-family:system-ui,sans-serif;font-size:16px;color:#1d1b18"><p>Your RealRoom sign-in code:</p><p style="font-size:32px;letter-spacing:6px;font-weight:700">{code}</p><p style="color:#6b645b">It is valid for 10 minutes. If you did not ask for it, ignore this email.</p></div>'
  },
  projets: {
    titre: 'My projects', nouveau: 'New project', nomDefaut: 'My home', vide: 'No project yet. Start with a home or a single room.',
    pieces: '{n} room{s}', ouvrir: 'Open', supprimer: 'Delete', confirmer: 'Delete this project and all its rooms?', renommer: 'Rename'
  },
  projet: {
    ajouter: 'Add a room', nomPiece: 'Room name', fonction: 'Purpose', creer: 'Add', vide: 'Add the rooms to redesign: each one gets its photos and its model.',
    etats: { photos: 'Photos needed', analyse: 'Analysing…', prete: 'Model ready', erreur: 'Analysis to restart' },
    analyserTout: 'Analyse the rooms that are ready', analyseLancee: 'Analysis started for {n} room(s).', annuler: 'Cancel'
  },
  fonctions: { salon: 'Living room', chambre: 'Bedroom', salle_a_manger: 'Dining room', bureau: 'Office', salle_de_bain: 'Bathroom', cuisine: 'Kitchen', entree: 'Entrance', chambre_enfant: 'Child’s room', terrasse: 'Terrace or balcony', autre: 'Other' },
  piece: {
    etapes: ['Photos and measurements', '3D model', 'Result'],
    photosTitre: 'Photos of the room',
    photosIntro: 'Hold the phone horizontally, at chest height. The first photo matters most: it is the one turned into a realistic render.',
    roles: { entree: ['From the doorway', 'The whole room, seen from the door'], fond: ['From the far end', 'Towards the doorway'], gauche: ['Left wall', 'Turning to the left'], droite: ['Right wall', 'Turning to the right'], detail: ['Other view', 'A corner, a piece to keep…'] },
    repereRendu: 'Render photo',
    ajouterPhoto: 'Add', prendre: 'Take or choose a photo', remplacer: 'Replace', retirer: 'Remove', envoi: 'Uploading…',
    mesuresTitre: 'Rough measurements',
    mesuresIntro: 'To within 20 cm. Leave empty if you don’t know: they will be estimated from the photos.',
    largeur: 'Width (left to right)', profondeur: 'Depth (doorway to far wall)', hauteur: 'Ceiling height',
    notes: 'Details (optional)', notesAide: 'E.g. the French window opens onto the balcony, the radiator is under the window.',
    analyser: 'Create the 3D model', analyseEnCours: 'Analysing the photos and building the model…', analyseDuree: 'About a minute.',
    manquePhoto: 'Add at least the photo taken from the doorway.',
    vues: { dessus: 'Model', photo: 'Photo view' }, comparer: 'Photo', ensemble: 'Whole room',
    aide: 'Drag to orbit, scroll to zoom, drag a piece to move it.',
    panneau: { amenager: 'Redesign', meubles: 'Furniture', resultat: 'AI render' },
    modeTitre: 'What do you want to do?', modes: { tout: ['Redesign everything', 'Start again, keeping what you tick'], partiel: ['Change a few pieces', 'The rest of the room stays as it is'] },
    envies: 'Your wishes', enviesAide: 'E.g. a warm living room, a large sofa for guests, terracotta tones, keep the bookcase.',
    suggestions: { salon: ['Sofa for guests', 'Reading corner', 'Warm tones', 'Soft light'], chambre: ['Bigger bed', 'Armchair corner', 'Hotel feel', 'Dim lighting'], salle_de_bain: ['Freestanding bath', 'Spa feel', 'Designer mirror'], salle_a_manger: ['Table for 6', 'Pendant over the table'], bureau: ['Comfortable chair', 'Task lighting'], terrasse: ['Outdoor lounge', 'Swing seat'], autre: ['Minimal', 'Cosy'] },
    budget: 'Maximum budget (optional)', proposer: 'Suggest a layout', proposition: 'Preparing a layout…',
    garderTitre: 'Your current furniture', garder: 'Keep', retirer2: 'Remove', aRemplacer: 'To replace',
    aGarder: 'Current pieces to keep', aRemplacerTitre: 'Current pieces to replace', proposes: 'Suggested pieces',
    ajouterMeuble: 'Add furniture', ameublement: 'Furnish the room', reamenager: 'Redesign automatically', reamenagerAide: 'A new proposal with your preferences and budget.', reamenage: 'Your new layout is ready.',
    echanger: 'Swap', supprimerMeuble: 'Remove from the room', tourner: 'Rotate', voirFiche: 'Product page', acheter: 'Buy',
    existant: 'Already in the room', retire: 'Removed', total: 'Total of the suggested pieces', surDevis: 'on request',
    concept: 'The idea', conseils: 'Tips', alertes: 'To check',
    renduTitre: 'Realistic photo render (AI)', renduTexte: 'Confirm your Photo view camera, add a real photo from the same angle or choose to continue without one. About a minute.',
    versRendu: 'See it as a realistic render (AI)', renduIndispo: 'Realistic AI renders are not enabled on this site yet.',
    generer: 'Generate the realistic render (AI)', coute: '{n} credit{s}', renduEnCours: 'Generating the render…', avant: 'Before', apres: 'After',
    avertissement: 'AI-generated image based on your photos, the model and the product photos: it can contain errors or inconsistencies (proportions, colours, details). It is not contractual; only the product pages are binding.',
    mondeTitre: '3D tour', mondeTexte: 'A realistic 3D room you can walk through, generated from the render. About 5 minutes.',
    genererMonde: 'Create the 3D tour', mondeEnCours: 'Creating the 3D tour… you can close the page, it keeps going.', ouvrirMonde: 'Open the 3D tour',
    creditsManquants: 'Not enough credits.', acheterCredits: 'Buy credits', telecharger: 'Download', historique: 'Previous renders',
    corriger: 'Adjust the model', dims: 'Room dimensions', appliquer: 'Apply', relancer: 'Run the analysis again',
    catalogue: { titre: 'Catalogue', recherche: 'Search for a piece', tout: 'All', tientSeulement: 'Only what fits in the room', aucun: 'No piece matches.', ajouter: 'Add to the room', choisir: 'Swap', dims: '{l} × {p} × {h} cm', fermer: 'Close the catalogue', fermerFiche: 'Close the product', vue3d: '3D', photo: 'Photo', tourner: 'Drag to turn', resultats: '{n} pieces' }
  },
  compte: {
    titre: 'Account', solde: 'Available credits', acheter: 'Buy credits', historique: 'History', email: 'Email address',
    motifs: { bienvenue: 'Free credits', achat: 'Purchase', rendu: 'Photo render', monde: '3D tour', remboursement: 'Refunded (failed)' },
    retractation: 'I ask to use my credits straight away and acknowledge that I lose my right of withdrawal for the credits I use.',
    paiementOk: 'Payment received: your credits have been added.', paiementAnnule: 'Payment cancelled.', cocher: 'Tick the box about the right of withdrawal first.', supprimerCompte: 'Delete my account and data', confirmerSuppression: 'Permanently delete your account, projects and photos?'
  },
  tuto: {
    guide: 'Guide', passer: 'Skip', precedent: 'Back', suivant: 'Next', fin: 'Let’s go', etape: 'Step {n} of {t}',
    accueil: [
      { illu: 'projet', titre: 'Welcome to RealRoom', texte: 'A project is your home. Add the room you want to redesign: living room, bedroom, dining room…' },
      { illu: 'photos', titre: 'Photograph the room', texte: 'One photo from the doorway, then one or two more views. Add rough measurements if you have them.' },
      { illu: 'maquette', titre: 'Your room in 3D', texte: 'The analysis rebuilds the walls, windows and your current furniture, at their real sizes.' },
      { illu: 'amenager', titre: 'Furnish it with Maison Corleone', texte: 'Describe what you want: the AI places real pieces from the catalogue. Move, turn and swap them as you like.' },
      { illu: 'rendu', titre: 'The realistic render (AI)', texte: 'In the “AI render” tab, your real photo is refurnished with the chosen pieces, to compare before / after. About a minute.' }
    ],
    atelier: [
      { illu: 'controles', titre: 'Your model', texte: 'Drag to orbit, scroll or pinch to zoom. Click a piece to select it, drag it to move it.' },
      { illu: 'onglets', titre: 'Three steps, on the right', texte: '1. Redesign: your wishes and budget. 2. Furniture: the list, to swap or remove a piece. 3. AI render: the realistic photo.' },
      { illu: 'rendu', titre: 'The realistic render (AI)', texte: 'When you like the layout, generate the render: your photo, refurnished, to compare with the original.' }
    ]
  },
  erreurs: { generique: 'Something went wrong. Please try again.', reseau: 'Connection lost. Please try again.', introuvable: 'Page not found.', webgl: '3D is not available on this device.' }
};

const TEXTES = { fr, en };
export function texte(langue) { return TEXTES[langue] || fr; }
export const remplir = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
export function prix(centimes, langue = 'fr', decimales) {
  const v = centimes / 100;
  return new Intl.NumberFormat(texte(langue).locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: decimales ?? (v % 1 ? 2 : 0), minimumFractionDigits: decimales ?? (v % 1 ? 2 : 0) }).format(v);
}
