// Maquette métrique synthétique, mêmes positions et caméra. Aucun plan ou cliché client.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as THREE from 'three';

const dossier=path.resolve('docs/composition-hauteur');
const donnees=await Promise.all(['avant','apres'].map(async n=>JSON.parse(await fs.readFile(path.join(dossier,n+'.json'),'utf8'))));
import { sceneDe, rasteriser } from './maquette.mjs';
const W=900,H=570,cam=new THREE.OrthographicCamera(-3.25*W/H,3.25*W/H,3.25,-3.25,.01,100);
const vues=[[-6,5.2,5],[6,5.2,-5]];
const sorties=[];
for(let i=0;i<2;i++){
  const paths=[];
  for(const vue of vues){
    cam.position.set(...vue);cam.lookAt(0,.7,0);cam.updateMatrixWorld();
    const png=rasteriser(sceneDe(donnees[i],cam),cam,W,H);
    paths.push(`<image x="${-W/2}" y="${-H/2}" width="${W}" height="${H}" href="data:image/png;base64,${png.toString('base64')}"/>`);
  }
  sorties.push(paths);
  await fs.writeFile(path.join(dossier,(i?'apres':'avant')+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H*2}" viewBox="0 0 ${W} ${H*2}"><rect width="${W}" height="${H*2}" fill="#FAF8F2"/><g transform="translate(${W/2} ${H/2})">${paths[0]}</g><g transform="translate(${W/2} ${H*1.5})">${paths[1]}</g></svg>\n`);
}
const comparaison=`<svg xmlns="http://www.w3.org/2000/svg" width="1840" height="1370" viewBox="0 0 1840 1370">
<rect width="1840" height="1370" fill="#FAF8F2"/>
<g font-family="sans-serif" fill="#3E3930"><text x="40" y="48" font-size="28">Salon de référence · une pièce achevée</text>
<text x="40" y="78" font-size="17" fill="#716658">20 m² · même mobilier au sol, mêmes ouvertures et même caméra</text>
<text x="40" y="122" font-size="22">Avant · sans la couche composition</text><text x="960" y="122" font-size="22">Après · télévision, éclairage et murs</text></g>
<g transform="translate(460 435)">${sorties[0][0]}</g><g transform="translate(1380 435)">${sorties[1][0]}</g>
<g transform="translate(460 1005)">${sorties[0][1]}</g><g transform="translate(1380 1005)">${sorties[1][1]}</g>
<path d="M920 100V1270" stroke="#D8D0C2"/>
<g font-family="sans-serif" fill="#716658" font-size="17"><text x="40" y="1315">Maquette synthétique métrique · vues opposées, parois proches coupées.</text>
<text x="960" y="1315">TV 43″ · deux tableaux · suspension : 72,5 cm au-dessus de la table.</text>
<text x="40" y="1346">La comparaison isole les ajouts ; elle ne représente pas un ancien résultat du moteur.</text></g></svg>\n`;
await fs.writeFile(path.join(dossier,'comparaison.svg'),comparaison);
// sharp est disponible avec Next, ou dans le runtime de documents ; aucun téléchargement requis.
const require=createRequire(import.meta.url);let sharp;
try{sharp=require('sharp');}catch{sharp=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','__runtime.cjs'))('sharp');}
for(const nom of ['avant','apres','comparaison'])await sharp(path.join(dossier,nom+'.svg')).png().toFile(path.join(dossier,nom+'.png'));
console.log(path.join(dossier,'comparaison.png'));
