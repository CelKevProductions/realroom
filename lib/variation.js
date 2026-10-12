// Graine de variation d'un aménagement : un entier tiré au sort à chaque demande, pour que
// deux aménagements successifs puissent proposer des dispositions différentes, tout en
// restant reproductibles (même graine, même plan). 0 = plan de référence déterministe.
export const VARIATION_MAX = 2147483646;
export const variationValide = v => Number.isInteger(v) && v >= 1 && v <= VARIATION_MAX;
export function tirerVariation() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return 1 + (c.getRandomValues(new Uint32Array(1))[0] % VARIATION_MAX);
  return 1 + Math.floor(Math.random() * VARIATION_MAX);
}
