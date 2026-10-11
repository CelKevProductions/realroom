const FR = { canape: 'canapé', 'table-basse': 'table basse', 'meuble-tv': 'meuble TV', 'lumiere-salon': 'éclairage du salon', 'fauteuil-salon': 'fauteuil du salon', 'fauteuil-lecture': 'fauteuil de lecture', 'table-repas': 'table de repas', 'chaise-repas': 'chaises de repas', 'table-appoint': 'table d’appoint', 'lumiere-lecture': 'éclairage de lecture', lit: 'lit', chevet: 'chevets', 'lampe-chevet': 'lampes de chevet', armoire: 'armoire', bureau: 'bureau', 'chaise-bureau': 'siège de bureau', 'lampe-bureau': 'lampe de bureau', 'baignoire-ilot': 'baignoire îlot', 'baignoire-murale': 'baignoire murale', vasque: 'vasque', 'seche-serviettes': 'sèche-serviettes', 'salon-exterieur': 'salon de jardin', etagere: 'étagère', buffet: 'buffet', suspension: 'suspension', console: 'console', miroir: 'miroir', transat: 'transat' };
const EN = { canape: 'sofa', 'table-basse': 'coffee table', 'meuble-tv': 'TV unit', 'lumiere-salon': 'living area lighting', 'fauteuil-salon': 'lounge chair', 'fauteuil-lecture': 'reading chair', 'table-repas': 'dining table', 'chaise-repas': 'dining chairs', 'table-appoint': 'side table', 'lumiere-lecture': 'reading light', lit: 'bed', chevet: 'bedside tables', 'lampe-chevet': 'bedside lights', armoire: 'wardrobe', bureau: 'desk', 'chaise-bureau': 'desk chair', 'lampe-bureau': 'desk lamp', 'baignoire-ilot': 'freestanding bath', 'baignoire-murale': 'wall-mounted bath', vasque: 'washbasin', 'seche-serviettes': 'towel rail', 'salon-exterieur': 'outdoor seating', etagere: 'shelves', buffet: 'sideboard', suspension: 'pendant', console: 'console', miroir: 'mirror', transat: 'sunbed' };
Object.assign(FR, { television:'télévision', 'tableau-principal':'tableau principal', 'tableau-secondaire':'décoration murale', 'etagere-murale':'étagère murale', 'eclairage-accueil':'éclairage de l’entrée' });
Object.assign(EN, { television:'television', 'tableau-principal':'main wall art', 'tableau-secondaire':'wall decoration', 'etagere-murale':'wall shelf', 'eclairage-accueil':'entrance lighting' });
export const intituleUsage = (usage, langue = 'fr') => (langue === 'en' ? EN : FR)[usage] || usage.replaceAll('-', ' ');

export function manquesParEspace(programme, langue = 'fr') {
  const en = langue === 'en', motifs = en
    ? { catalogue: 'no suitable product available', budget: 'furniture budget too low', selection: 'no compatible product retained for this use', 'surface-ou-acces': 'not enough usable space while keeping access clear', 'mur-ou-hauteur': 'no suitable wall or mounting height' }
    : { catalogue: 'aucun produit adapté disponible', budget: 'budget mobilier insuffisant', selection: 'aucun produit compatible retenu pour cet usage', 'surface-ou-acces': 'espace utilisable insuffisant en préservant les accès', 'mur-ou-hauteur': 'mur ou hauteur de pose indisponible' };
  return (programme?.zones || []).map(zone => {
    const absents = (programme.manquants || []).filter(s => s.obligatoire && s.zone === zone.id);
    const usages = [...new Set(absents.map(s => s.usage))];
    return { zone: zone.id, libelle: en ? ({ repas: 'Dining area', salon: 'Living area', travail: 'Work area', lecture: 'Reading corner', rangement: 'Storage', couchage: 'Sleeping area' }[zone.id] || zone.id) : zone.id === 'repas' ? 'Coin repas' : zone.libelle,
      pieces: usages.map(u => { const n = absents.filter(s => s.usage === u).length; return `${intituleUsage(u, langue)}${n > 1 ? ` (×${n})` : ''}`; }).join(', '),
      raisons: [...new Set(absents.map(s => motifs[s.motif] || motifs['surface-ou-acces']))].join(' ; ') };
  }).filter(z => z.pieces);
}
