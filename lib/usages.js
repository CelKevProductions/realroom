// Fonctions de la pièce, distinctes du style commercial et des familles de maquettes.
const normaliser = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const descriptionDe = p => normaliser([p?.nom, p?.titre, p?.st, p?.texte, ...(p?.points || []).map(x => x[1])].join(' '));

export function familleReleve(m) {
  const nom = normaliser(m.nom);
  if (m.famille === 'autre' && /radiateur|radiator|convecteur/.test(nom)) return 'radiateur';
  if (m.famille === 'autre' && /cheminee|fireplace/.test(nom)) return 'cheminee';
  if (m.famille === 'autre' && /cuisine integree|cuisine equipee|fitted kitchen/.test(nom)) return 'cuisine';
  if (m.famille === 'tv' && m.contre_mur && Number.isFinite(m.hauteur_pose) && m.hauteur_pose > .6) return 'tv-murale';
  return m.famille;
}

export function estInstallation(it) {
  if (it.origine !== 'existant') return false;
  const fam = familleReleve({ ...it.p, famille: it.p?.fam });
  return ['radiateur', 'cheminee', 'cuisine'].includes(fam);
}

export function usageDe(p) {
  if (!p) return null;
  const texte = descriptionDe(p);
  if (p.fam === 'lit') return 'couchage';
  if (['tv', 'tv-murale'].includes(p.fam)) return 'television';
  if (p.fam === 'bureau' || /coiffeuse|dressing table|vanity desk|writing desk/.test(texte)) return 'travail';
  if (p.fam === 'chevet' || /chevet|bedside|nightstand|table d.appoint|side table/.test(texte)) return 'chevet';
  if (['armoire', 'dressing'].includes(p.fam)) return 'vetements';
  if (['commode', 'meuble', 'buffet', 'etagere', 'bibliotheque'].includes(p.fam)) return 'rangement';
  return null;
}

// Une fonction explicitement abandonnée par le client ne doit pas être réintroduite.
export function abandonExplicite(usage, envies) {
  const mots = { couchage: 'lit|bed', rangement: 'rangement|commode|buffet|storage|dresser', vetements: 'armoire|dressing|wardrobe', travail: 'bureau|coiffeuse|desk|vanity', television: 'television|tv' };
  const cible = new RegExp(`\\b(?:${mots[usage] || '(?!)'})\\b`, 'i');
  return normaliser(envies).split(/[.;\n]/).some(phrase => {
    // Au moindre doute ou à la négation d'une suppression, conserver la fonction.
    if (/\b(ne|pas|jamais|not|never|don.t|conserv\w*|gard\w*|keep)\b/.test(phrase)) return false;
    const demande = /\b(?:sans|supprim\w*|retir\w*|enlev\w*|remove|without|no)\s+(.{1,140})/.exec(phrase);
    return Boolean(demande && cible.test(demande[1]));
  });
}
