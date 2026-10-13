import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { sceneDe,rasteriser } from './maquette.mjs';
const require=createRequire(import.meta.url),sharp=require('sharp');
const dossier='docs/ameublement-reference',W=820,H=600;
await fs.mkdir(dossier,{recursive:true});
function volumeControle(p){
 const connus=new Set(['canape','fauteuil','applique','table','chaise','meuble','lampadaire','lampe','buffet','tapis','suspension','lustre','plafonnier']);
 if(p.fam!=='lit'&&(p.generique||connus.has(p.fam)))return null;
 const [w,d,h]=p.dim,g=new THREE.Group();
 const box=(a,b,c,x,y,z,couleur)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),new THREE.MeshLambertMaterial({color:couleur}));o.position.set(x,y+b/2,z);g.add(o);};
 if(p.fam==='lit'){
  box(w,.32,d,0,.08,0,'#A48F7A');box(w-.06,.16,d-.08,0,.4,.01,'#ECE5D7');box(w,h,.08,0,0,-d/2+.04,'#A48F7A');
  for(const x of [-1,1])box(w*.32,.1,.4,x*w*.23,.56,-d/2+.36,'#D9CBB8');
 }else box(w,h,d,0,0,0,'#B6A48C');
 return g;
}
for(const [id,nom] of [[4,'sejour-30'],[5,'sejour-89']]) {
 const variantes=[];
 for(const version of ['avant','apres']) {
  const d=JSON.parse(await fs.readFile(`.data/ameublement-reference/${id}-${version}.json`,'utf8'));
  const taille=Math.max(d.modele.dims.largeur,d.modele.dims.profondeur),zoom=taille*.55;
  const camera=new THREE.OrthographicCamera(-zoom*W/H,zoom*W/H,zoom,-zoom,.01,100),images=[];
  for(const cote of [-1,1]){camera.position.set(cote*taille*1.15,taille*1.1,-cote*taille);camera.lookAt(0,.65,0);images.push(rasteriser(sceneDe(d,camera,volumeControle),camera,W,H));}
  const image=await sharp({create:{width:W,height:2*H,channels:3,background:'#faf8f2'}}).composite(images.map((input,i)=>({input,left:0,top:i*H}))).jpeg({quality:90}).toBuffer();
  await fs.writeFile(`${dossier}/${nom}-${version}.jpg`,image);variantes.push({image,n:d.items.length,props:d.staging?.items.length||0});
 }
 const entete=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="145"><rect width="1680" height="145" fill="#faf8f2"/><g font-family="sans-serif" fill="#3e3930"><text x="25" y="40" font-size="26">Aménagement avec les repères SSR · ${nom==='sejour-30'?'Séjour 30 m²':'Séjour 89 m²'}</text><text x="25" y="76" font-size="16">Pièce synthétique · cotes et caméras identiques · volumes indicatifs de contrôle</text><text x="25" y="117" font-size="20">Avant · ${variantes[0].n} meubles · ${variantes[0].props} détails</text><text x="865" y="117" font-size="20">Après · ${variantes[1].n} meubles · ${variantes[1].props} détails</text></g></svg>`);
 await sharp({create:{width:1680,height:2*H+145,channels:3,background:'#faf8f2'}}).composite([{input:entete,left:0,top:0},...variantes.map((v,i)=>({input:v.image,left:20+i*840,top:145}))]).jpeg({quality:90}).toFile(`${dossier}/${nom}-comparaison.jpg`);
 console.log(nom+' : comparaison prête');
}
