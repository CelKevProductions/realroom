// Premiers patrons paramétriques RealRoom : points de départ, pas des plans certifiés
// par un décorateur. Les produits et le score sont indépendants ; le solveur revalide tout.
import { affiniteReference } from './references-styles.js';
import { demiEmpreinte, normaliserAngle } from './agencement.js';

export const PATRONS = Object.freeze([
  { id: 'chambre-axiale', role: 'lit', mur: 'fond', decalage: 0, secondaire: 'droite' },
  { id: 'chambre-decalee', role: 'lit', mur: 'fond', decalage: -.5, secondaire: 'droite' },
  { id: 'chambre-laterale', role: 'lit', mur: 'gauche', decalage: 0, secondaire: 'fond' },
  { id: 'salon-focal', role: 'canape', mur: 'fond', decalage: 0, focal: true },
  { id: 'salon-conversation', role: 'canape', mur: 'fond', decalage: 0, conversation: true },
  { id: 'salon-lateral', role: 'canape', mur: 'gauche', decalage: .3, conversation: true },
  { id: 'repas-central', role: 'repas', central: true, rot: 0, secondaire: 'fond' },
  { id: 'repas-longitudinal', role: 'repas', central: true, rot: Math.PI / 2, secondaire: 'droite' },
  { id: 'bureau-lateral', role: 'bureau', mur: 'gauche', decalage: -.3, secondaire: 'fond' }
]);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rond = n => Math.round(n * 100) / 100;
const ROTATIONS = { fond: 0, gauche: Math.PI / 2, entree: Math.PI, droite: -Math.PI / 2 };

function auMur(e, mur, decalage, dims) {
  const rot = ROTATIONS[mur], [hx, hz] = demiEmpreinte(e.p.dim, rot), L = dims.largeur, P = dims.profondeur;
  if (2 * hx > L || 2 * hz > P) return null;
  const lateral = ['gauche', 'droite'].includes(mur);
  return { rot, x: rond(lateral ? (mur === 'gauche' ? -1 : 1) * (L / 2 - hx - .03) : decalage * Math.max(0, L / 2 - hx - .6)),
    z: rond(lateral ? decalage * Math.max(0, P / 2 - hz - .6) : (mur === 'fond' ? -1 : 1) * (P / 2 - hz - .03)) };
}

// Affinités éditoriales : le classement des départs change, les règles et les alternatives restent communes.
export function affinitePatron(id, preferences = {}) {
  const styles = preferences.styles || [preferences.style];
  let note = 0;
  if (styles.includes('classique') || styles.includes('artdeco') || preferences.composition === 'symetrie') note += /axiale|central/.test(id) ? 3 : 0;
  if (styles.some(s => ['chaleureux', 'boheme', 'mediterraneen'].includes(s)) || preferences.composition === 'conversation') note += /conversation|decalee/.test(id) ? 3 : 0;
  if (styles.some(s => ['epure', 'japandi', 'scandinave'].includes(s))) note += /axiale|focal|lateral/.test(id) ? 2 : 0;
  return note+affiniteReference(id,styles);
}
export function instancierPatrons(modele, mobiles, tous, preferences = {}) {
  const dims = modele.dims, resultats = [];
  for (const patron of PATRONS) {
    const ancre = mobiles.find(e => e.role === patron.role);
    if (!ancre) continue;
    let position = patron.central ? { x: 0, z: 0, rot: patron.rot } : auMur(ancre, patron.mur, patron.decalage, dims);
    if (!position) continue;
    if (patron.focal) {
      const tv = tous.find(e => ['tv', 'tv-murale'].includes(e.p.fam));
      if (!tv) continue;
      const rot = normaliserAngle((tv.it.rot || 0) + Math.PI), distance = clamp(tv.p.dim[0] * 2.1, 1.8, 3.5);
      const [hx, hz] = demiEmpreinte(ancre.p.dim, rot);
      if (2 * hx > dims.largeur || 2 * hz > dims.profondeur) continue;
      position = { rot, x: rond(clamp(tv.it.x + Math.sin(tv.it.rot || 0) * distance, -dims.largeur / 2 + hx, dims.largeur / 2 - hx)),
        z: rond(clamp(tv.it.z + Math.cos(tv.it.rot || 0) * distance, -dims.profondeur / 2 + hz, dims.profondeur / 2 - hz)) };
    }
    const slots = [{ id: ancre.it.id, position }];
    if (patron.secondaire) {
      const rangement = mobiles.find(e => e.role === 'rangement');
      const bureau = patron.role === 'lit' && mobiles.find(e => e.role === 'bureau');
      for (const [e, offset] of [[rangement, -.55], [bureau, .55]]) {
        if (!e) continue;
        const p = auMur(e, patron.secondaire, offset, dims);
        if (p) slots.push({ id: e.it.id, position: p });
      }
    }
    if (patron.conversation) {
      mobiles.filter(e => e.role === 'fauteuil').slice(0, 2).forEach((e, i) => {
        const r = position.rot, cote = i ? 1 : -1, dx = cote * (ancre.p.dim[0] / 2 + .85), dz = .7;
        const x = position.x + Math.cos(r) * dx + Math.sin(r) * dz, z = position.z - Math.sin(r) * dx + Math.cos(r) * dz;
        const rot = normaliserAngle(Math.atan2(position.x - x, position.z - z));
        const [hx, hz] = demiEmpreinte(e.p.dim, rot);
        if (2 * hx > dims.largeur || 2 * hz > dims.profondeur) return;
        slots.push({ id: e.it.id, position: { rot, x: rond(clamp(x, -dims.largeur / 2 + hx, dims.largeur / 2 - hx)),
          z: rond(clamp(z, -dims.profondeur / 2 + hz, dims.profondeur / 2 - hz)) } });
      });
    }
    resultats.push({ id: patron.id, affinite: affinitePatron(patron.id, preferences), slots });
  }
  return resultats.sort((a, b) => b.affinite - a.affinite);
}
