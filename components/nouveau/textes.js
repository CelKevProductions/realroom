// Textes du nouveau projet guidé (français et anglais). Ton simple, une question par écran.
// « *mot* » : le mot est surligné de pêche dans les grands titres.
const fr = {
  locale: 'fr-FR',
  marque: 'RealRoom', demo: 'Démo', quitter: 'Quitter', retour: 'Retour', continuer: 'Continuer', passer: 'Passer', facultatif: 'Facultatif',
  entree: 'Entrée', enregistre: 'Enregistré', enregistrement: 'Enregistrement…', nonEnregistre: 'Pas enregistré : vérifiez la connexion.',
  chapitres: ['Le projet', 'La pièce', 'Vos envies', 'C’est parti'],
  question: 'Question', position: 'Question {n} sur {t}',
  reprise: { titre: 'Un projet en cours', texte: '« {nom} », question {n} sur {t}.', reprendre: 'Reprendre', recommencer: 'Recommencer' },
  apercu: {
    titre: 'Votre projet', planVide: 'Le plan de la pièce apparaîtra ici.', piece: 'La pièce', zones: 'Aussi', meubles: 'Gardés', foyer: 'Foyer',
    priorites: 'Priorités', style: 'Style', budget: 'Budget', exemple: 'Exemple : un séjour de 29 m² relevé au téléphone, avec ses meubles.'
  },
  accueil: {
    etiquette: 'Nouveau projet',
    titre: 'On aménage votre pièce *ensemble*.',
    texte: 'Quelques questions, une à la fois. RealRoom lit votre scan, vous corrigez ce qui cloche, puis on meuble avec de vrais meubles. Comptez cinq minutes.',
    etapes: [
      ['Votre pièce', 'Le zip de votre scan : murs, portes, fenêtres et meubles.'],
      ['Vos envies', 'Qui vit là, ce qui compte, votre style, votre budget.'],
      ['La proposition', 'Une pièce meublée à visiter en 3D, puis en photo réaliste.']
    ],
    bouton: 'Commencer', ajout: 'Nouvelle pièce pour « {nom} »'
  },
  nom: {
    titre: 'Comment s’appelle ce *projet* ?',
    aide: 'Un projet, c’est un logement : vous y ajouterez ses pièces une à une.',
    exemple: 'Mon appartement',
    suggestions: ['Mon appartement', 'La maison', 'Le studio', 'La location'],
    apercu: 'Votre projet', pieces: 'pièce à venir'
  },
  plan: {
    titre: 'Déposez le *zip* de votre scan.',
    aide: 'Le zip exporté par Lagarscan, ou par une autre application Apple RoomPlan, contient tout : les murs et leur hauteur, les portes, les fenêtres et vos meubles.',
    zone: 'Glissez le fichier ici', ou: 'ou', choisir: 'Choisir un fichier', formats: 'Zip, JSON RoomPlan ou plan DXF · 25 Mo au plus',
    lecture: 'Lecture du relevé…', autre: 'Déposer un autre fichier',
    pasDeScan: 'Pas encore de scan ?',
    commentScanner: [
      'Installez Lagarscan, gratuit, sur un iPhone ou un iPad équipé du LiDAR (iPhone 12 Pro ou plus récent).',
      'Faites le tour de la pièce en filmant les murs : deux minutes suffisent.',
      'Exportez le projet en zip, puis déposez-le ici.'
    ],
    appStore: 'Lagarscan sur l’App Store',
    photos: 'Sans iPhone LiDAR : partir de photos et de mesures',
    exemple: 'Essayer avec une pièce d’exemple', exempleTexte: 'Un séjour de 29 m² avec cuisine ouverte, déjà scanné.',
    unites: 'Ce plan n’indique pas ses unités. Lesquelles ?', choisirPiece: 'Ce plan contient plusieurs pièces. Laquelle aménageons-nous ?',
    unitesNoms: { m: 'Mètres', cm: 'Centimètres', mm: 'Millimètres', ft: 'Pieds', in: 'Pouces' },
    comparer: 'Ce que chaque fichier apporte',
    contenus: ['Murs et cotes', 'Hauteur sous plafond', 'Portes et fenêtres', 'Vos meubles'],
    fichiers: [['Zip du scan', [1, 1, 1, 1]], ['Plan DXF seul', [1, 0, 1, 0]]],
    erreurs: {
      'scan-format': 'Ce fichier n’est pas un relevé de pièce. Déposez le zip exporté par Lagarscan, son fichier scan.json, ou un plan DXF.',
      'scan-autre': 'Ce format ne contient pas le relevé lisible : déposez le zip complet exporté par Lagarscan (il contient scan.json).',
      'scan-archive': 'Ce zip ne contient pas de relevé de pièce (scan.json). Déposez le zip complet exporté par Lagarscan.',
      'scan-navigateur': 'Ce navigateur ne sait pas ouvrir les zip. Mettez-le à jour, ou décompressez le zip et déposez son fichier data/scan.json.',
      'scan-pieces': 'Ce scan contient plusieurs pièces. Exportez une seule pièce à la fois.',
      'trop-gros': 'Le fichier est trop lourd (25 Mo pour un zip, 5 Mo pour un JSON ou un DXF).',
      'plan-taille': 'Ce plan dépasse 5 Mo. Exportez seulement la pièce voulue.',
      'scan-dimensions': 'Les cotes sortent des limites : 1,20 à 30 m au sol, 1,90 à 8 m sous plafond.',
      'scan-incomplet': 'Il manque un pan de mur au relevé. Reprenez le scan de la pièce entière.',
      'scan-coins': 'Le contour de la pièce est incomplet ou se croise. Reprenez le scan en faisant tout le tour.',
      'scan-forme': 'Cette forme de pièce n’est pas encore prise en charge. Scannez une pièce à la fois.',
      'scan-sol': 'Le sol de la pièce n’a pas été relevé. Reprenez le scan en filmant aussi le bas des murs.',
      'scan-ouverture': 'Une porte ou une fenêtre du relevé est mal placée. Reprenez le scan.',
      'scan-objet': 'Un meuble du relevé est illisible. Reprenez le scan.',
      'scan-repere': 'Le relevé n’a pas de repère cohérent. Reprenez le scan.',
      generique: 'Ce relevé n’a pas pu être lu. Réessayez, ou déposez le zip complet du scan.'
    }
  },
  compris: {
    titre: 'Voilà ce que j’ai *compris*.',
    aide: 'Vérifiez d’un coup d’œil : c’est ce plan que RealRoom va meubler.',
    sousPlafond: 'sous plafond', estimee: 'estimée', portes: ['porte', 'portes'], fenetres: ['fenêtre', 'fenêtres'],
    meubles: 'Vos meubles', installations: 'Équipements fixes', aucunMeuble: 'Aucun meuble dans ce relevé : tout sera proposé.',
    sections: 'Le scan y voit', pente: 'Murs bas sous la pente : {bas} m (jusqu’à {haut} m ailleurs). Évitez-y les meubles hauts.',
    incertains: 'Certains éléments sont incertains : regardez-les sur le plan.', dxf: 'Plan DXF : ni hauteur ni meubles. La hauteur est estimée à 2,50 m.',
    oui: 'Oui, c’est bien ça', corriger: 'Corriger les cotes', fermer: 'Fermer',
    largeur: 'Largeur', profondeur: 'Profondeur', hauteur: 'Hauteur sous plafond', appliquer: 'Appliquer',
    editeur: 'Pour déplacer une porte ou redessiner un mur, l’éditeur de plan reste disponible dans l’atelier.',
    envoi: 'Enregistrement du plan…',
    sectionsNoms: { livingroom: 'Séjour', bedroom: 'Chambre', diningroom: 'Salle à manger', bathroom: 'Salle de bain', kitchen: 'Cuisine' }
  },
  type: {
    titre: 'C’est *surtout* quelle pièce ?',
    aide: 'Le type de pièce guide les meubles proposés.', devineAide: 'Deviné d’après votre scan : corrigez si besoin.', devine: 'Vu dans le scan',
    options: {
      salon: ['Séjour', 'Canapé, télévision : on y vit'], chambre: ['Chambre', 'Lit, rangements, calme'], salle_a_manger: ['Salle à manger', 'Une grande table pour recevoir'],
      bureau: ['Bureau', 'Travailler au calme'], salle_de_bain: ['Salle de bain', 'Rangements et miroirs'], entree: ['Entrée', 'Poser, ranger, accueillir'],
      terrasse: ['Terrasse ou balcon', 'Dehors, comme dedans']
    },
    nomPiece: 'Son nom', nomAide: 'facultatif'
  },
  zones: {
    titre: 'Qu’y a-t-il *aussi* dans cette pièce ?',
    aide: 'Une pièce sert souvent à plusieurs choses : cochez tout ce qui s’y passe.',
    options: { cuisine: 'Une cuisine ouverte', repas: 'Un coin repas', travail: 'Un coin bureau', lecture: 'Un coin lecture', rangement: 'Beaucoup de rangement', bar: 'Un bar ou un comptoir' },
    vu: 'Vu dans le scan', places: 'Places à table', rien: 'Rien d’autre'
  },
  meubles: {
    titre: 'Que deviennent vos *meubles* ?',
    aide: 'Touchez un meuble, ici ou sur le plan. Ce que vous gardez reste à sa place ; le reste est remplacé.',
    etats: { remplace: 'Remplacer', fixe: 'Garder ici', deplacable: 'Garder, peut bouger' },
    tout: 'Tout remplacer', garder: 'Tout garder ici',
    fixes: 'Équipements fixes, gardés tels quels',
    note: 'Un meuble gardé garde ses dimensions. Pour l’instant, la première proposition laisse les meubles gardés à leur place.'
  },
  foyer: {
    titre: 'Qui vit *ici* ?',
    aide: 'Quelques mots sur la maisonnée, pour une pièce qui vous ressemble.',
    adultes: 'Adultes', enfants: 'Enfants', moins: 'Un de moins', plus: 'Un de plus',
    animaux: 'Des animaux ?', chien: 'Un chien', chat: 'Un chat',
    recevoir: 'Vous recevez…', frequences: { rarement: 'Rarement', parfois: 'De temps en temps', souvent: 'Souvent' }
  },
  priorites: {
    titre: 'Qu’est-ce qui compte le *plus* ?',
    aide: 'Trois choix au plus : ils orientent la composition de la pièce.',
    options: {
      circulation: ['Circuler facilement', 'Des passages larges, rien dans le chemin'], rangement: ['Ranger beaucoup', 'Des rangements partout où c’est possible'],
      recevoir: ['Recevoir du monde', 'Des places pour s’asseoir, une table'], calme: ['Un coin à soi', 'Lire, se poser, au calme'],
      lumiere: ['Profiter de la lumière', 'Rien devant les fenêtres'], enfants: ['De la place pour les enfants', 'Un sol libre pour jouer']
    },
    max: 'Trois choix au plus.', compte: '{n} sur 3'
  },
  style: {
    titre: 'Quel style vous *ressemble* ?',
    aide: 'Un ou deux choix. Pas sûr ? Passez : on reste chaleureux et simple.',
    styles: {
      japandi: ['Japandi', 'Bois clair, lignes basses, calme'], scandinave: ['Scandinave', 'Clair, doux, fonctionnel'],
      contemporain: ['Contemporain', 'Lignes nettes, tons neutres'], boheme: ['Bohème', 'Rotin, plantes, terre cuite'],
      industriel: ['Industriel', 'Métal noir, cuir, bois brut'], classique: ['Classique chic', 'Moulures, velours, laiton'],
      artdeco: ['Art déco', 'Courbes, tons profonds, laiton'], mediterraneen: ['Méditerranéen', 'Blanc chaulé, lin, bois flotté']
    },
    libre: 'Ou avec vos mots', libreExemple: 'Ex. : chaleureux, bois clair, touches de vert', max: 'Deux styles au plus.', compte: '{n} sur 2'
  },
  inspirations: {
    titre: 'Une image qui vous *inspire* ?',
    aide: 'Une photo de magazine, une capture Pinterest : jusqu’à trois images. Elles guident l’aménagement par IA dans l’atelier.',
    ajouter: 'Ajouter une image', retirer: 'Retirer', envoi: 'Envoi…', erreur: 'Cette image n’a pas pu être enregistrée. Essayez un autre fichier.',
    demo: 'Démo : les images sont gardées dans ce navigateur.', compte: '{n} sur 3'
  },
  budget: {
    titre: 'Quel budget pour les *meubles* ?',
    aide: 'Pour cette pièce. Les meubles que vous gardez ne comptent pas.',
    sans: 'Pas de budget précis', exact: 'Montant exact', jusqua: 'jusqu’à'
  },
  recap: {
    titre: 'Tout est prêt. On *meuble* ?',
    aide: 'Relisez, changez ce que vous voulez, puis lancez la première proposition.',
    lignes: { piece: 'La pièce', zones: 'Aussi', meubles: 'Gardés', foyer: 'Foyer', priorites: 'Priorités', style: 'Style', inspirations: 'Inspirations', budget: 'Budget' },
    aucun: 'Aucun', aucune: 'Aucune', tout: 'Tout est remplacé', modifier: 'Modifier',
    envies: 'Un dernier mot pour le décorateur ?', enviesExemple: 'Ex. : garder de la place pour le piano, pas de tapis',
    lancer: 'Meubler ma pièce', adulte: ['adulte', 'adultes'], enfant: ['enfant', 'enfants'], image: ['image', 'images'],
    depuis: 'Revenir au récapitulatif', places: '{n} places à table'
  },
  attente: {
    etiquette: 'Première proposition',
    titre: 'On meuble votre pièce.',
    phases: ['Je lis le plan, les portes et les fenêtres', 'Je garde les passages libres', 'Je choisis les meubles dans le catalogue', 'J’essaie plusieurs dispositions', 'Je compare les propositions'],
    conseils: [
      'Un passage confortable mesure au moins 80 cm.',
      'Autour d’une table, comptez 70 cm pour tirer une chaise.',
      'Le canapé évite de tourner le dos à l’entrée de la pièce.',
      'Un tapis glisse sous les pieds avant du canapé : la pièce paraît plus grande.',
      'La télévision se place à l’abri des reflets des fenêtres.'
    ],
    conseil: 'Le saviez-vous ?',
    pret: 'Votre pièce est *prête*.', meubles: ['meuble proposé', 'meubles proposés'], voir: 'Voir ma pièce en 3D',
    erreur: 'La proposition n’a pas pu être calculée.', reessayer: 'Réessayer', sansGarder: 'Réessayer en remplaçant tout', atelier: 'Ouvrir l’atelier', retour: 'Revenir aux questions',
    sansBudget: 'Réessayer sans budget', sansCoins: 'Réessayer sans les coins en plus', totalTexte: 'de meubles',
    long: 'Encore un instant : une grande pièce demande plus d’essais.',
    erreurs: {
      'assistant-disposition': 'Aucune disposition sûre n’a été trouvée avec ces choix : les passages et les ouvertures ne laissent pas assez de place.',
      'assistant-budget': 'Ce budget est trop serré pour meubler la pièce avec le catalogue.',
      'assistant-conservation': 'Les meubles gardés à leur place ne laissent pas de disposition valable autour d’eux.',
      'assistant-fonction': 'Ce type de pièce n’a pas encore de proposition automatique.',
      'regles-bloquantes': 'Les règles de sécurité de la pièce empêchent une disposition valable.',
      'amenagement-conflit': 'La pièce a changé pendant le calcul. Réessayez.',
      limite: 'Beaucoup de demandes en ce moment. Réessayez dans quelques minutes.',
      reseau: 'La connexion a été coupée. Vérifiez le réseau, puis réessayez.',
      generique: 'Une erreur est survenue pendant le calcul. Réessayez.'
    }
  },
  noms: {},
  erreurs: { generique: 'Une erreur est survenue. Réessayez.', 'limite-projets': 'Nombre maximal de projets atteint.', 'limite-pieces': 'Nombre maximal de pièces atteint pour ce projet.',
    reseau: 'La connexion a été coupée. Vérifiez le réseau, puis réessayez.', 'limite-photos': 'Trois images au plus.' }
};

const en = {
  ...fr,
  locale: 'en-GB',
  demo: 'Demo', quitter: 'Exit', retour: 'Back', continuer: 'Continue', passer: 'Skip', facultatif: 'Optional',
  entree: 'Enter', enregistre: 'Saved', enregistrement: 'Saving…', nonEnregistre: 'Not saved: check your connection.',
  chapitres: ['The project', 'The room', 'Your wishes', 'Let’s go'],
  question: 'Question', position: 'Question {n} of {t}',
  reprise: { titre: 'A project in progress', texte: '“{nom}”, question {n} of {t}.', reprendre: 'Resume', recommencer: 'Start over' },
  apercu: {
    titre: 'Your project', planVide: 'The room plan will appear here.', piece: 'The room', zones: 'Also', meubles: 'Kept', foyer: 'Household',
    priorites: 'Priorities', style: 'Style', budget: 'Budget', exemple: 'Example: a 29 m² living room scanned with a phone, with its furniture.'
  },
  accueil: {
    etiquette: 'New project',
    titre: 'Let’s furnish your room *together*.',
    texte: 'A few questions, one at a time. RealRoom reads your scan, you fix what’s off, then we furnish with real furniture. About five minutes.',
    etapes: [
      ['Your room', 'Your scan zip: walls, doors, windows and furniture.'],
      ['Your wishes', 'Who lives there, what matters, your style, your budget.'],
      ['The proposal', 'A furnished room to explore in 3D, then as a realistic photo.']
    ],
    bouton: 'Start', ajout: 'New room for “{nom}”'
  },
  nom: {
    titre: 'What’s this *project* called?',
    aide: 'A project is a home: you’ll add its rooms one by one.',
    exemple: 'My flat',
    suggestions: ['My flat', 'The house', 'The studio', 'The rental'],
    apercu: 'Your project', pieces: 'room to come'
  },
  plan: {
    ...fr.plan,
    titre: 'Drop your scan *zip*.',
    aide: 'The zip exported by Lagarscan, or any Apple RoomPlan app, has everything: walls and their height, doors, windows and your furniture.',
    zone: 'Drop the file here', ou: 'or', choisir: 'Choose a file', formats: 'Zip, RoomPlan JSON or DXF plan · 25 MB max',
    lecture: 'Reading the survey…', autre: 'Drop another file',
    pasDeScan: 'No scan yet?',
    commentScanner: [
      'Install Lagarscan, free, on an iPhone or iPad with LiDAR (iPhone 12 Pro or newer).',
      'Walk around the room filming the walls: two minutes is enough.',
      'Export the project as a zip, then drop it here.'
    ],
    appStore: 'Lagarscan on the App Store',
    photos: 'No LiDAR iPhone: start from photos and measurements',
    exemple: 'Try with a sample room', exempleTexte: 'A 29 m² living room with an open kitchen, already scanned.',
    unites: 'This plan doesn’t state its units. Which ones?', choisirPiece: 'This plan has several rooms. Which one shall we furnish?',
    unitesNoms: { m: 'Metres', cm: 'Centimetres', mm: 'Millimetres', ft: 'Feet', in: 'Inches' },
    comparer: 'What each file brings',
    contenus: ['Walls and dimensions', 'Ceiling height', 'Doors and windows', 'Your furniture'],
    fichiers: [['Scan zip', [1, 1, 1, 1]], ['DXF plan only', [1, 0, 1, 0]]],
    erreurs: {
      'scan-format': 'This file isn’t a room survey. Drop the zip exported by Lagarscan, its scan.json file, or a DXF plan.',
      'scan-autre': 'This format has no readable survey: drop the full zip exported by Lagarscan (it contains scan.json).',
      'scan-archive': 'This zip has no room survey (scan.json). Drop the full zip exported by Lagarscan.',
      'scan-navigateur': 'This browser can’t open zip files. Update it, or unzip and drop its data/scan.json file.',
      'scan-pieces': 'This scan has several rooms. Export one room at a time.',
      'trop-gros': 'The file is too large (25 MB for a zip, 5 MB for JSON or DXF).',
      'plan-taille': 'This plan exceeds 5 MB. Export just the room you need.',
      'scan-dimensions': 'Dimensions out of range: 1.20 to 30 m on the floor, 1.90 to 8 m ceiling height.',
      'scan-incomplet': 'A wall is missing from the survey. Scan the whole room again.',
      'scan-coins': 'The room outline is incomplete or crosses itself. Scan again, all the way around.',
      'scan-forme': 'This room shape isn’t supported yet. Scan one room at a time.',
      'scan-sol': 'The floor wasn’t captured. Scan again, filming the bottom of the walls too.',
      'scan-ouverture': 'A door or window in the survey is misplaced. Scan again.',
      'scan-objet': 'A piece of furniture in the survey is unreadable. Scan again.',
      'scan-repere': 'The survey has no consistent reference frame. Scan again.',
      generique: 'This survey couldn’t be read. Try again, or drop the full scan zip.'
    }
  },
  compris: {
    titre: 'Here’s what I *understood*.',
    aide: 'Check at a glance: this is the plan RealRoom will furnish.',
    sousPlafond: 'ceiling', estimee: 'estimated', portes: ['door', 'doors'], fenetres: ['window', 'windows'],
    meubles: 'Your furniture', installations: 'Fixed fittings', aucunMeuble: 'No furniture in this survey: everything will be suggested.',
    sections: 'The scan sees', pente: 'Low walls under the slope: {bas} m ({haut} m elsewhere). Keep tall furniture away.',
    incertains: 'Some elements are uncertain: check them on the plan.', dxf: 'DXF plan: no height and no furniture. Height is estimated at 2.50 m.',
    oui: 'Yes, that’s right', corriger: 'Fix dimensions', fermer: 'Close',
    largeur: 'Width', profondeur: 'Depth', hauteur: 'Ceiling height', appliquer: 'Apply',
    editeur: 'To move a door or redraw a wall, the plan editor is still available in the studio.',
    envoi: 'Saving the plan…',
    sectionsNoms: { livingroom: 'Living room', bedroom: 'Bedroom', diningroom: 'Dining room', bathroom: 'Bathroom', kitchen: 'Kitchen' }
  },
  type: {
    titre: 'What room is it *mostly*?',
    aide: 'The room type guides the suggested furniture.', devineAide: 'Guessed from your scan: change it if needed.', devine: 'Seen in the scan',
    options: {
      salon: ['Living room', 'Sofa, TV: where you live'], chambre: ['Bedroom', 'Bed, storage, calm'], salle_a_manger: ['Dining room', 'A big table to host'],
      bureau: ['Office', 'Work in peace'], salle_de_bain: ['Bathroom', 'Storage and mirrors'], entree: ['Entrance', 'Drop, store, welcome'],
      terrasse: ['Terrace or balcony', 'Outdoors, like indoors']
    },
    nomPiece: 'Its name', nomAide: 'optional'
  },
  zones: {
    titre: 'What *else* is in this room?',
    aide: 'Rooms often do several things: tick everything that happens here.',
    options: { cuisine: 'An open kitchen', repas: 'A dining area', travail: 'A work corner', lecture: 'A reading nook', rangement: 'Lots of storage', bar: 'A bar or counter' },
    vu: 'Seen in the scan', places: 'Seats at the table', rien: 'Nothing else'
  },
  meubles: {
    titre: 'What happens to your *furniture*?',
    aide: 'Tap a piece, here or on the plan. What you keep stays where it is; the rest is replaced.',
    etats: { remplace: 'Replace', fixe: 'Keep here', deplacable: 'Keep, can move' },
    tout: 'Replace all', garder: 'Keep all here',
    fixes: 'Fixed fittings, kept as they are',
    note: 'Kept furniture keeps its size. For now, the first proposal leaves kept pieces where they are.'
  },
  foyer: {
    titre: 'Who lives *here*?',
    aide: 'A few words about your household, for a room that fits your life.',
    adultes: 'Adults', enfants: 'Children', moins: 'One fewer', plus: 'One more',
    animaux: 'Pets?', chien: 'A dog', chat: 'A cat',
    recevoir: 'You have guests…', frequences: { rarement: 'Rarely', parfois: 'Sometimes', souvent: 'Often' }
  },
  priorites: {
    titre: 'What matters *most*?',
    aide: 'Three picks at most: they steer how the room is composed.',
    options: {
      circulation: ['Moving around easily', 'Wide passages, nothing in the way'], rangement: ['Lots of storage', 'Storage wherever it fits'],
      recevoir: ['Hosting people', 'Seats and a table'], calme: ['A corner of my own', 'Read, rest, in peace'],
      lumiere: ['Enjoying the light', 'Nothing in front of the windows'], enfants: ['Room for the kids', 'Free floor to play']
    },
    max: 'Three picks at most.', compte: '{n} of 3'
  },
  style: {
    titre: 'Which style feels like *you*?',
    aide: 'One or two picks. Not sure? Skip: we’ll keep it warm and simple.',
    styles: {
      japandi: ['Japandi', 'Light wood, low lines, calm'], scandinave: ['Scandinavian', 'Light, soft, practical'],
      contemporain: ['Contemporary', 'Clean lines, neutral tones'], boheme: ['Bohemian', 'Rattan, plants, terracotta'],
      industriel: ['Industrial', 'Black metal, leather, raw wood'], classique: ['Classic chic', 'Mouldings, velvet, brass'],
      artdeco: ['Art deco', 'Curves, deep tones, brass'], mediterraneen: ['Mediterranean', 'Limewash, linen, driftwood']
    },
    libre: 'Or in your own words', libreExemple: 'E.g. warm, light wood, touches of green', max: 'Two styles at most.', compte: '{n} of 2'
  },
  inspirations: {
    titre: 'An image that *inspires* you?',
    aide: 'A magazine photo, a Pinterest screenshot: up to three images. They guide AI furnishing in the studio.',
    ajouter: 'Add an image', retirer: 'Remove', envoi: 'Uploading…', erreur: 'This image couldn’t be saved. Try another file.',
    demo: 'Demo: images stay in this browser.', compte: '{n} of 3'
  },
  budget: {
    titre: 'What budget for *furniture*?',
    aide: 'For this room. Furniture you keep doesn’t count.',
    sans: 'No set budget', exact: 'Exact amount', jusqua: 'up to'
  },
  recap: {
    titre: 'All set. Shall we *furnish*?',
    aide: 'Read it over, change anything, then start the first proposal.',
    lignes: { piece: 'The room', zones: 'Also', meubles: 'Kept', foyer: 'Household', priorites: 'Priorities', style: 'Style', inspirations: 'Inspiration', budget: 'Budget' },
    aucun: 'None', aucune: 'None', tout: 'Everything is replaced', modifier: 'Edit',
    envies: 'A last word for the designer?', enviesExemple: 'E.g. keep room for the piano, no rug',
    lancer: 'Furnish my room', adulte: ['adult', 'adults'], enfant: ['child', 'children'], image: ['image', 'images'],
    depuis: 'Back to the summary', places: '{n} seats at the table'
  },
  attente: {
    etiquette: 'First proposal',
    titre: 'Furnishing your room.',
    phases: ['Reading the plan, doors and windows', 'Keeping passages clear', 'Picking furniture from the catalogue', 'Trying several layouts', 'Comparing proposals'],
    conseils: [
      'A comfortable passage is at least 80 cm wide.',
      'Around a table, allow 70 cm to pull out a chair.',
      'A sofa avoids turning its back to the room’s entrance.',
      'A rug slides under the sofa’s front legs: the room looks bigger.',
      'The TV goes away from window reflections.'
    ],
    conseil: 'Did you know?',
    pret: 'Your room is *ready*.', meubles: ['suggested piece', 'suggested pieces'], voir: 'See my room in 3D',
    erreur: 'The proposal couldn’t be computed.', reessayer: 'Try again', sansGarder: 'Try again replacing everything', atelier: 'Open the studio', retour: 'Back to the questions',
    sansBudget: 'Try again without a budget', sansCoins: 'Try again without the extra areas', totalTexte: 'of furniture',
    long: 'One more moment: a large room takes more tries.',
    erreurs: {
      'assistant-disposition': 'No safe layout was found with these choices: passages and openings leave too little space.',
      'assistant-budget': 'This budget is too tight to furnish the room from the catalogue.',
      'assistant-conservation': 'The pieces kept in place leave no valid layout around them.',
      'assistant-fonction': 'This room type has no automatic proposal yet.',
      'regles-bloquantes': 'The room’s safety rules prevent a valid layout.',
      'amenagement-conflit': 'The room changed during the calculation. Try again.',
      limite: 'Lots of requests right now. Try again in a few minutes.',
      reseau: 'The connection dropped. Check your network, then try again.',
      generique: 'Something went wrong during the calculation. Try again.'
    }
  },
  noms: {
    'Lit': 'Bed', 'Canapé': 'Sofa', 'Fauteuil': 'Armchair', 'Siège': 'Seat', 'Table': 'Table', 'Rangement': 'Storage', 'Télévision': 'TV',
    'Cheminée': 'Fireplace', 'Baignoire': 'Bathtub', 'Réfrigérateur': 'Fridge', 'Four': 'Oven', 'Cuisson': 'Hob', 'Lave-vaisselle': 'Dishwasher',
    'Lave-linge': 'Washing machine', 'Évier': 'Sink', 'Sanitaire': 'Toilet', 'Escalier': 'Stairs', 'Objet': 'Object'
  },
  erreurs: { generique: 'Something went wrong. Try again.', 'limite-projets': 'Maximum number of projects reached.', 'limite-pieces': 'Maximum number of rooms reached for this project.',
    reseau: 'The connection dropped. Check your network, then try again.', 'limite-photos': 'Three images at most.' }
};

export const TEXTES = { fr, en };
