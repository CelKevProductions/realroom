// Résumé du passage par ReSpace d'une proposition (variante « respace », ou réaménagement par
// l'IA repris par ReSpace). Sans dépendance serveur : l'atelier s'en sert aussi.
export const bilanRespace = proposition => {
  const m = proposition?.moteur;
  const b = m?.type === 'respace' ? m : m?.respace;
  return b ? { places: b.places, total: b.total, brut: !!b.brut, nonPoses: b.nonPoses || [] } : null;
};
