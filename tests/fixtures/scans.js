import { VERSION_SCAN } from '../../lib/scan.js';

export function matrice(x, y, z, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1];
}
export function scanApple() {
  const el = (id, category, size, pos, rot = 0) => ({ id, category, size, transform: matrice(...pos, rot), confidence: 'high' });
  return { version: VERSION_SCAN, source: 'apple-roomplan', unit: 'm', walls: [
    el('w1', 'wall', [4, 2.6, 0], [0, 1.3, 2.5]), el('w2', 'wall', [4, 2.6, 0], [0, 1.3, -2.5]),
    el('w3', 'wall', [5, 2.6, 0], [-2, 1.3, 0], Math.PI / 2), el('w4', 'wall', [5, 2.6, 0], [2, 1.3, 0], Math.PI / 2)
  ], openings: [el('door', 'door', [.9, 2.04, 0], [-1.25, 1.02, 2.5]), el('window', 'window', [1.2, 1.2, 0], [.3, 1.5, -2.5])],
  objects: [el('bed', 'bed', [1.4, 1, 1.6], [0, .5, -.8]), el('storage', 'storage', [1, .8, .4], [1.4, .4, .6], -Math.PI / 2)] };
}
export function scanAndroid() {
  return { version: VERSION_SCAN, source: 'android-arcore-webxr', unit: 'm',
    floorCorners: [[-2, -.8, 2.5], [2, -.8, 2.5], [2, -.8, -2.5], [-2, -.8, -2.5]], ceilingHeight: null };
}
