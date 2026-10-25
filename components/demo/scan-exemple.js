// Pièce d'exemple de la démo : un séjour de 29 m² avec cuisine ouverte, au format d'un relevé
// RoomPlan (murs, portes, fenêtres, meubles). Elle passe par la même lecture qu'un vrai scan.
// Les sections (« livingRoom », « kitchen », « diningRoom ») imitent celles d'un CapturedStructure.
import { VERSION_SCAN } from '@/lib/scan.js';

// matrice colonne majeure : rotation autour de la verticale (angle a) puis position
const pose = (a, x, y, z) => { const c = Math.round(Math.cos(a) * 1e6) / 1e6, s = Math.round(Math.sin(a) * 1e6) / 1e6; return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1]; };
const E = Math.PI / 2;
const el = (category, size, transform) => ({ category, size, transform, confidence: 'high' });

export function scanExemple() {
  const L = 6.4, P = 4.6, H = 2.6;
  return {
    version: VERSION_SCAN, source: 'apple-roomplan', unit: 'm',
    sections: [{ label: 'livingRoom' }, { label: 'kitchen' }, { label: 'diningRoom' }],
    walls: [
      el('wall', [L, H, 0], pose(0, 0, H / 2, -P / 2)),
      el('wall', [L, H, 0], pose(0, 0, H / 2, P / 2)),
      el('wall', [P, H, 0], pose(E, -L / 2, H / 2, 0)),
      el('wall', [P, H, 0], pose(E, L / 2, H / 2, 0))
    ],
    openings: [
      el('door', [0.9, 2.05, 0], pose(0, -0.2, 1.025, P / 2)),
      el('window', [1.4, 1.35, 0], pose(0, -1.7, 0.9 + 0.675, -P / 2)),
      el('window', [1.2, 1.35, 0], pose(0, 1.1, 0.9 + 0.675, -P / 2))
    ],
    objects: [
      // salon : canapé tourné vers la télévision murale, fauteuil, table basse, meuble bas
      el('sofa', [2.2, 0.85, 0.95], pose(-E, -1.2, 0.425, 0.1)),
      el('sofa', [0.85, 0.8, 0.85], pose(0, -2.3, 0.4, -1.55)),
      el('table', [1.0, 0.4, 0.5], pose(-E, -2.25, 0.2, 0.1)),
      el('storage', [1.8, 0.55, 0.4], pose(E, -L / 2 + 0.2, 0.275, 0.1)),
      el('television', [1.25, 0.72, 0.08], pose(E, -L / 2 + 0.05, 1.32, 0.1)),
      // coin repas : table et quatre chaises
      el('table', [1.6, 0.75, 0.9], pose(0, 0.9, 0.375, 0.2)),
      el('chair', [0.45, 0.85, 0.5], pose(0, 0.5, 0.425, -0.5)),
      el('chair', [0.45, 0.85, 0.5], pose(0, 1.3, 0.425, -0.5)),
      el('chair', [0.45, 0.85, 0.5], pose(Math.PI, 0.5, 0.425, 0.9)),
      el('chair', [0.45, 0.85, 0.5], pose(Math.PI, 1.3, 0.425, 0.9)),
      // cuisine ouverte le long du mur de droite
      el('refrigerator', [0.6, 1.85, 0.65], pose(-E, L / 2 - 0.33, 0.925, -1.9)),
      el('dishwasher', [0.6, 0.85, 0.6], pose(-E, L / 2 - 0.3, 0.425, -1.2)),
      el('sink', [0.8, 0.9, 0.6], pose(-E, L / 2 - 0.3, 0.45, -0.5)),
      el('stove', [0.6, 0.9, 0.6], pose(-E, L / 2 - 0.3, 0.45, 0.25))
    ]
  };
}
