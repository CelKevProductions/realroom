// Textes de l'édition Maison Corleone (« Chez vous »), en français et en anglais.
// {n}, {t}… : valeurs remplacées à l'affichage.
const fr = {
  marque: 'Maison Corleone',
  service: 'Chez vous',
  pre: { gauche: 'Votre pièce', droite: 'Réinventée', etapes: ['Préparation de l’atelier', 'Mise en lumière', 'Ouverture'], pied: ['Maison Corleone · Nanterre', 'Le design s’invite chez vous.'] },
  intro: {
    passer: 'Passer l’intro', defiler: 'Faites défiler', sur: 'sur',
    hero: { label: 'Maison Corleone présente', lignes: ['Votre pièce,', 'réinventée'], script: 'chez vous', texte: 'Relevez votre intérieur par photos ou scan métrique, vérifiez son plan, puis découvrez les pièces Maison Corleone chez vous.' },
    recits: [
      { label: 'Votre pièce', lignes: ['Tout commence', 'par votre pièce'], script: 'telle qu’elle est', texte: 'Photos guidées, relevé AR Android ou import Apple LiDAR : un plan 3D corrigible, dont vous vérifiez les dimensions et les ouvertures.' },
      { label: 'Le tri', lignes: ['Ce qui ne vous', 'ressemble plus'], script: 'laisse la place', texte: 'Gardez ce que vous aimez. Le reste s’efface, sans rien déplacer chez vous.' },
      { label: 'La sélection', lignes: ['Les pièces', 'Maison Corleone'], script: 'prennent place', texte: 'De vrais meubles de la boutique, à leurs vraies dimensions, choisis pour votre style et votre budget.' },
      { label: 'Le soir venu', lignes: ['Vivez-la avant', 'de la meubler'], script: 'du matin au soir', texte: 'Déplacez chaque meuble, tournez autour, puis voyez votre pièce en photo réaliste.' }
    ],
    fin: { label: 'À vous', lignes: ['Votre pièce', 'vous attend'], script: 'à votre tour', bouton: 'Commencer', note: 'Aménagement offert, et deux rendus photo réalistes, avec votre compte client Maison Corleone.' }
  },
  nav: { retour: 'Retour', continuer: 'Continuer', etape: 'Étape {n} sur {t}', bonjour: 'Bonjour {p}', connecte: 'Compte Maison Corleone', deconnexion: 'Se déconnecter', demo: 'Démo : aménagement IA, analyse photo et rendus simulés', demoCourt: 'Démo' },
  compte: {
    label: 'Votre compte', lignes: ['Votre compte', 'Maison Corleone'], script: 'pour commencer',
    texte: 'Connectez-vous avec votre compte client Maison Corleone, celui de la boutique : l’aménagement de votre pièce vous est offert.',
    offre: [['Offert', 'L’aménagement en 3D de votre pièce'], ['2', 'Rendus photo réalistes'], ['300+', 'Pièces Maison Corleone à essayer']],
    bouton: 'Se connecter avec mon compte',
    note: 'Pas encore de compte client ? Il se crée en un instant avec votre adresse e-mail, sur la page de connexion de la boutique.',
    inactif: 'La connexion avec votre compte Maison Corleone ouvre très bientôt.',
    erreur: 'La connexion n’a pas abouti. Réessayez dans un instant.',
    annule: 'Connexion annulée.',
    ref: 'Réf.',
    demo: 'Essayer la démo', demoNote: 'Sans compte. L’IA reçoit votre plan, vos envies et vos inspirations pour l’aménagement.'
  },
  reprise: { label: 'Bon retour', lignes: ['Vos pièces'], script: 'vous attendent', texte: 'Reprenez une pièce déjà aménagée, ou réinventez-en une nouvelle.', nouvelle: 'Aménager une nouvelle pièce', le: 'Modifiée le {d}' },
  piece: {
    label: 'Votre pièce', lignes: ['Quelle pièce'], script: 'réinventons-nous ?', texte: 'Choisissez la pièce que vous souhaitez aménager.',
    options: [['salon', 'Salon', 'Canapés, fauteuils, lumière'], ['chambre', 'Chambre', 'Lits, chevets, lumière'], ['salle_a_manger', 'Salle à manger', 'Tables, suspensions'], ['bureau', 'Bureau', 'Fauteuils, lumière'], ['salle_de_bain', 'Salle de bain', 'Baignoires îlots'], ['entree', 'Entrée', 'Consoles, miroirs'], ['terrasse', 'Terrasse', 'Salons de jardin']]
  },
  budget: { label: 'Votre budget', lignes: ['Votre budget'], script: 'pour cette pièce', texte: 'Un ordre d’idée suffit : nous choisissons les pièces en conséquence.', presets: [1500, 3000, 6000, 10000], libre: 'Sans limite', environ: 'environ' },
  style: {
    label: 'Votre style', lignes: ['Votre style'], script: 'en quelques mots', texte: 'Choisissez jusqu’à trois inspirations, ou décrivez-le avec vos mots.',
    champ: 'Ou décrivez-le : chaleureux, des tons terracotta, garder ma bibliothèque…',
    suggestions: 'Dans cet esprit, chez Maison Corleone', coupsAide: 'Une pièce vous plaît ? Touchez-la : nous en tiendrons compte.', coup: 'Coup de cœur', max: 'Trois inspirations au plus.',
    styles: [
      ['chaleureux', 'Chaleureux'], ['epure', 'Épuré'], ['boheme', 'Bohème'], ['artdeco', 'Art déco'],
      ['japandi', 'Japandi'], ['audacieux', 'Audacieux'], ['classique', 'Classique chic'], ['mediterraneen', 'Méditerranéen'],
      ['scandinave', 'Scandinave'], ['industriel', 'Industriel'], ['contemporain', 'Contemporain']
    ]
  },
  priorite: {
    label: 'Votre priorité', lignes: ['Ce que vous', 'voulez changer'], script: 'en priorité', texte: 'Le reste de la pièce garde ce qui vous plaît. Plusieurs choix possibles.',
    tout: ['tout', 'Tout repenser', 'On repart de zéro'],
    options: {
      canape: 'Le canapé', fauteuils: 'Les fauteuils', eclairage: 'La lumière', tables: 'Les tables', rangement: 'Les rangements', deco: 'La décoration',
      lit: 'Le lit', baignoire: 'La baignoire', assise: 'Les assises', jardin: 'Le salon de jardin', miroir: 'Le miroir'
    }
  },
  photos: {
    label: 'Votre relevé', lignes: ['Votre pièce', 'prend forme'], script: 'à votre mesure',
    texte: 'Choisissez des photos, un scan Android, un scan Apple ou le plan de votre maison. Vérifiez ensuite les cotes avant d’aménager.',
    principale: 'Depuis l’entrée', repere: 'Photo de la pièce', prendre: 'Prendre la photo', remplacer: 'Remplacer', autre: 'Autre angle',
    dims: 'Vous connaissez ses dimensions ? (facultatif)', largeur: 'Largeur (m)', profondeur: 'Profondeur (m)',
    angles: { fond: 'Du fond vers l’entrée', gauche: 'Le mur de gauche', droite: 'Le mur de droite' },
    precision: 'Une seule photo donne une estimation. La vue opposée aide à retrouver la porte et les meubles cachés. Gardez le même rangement entre les prises.',
    repereDims: 'Depuis la photo principale : largeur de gauche à droite ; profondeur jusqu’au mur du fond. Ces mesures servent à vérifier les proportions.',
    notes: 'Contraintes et usages à préserver (facultatif)', notesAide: 'Ex. : radiateur sous la fenêtre, porte derrière moi à gauche, lit de 160 cm, conserver un espace coiffeuse.',
    erreurDetails: 'Vos précisions n’ont pas pu être enregistrées. Réessayez avant de lancer l’aménagement.',
    lancer: 'Lancer l’aménagement', manque: 'Ajoutez au moins la photo prise depuis l’entrée.', erreur: 'La photo n’a pas pu être envoyée. Réessayez.'
  },
  chargement: {
    lignes: ['Votre pièce', 'prend forme'], script: 'un instant',
    etapes: ['Lecture de vos photos', 'Murs, fenêtres et dimensions', 'Repérage de vos meubles', 'Sélection Maison Corleone', 'Placement dans votre pièce'],
    etapesScan: ['Relevé métrique reçu', 'Validation des cotes importées', 'Préparation de la maquette', 'Sélection Maison Corleone', 'Placement dans votre pièce'],
    duree: 'Environ deux minutes. Laissez cette page ouverte, nous préparons tout.',
    erreur: 'L’analyse n’a pas abouti.', reessayer: 'Réessayer', photos: 'Reprendre les photos',
    limite: 'Vous avez aménagé toutes les pièces offertes avec votre compte.', limiteJour: 'Vous avez atteint la limite du jour. Réessayez demain.', service: 'Le service est momentanément indisponible. Réessayez plus tard.'
  },
  scene: {
    proposition: 'Proposition', pieces: '{n} pièces', titre: 'Votre {piece}', script: 'selon Maison Corleone',
    maquette: 'Maquette {l} × {p} m', total: 'Total', surDevis: 'sur devis', gardes: 'Gardés de votre pièce : {n}',
    jour: 'Jour', soir: 'Soir', vueMaquette: 'Maquette', vuePhoto: 'Vue photo', ensemble: 'Vue d’ensemble',
    rendu: 'Rendu réaliste', offerts: '{n} offert', offertsPl: '{n} offerts', plusDeRendu: 'Rendus offerts utilisés',
    voir: 'Voir sur la boutique', echanger: 'Échanger', retirer: 'Retirer', garder: 'Garder', tourner: 'Tourner',
    nouvelle: 'Nouvelle pièce', mesPieces: 'Mes pièces', aide: 'Glissez pour tourner autour, glissez un meuble pour le déplacer.',
    vue3d: '3D', photo: 'Photo', tournerAide: 'Glissez pour tourner', fermer: 'Fermer', enregistre: 'Modifications enregistrées.',
    erreur: 'Une erreur est survenue. Réessayez.', concept: 'Une proposition Maison Corleone pour votre pièce.',
    ajouter: 'Ajouter des meubles', ameublement: 'Aménager la pièce', reamenager: 'Réaménager automatiquement', reamenagement: 'Réaménagement en cours…', reamenagerAide: 'Nouvelle proposition avec votre budget et votre style.', reamenage: 'Votre nouvel aménagement est prêt.',
    precedente: 'Pièce précédente', suivante: 'Pièce suivante', numero: 'Pièce {n} sur {t}', deVotrePiece: 'De votre pièce',
    gardeEtat: 'Gardé', retireEtat: 'Retiré', voir360: 'Voir en 360°', dims: '{l} × {p} × {h} cm', vide: 'Aucune pièce Maison Corleone pour l’instant : ajoutez-en depuis le catalogue.',
    renduVoir: 'Voir le rendu', boutique: 'Retour à la boutique Maison Corleone', recommencer: 'Recommencer la démo', nouvellePiece: 'Pièce Maison Corleone', retireToast: '{n} retiré de la pièce.'
  },
  envies: { style: 'Style souhaité : {s}.', priorite: 'À changer en priorité : {p} ; garder le reste de la pièce.', tout: 'Repenser toute la pièce.', coups: 'Coups de cœur à intégrer si possible : {c}.' },
  rendu: {
    titre: 'Rendu réaliste', attente: 'Votre photo se réinvente', duree: 'Environ une minute.', avant: 'Avant', apres: 'Après',
    telecharger: 'Télécharger', fermer: 'Fermer', restants: 'Rendus offerts restants : {n}',
    manquePhoto: 'Le plan métrique est conservé. Ajoutez une photo depuis l’entrée pour votre rendu photo final.', ajouterPhoto: 'Ajouter la photo du rendu',
    avertissement: 'Image générée par IA à partir de votre photo, de la maquette et des photos des produits : elle peut contenir des erreurs (proportions, couleurs, détails). Elle n’est pas contractuelle ; seules les fiches produits font foi.',
    epuise: 'Vous avez utilisé vos deux rendus offerts.', erreur: 'Le rendu n’a pas abouti : votre rendu offert vous est rendu.'
  },
  fonctions: { salon: 'salon', chambre: 'chambre', salle_a_manger: 'salle à manger', bureau: 'bureau', salle_de_bain: 'salle de bain', entree: 'entrée', terrasse: 'terrasse' },
  noms: { salon: 'Salon', chambre: 'Chambre', salle_a_manger: 'Salle à manger', bureau: 'Bureau', salle_de_bain: 'Salle de bain', entree: 'Entrée', terrasse: 'Terrasse' }
};

const en = {
  marque: 'Maison Corleone',
  service: 'At home',
  pre: { gauche: 'Your room', droite: 'Reimagined', etapes: ['Preparing the studio', 'Setting the light', 'Opening'], pied: ['Maison Corleone · Nanterre', 'Design comes home.'] },
  intro: {
    passer: 'Skip intro', defiler: 'Scroll', sur: 'of',
    hero: { label: 'Maison Corleone presents', lignes: ['Your room,', 'reimagined'], script: 'at home', texte: 'Survey your home with photos or a metric scan, check the plan, then discover Maison Corleone pieces in your room.' },
    recits: [
      { label: 'Your room', lignes: ['It all starts', 'with your room'], script: 'as it is', texte: 'Guided photos, Android AR survey or Apple LiDAR import: an editable 3D plan whose dimensions and openings you can check.' },
      { label: 'The edit', lignes: ['What no longer', 'feels like you'], script: 'makes way', texte: 'Keep what you love. The rest fades away, without moving a thing at home.' },
      { label: 'The selection', lignes: ['Maison Corleone', 'pieces'], script: 'take their place', texte: 'Real furniture from the shop, at its real size, chosen for your style and budget.' },
      { label: 'Evening falls', lignes: ['Live in it', 'before you buy'], script: 'from dawn to dusk', texte: 'Move every piece, walk around it, then see your room as a realistic photo.' }
    ],
    fin: { label: 'Your turn', lignes: ['Your room', 'awaits'], script: 'your turn', bouton: 'Start', note: 'Free interior design, plus two realistic photo renders, with your Maison Corleone customer account.' }
  },
  nav: { retour: 'Back', continuer: 'Continue', etape: 'Step {n} of {t}', bonjour: 'Hello {p}', connecte: 'Maison Corleone account', deconnexion: 'Sign out', demo: 'Demo: AI furnishing, simulated photo analysis and renders', demoCourt: 'Demo' },
  compte: {
    label: 'Your account', lignes: ['Your Maison', 'Corleone account'], script: 'to begin',
    texte: 'Sign in with your Maison Corleone customer account, the one you use on the shop: designing your room is on us.',
    offre: [['Free', '3D design of your room'], ['2', 'Realistic photo renders'], ['300+', 'Maison Corleone pieces to try']],
    bouton: 'Sign in with my account',
    note: 'No customer account yet? It takes a moment with your email address, on the shop’s sign-in page.',
    inactif: 'Signing in with your Maison Corleone account opens very soon.',
    erreur: 'Sign-in did not go through. Try again in a moment.',
    annule: 'Sign-in cancelled.',
    ref: 'Ref.',
    demo: 'Try the demo', demoNote: 'No account needed. AI receives your plan, wishes and inspirations to furnish the room.'
  },
  reprise: { label: 'Welcome back', lignes: ['Your rooms'], script: 'await you', texte: 'Pick up a room you have already designed, or reimagine a new one.', nouvelle: 'Design a new room', le: 'Edited on {d}' },
  piece: {
    label: 'Your room', lignes: ['Which room'], script: 'shall we reimagine?', texte: 'Choose the room you would like to design.',
    options: [['salon', 'Living room', 'Sofas, armchairs, light'], ['chambre', 'Bedroom', 'Beds, bedsides, light'], ['salle_a_manger', 'Dining room', 'Tables, pendants'], ['bureau', 'Study', 'Armchairs, light'], ['salle_de_bain', 'Bathroom', 'Freestanding baths'], ['entree', 'Entrance', 'Consoles, mirrors'], ['terrasse', 'Terrace', 'Garden lounges']]
  },
  budget: { label: 'Your budget', lignes: ['Your budget'], script: 'for this room', texte: 'A rough idea is enough: we choose the pieces accordingly.', presets: [1500, 3000, 6000, 10000], libre: 'No limit', environ: 'around' },
  style: {
    label: 'Your style', lignes: ['Your style'], script: 'in a few words', texte: 'Pick up to three inspirations, or describe it in your own words.',
    champ: 'Or describe it: warm, terracotta tones, keep my bookcase…',
    suggestions: 'In this spirit, at Maison Corleone', coupsAide: 'Like a piece? Tap it and we will take it into account.', coup: 'Favourite', max: 'Three inspirations at most.',
    styles: [
      ['chaleureux', 'Warm'], ['epure', 'Minimal'], ['boheme', 'Bohemian'], ['artdeco', 'Art deco'],
      ['japandi', 'Japandi'], ['audacieux', 'Bold'], ['classique', 'Classic chic'], ['mediterraneen', 'Mediterranean'],
      ['scandinave', 'Scandinavian'], ['industriel', 'Industrial'], ['contemporain', 'Contemporary']
    ]
  },
  priorite: {
    label: 'Your priority', lignes: ['What you want', 'to change'], script: 'first', texte: 'The rest of the room keeps what you like. Several choices possible.',
    tout: ['tout', 'Rethink everything', 'Start from scratch'],
    options: {
      canape: 'The sofa', fauteuils: 'The armchairs', eclairage: 'The lighting', tables: 'The tables', rangement: 'The storage', deco: 'The decor',
      lit: 'The bed', baignoire: 'The bathtub', assise: 'The seating', jardin: 'The garden lounge', miroir: 'The mirror'
    }
  },
  photos: {
    label: 'Your survey', lignes: ['Your room', 'takes shape'], script: 'to your measure',
    texte: 'Choose photos, an Android scan, an Apple scan or your house floor plan. Then check the dimensions before furnishing.',
    principale: 'From the doorway', repere: 'Room photo', prendre: 'Take the photo', remplacer: 'Replace', autre: 'Other angle',
    dims: 'Do you know its size? (optional)', largeur: 'Width (m)', profondeur: 'Depth (m)',
    angles: { fond: 'From the far end to the entrance', gauche: 'The left wall', droite: 'The right wall' },
    precision: 'One photo gives an estimate. The opposite view helps locate the door and hidden furniture. Keep the room arranged the same way between photos.',
    repereDims: 'From the main photo: width is left to right; depth runs to the far wall. These measurements help check proportions.',
    notes: 'Constraints and uses to preserve (optional)', notesAide: 'E.g. radiator below the window, door behind me on the left, 160 cm bed, keep a dressing area.',
    erreurDetails: 'Your notes could not be saved. Please try again before starting the design.',
    lancer: 'Design my room', manque: 'Add at least the photo taken from the doorway.', erreur: 'The photo could not be sent. Try again.'
  },
  chargement: {
    lignes: ['Your room', 'takes shape'], script: 'one moment',
    etapes: ['Reading your photos', 'Walls, windows and size', 'Finding your furniture', 'Maison Corleone selection', 'Placing it in your room'],
    etapesScan: ['Metric survey received', 'Imported dimensions validated', 'Preparing the room model', 'Maison Corleone selection', 'Placing it in your room'],
    duree: 'About two minutes. Keep this page open, we are preparing everything.',
    erreur: 'The analysis did not go through.', reessayer: 'Try again', photos: 'Retake the photos',
    limite: 'You have designed every room included with your account.', limiteJour: 'You have reached today’s limit. Try again tomorrow.', service: 'The service is temporarily unavailable. Try again later.'
  },
  scene: {
    proposition: 'Proposal', pieces: '{n} pieces', titre: 'Your {piece}', script: 'by Maison Corleone',
    maquette: 'Model {l} × {p} m', total: 'Total', surDevis: 'on request', gardes: 'Kept from your room: {n}',
    jour: 'Day', soir: 'Evening', vueMaquette: 'Model', vuePhoto: 'Photo view', ensemble: 'Whole room',
    rendu: 'Realistic render', offerts: '{n} free', offertsPl: '{n} free', plusDeRendu: 'Free renders used',
    voir: 'View in the shop', echanger: 'Swap', retirer: 'Remove', garder: 'Keep', tourner: 'Rotate',
    nouvelle: 'New room', mesPieces: 'My rooms', aide: 'Drag to orbit, drag a piece to move it.',
    vue3d: '3D', photo: 'Photo', tournerAide: 'Drag to turn', fermer: 'Close', enregistre: 'Changes saved.',
    erreur: 'Something went wrong. Please try again.', concept: 'A Maison Corleone proposal for your room.',
    ajouter: 'Add furniture', ameublement: 'Furnish the room', reamenager: 'Redesign automatically', reamenagement: 'Redesigning…', reamenagerAide: 'A new proposal with your budget and style.', reamenage: 'Your new layout is ready.',
    precedente: 'Previous piece', suivante: 'Next piece', numero: 'Piece {n} of {t}', deVotrePiece: 'From your room',
    gardeEtat: 'Kept', retireEtat: 'Removed', voir360: 'View in 360°', dims: '{l} × {p} × {h} cm', vide: 'No Maison Corleone piece yet: add some from the catalogue.',
    renduVoir: 'View the render', boutique: 'Back to the Maison Corleone shop', recommencer: 'Restart the demo', nouvellePiece: 'Maison Corleone piece', retireToast: '{n} removed from the room.'
  },
  envies: { style: 'Desired style: {s}.', priorite: 'Change first: {p}; keep the rest of the room.', tout: 'Rethink the whole room.', coups: 'Favourites to include if possible: {c}.' },
  rendu: {
    titre: 'Realistic render', attente: 'Your photo is being reimagined', duree: 'About a minute.', avant: 'Before', apres: 'After',
    telecharger: 'Download', fermer: 'Close', restants: 'Free renders left: {n}',
    manquePhoto: 'Your metric plan is kept. Add an entrance photo for the final photo render.', ajouterPhoto: 'Add the render photo',
    avertissement: 'AI-generated image based on your photo, the model and the product photos: it can contain errors (proportions, colours, details). It is not contractual; only the product pages are binding.',
    epuise: 'You have used your two free renders.', erreur: 'The render did not go through: your free render has been returned.'
  },
  fonctions: { salon: 'living room', chambre: 'bedroom', salle_a_manger: 'dining room', bureau: 'study', salle_de_bain: 'bathroom', entree: 'entrance', terrasse: 'terrace' },
  noms: { salon: 'Living room', chambre: 'Bedroom', salle_a_manger: 'Dining room', bureau: 'Study', salle_de_bain: 'Bathroom', entree: 'Entrance', terrasse: 'Terrace' }
};

export const textesMaison = lang => (lang === 'en' ? en : fr);
export const remplir = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));

// priorités proposées selon la pièce, et familles du catalogue qu'elles visent
export const PRIORITES = {
  salon: ['canape', 'fauteuils', 'eclairage', 'tables', 'rangement', 'deco'],
  chambre: ['lit', 'eclairage', 'fauteuils', 'rangement', 'deco'],
  salle_a_manger: ['tables', 'eclairage', 'rangement', 'deco'],
  bureau: ['fauteuils', 'eclairage', 'rangement', 'deco'],
  salle_de_bain: ['baignoire', 'eclairage', 'miroir', 'deco'],
  entree: ['rangement', 'miroir', 'eclairage', 'assise'],
  terrasse: ['jardin', 'assise', 'deco']
};
export const FAMILLES_PRIORITE = {
  canape: ['canape', 'meridienne'], fauteuils: ['fauteuil', 'pouf', 'chaise'],
  eclairage: ['suspension', 'lustre', 'plafonnier', 'lampadaire', 'lampe', 'applique'],
  tables: ['table', 'bureau'], rangement: ['meuble', 'armoire', 'commode', 'etagere', 'bibliotheque', 'buffet', 'console'],
  deco: ['sculpture', 'tapis', 'plante', 'jardiniere', 'deco'], miroir: ['miroir'],
  lit: ['lit'], baignoire: ['baignoire'], assise: ['banc', 'pouf', 'balancelle'], jardin: ['salon-jardin', 'balancelle', 'jardiniere', 'meridienne']
};
// familles du catalogue utiles à chaque pièce (suggestions de style)
export const FAMILLES_PIECE = {
  salon: ['canape', 'fauteuil', 'suspension', 'lustre', 'lampadaire', 'table', 'sculpture', 'meuble', 'pouf'],
  chambre: ['lit', 'fauteuil', 'suspension', 'applique', 'lustre', 'meuble'],
  salle_a_manger: ['table', 'suspension', 'lustre', 'meuble', 'sculpture'],
  bureau: ['fauteuil', 'suspension', 'lampadaire', 'applique', 'meuble'],
  salle_de_bain: ['baignoire', 'miroir', 'applique', 'suspension'],
  entree: ['meuble', 'miroir', 'applique', 'banc', 'sculpture'],
  terrasse: ['salon-jardin', 'balancelle', 'jardiniere', 'meridienne']
};
// inspirations : mots cherchés dans les titres, textes, couleurs et matières des produits
export const MOTS_STYLE = {
  chaleureux: ['bois', 'terracotta', 'velours', 'bouclette', 'bouclé', 'cognac', 'noyer', 'orange', 'caramel', 'camel', 'chaleur'],
  epure: ['blanc', 'minimal', 'épuré', 'sobre', 'ligne', 'beige', 'crème', 'clair'],
  boheme: ['rotin', 'osier', 'jute', 'palmier', 'plume', 'naturel', 'tressé', 'bambou', 'fibre'],
  artdeco: ['laiton', 'doré', 'or ', 'marbre', 'arrondi', 'courbe', 'géométri', 'velours'],
  japandi: ['chêne', 'lin', 'zen', 'japon', 'naturel', 'bois clair', 'minimal', 'bas'],
  audacieux: ['pop', 'rose', 'violet', 'bleu', 'sculptural', 'graphique', 'jaune', 'vert', 'couleur'],
  classique: ['capitonné', 'cuir', 'chesterfield', 'velours', 'laiton', 'noir', 'élégan'],
  mediterraneen: ['terracotta', 'travertin', 'blanc', 'lin', 'olive', 'rotin', 'terre', 'sable']
};
