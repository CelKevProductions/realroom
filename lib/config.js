// Réglages de RealRoom (un service KPW). Les prix sont en centimes d'euro.
export const MARQUE = {
  nom: 'RealRoom',
  editeur: 'KPW',
  partenaire: 'Maison Corleone',
  site: (process.env.SITE_URL || 'https://realroom.app').replace(/\/$/, ''),
  contact: process.env.CONTACT_EMAIL || ''
};

export const LANGUES = ['fr', 'en'];
export const LANGUE_DEFAUT = 'fr';
export const estLangue = l => LANGUES.includes(l);

// crédits : offerts à l'inscription, et coût de chaque génération
export const CREDITS = {
  bienvenue: Number(process.env.CREDITS_BIENVENUE ?? 3),
  rendu: 1,
  monde: 5
};
export const PACKS = [
  { id: 'essai', credits: 10, prix: 900 },
  { id: 'projet', credits: 30, prix: 2400, conseille: true },
  { id: 'pro', credits: 100, prix: 6900 }
];

// garde-fous (par compte)
export const LIMITES = {
  piecesParProjet: 12,
  projetsParCompte: 30,
  photosParPiece: 8,
  analysesParJour: Number(process.env.ANALYSES_PAR_JOUR || 30),
  amenagementsParJour: Number(process.env.AMENAGEMENTS_PAR_JOUR || 60),
  photoOctetsMax: 4.2e6,
  // plafonds globaux (tous comptes), contre les abus et les factures surprises
  bienvenuesParJour: Number(process.env.BIENVENUES_PAR_JOUR || 150),
  analysesGlobalesParJour: Number(process.env.ANALYSES_GLOBALES_PAR_JOUR || 600),
  amenagementsGlobauxParJour: Number(process.env.AMENAGEMENTS_GLOBAUX_PAR_JOUR || 1200)
};

// fonctions de pièce proposées (clé stable, libellés dans lib/i18n.js)
export const FONCTIONS = ['salon', 'chambre', 'salle_a_manger', 'bureau', 'salle_de_bain', 'cuisine', 'entree', 'chambre_enfant', 'terrasse', 'autre'];

// rôles des photos : la première est la vue principale (depuis l'entrée), elle sert au rendu
export const ROLES_PHOTO = ['entree', 'fond', 'gauche', 'droite', 'detail'];

// sans clés d'API (développement, démonstration) : réponses simulées, aucun appel payant.
// Jamais sur le site en production.
export const SIMULATION = process.env.REALROOM_SIMULATION === '1' && process.env.VERCEL_ENV !== 'production';
// essais sans services externes (code de connexion affiché, achat simulé) : seulement hors de Vercel,
// en développement ou pour les essais automatiques
export const ESSAIS_LOCAUX = !process.env.VERCEL && (process.env.NODE_ENV !== 'production' || process.env.REALROOM_ESSAIS === '1');

export const MODELES = {
  claude: process.env.ANTHROPIC_MODELE || 'claude-sonnet-5',
  fal: process.env.FAL_MODELE || 'fal-ai/nano-banana-pro/edit',
  marble: process.env.MARBLE_MODELE || 'marble-1.1'
};
