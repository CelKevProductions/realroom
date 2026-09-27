// Assemble moteur/meubles.js (module ES) à partir des constructeurs 3D de la visite Maison Corleone :
// socle (matières, textures, outils de modélisation), maquettes détaillées des pièces choisies,
// maquettes génériques du catalogue complet. Lancé une fois à la création de RealRoom ; ensuite
// moteur/meubles.js est maintenu directement ici (ne relancer que pour reprendre la visite).
//   node scripts/moteur.mjs /chemin/vers/visite-privee-maison-corleone/src
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
if (!SRC) { console.error('Donner le dossier src/ de la visite Maison Corleone.'); process.exit(1); }
const lire = f => fs.readFileSync(path.join(SRC, f), 'utf8');

let core = lire('v3d-core.js');
if (!core.includes('const DATA = window.MC_DATA;')) throw new Error('v3d-core.js inattendu');
core = core.replace('const DATA = window.MC_DATA;',
  '// produits connus des constructeurs (catalogue et meubles relevés sur les photos)\nlet DATA = { PRODUITS: {} };\nfunction definirProduits(P) { DATA = { PRODUITS: P }; }');
core = core.replace('let R = alea(7);', 'let R = alea(7);\n// graine du hasard des maquettes : même meuble, même maquette\nfunction graine(n) { R = alea(n); }');

const exports = [
  'THREE', 'RoomEnvironment', 'mergeGeometries', 'TAU', 'V3', 'lerp', 'clamp', 'alea', 'graine',
  'mesh', 'place', 'bloc', 'cyl', 'sphere', 'tore', 'tour', 'tube', 'extrude', 'groupe', 'instances',
  'canvasTex', 'tex', 'std', 'M', 'LUMINEUX', 'ombreSol', 'halo', 'cuire', 'ANIMS',
  'definirProduits', 'construireProduit', 'construireCatalogue', 'CAT_GENERIQUE'
];
const sortie = [
  '/* =================================================================',
  '   RealRoom — constructeurs 3D des meubles',
  '   Repris de la visite Maison Corleone (scripts/moteur.mjs), maintenus ici.',
  '   Conventions : mètres, origine au sol, centrée, face avant vers +z ;',
  '   appliques : origine au mur ; suspensions : origine au plafond.',
  '   ================================================================= */',
  core.trim(),
  lire('v3d-objets.js').trim(),
  lire('v3d-catalogue.js').trim(),
  '',
  'export { ' + exports.join(', ') + ' };',
  ''
].join('\n\n');
fs.mkdirSync(path.join(RACINE, 'moteur'), { recursive: true });
fs.writeFileSync(path.join(RACINE, 'moteur', 'meubles.js'), sortie);
console.log('moteur/meubles.js', Math.round(sortie.length / 1024), 'Ko');
