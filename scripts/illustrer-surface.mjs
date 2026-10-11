// Deux vues opposées par résultat, caméra et maillages identiques avant/après.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { sceneDe, rasteriser } from './maquette.mjs';
const require = createRequire(import.meta.url), sharp = require('sharp');
const dossier = path.resolve('docs/composition-surface'), W = 900, H = 620;
for (const surface of [10, 18, 30, 90]) {
  const variantes = [];
  for (const nom of ['avant', 'apres']) {
    const data = JSON.parse(await fs.readFile(path.join(dossier, `${surface}-${nom}.json`), 'utf8'));
    const { largeur: L, profondeur: P } = data.modele.dims, taille = Math.max(L, P), zoom = taille * .6;
    const camera = new THREE.OrthographicCamera(-zoom * W / H, zoom * W / H, zoom, -zoom, .01, 100);
    const images = [];
    for (const cote of [-1, 1]) {
      camera.position.set(cote * taille * 1.2, taille * 1.05, -cote * taille); camera.lookAt(0, .65, 0);
      const png = rasteriser(sceneDe(data, camera), camera, W, H);
      images.push(png);
    }
    const double = await sharp({ create: { width: W, height: H * 2, channels: 3, background: '#faf8f2' } }).composite(images.map((input, i) => ({ input, left: 0, top: i * H }))).jpeg({ quality: 90 }).toBuffer();
    await fs.writeFile(path.join(dossier, `${surface}-${nom}.jpg`), double); variantes.push({ image: double, objets: data.items.length });
    if (surface === 30) await sharp(double).resize({ width: 600 }).jpeg({ quality: 80 }).toFile(path.join(dossier, `${surface}-${nom}-vision.jpg`));
  }
  const entete = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1840" height="145"><rect width="1840" height="145" fill="#faf8f2"/><g font-family="sans-serif" fill="#3e3930"><text x="30" y="44" font-size="28">${surface} m² · composition à l’échelle</text><text x="30" y="80" font-size="17">Même pièce synthétique, catalogue, brief et caméras. Deux vues opposées.</text><text x="30" y="122" font-size="22">Avant · ${variantes[0].objets} objets</text><text x="950" y="122" font-size="22">Après · ${variantes[1].objets} objets</text></g></svg>`);
  await sharp({ create: { width: 1840, height: H * 2 + 145, channels: 3, background: '#faf8f2' } }).composite([{ input: entete, top: 0, left: 0 }, ...variantes.map((v, i) => ({ input: v.image, left: 20 + i * 920, top: 145 }))]).jpeg({ quality: 90 }).toFile(path.join(dossier, `${surface}-comparaison.jpg`));
  console.log(`${surface} m² : rendus logiciel avant/après produits.`);
}
