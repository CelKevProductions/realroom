// Harmonie d'ensemble : ce qui va avec quoi. Le reste du moteur juge chaque produit seul
// (fonction, cotes, style demandé) ; ce module juge les produits ENTRE EUX : palette,
// bois, métaux, textures, formes et compatibilité des styles.
// Règles de décoration courantes traduites en points : hypothèses éditoriales RealRoom
// à calibrer sur des pièces notées, pas des normes ni des coefficients publiés.
// Pur JavaScript, sans dépendance : sert au serveur comme à la démo dans le navigateur.
import { PROFILS } from './profils.js';
import { etiquettesStyle } from './references-styles.js';
import { descriptionDe } from './usages.js';
import { ornemental } from './styles.js';

export const VERSION_HARMONIE = 'harmonie-1';
export const STYLES_HARMONIE = Object.keys(PROFILS).filter(s => s !== 'neutre');

/* ---------------------------------------------------------------
   Affinité entre styles (0 = se heurtent, 1 = se fondent).
   Lecture : « un salon japandi accepte une pièce scandinave (0,9) ;
   une pièce Art déco y détonne (0,2) ». Symétrique.
   --------------------------------------------------------------- */
const PAIRES = {
  epure: { chaleureux: .5, classique: .3, boheme: .2, artdeco: .3, japandi: .9, audacieux: .2, mediterraneen: .5, scandinave: .9, industriel: .6, contemporain: .9 },
  chaleureux: { classique: .6, boheme: .8, artdeco: .5, japandi: .7, audacieux: .4, mediterraneen: .8, scandinave: .7, industriel: .5, contemporain: .6 },
  classique: { boheme: .3, artdeco: .8, japandi: .3, audacieux: .4, mediterraneen: .5, scandinave: .4, industriel: .3, contemporain: .6 },
  boheme: { artdeco: .3, japandi: .5, audacieux: .6, mediterraneen: .9, scandinave: .5, industriel: .4, contemporain: .4 },
  artdeco: { japandi: .2, audacieux: .7, mediterraneen: .3, scandinave: .2, industriel: .4, contemporain: .7 },
  japandi: { audacieux: .1, mediterraneen: .6, scandinave: .9, industriel: .5, contemporain: .7 },
  audacieux: { mediterraneen: .4, scandinave: .3, industriel: .5, contemporain: .8 },
  mediterraneen: { scandinave: .5, industriel: .3, contemporain: .5 },
  scandinave: { industriel: .6, contemporain: .8 },
  industriel: { contemporain: .7 }
};
export function affiniteStyles(a, b) {
  if (a === b) return 1;
  if (a === 'neutre' || b === 'neutre') return .7;
  return PAIRES[a]?.[b] ?? PAIRES[b]?.[a] ?? .5;
}
// Styles qui tolèrent beaucoup d'accents, de mélanges et plusieurs pièces fortes.
const TOLERANTS = new Set(['audacieux', 'boheme']);
// Styles qui demandent une palette resserrée et une seule pièce forte.
const RESSERRES = new Set(['epure', 'japandi', 'scandinave']);

/* ---------------------------------------------------------------
   Couleur : hex → CIELAB → (L, C, h). Une couleur est neutre (blancs,
   gris, noirs, écrus), naturelle (bois, cuir, terre, beiges) ou un accent.
   --------------------------------------------------------------- */
export function lab(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16), lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const [r, g, b] = [lin(n >> 16 & 255), lin(n >> 8 & 255), lin(n & 255)];
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const X = f((.4124 * r + .3576 * g + .1805 * b) / .95047), Y = f(.2126 * r + .7152 * g + .0722 * b), Z = f((.0193 * r + .1192 * g + .9505 * b) / 1.08883);
  const L = 116 * Y - 16, A = 500 * (X - Y), B = 200 * (Y - Z);
  return { L, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}
export function natureCouleur(c) {
  if (!c) return null;
  if (c.C < 10) return 'neutre';
  // Tons de bois, cognac, camel, terre, sable, lin : ils se marient à presque tout.
  if (c.h >= 30 && c.h <= 110 && c.C < 42 && c.L >= 15 && c.L <= 95) return 'naturel';
  if (c.C < 15) return 'neutre';
  return 'accent';
}
export const ecartTeinte = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/* ---------------------------------------------------------------
   Signature visuelle d'un produit (mise en cache par objet produit).
   --------------------------------------------------------------- */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TEXTILES = { velours: 'velours', boucle: 'boucle', cuir: 'cuir', tissu: 'tissu', fourrure: 'fourrure', corde: 'fibre', lin: 'tissu' };
const COURBES = new Set(['courbe', 'cocon', 'petales', 'ovale', 'rond', 'ronde', 'anneau', 'sculptural', 'vague', 'nuage', 'bulle', 'galet', 'ailes', 'bergere', 'club', 'pouf']);
const DROITES = new Set(['lineaire', 'rect', 'rectangulaire', 'angle', 'modules', 'tubulaire', 'cannelee', 'bureau', 'console', 'buffet', 'etagere', 'armoire', 'commode', 'tv', 'chevet']);
// Familles qui n'ont pas de style propre : elles suivent la pièce sans la juger.
const SANS_STYLE = new Set(['tv', 'tv-murale', 'plante', 'baignoire', 'plafonnier']);

export function toneBois(p) {
  const t = norm([p.bois, p.generique ? p.mat : '', p.titre].join(' '));
  if (/bois noir|noirci|ebene|wenge/.test(t)) return 'noir';
  if (/noyer|walnut|acajou|palissandre|bois fonce|chene fonce/.test(t)) return 'fonce';
  if (/teck|teak|merisier|chene dore|bambou|rotin|rattan/.test(t)) return 'moyen';
  if (/chene clair|frene|bouleau|erable|pin|bois blanc|chene|oak|bois clair|ash/.test(t)) return 'clair';
  return null;
}
export function finitionMetal(p) {
  const t = norm([p.titre, p.nom, p.mat].join(' '));
  if (p.metal === 'laiton' || /laiton|brass|dore|or brosse|bronze|cuivre/.test(t)) return 'laiton';
  if (p.metal === 'chrome' || /chrom|inox|acier brosse|argente|nickel/.test(t)) return 'chrome';
  // « noir » est la valeur par défaut de l'export : on ne la compte que si la fiche la confirme.
  if (/metal noir|acier noir|structure noire|pieds noirs|fer forge|noir mat/.test(t)) return 'noir';
  return null;
}
function texture(p) {
  if (p.generique) return /tissu|lin/.test(norm(p.mat)) ? 'tissu' : null;
  const m = TEXTILES[norm(p.mat)];
  if (m) return m;
  const t = norm(p.titre);
  for (const [cle, val] of Object.entries(TEXTILES)) if (t.includes(cle)) return val;
  return null;
}
function forme(p) {
  const st = norm(p.st), t = norm([p.titre, p.nom].join(' '));
  if (COURBES.has(st) || /\b(courbe|arrondi|organique|rond|ovale|galbe|sculptural)\b/.test(t)) return 'courbe';
  if (DROITES.has(st) || /\b(lignes? droites?|rectangulaire|geometrique|cubique|anguleux)\b/.test(t)) return 'droite';
  return null;
}
// Surface vue d'un meuble (face + un peu du dessus) : ce qui pèse dans le regard.
export function poidsVisuel(p) {
  const [w = .5, d = .5, h = .5] = p.dim || [];
  if (p.fam === 'tapis') return w * d * .6;
  if (['tableau', 'miroir'].includes(p.fam)) return w * h * .8;
  return w * h + .3 * w * d;
}

// Statistiques par style des scores OpenCLIP du catalogue : un même prompt peut donner des
// cosinus plus élevés pour tous les produits (biais de prompt). On centre et on réduit.
const STATS = new WeakMap();
export function statistiquesStyles(catalogue) {
  if (!catalogue || typeof catalogue !== 'object') return null;
  if (STATS.has(catalogue)) return STATS.get(catalogue);
  const valeurs = Object.fromEntries(STYLES_HARMONIE.map(s => [s, []]));
  for (const p of Object.values(catalogue)) for (const s of STYLES_HARMONIE) {
    const v = p?.styleVisuel?.scores?.[s];
    if (Number.isFinite(v)) valeurs[s].push(v);
  }
  const stats = Object.fromEntries(STYLES_HARMONIE.map(s => {
    const l = valeurs[s], n = l.length, m = n ? l.reduce((a, b) => a + b, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(l.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
    return [s, { m, sd }];
  }));
  STATS.set(catalogue, stats);
  return stats;
}

// Indices de style portés par les matières, finitions et motifs (ce qu'un décorateur lit d'un
// coup d'œil). Chaque indice répartit un poids sur les styles où il est typique.
export const INDICES_STYLE = Object.freeze([
  { motif: /\b(tropica\w*|palmier\w*|jungle|feuillage)\b/, styles: { boheme: 1, audacieux: .6, mediterraneen: .4 } },
  { motif: /\b(mandala|chinoiserie\w*|oiseau\w*|paons?|floral\w*|fleurs)\b/, styles: { classique: .7, boheme: .6, artdeco: .5, audacieux: .4 } },
  { motif: /\b(laque\w* noir\w*|noir laque\w*)\b/, styles: { artdeco: 1, classique: .5, contemporain: .3 } },
  { motif: /\b(dore\w*|or brosse|laiton|brass|feuille d.or)\b/, styles: { artdeco: 1, classique: .7, chaleureux: .2 } },
  { motif: /\b(baroque|tete de lion|capitonn\w*|chesterfield|moulure\w*|bergere)\b/, styles: { classique: 1, artdeco: .4 } },
  { motif: /\b(cannel\w*|cannage|geometri\w*|eventail)\b/, styles: { artdeco: 1, contemporain: .3 } },
  { motif: /\b(bouclette|boucle)\b/, styles: { japandi: .6, contemporain: .6, scandinave: .5, epure: .3 } },
  { motif: /\b(peau de mouton|mouton|fourrure)\b/, styles: { scandinave: .8, chaleureux: .8 } },
  { motif: /\b(rotin|rattan|cannage naturel|osier|jonc|tresse\w*|corde)\b/, styles: { boheme: 1, mediterraneen: .8, japandi: .4 } },
  { motif: /\b(chene clair|bois clair|frene|bouleau)\b/, styles: { scandinave: 1, japandi: .8, epure: .4 } },
  { motif: /\b(noyer|bois fonce|teck)\b/, styles: { chaleureux: .8, japandi: .5, classique: .3 } },
  { motif: /\b(tubulaire|chrom\w*|inox)\b/, styles: { contemporain: .8, industriel: .6, audacieux: .3 } },
  { motif: /\b(acier|metal brut|beton|fer forge|rivet\w*)\b/, styles: { industriel: 1, contemporain: .3 } },
  { motif: /\b(terracotta|terre cuite|argile|pierre|travertin|chaux)\b/, styles: { mediterraneen: 1, chaleureux: .5, japandi: .3 } },
  { motif: /\b(pop|multicolore|arc.en.ciel|electrique|fluo|acidule\w*)\b/, styles: { audacieux: 1.2 } },
  { motif: /\b(sculptural|organique|courbe\w*|galet|nuage)\b/, styles: { contemporain: .7, audacieux: .4, japandi: .2 } },
  { motif: /\b(lin|coton brut|naturel\w*)\b/, styles: { japandi: .5, scandinave: .5, mediterraneen: .5, epure: .3 } }
]);

// Distribution de style d'un produit (somme 1), ou null s'il n'a aucun indice de style.
export function vecteurStyle(p, stats = null) {
  if (!p || SANS_STYLE.has(p.fam)) return null;
  const brut = Object.fromEntries(STYLES_HARMONIE.map(s => [s, 0]));
  let indices = 0;
  const t = descriptionDe(p);
  for (const s of STYLES_HARMONIE) {
    const n = PROFILS[s].mots.filter(m => t.includes(m)).length;
    if (n) { brut[s] += Math.min(2, n) * .5; indices++; }
  }
  for (const i of INDICES_STYLE) if (i.motif.test(t)) { for (const [s, w] of Object.entries(i.styles)) brut[s] += w; indices++; }
  for (const e of p.stylesEditoriaux || etiquettesStyle(p)) if (brut[e.style] != null) { brut[e.style] += e.score; indices++; }
  const v = p.styleVisuel?.scores;
  if (v && stats) {
    // Scores centrés-réduits puis softmax : un écart d'un écart-type compte, pas un cosinus brut.
    const z = STYLES_HARMONIE.map(s => stats[s]?.sd > 1e-6 && Number.isFinite(v[s]) ? (v[s] - stats[s].m) / stats[s].sd : 0);
    const ex = z.map(x => Math.exp(Math.max(-6, Math.min(6, x)))), som = ex.reduce((a, b) => a + b, 0);
    STYLES_HARMONIE.forEach((s, i) => { brut[s] += 1.5 * ex[i] / som; });
    indices++;
  }
  if (!indices) return null;
  const total = Object.values(brut).reduce((a, b) => a + b, 0);
  return total > 0 ? Object.fromEntries(Object.entries(brut).map(([s, x]) => [s, x / total])) : null;
}

const CACHE = new WeakMap();
export function signature(p, stats = null) {
  if (!p) return null;
  if (CACHE.has(p) && CACHE.get(p).stats === stats) return CACHE.get(p).sig;
  const couleurs = (p.cols || []).map(lab).filter(Boolean).map(c => ({ ...c, nature: natureCouleur(c) }));
  const sig = {
    id: p.id, fam: p.fam, couleurs, poids: poidsVisuel(p),
    bois: toneBois(p), metal: finitionMetal(p), texture: texture(p), forme: forme(p),
    style: vecteurStyle(p, stats), ornemental: !SANS_STYLE.has(p.fam) && ornemental(p),
    // Pièce forte : très colorée et assez grande, ou explicitement sculpturale.
    forte: (couleurs.some(c => c.nature === 'accent' && c.C > 45) && poidsVisuel(p) > .35) || /sculptural/.test(norm(p.st))
  };
  CACHE.set(p, { stats, sig });
  return sig;
}

/* ---------------------------------------------------------------
   Bilan d'un ensemble de produits (une pièce ou une zone).
   Chaque règle porte des points (+ ou −), les produits en cause et un texte.
   --------------------------------------------------------------- */
const TEXTES = {
  fr: {
    'accents-trop-nombreux': n => `${n} couleurs d'accent : la palette se disperse (2 suffisent, 3 au plus).`,
    'accents-heurtes': () => `Deux couleurs vives se heurtent : choisir des teintes voisines ou opposées.`,
    'accents-accordes': () => `Les couleurs d'accent s'accordent (voisines ou complémentaires).`,
    'saturation-hors-style': () => `Une couleur très vive pour ce style : préférer une teinte adoucie (sauge, argile, bleu gris).`,
    'accent-repete': () => `La couleur d'accent revient plusieurs fois : elle relie la pièce.`,
    'accent-isole': () => `Une couleur vive n'apparaît qu'une fois : la répéter (coussin, tableau, objet) ou l'éviter.`,
    'contraste-faible': () => `Tout est de même valeur : ajouter un élément nettement plus clair ou plus foncé.`,
    'contraste-bon': () => `Bon contraste de clairs et de foncés.`,
    'bois-trop-nombreux': n => `${n} teintes de bois différentes : en garder deux au plus.`,
    'bois-presque': () => `Deux bois presque identiques sans l'être : les assortir ou franchement les contraster.`,
    'metaux-melanges': n => `${n} finitions de métal : une dominante, une seconde au plus.`,
    'textures-monotones': () => `Une seule matière sur toutes les assises : varier (velours, bouclé, cuir, lin).`,
    'textures-variees': () => `Mélange de textures maîtrisé.`,
    'textures-dispersees': n => `${n} matières d'assise : l'ensemble manque d'unité.`,
    'formes-rigides': () => `Que des lignes droites : une courbe (table basse, miroir, fauteuil) adoucirait l'ensemble.`,
    'formes-dispersees': () => `Courbes et lignes droites à parts égales : affirmer une dominante.`,
    'pieces-fortes': n => `${n} pièces fortes se disputent le regard : en garder une par zone.`,
    'styles-heurtes': () => `Des styles qui se heurtent dans la même pièce.`,
    'styles-coherents': () => `Les styles des pièces se répondent.`,
    'hors-brief': () => `Une pièce s'éloigne nettement du style demandé.`
  },
  en: {
    'accents-trop-nombreux': n => `${n} accent colours: the palette scatters (2 is enough, 3 at most).`,
    'accents-heurtes': () => `Two strong colours clash: pick neighbouring or opposite hues.`,
    'accents-accordes': () => `Accent colours work together (analogous or complementary).`,
    'saturation-hors-style': () => `A very bright colour for this style: prefer a muted hue (sage, clay, grey blue).`,
    'accent-repete': () => `The accent colour comes back several times and ties the room together.`,
    'accent-isole': () => `A strong colour appears only once: repeat it (cushion, art, object) or drop it.`,
    'contraste-faible': () => `Everything has the same value: add something clearly lighter or darker.`,
    'contraste-bon': () => `Good balance of lights and darks.`,
    'bois-trop-nombreux': n => `${n} different wood tones: keep two at most.`,
    'bois-presque': () => `Two almost-matching woods: match them or contrast them clearly.`,
    'metaux-melanges': n => `${n} metal finishes: one dominant, one secondary at most.`,
    'textures-monotones': () => `The same material on every seat: mix velvet, bouclé, leather, linen.`,
    'textures-variees': () => `Controlled mix of textures.`,
    'textures-dispersees': n => `${n} seat materials: the room lacks unity.`,
    'formes-rigides': () => `Only straight lines: one curve (coffee table, mirror, chair) would soften the room.`,
    'formes-dispersees': () => `Curves and straight lines in equal parts: commit to one.`,
    'pieces-fortes': n => `${n} statement pieces compete for attention: keep one per area.`,
    'styles-heurtes': () => `Clashing styles in the same room.`,
    'styles-coherents': () => `The pieces' styles work together.`,
    'hors-brief': () => `One piece moves clearly away from the requested style.`
  }
};
export const POIDS_HARMONIE = Object.freeze({
  accentsTrop: -6, accentsHeurtes: -6, accentsAccordes: 3, accentRepete: 3, accentIsole: -2,
  contrasteFaible: -4, contrasteBon: 2, boisTrop: -5, boisPresque: -3, metauxMelanges: -4,
  texturesMonotones: -2, texturesVariees: 2, texturesDispersees: -3, formesRigides: -2, formesDispersees: -2,
  piecesFortes: -5, stylesHeurtes: -8, stylesCoherents: 4, horsBrief: -6, saturationHorsStyle: -3
});

function stylesCibles(preferences) {
  const ids = (preferences?.styles?.length ? preferences.styles : [preferences?.style]).filter(s => STYLES_HARMONIE.includes(s));
  return ids;
}
// compatibilité attendue entre deux distributions de style : Σ vᵢ wⱼ A(i, j)
function compatibilite(v, w) {
  let s = 0;
  for (const [a, x] of Object.entries(v)) if (x > .02) for (const [b, y] of Object.entries(w)) if (y > .02) s += x * y * affiniteStyles(a, b);
  return s;
}
// Style dominant d'une distribution : celui qui pèse au moins 25 % et devance le suivant.
export function styleDominant(v) {
  if (!v) return null;
  const [a, b] = Object.entries(v).sort((x, y) => y[1] - x[1]);
  return a && a[1] >= .25 && a[1] - (b?.[1] || 0) >= .05 ? a[0] : null;
}
// Affinité attendue d'une distribution de style avec le brief : Σ vₛ · max_c A(s, c).
// Un produit sans parti pris (distribution plate) obtient environ 0,6 ; sous 0,45 il détonne.
export const SEUIL_HORS_BRIEF = .45;
export function affiniteBrief(v, cibles) {
  if (!v || !cibles.length) return null;
  return Object.entries(v).reduce((s, [st, x]) => s + x * Math.max(...cibles.map(c => affiniteStyles(st, c))), 0);
}
// Hors brief : affinité moyenne trop basse, ou motif ornemental dans un style resserré
// (japandi, scandinave, épuré refusent les motifs chargés, même dans une pièce par ailleurs sobre).
function styleHorsBrief(v, cibles, orne = false) {
  if (orne && cibles.every(c => RESSERRES.has(c))) return true;
  const a = affiniteBrief(v, cibles);
  return a != null && a < SEUIL_HORS_BRIEF;
}
// Le produit est-il franchement hors du style demandé ? (sert à la sélection)
export function horsStyle(p, preferences, catalogue) {
  const cibles = stylesCibles(preferences);
  if (!cibles.length || !p) return false;
  const s = signature(p, statistiquesStyles(catalogue));
  return !!s && (!!s.style || s.ornemental) && styleHorsBrief(s.style, cibles, s.ornemental);
}

export function bilanHarmonie(produits, opts = {}) {
  const langue = opts.langue === 'en' ? 'en' : 'fr', T = TEXTES[langue];
  const stats = opts.stats ?? statistiquesStyles(opts.catalogue);
  const sigs = produits.filter(Boolean).map(p => signature(p, stats)).filter(Boolean);
  const cibles = stylesCibles(opts.preferences);
  const tolerant = cibles.some(s => TOLERANTS.has(s)), resserre = cibles.length > 0 && cibles.every(s => RESSERRES.has(s));
  const regles = [], ajouter = (id, points, ids = [], n) => regles.push({ id, points: Math.round(points * 100) / 100, ids, texte: T[id](n) });

  // 1. Palette : accents (teintes vives) pondérés par le poids visuel.
  const accents = [];
  for (const s of sigs) for (const c of s.couleurs) if (c.nature === 'accent') accents.push({ ...c, id: s.id, poids: s.poids / s.couleurs.length });
  const familles = [];
  for (const a of [...accents].sort((x, y) => y.poids - x.poids)) {
    const f = familles.find(f => ecartTeinte(f.h, a.h) < 25);
    if (f) { f.ids.add(a.id); f.poids += a.poids; } else familles.push({ h: a.h, C: a.C, ids: new Set([a.id]), poids: a.poids });
  }
  // Une famille qui pèse moins de 3 % du total visuel est un détail, pas un accent de palette.
  const total = sigs.reduce((s, x) => s + x.poids, 0) || 1;
  const visibles = familles.filter(f => f.poids / total > .03);
  const maxAccents = tolerant ? 4 : resserre ? 2 : 3;
  if (visibles.length > maxAccents) ajouter('accents-trop-nombreux', POIDS_HARMONIE.accentsTrop * (visibles.length - maxAccents), visibles.flatMap(f => [...f.ids]), visibles.length);
  let heurt = null, accord = false;
  for (let i = 0; i < visibles.length; i++) for (let j = i + 1; j < visibles.length; j++) {
    const d = ecartTeinte(visibles[i].h, visibles[j].h);
    // Voisines (< 45°) ou complémentaires (150–210°) : accord ; entre 60° et 120° avec deux couleurs saturées : heurt.
    if (d < 45 || (d >= 150 && d <= 210)) accord = true;
    else if (d >= 60 && d <= 120 && visibles[i].C > 35 && visibles[j].C > 35 && !heurt) heurt = [...visibles[i].ids, ...visibles[j].ids];
  }
  if (heurt && !tolerant) ajouter('accents-heurtes', POIDS_HARMONIE.accentsHeurtes, heurt);
  else if (accord && visibles.length >= 2) ajouter('accents-accordes', POIDS_HARMONIE.accentsAccordes);
  for (const f of visibles) {
    if (f.ids.size >= 2) { ajouter('accent-repete', POIDS_HARMONIE.accentRepete, [...f.ids]); break; }
  }
  // Japandi, scandinave, épuré : des accents doux (sauge, argile, bleu gris), pas de couleurs vives.
  const vives = resserre ? visibles.filter(f => f.C > 50 && f.poids / total > .06) : [];
  if (vives.length) ajouter('saturation-hors-style', POIDS_HARMONIE.saturationHorsStyle * vives.length, vives.flatMap(f => [...f.ids]));
  const isoles = visibles.filter(f => f.ids.size === 1 && f.C > 40 && sigs.length >= 4);
  if (isoles.length && !visibles.some(f => f.ids.size >= 2)) ajouter('accent-isole', POIDS_HARMONIE.accentIsole * Math.min(2, isoles.length), isoles.flatMap(f => [...f.ids]));

  // 2. Valeurs : il faut des clairs et des foncés (au moins 35 points de L* d'écart).
  // La structure des valeurs vient des neutres, des bois et des teintes douces : une couleur
  // vive ne doit pas « acheter » du contraste qu'un bois foncé ou un noir apporterait mieux.
  const L = sigs.flatMap(s => s.couleurs.filter(c => c.nature !== 'accent' || c.C < 40).map(c => c.L));
  // Japandi, scandinave, épuré : un camaïeu de clairs est voulu. Une touche foncée suffit
  // (lampe, cadre) ; un grand meuble noir ne doit pas être récompensé pour « corriger » la pièce.
  if (L.length >= 3) {
    const ecart = Math.max(...L) - Math.min(...L);
    if (ecart < (resserre ? 25 : 35)) ajouter('contraste-faible', resserre ? POIDS_HARMONIE.contrasteFaible / 4 : POIDS_HARMONIE.contrasteFaible);
    else if (ecart > 50 && !resserre) ajouter('contraste-bon', POIDS_HARMONIE.contrasteBon);
  }

  // 3. Bois : deux teintes au plus, et pas deux teintes voisines (« presque assorties »).
  const bois = new Map();
  for (const s of sigs) if (s.bois) bois.set(s.bois, [...(bois.get(s.bois) || []), s.id]);
  if (bois.size > 2) ajouter('bois-trop-nombreux', POIDS_HARMONIE.boisTrop * (bois.size - 2), [...bois.values()].flat(), bois.size);
  else if (bois.size === 2) {
    const [a, b] = [...bois.keys()], ordre = ['clair', 'moyen', 'fonce', 'noir'];
    if (Math.abs(ordre.indexOf(a) - ordre.indexOf(b)) === 1 && !(a === 'fonce' && b === 'noir') && !(a === 'noir' && b === 'fonce'))
      ajouter('bois-presque', POIDS_HARMONIE.boisPresque, [...bois.values()].flat());
  }

  // 4. Métaux : une dominante, une seconde au plus ; laiton et chrome ensemble seulement si l'un domine.
  const metaux = new Map();
  for (const s of sigs) if (s.metal) metaux.set(s.metal, [...(metaux.get(s.metal) || []), s.id]);
  const comptes = [...metaux.values()].map(l => l.length).sort((a, b) => b - a);
  if (metaux.size > 2 || (metaux.has('laiton') && metaux.has('chrome') && comptes[0] === comptes[1]))
    ajouter('metaux-melanges', POIDS_HARMONIE.metauxMelanges, [...metaux.values()].flat(), metaux.size);

  // 5. Textures des assises et textiles : 2 à 4 matières ; une seule = monotone.
  const textiles = sigs.filter(s => s.texture && ['canape', 'fauteuil', 'lit', 'banc', 'pouf', 'meridienne', 'chaise', 'tabouret'].includes(s.fam));
  const matieres = new Set(textiles.map(s => s.texture));
  if (textiles.length >= 3 && matieres.size === 1) ajouter('textures-monotones', POIDS_HARMONIE.texturesMonotones, textiles.map(s => s.id));
  else if (matieres.size > (tolerant ? 5 : 4)) ajouter('textures-dispersees', POIDS_HARMONIE.texturesDispersees, textiles.map(s => s.id), matieres.size);
  else if (matieres.size >= 2) ajouter('textures-variees', POIDS_HARMONIE.texturesVariees);

  // 6. Formes : une dominante (≥ 65 %) et quelques contrepoints ; tout droit = rigide.
  const formes = sigs.filter(s => s.forme && !['tableau', 'miroir', 'tapis'].includes(s.fam));
  if (formes.length >= 4) {
    const courbes = formes.filter(s => s.forme === 'courbe').length / formes.length;
    if (courbes === 0 && !cibles.some(s => ['industriel', 'epure'].includes(s))) ajouter('formes-rigides', POIDS_HARMONIE.formesRigides, formes.map(s => s.id));
    else if (courbes > .35 && courbes < .65 && formes.length >= 5) ajouter('formes-dispersees', POIDS_HARMONIE.formesDispersees, formes.map(s => s.id));
  }

  // 7. Pièces fortes : une par zone, sauf dans un style audacieux ou bohème.
  const fortes = sigs.filter(s => s.forte);
  const maxFortes = tolerant ? 3 : resserre ? 1 : 2;
  if (fortes.length > maxFortes) ajouter('pieces-fortes', POIDS_HARMONIE.piecesFortes * (fortes.length - maxFortes), fortes.map(s => s.id), fortes.length);

  // 8. Styles : compatibilité moyenne entre pièces (pondérée par le poids visuel), et écart au brief.
  const styles = sigs.filter(s => s.style);
  let coherence = null;
  if (styles.length >= 2) {
    let som = 0, poids = 0, pire = { v: 1, ids: [] };
    for (let i = 0; i < styles.length; i++) for (let j = i + 1; j < styles.length; j++) {
      const w = Math.sqrt(styles[i].poids * styles[j].poids), c = compatibilite(styles[i].style, styles[j].style);
      som += w * c; poids += w;
      if (c < pire.v) pire = { v: c, ids: [styles[i].id, styles[j].id] };
    }
    coherence = poids ? som / poids : null;
    if (coherence != null && coherence < .5) ajouter('styles-heurtes', POIDS_HARMONIE.stylesHeurtes * (.5 - coherence) / .2, pire.ids);
    else if (coherence != null && coherence > .68) ajouter('styles-coherents', POIDS_HARMONIE.stylesCoherents);
  }
  if (cibles.length) {
    const hors = sigs.filter(s => s.poids > .2 && (s.style || s.ornemental) && styleHorsBrief(s.style, cibles, s.ornemental));
    if (hors.length) ajouter('hors-brief', POIDS_HARMONIE.horsBrief * Math.min(2, hors.length), hors.map(s => s.id));
  }

  const score = Math.round(regles.reduce((s, r) => s + r.points, 0) * 100) / 100;
  const parNature = n => sigs.flatMap(s => s.couleurs.filter(c => c.nature === n).map(() => s.poids)).reduce((a, b) => a + b, 0);
  return {
    version: VERSION_HARMONIE, score, regles,
    palette: { accents: visibles.map(f => Math.round(f.h)), neutres: Math.round(parNature('neutre') * 100) / 100, naturels: Math.round(parNature('naturel') * 100) / 100 },
    bois: [...bois.keys()], metaux: [...metaux.keys()], matieres: [...matieres], coherenceStyle: coherence != null ? Math.round(coherence * 100) / 100 : null,
    aRevoir: regles.filter(r => r.points < 0).sort((a, b) => a.points - b.points).slice(0, 3).map(r => r.texte)
  };
}

// Ce qu'un candidat apporte à l'ensemble déjà choisi (positif : il l'améliore).
// Un même produit peut revenir (chaises, chevets) : il compte alors une fois de plus.
export function gainHarmonie(candidat, choisis, opts = {}) {
  if (!candidat) return 0;
  const base = choisis.filter(Boolean);
  const stats = opts.stats ?? statistiquesStyles(opts.catalogue);
  const o = { ...opts, stats };
  return bilanHarmonie([...base, candidat], o).score - bilanHarmonie(base, o).score;
}
