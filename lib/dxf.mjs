import DxfParser from "dxf-parser";
import {
  bounds,
  signedArea,
  distance,
  validPolygon,
  walls,
  project,
  clamp,
  footprint,
  openingFrame,
} from "./geometry.mjs";
import { CATALOG } from "./catalog.mjs";
const UNITS = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 };
const UNIT_IDS = { 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" };
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
const isRoom = (s) =>
  /(^|[-_ ])(ROOMS?|PIECES?|FLOORS?|SOLS?|CONTOUR)([-_ ]|$)/.test(norm(s));
const isDoor = (s) => /(DOOR|PORTE|OUVERTURE_P)/.test(norm(s));
const isWindow = (s) => /(WINDOW|FENETRE|VITRAGE|BAIE)/.test(norm(s));
const ignored = (s) =>
  /(DIMENSION|COTE|FURNITURE|MEUBLE|TEXT|ANNOT|HATCH)/.test(norm(s));
function flatten(doc) {
  const result = [],
    warnings = [];
  let count = 0;
  const visit = (
    entities,
    transform = (p) => p,
    parentLayer = "",
    parentName = "",
    depth = 0,
  ) => {
    if (depth > 6) throw Error("Blocs DXF imbriqués trop profondément.");
    for (const e of entities || []) {
      if (++count > 25000)
        throw Error(
          "Ce DXF contient trop d’éléments. Exportez la pièce seule.",
        );
      const layer = !e.layer || e.layer === "0" ? parentLayer || "0" : e.layer;
      if (e.type === "INSERT") {
        const block = doc.blocks?.[e.name];
        if (!block) {
          warnings.push("Bloc introuvable : " + e.name);
          continue;
        }
        if ((e.rowCount || 1) > 1 || (e.columnCount || 1) > 1) {
          warnings.push("Réseau de blocs ignoré : " + e.name);
          continue;
        }
        const angle = ((e.rotation || 0) * Math.PI) / 180,
          c = Math.cos(angle),
          s = Math.sin(angle),
          sx = e.xScale ?? 1,
          sy = e.yScale ?? 1,
          base = block.position || { x: 0, y: 0 },
          pos = e.position || { x: 0, y: 0 };
        const t = (p) =>
          transform({
            x: pos.x + (p.x - base.x) * sx * c - (p.y - base.y) * sy * s,
            y: pos.y + (p.x - base.x) * sx * s + (p.y - base.y) * sy * c,
          });
        visit(block.entities, t, layer, parentName + " " + e.name, depth + 1);
        continue;
      }
      if (e.extrusionDirectionZ === -1 || e.extrusionDirection?.z === -1) {
        warnings.push("Entité dans un repère OCS inversé ignorée.");
        continue;
      }
      const out = { ...e, layer, semantic: layer + " " + parentName };
      if (e.vertices) {
        if (e.vertices.some((v) => v.bulge)) {
          warnings.push(
            "Polyligne courbe ignorée ; fournir un contour linéaire ou segmenté.",
          );
          continue;
        }
        out.points = e.vertices.map(transform).map((p) => [p.x, p.y]);
      }
      if (e.type === "ARC") {
        const n = 24,
          start = e.startAngle,
          end = e.endAngle < start ? e.endAngle + Math.PI * 2 : e.endAngle;
        out.points = Array.from({ length: n + 1 }, (_, i) => {
          const a = start + ((end - start) * i) / n;
          const p = transform({
            x: e.center.x + e.radius * Math.cos(a),
            y: e.center.y + e.radius * Math.sin(a),
          });
          return [p.x, p.y];
        });
        const center = transform(e.center);
        out.center = [center.x, center.y];
      }
      if (out.points?.length) result.push(out);
    }
  };
  visit(doc.entities);
  return { entities: result, warnings: [...new Set(warnings)] };
}
function wallLoops(es, f) {
  const segs = es
    .filter((e) => e.type === "LINE" && /(WALL|MUR)/.test(norm(e.layer)))
    .map((e) => ({ a: e.points[0], b: e.points[1], layer: e.layer }));
  const loops = [];
  if (segs.length > 2000) return loops;
  while (segs.length) {
    const seg = segs.shift(),
      p = [seg.a, seg.b];
    for (let j = 0; j < 256; j++) {
      if (distance(p[0], p.at(-1)) * f < 0.015) {
        p.pop();
        if (p.length >= 3) loops.push({ points: p, layer: seg.layer });
        break;
      }
      const hits = [];
      segs.forEach((s, i) => {
        if (distance(p.at(-1), s.a) * f < 0.015) hits.push({ i, end: s.b });
        if (distance(p.at(-1), s.b) * f < 0.015) hits.push({ i, end: s.a });
      });
      if (hits.length !== 1) break;
      p.push(hits[0].end);
      segs.splice(hits[0].i, 1);
    }
  }
  return loops;
}
export function parseDXF(
  text,
  { unit, roomLayer, doorLayer, windowLayer } = {},
) {
  if (typeof text !== "string" || text.length > 8e6)
    throw Error("Choisissez un fichier DXF ASCII de moins de 8 Mo.");
  if (text.startsWith("AutoCAD Binary DXF"))
    throw Error("Le DXF binaire doit être réexporté en DXF ASCII.");
  if (!/\bEOF\s*$/.test(text.trim()))
    throw Error("Le DXF est incomplet (fin EOF absente).");
  let doc;
  try {
    doc = new DxfParser().parseSync(text);
  } catch {
    throw Error("Ce DXF ne peut pas être lu. Réexportez un DXF 2D ASCII.");
  }
  const { entities, warnings } = flatten(doc),
    layers = [...new Set(entities.map((e) => e.layer))];
  const units = unit || UNIT_IDS[doc.header?.$INSUNITS];
  if (!UNITS[units])
    return {
      units: null,
      rooms: [],
      layers,
      warnings: [
        "Le DXF ne déclare pas ses unités. Choisissez-les explicitement.",
      ],
    };
  const f = UNITS[units],
    metric = (p) => [p[0] * f, -p[1] * f];
  let polys = entities.filter(
    (e) =>
      ["LWPOLYLINE", "POLYLINE"].includes(e.type) &&
      (e.shape || distance(e.points[0], e.points.at(-1)) * f < 0.01) &&
      !ignored(e.layer),
  );
  if (roomLayer) polys = polys.filter((e) => e.layer === roomLayer);
  else if (polys.some((e) => isRoom(e.layer)))
    polys = polys.filter((e) => isRoom(e.layer));
  if (!polys.length) polys = wallLoops(entities, f);
  if (!polys.length)
    return {
      units,
      rooms: [],
      layers,
      warnings: [
        ...warnings,
        "Aucun contour fermé trouvé. Choisissez le calque du contour ou exportez une polyligne fermée sur le calque ROOM. Les murs interrompus par une porte ne sont pas refermés automatiquement.",
      ],
    };
  const openingEntities = entities.filter(
    (e) =>
      (doorLayer ? e.layer === doorLayer : isDoor(e.semantic)) ||
      (windowLayer ? e.layer === windowLayer : isWindow(e.semantic)),
  );
  const rooms = [];
  for (const [index, poly] of polys.entries()) {
    let p = poly.points.map(metric);
    if (distance(p[0], p.at(-1)) < 0.01) p.pop();
    if (!validPolygon(p)) continue;
    const bb = bounds(p);
    if (
      bb.maxX - bb.minX > 35 ||
      bb.maxZ - bb.minZ > 35 ||
      Math.abs(signedArea(p)) > 600
    )
      continue;
    const origin = [(bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2];
    p = p.map((q) => [q[0] - origin[0], q[1] - origin[1]]);
    const room = {
      id: "room-" + index,
      name: "Pièce " + (rooms.length + 1),
      polygon: p,
      height: 2.6,
      openings: [],
      source: { format: "DXF", units, layer: poly.layer, origin },
      verified: false,
    };
    const ws = walls(room);
    for (const e of openingEntities) {
      const points = e.points
          .map(metric)
          .map((q) => [q[0] - origin[0], q[1] - origin[1]]),
        type = (windowLayer ? e.layer === windowLayer : isWindow(e.semantic))
          ? "window"
          : "door";
      let best = null;
      for (const w of ws) {
        let projections = points.map((q) => project(q, w.a, w.b)),
          near = projections.filter((q) => q.distance < 0.13);
        if (e.type === "ARC" && e.center) {
          const center = metric(e.center).map((v, i) => v - origin[i]);
          const hinge = project(center, w.a, w.b);
          const endpoint = projections
            .filter((q) => q.distance < 0.12)
            .sort(
              (a, b) => Math.abs(b.t - hinge.t) - Math.abs(a.t - hinge.t),
            )[0];
          near = endpoint ? [hinge, endpoint] : [];
        }
        if (near.length < 2) continue;
        const start = Math.min(...near.map((q) => q.t)) * w.length,
          end = Math.max(...near.map((q) => q.t)) * w.length,
          width = end - start;
        if (width < 0.3 || width > 5) continue;
        const score = near.length / points.length;
        if (!best || score > best.score)
          best = { score, wall: w.id, offset: (start + end) / 2, width };
      }
      if (
        best &&
        !room.openings.some(
          (o) =>
            o.type === type &&
            o.wall === best.wall &&
            Math.abs(o.offset - best.offset) < 0.15 &&
            Math.abs(o.width - best.width) < 0.2,
        )
      )
        room.openings.push({
          id: "opening-" + index + "-" + room.openings.length,
          type,
          wall: best.wall,
          offset: best.offset,
          width: best.width,
          height: type === "door" ? 2.1 : 1.3,
          sill: type === "door" ? 0 : 0.9,
          swing: type === "door" ? "unknown" : "fixed",
          hinge: "start",
          inferred: true,
        });
    }
    rooms.push(room);
  }
  if (!rooms.length)
    throw Error(
      "Aucun contour métrique valide. Vérifiez les unités et le calque de la pièce.",
    );
  if (!openingEntities.length)
    warnings.push(
      "Aucune porte ni fenêtre reconnue : associez leurs calques ou ajoutez-les dans la vérification du plan.",
    );
  warnings.push(
    "Hauteur sous plafond, allèges et sens d’ouverture sont à confirmer : un DXF 2D ne les décrit pas toujours.",
  );
  return {
    units,
    rooms: rooms.sort(
      (a, b) =>
        Math.abs(signedArea(b.polygon)) - Math.abs(signedArea(a.polygon)),
    ),
    layers,
    warnings,
  };
}
export function exportDXF(room, scene = null) {
  const pairs = [
    0,
    "SECTION",
    2,
    "HEADER",
    9,
    "$ACADVER",
    1,
    "AC1015",
    9,
    "$INSUNITS",
    70,
    6,
    0,
    "ENDSEC",
    0,
    "SECTION",
    2,
    "ENTITIES",
  ];
  const poly = (p, layer) => {
    pairs.push(0, "LWPOLYLINE", 8, layer, 90, p.length, 70, 1);
    for (const q of p) pairs.push(10, q[0], 20, -q[1]);
  };
  poly(room.polygon, "ROOM");
  for (const o of room.openings) {
    const f = openingFrame(room, o);
    pairs.push(
      0,
      "LINE",
      8,
      o.type === "door" ? "DOORS" : "WINDOWS",
      10,
      f.a[0],
      20,
      -f.a[1],
      11,
      f.b[0],
      21,
      -f.b[1],
    );
  }
  for (const o of scene?.items || []) {
    poly(footprint(o, CATALOG[o.sku]), "FURNITURE");
    pairs.push(
      0,
      "TEXT",
      8,
      "FURNITURE_LABELS",
      10,
      o.x,
      20,
      -o.z,
      40,
      0.12,
      1,
      CATALOG[o.sku].nom,
    );
  }
  pairs.push(0, "ENDSEC", 0, "EOF");
  return pairs.join("\n") + "\n";
}
