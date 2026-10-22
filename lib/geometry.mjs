export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const signedArea = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
export const bounds = (p) => ({
  minX: Math.min(...p.map((a) => a[0])),
  maxX: Math.max(...p.map((a) => a[0])),
  minZ: Math.min(...p.map((a) => a[1])),
  maxZ: Math.max(...p.map((a) => a[1])),
});
export function project(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = clamp(
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1),
      0,
      1,
    );
  const point = [a[0] + t * dx, a[1] + t * dz];
  return { point, t, distance: distance(p, point) };
}
export function inside(p, poly, edge = true) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (project(p, a, b).distance < 1e-7) return edge;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function crosses(a, b, c, d) {
  return (
    cross(a, b, c) * cross(a, b, d) < -1e-10 &&
    cross(c, d, a) * cross(c, d, b) < -1e-10
  );
}
export function validPolygon(poly) {
  if (
    !Array.isArray(poly) ||
    poly.length < 3 ||
    poly.length > 128 ||
    !poly.every(
      (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
    )
  )
    return false;
  if (Math.abs(signedArea(poly)) < 1) return false;
  for (let i = 0; i < poly.length; i++) {
    if (distance(poly[i], poly[(i + 1) % poly.length]) < 0.01) return false;
    for (let j = i + 1; j < poly.length; j++)
      if (
        j !== i + 1 &&
        !(i === 0 && j === poly.length - 1) &&
        (crosses(
          poly[i],
          poly[(i + 1) % poly.length],
          poly[j],
          poly[(j + 1) % poly.length],
        ) ||
          project(poly[i], poly[j], poly[(j + 1) % poly.length]).distance <
            1e-6 ||
          project(
            poly[(i + 1) % poly.length],
            poly[j],
            poly[(j + 1) % poly.length],
          ).distance < 1e-6)
      )
        return false;
  }
  return true;
}
export function walls(room) {
  const p = room.polygon,
    s = signedArea(p) > 0 ? 1 : -1;
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length],
      length = distance(a, b),
      dx = (b[0] - a[0]) / length,
      dz = (b[1] - a[1]) / length;
    return {
      id: i,
      a,
      b,
      length,
      d: [dx, dz],
      n: [-dz * s, dx * s],
      rotation: Math.atan2(-dz, dx),
    };
  });
}
export function openingFrame(room, o) {
  const w = walls(room)[o.wall];
  const offset = clamp(o.offset, 0, w.length);
  const c = [w.a[0] + w.d[0] * offset, w.a[1] + w.d[1] * offset];
  return {
    ...w,
    c,
    a: [c[0] - (w.d[0] * o.width) / 2, c[1] - (w.d[1] * o.width) / 2],
    b: [c[0] + (w.d[0] * o.width) / 2, c[1] + (w.d[1] * o.width) / 2],
  };
}
export function rectangle(x, z, w, d, rotation = 0) {
  const r = (rotation * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([a, b]) => [x + a * c + b * s, z - a * s + b * c]);
}
export function footprint(item, product, padding = 0) {
  return rectangle(
    item.x,
    item.z,
    product.dim[0] + 2 * padding,
    product.dim[1] + 2 * padding,
    item.rotation || 0,
  );
}
export function overlap(a, b, tolerance = 0.005) {
  for (const p of [a, b])
    for (let i = 0; i < p.length; i++) {
      const q = p[(i + 1) % p.length],
        v = [q[1] - p[i][1], p[i][0] - q[0]],
        length = Math.hypot(...v);
      const pa = a.map((x) => (x[0] * v[0] + x[1] * v[1]) / length),
        pb = b.map((x) => (x[0] * v[0] + x[1] * v[1]) / length);
      if (
        Math.min(Math.max(...pa), Math.max(...pb)) -
          Math.max(Math.min(...pa), Math.min(...pb)) <=
        tolerance
      )
        return false;
    }
  return true;
}
export function contained(shape, poly) {
  if (shape.some((p) => !inside(p, poly))) return false;
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i],
      b = shape[(i + 1) % shape.length];
    if (!inside([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], poly)) return false;
    for (let j = 0; j < poly.length; j++)
      if (crosses(a, b, poly[j], poly[(j + 1) % poly.length])) return false;
  }
  return true;
}
export function polygonDistance(p, poly) {
  return inside(p, poly)
    ? 0
    : Math.min(
        ...poly.map(
          (a, i) => project(p, a, poly[(i + 1) % poly.length]).distance,
        ),
      );
}
export function wallDistance(p, poly) {
  return Math.min(
    ...poly.map((a, i) => project(p, a, poly[(i + 1) % poly.length]).distance),
  );
}
export function doorZone(room, o) {
  const f = openingFrame(room, o);
  const depth =
    o.swing === "sliding" ? 0.4 : o.swing === "outward" ? 0.45 : o.width + 0.06;
  return [
    f.a,
    f.b,
    [f.b[0] + f.n[0] * depth, f.b[1] + f.n[1] * depth],
    [f.a[0] + f.n[0] * depth, f.a[1] + f.n[1] * depth],
  ];
}
