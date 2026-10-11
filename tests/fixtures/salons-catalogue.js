// Pièce synthétique en L : 90 m² dans une enveloppe de 10 × 14 m.
// Aucune géométrie ni ouverture ne vient d'un relevé client.
import { segmentsDe } from '../../lib/contour.js';

export function salonConcave() {
  const modele = { dims: { largeur: 10, profondeur: 14, hauteur: 2.7, estimees: true },
    contour: [[-5, -7], [5, -7], [5, -3], [0, -3], [0, 7], [-5, 7]],
    murs: {}, sol: { matiere: 'parquet', couleur: '#C7AD86' } };
  const pans = segmentsDe(modele);
  for (const pan of pans) modele.murs[pan.id] = { ouvertures: [], couleur: '#EFEAE2', observe: true };
  modele.murs[pans[0].id].ouvertures.push({ type: 'porte', position: -3.5, largeur: .9, hauteur: 2.04, allege: 0 });
  modele.murs[pans[4].id].ouvertures.push({ type: 'porte', position: 0, largeur: .9, hauteur: 2.04, allege: 0 });
  modele.murs[pans[2].id].ouvertures.push({ type: 'fenetre', position: 0, largeur: 1.4, hauteur: 1.2, allege: .9 });
  modele.murs[pans[5].id].ouvertures.push({ type: 'fenetre', position: 3, largeur: 1.4, hauteur: 1.2, allege: .9 });
  return modele;
}
