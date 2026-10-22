import {
  CATALOG,
  wallMounted,
  ceilingMounted,
  decoration,
  walkObstacle,
  accessDepth,
} from "./catalog.mjs";
import {
  bounds,
  inside,
  contained,
  footprint,
  overlap,
  project,
  walls,
  openingFrame,
  doorZone,
  rectangle,
  polygonDistance,
  wallDistance,
  validPolygon,
  distance,
} from "./geometry.mjs";
export const DEFAULT_FINISHES = {
  floor: "oak",
  wallColor: "#eee8dd",
  accentWall: -1,
  accentColor: "#a2a78f",
};
export function checkRoom(room) {
  if (
    !room ||
    !validPolygon(room.polygon) ||
    room.polygon.some((p) => p.some((v) => Math.abs(v) > 60))
  )
    throw Error(
      "Le contour doit être un polygone fermé, sans croisement, de 3 à 128 sommets.",
    );
  const b = bounds(room.polygon);
  if (b.maxX - b.minX > 35 || b.maxZ - b.minZ > 35)
    throw Error("Vérifiez les unités : la pièce dépasse 35 m.");
  if (!Number.isFinite(room.height) || room.height < 1.8 || room.height > 6)
    throw Error(
      "La hauteur sous plafond doit être comprise entre 1,80 et 6 m.",
    );
  if (!Array.isArray(room.openings) || room.openings.length > 40)
    throw Error("Liste des ouvertures invalide.");
  const ws = walls(room);
  for (const o of room.openings) {
    const w = ws[o.wall];
    if (
      !Number.isInteger(o.wall) ||
      !w ||
      !["door", "window"].includes(o.type) ||
      ![o.offset, o.width, o.height, o.sill].every(Number.isFinite) ||
      o.width < 0.2 ||
      o.height < 0.2 ||
      o.offset - o.width / 2 < -0.025 ||
      o.offset + o.width / 2 > w.length + 0.025 ||
      o.sill < 0 ||
      o.sill + o.height > room.height + 0.025
    )
      throw Error(
        "Une ouverture dépasse son mur ou présente des dimensions invalides.",
      );
  }
  for (let i = 0; i < room.openings.length; i++)
    for (let j = i + 1; j < room.openings.length; j++) {
      const a = room.openings[i],
        b = room.openings[j];
      if (
        a.wall === b.wall &&
        Math.abs(a.offset - b.offset) < (a.width + b.width) / 2 - 0.02 &&
        Math.min(a.sill + a.height, b.sill + b.height) >
          Math.max(a.sill, b.sill) + 0.02
      )
        throw Error("Deux ouvertures se chevauchent. Vérifiez le plan.");
    }
  return room;
}
export function normalizeScene(raw, room, previous = null) {
  if (!raw || !Array.isArray(raw.items) || raw.items.length > 65)
    throw Error("La proposition doit contenir au plus 65 objets.");
  const seen = new Set();
  const items = raw.items.map((o) => {
    if (!o || !Object.hasOwn(CATALOG, o.sku))
      throw Error("Référence inconnue : " + String(o.sku).slice(0, 80));
    if (
      ![o.x, o.z, o.y, o.rotation].every(Number.isFinite) ||
      [o.x, o.z, o.y].some((v) => Math.abs(v) > 60)
    )
      throw Error("Coordonnées invalides.");
    if (
      typeof o.id !== "string" ||
      seen.has(o.id) ||
      !o.id.length ||
      o.id.length > 80
    )
      throw Error("Identifiants d’objets invalides.");
    seen.add(o.id);
    return {
      id: o.id,
      sku: o.sku,
      x: o.x,
      z: o.z,
      y: o.y,
      rotation: ((o.rotation % 360) + 360) % 360,
      zone: String(o.zone || "").slice(0, 60),
      note: String(o.note || "").slice(0, 500),
      locked: !!o.locked,
    };
  });
  if (previous)
    for (const old of previous.items.filter((i) => i.locked)) {
      const index = items.findIndex((i) => i.id === old.id);
      if (index >= 0) items[index] = { ...old };
      else items.push({ ...old });
    }
  if (items.length > 65)
    throw Error("Trop d’objets après conservation des meubles verrouillés.");
  const hex = (s, d) => (/^#[0-9a-f]{6}$/i.test(s) ? s : d);
  const f = raw.finishes || {};
  const finishes = {
    floor: ["oak", "walnut", "stone", "terrazzo", "terracotta"].includes(
      f.floor,
    )
      ? f.floor
      : "oak",
    wallColor: hex(f.wallColor, DEFAULT_FINISHES.wallColor),
    accentColor: hex(f.accentColor, DEFAULT_FINISHES.accentColor),
    accentWall:
      Number.isInteger(f.accentWall) &&
      f.accentWall >= 0 &&
      f.accentWall < room.polygon.length
        ? f.accentWall
        : -1,
  };
  return {
    id: raw.id || "scene-" + Date.now(),
    title: String(raw.title || "Proposition").slice(0, 100),
    intent: String(raw.intent || "").slice(0, 1800),
    items,
    finishes,
    zones: (Array.isArray(raw.zones) ? raw.zones : [])
      .slice(0, 8)
      .map((z) => ({
        id: String(z?.id || "").slice(0, 60),
        name: String(z?.name || "").slice(0, 80),
        activity: String(z?.activity || "").slice(0, 100),
        rationale: String(z?.rationale || "").slice(0, 600),
      })),
    rationale: (Array.isArray(raw.rationale) ? raw.rationale : [])
      .slice(0, 8)
      .map((s) => String(s).slice(0, 600)),
    limitations: (Array.isArray(raw.limitations) ? raw.limitations : [])
      .slice(0, 8)
      .map((s) => String(s).slice(0, 600)),
    provenance: raw.provenance || null,
  };
}
function passage(room, items, width) {
  const bb = bounds(room.polygon),
    step = Math.max(
      0.12,
      Math.sqrt(((bb.maxX - bb.minX) * (bb.maxZ - bb.minZ)) / 18000),
    ),
    nx = Math.ceil((bb.maxX - bb.minX) / step) + 1,
    nz = Math.ceil((bb.maxZ - bb.minZ) / step) + 1,
    r = width / 2;
  const obs = items
    .filter((i) => walkObstacle(CATALOG[i.sku]))
    .map((i) => footprint(i, CATALOG[i.sku]));
  const blocked = new Uint8Array(nx * nz),
    point = (k) => [
      bb.minX + (k % nx) * step,
      bb.minZ + Math.floor(k / nx) * step,
    ];
  for (let k = 0; k < blocked.length; k++) {
    const p = point(k);
    blocked[k] =
      !inside(p, room.polygon) ||
      wallDistance(p, room.polygon) < r - 0.01 ||
      obs.some((poly) => polygonDistance(p, poly) < r - 0.01)
        ? 1
        : 0;
  }
  function nearest(p, max = 0.45) {
    let best = -1,
      d = max;
    const xi = Math.round((p[0] - bb.minX) / step),
      zi = Math.round((p[1] - bb.minZ) / step),
      n = Math.ceil(max / step);
    for (let z = Math.max(0, zi - n); z <= Math.min(nz - 1, zi + n); z++)
      for (let x = Math.max(0, xi - n); x <= Math.min(nx - 1, xi + n); x++) {
        const k = z * nx + x;
        if (!blocked[k]) {
          const ds = distance(p, point(k));
          if (ds < d) {
            d = ds;
            best = k;
          }
        }
      }
    return best;
  }
  const doors = room.openings.filter((o) => o.type === "door");
  const starts = doors.map((o) => {
    const f = openingFrame(room, o);
    return nearest(
      [f.c[0] + f.n[0] * (r + 0.15), f.c[1] + f.n[1] * (r + 0.15)],
      0.38,
    );
  });
  const visited = new Uint8Array(blocked.length),
    queue = [];
  if (starts[0] >= 0) {
    queue.push(starts[0]);
    visited[starts[0]] = 1;
  }
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q],
      x = k % nx,
      z = Math.floor(k / nx);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const xx = x + dx,
        zz = z + dz,
        t = zz * nx + xx;
      if (
        xx >= 0 &&
        xx < nx &&
        zz >= 0 &&
        zz < nz &&
        !blocked[t] &&
        !visited[t]
      ) {
        visited[t] = 1;
        queue.push(t);
      }
    }
  }
  const inaccessible = [];
  if (doors.length)
    for (const item of items) {
      const p = CATALOG[item.sku];
      if (!accessDepth(p)) continue;
      const a = (item.rotation * Math.PI) / 180,
        f = [Math.sin(a), Math.cos(a)],
        side = [Math.cos(a), -Math.sin(a)],
        depth = p.dim[1] / 2 + r + 0.12;
      let targets = [-0.55, -0.45, 0, 0.45, 0.55].map((t) => [
        item.x + f[0] * depth + side[0] * p.dim[0] * t,
        item.z + f[1] * depth + side[1] * p.dim[0] * t,
      ]);
      if (p.fam === "lit")
        targets = targets.concat(
          [-1, 1].map((s) => [
            item.x + side[0] * s * (p.dim[0] / 2 + r + 0.1),
            item.z + side[1] * s * (p.dim[0] / 2 + r + 0.1),
          ]),
        );
      if (
        !targets.some((p) => {
          const k = nearest(p, 0.25);
          return k >= 0 && visited[k];
        })
      )
        inaccessible.push(item.id);
    }
  return {
    width,
    resolution: step,
    doorsConnected: doors.length
      ? starts.every((k) => k >= 0 && visited[k])
      : null,
    inaccessible,
    reachableArea: queue.length * step * step,
  };
}
export function evaluate(room, scene, { routeWidth = 0.7, paths = true } = {}) {
  const issues = [],
    items = scene.items || [],
    ws = walls(room);
  const add = (code, message, ids = [], severity = "error") =>
    issues.push({ code, message, ids, severity });
  for (const o of room.openings)
    if (o.type === "door" && o.width < routeWidth - 0.01)
      add(
        "door-width",
        "La porte est plus étroite que le passage demandé de " +
          Math.round(routeWidth * 100) +
          " cm.",
        [o.id],
      );
  const fps = new Map(items.map((o) => [o.id, footprint(o, CATALOG[o.sku])]));
  for (const o of items) {
    const p = CATALOG[o.sku],
      fp = fps.get(o.id);
    if (!contained(fp, room.polygon))
      add("outside", p.nom + " dépasse le contour de la pièce.", [o.id]);
    if (o.y < -0.005 || o.y + p.dim[2] > room.height + 0.03)
      add("height", p.nom + " dépasse les limites verticales.", [o.id]);
    if (walkObstacle(p) || p.fam === "tapis") {
      if (Math.abs(o.y) > 0.03)
        add("floating", p.nom + " doit être posé au sol.", [o.id]);
    }
    if (ceilingMounted(p) && Math.abs(o.y + p.dim[2] - room.height) > 0.12)
      add("ceiling", p.nom + " doit être fixé au plafond.", [o.id]);
    if (wallMounted(p)) {
      const back = [
        o.x - (Math.sin((o.rotation * Math.PI) / 180) * p.dim[1]) / 2,
        o.z - (Math.cos((o.rotation * Math.PI) / 180) * p.dim[1]) / 2,
      ];
      const nearest = ws
        .map((w) => ({ ...w, projection: project(back, w.a, w.b) }))
        .sort((a, b) => a.projection.distance - b.projection.distance)[0];
      if (
        nearest.projection.distance > 0.1 ||
        Math.sin((o.rotation * Math.PI) / 180) * nearest.n[0] +
          Math.cos((o.rotation * Math.PI) / 180) * nearest.n[1] <
          0.8
      )
        add("wall-mount", p.nom + " doit être fixé à un mur.", [o.id]);
    }
    if (decoration(p)) {
      const support = items.find(
        (s) =>
          s.id !== o.id &&
          !decoration(CATALOG[s.sku]) &&
          !wallMounted(CATALOG[s.sku]) &&
          !ceilingMounted(CATALOG[s.sku]) &&
          Math.abs(s.y + CATALOG[s.sku].dim[2] - o.y) < 0.04 &&
          contained(fp, fps.get(s.id)),
      );
      if (!support)
        add("support", p.nom + " doit reposer sur un meuble.", [o.id]);
    }
    for (const opening of room.openings) {
      const f = openingFrame(room, opening);
      if (
        opening.type === "door" &&
        o.y < opening.height &&
        p.fam !== "tapis" &&
        !ceilingMounted(p) &&
        overlap(fp, doorZone(room, opening))
      )
        add(
          "door",
          p.nom + " empiète sur l’accès ou le débattement de la porte.",
          [o.id, opening.id],
        );
      if (
        opening.type === "window" &&
        o.y + p.dim[2] > opening.sill + 0.02 &&
        o.y < opening.sill + opening.height &&
        p.fam !== "rideau"
      ) {
        const zone = [
          f.a,
          f.b,
          [f.b[0] + f.n[0] * 0.22, f.b[1] + f.n[1] * 0.22],
          [f.a[0] + f.n[0] * 0.22, f.a[1] + f.n[1] * 0.22],
        ];
        if (overlap(fp, zone))
          add("window", p.nom + " obstrue une fenêtre.", [o.id, opening.id]);
      }
    }
  }
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i],
        b = items[j],
        pa = CATALOG[a.sku],
        pb = CATALOG[b.sku];
      if (pa.fam === "tapis" || pb.fam === "tapis") continue;
      if (
        Math.min(a.y + pa.dim[2], b.y + pb.dim[2]) - Math.max(a.y, b.y) <
        0.025
      )
        continue;
      if (overlap(fps.get(a.id), fps.get(b.id), 0.01))
        add("collision", pa.nom + " et " + pb.nom + " se chevauchent.", [
          a.id,
          b.id,
        ]);
    }
  for (const o of items) {
    const p = CATALOG[o.sku],
      dep = accessDepth(p);
    if (!dep) continue;
    const a = (o.rotation * Math.PI) / 180,
      d = p.dim[1] / 2 + dep / 2,
      access = rectangle(
        o.x + Math.sin(a) * d,
        o.z + Math.cos(a) * d,
        Math.min(p.dim[0], 0.7),
        dep,
        o.rotation,
      );
    const blocked = items.find(
      (b) =>
        b.id !== o.id &&
        walkObstacle(CATALOG[b.sku]) &&
        overlap(access, fps.get(b.id), 0.025),
    );
    if (
      blocked &&
      !(p.fam === "piano" && CATALOG[blocked.sku].fam === "banc") &&
      !(p.fam === "bureau" && CATALOG[blocked.sku].fam === "chaise")
    )
      add(
        "use-clearance",
        "Dégagement d’usage à vérifier devant " + p.nom + ".",
        [o.id, blocked.id],
        "warning",
      );
  }
  const circulation = paths ? passage(room, items, routeWidth) : null;
  if (circulation?.doorsConnected === false)
    add(
      "path",
      "Les accès aux portes ne sont pas reliés par un passage de " +
        Math.round(routeWidth * 100) +
        " cm.",
    );
  if (circulation?.doorsConnected === null)
    add(
      "no-door",
      "Aucune porte renseignée : la circulation depuis l’entrée n’est pas vérifiable.",
      [],
      "warning",
    );
  for (const id of circulation?.inaccessible || [])
    add(
      "access",
      "Pas de chemin de " +
        Math.round(routeWidth * 100) +
        " cm jusqu’à " +
        CATALOG[items.find((i) => i.id === id).sku].nom +
        ".",
      [id],
      "warning",
    );
  const errors = issues.filter((i) => i.severity === "error").length,
    warnings = issues.length - errors;
  return {
    valid: errors === 0,
    errors,
    warnings,
    issues,
    circulation,
    checked: {
      objects: items.length,
      doors: room.openings.filter((o) => o.type === "door").length,
      windows: room.openings.filter((o) => o.type === "window").length,
    },
    note: "Vérifications géométriques sur les volumes du catalogue et grille de circulation. Ce contrôle ne mesure pas la qualité esthétique.",
  };
}
export function diffScenes(before, after) {
  const old = new Map(before.items.map((i) => [i.id, i]));
  const changes = [];
  for (const i of after.items) {
    const p = old.get(i.id);
    if (!p) changes.push("Ajout : " + CATALOG[i.sku].nom);
    else if (i.sku !== p.sku)
      changes.push(
        "Remplacement : " + CATALOG[p.sku].nom + " → " + CATALOG[i.sku].nom,
      );
    else if (
      distance([i.x, i.z], [p.x, p.z]) > 0.01 ||
      Math.abs(i.y - p.y) > 0.01 ||
      Math.abs(i.rotation - p.rotation) > 0.5
    )
      changes.push("Déplacement : " + CATALOG[i.sku].nom);
  }
  for (const i of before.items)
    if (!after.items.some((o) => o.id === i.id))
      changes.push("Retrait : " + CATALOG[i.sku].nom);
  if (JSON.stringify(before.finishes) !== JSON.stringify(after.finishes))
    changes.push("Revêtements mis à jour");
  return changes;
}
