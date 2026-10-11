import { familleReleve, usageDe } from './usages.js';

// La famille commerciale reste intacte. Le rôle contextualise une pièce réellement adaptée
// à un emplacement (une petite table basse peut aussi servir de chevet).
export function roleDe(p) {
  if (usageDe(p) === 'travail') return 'bureau';
  if (usageDe(p) === 'chevet') return 'appoint';
  if (familleReleve({ ...p, famille: p.fam }) === 'radiateur') return 'radiateur';
  if (p.fam === 'table') {
    if (/chevet|bedside|appoint|side table/i.test([p.nom, p.st, p.titre].join(' '))) return 'appoint';
    return p.dim[2] < .59 ? 'table-basse' : 'repas';
  }
  if (['armoire', 'dressing', 'commode', 'buffet', 'bibliotheque', 'etagere', 'meuble'].includes(p.fam)) return 'rangement';
  return p.fam;
}

const ROLES = { 'table-basse': 'table-basse', chevet: 'appoint', 'table-appoint': 'appoint',
  'table-repas': 'repas', 'chaise-repas': 'chaise', 'chaise-bureau': 'chaise', bureau: 'bureau',
  'meuble-tv': 'rangement', armoire: 'rangement', buffet: 'rangement', console: 'rangement' };
export function roleFonctionDe(it, p) { return ROLES[it.usageProgramme] || roleDe(p); }
