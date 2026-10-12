// Références indépendantes, aucune géométrie provenant d'un plan client.
import { salonConcave } from './salons-catalogue.js';
export function sejour89() {
  const m=salonConcave();m.contour[2][1]=m.contour[3][1]=-3.2;
  m.dims.estimees=false;return m;
}
