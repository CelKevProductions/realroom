import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { sceneDe,rasteriser } from './maquette.mjs';
const require=createRequire(import.meta.url),sharp=require('sharp'),dossier=path.resolve('docs/encyclopedie'),W=900,H=640;
const dossierModeles=path.resolve(process.env.ENCYCLOPEDIE_MODELES||'.data/encyclopedie-modeles');
for(const surface of [89]) {
  const variantes=[];
  for(const nom of ['avant','apres']) {
    const data=JSON.parse(await fs.readFile(path.join(dossierModeles,`${surface}-${nom}.json`),'utf8'));
    const taille=Math.max(data.modele.dims.largeur,data.modele.dims.profondeur),zoom=taille*.54;
    const camera=new THREE.OrthographicCamera(-zoom*W/H,zoom*W/H,zoom,-zoom,.01,100),images=[];
    for(const cote of [-1,1]){camera.position.set(cote*taille*1.15,taille*1.1,-cote*taille);camera.lookAt(0,.65,0);images.push(rasteriser(sceneDe(data,camera),camera,W,H));}
    const image=await sharp({create:{width:W,height:H*2,channels:3,background:'#faf8f2'}}).composite(images.map((input,i)=>({input,left:0,top:i*H}))).jpeg({quality:90}).toBuffer();
    await fs.writeFile(path.join(dossier,`${surface}-${nom}.jpg`),image);
    await sharp(image).resize({width:650}).jpeg({quality:85}).toFile(path.join(dossier,`${surface}-${nom}-vision.jpg`));
    variantes.push({image,n:data.items.length,props:data.staging?.items.length||0});
  }
  const entete=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1840" height="155"><rect width="1840" height="155" fill="#faf8f2"/><g font-family="sans-serif" fill="#3e3930"><text x="30" y="44" font-size="28">Mission 5 · ${surface} m² · dispositions et encyclopédie</text><text x="30" y="80" font-size="17">Pièce synthétique indépendante. Même catalogue et caméras. Rendu métrique logiciel.</text><text x="30" y="124" font-size="22">Avant · ${variantes[0].n} meubles · ${variantes[0].props} props</text><text x="950" y="124" font-size="22">Après · ${variantes[1].n} meubles · ${variantes[1].props} props</text></g></svg>`);
  await sharp({create:{width:1840,height:H*2+155,channels:3,background:'#faf8f2'}}).composite([{input:entete,left:0,top:0},...variantes.map((v,i)=>({input:v.image,left:20+i*920,top:155}))]).jpeg({quality:90}).toFile(path.join(dossier,`${surface}-comparaison.jpg`));
  console.log(`${surface} m² : rendus avant/après et JPEG pour vision.`);
}
