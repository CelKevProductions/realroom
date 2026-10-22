import test from "node:test";
import assert from "node:assert/strict";
import {
  EXAMPLE_ROOM as R,
  EXAMPLE_SCENE as S,
  EXAMPLE_L_ROOM,
  EMPTY_SCENE,
} from "../lib/examples.mjs";
import { CATALOG } from "../lib/catalog.mjs";
import {
  validPolygon,
  contained,
  rectangle,
  signedArea,
  openingFrame,
} from "../lib/geometry.mjs";
import { checkRoom, normalizeScene, evaluate } from "../lib/validation.mjs";
import { parseDXF, exportDXF } from "../lib/dxf.mjs";
import {
  modelFromRoom,
  roomFromPiece,
  sceneFromPiece,
  pieceFromScene,
} from "../lib/design-adapter.mjs";
import { assess } from "../lib/design-quality.mjs";
import { runDesign, requestModel, validateDesignInput } from "../lib/model.mjs";
import { createDesignHandlers } from "../lib/design-http.mjs";
const clone = (x) => structuredClone(x),
  brief = {
    roomType: "salon",
    activities: ["lecture", "musique"],
    wishes: "Un salon avec lecture et musique",
    budget: 0,
    seats: 4,
  };
const input = () => ({
  operation: "create",
  room: clone(R),
  brief: clone(brief),
  scene: clone(EMPTY_SCENE),
});
const answer = (scenes) =>
  new Response(
    JSON.stringify({
      id: "fixture-response",
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                message: "Fixture de protocole, pas une génération IA.",
                scenes,
              }),
            },
          ],
        },
      ],
    }),
    { status: 200 },
  );
test("baseline manual scene fits openings, volumes and connected paths", () => {
  const report = assess(R, normalizeScene(S, R), brief, evaluate);
  assert.equal(report.errors, 0);
  assert.equal(report.functional.missing.length, 0);
  assert.equal(report.circulation.doorsConnected, true);
});
test("real product dimensions are fixed, including normalized rugs", () => {
  const raw = clone(S);
  raw.items[0].dim = [0.01, 0.01, 0.01];
  const n = normalizeScene(raw, R);
  assert.equal(n.items[0].dim, undefined);
  assert.deepEqual(CATALOG["atelier-piano"].dim, [1.45, 0.6, 1.2]);
  assert.ok(
    Object.values(CATALOG)
      .filter((p) => p.fam === "tapis")
      .every((p) => p.dim[2] < 0.2),
  );
});
test("concave room rejects a box bridging its missing corner", () => {
  assert.equal(
    contained(rectangle(1.1, 0.8, 2, 2), EXAMPLE_L_ROOM.polygon),
    false,
  );
});
test("crossed, touching and non-finite polygons are rejected", () => {
  for (const p of [
    [
      [0, 0],
      [4, 4],
      [0, 4],
      [4, 0],
    ],
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [4, 0],
    ],
    [
      [0, 0],
      [Infinity, 0],
      [0, 4],
    ],
  ])
    assert.equal(validPolygon(p), false);
});
test("room validates opening bounds, overlap and absolute coordinate bounds", () => {
  let r = clone(R);
  r.openings[0].offset = 99;
  assert.throws(() => checkRoom(r));
  r = clone(R);
  r.openings.push({ ...r.openings[0], id: "duplicate" });
  assert.throws(() => checkRoom(r), /chevauchent/);
  r = clone(R);
  r.polygon = r.polygon.map((p) => [p[0] + 100, p[1]]);
  assert.throws(() => checkRoom(r));
});
test("locked items cannot be deleted, moved or replaced", () => {
  const before = clone(S);
  before.items[0].locked = true;
  const after = clone(S);
  after.items[0] = { ...after.items[0], sku: "atelier-chaise", x: 0 };
  let next = normalizeScene(after, R, before);
  assert.deepEqual(next.items[0], before.items[0]);
  after.items.shift();
  next = normalizeScene(after, R, before);
  assert.deepEqual(
    next.items.find((i) => i.id === "sofa"),
    before.items[0],
  );
});
test("unknown SKUs, duplicate IDs and invalid coordinates are refused", () => {
  for (const patch of [
    { sku: "invented" },
    { sku: "toString" },
    { x: NaN },
    { id: "" },
  ]) {
    const scene = clone(S);
    Object.assign(scene.items[0], patch);
    assert.throws(() => normalizeScene(scene, R));
  }
  const s = clone(S);
  s.items[1].id = s.items[0].id;
  assert.throws(() => normalizeScene(s, R));
});
test("door sweep violations are detected", () => {
  const s = clone(S),
    f = openingFrame(R, R.openings[0]);
  s.items = [
    { ...s.items[0], x: f.c[0] + f.n[0] * 0.4, z: f.c[1] + f.n[1] * 0.4 },
  ];
  assert.ok(evaluate(R, s).issues.some((i) => i.code === "door"));
});
test("window, overlap, floating and missing support violations are detected", () => {
  const s = clone(S);
  s.items[0].x = s.items[3].x;
  s.items[0].z = s.items[3].z;
  assert.ok(evaluate(R, s).issues.some((i) => i.code === "collision"));
  s.items[0].y = 0.2;
  assert.ok(evaluate(R, s).issues.some((i) => i.code === "floating"));
  s.items = s.items.filter((i) => i.id !== "coffee");
  assert.ok(evaluate(R, s).issues.some((i) => i.code === "support"));
  const r = clone(R);
  r.openings[1].sill = 0;
  assert.ok(evaluate(r, S).issues.some((i) => i.code === "window"));
});
test("an empty layout cannot pass as successful furnishing", () => {
  assert.ok(
    assess(R, EMPTY_SCENE, brief, evaluate).issues.some(
      (i) => i.code === "empty-composition",
    ),
  );
});
test("missing activities remain visible independently of AI explanations", () => {
  const s = clone(S);
  s.items = s.items.filter(
    (i) => !["piano", "instrument", "enceinte"].includes(CATALOG[i.sku].fam),
  );
  const r = assess(R, s, brief, evaluate);
  assert.ok(r.functional.missing.includes("musique"));
});
test("RealRoom conversion preserves poses, wall heights, radians and openings", () => {
  const p = { id: "r", nom: "Salon", modele: modelFromRoom(R) },
    out = pieceFromScene(p, S),
    back = sceneFromPiece(out);
  for (let i = 0; i < S.items.length; i++)
    for (const key of ["x", "y", "z", "rotation"])
      assert.ok(Math.abs(back.items[i][key] - S.items[i][key]) < 1e-9);
  const room = roomFromPiece(out, true);
  assert.deepEqual(room.polygon, R.polygon);
  for (let i = 0; i < R.openings.length; i++) {
    const o = R.openings[i],
      mapped = room.openings.find(
        (q) => q.wall === o.wall && q.type === o.type,
      );
    assert.ok(Math.abs(mapped.offset - o.offset) < 1e-9);
    assert.equal(mapped.width, o.width);
  }
});
test("legacy rectangular wall position signs convert correctly", () => {
  const p = {
    id: "r",
    nom: "R",
    modele: {
      dims: { largeur: 6, profondeur: 4, hauteur: 2.6 },
      murs: {
        entree: {
          ouvertures: [
            { type: "porte", position: -2, largeur: 0.8, hauteur: 2 },
          ],
        },
      },
    },
  };
  const r = roomFromPiece(p);
  const f = openingFrame(r, r.openings[0]);
  assert.deepEqual(f.c, [-2, 2]);
});
test("DXF roundtrip preserves metres, area and openings", () => {
  const p = parseDXF(exportDXF(R, S));
  assert.equal(p.units, "m");
  assert.equal(p.rooms.length, 1);
  assert.equal(p.rooms[0].openings.length, 3);
  assert.ok(Math.abs(Math.abs(signedArea(p.rooms[0].polygon)) - 40.32) < 1e-9);
});
test("DXF with no units requires an explicit choice", () => {
  const text = exportDXF(R).replace("9\n$INSUNITS\n70\n6\n", "");
  assert.equal(parseDXF(text).units, null);
  assert.equal(parseDXF(text, { unit: "m" }).rooms.length, 1);
});
test("DXF millimetres and inserted door blocks are transformed", () => {
  const d =
    [
      0,
      "SECTION",
      2,
      "HEADER",
      9,
      "$INSUNITS",
      70,
      4,
      0,
      "ENDSEC",
      0,
      "SECTION",
      2,
      "BLOCKS",
      0,
      "BLOCK",
      2,
      "DOOR_SYMBOL",
      70,
      0,
      10,
      0,
      20,
      0,
      30,
      0,
      0,
      "LINE",
      8,
      "0",
      10,
      0,
      20,
      0,
      11,
      1000,
      21,
      0,
      0,
      "ENDBLK",
      0,
      "ENDSEC",
      0,
      "SECTION",
      2,
      "ENTITIES",
      0,
      "LWPOLYLINE",
      8,
      "ROOM",
      90,
      4,
      70,
      1,
      10,
      0,
      20,
      0,
      10,
      6000,
      20,
      0,
      10,
      6000,
      20,
      4000,
      10,
      0,
      20,
      4000,
      0,
      "INSERT",
      8,
      "DOORS",
      2,
      "DOOR_SYMBOL",
      10,
      1000,
      20,
      0,
      41,
      0.9,
      42,
      0.9,
      50,
      0,
      0,
      "ENDSEC",
      0,
      "EOF",
    ].join("\n") + "\n";
  const r = parseDXF(d);
  assert.equal(r.rooms.length, 1);
  assert.ok(Math.abs(Math.abs(signedArea(r.rooms[0].polygon)) - 24) < 1e-9);
  assert.equal(r.rooms[0].openings.length, 1);
  assert.ok(Math.abs(r.rooms[0].openings[0].width - 0.9) < 1e-9);
});
test("truncated and binary DXFs fail clearly", () => {
  assert.throws(() => parseDXF("AutoCAD Binary DXF"), /binaire/);
  assert.throws(() => parseDXF(exportDXF(R).replace("EOF", "")), /incomplet/);
});
test("input limits and required visual evidence are enforced", () => {
  assert.throws(
    () => validateDesignInput({ ...input(), operation: "review" }),
    /vues/,
  );
  assert.throws(() =>
    validateDesignInput({
      ...input(),
      brief: { ...brief, wishes: "x".repeat(5001) },
    }),
  );
  assert.throws(() =>
    validateDesignInput({
      ...input(),
      images: [{ data: "https://example.org/a.jpg" }],
    }),
  );
});
test("missing key fails without pretending to generate", async () => {
  await assert.rejects(runDesign(input()), /connexion/);
});
test("Responses protocol uses schema, images and store:false without logging credentials", async () => {
  let req;
  await requestModel({
    key: "fixture-key",
    payload: { x: 1 },
    images: [{ data: "data:image/png;base64,YQ==", label: "plan" }],
    fetcher: async (url, options) => {
      req = { url, ...JSON.parse(options.body) };
      return answer([S]);
    },
  });
  assert.equal(req.url, "https://api.openai.com/v1/responses");
  assert.equal(req.store, false);
  assert.equal(req.text.format.type, "json_schema");
  assert.ok(req.input[0].content.some((c) => c.type === "input_image"));
});
test("provider refusal, incomplete output and rate limits leave no candidate", async () => {
  for (const result of [
    { status: "incomplete" },
    { output: [{ content: [{ type: "refusal", refusal: "no" }] }] },
  ])
    await assert.rejects(
      requestModel({
        key: "fixture",
        payload: {},
        fetcher: async () => new Response(JSON.stringify(result)),
      }),
    );
  await assert.rejects(
    requestModel({
      key: "fixture",
      payload: {},
      fetcher: async () => new Response("{}", { status: 429 }),
    }),
    /crédits|limité/,
  );
});
test("create operation preserves locks and streams actual completion", async () => {
  const initial = clone(S);
  initial.items[0].locked = true;
  const generated = clone(S);
  generated.items.shift();
  const events = [];
  const result = await runDesign(
    { ...input(), scene: initial },
    {
      key: "fixture",
      fetcher: async () => answer([generated]),
      emit: (e) => events.push(e),
    },
  );
  assert.equal(
    result.candidates[0].scene.items.find((i) => i.id === "sofa").locked,
    true,
  );
  assert.equal(events.at(-1).type, "result");
});
test("a worse geometric repair is rejected", async () => {
  const wrong = clone(S);
  wrong.items[0].x = -5;
  let call = 0;
  const empty = clone(EMPTY_SCENE);
  const result = await runDesign(input(), {
    key: "fixture",
    fetcher: async () => answer([call++ === 0 ? wrong : empty]),
  });
  assert.ok(result.candidates[0].scene.items.length > 0);
  assert.equal(result.candidates[0].report.valid, false);
});
test("HTTP rejects cross-origin, missing credentials and unprotected server secrets", async () => {
  const h = createDesignHandlers(() => ({ key: "server-fixture" }));
  const request = (origin) =>
    new Request("https://demo.example/api/design", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(input()),
    });
  assert.equal((await h.POST(request("https://other.example"))).status, 403);
  assert.equal((await h.POST(request("https://demo.example"))).status, 503);
  assert.equal((await (await h.GET()).json()).configured, false);
});
test("HTTP session credential reaches only the runner and streamed response is valid NDJSON", async () => {
  let seen;
  const h = createDesignHandlers(
    () => ({}),
    async (_, o) => {
      seen = o.key;
      o.emit({ type: "result", result: { candidates: [] } });
    },
  );
  const r = await h.POST(
    new Request("https://demo.example/api/design", {
      method: "POST",
      headers: {
        origin: "https://demo.example",
        "x-realroom-key": "fixture-session",
      },
      body: JSON.stringify(input()),
    }),
  );
  assert.equal(seen, "fixture-session");
  assert.equal(JSON.parse(await r.text()).type, "result");
  assert.match(r.headers.get("Cache-Control"), /no-store/);
});
