// Run after connecting your own model credentials. Calls are billable; outputs contain no key.
import fs from "node:fs/promises";
import path from "node:path";
import { runDesign } from "../lib/model.mjs";
import { EXAMPLE_ROOM, EXAMPLE_L_ROOM, EMPTY_SCENE } from "../lib/examples.mjs";
import { exportDXF } from "../lib/dxf.mjs";
const inputFile = process.argv[2],
  out = path.resolve(process.argv[3] || "outputs/design-evaluation");
if (!process.env.OPENAI_API_KEY) {
  console.error(
    "Connectez votre compte API et définissez OPENAI_API_KEY pour lancer une évaluation réelle. Aucun appel effectué.",
  );
  process.exit(1);
}
const cases = inputFile
  ? JSON.parse(await fs.readFile(inputFile, "utf8"))
  : [
      {
        name: "salon-lecture-musique",
        room: EXAMPLE_ROOM,
        brief: {
          roomType: "salon",
          activities: ["lecture", "musique"],
          wishes:
            "Un salon calme, chêne et couleurs chaudes ; un vrai coin lecture et un piano droit. Éviter la surcharge.",
          seats: 4,
          budget: 0,
        },
      },
      {
        name: "bureau-en-L",
        room: EXAMPLE_L_ROOM,
        brief: {
          roomType: "bureau",
          activities: ["travail", "lecture", "rangement"],
          wishes:
            "Un bureau lumineux, des livres et un fauteuil pour lire. Préserver la circulation dans le décroché.",
          seats: 2,
          budget: 0,
        },
      },
    ];
await fs.mkdir(out, { recursive: true });
const summary = [];
for (const [index, c] of cases.entries()) {
  const started = Date.now(),
    result = await runDesign(
      { operation: "create", room: c.room, brief: c.brief, scene: EMPTY_SCENE },
      {
        key: process.env.OPENAI_API_KEY,
        model: process.env.REALROOM_MODEL || "gpt-6-astra",
        emit: (e) => {
          if (e.type === "progress") console.log(c.name + ": " + e.stage);
        },
      },
    );
  const name = String(c.name || "case-" + index).replace(/[^a-z0-9_-]/gi, "-");
  await fs.writeFile(
    path.join(out, name + ".json"),
    JSON.stringify({ room: c.room, brief: c.brief, result }, null, 2),
  );
  for (const [i, candidate] of result.candidates.entries())
    await fs.writeFile(
      path.join(out, name + "-" + (i + 1) + ".dxf"),
      exportDXF(c.room, candidate.scene),
    );
  summary.push({
    case: name,
    model: result.model,
    seconds: Math.round((Date.now() - started) / 1000),
    calls: result.calls,
    candidates: result.candidates.map((c) => ({
      title: c.scene.title,
      errors: c.report.errors,
      warnings: c.report.warnings,
      missingActivities: c.report.functional.missing,
      objects: c.scene.items.length,
    })),
    visualReview: false,
  });
}
await fs.writeFile(
  path.join(out, "summary.json"),
  JSON.stringify(summary, null, 2),
);
console.log(
  "Rapport enregistré dans " +
    out +
    ". La qualité esthétique doit être jugée sur les maquettes ; cette commande vérifie le plan et le protocole.",
);
