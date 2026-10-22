import { CATALOG, decoration } from "./catalog.mjs";
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Explicit, inspectable minimum coverage; not an aesthetic score.
export function coverage(scene, brief = {}) {
  const entries = scene.items.map((i) => ({ ...i, p: CATALOG[i.sku] })),
    has = (families, test = () => true) =>
      entries.filter((e) => families.includes(e.p.fam) && test(e));
  const requested = new Set(brief.activities || []),
    missing = [],
    checks = [];
  if (brief.roomType === "salon") requested.add("conversation");
  if (brief.roomType === "chambre") requested.add("sommeil");
  if (brief.roomType === "bureau") requested.add("travail");
  if (brief.roomType === "salle_a_manger") requested.add("repas");
  for (const activity of requested) {
    let ok = null;
    if (activity === "conversation")
      ok = has(["canape", "fauteuil", "meridienne"]).length > 0;
    if (activity === "sommeil") ok = has(["lit"]).length > 0;
    if (activity === "lecture") {
      const seats = has(["fauteuil", "chaise", "canape", "meridienne"]);
      ok = seats.some((s) =>
        has(["lampadaire", "lampe", "applique"]).some(
          (l) => distance(s, l) < 1.7,
        ),
      );
    }
    if (activity === "travail")
      ok = has(["bureau"]).some((d) =>
        has(["chaise", "fauteuil"]).some((c) => distance(d, c) < 1.5),
      );
    if (activity === "musique")
      ok = has(["piano", "instrument", "enceinte"]).length > 0;
    if (activity === "rangement")
      ok =
        has([
          "bibliotheque",
          "etagere",
          "meuble",
          "commode",
          "buffet",
          "armoire",
        ]).length > 0;
    if (activity === "repas")
      ok = has(["table"], (e) => e.p.dim[2] >= 0.68 && e.p.dim[2] <= 0.9).some(
        (t) =>
          has(
            ["chaise"],
            (c) => distance(t, c) < Math.max(...t.p.dim.slice(0, 2)) / 2 + 1.15,
          ).length >= (brief.seats || 4),
      );
    if (activity === "cuisine" || activity === "bar")
      ok = has(["cuisine", "bar", "ilot"]).length > 0;
    if (ok === false) missing.push(activity);
    checks.push({ activity, satisfied: ok });
  }
  const priced = entries.filter((e) => !e.p.prixEstime && e.p.prix > 0),
    knownPrice = priced.reduce((s, e) => s + e.p.prix, 0),
    unpriced = entries.length - priced.length;
  return {
    checks,
    missing,
    knownPrice,
    unpriced,
    budgetExceeded: brief.budget > 0 && knownPrice > brief.budget,
    note: "Présence et proximité des éléments nécessaires. Les demandes libres et la qualité esthétique restent à apprécier dans la proposition.",
  };
}
export function assess(room, scene, brief, evaluator) {
  const report = evaluator(room, scene, {
      routeWidth: brief.accessible ? 0.9 : 0.7,
    }),
    functional = coverage(scene, brief);
  if (
    !scene.items.some(
      (i) =>
        !decoration(CATALOG[i.sku]) &&
        !["tapis", "tableau", "miroir", "applique", "suspension"].includes(
          CATALOG[i.sku].fam,
        ),
    )
  )
    report.issues.push({
      code: "empty-composition",
      message: "La proposition ne comporte aucun mobilier d’usage.",
      ids: [],
      severity: "error",
    });
  for (const a of functional.missing)
    report.issues.push({
      code: "missing-activity",
      message: "Usage incomplet : " + a + ".",
      ids: [],
      severity: "warning",
    });
  if (functional.budgetExceeded)
    report.issues.push({
      code: "budget",
      message: "Les prix connus dépassent le budget mobilier.",
      ids: [],
      severity: "error",
    });
  report.errors = report.issues.filter((i) => i.severity === "error").length;
  report.warnings = report.issues.length - report.errors;
  report.valid = report.errors === 0;
  report.functional = functional;
  return report;
}
