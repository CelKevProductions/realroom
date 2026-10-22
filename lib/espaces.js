// Choix explicites du client, indépendants du texte de style et du plan proposé par l’IA.
export const ESPACES = ['repas', 'travail', 'lecture', 'musique', 'rangement', 'cuisine', 'bar'];
export const ESPACES_PAR_FONCTION = {
  salon: ESPACES, chambre: ['travail', 'lecture', 'musique'], salle_a_manger: ['rangement'],
  bureau: ['lecture', 'musique', 'rangement'], entree: ['rangement'], terrasse: ['repas']
};
export const normaliserEspaces = espaces => Array.isArray(espaces)
  ? ESPACES.filter(id => espaces.includes(id)) : undefined;
export const normaliserPlaces = places => [2, 4, 6, 8, 10].includes(places) ? places : undefined;

export function intentionsEspaces(envies = '') {
  const brief = String(envies).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const motifs = { repas: 'repas|(?:table|salle) a manger|dining', travail: 'bureau|travail|office|desk', lecture: 'lecture|reading', rangement: 'rangement|buffet|storage', cuisine:'cuisine|ilot|kitchen|island', bar:'bar|comptoir|counter' };
  const refus = id => new RegExp(`(?:sans|pas de|ni|without|no)\\s+(?:coin\\s+|espace\\s+)?(?:${motifs[id]})`).test(brief);
  const demandes = ESPACES.filter(id => new RegExp(`\\b(?:${motifs[id]})\\b`).test(brief) && !refus(id));
  if (/recevoir|recois/.test(brief) && !refus('repas') && !demandes.includes('repas')) demandes.push('repas');
  const nombre = brief.match(/\b(2|4|6|8|10)\s*(?:places|personnes|convives|seats|people)\b/);
  return { demandes, refus, placesRepas: nombre ? +nombre[1] : undefined };
}

