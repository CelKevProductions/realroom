import { boite } from './agencement.js';
export const intersectionZones = (a, b, marge = 0) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + marge) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) + marge);
export function dansZone(it, p, zone) {
  if (!zone || !p) return true;
  const b = boite(it, p.dim), eps = .012;
  return b.x0 >= zone.x0 - eps && b.x1 <= zone.x1 + eps && b.z0 >= zone.z0 - eps && b.z1 <= zone.z1 + eps;
}
export function zoneDe(it, plan) { return plan?.zones?.find(z => z.id === it.zoneId); }
