import MODELES from '../data/encyclopedie/modeles.json' with {type:'json'};
// Bibliothèque de mise en scène. Aucun SKU marchand, prix, lien d'achat ou panier.
import { PROFILS, stylesDemandes } from './profils.js';

export function stagingActif(choix) {
  if (choix === false) return false;
  if (typeof process !== 'undefined' && (process.env.REALROOM_STAGING === '0' || process.env.NEXT_PUBLIC_REALROOM_STAGING === '0')) return false;
  if (typeof window !== 'undefined') { try { if (localStorage.getItem('rr-staging') === '0') return false; } catch (_) {} }
  return true;
}
const styles = Object.keys(PROFILS);
const entree = (id, nom, dim, forme, description, fam = 'deco') => ({ id, nom, dim, forme, description, fam, styles, vendu: false, origine: 'mise-en-scene' });
export const PROPS = Object.freeze(Object.fromEntries([
  ...MODELES.modeles.map(m=>({...m,styles,origine:'mise-en-scene'})),
  entree('plateau', 'Plateau', [.25,.16,.025], 'plateau', 'Plateau en bois ou métal, sobre, aux rebords fins.'),
  entree('livres', 'Livres empilés', [.20,.14,.065], 'livres', 'Deux livres empilés, couvertures mates dans la palette de la pièce.'),
  entree('livres-debout', 'Livres sur étagère', [.12,.12,.22], 'livres-debout', 'Petit groupe de livres de hauteurs différentes.'),
  entree('vase', 'Vase en céramique', [.11,.11,.23], 'vase', 'Vase artisanal en céramique, quelques branches légères.'),
  entree('vase-haut', 'Vase haut', [.16,.16,.35], 'vase', 'Vase élancé, terre cuite ou céramique mate.'),
  entree('bougie', 'Bougie', [.07,.07,.09], 'bougie', 'Bougie dans un contenant mat.'),
  entree('bol-fruits', 'Coupe de fruits', [.24,.24,.12], 'bol', 'Coupe basse contenant quelques fruits, composition centrale discrète.'),
  entree('carnet', 'Carnet', [.16,.11,.018], 'livres', 'Carnet fermé sur le bureau.'),
  entree('ordinateur', 'Ordinateur', [.38,.24,.31], 'ordinateur', 'Écran plat avec clavier fin, sans marque ni contenu fictif.'),
  entree('sculpture', 'Objet sculptural', [.10,.10,.17], 'sculpture', 'Petite sculpture abstraite en pierre.'),
  entree('coussin', 'Coussin', [.32,.11,.29], 'coussin', 'Coussin en lin ou velours, assorti à la palette.'),
  entree('plaid', 'Plaid', [.28,.37,.055], 'plaid', 'Plaid plié, drapé sur un accoudoir.'),
  entree('corbeille', 'Corbeille', [.26,.26,.29], 'corbeille', 'Corbeille tressée aux dimensions modestes.'),
  entree('plante-petite', 'Petite plante', [.13,.13,.25], 'plante', 'Petite plante vivante en pot de céramique.'),
  entree('plante-moyenne', 'Plante de console', [.23,.23,.43], 'plante', 'Plante de feuillage dans un pot mat.'),
  entree('plante-haute', 'Plante haute', [.40,.40,1.5], 'plante', 'Plante haute à feuillage léger, en pot, près de la lumière.'),
  entree('lampadaire-decor', 'Lumière d’angle', [.20,.20,1.65], 'lampadaire', 'Lampadaire fin de mise en scène, abat-jour chaleureux.', 'lampadaire'),
  entree('suspension-decor', 'Suspension de mise en scène', [.34,.34,.22], 'suspension', 'Suspension sobre au-dessus du comptoir.', 'suspension'),
  entree('television', 'Télévision de mise en scène', [.97,.20,.61], 'television', 'Écran noir mat sur pieds, point focal face au canapé.', 'tv'),
  entree('television-murale', 'Télévision murale de mise en scène', [.97,.045,.55], 'television', 'Écran noir mat fixé au mur face au canapé.', 'tv-murale'),
  entree('ilot', 'Îlot de cuisine de mise en scène', [2,.95,.92], 'ilot', 'Îlot architectural en bois, plan de travail clair, façades, évier et plaque stylisés.', 'ilot'),
  entree('comptoir', 'Comptoir de bar de mise en scène', [1.5,.55,1.05], 'comptoir', 'Comptoir haut, plan chaleureux et rangement fermé.', 'comptoir'),
  entree('tabouret', 'Tabouret de mise en scène', [.40,.40,.70], 'tabouret', 'Tabouret haut avec repose-pieds ; silhouette de référence, non vendu.', 'tabouret'),
  entree('bouteilles', 'Bouteilles', [.12,.08,.27], 'bouteilles', 'Deux bouteilles sobres, sans marque.'),
  entree('verres', 'Verres', [.15,.07,.12], 'verres', 'Deux verres transparents posés ensemble.'),
  entree('planche', 'Planche à découper', [.23,.16,.02], 'plateau', 'Planche en bois sur le plan de travail.'),
  entree('bouilloire', 'Bouilloire', [.16,.15,.22], 'bouilloire', 'Petit équipement de cuisine stylisé, sans marque.'),
  entree('serviettes', 'Serviettes pliées', [.22,.15,.09], 'plaid', 'Serviettes pliées dans une palette douce.'),
  entree('lattes', 'Mur à lattes de bois', [2,.015,2.3], 'lattes', 'Lattes verticales en bois sur fond mat, segment mural sans ouverture.', 'panneau'),
  entree('lambris', 'Panneaux muraux', [2,.012,2.3], 'lambris', 'Panneaux muraux à cadres sobres, couleur assortie à la pièce.', 'panneau'),
  entree('mur-vegetal', 'Mur végétal', [1.5,.10,2], 'mur-vegetal', 'Petit segment mural de feuillage, jamais derrière la télévision.', 'panneau')
].map(p => [p.id,p])));

const HOTES = {
  salon: ['table-basse','table-appoint','buffet','etagere','etagere-murale','bureau','table-repas','canape','fauteuil'],
  chambre: ['chevet','buffet','etagere','bureau','lit','fauteuil'],
  salle_a_manger: ['table-repas','buffet','vaisselier','etagere'],
  bureau: ['bureau','etagere','etagere-murale','table-appoint','fauteuil'],
  salle_de_bain: ['vasque','etagere','buffet'],
  entree: ['console','etagere','banc'],
  terrasse: ['table-repas','salon-exterieur','table-basse','fauteuil']
};
export const RECETTES_STAGING = Object.freeze(Object.fromEntries(Object.entries(HOTES).map(([fonction, hotes]) => [fonction,
  Object.fromEntries(styles.map(style => [style, { hotes, maxSurface: style === 'epure' ? 2 : ['chaleureux','boheme','audacieux'].includes(style) ? 4 : 3,
    esprit: style === 'epure' ? 'Deux gestes discrets, un seul coussin, peu de contrastes.' : ['chaleureux','boheme'].includes(style) ? 'Céramique, feuillage, textiles et bois chaleureux.' : `${style} : objets de hauteurs variées, palette cohérente.`,
    mur: ['classique','artdeco'].includes(style) ? 'lambris' : 'lattes' }]))
])));
export function styleStaging(envies = '', preferences) {
  return stylesDemandes(envies)[0] || preferences?.styles?.find(id => PROFILS[id]) || 'neutre';
}
export function propDe(id, style = 'neutre', dim) {
  const p = PROPS[id]; if (!p) return null;
  const couleurs = id.startsWith('enc-')?MODELES.styles[style]||MODELES.styles.neutre:['classique','artdeco'].includes(style) ? ['#92734D','#D5C4A3','#384D42']
    : style === 'industriel' ? ['#7B6048','#3D4549','#5F7959']
      : style === 'audacieux' ? ['#AC664F','#DFBC67','#627F68'] : ['#B69773','#D5C6AE','#6A8559'];
  return { ...p, dim: [...(dim || p.dim)], cols: couleurs, style, mat: 'mise-en-scene' };
}
