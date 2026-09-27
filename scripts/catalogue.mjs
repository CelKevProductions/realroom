// Catalogue de RealRoom : produits Maison Corleone -> data/catalogue.json
//
// Sources (dans outils/sources/) :
//   catalogue.js : produits actifs de la boutique (généré par outils/catalogue.py depuis Shopify)
//   produits.js  : pièces choisies à la main (texte, maquette 3D détaillée « look ») et règles de fusion
// Mise à jour :
//   SHOPIFY_BOUTIQUE=… SHOPIFY_JETON=… python3 outils/export_shopify.py
//   python3 outils/catalogue.py && npm run catalogue
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(RACINE, 'outils', 'sources', f), 'utf8');

// les deux fichiers sont des scripts de navigateur : on les exécute dans un bac à sable
const bac = { window: {}, console };
vm.createContext(bac);
vm.runInContext(lire('catalogue.js'), bac);
vm.runInContext(lire('produits.js'), bac);
const P = bac.window.MC_DATA.PRODUITS;
const LIBELLES = bac.window.MC_DATA.LIBELLES || {};

const court = (t, n) => (t && t.length > n ? t.slice(0, t.lastIndexOf(' ', n)).replace(/[,;:\s]+$/, '') + '…' : t || '');
const produits = {};
let sansDims = 0;
for (const [id, p] of Object.entries(P)) {
  if (!p.fam || !p.dim) { sansDims++; continue; }
  produits[id] = {
    id,
    marque: 'Maison Corleone',
    nom: p.nom,
    titre: p.titre || p.nom,
    cat: p.cat,
    fam: p.fam,
    st: p.st || '',
    prix: p.prix || 0,
    prixMax: p.prixMax || null,
    parModule: !!p.parModule,
    img: p.img || null,
    vign: p.vign || p.img || null,
    imgs: (p.imgs || []).slice(0, 3),
    texte: court(p.texte, 420),
    points: p.points || [],
    url: p.url,
    dim: p.dim.map(v => Math.round(v * 1000) / 1000),
    dimsLues: p.dimsLues !== false,
    cols: p.cols || [],
    couleurs: p.couleurs || [],
    fc: p.fc || '',
    mat: p.mat || 'tissu',
    metal: p.metal || 'noir',
    bois: p.bois || '',
    verre: p.verre || '',
    led: !!p.led,
    chevets: !!p.chevets,
    ext: !!p.ext,
    couchage: p.couchage || null,
    look: p.look || null
  };
}

const sortie = { genere: new Date().toISOString().slice(0, 10), marques: ['Maison Corleone'], libelles: LIBELLES, produits };
fs.mkdirSync(path.join(RACINE, 'data'), { recursive: true });
fs.writeFileSync(path.join(RACINE, 'data', 'catalogue.json'), JSON.stringify(sortie));
// copie publique pour l'éditeur 3D du navigateur (servie statiquement, mise en cache)
fs.writeFileSync(path.join(RACINE, 'public', 'catalogue.json'), JSON.stringify(sortie));
const familles = {};
Object.values(produits).forEach(p => { familles[p.fam] = (familles[p.fam] || 0) + 1; });
console.log(Object.keys(produits).length, 'produits ->', 'data/catalogue.json',
  Math.round(fs.statSync(path.join(RACINE, 'data', 'catalogue.json')).size / 1024), 'Ko', sansDims ? '(' + sansDims + ' sans dimensions, écartés)' : '');
console.log(JSON.stringify(familles));
