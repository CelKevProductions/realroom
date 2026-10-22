import raw from "../data/catalogue.json" with { type: "json" };
import { OBJETS_GENERIQUES } from "./catalogue-generique.js";
import { DESIGN_OBJECTS } from "./design-objects.js";
import { normaliserDimensionsCatalogue } from "./catalogue-dimensions.js";
export const CATALOG = {
  ...normaliserDimensionsCatalogue(raw).produits,
  ...OBJETS_GENERIQUES,
  ...Object.fromEntries(DESIGN_OBJECTS.map((p) => [p.id, p])),
};
export const PRODUCTS = Object.values(CATALOG).filter(
  (p) =>
    Array.isArray(p.dim) &&
    p.dim.every((x) => Number.isFinite(x) && x > 0) &&
    !p.ext,
);
export const wallMounted = (p) =>
  [
    "applique",
    "miroir",
    "tableau",
    "etagere-murale",
    "tv-murale",
    "rideau",
    "panneau",
  ].includes(p.fam);
export const ceilingMounted = (p) =>
  ["suspension", "lustre", "plafonnier"].includes(p.fam);
export const decoration = (p) =>
  ["objet", "deco", "lampe", "sculpture", "tv"].includes(p.fam) &&
  p.dim[2] <= 1.05 &&
  p.dim[1] <= 0.7;
export const walkObstacle = (p) =>
  !wallMounted(p) && !ceilingMounted(p) && !decoration(p) && p.fam !== "tapis";
export const accessDepth = (p) =>
  p.fam === "piano"
    ? 0.7
    : ["armoire", "bibliotheque", "rangement", "meuble", "bureau"].includes(
          p.fam,
        )
      ? 0.65
      : ["canape", "fauteuil", "chaise", "lit", "meridienne"].includes(p.fam)
        ? 0.5
        : 0;
export const shortlist = () =>
  PRODUCTS.map((p) => ({
    sku: p.id,
    name: p.nom,
    type: p.fam,
    dimensions: p.dim,
    material: p.mat,
    colors: p.cols,
    style: p.st,
    mount: wallMounted(p)
      ? "wall"
      : ceilingMounted(p)
        ? "ceiling"
        : decoration(p)
          ? "support"
          : "floor",
    generic: !!p.generique,
    price: p.prix || null,
    estimatedPrice: !!p.prixEstime,
  }));
