// Bridge to the existing RealRoom scene. No re-scaling of furniture or floor plan.
import { contourDe, segmentsDe } from "./contour.js";
import {
  CATALOG,
  wallMounted,
  ceilingMounted,
  decoration,
} from "./catalog.mjs";
import { checkRoom, normalizeScene, DEFAULT_FINISHES } from "./validation.mjs";
import { bounds, walls, contained, footprint } from "./geometry.mjs";

export function roomFromPiece(piece, verified = false) {
  const m = piece.modele;
  if (!m?.dims)
    throw Error("Importez et vérifiez d’abord le plan de la pièce.");
  const room = {
    id: piece.id,
    name: piece.nom,
    polygon: contourDe(m).map((p) => [...p]),
    height: m.dims.hauteur,
    verified,
    source: { format: m.capture?.source || "RealRoom", units: "m" },
    openings: [],
  };
  for (const [wall, segment] of segmentsDe(m).entries())
    for (const [i, o] of (m.murs?.[segment.id]?.ouvertures || []).entries()) {
      const door =
        ["porte", "passage"].includes(o.type) ||
        (o.type === "baie" && !(o.allege > 0.05));
      room.openings.push({
        id: segment.id + "-" + i,
        type: door ? "door" : "window",
        wall,
        offset: segment.long / 2 + (o.position || 0) * segment.signePosition,
        width: o.largeur,
        height: o.hauteur || 2.04,
        sill: o.allege || 0,
        swing: o.swing || (o.type === "passage" ? "sliding" : "inward"),
        hinge: o.hinge || "start",
      });
    }
  return checkRoom(room);
}
export function sceneFromPiece(
  piece,
  items = piece.agencement || [],
  kept = [],
) {
  const room = roomFromPiece(piece),
    locked = new Set(kept);
  return normalizeScene(
    {
      id: "current",
      title: piece.proposition?.concept || piece.nom,
      intent: piece.proposition?.description || "",
      provenance: piece.proposition?.design?.provenance || null,
      rationale: piece.proposition?.design?.scene?.rationale || [],
      limitations: piece.proposition?.design?.scene?.limitations || [],
      zones: piece.proposition?.design?.scene?.zones || [],
      finishes: piece.proposition?.design?.scene?.finishes || DEFAULT_FINISHES,
      items: items
        .filter((i) => i.garde !== false)
        .map((i) => {
          const p = CATALOG[i.sku];
          if (!p)
            throw Error(
              "Le meuble « " +
                (i.p?.nom || i.id) +
                " » doit être associé à une référence du catalogue avant une composition IA.",
            );
          const r = i.rot || 0,
            mural = wallMounted(p),
            ceiling = ceilingMounted(p);
          return {
            id: i.id,
            sku: i.sku,
            x: i.x + (mural ? (Math.sin(r) * p.dim[1]) / 2 : 0),
            z: i.z + (mural ? (Math.cos(r) * p.dim[1]) / 2 : 0),
            y:
              mural || ceiling
                ? (i.y ?? (ceiling ? room.height - p.dim[2] / 2 : 1.55)) -
                  p.dim[2] / 2
                : i.baseY || 0,
            rotation: (r * 180) / Math.PI,
            zone: i.designZone || "",
            note: i.raison || "",
            locked: !!i.fixe || locked.has(i.id),
          };
        }),
    },
    room,
  );
}
export function briefFromPiece(piece, choices = {}) {
  return {
    roomType: piece.fonction,
    activities: choices.espaces || piece.proposition?.espaces || [],
    wishes: String(choices.envies ?? piece.proposition?.envies ?? "").slice(
      0,
      5000,
    ),
    budget: Number(choices.budget ?? piece.proposition?.budget) || 0,
    seats: Number(choices.placesRepas ?? piece.proposition?.placesRepas) || 4,
    accessible: !!choices.accessible,
  };
}
export function pieceFromScene(piece, scene, report = null, brief = null) {
  const m = structuredClone(piece.modele),
    segments = segmentsDe(m),
    f = scene.finishes;
  const floors = {
    oak: ["parquet", "#BFA481"],
    walnut: ["parquet", "#76604B"],
    stone: ["carrelage", "#C3BCAF"],
    terrazzo: ["carrelage", "#D7CFC1"],
    terracotta: ["carrelage", "#BB8066"],
  };
  const [matiere, couleur] = floors[f.floor] || floors.oak;
  m.sol = { ...m.sol, matiere, couleur };
  for (const [index, s] of segments.entries())
    m.murs[s.id] = {
      ...m.murs[s.id],
      couleur: index === f.accentWall ? f.accentColor : f.wallColor,
    };
  const agencement = scene.items.map((o) => {
    const p = CATALOG[o.sku],
      mural = wallMounted(p),
      ceiling = ceilingMounted(p),
      rot = (o.rotation * Math.PI) / 180;
    const i = {
      id: o.id,
      sku: o.sku,
      origine: "catalogue",
      garde: true,
      design: true,
      designZone: o.zone,
      fixe: o.locked,
      x: o.x - (mural ? (Math.sin(rot) * p.dim[1]) / 2 : 0),
      z: o.z - (mural ? (Math.cos(rot) * p.dim[1]) / 2 : 0),
      rot,
      baseY: o.y,
      y: o.y + (mural || ceiling ? p.dim[2] / 2 : 0),
      raison: o.note,
      kind: mural
        ? "wall_item"
        : ceiling
          ? "ceiling_item"
          : decoration(p)
            ? "surface_item"
            : "floor_item",
    };
    if (mural) {
      const ws = walls(roomFromPiece(piece));
      const w = ws
        .map((s, index) => ({
          index,
          d: Math.abs((i.x - s.a[0]) * s.n[0] + (i.z - s.a[1]) * s.n[1]),
        }))
        .sort((a, b) => a.d - b.d)[0];
      i.mur = segments[w.index].id;
    }
    if (decoration(p)) {
      const support = scene.items.find(
        (s) =>
          s.id !== o.id &&
          !decoration(CATALOG[s.sku]) &&
          !wallMounted(CATALOG[s.sku]) &&
          !ceilingMounted(CATALOG[s.sku]) &&
          Math.abs(s.y + CATALOG[s.sku].dim[2] - o.y) < 0.04 &&
          contained(footprint(o, p), footprint(s, CATALOG[s.sku])),
      );
      if (support) i.attach_to = { type: "furniture", id: support.id };
    }
    return i;
  });
  return {
    ...piece,
    modele: m,
    agencement,
    proposition: {
      mode: "tout",
      concept: scene.title,
      description: scene.intent,
      envies: brief?.wishes || "",
      espaces: brief?.activities || [],
      budget: brief?.budget || 0,
      placesRepas: brief?.seats || 4,
      garder: scene.items.filter((i) => i.locked).map((i) => i.id),
      moteur: { type: "ia", nom: scene.provenance?.model },
      design: { scene, report, brief, provenance: scene.provenance },
      variantes: null,
    },
  };
}
export function modelFromRoom(room) {
  checkRoom(room);
  const b = bounds(room.polygon),
    m = {
      dims: {
        largeur: b.maxX - b.minX,
        profondeur: b.maxZ - b.minZ,
        hauteur: room.height,
      },
      contour: room.polygon.map((p) => [...p]),
      murs: {},
      sol: { matiere: "parquet", couleur: "#BFA481" },
      plafond: { couleur: "#F4F0E9" },
      vue: { x: 0, y: 1.5, z: b.maxZ - 0.2, cx: 0, cy: 1, cz: 0, fov: 65 },
      capture: {
        source: room.source?.format || "DXF",
        nbOuvertures: room.openings.length,
      },
    };
  for (const s of segmentsDe(m))
    m.murs[s.id] = { couleur: "#EEE8DD", observe: true, ouvertures: [] };
  const ss = segmentsDe(m);
  for (const o of room.openings) {
    const s = ss[o.wall];
    m.murs[s.id].ouvertures.push({
      type: o.type === "door" ? "porte" : "fenetre",
      position: (o.offset - s.long / 2) / s.signePosition,
      largeur: o.width,
      hauteur: o.height,
      allege: o.sill,
      confiance: 1,
      swing: o.swing,
      hinge: o.hinge,
    });
  }
  return m;
}
